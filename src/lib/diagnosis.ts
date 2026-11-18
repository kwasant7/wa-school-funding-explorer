/**
 * Per-district funding diagnosis.
 *
 * Every district is short of money in its own way. Bellevue is property-rich
 * but runs a deficit and cannot legally collect $8.9M its own voters already
 * approved; Wahluke teaches a student body that is 56% multilingual; Winlock
 * pays $5,509 per student out of its general fund to cover special education
 * the state formula does not. A single "schools are underfunded" message is
 * true for all of them and useful to none of them.
 *
 * So instead of writing 315 briefs by hand, this scores each district against
 * a fixed set of funding problems, using only the OSPI data already on the
 * site, and ranks them. Every number a brief shows is derived here, which
 * means every claim traces back to a source listed on /sources.
 *
 * Severity is a percentile rank, not an absolute cutoff. The distributions are
 * badly skewed - the median district covers $512 per student of special
 * education itself and the worst covers $5,509 - so a fixed threshold would
 * either flag everyone or no one. Ranking each district against the other 314
 * keeps "this is unusually bad here" meaningful. Absolute gates then stop a
 * district from being told it has a problem when the dollars are trivial.
 */
import districtsJson from '@/data/districts.json';
import allocationJson from '@/data/allocation.json';
import spendingJson from '@/data/spending.json';
import levyJson from '@/data/levy.json';
/*
  Deliberately NOT history.json. The only thing the brief needs from the
  six-year history is each district's funded enrollment in the earliest year,
  and importing the full file would ship a megabyte to a page that renders
  none of it. scripts/fetch-data.mjs emits this ~5KB baseline alongside it.
*/
import baselineJson from '@/data/enrollment-baseline.json';
import { oversightFor, type Oversight } from '@/data/oversight';
import { fmtMoney, fmtMoneyFull, fmtInt, alignPair } from '@/lib/format';
import { big3For, big3Gap, big3Totals, type Big3Record } from '@/lib/big3';
import { PROTOTYPES } from '@/lib/prototypical-model';
import { RESERVE_BENCHMARK_PCT, RESERVE_THIN_PCT, fundBalanceChange, reserveDays } from '@/lib/reserves';

type DistrictRecord = (typeof districtsJson.districts)[number];
type Allocation = (typeof allocationJson.districts)[keyof typeof allocationJson.districts];
type Spending = (typeof spendingJson.districts)[keyof typeof spendingJson.districts];
type Levy = (typeof levyJson.districts)[keyof typeof levyJson.districts];

const ALLOCATION = allocationJson.districts as Record<string, Allocation>;
const SPENDING = spendingJson.districts as Record<string, Spending>;
const LEVIES = levyJson.districts as Record<string, Levy>;
const LEA = levyJson.assumptions;
const LARGE_DISTRICTS = new Set<string>(LEA.largeDistrictCodes);

/** The earliest year on the site, used for the multi-year enrollment trend. */
const BASE_YEAR = baselineJson.baseYear;
const LATEST_YEAR = baselineJson.latestYear;
const BASELINE_FTE = baselineJson.districts as Record<string, number>;

/**
 * Bills are quoted only from the vetted 2026 set already shown on this page.
 * Nothing here invents a bill number: where no 2026 bill addresses a problem
 * (the levy cap, the special education multiplier), the citation points at
 * the statute or the budget instead.
 */
const BILLS = {
  msoc: {
    bill: 'SSB 5918',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5918&Year=2025',
    note: 'Would have added $100 per student, or at least $100,000 per district, for operating costs. Died in Senate Ways & Means.',
  },
  transportation: {
    bill: 'SB 5858',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5858&Year=2025',
    note: 'Would have written a transportation safety net into law for students with disabilities, students experiencing homelessness, and students in foster care. Died in Senate Ways & Means.',
  },
  enrollment: {
    bill: 'SB 6125',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=6125&Year=2025',
    note: 'Would have cushioned districts against sharp state-revenue losses when enrollment falls below 2025-26 levels. Died in its first committee.',
  },
  utilities: {
    bill: 'SB 6310',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=6310&Year=2025',
    note: 'Would have changed how utilities and insurance are allocated, two costs that swing hard by location and building age. Died in its first committee.',
  },
  buses: {
    bill: 'ESSB 6260',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=6260&Year=2025',
    note: 'Signed April 1, 2026. Stretched the assumed lifetime of school buses, so the state reimburses their cost more slowly.',
  },
  budget: {
    bill: 'ESSB 5998',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5998&Year=2025',
    note: 'The 2026 supplemental operating budget - where an idea actually receives, loses, or changes money.',
  },
  review: {
    bill: 'E2SHB 2636',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=2636&Year=2025',
    note: 'Would have commissioned independent reviews of public-education funding and operations. Passed the House, then stopped before a Senate vote.',
  },
  spedIncrease: {
    bill: 'E2SSB 5263',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5263&Year=2025',
    note: 'Took effect September 1, 2025 - after the 2024-25 numbers above. It raised the special-education multiplier and removed the enrollment cap, so this gap is narrower under current law than the figures here show.',
  },
} as const;

const LEVY_STATUTE = {
  bill: 'RCW 84.52.0531',
  url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=84.52.0531',
  note: 'The statute that limits enrichment levies to the lesser of $2.50 per $1,000 of assessed value and a per-student amount, with a higher per-student limit for districts above 40,000 students.',
} as const;

const LEA_STATUTE = {
  bill: 'RCW 28A.500.015',
  url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.500.015',
  note: 'The statute that sets the Local Effort Assistance threshold and the local-effort proration rule.',
} as const;

export type BillRef = { bill: string; url: string; note: string };

export type IssueId =
  | 'oversight'
  | 'reserves'
  | 'levyCap'
  | 'noLevy'
  | 'leaDependence'
  | 'sped'
  | 'msoc'
  | 'transportation'
  | 'ell'
  | 'lowIncome'
  | 'enrollmentDecline'
  | 'smallScale';

/**
 * The picture that carries an issue.
 *
 * A funding gap is a comparison, and a comparison is a shape before it is a
 * sentence: two bars of different lengths say "this costs more than we are
 * given" faster than any paragraph, and they say it to a reader who would
 * skip the paragraph. So each issue names the shape and supplies the numbers,
 * and the page and the PDF each draw it in their own medium.
 *
 * The vocabulary is deliberately tiny. Five shapes cover all eleven issues,
 * which means a reader learns to read this brief once.
 */
export type IssueVisual =
  /** Two bars: what the state gives against what the thing actually costs. */
  | {
      kind: 'versus';
      aLabel: string;
      a: number;
      bLabel: string;
      b: number;
      /** Called out between the bars, e.g. "$36M short". */
      gapLabel: string;
      format: 'money' | 'plain';
      /**
       * Rounding grid `a`, `b` and the gap share, set by `shortfall()`.
       * Renderers must format the bars at this precision - dropping it lets the
       * two labels round independently again, which is what made 68% of briefs
       * print bars that did not subtract to their own caption.
       */
      step?: number;
      /**
       * The gap is good news - funding met or beat the cost - so the caption
       * renders green rather than critical red. Briefs never set it: an issue
       * is by definition a shortfall. It exists for a funding-vs-cost card,
       * where a district can come out ahead on any one program, and nothing
       * sets it today.
       */
      covered?: boolean;
    }
  /** 100 figures, some filled: a share, read by counting rather than parsing. */
  | {
      kind: 'dots';
      filled: number;
      label: string;
      /** The statewide share, drawn as a reference tick. */
      compare: number;
      compareLabel: string;
    }
  /** A value against a safe threshold, for reserves. */
  | {
      kind: 'gauge';
      value: number;
      safe: number;
      label: string;
      safeLabel: string;
    }
  /** Escalating states with the district's own marked. */
  | { kind: 'steps'; steps: string[]; current: number }
  /** One number falling over time. */
  | {
      kind: 'trend';
      fromLabel: string;
      from: number;
      toLabel: string;
      to: number;
      changeLabel: string;
    };

export type Issue = {
  id: IssueId;
  /** Plain-language heading. Short enough to read at a glance. */
  title: string;
  /** One sentence carrying this district's number. Nothing else. */
  fact: string;
  /** The comparison, drawn rather than described. */
  visual: IssueVisual;
  /**
   * What the district itself has already done about this problem, when that
   * is known - so a reader doesn't come away thinking a district on
   * oversight is sitting still. Set only on the `oversightIssue` builder
   * today, from `Oversight.response`; most issues have no such record and
   * leave this unset rather than guessing.
   */
  response?: string;
  /**
   * What to ask lawmakers for, when it depends on the district rather than
   * the issue alone. Falls back to ISSUE_ASKS[id].
   */
  ask?: string;
  /** Real bills or statutes behind this issue. */
  refs: BillRef[];
  /** 0-100, comparable across issue types, used only for ranking. */
  severity: number;
};

export type BriefStat = { label: string; value: string; note: string };

export type DistrictBrief = {
  code: string;
  name: string;
  /** Two or three sentences of framing above the issue cards. */
  summary: string;
  stats: BriefStat[];
  issues: Issue[];
  /** Set when the district looks broadly typical, so the brief says so. */
  steadyNote: string | null;
};

/* ------------------------------------------------------------------ *
 * Metrics
 * ------------------------------------------------------------------ */

export type Metrics = {
  code: string;
  name: string;
  record: DistrictRecord;
  alloc: Allocation | null;
  spend: Spending | null;
  levy: Levy | null;
  oversight: Oversight | null;
  fte: number;
  headcount: number;
  /** General-fund dollars per student the district covers beyond the formula. */
  spedGap: number;
  spedGapPerPupil: number;
  msocGap: number;
  msocGapPerPupil: number;
  transGap: number;
  transGapPerPupil: number;
  /**
   * The same three gaps on AESD's Big 3 definitions, which is what the Big 3
   * card and the one-page PDF print. Kept beside the allocation-based gaps
   * above rather than replacing them: the district profile still shows those
   * as allocated-versus-spent pairs, and the two must stay a matched set.
   */
  big3: Big3Record | null;
  big3SpedPerPupil: number;
  /** AESD's MSOC cost less contracted ALE teaching (see build-program-spending). */
  big3MsocCost: number;
  big3MsocPerPupil: number;
  big3TransPerPupil: number;
  /** Voter-approved levy dollars the statutory cap forbids collecting. */
  capBlocked: number;
  capBlockedPerPupil: number;
  /** Levy equalization as a share of the district's state money, 0-100. */
  leaShare: number;
  /** Local Effort Assistance lost because local levy effort is under $1.50. */
  leaForgone: number;
  avPerPupil: number | null;
  ellRate: number;
  lowIncomeRate: number;
  spedRate: number;
  homelessRate: number;
  bilingualPerEll: number | null;
  lapPerLowIncome: number | null;
  enrollmentChange: number | null;
  reserveRatio: number | null;
  surplus: number;
  perPupil: number;
};

// Exported for tests only - every other caller in this file is internal.
export function rate(part: number, whole: number): number {
  return whole > 0 ? (100 * part) / whole : 0;
}

function buildMetrics(): Metrics[] {
  return districtsJson.districts.map((record) => {
    const code = record.code;
    const alloc = ALLOCATION[code] ?? null;
    const spend = SPENDING[code] ?? null;
    const levy = LEVIES[code] ?? null;
    const fte = record.fundingEnrollment || record.enrollment || 1;
    const headcount = record.enrollment || 0;

    // Net of the other special-ed revenue booked to the same programs (other
    // districts' payments, Medicaid, other agencies), so the gap is what the
    // district paid from its own general money - see build-program-spending.
    const spedGap = alloc && spend ? spend.sped - spend.spedOtherRevenue - alloc.specialEd : 0;
    // MSOC uses the Big-3 scope (OSPI's 2026 budget-request definition, the
    // same one AESD's dashboard publishes) rather than the GenEd-only pair,
    // so the gap quoted to a legislator matches the number their staff can
    // look up. The GenEd-only fields still exist for the formula walkthrough.
    const msocGap = alloc && spend ? spend.msocBig3 - alloc.msocBig3 : 0;
    const transGap = alloc && spend ? spend.transportation - alloc.transportation : 0;

    const big3 = big3For(code);
    const big3PerPupil = (gap: number) =>
      big3 && big3.students > 0 ? gap / big3.students : 0;
    // AESD's MSOC cost without the teaching an ALE program buys from outside
    // providers, which the site does not count as operating costs.
    const big3MsocCost = big3 ? big3.msoc.cost - (spend?.msocBig3AleContracts ?? 0) : 0;

    /*
      A district's enrichment levy authority is the lesser of a rate limit and
      a per-student limit. Forty-six districts have passed a levy larger than
      that ceiling lets them collect, so the blocked dollars are money voters
      have already said yes to - no new election required to use them, only a
      change to the cap.
    */
    let capBlocked = 0;
    if (levy) {
      const cap = LARGE_DISTRICTS.has(code)
        ? LEA.maxLevyPerPupilLarge
        : LEA.maxLevyPerPupil;
      const authority = Math.min(
        (LEA.maxLevyRate * levy.av) / 1000,
        cap * levy.enrollment
      );
      capBlocked = Math.max(0, levy.levy - authority);
    }

    /*
      LEA is prorated by local effort: a district levying below $1.50 per
      $1,000 of assessed value receives only that fraction of the equalization
      it otherwise qualifies for. The forgone amount is a local choice with a
      state-set penalty attached, which is worth naming separately.
    */
    const leaForgone = levy ? Math.max(0, levy.maxLea - levy.payableLea) : 0;

    const baseFte = BASELINE_FTE[code];
    const enrollmentChange =
      baseFte > 0
        ? rate(record.fundingEnrollment - baseFte, baseFte)
        : null;

    return {
      code,
      name: record.name,
      record,
      alloc,
      spend,
      levy,
      oversight: oversightFor(code),
      fte,
      headcount,
      spedGap,
      spedGapPerPupil: spedGap / fte,
      msocGap,
      msocGapPerPupil: msocGap / fte,
      transGap,
      transGapPerPupil: transGap / fte,
      big3,
      big3SpedPerPupil: big3 ? big3PerPupil(big3Gap(big3.sped)) : 0,
      big3MsocCost,
      big3MsocPerPupil: big3 ? big3PerPupil(big3MsocCost - big3.msoc.revenue) : 0,
      big3TransPerPupil: big3 ? big3PerPupil(big3Gap(big3.transportation)) : 0,
      capBlocked,
      capBlockedPerPupil: capBlocked / fte,
      leaShare: alloc ? rate(alloc.levyEqualization, alloc.total) : 0,
      leaForgone,
      avPerPupil: levy && levy.enrollment > 0 ? levy.av / levy.enrollment : null,
      ellRate: rate(record.demo.ell, headcount),
      lowIncomeRate: rate(record.demo.lowIncome, headcount),
      spedRate: rate(record.demo.sped, headcount),
      homelessRate: rate(record.demo.homeless, headcount),
      bilingualPerEll:
        alloc && record.demo.ell > 0 ? alloc.bilingual / record.demo.ell : null,
      lapPerLowIncome:
        alloc && record.demo.lowIncome > 0
          ? alloc.learningAssistance / record.demo.lowIncome
          : null,
      enrollmentChange,
      reserveRatio: record.reserveRatio,
      surplus: record.surplus,
      perPupil: record.perPupil,
    };
  });
}

const METRICS = buildMetrics();
const BY_CODE = new Map(METRICS.map((m) => [m.code, m]));

/**
 * A district's computed Metrics. Called by district-profile.ts for the static
 * district pages, not just by tests, so its shape is load-bearing.
 */
export function metricsFor(code: string): Metrics | null {
  return BY_CODE.get(code) ?? null;
}

/* ------------------------------------------------------------------ *
 * Percentile ranking
 * ------------------------------------------------------------------ */

/** Sorted value lists, built once, so a district can be ranked against the state. */
function distribution(pick: (m: Metrics) => number | null): number[] {
  return METRICS.map(pick)
    .filter((v): v is number => v != null && Number.isFinite(v))
    .sort((a, b) => a - b);
}

const DISTRIBUTIONS = {
  spedGapPerPupil: distribution((m) => m.spedGapPerPupil),
  msocGapPerPupil: distribution((m) => m.msocGapPerPupil),
  transGapPerPupil: distribution((m) => m.transGapPerPupil),
  big3SpedPerPupil: distribution((m) => (m.big3 ? m.big3SpedPerPupil : null)),
  big3MsocPerPupil: distribution((m) => (m.big3 ? m.big3MsocPerPupil : null)),
  big3TransPerPupil: distribution((m) => (m.big3 ? m.big3TransPerPupil : null)),
  capBlockedPerPupil: distribution((m) => (m.capBlocked > 0 ? m.capBlockedPerPupil : null)),
  leaShare: distribution((m) => m.leaShare),
  ellRate: distribution((m) => m.ellRate),
  lowIncomeRate: distribution((m) => m.lowIncomeRate),
  perPupil: distribution((m) => m.perPupil),
  reserveRatio: distribution((m) => m.reserveRatio),
  avPerPupil: distribution((m) => m.avPerPupil),
};

/**
 * Share of districts at or below `value`, as 0-100.
 * Exported for tests only - every other caller in this file is internal.
 */
export function percentileOf(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0;
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] <= value) low = mid + 1;
    else high = mid;
  }
  return (100 * low) / sorted.length;
}

/**
 * The lower of the two middle values on an even-length list, not an
 * average of them - deliberate, so the result is always a value that
 * actually occurs in the data. Exported for tests only.
 */
export function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

const MEDIANS = {
  spedGapPerPupil: median(DISTRIBUTIONS.spedGapPerPupil),
  msocGapPerPupil: median(DISTRIBUTIONS.msocGapPerPupil),
  transGapPerPupil: median(DISTRIBUTIONS.transGapPerPupil),
  perPupil: median(DISTRIBUTIONS.perPupil),
  reserveRatio: median(DISTRIBUTIONS.reserveRatio),
  avPerPupil: median(DISTRIBUTIONS.avPerPupil),
};

const STATEWIDE = {
  ellRate: rate(
    districtsJson.districts.reduce((s, d) => s + d.demo.ell, 0),
    districtsJson.districts.reduce((s, d) => s + d.enrollment, 0)
  ),
  lowIncomeRate: rate(
    districtsJson.districts.reduce((s, d) => s + d.demo.lowIncome, 0),
    districtsJson.districts.reduce((s, d) => s + d.enrollment, 0)
  ),
  spedRate: rate(
    districtsJson.districts.reduce((s, d) => s + d.demo.sped, 0),
    districtsJson.districts.reduce((s, d) => s + d.enrollment, 0)
  ),
  spedPerStudent: spendingJson.statewide.spedPerStudent,
  msocPerStudent: spendingJson.statewide.msocPerStudent,
  transportationPerStudent: spendingJson.statewide.transportationPerStudent,
};

function round(n: number): string {
  return fmtMoneyFull(Math.round(n));
}

function pctText(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

/* ------------------------------------------------------------------ *
 * Issue builders
 * ------------------------------------------------------------------ */

/*
  Each builder returns an Issue only when the problem is real for this
  district: percentile rank high enough to be unusual, and absolute dollars
  large enough to be worth a legislator's attention. Returning null is the
  normal, honest outcome for most issues in most districts.
*/
type Builder = (m: Metrics) => Issue | null;

/**
 * Money at a size a reader can hold in their head.
 *
 * "$35,955,206" is precise and unreadable; the precision is also false comfort,
 * since the underlying figure is an annual actual that will be restated. What
 * matters to someone deciding whether to email a legislator is that it is
 * thirty-six million dollars, so that is what the brief says. Per-student
 * amounts stay exact - they are small enough to mean something.
 *
 * Exported for tests only - every other caller in this file is internal.
 */
export function plainMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)} billion`;
  /*
    One decimal below ten million. "$8.9 million" is still easy to read, and
    rounding it to "$9 million" would overstate the figure - not acceptable in
    a document someone may quote at a legislator.
  */
  if (abs >= 1e7) return `${sign}$${Math.round(abs / 1e6)} million`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)} million`;
  if (abs >= 1e5) {
    /*
      Re-check the magnitude after rounding. $999,600 rounds to 1000 thousands,
      and pasting ",000" onto that printed "$1000,000".
    */
    const thousands = Math.round(abs / 1e3);
    if (thousands >= 1000) return `${sign}$${(thousands / 1e3).toFixed(1)} million`;
    return `${sign}$${thousands},000`;
  }
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

/**
 * A "what it costs against what the state sends" figure.
 *
 * The caption is derived from the bars rather than computed alongside them.
 * `alignPair` snaps both amounts and their difference onto one rounding grid,
 * so the two printed numbers subtract to the printed gap - previously they were
 * rounded independently and 68% of briefs shipped a figure whose own arithmetic
 * did not close. The returned `gap` is what the chart shows, and callers use it
 * for the surrounding sentence too, so prose and picture cannot drift apart.
 */
function shortfall(
  aLabel: string,
  a: number,
  bLabel: string,
  b: number,
  caption: (gap: string) => string,
): { visual: Extract<IssueVisual, { kind: 'versus' }>; gap: number } {
  const pair = alignPair(a, b);
  return {
    gap: pair.gap,
    visual: {
      kind: 'versus',
      aLabel,
      a: pair.a,
      bLabel,
      b: pair.b,
      gapLabel: caption(plainMoney(pair.gap)),
      format: 'money',
      step: pair.step,
    },
  };
}

/** "20 out of every 100 students" reads better than "19.8%" to most people. */
function perHundred(rate: number): number {
  return Math.round(rate);
}

const oversightIssue: Builder = (m) => {
  if (!m.oversight) return null;
  const enhanced = m.oversight.level === 'enhanced';
  return {
    id: 'oversight',
    title: enhanced ? 'The state took over the budget' : 'The state is watching the budget',
    fact: enhanced
      ? `${m.name} could not fix its budget on its own, so the state sent in someone to help run it.`
      : `${m.name} could not pass a balanced budget, so the state stepped in. OSPI's most recent update was in ${m.oversight.since}.`,
    visual: {
      kind: 'steps',
      steps: ['Healthy', 'Warning', 'State steps in', 'State takes over'],
      current: enhanced ? 3 : 2,
    },
    response: m.oversight.response,
    refs: [BILLS.budget, BILLS.review],
    severity: enhanced ? 100 : 94,
  };
};

const reservesIssue: Builder = (m) => {
  const rr = m.reserveRatio;
  if (rr == null) return null;
  // Districts on oversight already lead with a sharper version of this.
  if (m.oversight) return null;

  /*
    A district that missed breakeven by $26,000 on a $49M budget did not fail
    to balance its budget - it landed on it. Only count a shortfall that is
    actually material against the district's own spending, or one that lands
    on top of reserves already too thin to absorb it. Without this gate the
    brief cries wolf in districts that are fine, which costs it credibility in
    the ones that are not.
  */
  /*
    Measured on the fund balance itself where both year-end balances exist.
    Revenue minus spending misses general-fund money moved to other funds:
    Bethel's 2024-25 looked like a 0.5% shortfall while its balance fell 1.6%.
  */
  const balanceChange = fundBalanceChange(m.record);
  const drop = balanceChange != null ? -balanceChange : -m.surplus;
  const deficitShare = m.record.exp > 0 ? (100 * drop) / m.record.exp : 0;
  const materialDeficit = deficitShare >= 1;
  // Under a month of spending. The State Auditor's 60-day benchmark is the
  // line on the gauge, but most districts sit below it (the statewide median
  // is about 50 days), so flagging every one would cry wolf.
  const thinReserves = rr < RESERVE_THIN_PCT;
  if (!materialDeficit && !thinReserves) return null;

  /*
    "Cannot adopt a balanced budget" is a term of art in Washington with a legal
    consequence attached - RCW 28A.505.110 binding conditions - and only the
    districts in OVERSIGHT are actually in that position. A district that
    deliberately spent planned reserves did adopt a balanced budget. Saying
    otherwise in a letter to a legislator is the kind of error that gets the
    whole brief dismissed, so this describes the cash flow instead.
  */
  const negativeBalance = rr < 0;

  return {
    id: 'reserves',
    title: negativeBalance
      ? 'The savings are gone'
      : materialDeficit
        ? balanceChange != null
          ? 'Savings fell last year'
          : 'Spending outran revenue last year'
        : 'Savings are running low',
    fact: negativeBalance
      ? `${m.name} ended ${LATEST_YEAR} with a negative fund balance - it has spent its savings and is carrying a shortfall forward.`
      : materialDeficit
        ? balanceChange != null
          ? `${m.name}'s fund balance fell by ${plainMoney(drop)} last year, leaving about ${reserveDays(rr)} days of spending in savings.`
          : `${m.name} spent ${plainMoney(Math.abs(m.surplus))} more than it took in last year, covering the difference out of savings.`
        : `${m.name} has enough savings to run for only about ${reserveDays(rr)} days, less than one month of spending.`,
    visual: {
      kind: 'gauge',
      value: rr,
      safe: RESERVE_BENCHMARK_PCT,
      label: 'Savings here',
      safeLabel: "State Auditor's 60-day benchmark",
    },
    refs: [BILLS.budget, BILLS.enrollment],
    severity: rr < 0 ? 90 : materialDeficit && thinReserves ? 78 : materialDeficit ? 68 : 60,
  };
};

const levyCapIssue: Builder = (m) => {
  if (!m.levy || m.capBlocked <= 0) return null;
  const pctile = percentileOf(DISTRIBUTIONS.capBlockedPerPupil, m.capBlockedPerPupil);
  const allowed = m.levy.levy - m.capBlocked;
  const fig = shortfall(
    'Voters approved',
    m.levy.levy,
    'State allows',
    allowed,
    (gap) => `${gap} blocked`,
  );

  /*
    The levy limit is the lesser of two caps. Thirty of the capped districts
    hit the $2.50-per-$1,000 rate limit, not the per-student one - Spokane's
    rate limit is $92.6M against a $117.8M per-student limit - so asking to
    raise the per-student cap would free none of their money.
  */
  const perPupilCap = LARGE_DISTRICTS.has(m.code) ? LEA.maxLevyPerPupilLarge : LEA.maxLevyPerPupil;
  const rateBound = (LEA.maxLevyRate * m.levy.av) / 1000 < perPupilCap * m.levy.enrollment;

  return {
    id: 'levyCap',
    title: 'Voters said yes. State law says no.',
    fact: `People here voted to pay ${plainMoney(m.levy.levy)} in school taxes. State law blocks ${plainMoney(fig.gap)} of it${
      rateBound ? `, because it is more than $${LEA.maxLevyRate.toFixed(2)} per $1,000 of property value` : ''
    }.`,
    visual: fig.visual,
    ask: rateBound
      ? `Raise the $${LEA.maxLevyRate.toFixed(2)} levy rate limit. This money needs no new vote.`
      : undefined,
    refs: [LEVY_STATUTE],
    // A cap that blocks a lot per student matters more than one blocking a
    // rounding error, but any blocked money is a strong, concrete case.
    severity: 70 + pctile * 0.18,
  };
};

/*
  A district whose voters approved no enrichment levy for the modelled year,
  after one in the three years before. Nothing else in the brief sees it: the
  levy-cap card needs a levy to block, and the 2024-25 money figures predate
  the lapse - Battle Ground's brief said nothing stood out while its $31M
  levy, about 13% of a year's spending, had run out.
*/
const noLevyIssue: Builder = (m) => {
  const lv = m.levy;
  if (!lv || lv.levy > 0 || !lv.lastLevy || !lv.lastLevyYear) return null;
  const share = m.record.exp > 0 ? (100 * lv.lastLevy) / m.record.exp : 0;
  if (share < 1) return null;
  const first = lv.lastLevyYear + 1;
  const last = levyJson.levyYear;
  const years =
    first === last ? `${last}` : last - first === 1 ? `${first} or ${last}` : `${first} through ${last}`;
  const lea = m.alloc?.levyEqualization ?? 0;
  const fig = shortfall(
    `Approved for ${lv.lastLevyYear}`,
    lv.lastLevy,
    `Approved for ${last}`,
    0,
    (gap) => `${gap} gone`,
  );

  return {
    id: 'noLevy',
    title: 'No school levy approved',
    fact: `Voters here have not approved an enrichment levy for ${years}. The last one, for ${lv.lastLevyYear}, was ${plainMoney(lv.lastLevy)}, about ${Math.round(share)}% of a year's spending${
      lea > 0
        ? `. Without a levy the district also gets no Local Effort Assistance, which brought in ${plainMoney(lea)} in ${LATEST_YEAR}`
        : ''
    }.`,
    visual: fig.visual,
    refs: [LEVY_STATUTE, LEA_STATUTE],
    severity: 75 + Math.min(20, share),
  };
};

const leaIssue: Builder = (m) => {
  if (!m.alloc || m.leaShare < 2) return null;
  // LEA is paid in proportion to a district's own levy, so with no levy for
  // the modelled year there is none to describe - the no-levy card says so.
  if (m.levy && m.levy.levy === 0) return null;
  const pctile = percentileOf(DISTRIBUTIONS.leaShare, m.leaShare);
  if (pctile < 70) return null;
  if (m.avPerPupil == null) return null;

  return {
    id: 'leaDependence',
    title: 'There is not much local property to tax',
    fact: `A school tax here raises far less than the same tax in a richer district, so the state sent ${plainMoney(m.alloc.levyEqualization)} in ${LATEST_YEAR} to help close the gap.`,
    visual: {
      kind: 'versus',
      aLabel: 'Property value per student, typical district',
      a: MEDIANS.avPerPupil,
      bLabel: 'Property value per student here',
      b: m.avPerPupil,
      gapLabel: `${Math.round((100 * m.avPerPupil) / MEDIANS.avPerPupil)}% of typical`,
      format: 'money',
    },
    refs: [LEA_STATUTE, BILLS.budget],
    severity: 55 + pctile * 0.25,
  };
};

/*
  The three Big 3 issues read AESD's figures (src/lib/big3.ts) so that the
  brief, the Big 3 card and the one-page PDF all print the same numbers. On
  those definitions "funding" counts every revenue line for the program -
  state, federal IDEA and Medicaid money, and payments from other districts -
  and cost counts every matching expenditure, so a federal dollar appears on
  both sides and the gap is what is left for the district's own money.
*/
const spedIssue: Builder = (m) => {
  if (!m.big3 || m.big3SpedPerPupil < 300) return null;
  const pctile = percentileOf(DISTRIBUTIONS.big3SpedPerPupil, m.big3SpedPerPupil);
  if (pctile < 55) return null;

  const fig = shortfall(
    'What it really costs',
    m.big3.sped.cost,
    'Funding it receives',
    m.big3.sped.revenue,
    (gap) => `${gap} short`,
  );

  return {
    id: 'sped',
    title: 'Special education is underfunded',
    fact: `Special education costs ${plainMoney(fig.gap)} more than the funding that arrives for it - about ${round(m.big3SpedPerPupil)} taken from every student's regular school money. That funding already counts state, federal and Medicaid dollars.`,
    visual: fig.visual,
    refs: [BILLS.budget, BILLS.spedIncrease],
    severity: 50 + pctile * 0.4,
  };
};

const msocIssue: Builder = (m) => {
  if (!m.big3 || m.big3MsocPerPupil < 250) return null;
  const pctile = percentileOf(DISTRIBUTIONS.big3MsocPerPupil, m.big3MsocPerPupil);
  if (pctile < 55) return null;

  const fig = shortfall(
    'What it really costs',
    m.big3MsocCost,
    'Funding it receives',
    m.big3.msoc.revenue,
    (gap) => `${gap} short`,
  );

  return {
    id: 'msoc',
    title: 'Everyday running costs are underfunded',
    fact: `Heat, power, insurance, supplies and computers cost ${plainMoney(fig.gap)} more than the funding that arrives for them.`,
    visual: fig.visual,
    refs: [BILLS.msoc, BILLS.utilities],
    severity: 48 + pctile * 0.4,
  };
};

const transportationIssue: Builder = (m) => {
  if (!m.big3 || m.big3TransPerPupil < 120) return null;
  const pctile = percentileOf(DISTRIBUTIONS.big3TransPerPupil, m.big3TransPerPupil);
  if (pctile < 70) return null;

  const fig = shortfall(
    'What it really costs',
    m.big3.transportation.cost,
    'Funding it receives',
    m.big3.transportation.revenue,
    (gap) => `${gap} short`,
  );

  return {
    id: 'transportation',
    title: 'Getting students to school costs more than the funding for it',
    fact: `Buses and routes cost ${plainMoney(fig.gap)} more here than the funding that arrives for them.`,
    visual: fig.visual,
    refs: [BILLS.transportation, BILLS.buses],
    severity: 45 + pctile * 0.35,
  };
};

const ellIssue: Builder = (m) => {
  if (m.ellRate < 12) return null;
  const pctile = percentileOf(DISTRIBUTIONS.ellRate, m.ellRate);
  if (pctile < 70) return null;

  return {
    id: 'ell',
    title: 'Many students are still learning English',
    fact: `${fmtInt(m.record.demo.ell)} students here are learning English. State money for them ends two years after a student passes the English proficiency test, even when new students keep arriving.`,
    visual: {
      kind: 'dots',
      filled: perHundred(m.ellRate),
      label: 'students here',
      compare: perHundred(STATEWIDE.ellRate),
      compareLabel: 'statewide',
    },
    refs: [BILLS.budget],
    severity: 45 + pctile * 0.35,
  };
};

const lowIncomeIssue: Builder = (m) => {
  if (m.lowIncomeRate < 60) return null;
  const pctile = percentileOf(DISTRIBUTIONS.lowIncomeRate, m.lowIncomeRate);
  if (pctile < 72) return null;

  return {
    id: 'lowIncome',
    title: 'Most students come from low-income families',
    /*
      The old wording said the formula counts none of this. It does: the
      Learning Assistance Program is driven by the district's poverty rate, and
      the site's own funding journey draws it as its own band. Claiming
      otherwise is checkable in one click and wrong. The real point survives the
      correction - LAP is small next to what the need costs, and basic education
      itself is not adjusted for poverty at all.
    */
    fact: `${fmtInt(m.record.demo.lowIncome)} students here are low income, which means more counselors, meals and family support. The state sends ${m.lapPerLowIncome == null ? 'only a few hundred dollars' : `about ${fmtMoneyFull(Math.round(m.lapPerLowIncome))}`} per low-income student for that, and the basic education formula behind everything else is not adjusted for poverty at all.`,
    visual: {
      kind: 'dots',
      filled: perHundred(m.lowIncomeRate),
      label: 'students here',
      compare: perHundred(STATEWIDE.lowIncomeRate),
      compareLabel: 'statewide',
    },
    refs: [BILLS.budget, BILLS.review],
    severity: 42 + pctile * 0.32,
  };
};

const enrollmentIssue: Builder = (m) => {
  const change = m.enrollmentChange;
  if (change == null || change > -6) return null;

  const before = BASELINE_FTE[m.code] ?? 0;
  const lost = before - m.record.fundingEnrollment;

  return {
    id: 'enrollmentDecline',
    title: 'Enrollment has fallen',
    fact: `The district has about ${fmtInt(Math.round(lost))} fewer students than in ${BASE_YEAR}. Money follows students, but buildings and bus routes cost the same.`,
    visual: {
      kind: 'trend',
      fromLabel: BASE_YEAR,
      from: before,
      toLabel: LATEST_YEAR,
      to: m.record.fundingEnrollment,
      changeLabel: `${pctText(Math.abs(change), 0)} fewer students`,
    },
    refs: [BILLS.enrollment, BILLS.budget],
    severity: 50 + Math.min(Math.abs(change), 30),
  };
};

const smallScaleIssue: Builder = (m) => {
  if (m.fte >= PROTOTYPES.elementary.proto) return null;
  const pctile = percentileOf(DISTRIBUTIONS.perPupil, m.perPupil);

  return {
    id: 'smallScale',
    title: 'Too small for the state formula',
    fact: `The state funds schools using a pretend 400-student school. This whole district has ${fmtInt(Math.round(m.fte))} students, so it gets a fraction of a nurse and a fraction of a counselor.`,
    visual: {
      kind: 'versus',
      aLabel: 'Students in the state model school',
      a: PROTOTYPES.elementary.proto,
      bLabel: 'Students in this whole district',
      b: Math.round(m.fte),
      gapLabel: 'One nurse costs the same either way',
      format: 'plain',
    },
    refs: [BILLS.review, BILLS.budget],
    severity: 40 + Math.min(pctile * 0.2, 20),
  };
};

const BUILDERS: Builder[] = [
  oversightIssue,
  reservesIssue,
  levyCapIssue,
  noLevyIssue,
  leaIssue,
  spedIssue,
  msocIssue,
  transportationIssue,
  ellIssue,
  lowIncomeIssue,
  enrollmentIssue,
  smallScaleIssue,
];

/* ------------------------------------------------------------------ *
 * Assembling the brief
 * ------------------------------------------------------------------ */

function summaryFor(m: Metrics, issues: Issue[]): string {
  if (issues.length === 0) {
    return `Compared with Washington's other 314 districts, nothing here stands out as unusually bad. That does not mean the schools are well funded - the statewide gaps still apply.`;
  }
  const names = issues.slice(0, 3).map((i) =>
    i.id === 'reserves' ? (RESERVES_SHORT[i.title] ?? ISSUE_SHORT.reserves) : ISSUE_SHORT[i.id]
  );
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return names.length === 1
    ? `Compared with Washington's other 314 districts, the biggest problem here is ${list}.`
    : `Compared with Washington's other 314 districts, the biggest problems here are ${list}.`;
}

// The reserves card has three variants; the summary names the one shown.
const RESERVES_SHORT: Record<string, string> = {
  'The savings are gone': 'a negative fund balance',
  'Savings fell last year': 'falling savings',
  'Spending outran revenue last year': 'spending that outran revenue',
  'Savings are running low': 'thin savings',
};

const ISSUE_SHORT: Record<IssueId, string> = {
  oversight: 'state oversight of the budget',
  reserves: 'spending that outran revenue',
  levyCap: 'the cap on local school taxes',
  noLevy: 'no approved school levy',
  leaDependence: 'not much local property to tax',
  sped: 'special education',
  msoc: 'everyday running costs',
  transportation: 'buses',
  ell: 'students learning English',
  lowIncome: 'student poverty',
  enrollmentDecline: 'falling enrollment',
  smallScale: 'being a very small district',
};

/**
 * One sentence per problem: what to ask a lawmaker for. These only appear on
 * the one-page PDF, where the printed copy is carried to a legislator's
 * office; the web brief leaves them out. Where a 2026 bill addressed the
 * problem it is named, and nothing here invents a bill number.
 */
export const ISSUE_ASKS: Record<IssueId, string> = {
  oversight: 'Fix what caused this. Watching a shortfall does not pay for it.',
  reserves: 'Steady funding every year, not a one-time patch.',
  levyCap: 'Raise the local levy cap. This money needs no new vote.',
  noLevy: 'Fund more of basic education, so losing a levy does not cut what every school needs.',
  leaDependence: 'Protect and raise the money that evens this out.',
  sped: 'Pay what special education actually costs.',
  msoc: `Raise the per-student operating rate. A bill to do it (${BILLS.msoc.bill}) died in 2026.`,
  transportation: `Pay the real cost of hard routes (${BILLS.transportation.bill} would have).`,
  ell: 'Fund these students for more years, at a higher rate.',
  lowIncome: 'Send more money to schools with more student need.',
  enrollmentDecline: `Give districts time to adjust when enrollment falls (${BILLS.enrollment.bill} would have).`,
  smallScale: 'Raise the extra funding small districts get.',
};

/**
 * Whether AESD's MSOC cost carries enough contracted ALE teaching to mention -
 * the same test the Big 3 card uses for its note.
 */
export function aleContractsMaterial(m: Metrics): boolean {
  const ale = m.spend?.msocBig3AleContracts ?? 0;
  return m.big3 != null && ale > 100_000 && ale > 0.05 * m.big3.msoc.cost;
}

function statsFor(m: Metrics): BriefStat[] {
  const stats: BriefStat[] = [
    {
      label: 'Funded students',
      value: fmtInt(Math.round(m.fte)),
      note: `${fmtInt(m.headcount)} enrolled in October`,
    },
    {
      // Rounded to thousands these collapse into the same "$20K" and the
      // comparison the tile exists to make disappears.
      label: 'Revenue per student',
      value: fmtMoneyFull(Math.round(m.perPupil)),
      note: `Statewide median ${fmtMoneyFull(Math.round(MEDIANS.perPupil))}`,
    },
    {
      label: 'Covered locally',
      // The same total the Big 3 card prints: only programs that fall short.
      value: fmtMoney(
        m.big3
          ? big3Totals(m.big3).total
          : Math.max(0, m.spedGap) + Math.max(0, m.msocGap) + Math.max(0, m.transGap)
      ),
      // AESD's total, as on the Big 3 card - which for a few online-ALE
      // districts includes contracted teaching the site leaves out elsewhere.
      note:
        m.big3 && aleContractsMaterial(m)
          ? `AESD figure; includes ${fmtMoney(m.spend?.msocBig3AleContracts ?? 0)} of contracted online (ALE) teaching`
          : 'Special ed, operating and transport costs above their funding',
    },
  ];
  if (m.reserveRatio != null) {
    stats.push({
      label: 'Reserves',
      value: `${m.reserveRatio.toFixed(1)}%`,
      note:
        m.reserveRatio < 0
          ? 'No savings left'
          : m.reserveRatio < RESERVE_THIN_PCT
            ? 'Less than one month of spending'
            : m.reserveRatio < RESERVE_BENCHMARK_PCT
              ? "Below the State Auditor's 60-day benchmark"
              : "Meets the State Auditor's 60-day benchmark",
    });
  }
  return stats;
}

/**
 * Every district gets a brief. Districts with genuinely unremarkable numbers
 * get a short one that says so, rather than a manufactured crisis - a brief
 * that cried wolf for all 315 would be worth nothing in the 40 where the
 * numbers are alarming.
 */
function rankedIssues(m: Metrics): Issue[] {
  return BUILDERS.map((build) => build(m))
    .filter((issue): issue is Issue => issue != null)
    .sort((a, b) => b.severity - a.severity);
}

/**
 * Every problem this district has, most severe first, without the web brief's
 * cut-off at four. The one-page PDF lists the Big 3 on their own and so needs
 * to look past them to the next problems.
 */
export function allIssuesFor(code: string): Issue[] {
  const m = BY_CODE.get(code);
  return m ? rankedIssues(m) : [];
}

export function briefFor(code: string): DistrictBrief | null {
  const m = BY_CODE.get(code);
  if (!m) return null;

  const issues = rankedIssues(m).slice(0, 4);

  return {
    code: m.code,
    name: m.name,
    summary: summaryFor(m, issues),
    stats: statsFor(m),
    issues,
    steadyNote:
      issues.length === 0
        ? 'Nothing here scores as unusually bad for Washington. The statewide picture and what you have seen yourself still make a strong case.'
        : null,
  };
}

export const DIAGNOSIS_YEAR = LATEST_YEAR;
