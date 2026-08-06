# Builds src/data/levy.json: the inputs and results of Washington's Local
# Effort Assistance (LEA) formula for every district.
#
# Sources (both official OSPI, from the School Apportionment budget-prep page):
#   - 2026multiyearlacombined.xlsx - OSPI's own "Enrichment Levy Pre-Ballot
#     Approval" worksheet. Supplies assessed valuation, voter-approved levy
#     amounts, LEA enrollment, and the statutory LEA assumptions (threshold,
#     max rates) that the LevyCalc sheet uses.
#   - F-196 general fund revenue actuals - revenue code 3300 is "Local Effort
#     Assistance", i.e. the LEA dollars a district actually received.
#
# The formula (matches OSPI's LevyCalc sheet rows Q, R, T, V, X):
#   capacity per pupil = (AV * 1.50 / 1000) / enrollment
#   max LEA per pupil  = threshold - capacity per pupil
#   levy rate r        = levy / AV * 1000
#   max LEA            = max LEA per pupil * enrollment
#   payable LEA        = max LEA * min(r / 1.50, 1)
#
# Run: python3 scripts/build-levy-lea.py
import csv
import json
import os
import subprocess
import warnings

import openpyxl

warnings.filterwarnings('ignore')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'scripts', 'raw')
OUT = os.path.join(ROOT, 'src', 'data', 'levy.json')

WORKBOOK_URL = (
    'https://ospi.k12.wa.us/sites/default/files/2025-04/2026multiyearlacombined.xlsx'
)
WORKBOOK = os.path.join(RAW, '2026multiyearlacombined.xlsx')
# F-196 actuals already cached by fetch-data.mjs
REVENUES = os.path.join(RAW, 'gf-revenues-2425.csv')

CALENDAR_YEAR = 2026
LEA_THRESHOLD = 2223.80  # LevyCalc assumption C, CY2026 ($/pupil)
LEA_MAX_RATE = 1.50  # LevyCalc assumption D ($ per $1,000 AV)
MAX_LEVY_PER_PUPIL = 3851.24  # assumption A - OSPI-published CY2026 limit
MAX_LEVY_RATE = 2.50  # assumption B

# RCW 84.52.0531 sets a higher per-pupil levy limit for districts with 40,000+
# FTE students, and Seattle (17001) is the only one. OSPI's LevyCalc cell C17
# hardcodes exactly that split:
#   IF(A1="17001", ROUND(3896.8*(1+CPI)+500, 2), ROUND(3247.33*(1+CPI)+500, 2))
# with the CY2026 levy CPI of 3.2%, giving 4521.50 and 3851.24 respectively -
# both published by OSPI (app.leg.wa.gov's RCW 84.52.0531 page confirms the
# same two figures). An earlier version of this file used a 2.8% CPI
# assumption (4505.91 / 3838.26), which was wrong for CY2026.
# The two converge at a flat $5,035 in 2031, when the statute drops the split.
LARGE_DISTRICT_CODES = ['17001']
MAX_LEVY_PER_PUPIL_LARGE = 4521.50


def ensure_workbook():
    if not os.path.exists(WORKBOOK):
        os.makedirs(RAW, exist_ok=True)
        print('downloading OSPI levy/LEA workbook...')
        subprocess.run(['curl', '-sL', WORKBOOK_URL, '-o', WORKBOOK], check=True)
    return openpyxl.load_workbook(WORKBOOK, read_only=True, data_only=True)


def code(value):
    return str(value).strip().zfill(5)


def num(value):
    try:
        f = float(value)
        return f if f == f else 0.0  # filter NaN
    except (TypeError, ValueError):
        return 0.0


def main():
    wb = ensure_workbook()

    # --- Assessed valuation: Data sheet, "CY 2025 AV for CY 2026 Levy" ---
    data_ws = wb['Data']
    rows = list(data_ws.iter_rows(min_row=2, values_only=True))
    header = rows[0]
    av_col = None
    for i, cell in enumerate(header):
        if cell and f'for CY {CALENDAR_YEAR} Levy' in str(cell):
            av_col = i
            break
    if av_col is None:
        raise SystemExit(f'no AV column for CY {CALENDAR_YEAR}')
    av_by_code = {}
    for row in rows[1:]:
        if row[0] and str(row[0]).strip().isdigit():
            av_by_code[code(row[0])] = num(row[av_col])

    # --- Voter-approved levy for the same calendar year as the AV column ---
    va_ws = wb['Voter Approved']
    va_rows = list(va_ws.iter_rows(min_row=1, values_only=True))
    va_header = va_rows[0]
    year_cols = {
        str(cell): i
        for i, cell in enumerate(va_header)
        if cell and str(cell).strip().isdigit()
    }
    latest_levy_year = str(CALENDAR_YEAR)
    if latest_levy_year not in year_cols:
        raise SystemExit(f'no voter-approved levy column for {CALENDAR_YEAR}')
    levy_col = year_cols[latest_levy_year]
    levy_by_code = {}
    for row in va_rows[1:]:
        if row[0] and str(row[0]).strip().isdigit():
            levy_by_code[code(row[0])] = num(row[levy_col])

    # --- LEA enrollment: District AAFTE (total, net of high/non-high transfers) ---
    aafte_ws = wb['District AAFTE']
    enroll_by_code = {}
    for row in aafte_ws.iter_rows(min_row=7, values_only=True):
        if not row or not row[0] or not str(row[0]).strip().isdigit():
            continue
        total = num(row[9])  # col 10: Total SY 2024-25
        transfer_out = num(row[7])  # col 8
        transfer_in = num(row[8])  # col 9
        enroll_by_code[code(row[0])] = total - transfer_out + transfer_in

    # --- LEA actually received: F-196 revenue code 3300 ---
    actual_lea = {}
    if os.path.exists(REVENUES):
        with open(REVENUES, newline='', encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                if row.get('Revenue Code') == '3300' and row.get('Fund Code') == '1':
                    c = code(row['County District Code'])
                    actual_lea[c] = actual_lea.get(c, 0.0) + num(row['Amount'])
    else:
        print(f'  (no {os.path.basename(REVENUES)}; run npm run fetch-data first)')

    districts = {}
    for c, av in av_by_code.items():
        enrollment = enroll_by_code.get(c, 0.0)
        levy = levy_by_code.get(c, 0.0)
        if av <= 0 or enrollment <= 0:
            continue
        capacity_per_pupil = (av * LEA_MAX_RATE / 1000) / enrollment
        max_lea_per_pupil = LEA_THRESHOLD - capacity_per_pupil
        levy_rate = (levy / av * 1000) if av else 0.0
        eligible = max_lea_per_pupil > 0
        max_lea = max_lea_per_pupil * enrollment if eligible else 0.0
        effort = min(levy_rate / LEA_MAX_RATE, 1.0) if levy_rate > 0 else 0.0
        payable = max_lea * effort
        districts[c] = {
            'av': round(av),
            'enrollment': round(enrollment, 2),
            'levy': round(levy),
            'levyRate': round(levy_rate, 4),
            'capacityPerPupil': round(capacity_per_pupil, 2),
            'maxLeaPerPupil': round(max_lea_per_pupil, 2),
            'maxLea': round(max_lea),
            'payableLea': round(payable),
            'eligible': eligible,
            'actualLea': round(actual_lea.get(c, 0.0)),
        }

    out = {
        'calendarYear': CALENDAR_YEAR,
        'levyYear': int(latest_levy_year),
        'assumptions': {
            'leaThresholdPerPupil': LEA_THRESHOLD,
            'leaMaxRate': LEA_MAX_RATE,
            'maxLevyPerPupil': MAX_LEVY_PER_PUPIL,
            'maxLevyPerPupilLarge': MAX_LEVY_PER_PUPIL_LARGE,
            'largeDistrictCodes': LARGE_DISTRICT_CODES,
            'maxLevyRate': MAX_LEVY_RATE,
        },
        'sources': {
            'workbook': WORKBOOK_URL,
            'note': (
                "OSPI Enrichment Levy Pre-Ballot Approval worksheet (LevyCalc "
                "rows Q, R, T, V, X). 'actualLea' is F-196 revenue code 3300, "
                'Local Effort Assistance, school year 2024-25.'
            ),
        },
        'districts': districts,
    }

    with open(OUT, 'w') as f:
        json.dump(out, f)

    eligible_count = sum(1 for d in districts.values() if d['eligible'])
    print(
        f'wrote {len(districts)} districts ({eligible_count} LEA-eligible) '
        f'-> {os.path.relpath(OUT, ROOT)}'
    )
    sample = districts.get('14005')
    if sample:
        print('Aberdeen check (expect capacity 1416.29, maxLea/pupil 807.51, payable 2,406,000):')
        print('  ', {k: sample[k] for k in ('capacityPerPupil', 'maxLeaPerPupil', 'levyRate', 'payableLea', 'actualLea')})


if __name__ == '__main__':
    main()
