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
import { aleContractsMaterial, allIssuesFor, briefFor, metricsFor } from '@/lib/diagnosis';
import { onePageFor } from '@/lib/brief-onepage';
import { districtProfile } from '@/lib/district-profile';
import { big3Gap, big3Totals } from '@/lib/big3';
import { isSchoolDistrict } from '@/lib/entity';

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
];

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
    const expected = days < 0 ? 'No savings left'
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
      result(d.code, d.name, 'balanceChangeShown', /^Savings (fell|rose)/.test(note),
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
