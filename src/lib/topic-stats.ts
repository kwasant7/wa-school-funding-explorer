import districtsJson from '@/data/districts.json';
import allocationJson from '@/data/allocation.json';
import spendingJson from '@/data/spending.json';
import levyJson from '@/data/levy.json';
import { districtPath } from '@/lib/district-slug';

/**
 * Statewide roll-ups and per-district rankings for the topic pages.
 *
 * The topic pages exist to explain one program each, and an explanation is
 * more convincing with the state's own totals next to it. Everything here is a
 * sum or a sort over data already shipped for the district pages - no new
 * source, no new assumption, and nothing rounded differently than the district
 * page would round it.
 */

type ProgramKey = 'sped' | 'msoc' | 'transportation';

const ALLOC = allocationJson.districts as Record<
  string,
  (typeof allocationJson.districts)[keyof typeof allocationJson.districts]
>;
const SPEND = spendingJson.districts as Record<
  string,
  (typeof spendingJson.districts)[keyof typeof spendingJson.districts]
>;

/**
 * Which allocation line pairs with which spending line, program by program.
 * MSOC pairs the Big-3 fields (OSPI's 2026 budget-request scope, the one
 * AESD's dashboard publishes); the GenEd-only `msoc` fields stay reserved for
 * the 3100-apportionment split.
 */
const ALLOC_LINE: Record<ProgramKey, 'specialEd' | 'msocBig3' | 'transportation'> = {
  sped: 'specialEd',
  msoc: 'msocBig3',
  transportation: 'transportation',
};
const SPEND_LINE: Record<ProgramKey, 'sped' | 'msocBig3' | 'transportation'> = {
  sped: 'sped',
  msoc: 'msocBig3',
  transportation: 'transportation',
};

export const STATEWIDE = districtsJson.statewide;
export const LEA_ASSUMPTIONS = levyJson.assumptions;
/** The calendar year the levy worksheet figures describe (levies run on CY, not SY). */
export const LEVY_CALENDAR_YEAR = levyJson.calendarYear;

/** Every state allocation line, summed across all districts. */
export const ALLOCATION_TOTALS = (() => {
  const sum = {
    salaries: 0,
    benefits: 0,
    msoc: 0,
    otherBasicEducation: 0,
    basicEducation: 0,
    specialEd: 0,
    transportation: 0,
    bilingual: 0,
    learningAssistance: 0,
    highlyCapable: 0,
    food: 0,
    levyEqualization: 0,
    otherState: 0,
    total: 0,
  };
  for (const code of Object.keys(ALLOC)) {
    const a = ALLOC[code];
    for (const key of Object.keys(sum) as (keyof typeof sum)[]) {
      sum[key] += a[key] ?? 0;
    }
  }
  return sum;
})();

export const SPENDING_TOTALS = spendingJson.statewide;

export type ProgramGap = {
  /** Statewide state allocation for the program. */
  allocated: number;
  /** Statewide actual general-fund spending on the program. */
  spent: number;
  gap: number;
  /** How many districts spent more than the formula allocated. */
  districtsAbove: number;
  districtsCompared: number;
};

export function programGap(program: ProgramKey): ProgramGap {
  const line = ALLOC_LINE[program];
  const spendLine = SPEND_LINE[program];
  let allocated = 0;
  let spent = 0;
  let districtsAbove = 0;
  let districtsCompared = 0;

  for (const d of districtsJson.districts) {
    const a = ALLOC[d.code];
    const s = SPEND[d.code];
    if (!a || !s) continue;
    districtsCompared += 1;
    allocated += a[line];
    spent += s[spendLine];
    if (s[spendLine] > a[line]) districtsAbove += 1;
  }

  return { allocated, spent, gap: spent - allocated, districtsAbove, districtsCompared };
}

export type RankedDistrict = {
  code: string;
  name: string;
  href: string;
  fte: number;
  gap: number;
  gapPerPupil: number;
};

/**
 * Districts ranked by per-student gap for one program.
 *
 * `minFte` exists because the extremes of this list are almost all tiny
 * districts and charters, where a single bus route or one student's placement
 * swings the per-pupil figure by thousands. Ranking the large districts
 * separately is the honest way to show that the gap is not only a small-school
 * artifact, rather than quietly dropping the small schools from the data.
 */
export function rankedByGap(
  program: ProgramKey,
  { limit = 8, minFte = 0 }: { limit?: number; minFte?: number } = {}
): RankedDistrict[] {
  const line = ALLOC_LINE[program];
  const spendLine = SPEND_LINE[program];
  const rows: RankedDistrict[] = [];

  for (const d of districtsJson.districts) {
    const a = ALLOC[d.code];
    const s = SPEND[d.code];
    if (!a || !s) continue;
    const fte = d.fundingEnrollment || d.enrollment || 0;
    if (fte < minFte) continue;
    const gap = s[spendLine] - a[line];
    rows.push({
      code: d.code,
      name: d.name,
      href: districtPath(d.code),
      fte,
      gap,
      gapPerPupil: fte > 0 ? gap / fte : 0,
    });
  }

  return rows.sort((x, y) => y.gapPerPupil - x.gapPerPupil).slice(0, limit);
}

/** Districts whose voter-approved levy exceeds what the statutory cap allows. */
export function levyCapBlocked() {
  const LEVIES = levyJson.districts as Record<
    string,
    (typeof levyJson.districts)[keyof typeof levyJson.districts]
  >;
  const large = new Set(LEA_ASSUMPTIONS.largeDistrictCodes);
  let blockedTotal = 0;
  let count = 0;

  for (const code of Object.keys(LEVIES)) {
    if (code === '00000') continue;
    const l = LEVIES[code];
    const cap = large.has(code)
      ? LEA_ASSUMPTIONS.maxLevyPerPupilLarge
      : LEA_ASSUMPTIONS.maxLevyPerPupil;
    const authority = Math.min(
      (LEA_ASSUMPTIONS.maxLevyRate * l.av) / 1000,
      cap * l.enrollment
    );
    const blocked = Math.max(0, l.levy - authority);
    if (blocked > 0) {
      blockedTotal += blocked;
      count += 1;
    }
  }
  return { count, blockedTotal };
}

/** How many districts qualify for Local Effort Assistance. */
export function leaEligibility() {
  const LEVIES = levyJson.districts as Record<string, { eligible: boolean }>;
  const codes = Object.keys(LEVIES).filter((c) => c !== '00000');
  return {
    eligible: codes.filter((c) => LEVIES[c].eligible).length,
    total: codes.length,
  };
}
