"""Builds src/data/big3.json: the numbers behind AESD's "Big 3" dashboard for
2024-25, for every district, so the District Explorer's Big 3 card shows the
same figures the dashboard does.

Source: the Association of Educational Service Districts (AESD) Big 3
dashboard, a public Power BI report built from OSPI's F-196 actuals and
apportionment data. This script asks the report's own public query endpoint for
the same measures its tables print (the dashboard's "Funding (Revenue)" and
"Costs (Expenditures)" for each program, and the student count under its per
pupil amounts), once per district.
  https://app.powerbi.com/view?r=eyJrIjoiMzNiMGJlMjUtMTcwNC00YWMwLTg0ODktYTU5Zjg3NGJmOWJmIiwidCI6ImE5ZWIyNzExLTg0M2YtNDhjMC04M2NkLWM0M2FjNjAwOTgzMSJ9

How AESD defines the three programs (worked out by matching the dashboard to
the F-196 files to the cent for Lake Washington, Bellevue and Tacoma):
  Special education - expenditures: F-196 programs 21 and 24 (state plus the
                        federal IDEA supplemental program). Revenue: every
                        general-fund revenue code ending in 21 or 24 - state
                        special education (3121, 4121), federal IDEA (6124),
                        Medicaid reimbursements (6321), other state agencies
                        (4321) and payments from other school districts (7121).
  Transportation    - expenditures: F-196 program 99. Revenue: every revenue
                        code ending in 99 - state operations (4199), other state
                        agencies (4399) and payments from other school
                        districts (7199).
  MSOC              - Materials, Supplies, and Operating Costs, on the same
                        definition as build-program-spending.mjs's "MSOC (Big 3)"
                        expenditures; revenue includes an amount for alternative
                        learning students that AESD sources separately.
  Students          - "Total K-12 Basic + ALE (Not RS, Not DOR)": K-12 basic
                        education plus alternative learning experience (ALE)
                        students, excluding Running Start and dropout
                        reengagement. AESD divides every gap by this count.
A blank revenue or cost is a program the district does not run (or books
nothing to), and AESD's totals read it as zero, so this file stores zero.

Cluster, report key and ids are the dashboard's own; they are read from the
published report where possible, but the cluster host is fixed below and would
need updating if AESD moves the report.

Run: python3 scripts/fetch-big3.py
"""
import gzip
import json
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'data', 'big3.json')

# The "r" token in the dashboard's public link decodes to this resource key.
KEY = '33b0be25-1704-4ac0-8489-a59f874bf9bf'
BASE = 'https://wabi-us-west2-api.analysis.windows.net/public/reports'
FISCAL_YEAR = '2024-2025'  # the dashboard's label for school year 2024-25
SCHOOL_YEAR = '2024-25'    # what the site calls it

STUDENTS = 'Total K-12 Basic + ALE (Not RS, Not DOR)'
PROGRAMS = {
    'sped': ('Master SPED', '01 SPED Revenue', '02 SPED Expenditure'),
    'transportation': (
        'Master Transportation', '01 Transportation Revenue', '02 Transportation Expenditure'),
    'msoc': ('Master MSOC', '01 MSOC Revenue', '02 MSOC Expenditure'),
}


def request(url, body=None):
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            'X-PowerBI-ResourceKey': KEY,
            'Content-Type': 'application/json;charset=UTF-8',
            'Accept-Encoding': 'gzip',
        })
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
    if raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    return json.loads(raw)


def discover_ids():
    meta = request(f'{BASE}/{KEY}/modelsAndExploration?preferReadOnlySession=true')
    model = meta['models'][0]
    return model['id'], model['dbName'], meta['exploration']['reportId']


def query_body(entity, columns, measures, ids):
    model_id, dataset_id, report_id = ids
    select = [
        {'Column': {'Expression': {'SourceRef': {'Source': 't'}}, 'Property': c}, 'Name': f't.{c}'}
        for c in columns
    ] + [
        {'Measure': {'Expression': {'SourceRef': {'Source': 't'}}, 'Property': m}, 'Name': f't.{m}'}
        for m in measures
    ]
    return {
        'version': '1.0.0',
        'queries': [{
            'Query': {'Commands': [{'SemanticQueryDataShapeCommand': {
                'Query': {'Version': 2, 'From': [{'Name': 't', 'Entity': entity, 'Type': 0}],
                          'Select': select},
                'Binding': {
                    'Primary': {'Groupings': [{'Projections': list(range(len(select)))}]},
                    'DataReduction': {'DataVolume': 4, 'Primary': {'Window': {'Count': 30000}}},
                    'Version': 1},
            }}]},
            'QueryId': '',
            'ApplicationContext': {'DatasetId': dataset_id, 'Sources': [{'ReportId': report_id}]},
        }],
        'cancelQueries': [],
        'modelId': model_id,
    }


def decode(resp, ncols):
    """Power BI returns a compressed row format: each row lists only the values
    that changed (bitmask R repeats the previous row's value, bitmask O-slash is
    null), and strings may point into a shared dictionary."""
    ds = resp['results'][0]['result']['data']['dsr']['DS'][0]
    dicts = ds.get('ValueDicts', {})
    rows, prev, schema = [], [None] * ncols, None
    for r in ds['PH'][0]['DM0']:
        schema = r.get('S', schema)
        values, repeat, null, i = r.get('C', []), r.get('R', 0), r.get('Ø', 0), 0
        row = []
        for col in range(ncols):
            bit = 1 << col
            if repeat & bit:
                v = prev[col]
            elif null & bit:
                v = None
            else:
                v = values[i]
                i += 1
                name = schema[col].get('DN') if schema else None
                if name is not None and isinstance(v, int) and not isinstance(v, bool):
                    v = dicts[name][v]
            row.append(v)
        prev = row
        rows.append(row)
    return rows


def pull(entity, columns, measures, ids):
    resp = request(f'{BASE}/querydata?synchronous=true',
                   query_body(entity, columns, measures, ids))
    return decode(resp, len(columns) + len(measures))


def num(v):
    return round(float(v), 2) if v not in (None, '') else 0.0


def main():
    ids = discover_ids()
    districts = {}
    for key, (entity, rev_measure, cost_measure) in PROGRAMS.items():
        rows = pull(entity, ['CCDDD', 'Fiscal Year', STUDENTS], [rev_measure, cost_measure], ids)
        n = 0
        for code, year, students, revenue, cost in rows:
            if year != FISCAL_YEAR:
                continue
            n += 1
            d = districts.setdefault(str(code), {})
            d[key] = {'revenue': num(revenue), 'cost': num(cost)}
            # AESD's student count is the same on all three tables.
            if 'students' in d and abs(d['students'] - num(students)) > 0.005:
                raise SystemExit(f'Student count differs across tables for {code}')
            d['students'] = num(students)
        print(f'{entity}: {n} districts for {FISCAL_YEAR}')

    # A district with nothing in a program (no buses, say) comes back with no
    # row for that table at all, which AESD's totals read as zero.
    for d in districts.values():
        for k in PROGRAMS:
            d.setdefault(k, {'revenue': 0.0, 'cost': 0.0})
    districts = dict(sorted(districts.items()))
    payload = {
        'schoolYear': SCHOOL_YEAR,
        'source': "AESD Big 3 dashboard (Power BI), built from OSPI F-196 actuals and apportionment",
        'districts': districts,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(payload, f, separators=(',', ':'))
        f.write('\n')
    print(f'Wrote {len(districts)} districts to {os.path.relpath(OUT, HERE)}')


if __name__ == '__main__':
    main()
