/**
 * Washington's Learning Assistance Program (LAP), modeled as the statute
 * writes it - a fixed component of basic state funding, not a policy lever.
 *
 * RCW 28A.150.260(10)(a) funds extra instructional support for students who
 * are behind, sized by the district's low-income share: prior-year enrollment
 * times the prior-year free/reduced-price-meal percentage gives the eligible
 * students, and each of them generates 2.3975 hours per week of extended
 * support, delivered in groups of 15, for a 36-week year. Dividing by the 900
 * annual instructional hours that define one teacher FTE converts those hours
 * into funded LAP teachers. (10)(b) adds 1.1 hours per week for students in
 * schools where at least half of students are low-income - High-Poverty LAP.
 * RCW 28A.165 governs how districts may spend it.
 *
 * The formula generates STAFF, not dollars: the state then prices each funded
 * teacher at its certificated salary allocation, regionalized by district,
 * plus benefits. That is why this file first computes FTE and only then
 * converts to money - LAP is not a flat per-student rate, and treating it as
 * one would misstate how the money responds to enrollment and poverty.
 *
 * This is deliberately NOT a simulator slider. The hours, group size, and
 * poverty threshold are statute, and the simulator models choices lawmakers
 * are actively debating, not re-derivations of current law. The card that
 * renders this model exists so the base funding the sliders sit on is
 * legible, and so the one real high-poverty mechanism Washington has is
 * visible next to the hypothetical concentration-bonus lever.
 */

import lapInputs from '@/data/lap-inputs.json';
import allocationData from '@/data/allocation.json';

/** Extended instructional hours per eligible student per week, RCW 28A.150.260(10)(a). */
export const LAP_HOURS_PER_WEEK = 2.3975;
/** Additional hours for students in qualifying high-poverty schools, (10)(b). */
export const HIGH_POVERTY_HOURS_PER_WEEK = 1.1;
/** Instructional weeks in the funded school year. */
export const LAP_WEEKS = 36;
/** Assumed students per LAP instructional group. */
export const LAP_GROUP_SIZE = 15;
/** Annual instructional hours that define one teacher FTE. */
export const LAP_ANNUAL_HOURS = 900;
/** A school qualifies for High-Poverty LAP at this low-income share. */
export const HIGH_POVERTY_THRESHOLD = 0.5;

/** The years the model is stated in, read off the generated inputs. */
export const LAP_MODEL_YEAR = lapInputs.modelYear;
export const LAP_PRIOR_YEAR = lapInputs.priorYear;

type LapInput = { aafte: number; poverty: number };
const INPUTS = lapInputs.districts as Record<string, LapInput>;
const ALLOCATION = allocationData.districts as Record<
  string,
  { learningAssistance: number; salaries: number; benefits: number }
>;

/**
 * Funded base-LAP teacher FTE. Hours per week x weeks gives each eligible
 * student's annual hours; dividing by group size and the 900-hour teacher
 * year turns them into staff. Equivalent to eligible x 0.0063933...
 */
export function lapTeacherFte(priorYearAafte: number, lapPovertyRate: number) {
  const lapEligibleStudents = priorYearAafte * lapPovertyRate;
  return (
    (lapEligibleStudents * LAP_HOURS_PER_WEEK * LAP_WEEKS) /
    (LAP_GROUP_SIZE * LAP_ANNUAL_HOURS)
  );
}

/**
 * High-Poverty LAP teacher FTE - the (10)(b) add-on hours.
 *
 * The statute generates these from each QUALIFYING SCHOOL's own enrollment,
 * and this dataset stops at the district level, so this is a flagged
 * district-level approximation: a district at or above the 50% threshold
 * district-wide is treated as if every low-income student attends a
 * qualifying school, and a district below it as if none does. That
 * overstates districts just over the line and zeroes out under-50% districts
 * that still contain qualifying schools. The calibration below absorbs the
 * statewide error; per-district figures inherit it, which is one reason the
 * card shows OSPI's actual allocation alongside the model.
 */
export function highPovertyLapTeacherFte(
  priorYearAafte: number,
  lapPovertyRate: number
) {
  if (lapPovertyRate < HIGH_POVERTY_THRESHOLD) return 0;
  const qualifyingStudents = priorYearAafte * lapPovertyRate;
  return (
    (qualifyingStudents * HIGH_POVERTY_HOURS_PER_WEEK * LAP_WEEKS) /
    (LAP_GROUP_SIZE * LAP_ANNUAL_HOURS)
  );
}

/*
  Compensation. The codebase has no salary schedule or regionalization table
  to reuse - every dollar figure on the site comes from OSPI's apportionment
  extract - so the conversion is CALIBRATED to that extract rather than
  asserted from constants this repo cannot verify:

  - benefitRate is the extract's own statewide funded rate, total basic
    education benefits over total salaries.
  - certificatedSalary is solved so that the modeled statewide LAP total
    equals the actual statewide LAP apportionment (revenue 4155). It is "the
    average state-funded certificated salary the extract implies per funded
    LAP teacher", statewide-average regionalization already embedded.

  regionalizationMultiplier therefore defaults to 1: the per-district LEAP
  Document 3 factors are not in this dataset, and pretending otherwise would
  be inventing data. The statewide total matches by construction; a
  district's modeled figure differs from its actual allocation by exactly
  the things the calibration averages away - its regionalization factor, its
  staff-mix rates, and the school-level poverty distribution noted above.
*/
function calibrate() {
  let salaries = 0;
  let benefits = 0;
  let actualLap = 0;
  let modeledFte = 0;
  for (const [code, input] of Object.entries(INPUTS)) {
    const alloc = ALLOCATION[code];
    if (!alloc) continue;
    salaries += alloc.salaries;
    benefits += alloc.benefits;
    actualLap += alloc.learningAssistance;
    modeledFte +=
      lapTeacherFte(input.aafte, input.poverty) +
      highPovertyLapTeacherFte(input.aafte, input.poverty);
  }
  const benefitRate = benefits / salaries;
  return {
    benefitRate,
    certificatedSalary: actualLap / (modeledFte * (1 + benefitRate)),
    statewideActual: actualLap,
    statewideFte: modeledFte,
  };
}

const CALIBRATION = calibrate();

export const LAP_COMP = {
  /** Implied average state-funded certificated salary per LAP teacher FTE. */
  certificatedSalary: CALIBRATION.certificatedSalary,
  /** Statewide funded benefit rate from the same extract. */
  benefitRate: CALIBRATION.benefitRate,
  /** Per-district LEAP factors are not in this dataset; see the note above. */
  regionalizationMultiplier: 1,
  statewideActual: CALIBRATION.statewideActual,
  statewideFte: CALIBRATION.statewideFte,
};

/** Benefits on a salary allocation, at the extract's funded rate. */
export function calculateBenefits(lapSalaryFunding: number) {
  return lapSalaryFunding * LAP_COMP.benefitRate;
}

export type LapEstimate = {
  priorYear: string;
  priorYearAafte: number;
  lapPovertyRate: number;
  lapEligibleStudents: number;
  baseTeacherFte: number;
  highPovertyTeacherFte: number;
  /** District-wide rate clears the 50% school threshold - see the caveat. */
  qualifiesHighPoverty: boolean;
  totalTeacherFte: number;
  salaryFunding: number;
  benefitsFunding: number;
  /** Modeled total: FTE x calibrated salary x regionalization + benefits. */
  totalFunding: number;
  /** OSPI's actual LAP apportionment (revenue 4155), the authoritative figure. */
  actualAllocation: number | null;
};

/**
 * The statutory LAP model for one district. Pure function of the district's
 * own prior-year data - it takes no simulator state, so no slider can move
 * it, and it changes when the selected district does because enrollment and
 * poverty do.
 */
export function lapFor(code: string): LapEstimate | null {
  const input = INPUTS[code];
  if (!input) return null;
  const baseTeacherFte = lapTeacherFte(input.aafte, input.poverty);
  const highPovertyTeacherFte = highPovertyLapTeacherFte(
    input.aafte,
    input.poverty
  );
  const totalTeacherFte = baseTeacherFte + highPovertyTeacherFte;
  const salaryFunding =
    totalTeacherFte *
    LAP_COMP.certificatedSalary *
    LAP_COMP.regionalizationMultiplier;
  const benefitsFunding = calculateBenefits(salaryFunding);
  return {
    priorYear: LAP_PRIOR_YEAR,
    priorYearAafte: input.aafte,
    lapPovertyRate: input.poverty,
    lapEligibleStudents: input.aafte * input.poverty,
    baseTeacherFte,
    highPovertyTeacherFte,
    qualifiesHighPoverty: input.poverty >= HIGH_POVERTY_THRESHOLD,
    totalTeacherFte,
    salaryFunding,
    benefitsFunding,
    totalFunding: salaryFunding + benefitsFunding,
    actualAllocation: ALLOCATION[code]?.learningAssistance ?? null,
  };
}
