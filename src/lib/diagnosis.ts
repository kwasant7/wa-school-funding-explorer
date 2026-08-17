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
import { PROTOTYPES } from '@/lib/prototypical-model';

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
 * (the levy cap, the special education multiplier), the ask points at the
 * statute or the budget instead.
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
  note: 'The statute that sets the per-student enrichment levy cap and the higher limit for districts above 40,000 students.',
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
  /** One sentence: what to ask a lawmaker for. */
  ask: string;
  /** Real bills or statutes attached to that ask. */
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
  /** Short phrase for the email template's issue placeholder. */
  emailIssue: string;
  /** Phrased to follow "I'm asking you to ...". */
  emailAsk: string;
  /** The one hard number worth putting in a letter. */
  emailFact: string | null;
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

    const spedGap = alloc && spend ? spend.sped - alloc.specialEd : 0;
    // MSOC uses the Big-3 scope (OSPI's 2026 budget-request definition, the
    // same one AESD's dashboard publishes) rather than the GenEd-only pair,
    // so the gap quoted to a legislator matches the number their staff can
    // look up. The GenEd-only fields still exist for the formula walkthrough.
    const msocGap = alloc && spend ? spend.msocBig3 - alloc.msocBig3 : 0;
    const transGap = alloc && spend ? spend.transportation - alloc.transportation : 0;

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
      : `${m.name} could not pass a balanced budget, so the state stepped in. That started in ${m.oversight.since}.`,
    visual: {
      kind: 'steps',
      steps: ['Healthy', 'Warning', 'State steps in', 'State takes over'],
      current: enhanced ? 3 : 2,
    },
    response: m.oversight.response,
    ask: 'Ask lawmakers to fix what caused this. Watching a shortfall does not pay for it.',
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
  const deficitShare = m.record.exp > 0 ? (100 * -m.surplus) / m.record.exp : 0;
  const materialDeficit = deficitShare >= 1;
  const thinReserves = rr < 5;
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
        ? 'Spending outran revenue last year'
        : 'Savings are running low',
    fact: negativeBalance
      ? `${m.name} ended ${LATEST_YEAR} with a negative fund balance - it has spent its savings and is carrying a shortfall forward.`
      : materialDeficit
        ? `${m.name} spent ${plainMoney(Math.abs(m.surplus))} more than it took in last year, covering the difference out of savings.`
        : `${m.name} has enough savings to cover only ${pctText(rr, 1)} of a year of spending.`,
    visual: {
      kind: 'gauge',
      value: rr,
      safe: 5,
      label: 'Savings here',
      safeLabel: 'This site flags below 5%',
    },
    ask: 'Ask lawmakers for steady funding every year, not a one-time patch.',
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

  return {
    id: 'levyCap',
    title: 'Voters said yes. State law says no.',
    fact: `People here voted to pay ${plainMoney(m.levy.levy)} in school taxes. State law blocks ${plainMoney(fig.gap)} of it.`,
    visual: fig.visual,
    ask: 'Ask lawmakers to raise the levy cap. This money needs no new vote.',
    refs: [LEVY_STATUTE],
    // A cap that blocks a lot per student matters more than one blocking a
    // rounding error, but any blocked money is a strong, concrete ask.
    severity: 70 + pctile * 0.18,
  };
};

const leaIssue: Builder = (m) => {
  if (!m.alloc || m.leaShare < 2) return null;
  const pctile = percentileOf(DISTRIBUTIONS.leaShare, m.leaShare);
  if (pctile < 70) return null;
  if (m.avPerPupil == null) return null;

  return {
    id: 'leaDependence',
    title: 'There is not much local property to tax',
    fact: `A school tax here raises far less than the same tax in a richer district, so the state sends ${plainMoney(m.alloc.levyEqualization)} to help close the gap.`,
    visual: {
      kind: 'versus',
      aLabel: 'Property value per student, typical district',
      a: MEDIANS.avPerPupil,
      bLabel: 'Property value per student here',
      b: m.avPerPupil,
      gapLabel: `${Math.round((100 * m.avPerPupil) / MEDIANS.avPerPupil)}% of typical`,
      format: 'money',
    },
    ask: 'Ask lawmakers to protect and raise the money that evens this out.',
    refs: [LEA_STATUTE, BILLS.budget],
    severity: 55 + pctile * 0.25,
  };
};

const spedIssue: Builder = (m) => {
  if (!m.alloc || !m.spend || m.spedGapPerPupil < 300) return null;
  const pctile = percentileOf(DISTRIBUTIONS.spedGapPerPupil, m.spedGapPerPupil);
  if (pctile < 55) return null;

  const fig = shortfall(
    'What it really costs',
    m.spend.sped,
    'What the state pays',
    m.alloc.specialEd,
    (gap) => `${gap} short`,
  );

  return {
    id: 'sped',
    title: 'Special education is underfunded',
    /*
      Both figures are state-funded special education only. Federal IDEA money
      pays for its own programs and is excluded from each side, so the gap is
      genuinely what the district covers out of money meant for all students -
      it used to include federally funded spending on the cost side, which
      overstated it by $254M statewide and called federal grants district money.
    */
    fact: `The district pays the missing ${plainMoney(fig.gap)} out of regular school money - about ${round(m.spedGapPerPupil)} taken from every student. Federally funded services are left out of both figures.`,
    visual: fig.visual,
    ask: 'Ask lawmakers to pay what special education actually costs.',
    refs: [BILLS.budget, BILLS.spedIncrease],
    severity: 50 + pctile * 0.4,
  };
};

const msocIssue: Builder = (m) => {
  if (!m.alloc || !m.spend || m.msocGapPerPupil < 250) return null;
  const pctile = percentileOf(DISTRIBUTIONS.msocGapPerPupil, m.msocGapPerPupil);
  if (pctile < 55) return null;

  const fig = shortfall(
    'What it really costs',
    m.spend.msocBig3,
    'What the state pays',
    m.alloc.msocBig3,
    (gap) => `${gap} short`,
  );

  return {
    id: 'msoc',
    title: 'Everyday running costs are underfunded',
    fact: `Heat, power, insurance, supplies and computers cost ${plainMoney(fig.gap)} more than the state sends for them.`,
    visual: fig.visual,
    ask: `Ask lawmakers to raise this rate. A bill to do it (${BILLS.msoc.bill}) died in 2026.`,
    refs: [BILLS.msoc, BILLS.utilities],
    severity: 48 + pctile * 0.4,
  };
};

const transportationIssue: Builder = (m) => {
  if (!m.alloc || !m.spend || m.transGapPerPupil < 120) return null;
  const pctile = percentileOf(DISTRIBUTIONS.transGapPerPupil, m.transGapPerPupil);
  if (pctile < 70) return null;

  const fig = shortfall(
    'What it really costs',
    m.spend.transportation,
    'What the state pays',
    m.alloc.transportation,
    (gap) => `${gap} short`,
  );

  return {
    id: 'transportation',
    title: 'Getting students to school costs more than the state pays',
    fact: `Buses and routes cost ${plainMoney(fig.gap)} more here than the state sends for them.`,
    visual: fig.visual,
    ask: `Ask lawmakers to pay the real cost of hard routes (${BILLS.transportation.bill} would have).`,
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
    fact: `${fmtInt(m.record.demo.ell)} students here are learning English. State money for them stops once a student passes a test, even when new students keep arriving.`,
    visual: {
      kind: 'dots',
      filled: perHundred(m.ellRate),
      label: 'students here',
      compare: perHundred(STATEWIDE.ellRate),
      compareLabel: 'statewide',
    },
    ask: 'Ask lawmakers to fund these students for more years, at a higher rate.',
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
    ask: 'Ask lawmakers to send more money to schools with more student need.',
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
    title: 'Fewer students every year',
    fact: `The district has about ${fmtInt(Math.round(lost))} fewer students than in ${BASE_YEAR}. Money follows students, but buildings and bus routes cost the same.`,
    visual: {
      kind: 'trend',
      fromLabel: BASE_YEAR,
      from: before,
      toLabel: LATEST_YEAR,
      to: m.record.fundingEnrollment,
      changeLabel: `${pctText(Math.abs(change), 0)} fewer students`,
    },
    ask: `Ask lawmakers for time to adjust (${BILLS.enrollment.bill} would have given it).`,
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
    ask: 'Ask lawmakers to raise the extra funding small districts get.',
    refs: [BILLS.review, BILLS.budget],
    severity: 40 + Math.min(pctile * 0.2, 20),
  };
};

const BUILDERS: Builder[] = [
  oversightIssue,
  reservesIssue,
  levyCapIssue,
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

/**
 * The short phrase each issue contributes to the email template. Every one of
 * these has to complete the sentence "Washington's funding formula currently
 * ...", so they stay in the present tense.
 */
const EMAIL_PHRASES: Record<IssueId, string> = {
  oversight: 'leaves our district under state financial oversight',
  reserves: 'has forced our district to spend down its reserves to cover last year’s costs',
  levyCap: 'blocks our district from collecting a levy our voters already approved',
  leaDependence: 'under-equalizes districts without much local property wealth',
  sped: 'does not cover what special education actually costs',
  msoc: 'has not kept operating-cost funding level with what districts spend',
  transportation: 'leaves a transportation gap our district pays for itself',
  ell: 'funds multilingual learners for too few years and at too low a rate',
  lowIncome: 'barely adjusts for concentrated student poverty',
  enrollmentDecline: 'cuts funding faster than a declining district can cut costs',
  smallScale: 'assumes a school much larger than ours',
};

/**
 * Phrased to complete the sentence "I'm asking you to ...".
 *
 * Each names a mechanism - a bill, a statute, a rate - and then says what it
 * would buy, because a legislator's office sorts mail by what is being asked
 * for. "Increase special education funding" is a sentiment and gets tallied;
 * "raise the multipliers so special education stops being paid for out of
 * every other student's classroom" is a request with a reason attached, and
 * the reason is the part a staffer can repeat to the member.
 */
const EMAIL_ASKS: Record<IssueId, string> = {
  oversight:
    'address the funding gaps that pushed our district into state financial oversight, rather than treating the oversight itself as the fix',
  reserves:
    'provide the recurring revenue our district needs to balance its budget, not another one-time budget proviso',
  levyCap:
    'raise the per-student enrichment levy cap in RCW 84.52.0531, so our district can collect the levy our own voters already approved',
  leaDependence:
    'raise the Local Effort Assistance threshold and protect levy equalization in the operating budget, so a district’s property wealth stops deciding what its students get',
  sped: 'raise the special education funding multipliers and fully fund the high-cost safety net, so special education stops being paid for out of every other student’s classroom',
  msoc: 'increase the MSOC allocation and revive the per-student operating-cost increase that died in SSB 5918, so heat and power stop competing with staffing',
  transportation:
    'bring back the transportation safety net proposed in SB 5858 and address the outdated bus depreciation schedule, so districts like ours are not forced to cover these gaps locally',
  ell: 'extend the years a student generates bilingual funding and raise the per-student rate, so the money follows students for as long as they are actually learning English',
  lowIncome:
    'increase Learning Assistance Program funding and weight the basic education formula by student poverty, so the schools serving the most students in poverty are funded for it',
  enrollmentDecline:
    'revive the enrollment stabilization funding that died in SB 6125, so a district losing students is not cutting teachers faster than it can close buildings',
  smallScale:
    'review the small-district and remote-and-necessary funding enhancements, which have not kept pace with costs, so a small district is not funded as though it were the size the formula imagines',
};

function summaryFor(m: Metrics, issues: Issue[]): string {
  if (issues.length === 0) {
    return `Compared with Washington's other 314 districts, nothing here stands out as unusually bad. That does not mean the schools are well funded - the statewide gaps still apply.`;
  }
  const names = issues.slice(0, 3).map((i) => ISSUE_SHORT[i.id]);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Compared with Washington's other 314 districts, the biggest problems here are ${list}.`;
}

const ISSUE_SHORT: Record<IssueId, string> = {
  oversight: 'state oversight of the budget',
  reserves: 'a budget that does not balance',
  levyCap: 'the cap on local school taxes',
  leaDependence: 'not much local property to tax',
  sped: 'special education',
  msoc: 'everyday running costs',
  transportation: 'buses',
  ell: 'students learning English',
  lowIncome: 'student poverty',
  enrollmentDecline: 'falling enrollment',
  smallScale: 'being a very small district',
};

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
      value: fmtMoney(Math.max(0, m.spedGap) + Math.max(0, m.msocGap) + Math.max(0, m.transGap)),
      note: 'Special ed, operating and transport costs above what the state allocated',
    },
  ];
  if (m.reserveRatio != null) {
    stats.push({
      label: 'Reserves',
      value: `${m.reserveRatio.toFixed(1)}%`,
      note: m.reserveRatio < 5 ? 'Below the 5% danger line' : 'Share of annual spending',
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
export function briefFor(code: string): DistrictBrief | null {
  const m = BY_CODE.get(code);
  if (!m) return null;

  const issues = BUILDERS.map((build) => build(m))
    .filter((issue): issue is Issue => issue != null)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 4);

  const top = issues[0] ?? null;
  const emailIssue = top
    ? EMAIL_PHRASES[top.id]
    : 'does not cover what special education actually costs';
  const emailAsk = top
    ? EMAIL_ASKS[top.id]
    : 'raise the special education funding multipliers and fully fund the high-cost safety net';

  return {
    code: m.code,
    name: m.name,
    summary: summaryFor(m, issues),
    stats: statsFor(m),
    issues,
    emailIssue,
    emailAsk,
    emailFact: top ? top.fact : null,
    steadyNote:
      issues.length === 0
        ? 'Nothing here scores as unusually bad for Washington. The email and testimony templates below still work - use the statewide picture and what you have seen yourself.'
        : null,
  };
}

export const DIAGNOSIS_YEAR = LATEST_YEAR;
