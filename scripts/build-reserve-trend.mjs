/**
 * Emits src/data/reserve-ratio-trend.json: each district's reserve ratio (fund
 * balance / spending, percent) for every year on the site, shaped like
 * per-pupil-trend.json so the brief can draw a six-year reserve chart without
 * importing the ~1MB history.json into the download bundle.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const history = JSON.parse(readFileSync(join(root, 'src/data/history.json'), 'utf8'));

const years = history.years;
const byYear = history.byYear;

const districts = {};
for (const year of years) {
  let rows = byYear[year];
  if (!Array.isArray(rows)) rows = rows.districts ?? Object.values(rows);
  for (const d of rows) {
    if (!d || !d.code) continue;
    (districts[d.code] ??= Array(years.length).fill(null))[years.indexOf(year)] =
      d.reserveRatio == null ? null : Math.round(d.reserveRatio * 10) / 10;
  }
}

const out = { years, districts };
writeFileSync(join(root, 'src/data/reserve-ratio-trend.json'), JSON.stringify(out));
console.log(
  `reserve-ratio-trend.json: ${Object.keys(districts).length} districts, ${years.length} years`
);
