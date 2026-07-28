"""Builds src/data/allocation.json: how each district's STATE allocation for
2024-25 splits into the things the money actually buys.

Why this exists: the prototypical-school model is a *state* formula, so the
"how money reaches your district" walkthrough has to land on the state
allocation, not the district's total revenue. And the state allocation is not
just staff - salaries are barely half of it. The rest is benefits, materials
and operating costs, special education, transportation and the categorical
programs.

Source: OSPI's Apportionment "Final Extract" workbook for 2024-25, the same
file behind the 1191 Apportionment Summary districts receive.
  https://ospi.k12.wa.us/safs-data-files -> Final Extract - School Year 2024-25

Two sheets are used:
  App Revenue - every state and federal allotment by revenue code. Federal
                codes (5xxx/6xxx) and Transportation Vehicle Fund
                depreciation (4499) are excluded: this file is about the
                state's GENERAL FUND allocation, matching the rest of the site.
  Basic Ed    - splits the single "3100 Regular Apportionment" line into
                salaries (Z375), benefits (Z384) and general-education MSOC
                (Z390). Whatever is left in 3100 after those three is reported
                as "other basic education" rather than being modeled: it is
                CTE and skills centers, Running Start, Alternative Learning
                Experience, dropout reengagement and substitutes, net of the
                deductible-revenue and recovery adjustments that also land in
                3100. Taking it as a residual means the parts always sum to
                the 3100 total exactly, which a hand-built list of columns
                would not.

Run: python3 scripts/build-state-allocation.py
"""
import json
import os
import zipfile

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
DATA = os.path.join(HERE, '..', 'src', 'data')
ARCHIVE = os.path.join(RAW, '2425_extract_final.zip')
WORKBOOK = os.path.join(RAW, 'Extract Final 2024-25.xlsx')
SOURCE_URL = 'https://ospi.k12.wa.us/sites/default/files/2026-01/2425_extract-final.zip'

# Basic Ed column indexes (0-based) for the three pieces of 3100 we can name.
COL_CODE = 0
COL_SALARIES = 59      # Z375 TOTAL Salaries
COL_BENEFITS = 68      # Z384 TOTAL Benefits
COL_MSOC = 80          # Z390 Total GenEd MSOC

# App Revenue: which state revenue codes roll into which display bucket. Codes
# are matched on their 4-digit prefix, because OSPI suffixes sub-allocations
# (4158 becomes 415801, 415803, ... for individual grants).
BUCKETS = [
    ('specialEd', ('3121', '4121', '4122', '4126')),
    ('transportation', ('4199',)),
    ('bilingual', ('4165',)),
    ('learningAssistance', ('4155',)),
    ('highlyCapable', ('4174',)),
    ('food', ('4198',)),
    ('levyEqualization', ('3300',)),
]
BASIC_ED_CODE = '3100'
# Transportation Vehicle Fund depreciation - capital, not general fund.
EXCLUDED_CODES = ('4499',)


def ensure_workbook():
    if os.path.exists(WORKBOOK):
        return
    if not os.path.exists(ARCHIVE):
        raise SystemExit(
            f'Missing {ARCHIVE}.\nDownload it from {SOURCE_URL}'
        )
    with zipfile.ZipFile(ARCHIVE) as zf:
        zf.extractall(RAW)


def bucket_for(code):
    """Display bucket for a state revenue code, or None if it is not state
    general-fund money."""
    head = code[:4]
    if head in EXCLUDED_CODES:
        return None
    # Federal (5xxx, 6xxx) and non-state sources are out of scope here.
    if not head.startswith('3') and not head.startswith('4'):
        return None
    if head == BASIC_ED_CODE:
        return 'basicEducation'
    for name, prefixes in BUCKETS:
        if head in prefixes:
            return name
    return 'otherState'


def main():
    ensure_workbook()
    book = openpyxl.load_workbook(WORKBOOK, read_only=True, data_only=True)

    # 1. Allotments by bucket, per district.
    totals = {}
    rows = book['App Revenue'].iter_rows(values_only=True)
    next(rows)
    for row in rows:
        code = str(row[0] or '').strip().zfill(5)
        revenue = str(row[3] or '').strip()
        amount = row[7] or 0
        if not code or not revenue or not amount:
            continue
        bucket = bucket_for(revenue)
        if bucket is None:
            continue
        totals.setdefault(code, {})
        totals[code][bucket] = totals[code].get(bucket, 0) + amount

    # 2. Split the 3100 line into salaries / benefits / MSOC / residual.
    pieces = {}
    rows = book['Basic Ed'].iter_rows(values_only=True)
    next(rows)
    for row in rows:
        code = str(row[COL_CODE] or '').strip().zfill(5)
        if not code:
            continue
        pieces[code] = {
            'salaries': row[COL_SALARIES] or 0,
            'benefits': row[COL_BENEFITS] or 0,
            'msoc': row[COL_MSOC] or 0,
        }
    book.close()

    districts = {}
    for code, buckets in totals.items():
        basic = buckets.pop('basicEducation', 0)
        part = pieces.get(code, {'salaries': 0, 'benefits': 0, 'msoc': 0})
        salaries = part['salaries']
        benefits = part['benefits']
        msoc = part['msoc']
        # Residual keeps the pieces summing to the 3100 total exactly.
        other_basic = basic - salaries - benefits - msoc
        entry = {
            'salaries': round(salaries),
            'benefits': round(benefits),
            'msoc': round(msoc),
            'otherBasicEducation': round(other_basic),
            'basicEducation': round(basic),
        }
        for name, _ in BUCKETS:
            entry[name] = round(buckets.get(name, 0))
        entry['otherState'] = round(buckets.get('otherState', 0))
        entry['total'] = round(
            basic + sum(buckets.get(n, 0) for n, _ in BUCKETS)
            + buckets.get('otherState', 0)
        )
        districts[code] = entry

    payload = {
        'schoolYear': '2024-25',
        'source': {
            'file': SOURCE_URL,
            'note': (
                "OSPI Apportionment Final Extract, 2024-25 - the data behind the "
                "1191 Apportionment Summary. State general-fund allotments only: "
                "federal codes and Transportation Vehicle Fund depreciation (4499) "
                "are excluded. Salaries (Z375), benefits (Z384) and general-education "
                "MSOC (Z390) come from the Basic Ed sheet; 'other basic education' is "
                "the rest of the 3100 apportionment line - CTE and skills centers, "
                "Running Start, Alternative Learning Experience, dropout reengagement "
                "and substitutes, net of deductible-revenue adjustments."
            ),
        },
        'districts': districts,
    }

    out = os.path.join(DATA, 'allocation.json')
    with open(out, 'w') as handle:
        json.dump(payload, handle, separators=(',', ':'))
        handle.write('\n')

    negatives = [c for c, d in districts.items() if d['otherBasicEducation'] < 0]
    print(f'Wrote allocation.json for {len(districts)} districts.')
    print(f'  districts with a negative basic-education residual: {len(negatives)}')
    if negatives:
        print(f'    {", ".join(sorted(negatives)[:12])}')


if __name__ == '__main__':
    main()
