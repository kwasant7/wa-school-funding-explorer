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

export type Issue = {
  id: IssueId;
  /** Section heading in the brief. */
  title: string;
  /** One line carrying this district's number. */
  headline: string;
  /** The evidence, one fact per line. */
  bullets: string[];
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
      ? 'The state has stepped into this district’s finances'
      : 'This district is under state financial oversight',
    headline: enhanced
      ? `${m.name} has escalated past binding conditions into enhanced state oversight.`
      : `${m.name} has been on OSPI binding conditions since ${m.oversight.since}.`,
    bullets: [
      m.oversight.detail,
      'Binding conditions are what a district gets when it cannot produce a balanced budget: state-set fund balance targets, more frequent reporting, and regular meetings with OSPI (RCW 28A.505.110).',
      enhanced
        ? 'Two consecutive years on binding conditions, or a financial plan OSPI rejects, escalates to a Financial Oversight Committee and can end in a state-appointed special administrator.'
        : 'A second consecutive year, or a plan OSPI rejects, escalates to a Financial Oversight Committee and then to enhanced oversight.',
      'This is the sharpest public signal that a district is in trouble, and it is a symptom - the funding gaps below are what produced it.',
    ],
    ask: `Ask your legislators what the state is doing about the conditions that put ${m.name} under oversight, not just the oversight itself. Oversight manages a deficit; it does not fund one.`,
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
  const bullets: string[] = [];
  if (rr < 0) {
    bullets.push(
      `${m.name} ended ${LATEST_YEAR} with a negative fund balance of ${round(m.record.fundBalance ?? 0)} - it has spent its savings and is carrying a shortfall forward.`
    );
  } else {
    bullets.push(
      `Reserves are ${pctText(rr, 1)} of annual spending, against a statewide median of ${pctText(MEDIANS.reserveRatio, 1)}. Most district finance policies treat anything under 5% as the danger zone.`
    );
  }
  if (deficit) {
    bullets.push(
      `The district spent ${round(Math.abs(m.surplus))} more than it took in during ${LATEST_YEAR} - ${pctText(deficitShare, 1)} of its budget (${round(m.record.rev.total)} in, ${round(m.record.exp)} out).`
    );
  }
  bullets.push(
    'Thin reserves mean a single bad enrollment count, a failed levy, or an unbudgeted special education placement forces mid-year cuts rather than a planned response.'
  );

  return {
    id: 'reserves',
    title: deficit ? 'The budget does not balance' : 'Reserves are close to the line',
    headline: deficit
      ? `${m.name} spent ${round(Math.abs(m.surplus))} more than it received in ${LATEST_YEAR}.`
      : `${m.name} is operating on reserves of ${pctText(rr, 1)} of annual spending.`,
    bullets,
    ask: 'Ask for the recurring revenue that closes a structural deficit. One-time budget provisos delay the cuts; they do not stop them.',
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

  return {
    id: 'levyCap',
    title: 'The state blocks money local voters already approved',
    headline: `${m.name} cannot collect ${round(m.capBlocked)} of the levy its own voters passed.`,
    bullets: [
      `Voters approved a ${round(m.levy.levy)} enrichment levy for ${levyJson.levyYear}. State law caps what the district may actually collect, and ${round(m.capBlocked)} of that falls above the cap - ${round(m.capBlockedPerPupil)} per student.`,
      `The cap is ${round(cap)} per student${LARGE_DISTRICTS.has(m.code) ? ' for districts above 40,000 students' : ''}, or $${LEA.maxLevyRate.toFixed(2)} per $1,000 of assessed value, whichever is lower.`,
      'No new election is needed to unlock this. The community has already voted for it; only the statutory ceiling stands in the way.',
      `${m.name} is one of 46 districts in this position.`,
    ],
    ask: `Ask your legislators to raise the per-student enrichment levy cap in RCW 84.52.0531. For ${m.name} that is ${round(m.capBlocked)} a year with no new tax vote required.`,
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

  const bullets: string[] = [
    `Levy equalization is ${round(m.alloc.levyEqualization)}, or ${pctText(m.leaShare, 1)} of all the state money ${m.name} receives. The state pays it because local property cannot raise what a wealthier district's can.`,
  ];
  if (m.avPerPupil != null) {
    const avPctile = percentileOf(DISTRIBUTIONS.avPerPupil, m.avPerPupil);
    bullets.push(
      `Assessed property value behind each student is ${round(m.avPerPupil)}, against a statewide median of ${round(MEDIANS.avPerPupil)} - lower than ${pctText(100 - avPctile)} of Washington districts. The same levy rate raises very different money depending on that number, which is the whole reason equalization exists.`
    );
  }
  if (m.leaForgone > 1000 && m.levy) {
    bullets.push(
      `The district qualifies for ${round(m.levy.maxLea)} but is paid ${round(m.levy.payableLea)}, because equalization is prorated by local levy effort and this district levies $${m.levy.levyRate.toFixed(2)} per $1,000 against the $${LEA.leaMaxRate.toFixed(2)} needed for the full amount. That is ${round(m.leaForgone)} left on the table.`
    );
  }
  bullets.push(
    'Equalization is set by a threshold the Legislature picks each biennium. When the threshold does not keep up with property values, property-poor districts fall further behind without anything visibly changing.'
  );

  return {
    id: 'leaDependence',
    title: 'This district depends on the state to make up for local property wealth',
    headline: `${pctText(m.leaShare, 1)} of ${m.name}'s state funding is levy equalization.`,
    bullets,
    ask: 'Ask your legislators to raise the Local Effort Assistance threshold and to protect equalization in the operating budget. It is one of the first lines squeezed when the budget tightens, and it lands hardest on districts with the least local property to tax.',
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
  const rateBullet = belowAverageRate
    ? `${pctText(m.spedRate, 1)} of students here receive special education services - below the ${pctText(STATEWIDE.spedRate, 1)} statewide rate. The gap is not caused by identifying more students than average; it is what the state pays per student.`
    : `${pctText(m.spedRate, 1)} of students here receive special education services, against ${pctText(STATEWIDE.spedRate, 1)} statewide.`;

  return {
    id: 'sped',
    title: 'Special education costs more than the state pays for it',
    headline: `${m.name} covers ${round(m.spedGap)} of special education costs out of its general fund.`,
    bullets: [
      `The district spent ${round(m.spend.sped)} on special education and received ${round(m.alloc.specialEd)} in state special education funding. The difference is ${round(m.spedGap)}, or ${round(m.spedGapPerPupil)} for every student in the district.`,
      rateBullet,
      'That difference is not paid by a special fund. It comes out of general education money, which means it is paid by every student in the district.',
      `The median Washington district covers ${round(MEDIANS.spedGapPerPupil)} per student this way. ${m.name} covers ${round(m.spedGapPerPupil)}.`,
    ],
    ask: 'Ask your legislators to raise the special education funding multipliers and to fund the safety net for high-cost placements at the level districts actually claim. Serving students with disabilities is a federal and state obligation, not a local option.',
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
    title: 'Operating costs outrun the formula that pays for them',
    headline: `${m.name} spends ${round(m.msocGap)} more on day-to-day operating costs than the state allocates.`,
    bullets: [
      `MSOC - materials, supplies, technology, utilities, insurance, textbooks - cost ${round(m.spend.msoc)} here. The state allocated ${round(m.alloc.msoc)}. The gap is ${round(m.msocGap)}, or ${round(m.msocGapPerPupil)} per student.`,
      'The state pays MSOC as a flat per-student rate. Heating an old building, insuring it, and keeping its network running do not scale with headcount, so the rate fits some districts and misses others badly.',
      `${BILLS.msoc.bill} would have added $100 per student with a $100,000 floor - about ${round(wouldHaveBeen)} for ${m.name}. It died in committee, so the gap above is what the district absorbed instead.`,
    ],
    ask: `Ask your legislators to raise the MSOC allocation and to revive the ${BILLS.msoc.bill} increase. Operating costs are the least visible part of a school budget and the first place a shortfall shows up as something a student notices.`,
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
    title: 'Getting students to school costs more than the state reimburses',
    headline: `${m.name} covers ${round(m.transGap)} of student transportation itself.`,
    bullets: [
      `Transportation cost ${round(m.spend.transportation)} out of the general fund; the state allocated ${round(m.alloc.transportation)}. The shortfall is ${round(m.transGap)}, or ${round(m.transGapPerPupil)} per student.`,
      `Statewide, districts spend about ${round(STATEWIDE.transportationPerStudent)} per student on transportation. Route length, geography, and how many students need individualized routes drive that number far more than enrollment does.`,
      `${BILLS.transportation.bill} would have put a transportation safety net into law for students with disabilities, students experiencing homelessness, and students in foster care - the routes that cost the most. It died in Senate Ways & Means.`,
      `${BILLS.buses.bill} passed and stretched the assumed lifetime of school buses, so the state now reimburses their cost more slowly.`,
    ],
    ask: `Ask your legislators to enact the transportation safety net from ${BILLS.transportation.bill} and to revisit the bus depreciation schedule changed by ${BILLS.buses.bill}.`,
    refs: [BILLS.transportation, BILLS.buses],
    severity: 45 + pctile * 0.35,
  };
};

const ellIssue: Builder = (m) => {
  if (m.ellRate < 12) return null;
  const pctile = percentileOf(DISTRIBUTIONS.ellRate, m.ellRate);
  if (pctile < 70) return null;

  const bullets: string[] = [
    `${fmtInt(m.record.demo.ell)} students here are multilingual learners - ${pctText(m.ellRate, 1)} of enrollment, against ${pctText(STATEWIDE.ellRate, 1)} statewide.`,
  ];
  if (m.bilingualPerEll != null) {
    bullets.push(
      `The state's Transitional Bilingual Instruction Program allocation works out to ${round(m.bilingualPerEll)} per multilingual student here - a supplement on top of basic education, not the cost of teaching a student a new language while teaching them everything else.`
    );
  }
  bullets.push(
    'Bilingual funding is time-limited: it follows a student only until they test out. Districts with continuous newcomer arrivals carry a permanent program on funding designed to be temporary.',
    'Staffing that program means certificated bilingual and ESL teachers, translated materials, and interpreters for families - costs the prototypical school model does not carry a line for.'
  );

  return {
    id: 'ell',
    title: 'A large multilingual student population on time-limited funding',
    headline: `${pctText(m.ellRate, 1)} of ${m.name}'s students are multilingual learners.`,
    bullets,
    ask: 'Ask your legislators to extend the years a student generates bilingual funding and to raise the per-student rate. Ask specifically about funding for districts with continuous newcomer enrollment, where the program never shrinks.',
    refs: [BILLS.budget],
    severity: 45 + pctile * 0.35,
  };
};

const lowIncomeIssue: Builder = (m) => {
  if (m.lowIncomeRate < 60) return null;
  const pctile = percentileOf(DISTRIBUTIONS.lowIncomeRate, m.lowIncomeRate);
  if (pctile < 72) return null;

  const bullets: string[] = [
    `${pctText(m.lowIncomeRate, 1)} of students here qualify as low income, against ${pctText(STATEWIDE.lowIncomeRate, 1)} statewide - ${fmtInt(m.record.demo.lowIncome)} students.`,
  ];
  if (m.lapPerLowIncome != null) {
    bullets.push(
      `Learning Assistance Program funding is ${round(m.lapPerLowIncome)} per low-income student here. LAP is the main state response to concentrated poverty and it is allocated as a modest supplement.`
    );
  }
  if (m.homelessRate >= 3) {
    bullets.push(
      `${fmtInt(m.record.demo.homeless)} students - ${pctText(m.homelessRate, 1)} of enrollment - experienced homelessness, which drives transportation, counseling, and enrollment-stability costs at once.`
    );
  }
  bullets.push(
    'Concentrated poverty raises the cost of the same academic result: more counselors, more family outreach, more food service, more summer and after-school programming. The prototypical model funds a school, not a caseload.'
  );

  return {
    id: 'lowIncome',
    title: 'Concentrated poverty on a formula that barely adjusts for it',
    headline: `${pctText(m.lowIncomeRate, 1)} of ${m.name}'s students are low income.`,
    bullets,
    ask: 'Ask your legislators to increase Learning Assistance Program funding and to weight the basic education formula by student poverty, not just by headcount.',
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
    title: 'Enrollment is falling and funding follows it down',
    headline: `${m.name} has lost ${pctText(Math.abs(change), 1)} of its funded enrollment since ${BASE_YEAR}.`,
    bullets: [
      `Funded enrollment went from ${fmtInt(Math.round(before))} in ${BASE_YEAR} to ${fmtInt(Math.round(m.record.fundingEnrollment))} in ${LATEST_YEAR} - about ${fmtInt(Math.round(lost))} students.`,
      `Nearly all state money is per-student, so that decline removed roughly ${round(lost * m.perPupil)} a year at this district's current per-student rate.`,
      'Costs do not fall at the same speed. A district losing 8% of its students does not have 8% fewer buildings to heat, buses to run, or grade levels to staff.',
      `${BILLS.enrollment.bill} would have cushioned districts against exactly this and died in its first committee.`,
    ],
    ask: `Ask your legislators to revive enrollment stabilization funding from ${BILLS.enrollment.bill}, so a district gets time to adjust staffing and programs instead of cutting mid-year.`,
    refs: [BILLS.enrollment, BILLS.budget],
    severity: 50 + Math.min(Math.abs(change), 30),
  };
};

const smallScaleIssue: Builder = (m) => {
  if (m.fte >= 400) return null;
  const pctile = percentileOf(DISTRIBUTIONS.perPupil, m.perPupil);

  return {
    id: 'smallScale',
    title: 'Too small for a formula built around a 400-student school',
    headline: `${m.name} funds ${fmtInt(Math.round(m.fte))} students against a model whose smallest prototype is a 400-student elementary school.`,
    bullets: [
      `The prototypical school model allocates staff by dividing enrollment into a theoretical school of 400 elementary, 432 middle, or 600 high school students. With ${fmtInt(Math.round(m.fte))} funded students, ${m.name} gets fractional staff allocations for roles a school needs whole.`,
      `Per-student revenue here is ${round(m.perPupil)}, against a statewide median of ${round(MEDIANS.perPupil)}. Small districts often look well funded per student precisely because fixed costs are divided across very few of them.`,
      'A principal, a nurse, a counselor, and a bus route cost about the same whether 90 students or 900 use them. Small-district funding enhancements exist, but they are set as fixed amounts that inflation erodes.',
    ],
    ask: 'Ask your legislators to review the small-district and remote-and-necessary funding enhancements, which have not kept pace with the real cost of staffing a small school.',
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
    return `${m.name} does not show an outlier funding problem in the 2024-25 data.`;
  }
  return issues[0].headline;
}

function summaryFor(m: Metrics, issues: Issue[]): string {
  if (issues.length === 0) {
    return `On the measures this site tracks - special education, operating costs, transportation, levy capacity, and demographics - ${m.name} sits near the middle of Washington's 315 districts. That is not the same as being well funded. The statewide gaps still apply here; they are simply not sharper here than elsewhere, so the 2026 bills further down this page are the place to start.`;
  }
  const names = issues.slice(0, 3).map((i) => ISSUE_SHORT[i.id]);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Ranked against the other 314 districts in Washington, ${m.name}'s funding problems concentrate in ${list}. Each section below gives the district's own numbers, where they came from, and what to ask a legislator to change.`;
}

const ISSUE_SHORT: Record<IssueId, string> = {
  oversight: 'state financial oversight',
  reserves: 'an unbalanced budget',
  levyCap: 'the local levy cap',
  leaDependence: 'dependence on levy equalization',
  sped: 'special education',
  msoc: 'operating costs',
  transportation: 'transportation',
  ell: 'multilingual learners',
  lowIncome: 'student poverty',
  enrollmentDecline: 'falling enrollment',
  smallScale: 'small-district scale',
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
    headline: headlineFor(m, issues),
    summary: summaryFor(m, issues),
    stats: statsFor(m),
    issues,
    emailIssue,
    emailAsk,
    emailFact: top ? top.headline : null,
    steadyNote:
      issues.length === 0
        ? 'No issue here scored high enough against the statewide distribution to single out. The email and testimony templates below still work - use the statewide picture and your own experience.'
        : null,
  };
}

export const DIAGNOSIS_YEAR = LATEST_YEAR;
export const LEVY_YEAR = levyJson.levyYear;
