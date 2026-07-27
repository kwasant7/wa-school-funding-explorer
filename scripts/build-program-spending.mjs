/**
 * Builds src/data/spending.json: what each district ACTUALLY spent in
 * 2024-25 on the three programs the policy simulator lets you fund, so the
 * simulator can draw a "what it really costs" line next to the state formula.
 *
 * Source: F-196 General Fund Expenditures, school year 2024-25 (SAFS data
 * files) - the same CSV scripts/fetch-data.mjs uses for total expenditures,
 * but broken out by the F-196 Program and Object dimensions:
 *
 *   Special education  - Program 21 (state supplemental), 22 (infants and
 *                        toddlers), 24 (federal supplemental), 26
 *                        (institutions). Divided by students with
 *                        disabilities.
 *   Transportation     - Program 99 (pupil transportation). Divided by
 *                        headcount enrollment. GENERAL FUND ONLY: buses
 *                        bought through the Transportation Vehicle Fund are
 *                        excluded, so this understates the full cost.
 *   MSOC               - Non-employee operating costs in basic education:
 *                        objects 5/7/8 in programs 01–03 plus purchased
 *                        services and travel (7/8) in districtwide support
 *                        (program 97). This excludes capital outlay, special
 *                        education, food service, and transportation. Divided
 *                        by funding FTE.
 *
 * Run: npm run fetch-spending
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, 'raw');
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

const OSPI = 'https://ospi.k12.wa.us/sites/default/files';
const EXPENDITURE_FILE = 'gf-exp-2425.csv';
const EXPENDITURE_URL = `${OSPI}/2025-12/24-25-actuals-general-fund-expenditures.csv`;
const SCHOOL_YEAR = '2024-2025';

const SPED_PROGRAMS = new Set(['21', '22', '24', '26']);
const TRANSPORTATION_PROGRAMS = new Set(['99']);
const MSOC_BASIC_PROGRAMS = new Set(['01', '02', '03']);
const MSOC_BASIC_OBJECTS = new Set(['5', '7', '8']);
const MSOC_DISTRICTWIDE_OBJECTS = new Set(['7', '8']);

function isMsocCost(program, object) {
  return (
    (MSOC_BASIC_PROGRAMS.has(program) && MSOC_BASIC_OBJECTS.has(object)) ||
    (program === '97' && MSOC_DISTRICTWIDE_OBJECTS.has(object))
  );
}

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

/** Minimal CSV reader: the F-196 exports are plain, quoted-field CSV. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < clean.length; i += 1) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

async function main() {
  const rows = parseCsv(await ensureFile(EXPENDITURE_FILE, EXPENDITURE_URL));
  const totals = new Map();
  const add = (code, key, amount) => {
    if (!totals.has(code)) totals.set(code, { sped: 0, transportation: 0, msoc: 0 });
    totals.get(code)[key] += amount;
  };

  for (const row of rows) {
    if (row['Fund Code'] !== '1') continue; // general fund only
    if (row['School Year Code'] !== SCHOOL_YEAR) continue;
    const code = String(row['County District Code']).padStart(5, '0');
    const program = String(row['Program Code']).padStart(2, '0');
    const object = String(row['Object Code']).trim();
    const amount = num(row['Amount']);
    if (SPED_PROGRAMS.has(program)) add(code, 'sped', amount);
    if (TRANSPORTATION_PROGRAMS.has(program)) add(code, 'transportation', amount);
    if (isMsocCost(program, object)) add(code, 'msoc', amount);
  }

  const districts = JSON.parse(
    await readFile(path.join(DATA_DIR, 'districts.json'), 'utf8')
  );

  const out = {};
  const statewide = { sped: 0, transportation: 0, msoc: 0, spedStudents: 0, enrollment: 0, fundingEnrollment: 0 };

  for (const d of districts.districts) {
    const spend = totals.get(d.code);
    if (!spend) continue;
    // Per-unit figures use the same denominator the matching simulator lever
    // uses, so the "actually spent" line is directly comparable to the slider.
    out[d.code] = {
      sped: Math.round(spend.sped),
      spedPerStudent: d.demo.sped > 0 ? Math.round(spend.sped / d.demo.sped) : 0,
      transportation: Math.round(spend.transportation),
      transportationPerStudent:
        d.enrollment > 0 ? Math.round(spend.transportation / d.enrollment) : 0,
      msoc: Math.round(spend.msoc),
      msocPerStudent:
        d.fundingEnrollment > 0 ? Math.round(spend.msoc / d.fundingEnrollment) : 0,
    };
    statewide.sped += spend.sped;
    statewide.transportation += spend.transportation;
    statewide.msoc += spend.msoc;
    statewide.spedStudents += d.demo.sped;
    statewide.enrollment += d.enrollment;
    statewide.fundingEnrollment += d.fundingEnrollment;
  }

  const payload = {
    schoolYear: '2024-25',
    source: {
      file: EXPENDITURE_URL,
      note:
        'OSPI F-196 General Fund expenditure actuals, 2024-25. Special education = programs 21/22/24/26; transportation = program 99 (general fund only, excludes the Transportation Vehicle Fund); MSOC = objects 5/7/8 in basic-education programs 01/02/03 plus objects 7/8 in districtwide support program 97; excludes capital outlay, special education, food service, and transportation.',
    },
    statewide: {
      sped: Math.round(statewide.sped),
      spedPerStudent: Math.round(statewide.sped / statewide.spedStudents),
      transportation: Math.round(statewide.transportation),
      transportationPerStudent: Math.round(
        statewide.transportation / statewide.enrollment
      ),
      msoc: Math.round(statewide.msoc),
      msocPerStudent: Math.round(statewide.msoc / statewide.fundingEnrollment),
    },
    districts: out,
  };

  await writeFile(
    path.join(DATA_DIR, 'spending.json'),
    `${JSON.stringify(payload)}\n`
  );
  console.log(
    `Wrote spending.json for ${Object.keys(out).length} districts.\n` +
      `  special ed     $${payload.statewide.spedPerStudent.toLocaleString()} / student with a disability\n` +
      `  transportation $${payload.statewide.transportationPerStudent.toLocaleString()} / student\n` +
      `  MSOC           $${payload.statewide.msocPerStudent.toLocaleString()} / funding FTE`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
