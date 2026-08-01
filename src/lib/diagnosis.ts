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
import { fmtMoney, fmtMoneyFull, fmtInt } from '@/lib/format';

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
    note: 'Would have added $100 per student for operating costs. Died in committee.',
  },
  transportation: {
    bill: 'SB 5858',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5858&Year=2025',
    note: 'Would have protected busing for the students who cost the most to transport. Died in committee.',
  },
  enrollment: {
    bill: 'SB 6125',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=6125&Year=2025',
    note: 'Would have softened the funding drop when enrollment falls. Died in its first committee.',
  },
  utilities: {
    bill: 'SB 6310',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=6310&Year=2025',
    note: 'Would have changed how utilities and insurance money is handed out. Died in its first committee.',
  },
  buses: {
    bill: 'ESSB 6260',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=6260&Year=2025',
    note: 'Signed April 2026. Made the state pay back the cost of school buses more slowly.',
  },
  budget: {
    bill: 'ESSB 5998',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5998&Year=2025',
    note: 'The 2026 state budget - where an idea actually gets money, or does not.',
  },
  review: {
    bill: 'E2SHB 2636',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=2636&Year=2025',
    note: 'Would have ordered independent reviews of school funding. Passed the House, then stalled.',
  },
} as const;

const LEVY_STATUTE = {
  bill: 'RCW 84.52.0531',
  url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=84.52.0531',
  note: 'The law that caps how much a district may collect from its local school levy.',
} as const;

const LEA_STATUTE = {
  bill: 'RCW 28A.500.015',
  url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.500.015',
  note: 'The law that sets how much the state chips in for districts with low property value.',
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

export type BarTone = 'accent' | 'warn' | 'bad' | 'good' | 'muted';

export type BriefBar = {
  label: string;
  /** Bar length, drawn relative to the largest value in the set. */
  value: number;
  /** Printed at the end of the bar. */
  display: string;
  tone: BarTone;
};

/**
 * The picture that carries the argument.
 *
 * Nearly every funding problem on this site is one of two shapes: two numbers
 * that should match and do not, or a district sitting somewhere on a scale.
 * Both are bars, which is also the only thing the hand-rolled PDF writer can
 * draw. Oversight is the exception - it is a position on a ladder of state
 * involvement, so it gets its own shape.
 */
export type BriefVisual =
  | {
      kind: 'bars';
      /** One short line saying what the bars show. */
      caption: string;
      bars: BriefBar[];
      /** The number the picture exists to make obvious. */
      gap: { label: string; value: string; tone: BarTone } | null;
    }
  | {
      kind: 'steps';
      caption: string;
      steps: string[];
      /** Index of the step this district is on. */
      at: number;
    };

export type Issue = {
  id: IssueId;
  /** Section heading in the brief. Short, plain words. */
  title: string;
  /** One sentence carrying this district's number. */
  headline: string;
  /** The evidence, drawn rather than written. */
  visual: BriefVisual;
  /** One sentence on why the picture matters. */
  plain: string;
  /** What to actually ask a legislator for. */
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
  /** The single sentence that says what is distinctive here. */
  headline: string;
  /** Two or three sentences of framing under the headline. */
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

type Metrics = {
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

function rate(part: number, whole: number): number {
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
    const msocGap = alloc && spend ? spend.msoc - alloc.msoc : 0;
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

/** Share of districts at or below `value`, as 0-100. */
function percentileOf(sorted: number[], value: number): number {
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

function median(sorted: number[]): number {
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

/**
 * "This costs X, the state sends Y, the district pays the rest" - the shape
 * behind special education, operating costs and transportation alike. Drawing
 * it the same way all three times is the point: a reader learns the picture
 * once and then reads the other two at a glance.
 */
function shortfallVisual(
  caption: string,
  cost: number,
  paid: number,
  perPupil: number
): BriefVisual {
  return {
    kind: 'bars',
    caption,
    bars: [
      { label: 'What it costs here', value: cost, display: round(cost), tone: 'accent' },
      { label: 'What the state pays', value: paid, display: round(paid), tone: 'muted' },
    ],
    gap: {
      label: 'The district pays the rest',
      value: `${round(cost - paid)} · ${round(perPupil)} per student`,
      tone: 'bad',
    },
  };
}

/** This district against the statewide number, as two percentage bars. */
function compareToStateVisual(caption: string, here: number, statewide: number): BriefVisual {
  return {
    kind: 'bars',
    caption,
    bars: [
      { label: 'This district', value: here, display: pctText(here, 1), tone: 'accent' },
      { label: 'Washington average', value: statewide, display: pctText(statewide, 1), tone: 'muted' },
    ],
    gap: null,
  };
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

const oversightIssue: Builder = (m) => {
  if (!m.oversight) return null;
  const enhanced = m.oversight.level === 'enhanced';
  return {
    id: 'oversight',
    title: enhanced
      ? 'The state has stepped into this district’s money'
      : 'The state is watching this district’s money',
    headline: enhanced
      ? `${m.name} is under the strictest level of state financial oversight.`
      : `The state has been watching ${m.name}'s budget since ${m.oversight.since}.`,
    visual: {
      kind: 'steps',
      caption: 'How far the state has stepped in:',
      steps: ['Budget balances', 'State sets rules', 'State takes over'],
      at: enhanced ? 2 : 1,
    },
    plain:
      'A district lands here when it cannot make its budget balance (RCW 28A.505.110). The state sets rules and watches - but rules do not pay any bills.',
    ask: `Ask your lawmakers to fix what put ${m.name} in this spot. Watching a shortfall does not fund one.`,
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

  const deficit = materialDeficit;

  /*
    Two different pictures, because two different things are wrong. A district
    that overspent should see money in against money out; one that is merely
    running thin should see its savings against the 5% line. Showing both at
    once would bury whichever one actually applies.
  */
  const visual: BriefVisual = deficit
    ? {
        kind: 'bars',
        caption: `Money in and out, ${LATEST_YEAR}:`,
        bars: [
          {
            label: 'Money coming in',
            value: m.record.rev.total,
            display: round(m.record.rev.total),
            tone: 'muted',
          },
          { label: 'Money going out', value: m.record.exp, display: round(m.record.exp), tone: 'accent' },
        ],
        gap: {
          label: 'Spent more than it got',
          value: `${round(Math.abs(m.surplus))} · ${pctText(deficitShare, 1)} of the budget`,
          tone: 'bad',
        },
      }
    : {
        kind: 'bars',
        caption: 'Savings, as a share of one year of spending:',
        bars: [
          {
            label: 'This district',
            value: Math.max(rr, 0),
            display: pctText(rr, 1),
            tone: rr < 5 ? 'bad' : 'accent',
          },
          { label: 'Safe level', value: 5, display: '5.0%', tone: 'good' },
          {
            label: 'Typical district',
            value: Math.max(MEDIANS.reserveRatio, 0),
            display: pctText(MEDIANS.reserveRatio, 1),
            tone: 'muted',
          },
        ],
        gap: null,
      };

  return {
    id: 'reserves',
    title: deficit ? 'The budget does not balance' : 'Savings are nearly gone',
    headline: deficit
      ? `${m.name} spent ${round(Math.abs(m.surplus))} more than it took in.`
      : `${m.name} has ${pctText(rr, 1)} of a year's spending saved up.`,
    visual,
    plain:
      rr < 0
        ? 'Savings are what a district uses when something goes wrong mid-year. This one has none left, and owes money on top of that.'
        : 'Savings are what a district uses when something goes wrong mid-year. With this little, one surprise means cuts in the middle of the school year.',
    ask: 'Ask for money the district can count on every year. One-time funding delays the cuts; it does not stop them.',
    refs: [BILLS.budget, BILLS.enrollment],
    severity: rr < 0 ? 90 : deficit && thinReserves ? 78 : deficit ? 68 : 60,
  };
};

const levyCapIssue: Builder = (m) => {
  if (!m.levy || m.capBlocked <= 0) return null;
  const cap = LARGE_DISTRICTS.has(m.code)
    ? LEA.maxLevyPerPupilLarge
    : LEA.maxLevyPerPupil;
  const pctile = percentileOf(DISTRIBUTIONS.capBlockedPerPupil, m.capBlockedPerPupil);
  const allowed = m.levy.levy - m.capBlocked;

  return {
    id: 'levyCap',
    title: 'A state limit blocks money voters already approved',
    headline: `${m.name} is not allowed to collect ${round(m.capBlocked)} its own voters said yes to.`,
    visual: {
      kind: 'bars',
      caption: `Local school levy, ${levyJson.levyYear}:`,
      bars: [
        { label: 'Voters approved', value: m.levy.levy, display: round(m.levy.levy), tone: 'accent' },
        { label: 'The state allows', value: allowed, display: round(allowed), tone: 'muted' },
      ],
      gap: {
        label: 'Blocked by the state limit',
        value: `${round(m.capBlocked)} · ${round(m.capBlockedPerPupil)} per student`,
        tone: 'bad',
      },
    },
    plain: `State law caps this levy at ${round(cap)} per student${
      LARGE_DISTRICTS.has(m.code) ? ' for districts this large' : ''
    }. The community already voted for the money; only the cap is in the way. 45 other districts are stuck the same way.`,
    ask: `Ask your lawmakers to raise the levy cap in RCW 84.52.0531. For ${m.name} that is ${round(m.capBlocked)} a year, with no new vote needed.`,
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

  /*
    Property value per student is the cause; the equalization share is the
    symptom. Show the cause - it is the number that explains why this district
    cannot simply tax its way out, and it compares cleanly to the median.
  */
  const visual: BriefVisual =
    m.avPerPupil != null
      ? {
          kind: 'bars',
          caption: 'Property value behind each student:',
          bars: [
            {
              label: 'This district',
              value: m.avPerPupil,
              display: round(m.avPerPupil),
              tone: 'accent',
            },
            {
              label: 'Typical district',
              value: MEDIANS.avPerPupil,
              display: round(MEDIANS.avPerPupil),
              tone: 'muted',
            },
          ],
          gap: {
            label: 'State help to make up the difference',
            value: `${round(m.alloc.levyEqualization)} · ${pctText(m.leaShare, 1)} of its state money`,
            tone: 'warn',
          },
        }
      : {
          kind: 'bars',
          caption: 'Where this district’s state money comes from:',
          bars: [
            {
              label: 'Help for low property value',
              value: m.leaShare,
              display: pctText(m.leaShare, 1),
              tone: 'warn',
            },
            {
              label: 'Everything else',
              value: 100 - m.leaShare,
              display: pctText(100 - m.leaShare, 1),
              tone: 'muted',
            },
          ],
          gap: null,
        };

  const forgone =
    m.leaForgone > 1000 && m.levy
      ? ` It also leaves ${round(m.leaForgone)} of that help unclaimed: full payment requires taxing at $${LEA.leaMaxRate.toFixed(2)} per $1,000, and this district taxes at $${m.levy.levyRate.toFixed(2)}.`
      : '';

  return {
    id: 'leaDependence',
    title: 'There is not much local property to tax here',
    headline: `${pctText(m.leaShare, 1)} of ${m.name}'s state money is help for having low property value.`,
    visual,
    plain: `Schools run on local property taxes, so the same tax rate raises far less here than in a wealthy district. The state pays the difference, and resets that amount every two years.${forgone}`,
    ask: 'Ask your lawmakers to raise this help and protect it in the budget. It is one of the first things cut when money is tight, and it hits these districts hardest.',
    refs: [LEA_STATUTE, BILLS.budget],
    severity: 55 + pctile * 0.25,
  };
};

const spedIssue: Builder = (m) => {
  if (!m.alloc || !m.spend || m.spedGapPerPupil < 300) return null;
  const pctile = percentileOf(DISTRIBUTIONS.spedGapPerPupil, m.spedGapPerPupil);
  if (pctile < 55) return null;

  /*
    Identification rate cuts both ways, so it has to be framed against the
    district's own number. A district serving more students than average has
    an obvious explanation for its gap; a district serving fewer and still
    running a large gap is making the stronger point, not a weaker one - the
    shortfall is in the rate the state pays, not the caseload. Stating the
    percentage flatly, as if it always argued the same way, reads as a
    rebuttal in exactly the districts where it is most damning.
  */
  const belowAverageRate = m.spedRate < STATEWIDE.spedRate;
  const rateNote = belowAverageRate
    ? ` And not because this district finds more students than most - it finds fewer (${pctText(m.spedRate, 1)} against ${pctText(STATEWIDE.spedRate, 1)}). The state just pays too little each.`
    : '';

  return {
    id: 'sped',
    title: 'Special education costs more than the state pays',
    headline: `${m.name} pays ${round(m.spedGap)} of its special education bill by itself.`,
    visual: shortfallVisual(
      'Special education, one year:',
      m.spend.sped,
      m.alloc.specialEd,
      m.spedGapPerPupil
    ),
    plain: `There is no special pot for that. It comes out of the budget for every other student - ${round(m.spedGapPerPupil)} each, against ${round(MEDIANS.spedGapPerPupil)} in a typical district.${rateNote}`,
    ask: 'Ask your lawmakers to pay a higher rate for special education, and to fully cover the students whose needs cost the most. This is something schools are required by law to provide.',
    refs: [BILLS.budget],
    severity: 50 + pctile * 0.4,
  };
};

const msocIssue: Builder = (m) => {
  if (!m.alloc || !m.spend || m.msocGapPerPupil < 250) return null;
  const pctile = percentileOf(DISTRIBUTIONS.msocGapPerPupil, m.msocGapPerPupil);
  if (pctile < 55) return null;

  // What SSB 5918 would have delivered here: $100/student, floor of $100,000.
  const wouldHaveBeen = Math.max(100 * m.fte, 100_000);

  return {
    id: 'msoc',
    title: 'Keeping the lights on costs more than the state pays',
    headline: `${m.name} pays ${round(m.msocGap)} of its running costs by itself.`,
    visual: shortfallVisual(
      'Heat, power, supplies, computers, textbooks:',
      m.spend.msoc,
      m.alloc.msoc,
      m.msocGapPerPupil
    ),
    plain: `The state pays the same amount per student everywhere. But heating an old building does not get cheaper because fewer students walk through the door. ${BILLS.msoc.bill} would have added about ${round(wouldHaveBeen)} here, and died in committee.`,
    ask: `Ask your lawmakers to raise this funding and bring back the increase in ${BILLS.msoc.bill}. These are the costs nobody notices until something a student uses stops working.`,
    refs: [BILLS.msoc, BILLS.utilities],
    severity: 48 + pctile * 0.4,
  };
};

const transportationIssue: Builder = (m) => {
  if (!m.alloc || !m.spend || m.transGapPerPupil < 120) return null;
  const pctile = percentileOf(DISTRIBUTIONS.transGapPerPupil, m.transGapPerPupil);
  if (pctile < 70) return null;

  return {
    id: 'transportation',
    title: 'Getting students to school costs more than the state pays',
    headline: `${m.name} pays ${round(m.transGap)} of its busing bill by itself.`,
    visual: shortfallVisual(
      'Buses and getting students to school:',
      m.spend.transportation,
      m.alloc.transportation,
      m.transGapPerPupil
    ),
    plain: `Busing costs depend on how far apart students live, not on how many there are. The priciest routes carry students with disabilities or without stable housing. ${BILLS.transportation.bill} would have protected those routes, and died in committee.`,
    ask: `Ask your lawmakers to pass the busing protections in ${BILLS.transportation.bill}, and to undo the slower bus payback schedule in ${BILLS.buses.bill}.`,
    refs: [BILLS.transportation, BILLS.buses],
    severity: 45 + pctile * 0.35,
  };
};

const ellIssue: Builder = (m) => {
  if (m.ellRate < 12) return null;
  const pctile = percentileOf(DISTRIBUTIONS.ellRate, m.ellRate);
  if (pctile < 70) return null;

  const stateAdds =
    m.bilingualPerEll != null
      ? ` The state adds ${round(m.bilingualPerEll)} a year for each of them.`
      : '';

  return {
    id: 'ell',
    title: 'Many students are still learning English',
    headline: `${fmtInt(m.record.demo.ell)} students here - ${pctText(m.ellRate, 1)} - are learning English.`,
    visual: compareToStateVisual(
      'Share of students learning English:',
      m.ellRate,
      STATEWIDE.ellRate
    ),
    plain: `They are learning English while also learning math, science and everything else. That takes trained teachers and interpreters for families.${stateAdds} The money stops the day a student passes an English test - so a district where new students keep arriving runs a permanent program on temporary money.`,
    ask: 'Ask your lawmakers to pay this for more years and at a higher rate, especially in districts where new students keep arriving.',
    refs: [BILLS.budget],
    severity: 45 + pctile * 0.35,
  };
};

const lowIncomeIssue: Builder = (m) => {
  if (m.lowIncomeRate < 60) return null;
  const pctile = percentileOf(DISTRIBUTIONS.lowIncomeRate, m.lowIncomeRate);
  if (pctile < 72) return null;

  const extraHelp =
    m.lapPerLowIncome != null
      ? ` The state's extra help works out to ${round(m.lapPerLowIncome)} per student.`
      : '';
  const homeless =
    m.homelessRate >= 3
      ? ` ${fmtInt(m.record.demo.homeless)} students here - ${pctText(m.homelessRate, 1)} - do not have stable housing.`
      : '';

  return {
    id: 'lowIncome',
    title: 'Many students here come from low-income homes',
    headline: `${pctText(m.lowIncomeRate, 1)} of ${m.name}'s students come from low-income homes.`,
    visual: compareToStateVisual(
      'Share of students from low-income homes:',
      m.lowIncomeRate,
      STATEWIDE.lowIncomeRate
    ),
    plain: `The same result costs more here: more counselors, more meals, more summer and after-school programs.${extraHelp}${homeless} The state's formula pays for a school, not for what the students in it need.`,
    ask: 'Ask your lawmakers to raise this extra help, and to build student poverty into the main funding formula instead of treating it as an add-on.',
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
    title: 'Students are leaving, and the money leaves with them',
    headline: `${m.name} has ${pctText(Math.abs(change), 1)} fewer students than in ${BASE_YEAR}.`,
    visual: {
      kind: 'bars',
      caption: 'Students the district is funded for:',
      bars: [
        { label: BASE_YEAR, value: before, display: fmtInt(Math.round(before)), tone: 'muted' },
        {
          label: LATEST_YEAR,
          value: m.record.fundingEnrollment,
          display: fmtInt(Math.round(m.record.fundingEnrollment)),
          tone: 'accent',
        },
      ],
      gap: {
        label: 'Students lost',
        value: `${fmtInt(Math.round(lost))} · about ${round(lost * m.perPupil)} a year`,
        tone: 'bad',
      },
    },
    plain: `Almost all state money follows students, so the money left immediately. Costs did not: the district does not have fewer buildings to heat or bus routes to run. ${BILLS.enrollment.bill} would have softened the drop, and died in its first committee.`,
    ask: `Ask your lawmakers to bring back the funding in ${BILLS.enrollment.bill}, so a district gets time to adjust instead of cutting mid-year.`,
    refs: [BILLS.enrollment, BILLS.budget],
    severity: 50 + Math.min(Math.abs(change), 30),
  };
};

const smallScaleIssue: Builder = (m) => {
  if (m.fte >= 400) return null;
  const pctile = percentileOf(DISTRIBUTIONS.perPupil, m.perPupil);

  return {
    id: 'smallScale',
    title: 'The district is smaller than the formula assumes',
    headline: `${m.name} funds ${fmtInt(Math.round(m.fte))} students. The state's formula is built around 400.`,
    visual: {
      kind: 'bars',
      caption: 'Students, real and assumed:',
      bars: [
        {
          label: 'Students here',
          value: m.fte,
          display: fmtInt(Math.round(m.fte)),
          tone: 'accent',
        },
        {
          label: 'The smallest school the state plans for',
          value: 400,
          display: '400',
          tone: 'muted',
        },
      ],
      gap: null,
    },
    plain: `The state hands out staff by splitting students into imaginary 400-student schools, so a district this size gets a fraction of a nurse - a job a school needs whole. A principal costs the same for 90 students as for 900, which is why money per student looks high here (${round(m.perPupil)} against ${round(MEDIANS.perPupil)}).`,
    ask: 'Ask your lawmakers to review the extra funding for small and remote districts. It is a fixed amount, and inflation has been eating it for years.',
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
  reserves: 'leaves our district unable to balance its budget',
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

/** Phrased to complete the sentence "I'm asking you to ...". */
const EMAIL_ASKS: Record<IssueId, string> = {
  oversight:
    'address the funding gaps that pushed our district into state financial oversight, rather than treating the oversight itself as the fix',
  reserves:
    'provide the recurring revenue our district needs to balance its budget, not another one-time budget proviso',
  levyCap:
    'raise the per-student enrichment levy cap in RCW 84.52.0531, so our district can collect the levy our own voters already approved',
  leaDependence:
    'raise the Local Effort Assistance threshold and protect levy equalization in the operating budget',
  sped: 'raise the special education funding multipliers and fully fund the high-cost safety net',
  msoc: 'increase the MSOC allocation and revive the per-student operating-cost increase that died in SSB 5918',
  transportation:
    'enact the transportation safety net from SB 5858 and revisit the bus depreciation schedule',
  ell: 'extend the years a student generates bilingual funding and raise the per-student rate',
  lowIncome:
    'increase Learning Assistance Program funding and weight the basic education formula by student poverty',
  enrollmentDecline:
    'revive the enrollment stabilization funding that died in SB 6125',
  smallScale:
    'review the small-district and remote-and-necessary funding enhancements, which have not kept pace with costs',
};

function headlineFor(m: Metrics, issues: Issue[]): string {
  if (issues.length === 0) {
    return `${m.name} sits near the middle of Washington's districts.`;
  }
  return issues[0].headline;
}

function summaryFor(m: Metrics, issues: Issue[]): string {
  if (issues.length === 0) {
    return `That is not the same as being well funded - the statewide gaps still apply here. They are just not worse here than anywhere else.`;
  }
  const names = issues.slice(0, 3).map((i) => ISSUE_SHORT[i.id]);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Compared with the other 314 districts in Washington, the biggest problems here are ${list}. Each one below is one picture, one number, and one thing to ask for.`;
}

const ISSUE_SHORT: Record<IssueId, string> = {
  oversight: 'state oversight',
  reserves: 'a budget that does not balance',
  levyCap: 'a blocked local levy',
  leaDependence: 'low local property value',
  sped: 'special education',
  msoc: 'running costs',
  transportation: 'busing',
  ell: 'students learning English',
  lowIncome: 'student poverty',
  enrollmentDecline: 'falling enrollment',
  smallScale: 'being a small district',
};

function statsFor(m: Metrics): BriefStat[] {
  const stats: BriefStat[] = [
    {
      label: 'Students',
      value: fmtInt(Math.round(m.fte)),
      note: `${fmtInt(m.headcount)} counted in October`,
    },
    {
      // Rounded to thousands these collapse into the same "$20K" and the
      // comparison the tile exists to make disappears.
      label: 'Money per student',
      value: fmtMoneyFull(Math.round(m.perPupil)),
      note: `Typical district: ${fmtMoneyFull(Math.round(MEDIANS.perPupil))}`,
    },
    {
      label: 'Paid for by the district',
      value: fmtMoney(Math.max(0, m.spedGap) + Math.max(0, m.msocGap) + Math.max(0, m.transGap)),
      note: 'Special education, running costs and busing the state did not cover',
    },
  ];
  if (m.reserveRatio != null) {
    stats.push({
      label: 'Savings',
      value: `${m.reserveRatio.toFixed(1)}%`,
      note: m.reserveRatio < 5 ? 'Below the 5% safe level' : 'Of one year of spending',
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
    headline: headlineFor(m, issues),
    summary: summaryFor(m, issues),
    stats: statsFor(m),
    issues,
    emailIssue,
    emailAsk,
    emailFact: top ? top.headline : null,
    steadyNote:
      issues.length === 0
        ? 'Nothing here stands out sharply enough to single out. The email and testimony templates below still work - use the statewide picture and your own experience.'
        : null,
  };
}

export const DIAGNOSIS_YEAR = LATEST_YEAR;
export const LEVY_YEAR = levyJson.levyYear;
