/**
 * Builds src/data/spending.json: what each district ACTUALLY spent in
 * 2024-25 on the three programs the policy simulator lets you fund, so the
 * simulator can draw a "what it really costs" line next to the state formula.
 *
 * Source: F-196 General Fund Expenditures, school year 2024-25 (SAFS data
 * files) - the same CSV scripts/fetch-data.mjs uses for total expenditures,
 * but broken out by the F-196 Program and Object dimensions:
 *
 *   Special education  - Programs 21 (supplemental, state), 22 (infants and
 *                        toddlers, state) and 26 (institutions, state).
 *                        Divided by students with disabilities.
 *
 *                        Program 24 is supplemental special education paid for
 *                        with FEDERAL IDEA Part B money, and it is deliberately
 *                        excluded. The figure this file produces is compared
 *                        against the STATE allocation (revenue codes 3121,
 *                        4121, 4122, 4126 - see build-state-allocation.py),
 *                        and the brief reports the difference as money the
 *                        district covers out of its own general fund. Counting
 *                        federally-funded spending on the cost side made that
 *                        difference $254M too large statewide and described
 *                        federal grant money as money the district paid. The
 *                        three programs kept here line up one-for-one with the
 *                        three 41xx revenue codes on the allocation side.
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
 *   MSOC (Big 3)       - The broader MSOC expenditure definition OSPI Supt.
 *                        Reykdal used in his 2026 budget request and AESD uses
 *                        in its "Big 3" dashboard, computed from the NCES-coded
 *                        detail file (the "child" records of the same F-196
 *                        expenditure data): objects 5/7/8/9 in programs
 *                        01/02/03/31/34/55/65/74/97, minus athletics (activity
 *                        28), minus NCES codes that are not a state basic
 *                        education responsibility (interdistrict and contracted
 *                        services 321/322/511/519, tuition 565/569,
 *                        registration and fees 580 under objects 5 and 7,
 *                        judgments 820, debt 831/832/833/835, special items
 *                        950/960, land and building improvements 710/720),
 *                        minus, for non-high districts, the payment to the
 *                        serving high district (program 01, activity 29 - a
 *                        stand-in for OSPI's non-high payment form, which is
 *                        not published as data). Skills centers (programs
 *                        45/46) are outside the program list. Validated against
 *                        AESD's dashboard: 288 of 319 districts match to the
 *                        cent and the statewide total is within $10K; the rest
 *                        are non-high districts where the form amount differs
 *                        from the booked activity-29 payment. Divided by
 *                        funding FTE.
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
// The "child" records of the same F-196 general-fund expenditure data: one row
// per program/activity/object/NCES code. Sums to the parent file exactly; the
// NCES dimension is what the Big-3 MSOC exclusions are defined on.
const EXPENDITURE_DETAIL_FILE = 'gf-exp-detail-2425.csv';
const EXPENDITURE_DETAIL_URL = `${OSPI}/2025-12/24-25-actuals-child-general-fund-expenditures.csv`;
const SCHOOL_YEAR = '2024-2025';

// State-funded special education only. Program 24 (federal IDEA supplemental)
// is excluded on purpose - see the note in the module docstring.
const SPED_PROGRAMS = new Set(['21', '22', '26']);
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

// AESD/Reykdal "Big 3" MSOC scope - see the module docstring. The program
// list is basic education plus CTE and the categorical programs whose MSOC the
// state formula funds; note it includes program 03 and objects 9 (equipment),
// which AESD's own narrative omits but its published numbers include.
const MSOC_BIG3_PROGRAMS = new Set(['01', '02', '03', '31', '34', '55', '65', '74', '97']);
const MSOC_BIG3_OBJECTS = new Set(['5', '7', '8', '9']);
const MSOC_BIG3_EXCLUDED_ACTIVITY = '28'; // athletics and activities
const MSOC_BIG3_EXCLUDED_NCES = new Set([
  '321', '322', // instructional services purchased from districts / contracted ESAs
  '511', '519', // student transportation purchased from another district / other
  '565', '569', // tuition to other districts and institutions
  '710', '720', // land and building improvements
  '820', // judgments against the district
  '831', '832', '833', '835', // debt principal, interest, issuance
  '950', '960', // special / extraordinary items
]);
// Registration and fees are excluded only where they ride along with supplies
// and purchased services; NCES 580 under object 8 is ordinary travel and stays.
const MSOC_BIG3_EXCLUDED_NCES_OBJ57 = '580';

function isMsocBig3Cost(program, activity, object, nces) {
  if (!MSOC_BIG3_PROGRAMS.has(program) || !MSOC_BIG3_OBJECTS.has(object)) return false;
  if (activity === MSOC_BIG3_EXCLUDED_ACTIVITY) return false;
  if (MSOC_BIG3_EXCLUDED_NCES.has(nces)) return false;
  if (nces === MSOC_BIG3_EXCLUDED_NCES_OBJ57 && (object === '5' || object === '7'))
    return false;
  return true;
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
    if (!totals.has(code))
      totals.set(code, {
        sped: 0,
        transportation: 0,
        msoc: 0,
        msocBig3: 0,
        nonHighPayment: 0,
      });
    totals.get(code)[key] += amount;
  };

  for (const row of rows) {
    if (row['Fund Code'] !== '1') continue; // general fund only
    if (row['School Year Code'] !== SCHOOL_YEAR) continue;
    const code = String(row['County District Code']).padStart(5, '0');
    const program = String(row['Program Code']).padStart(2, '0');
    const activity = String(row['Activity Code']).padStart(2, '0');
    const object = String(row['Object Code']).trim();
    const amount = num(row['Amount']);
    if (SPED_PROGRAMS.has(program)) add(code, 'sped', amount);
    if (TRANSPORTATION_PROGRAMS.has(program)) add(code, 'transportation', amount);
    if (isMsocCost(program, object)) add(code, 'msoc', amount);
    // Non-high districts pay their serving high district out of program 01,
    // activity 29; the Big-3 MSOC figure deducts it for those districts.
    if (program === '01' && activity === '29') add(code, 'nonHighPayment', amount);
  }

  // Big-3 MSOC needs the NCES dimension, which only the detail file has.
  const detailRows = parseCsv(
    await ensureFile(EXPENDITURE_DETAIL_FILE, EXPENDITURE_DETAIL_URL)
  );
  for (const row of detailRows) {
    if (row['Fund Code'] !== '1') continue; // general fund only
    if (row['School Year Code'] !== SCHOOL_YEAR) continue;
    const code = String(row['County District Code']).padStart(5, '0');
    const program = String(row['Program Code']).padStart(2, '0');
    const activity = String(row['Activity Code']).padStart(2, '0');
    const object = String(row['Object Code']).trim();
    const nces = String(row['NCES Code']).trim();
    if (isMsocBig3Cost(program, activity, object, nces))
      add(code, 'msocBig3', num(row['Amount']));
  }

  const districts = JSON.parse(
    await readFile(path.join(DATA_DIR, 'districts.json'), 'utf8')
  );

  const out = {};
  const statewide = { sped: 0, transportation: 0, msoc: 0, msocBig3: 0, spedStudents: 0, enrollment: 0, fundingEnrollment: 0 };

  for (const d of districts.districts) {
    const spend = totals.get(d.code);
    if (!spend) continue;
    // The non-high deduction applies only to districts that actually are
    // non-high (no high-school FTE of their own).
    const isNonHigh = !(d.fundingFte && d.fundingFte.high > 0);
    const msocBig3 = spend.msocBig3 - (isNonHigh ? spend.nonHighPayment : 0);
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
      msocBig3: Math.round(msocBig3),
      msocBig3PerStudent:
        d.fundingEnrollment > 0 ? Math.round(msocBig3 / d.fundingEnrollment) : 0,
    };
    statewide.sped += spend.sped;
    statewide.transportation += spend.transportation;
    statewide.msoc += spend.msoc;
    statewide.msocBig3 += msocBig3;
    statewide.spedStudents += d.demo.sped;
    statewide.enrollment += d.enrollment;
    statewide.fundingEnrollment += d.fundingEnrollment;
  }

  const payload = {
    schoolYear: '2024-25',
    source: {
      file: EXPENDITURE_URL,
      detailFile: EXPENDITURE_DETAIL_URL,
      note:
        'OSPI F-196 General Fund expenditure actuals, 2024-25. Special education = state programs 21/22/26, excluding program 24 (federally funded IDEA supplemental) so the figure is comparable with the state allocation; transportation = program 99 (general fund only, excludes the Transportation Vehicle Fund); MSOC = objects 5/7/8 in basic-education programs 01/02/03 plus objects 7/8 in districtwide support program 97; excludes capital outlay, special education, food service, and transportation. msocBig3 = the broader MSOC expenditure definition OSPI Supt. Reykdal used in his 2026 budget request and AESD uses in its Big 3 dashboard, from the NCES-coded detail file: objects 5/7/8/9 in programs 01/02/03/31/34/55/65/74/97, excluding athletics (activity 28), NCES 321/322/511/519/565/569/710/720/820/831/832/833/835/950/960, NCES 580 under objects 5 and 7, and, for non-high districts, the program 01 activity 29 payment to the serving high district.',
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
      msocBig3: Math.round(statewide.msocBig3),
      msocBig3PerStudent: Math.round(
        statewide.msocBig3 / statewide.fundingEnrollment
      ),
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
      `  MSOC           $${payload.statewide.msocPerStudent.toLocaleString()} / funding FTE\n` +
      `  MSOC (Big 3)   $${payload.statewide.msocBig3PerStudent.toLocaleString()} / funding FTE`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
