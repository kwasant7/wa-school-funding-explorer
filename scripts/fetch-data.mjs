/**
 * Builds bundled district data from public OSPI sources, one entry per school
 * year from 2019-20 onward:
 *  - Enrollment + demographics: OSPI Report Card Enrollment (data.wa.gov, one
 *    dataset per school year) for the displayed October headcount
 *  - Funding enrollment: OSPI Final Enrollment Summary (P-223 annual-average
 *    K-12 FTE plus Running Start college FTE)
 *  - General Fund revenues: OSPI F-196 actuals CSVs (SAFS data files)
 *
 * Outputs:
 *  - src/data/districts.json  - latest year only (homepage + simulator)
 *  - src/data/history.json    - every year (district explorer + trends)
 *
 * Run: npm run fetch-data
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, 'raw');
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

// One Report Card Enrollment dataset per year on data.wa.gov; F-196 CSVs from
// ospi.k12.wa.us/safs-data-files (2019-20 through 2021-22 share one file).
const OSPI = 'https://ospi.k12.wa.us/sites/default/files';
const FUNDING_ENROLLMENT_FILE = 'historical-enrollment-summary-2001-02.xlsx';
const FUNDING_ENROLLMENT_URL =
  `${OSPI}/2024-11/historical-enrollment-summary-2001-02.xlsx`;
const REVENUE_FILES = {
  'gf-revenues-1922.csv': `${OSPI}/2023-08/actualsgeneralfundrevenues.csv`,
  'gf-revenues-2223.csv': `${OSPI}/2023-12/actualsgeneralfundrevenues-safs3dw_actualsgeneralfundrevenues.csv`,
  'gf-revenues-2324.csv': `${OSPI}/2024-12/actualsgeneralfundrevenues2023-24.csv`,
  'gf-revenues-2425.csv': `${OSPI}/2025-12/24-25-actuals-general-fund-revenues.csv`,
};
// F-196 general fund EXPENDITURES (sum of all amounts = total expenditures).
// The 2019-2022 combined file is an OSPI F-196 export mirrored to the repo's
// scripts/raw (OSPI's SAFS page rotates its exact URL); the rest are live.
const EXPENDITURE_FILES = {
  'gf-exp-1922.csv': `${OSPI}/2023-08/actualsgeneralfundexpenditures.csv`,
  'gf-exp-2223.csv': `${OSPI}/2023-12/actualsgeneralfundexpenditures-safs3dw_actualsgeneralfundexpenditures.csv`,
  'gf-exp-2324.csv': `${OSPI}/2024-12/actualsgeneralfundexpenditures2023-24.csv`,
  'gf-exp-2425.csv': `${OSPI}/2025-12/24-25-actuals-general-fund-expenditures.csv`,
};

const YEARS = [
  { label: '2019-20', enrollmentId: 'gtd3-scga', revenueFile: 'gf-revenues-1922.csv', expenditureFile: 'gf-exp-1922.csv', revenueYear: '2019-2020', fundingSheet: 6 },
  { label: '2020-21', enrollmentId: 'nvpc-yr7b', revenueFile: 'gf-revenues-1922.csv', expenditureFile: 'gf-exp-1922.csv', revenueYear: '2020-2021', fundingSheet: 5 },
  { label: '2021-22', enrollmentId: 'ymi4-syjv', revenueFile: 'gf-revenues-1922.csv', expenditureFile: 'gf-exp-1922.csv', revenueYear: '2021-2022', fundingSheet: 4 },
  { label: '2022-23', enrollmentId: 'dij7-mbxg', revenueFile: 'gf-revenues-2223.csv', expenditureFile: 'gf-exp-2223.csv', revenueYear: '2022-2023', fundingSheet: 3 },
  { label: '2023-24', enrollmentId: 'q4ba-s3jc', revenueFile: 'gf-revenues-2324.csv', expenditureFile: 'gf-exp-2324.csv', revenueYear: '2023-2024', fundingSheet: 2 },
  { label: '2024-25', enrollmentId: '2rwv-gs2e', revenueFile: 'gf-revenues-2425.csv', expenditureFile: 'gf-exp-2425.csv', revenueYear: '2024-2025', fundingSheet: 1 },
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

async function ensureBuffer(name, url) {
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
  return readFile(file);
}

/**
 * Reads one file from an XLSX/ZIP archive using only Node built-ins. XLSX
 * central-directory entries point to each compressed XML member.
 */
function zipEntry(archive, wantedName) {
  for (let offset = 0; offset <= archive.length - 46; ) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) {
      offset++;
      continue;
    }
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name === wantedName) {
      if (archive.readUInt32LE(localOffset) !== 0x04034b50) {
        throw new Error(`Invalid XLSX local header for ${wantedName}`);
      }
      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = archive.subarray(start, start + compressedSize);
      if (method === 0) return compressed.toString('utf8');
      if (method === 8) return inflateRawSync(compressed).toString('utf8');
      throw new Error(`Unsupported XLSX compression method ${method}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`Missing XLSX entry: ${wantedName}`);
}

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function columnNumber(ref) {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? '';
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
}

function parseFundingSheet(sheetXml, sharedStrings, runningStartStart) {
  const result = new Map();
  for (const rowMatch of sheetXml.matchAll(/<row\s+[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = new Map();
    for (const cellMatch of rowMatch[1].matchAll(/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1];
      const ref = attrs.match(/\br="([^"]+)"/)?.[1];
      if (!ref) continue;
      const body = cellMatch[2] ?? '';
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (raw === undefined) continue;
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      cells.set(columnNumber(ref), type === 's' ? sharedStrings[Number(raw)] : Number(raw));
    }
    const code = String(cells.get(1) ?? '').padStart(5, '0');
    if (!/^\d{5}$/.test(code) || code === '00000') continue;

    // C:O is OSPI's final annual-average K-12 FTE (including ALE).
    // Running Start at college and Open Doors are reported separately, two
    // pairs of columns starting at runningStartStart: RS (Non-Voc, Voc) then
    // Open Doors (Non-Voc, Voc). Positions shift by year layout: RS at AI:AJ
    // (35-36) from 2021-22 on, AB:AC (28-29) in 2019-20/2020-21.
    const sumColumns = (start, end) => {
      let total = 0;
      for (let column = start; column <= end; column++) {
        total += num(cells.get(column));
      }
      return total;
    };
    const k3 = sumColumns(3, 6);
    const grades46 = sumColumns(7, 9);
    const elementary = k3 + grades46;
    const middle = sumColumns(10, 11);
    const high = sumColumns(12, 15);
    const runningStart =
      num(cells.get(runningStartStart)) +
      num(cells.get(runningStartStart + 1));
    const openDoors =
      num(cells.get(runningStartStart + 2)) +
      num(cells.get(runningStartStart + 3));
    // Matches OSPI Apportionment AAFTE (fiscal.wa.gov): basic-ed K-12 + Running
    // Start + Open Doors. Excludes pre-K special ed, skills centers, institutions.
    const total = elementary + middle + high + runningStart + openDoors;
    if (total > 0) {
      result.set(code, {
        total,
        elementary,
        k3,
        grades46,
        middle,
        high,
        runningStart,
        openDoors,
      });
    }
  }
  return result;
}

let fundingEnrollmentCache;
async function fundingEnrollmentBySheet() {
  if (fundingEnrollmentCache) return fundingEnrollmentCache;
  const archive = await ensureBuffer(FUNDING_ENROLLMENT_FILE, FUNDING_ENROLLMENT_URL);
  const sharedXml = zipEntry(archive, 'xl/sharedStrings.xml');
  const sharedStrings = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => decodeXml(textMatch[1]))
      .join('')
  );
  fundingEnrollmentCache = new Map();
  for (const { fundingSheet } of YEARS) {
    const sheetXml = zipEntry(archive, `xl/worksheets/sheet${fundingSheet}.xml`);
    fundingEnrollmentCache.set(
      fundingSheet,
      parseFundingSheet(sheetXml, sharedStrings, fundingSheet <= 4 ? 35 : 28)
    );
  }
  return fundingEnrollmentCache;
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

/**
 * Ending total fund balance by year label -> district code. Generated from
 * fiscal.wa.gov's WSFCurrent.xlsm by scripts/build-fund-balance.py (run that
 * first; output cached at scripts/raw/fund-balance.json).
 */
let fundBalanceData = {};
async function loadFundBalance() {
  try {
    fundBalanceData = JSON.parse(
      await readFile(path.join(RAW_DIR, 'fund-balance.json'), 'utf8')
    );
  } catch {
    console.warn('  (no fund-balance.json - run scripts/build-fund-balance.py; fund balance will be null)');
    fundBalanceData = {};
  }
}

/** expenditureFile -> Map(yearCode -> Map(districtCode -> totalExpenditures)) */
const expenditureCache = new Map();

async function expendituresForYear(expenditureFile, revenueYear) {
  if (!expenditureCache.has(expenditureFile)) {
    const rows = parseCsv(await ensureFile(expenditureFile, EXPENDITURE_FILES[expenditureFile]));
    const byYear = new Map();
    for (const row of rows) {
      if (row['Fund Code'] !== '1') continue; // general fund only
      const year = row['School Year Code'];
      const code = String(row['County District Code']).padStart(5, '0');
      if (!byYear.has(year)) byYear.set(year, new Map());
      const districts = byYear.get(year);
      districts.set(code, (districts.get(code) || 0) + num(row['Amount']));
    }
    expenditureCache.set(expenditureFile, byYear);
  }
  return expenditureCache.get(expenditureFile).get(revenueYear) ?? new Map();
}

async function buildYear({ label, enrollmentId, revenueFile, expenditureFile, revenueYear, fundingSheet }) {
  const url = `https://data.wa.gov/resource/${enrollmentId}.json?$limit=2000&organizationlevel=District&gradelevel=All%20Grades`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Enrollment fetch failed for ${label}: ${res.status}`);
  const enrollRows = await res.json();
  const revenues = await revenuesForYear(revenueFile, revenueYear);
  const expenditures = await expendituresForYear(expenditureFile, revenueYear);
  const fundingEnrollment =
    (await fundingEnrollmentBySheet()).get(fundingSheet) ?? new Map();

  const districts = [];
  let missingFinance = 0;
  let missingFundingEnrollment = 0;
  for (const row of enrollRows) {
    const code = String(row.districtcode).padStart(5, '0');
    const enrollment = num(row.all_students);
    if (enrollment === 0) continue;
    const rev = revenues.get(code);
    if (!rev) {
      missingFinance++;
      continue;
    }
    const districtFunding = fundingEnrollment.get(code);
    if (!districtFunding) {
      missingFundingEnrollment++;
      continue;
    }
    const roundedFundingEnrollment =
      Math.round(districtFunding.total * 100) / 100;
    const roundFte = (value) => Math.round(value * 100) / 100;
    const local = (rev.localTaxes || 0) + (rev.localNonTax || 0);
    const state = (rev.stateGeneral || 0) + (rev.stateSpecial || 0);
    const federal = (rev.federalGeneral || 0) + (rev.federalSpecial || 0);
    const other =
      (rev.otherDistricts || 0) +
      (rev.otherAgencies || 0) +
      (rev.otherFinancing || 0);
    const total = local + state + federal + other;
    if (total === 0) {
      missingFinance++;
      continue;
    }
    const roundedLocal = Math.round(local);
    const roundedState = Math.round(state);
    const roundedFederal = Math.round(federal);
    const roundedOther = Math.round(other);
    const roundedTotal =
      roundedLocal + roundedState + roundedFederal + roundedOther;
    const roundedExp = Math.round(expenditures.get(code) || 0);
    const fundBalance = fundBalanceData[label]?.[code] ?? null;
    districts.push({
      code,
      name: row.districtname,
      county: row.county,
      esd: (row.esdname || '').replace('Educational Service District', 'ESD').trim(),
      enrollment,
      fundingEnrollment: roundedFundingEnrollment,
      fundingFte: {
        elementary: roundFte(districtFunding.elementary),
        k3: roundFte(districtFunding.k3),
        grades46: roundFte(districtFunding.grades46),
        middle: roundFte(districtFunding.middle),
        high: roundFte(districtFunding.high),
        runningStart: roundFte(districtFunding.runningStart),
        openDoors: roundFte(districtFunding.openDoors),
      },
      demo: {
        lowIncome: num(row.low_income),
        ell: num(row.english_language_learners),
        sped: num(row.students_with_disabilities),
        homeless: num(row.homeless),
        migrant: num(row.migrant),
        highlyCapable: num(row.highly_capable),
      },
      rev: {
        local: roundedLocal,
        state: roundedState,
        federal: roundedFederal,
        other: roundedOther,
        total: roundedTotal,
      },
      exp: roundedExp,
      // Change in fund balance for the year: positive = added to reserves,
      // negative = drew down reserves ("dipped into savings").
      surplus: roundedTotal - roundedExp,
      // Ending total fund balance (savings carried forward) and the reserve
      // ratio (savings ÷ annual spending) from fiscal.wa.gov's WSF workbook.
      fundBalance,
      reserveRatio:
        fundBalance != null && roundedExp > 0
          ? Math.round((fundBalance / roundedExp) * 1000) / 10
          : null,
      perPupil: Math.round(roundedTotal / roundedFundingEnrollment),
    });
  }

  districts.sort((a, b) => a.name.localeCompare(b.name));

  const totals = districts.reduce(
    (acc, d) => {
      acc.enrollment += d.enrollment;
      acc.fundingEnrollment += d.fundingEnrollment;
      acc.local += d.rev.local;
      acc.state += d.rev.state;
      acc.federal += d.rev.federal;
      acc.other += d.rev.other;
      acc.total += d.rev.total;
      acc.expenditures += d.exp;
      return acc;
    },
    { enrollment: 0, fundingEnrollment: 0, local: 0, state: 0, federal: 0, other: 0, total: 0, expenditures: 0 }
  );

  const perPupils = districts.map((d) => d.perPupil).sort((a, b) => a - b);
  const statewide = {
    districts: districts.length,
    enrollment: totals.enrollment,
    fundingEnrollment: Math.round(totals.fundingEnrollment * 100) / 100,
    revenues: totals,
    expenditures: totals.expenditures,
    surplus: totals.total - totals.expenditures,
    avgPerPupil: Math.round(totals.total / totals.fundingEnrollment),
    medianPerPupil: perPupils[Math.floor(perPupils.length / 2)],
    minPerPupil: perPupils[0],
    maxPerPupil: perPupils[perPupils.length - 1],
  };

  console.log(
    `${label}: ${districts.length} districts, ${statewide.enrollment.toLocaleString()} headcount, ${Math.round(statewide.fundingEnrollment).toLocaleString()} funding FTE, $${(totals.total / 1e9).toFixed(1)}B, $${statewide.avgPerPupil.toLocaleString()}/funding FTE (${missingFinance} without F-196; ${missingFundingEnrollment} without P-223 FTE)`
  );
  return { schoolYear: label, statewide, districts };
}

async function main() {
  await loadFundBalance();
  const byYear = {};
  for (const year of YEARS) {
    byYear[year.label] = await buildYear(year);
  }

  const latest = YEARS[YEARS.length - 1].label;
  const sources = {
    enrollment:
      'OSPI Report Card Enrollment by school year (data.wa.gov), district totals, all grades',
    fundingEnrollment:
      'OSPI Final Enrollment Summary, annual-average K-12 FTE including ALE plus Running Start at college FTE (P-223/P-223RS)',
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
