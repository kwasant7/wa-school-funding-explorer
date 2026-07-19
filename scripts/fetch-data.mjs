/**
 * Builds src/data/districts.json from public OSPI data:
 *  - Enrollment + demographics: OSPI Report Card Enrollment 2024-25 (data.wa.gov 2rwv-gs2e)
 *  - General Fund revenues: OSPI F-196 actuals 2024-25 (SAFS data files CSV)
 *
 * Run: npm run fetch-data
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, 'raw');
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'districts.json');

const ENROLLMENT_URL =
  'https://data.wa.gov/resource/2rwv-gs2e.json?$limit=2000&organizationlevel=District&gradelevel=All%20Grades';
const REVENUES_URL =
  'https://ospi.k12.wa.us/sites/default/files/2025-12/24-25-actuals-general-fund-revenues.csv';
const REVENUES_FILE = path.join(RAW_DIR, 'gf-revenues-2425.csv');

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

async function ensureRevenuesCsv() {
  try {
    await access(REVENUES_FILE);
  } catch {
    console.log('Downloading F-196 revenues CSV...');
    const res = await fetch(REVENUES_URL);
    if (!res.ok) throw new Error(`Failed to download revenues CSV: ${res.status}`);
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(REVENUES_FILE, Buffer.from(await res.arrayBuffer()));
  }
  return readFile(REVENUES_FILE, 'utf8');
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

async function main() {
  console.log('Fetching enrollment from data.wa.gov...');
  const enrollRes = await fetch(ENROLLMENT_URL);
  if (!enrollRes.ok) throw new Error(`Enrollment fetch failed: ${enrollRes.status}`);
  const enrollRows = await enrollRes.json();
  console.log(`  ${enrollRows.length} district enrollment rows`);

  const revText = await ensureRevenuesCsv();
  const revRows = parseCsv(revText);
  console.log(`  ${revRows.length} revenue rows`);

  // District code -> { localTaxes: $, ... } using rollup codes only (fund 1 = general fund)
  const revenues = new Map();
  for (const row of revRows) {
    const code = String(row['County District Code']).padStart(5, '0');
    const revCode = row['Revenue Code'];
    const key = ROLLUP_CODES[revCode];
    if (!key) continue;
    if (!revenues.has(code)) revenues.set(code, {});
    revenues.get(code)[key] = (revenues.get(code)[key] || 0) + num(row['Amount']);
  }
  console.log(`  ${revenues.size} districts with revenue rollups`);

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

  const out = {
    schoolYear: '2024-25',
    sources: {
      enrollment:
        'OSPI Report Card Enrollment 2024-25 (data.wa.gov/resource/2rwv-gs2e), district totals, all grades',
      finance:
        'OSPI F-196 General Fund revenue actuals 2024-25 (ospi.k12.wa.us/safs-data-files)',
      generated: new Date().toISOString().slice(0, 10),
    },
    statewide,
    districts,
  };

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(out));
  console.log(
    `Wrote ${districts.length} districts (${missingFinance} enrollment rows had no F-196 match) -> ${path.relative(process.cwd(), OUT_FILE)}`
  );
  console.log(
    `Statewide: ${statewide.enrollment.toLocaleString()} students, $${(statewide.revenues.total / 1e9).toFixed(1)}B total, $${statewide.avgPerPupil.toLocaleString()}/pupil avg`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
