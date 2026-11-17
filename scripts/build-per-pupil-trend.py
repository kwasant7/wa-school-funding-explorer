"""Builds src/data/per-pupil-trend.json: revenue per student for every district
in every school year on the site, plus the statewide median for each year.

Why this exists: the one-page PDF brief draws a six-year per-student revenue
trend. The numbers already sit in history.json, but that file is a megabyte
(every district, every year, every field) and the PDF generator loads in the
browser when someone opens a brief. Importing history.json there would ship a
megabyte to draw six bars, so this keeps only the two series the chart needs -
the same reason enrollment-baseline.json exists beside it.

A district missing from a year (a charter that opened later, say) gets null for
that year, and the chart leaves the bar out rather than drawing a zero.

Run: python3 scripts/build-per-pupil-trend.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'src', 'data')


def main():
    with open(os.path.join(DATA, 'history.json'), encoding='utf-8') as f:
        history = json.load(f)

    years = history['years']
    median = []
    districts = {}
    for index, year in enumerate(years):
        entry = history['byYear'][year]
        median.append(entry['statewide']['medianPerPupil'])
        for record in entry['districts']:
            series = districts.setdefault(record['code'], [None] * len(years))
            series[index] = record['perPupil']

    out = {'years': years, 'median': median, 'districts': districts}
    with open(os.path.join(DATA, 'per-pupil-trend.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
        f.write('\n')
    print(f'wrote {len(districts)} districts x {len(years)} years -> src/data/per-pupil-trend.json')


if __name__ == '__main__':
    main()
