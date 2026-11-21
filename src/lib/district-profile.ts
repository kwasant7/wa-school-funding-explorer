import { districtSeries, yearData, LATEST, YEARS } from '@/lib/data';
import { aleContractsMaterial, metricsFor, percentileOf, type Metrics } from '@/lib/diagnosis';
import { fmtMoney, fmtMoneyFull, fmtInt } from '@/lib/format';
import { groupCount, groupShare, withheldByOspi } from '@/lib/privacy';
import { big3For, big3Gap } from '@/lib/big3';
import districtsJson from '@/data/districts.json';

/**
 * Everything a static district page renders, assembled once per district at
 * build time.
 *
 * This lives apart from the page component for two reasons: the same numbers
 * feed both the visible page and its `<meta>` description (generateMetadata
 * runs in a separate pass, so the page body cannot hand them over), and the
 * derivations are worth testing without rendering React.
 *
 * Every figure here comes from data already on the site - districts.json,
 * allocation.json, spending.json, levy.json and history.json - reshaped, never
 * recomputed with different assumptions. Where a district has no row in one of
 * the optional datasets, the corresponding section is omitted rather than
 * filled with a zero, which would read as "this district spends nothing on
 * transportation" instead of "we don't have that figure".
 */

const STATEWIDE = districtsJson.statewide;

/** Sorted per-pupil revenue across all districts, for the percentile rank. */
const PER_PUPIL_SORTED = [...districtsJson.districts]
  .map((d) => d.perPupil)
  .sort((a, b) => a - b);

export type GapRow = {
  key: 'sped' | 'msoc' | 'transportation';
  label: string;
  /**
   * All funding that arrives for this program. On AESD's Big 3 definition
   * (`aesd: true`) this is every revenue line - state, federal IDEA, Medicaid,
   * and payments from other districts. On the state-only fallback it is the
   * state allocation plus other program revenue.
   */
  funding: number;
  /** What the program costs. AESD scope (state + federal) or, on the fallback, F-196 state-program actuals. */
  cost: number;
  /** cost − funding. Positive means the district covered the difference from its own money. */
  gap: number;
  gapPerPupil: number;
  /** True when these are AESD's Big 3 figures; false on the state-only fallback (districts AESD omits). */
  aesd: boolean;
};

export type TrendRow = {
  year: string;
  perPupil: number | null;
  total: number | null;
  enrollment: number | null;
};

export type DemographicRow = {
  label: string;
  count: number;
  /**
   * False when the count is a blank read as 0: no students with disabilities
   * reported although the state paid a special-education allocation (the
   * Report Card leaves small counts out). Paschal Sherman, Benge.
   */
  reported: boolean;
  districtRate: number;
  statewideRate: number;
  /** The count and share as displayed, after OSPI's small-group rules. */
  countText: string;
  rateText: string;
};

export type DistrictProfile = {
  code: string;
  name: string;
  county: string;
  esd: string;
  schoolYear: string;
  metrics: Metrics;
  fundingFte: number;
  headcount: number;
  revenue: { local: number; state: number; federal: number; other: number; total: number };
  perPupil: number;
  /** 0-100: share of districts with per-student revenue at or below this one. */
  perPupilPercentile: number;
  statewideMedianPerPupil: number;
  expenditures: number;
  surplus: number;
  fundBalance: number | null;
  reserveRatio: number | null;
  enrollmentChange: number | null;
  gaps: GapRow[];
  /** Sum of the positive gaps: locally covered dollars above the formula. */
  coveredLocally: number;
  /** MSOC funding above MSOC cost (0 when short); see Big3Totals.msocAhead. */
  msocAhead: number;
  demographics: DemographicRow[];
  levy: Metrics['levy'];
  capBlocked: number;
  leaShare: number;
  trend: TrendRow[];
  /** Years, oldest first, in which this district reported data at all. */
  firstYearWithData: string | null;
};

function demographics(m: Metrics): DemographicRow[] {
  const d = m.record.demo;
  const head = m.headcount || 1;
  const swHead = STATEWIDE.enrollment || 1;
  const sw = districtsJson.districts.reduce(
    (acc, x) => {
      acc.lowIncome += x.demo.lowIncome;
      acc.ell += x.demo.ell;
      acc.sped += x.demo.sped;
      acc.highlyCapable += x.demo.highlyCapable;
      acc.homeless += x.demo.homeless;
      acc.migrant += x.demo.migrant;
      return acc;
    },
    { lowIncome: 0, ell: 0, sped: 0, highlyCapable: 0, homeless: 0, migrant: 0 }
  );

  const rows: [string, number, number, boolean][] = [
    ['Low income', d.lowIncome, sw.lowIncome, withheldByOspi(d, 'lowIncome')],
    ['English learners', d.ell, sw.ell, false],
    ['Students with disabilities', d.sped, sw.sped, false],
    ['Highly capable', d.highlyCapable, sw.highlyCapable, false],
    ['Experiencing homelessness', d.homeless, sw.homeless, false],
    ['Migrant', d.migrant, sw.migrant, false],
  ];

  return rows.map(([label, count, swCount, hidden]) => ({
    label,
    count,
    reported: !(label === 'Students with disabilities' && count === 0 && (m.alloc?.specialEd ?? 0) > 0),
    districtRate: (100 * count) / head,
    statewideRate: (100 * swCount) / swHead,
    countText: groupCount(count, head, hidden),
    rateText: groupShare(count, head, 1, hidden),
  }));
}

function gaps(m: Metrics): GapRow[] {
  // The Big 3 gaps follow AESD's Big 3 dashboard (waschoolfunding.org) - the
  // same definition OSPI, JLARC and the "Big 3" legislation use: a program's
  // full cost (state plus federal) minus every revenue line that funds it
  // (state, federal IDEA, Medicaid, payments from other districts), divided by
  // AESD's own K-12-plus-ALE student count. Every surface on the site - this
  // page, the explorer, the brief and the PDF - now quotes those figures.
  const aesd = big3For(m.code);
  if (aesd && aesd.students > 0) {
    const row = (
      key: GapRow['key'],
      label: string,
      p: { revenue: number; cost: number }
    ): GapRow => {
      const gap = big3Gap(p);
      return {
        key,
        label,
        funding: p.revenue,
        cost: p.cost,
        gap,
        gapPerPupil: gap / aesd.students,
        aesd: true,
      };
    };
    return [
      row('sped', 'Special education', aesd.sped),
      row('msoc', 'Materials, supplies & operating costs (MSOC)', aesd.msoc),
      row('transportation', 'Student transportation', aesd.transportation),
    ];
  }

  // Fallback for the handful of entities AESD does not publish (some charters
  // and tribal compact schools): the site's own state-program figures. Both
  // sides of every comparison have to exist, or the "gap" is just one number
  // minus nothing - which is how a missing dataset turns into a headline
  // claiming the state funds zero percent of a program.
  if (!m.alloc || !m.spend) return [];
  return [
    {
      key: 'sped' as const,
      label: 'Special education',
      funding: m.alloc.specialEd + m.spend.spedOtherRevenue,
      cost: m.spend.sped,
      gap: m.spedGap,
      gapPerPupil: m.spedGapPerPupil,
      aesd: false,
    },
    {
      key: 'msoc' as const,
      label: 'Materials, supplies & operating costs (MSOC)',
      funding: m.alloc.msocBig3,
      cost: m.spend.msocBig3,
      gap: m.msocGap,
      gapPerPupil: m.msocGapPerPupil,
      aesd: false,
    },
    {
      key: 'transportation' as const,
      label: 'Student transportation',
      funding: m.alloc.transportation + m.spend.transportationOtherRevenue,
      cost: m.spend.transportation,
      gap: m.transGap,
      gapPerPupil: m.transGapPerPupil,
      aesd: false,
    },
  ];
}

function trend(code: string): TrendRow[] {
  const perPupil = districtSeries(code, (d) => d.perPupil);
  const total = districtSeries(code, (d) => d.rev.total);
  const enrollment = districtSeries(code, (d) => d.fundingEnrollment);
  return YEARS.map((year, i) => ({
    year,
    perPupil: perPupil[i]?.value ?? null,
    total: total[i]?.value ?? null,
    enrollment: enrollment[i]?.value ?? null,
  }));
}

export function districtProfile(code: string): DistrictProfile | null {
  const m = metricsFor(code);
  if (!m) return null;

  const rows = trend(code);
  const withData = rows.filter((r) => r.total != null);
  const gapRows = gaps(m);

  return {
    code: m.code,
    name: m.name,
    county: m.record.county,
    esd: m.record.esd,
    schoolYear: LATEST,
    metrics: m,
    fundingFte: m.fte,
    headcount: m.headcount,
    revenue: m.record.rev,
    perPupil: m.perPupil,
    perPupilPercentile: percentileOf(PER_PUPIL_SORTED, m.perPupil),
    statewideMedianPerPupil: STATEWIDE.medianPerPupil,
    expenditures: m.record.exp,
    surplus: m.surplus,
    fundBalance: m.record.fundBalance,
    reserveRatio: m.reserveRatio,
    enrollmentChange: m.enrollmentChange,
    gaps: gapRows,
    coveredLocally: gapRows.reduce((sum, g) => sum + Math.max(0, g.gap), 0),
    msocAhead: Math.max(0, -(gapRows.find((g) => g.key === 'msoc')?.gap ?? 0)),
    demographics: demographics(m),
    levy: m.levy,
    capBlocked: m.capBlocked,
    leaShare: m.leaShare,
    trend: rows,
    firstYearWithData: withData[0]?.year ?? null,
  };
}

/**
 * The `<meta name="description">` for a district page.
 *
 * Built from the district's own numbers so all 315 differ in substance rather
 * than in a swapped proper noun, and capped near Google's display limit so the
 * useful half is not the half that gets truncated. Reads as a sentence a
 * person would write, not a keyword list.
 */
export function districtMetaDescription(p: DistrictProfile): string {
  const parts = [
    `${p.name} received ${fmtMoney(p.revenue.total)} in ${p.schoolYear} general-fund revenue`,
    `${fmtMoneyFull(p.perPupil)} per student for ${fmtInt(Math.round(p.fundingFte))} funded students`,
  ];
  if (p.coveredLocally > 0) {
    parts.push(
      `with ${fmtMoney(p.coveredLocally)} of Big 3 program shortfalls covered from other general-fund money` +
        (aleContractsMaterial(p.metrics)
          ? ` (incl. ${fmtMoney(p.metrics.spend?.msocBig3AleContracts ?? 0)} of online teaching contracts)`
          : '')
    );
  }
  return `${parts.join(', ')}. State, local levy and federal breakdown from official OSPI data.`;
}

/** The 12 largest districts by funded enrollment, for internal links. */
export function largestDistricts(limit = 12) {
  return [...yearData(LATEST).districts]
    .sort((a, b) => b.fundingEnrollment - a.fundingEnrollment)
    .slice(0, limit)
    .map((d) => ({ code: d.code, name: d.name }));
}
