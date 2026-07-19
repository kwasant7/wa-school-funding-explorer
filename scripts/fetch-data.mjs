/**
 * Builds bundled district data from public OSPI sources, one entry per school
 * year from 2019-20 onward:
 *  - Enrollment + demographics: OSPI Report Card Enrollment (data.wa.gov, one
 *    dataset per school year)
 *  - General Fund revenues: OSPI F-196 actuals CSVs (SAFS data files)
 *
 * Outputs:
 *  - src/data/districts.json  — latest year only (homepage + simulator)
 *  - src/data/history.json    — every year (district explorer + trends)
 *
 * Run: npm run fetch-data
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, 'raw');
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

// One Report Card Enrollment dataset per year on data.wa.gov; F-196 CSVs from
// ospi.k12.wa.us/safs-data-files (2019-20 through 2021-22 share one file).
const OSPI = 'https://ospi.k12.wa.us/sites/default/files';
const REVENUE_FILES = {
  'gf-revenues-1922.csv': `${OSPI}/2023-08/actualsgeneralfundrevenues.csv`,
  'gf-revenues-2223.csv': `${OSPI}/2023-12/actualsgeneralfundrevenues-safs3dw_actualsgeneralfundrevenues.csv`,
  'gf-revenues-2324.csv': `${OSPI}/2024-12/actualsgeneralfundrevenues2023-24.csv`,
  'gf-revenues-2425.csv': `${OSPI}/2025-12/24-25-actuals-general-fund-revenues.csv`,
};

const YEARS = [
  { label: '2019-20', enrollmentId: 'gtd3-scga', revenueFile: 'gf-revenues-1922.csv', revenueYear: '2019-2020' },
  { label: '2020-21', enrollmentId: 'nvpc-yr7b', revenueFile: 'gf-revenues-1922.csv', revenueYear: '2020-2021' },
  { label: '2021-22', enrollmentId: 'ymi4-syjv', revenueFile: 'gf-revenues-1922.csv', revenueYear: '2021-2022' },
  { label: '2022-23', enrollmentId: 'dij7-mbxg', revenueFile: 'gf-revenues-2223.csv', revenueYear: '2022-2023' },
  { label: '2023-24', enrollmentId: 'q4ba-s3jc', revenueFile: 'gf-revenues-2324.csv', revenueYear: '2023-2024' },
  { label: '2024-25', enrollmentId: '2rwv-gs2e', revenueFile: 'gf-revenues-2425.csv', revenueYear: '2024-2025' },
];

// F-196 general fund revenue rollup codes
const ROLLUP_CODES = {
  1000: 'localTaxes',
  2000: 'localNonTax',
  3000: 'stateGeneral',
  4000: 'stateSpecial',
  5000: 'federalGeneral',
  6000: 'federalSpecial',
  7000: 'otherDistricts',
  8000: 'otherAgencies',
  9000: 'otherFinancing',
};

async function ensureFile(name, url) {
  const file = path.join(RAW_DIR, name);
  try {
    await access(file);
  } catch {
    console.log(`Downloading ${name}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  return readFile(file, 'utf8');
}

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i]));
    return row;
  });
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** revenueFile name -> Map(yearCode -> Map(districtCode -> rollups)) */
const revenueCache = new Map();

async function revenuesForYear(revenueFile, revenueYear) {
  if (!revenueCache.has(revenueFile)) {
    const rows = parseCsv(await ensureFile(revenueFile, REVENUE_FILES[revenueFile]));
    const byYear = new Map();
    for (const row of rows) {
      const key = ROLLUP_CODES[row['Revenue Code']];
      if (!key) continue;
      const year = row['School Year Code'];
      const code = String(row['County District Code']).padStart(5, '0');
      if (!byYear.has(year)) byYear.set(year, new Map());
      const districts = byYear.get(year);
      if (!districts.has(code)) districts.set(code, {});
      districts.get(code)[key] = (districts.get(code)[key] || 0) + num(row['Amount']);
    }
    revenueCache.set(revenueFile, byYear);
  }
  return revenueCache.get(revenueFile).get(revenueYear) ?? new Map();
}

async function buildYear({ label, enrollmentId, revenueFile, revenueYear }) {
  const url = `https://data.wa.gov/resource/${enrollmentId}.json?$limit=2000&organizationlevel=District&gradelevel=All%20Grades`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Enrollment fetch failed for ${label}: ${res.status}`);
  const enrollRows = await res.json();
  const revenues = await revenuesForYear(revenueFile, revenueYear);

  const districts = [];
  let missingFinance = 0;
  for (const row of enrollRows) {
    const code = String(row.districtcode).padStart(5, '0');
    const enrollment = num(row.all_students);
    if (enrollment === 0) continue;
    const rev = revenues.get(code);
    if (!rev) {
      missingFinance++;
      continue;
    }
    const local = (rev.localTaxes || 0) + (rev.localNonTax || 0);
    const state = (rev.stateGeneral || 0) + (rev.stateSpecial || 0);
    const federal = (rev.federalGeneral || 0) + (rev.federalSpecial || 0);
    const other = (rev.otherDistricts || 0) + (rev.otherAgencies || 0);
    const total = local + state + federal + other;
    if (total === 0) {
      missingFinance++;
      continue;
    }
    districts.push({
      code,
      name: row.districtname,
      county: row.county,
      esd: (row.esdname || '').replace('Educational Service District', 'ESD').trim(),
      enrollment,
      demo: {
        lowIncome: num(row.low_income),
        ell: num(row.english_language_learners),
        sped: num(row.students_with_disabilities),
        homeless: num(row.homeless),
        migrant: num(row.migrant),
        highlyCapable: num(row.highly_capable),
      },
      rev: {
        local: Math.round(local),
        state: Math.round(state),
        federal: Math.round(federal),
        other: Math.round(other),
        total: Math.round(total),
      },
      perPupil: Math.round(total / enrollment),
    });
  }

  districts.sort((a, b) => a.name.localeCompare(b.name));

  const totals = districts.reduce(
    (acc, d) => {
      acc.enrollment += d.enrollment;
      acc.local += d.rev.local;
      acc.state += d.rev.state;
      acc.federal += d.rev.federal;
      acc.other += d.rev.other;
      acc.total += d.rev.total;
      return acc;
    },
    { enrollment: 0, local: 0, state: 0, federal: 0, other: 0, total: 0 }
  );

  const perPupils = districts.map((d) => d.perPupil).sort((a, b) => a - b);
  const statewide = {
    districts: districts.length,
    enrollment: totals.enrollment,
    revenues: totals,
    avgPerPupil: Math.round(totals.total / totals.enrollment),
    medianPerPupil: perPupils[Math.floor(perPupils.length / 2)],
    minPerPupil: perPupils[0],
    maxPerPupil: perPupils[perPupils.length - 1],
  };

  console.log(
    `${label}: ${districts.length} districts, ${statewide.enrollment.toLocaleString()} students, $${(totals.total / 1e9).toFixed(1)}B, $${statewide.avgPerPupil.toLocaleString()}/pupil (${missingFinance} enrollment rows without F-196 match)`
  );
  return { schoolYear: label, statewide, districts };
}

async function main() {
  const byYear = {};
  for (const year of YEARS) {
    byYear[year.label] = await buildYear(year);
  }

  const latest = YEARS[YEARS.length - 1].label;
  const sources = {
    enrollment:
      'OSPI Report Card Enrollment by school year (data.wa.gov), district totals, all grades',
    finance:
      'OSPI F-196 General Fund revenue actuals by school year (ospi.k12.wa.us/safs-data-files)',
    generated: new Date().toISOString().slice(0, 10),
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    path.join(DATA_DIR, 'districts.json'),
    JSON.stringify({ ...byYear[latest], sources })
  );
  await writeFile(
    path.join(DATA_DIR, 'history.json'),
    JSON.stringify({ years: YEARS.map((y) => y.label), latest, sources, byYear })
  );
  console.log(`Wrote districts.json (${latest}) and history.json (${YEARS.length} years)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
