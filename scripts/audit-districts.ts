/**
 * Check every district's brief, one-page PDF content and profile against
 * what each should say, and report pass / fail per district.
 *
 * Each check is about output a reader sees - the brief's cards and tiles, the
 * PDF's tiles and script, the district page's figures - and recomputes the
 * truth independently from the data files where it can, so a check fails when
 * the page says something the numbers do not support. "Info" rows are
 * conditions worth knowing about that are not errors.
 *
 * Run:
 *   node --experimental-strip-types --disable-warning=ExperimentalWarning --import ./tests/register.mjs scripts/audit-districts.ts [outDir]
 *
 * Writes district-audit.md and district-audit.csv to outDir (default
 * reports/) and exits 1 if any check fails.
 */
import fs from 'node:fs';
import path from 'node:path';

import districtsJson from '@/data/districts.json';
import levyJson from '@/data/levy.json';
import spendingJson from '@/data/spending.json';
import { OVERSIGHT_CHECKED_ON } from '@/data/oversight';
import { LEVY_ELECTIONS_THROUGH } from '@/lib/levy-coverage';
import { aleContractsMaterial, allIssuesFor, briefFor, metricsFor } from '@/lib/diagnosis';
import { onePageFor } from '@/lib/brief-onepage';
import { districtProfile } from '@/lib/district-profile';
import { big3Gap, big3Totals } from '@/lib/big3';
import { isSchoolDistrict } from '@/lib/entity';
import { RESERVE_MARGINAL_NEGATIVE_PCT } from '@/lib/reserves';

type Status = 'fail' | 'info';
type Row = { code: string; name: string; check: string; status: Status; detail: string };

const CHECKS: Record<string, { status: Status; text: string }> = {
  coveredConsistent: {
    status: 'fail',
    text: '"Covered locally" on the district page and in the brief agree, or the brief says why not',
  },
  spedBasisConsistent: {
    status: 'fail',
    text: 'Special education is not short on one basis and covered on the other',
  },
  needCardAboveState: {
    status: 'fail',
    text: 'An English learner or low-income card appears only where the rate is above the statewide rate',
  },
  reserveLabel: {
    status: 'fail',
    text: "The brief's reserves label matches the exact days of spending (30 and 60 day lines)",
  },
  balanceChangeShown: {
    status: 'fail',
    text: 'Where the fund balance moved differently from revenue minus spending, the PDF tile says what it did',
  },
  noLevyCard: {
    status: 'fail',
    text: 'A lapsed levy gets the no-levy card, and no LEA card claims money that needs a levy',
  },
  levyAsk: {
    status: 'fail',
    text: 'The levy-cap ask names the limit that actually binds',
  },
  entityWording: {
    status: 'fail',
    text: 'Charter and tribal compact schools are not written to as resident school districts',
  },
  textSanity: {
    status: 'fail',
    text: 'No NaN/undefined, bad ordinals ("2th"), "other 314", "started in", "$0 short" or "0 students (0%" in brief or PDF text',
  },
  otherRevenueLarge: {
    status: 'info',
    text: '"Other" revenue over 8% of the total (2000 fees/donations/interest, 8200 grants, 7121 payments from other districts, 9000 transfers)',
  },
  headlineOneOff: {
    status: 'info',
    text: 'Transfers in (9000) and timber (3600) are over 3% of revenue, or lift the per-student figure above the statewide median',
  },
  missingData: { status: 'info', text: 'A data file the pages draw on has no entry' },
  emptyBrief: { status: 'info', text: 'The brief finds no problem' },
  oversight: { status: 'info', text: `On OSPI oversight (list checked ${OVERSIGHT_CHECKED_ON})` },
};

const fmt = (n: number) =>
  `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1e6).toFixed(Math.abs(n) >= 1e7 ? 0 : 1)}M`;
const pct = (n: number) => `${n.toFixed(1)}%`;

const districts = districtsJson.districts;
const enrollment = districts.reduce((s, d) => s + d.enrollment, 0);
const STATE_ELL = (100 * districts.reduce((s, d) => s + d.demo.ell, 0)) / enrollment;
const STATE_LOW = (100 * districts.reduce((s, d) => s + d.demo.lowIncome, 0)) / enrollment;
const LEA = levyJson.assumptions;
const LARGE = new Set<string>(LEA.largeDistrictCodes);
const SPENDING = spendingJson.districts as Record<string, Record<string, number>>;

const rows: Row[] = [];
const passed = new Map<string, number>();
const result = (code: string, name: string, check: string, ok: boolean, detail = '') => {
  if (ok) passed.set(check, (passed.get(check) ?? 0) + 1);
  else rows.push({ code, name, check, status: CHECKS[check].status, detail });
};

const BAD_TEXT: [RegExp, string][] = [
  [/\bNaN\b|\bundefined\b|\bInfinity\b/, 'NaN/undefined'],
  [/\b\d*(?<!1)(1|2|3)th\b/, 'bad ordinal'],
  [/other 314/, '"other 314"'],
  [/started in/, '"started in"'],
  [/\$0 short/, '"$0 short"'],
  [/\b0 students \(0%/, '"0 students (0%"'],
  // Regression guards for wording the 2026-11-20 superintendent reviews got
  // removed: stale "last year", the district-voiced heading, the "taken from"
  // special-education line, and the oversight ask.
  [/\blast year\b/, '"last year"'],
  [/What needs to change in/, '"What needs to change in"'],
  [/taken from every student/, '"taken from every student"'],
  [/Watching a shortfall/, '"Watching a shortfall"'],
  [/could not pass a balanced budget/, '"could not pass a balanced budget"'],
  [/needs no new vote|Voters said yes/, '"needs no new vote" levy framing'],
];

/*
  One-off and pass-through revenue inside the headline per-student figure:
  code 9000 (other financing sources, mostly transfers in from other district
  funds) and 3600 (state forest / timber proceeds). Read from the raw F-196
  rows when they are present locally; the check is skipped otherwise.
*/
const ONE_OFF = new Map<string, { financing: number; timber: number }>();
{
  // The data year's raw file, e.g. 2024-25 -> gf-revenues-2425.csv / '2024-2025'.
  const [y1, y2] = districtsJson.schoolYear.split('-');
  const rawYear = `${y1}-${y1.slice(0, 2)}${y2}`;
  const file = path.resolve(`scripts/raw/gf-revenues-${y1.slice(2)}${y2}.csv`);
  if (fs.existsSync(file)) {
    const [header, ...lines] = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
    const cols = header.split(',').map((c) => c.replace(/"/g, ''));
    const at = (name: string) => cols.indexOf(name);
    const [iCode, iYear, iDist, iAmt] = [at('Revenue Code'), at('School Year Code'), at('County District Code'), at('Amount')];
    for (const line of lines) {
      const f = line.split(',').map((c) => c.replace(/"/g, ''));
      if (f[iYear] !== rawYear || (f[iCode] !== '9000' && f[iCode] !== '3600')) continue;
      const code = f[iDist].padStart(5, '0');
      const row = ONE_OFF.get(code) ?? { financing: 0, timber: 0 };
      if (f[iCode] === '9000') row.financing += Number(f[iAmt]) || 0;
      else row.timber += Number(f[iAmt]) || 0;
      ONE_OFF.set(code, row);
    }
  }
}
const MEDIAN_PER_PUPIL = districtsJson.statewide.medianPerPupil;

// The pages print the last levy election OSPI's worksheet covers; if a new
// worksheet arrives, its note changes and this stops the audit until the
// constant in src/lib/levy-coverage.ts is updated to match.
if (!levyJson.sources.note.includes(LEVY_ELECTIONS_THROUGH)) {
  throw new Error(`levy.json no longer mentions ${LEVY_ELECTIONS_THROUGH}; update src/lib/levy-coverage.ts`);
}

for (const d of districts) {
  const m = metricsFor(d.code);
  const brief = briefFor(d.code);
  const page = onePageFor(d.code);
  const profile = districtProfile(d.code);
  if (!m || !brief || !page || !profile) {
    result(d.code, d.name, 'missingData', false, 'no metrics, brief, PDF page or profile');
    continue;
  }
  const issues = allIssuesFor(d.code);
  const has = (id: string) => issues.some((i) => i.id === id);
  const tile = (label: string) => brief.stats.find((s) => s.label === label);

  // Missing inputs (info)
  const missing = [
    !m.alloc && 'state allocation',
    !m.spend && 'program spending',
    !m.big3 && 'AESD Big 3',
    d.fundBalance == null && 'fund balance',
    !m.levy && isSchoolDistrict(d) && 'levy',
  ].filter(Boolean);
  result(d.code, d.name, 'missingData', missing.length === 0, missing.join(', '));

  // 1. Covered locally: page vs brief
  if (m.big3 && profile.gaps.length > 0) {
    const pageTotal = profile.coveredLocally;
    const briefTotal = big3Totals(m.big3).total;
    const diff = Math.abs(pageTotal - briefTotal);
    const close = diff < 250_000 || diff < 0.2 * Math.max(pageTotal, briefTotal);
    const explained = aleContractsMaterial(m) && /ALE/.test(tile('Covered locally')?.note ?? '');
    result(d.code, d.name, 'coveredConsistent', close || explained,
      `district page ${fmt(pageTotal)} vs brief ${fmt(briefTotal)}`);

    // 2. Special-ed sign
    const pageGap = m.spedGap;
    const aesdGap = big3Gap(m.big3.sped);
    // Both sides have to be material: two figures near zero (Wahluke, -$86K on
    // the page without federal IDEA, +$111K on AESD's with it) flip sign on
    // the definition alone, and the page footnote states that definition.
    const flip = Math.sign(pageGap) !== Math.sign(aesdGap) &&
      Math.min(Math.abs(pageGap), Math.abs(aesdGap)) >= 100_000;
    result(d.code, d.name, 'spedBasisConsistent', !flip,
      `page ${fmt(pageGap)} vs AESD ${fmt(aesdGap)}`);
  }

  // 3. Need cards
  if (has('ell') || has('lowIncome')) {
    const bad = [
      has('ell') && m.ellRate <= STATE_ELL && `English learners ${pct(m.ellRate)} vs ${pct(STATE_ELL)}`,
      has('lowIncome') && m.lowIncomeRate <= STATE_LOW && `low income ${pct(m.lowIncomeRate)} vs ${pct(STATE_LOW)}`,
    ].filter(Boolean);
    result(d.code, d.name, 'needCardAboveState', bad.length === 0, bad.join('; '));
  }

  // 4. Reserves label against exact days
  const reserves = tile('Reserves');
  if (reserves && d.fundBalance != null && d.exp > 0) {
    const days = (365 * d.fundBalance) / d.exp;
    // A balance a hair below zero is labelled as such on purpose (ea61163);
    // only one past the marginal line reads "No savings left".
    const expected = days < 0
      ? (d.reserveRatio != null && d.reserveRatio > RESERVE_MARGINAL_NEGATIVE_PCT ? 'Balance just below zero' : 'No savings left')
      : days < 30 ? 'Less than one month of spending'
        : days < 60 ? "Below the State Auditor's 60-day benchmark"
          : "Meets the State Auditor's 60-day benchmark";
    result(d.code, d.name, 'reserveLabel', reserves.note === expected,
      `${days.toFixed(1)} days labelled "${reserves.note}"`);
  }

  // 5. Fund balance movement on the PDF tile
  if (d.priorFundBalance != null && d.fundBalance != null && d.surplus !== 0) {
    const change = d.fundBalance - d.priorFundBalance;
    const gap = Math.abs(change - d.surplus);
    if (gap > 100_000 && gap > 0.005 * d.exp) {
      const note = page.tiles[3]?.note ?? '';
      // The tile has said "Fell $X in <year>" / "Rose ..." since 08c3c27; the
      // direction must match the balance's own movement.
      const shown = change < 0 ? /^Fell /.test(note) : /^Rose /.test(note);
      result(d.code, d.name, 'balanceChangeShown', shown,
        `surplus ${fmt(d.surplus)}, balance change ${fmt(change)}, tile note "${note}"`);
    }
  }

  // 6. No-levy card and LEA
  if (m.levy) {
    const lv = m.levy as typeof m.levy & { lastLevy?: number | null };
    if (lv.levy === 0 && lv.lastLevy && lv.lastLevy >= 0.01 * d.exp) {
      result(d.code, d.name, 'noLevyCard', has('noLevy') && !has('leaDependence'),
        `last levy ${fmt(lv.lastLevy)}, cards: ${issues.map((i) => i.id).join(', ')}`);
    }
    // 7. Levy-cap ask
    const cap = issues.find((i) => i.id === 'levyCap');
    if (cap) {
      const perPupil = LARGE.has(d.code) ? LEA.maxLevyPerPupilLarge : LEA.maxLevyPerPupil;
      const rateBound = (LEA.maxLevyRate * lv.av) / 1000 < perPupil * lv.enrollment;
      const ok = rateBound ? /\$2\.50/.test(cap.ask ?? '') : cap.ask == null;
      result(d.code, d.name, 'levyAsk', ok, `${rateBound ? 'rate' : 'per-student'} limit binds; ask "${cap.ask ?? 'default'}"`);
    }
  }

  // 8. Charter / compact wording
  if (!isSchoolDistrict(d)) {
    const small = issues.find((i) => i.id === 'smallScale');
    const bad = [
      /^I live in/.test(page.message) && 'PDF script says "I live in"',
      small && /district/.test(small.title) && 'small-school card says "district"',
    ].filter(Boolean);
    result(d.code, d.name, 'entityWording', bad.length === 0, bad.join('; '));
  }

  // 9. Text sanity across brief and PDF
  const texts = [
    brief.summary,
    ...brief.stats.flatMap((s) => [s.value, s.note]),
    ...issues.flatMap((i) => [i.title, i.fact, i.ask ?? '']),
    ...page.tiles.flatMap((t) => [t.value, t.note]),
    page.message,
    ...(page.big3?.columns.map((c) => c.note) ?? []),
  ].join('\n');
  const found = BAD_TEXT.filter(([re]) => re.test(texts)).map(([, label]) => label);
  result(d.code, d.name, 'textSanity', found.length === 0, found.join(', '));

  // Info rows
  const otherShare = d.rev.total > 0 ? (100 * d.rev.other) / d.rev.total : 0;
  result(d.code, d.name, 'otherRevenueLarge', otherShare <= 8,
    `other ${fmt(d.rev.other)} = ${pct(otherShare)} of ${fmt(d.rev.total)}`);
  const oneOff = ONE_OFF.get(d.code);
  if (oneOff && d.fundingEnrollment > 0) {
    const amount = oneOff.financing + oneOff.timber;
    const without = (d.rev.total - amount) / d.fundingEnrollment;
    const crosses = d.perPupil > MEDIAN_PER_PUPIL && without <= MEDIAN_PER_PUPIL;
    result(d.code, d.name, 'headlineOneOff', amount <= 0.03 * d.rev.total && !crosses,
      `9000 ${fmt(oneOff.financing)}, 3600 ${fmt(oneOff.timber)} = ${pct((100 * amount) / d.rev.total)}; ` +
      `$${Math.round(d.perPupil).toLocaleString()} per student, $${Math.round(without).toLocaleString()} without` +
      (crosses ? ' (drops below the statewide median)' : ''));
  }
  result(d.code, d.name, 'emptyBrief', brief.issues.length > 0, `${Math.round(d.fundingEnrollment)} funded FTE`);
  result(d.code, d.name, 'oversight', !m.oversight, m.oversight ? `${m.oversight.level}, ${m.oversight.since}` : '');
  void SPENDING;
}

// ---- Output ----
const outDir = path.resolve(process.argv[2] ?? 'reports');
fs.mkdirSync(outDir, { recursive: true });
const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
fs.writeFileSync(
  path.join(outDir, 'district-audit.csv'),
  ['code,name,check,status,detail', ...rows.map((r) => [r.code, r.name, r.check, r.status, r.detail].map(cell).join(','))].join('\n') + '\n'
);

const byCheck = new Map<string, Row[]>();
for (const r of rows) byCheck.set(r.check, [...(byCheck.get(r.check) ?? []), r]);
const failures = rows.filter((r) => r.status === 'fail');
const lines = [
  '# District audit',
  '',
  `${districts.length} districts and schools. ${failures.length === 0 ? 'Every check passes.' : `${new Set(failures.map((r) => r.code)).size} with at least one failing check.`}`,
  '',
  '| Check | Kind | Pass | Flagged | What it checks |',
  '|---|---|---|---|---|',
  ...Object.entries(CHECKS).map(([id, c]) =>
    `| ${id} | ${c.status === 'fail' ? 'must pass' : 'info'} | ${passed.get(id) ?? 0} | ${byCheck.get(id)?.length ?? 0} | ${c.text} |`),
];
for (const [id, c] of Object.entries(CHECKS)) {
  const list = byCheck.get(id) ?? [];
  if (list.length === 0) continue;
  lines.push('', `## ${id} (${c.status}, ${list.length})`, '', c.text, '', '| Code | District | Detail |', '|---|---|---|');
  for (const r of list.slice(0, 25)) lines.push(`| ${r.code} | ${r.name} | ${r.detail} |`);
  if (list.length > 25) lines.push(`| | ...and ${list.length - 25} more in the CSV | |`);
}
fs.writeFileSync(path.join(outDir, 'district-audit.md'), lines.join('\n') + '\n');

for (const [id, c] of Object.entries(CHECKS)) {
  const kind = c.status === 'fail' ? 'must' : 'info';
  console.log(`${kind.padEnd(5)} ${id.padEnd(20)} pass ${String(passed.get(id) ?? 0).padStart(3)}  flagged ${byCheck.get(id)?.length ?? 0}`);
}
console.log(
  `\n${failures.length === 0 ? 'Every must-pass check passes.' : `${failures.length} must-pass failures.`} ` +
    `Wrote ${path.join(outDir, 'district-audit.md')} and district-audit.csv`
);
if (failures.length > 0) process.exitCode = 1;
