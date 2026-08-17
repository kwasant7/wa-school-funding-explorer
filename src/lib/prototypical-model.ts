/**
 * The statutory parameters of Washington's prototypical school funding model.
 *
 * RCW 28A.150.260 as currently in effect - 2025 c 334 s 1 (ESSB 5192),
 * effective September 1, 2025. That amendment struck the itemized MSOC
 * category tables and replaced them with lump sums; it left every staffing and
 * class-size parameter below untouched. The (5)(a) staffing table reflects the
 * physical, social and emotional support staff increases from 2SHB 1664 (2022
 * c 109), whose final sections took effect September 1, 2024, and the
 * paraeducator and office-support increases from 2SSB 5882 (2024 c 191).
 *
 * This file exists because these figures used to be hand-copied into the
 * explainer page, the School Builder, the class-size widget and the funding
 * journey, and they drifted: one copy still carried the pre-2SHB 1664 nurse
 * allocation. Every surface that states a number from this statute now reads
 * it from here.
 */

export const RCW_URL =
  'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.150.260';

export type SchoolType = 'elementary' | 'middle' | 'high';

/**
 * Planning time, RCW 28A.150.260(4)(a)(i).
 *
 * The statute funds the teachers needed to cover the minimum instructional
 * hours "and provide at least one teacher planning period per school day" - so
 * dividing enrollment by the class size is only half the calculation. OSPI
 * implements the second half as
 *
 *     (Enrollment / Class Size) * (1 + Planning Time Factor) = Teacher Units
 *
 * with the factor at 15.5% for K-6 and 20% for grades 7-12, representing 45
 * minutes out of a 5.5-hour elementary day and one hour out of a six-hour
 * secondary day. Those percentages are a legislative assumption carried in the
 * omnibus appropriations act rather than in the RCW itself.
 *
 * Source: OSPI, Organization and Financing of Washington's Public Schools
 * (2023), pp. 81-82.
 */
export const PLANNING_TIME = { elementary: 0.155, secondary: 0.2 };

/** General education average class size, RCW 28A.150.260(4)(a)(i). */
export const CLASS_SIZE = {
  k3: 17,
  grades46: 27,
  grades78: 28.53,
  grades912: 28.74,
  cte: 23,
  skillCenter: 19,
  laboratoryScience: 19.98,
};

/**
 * How K-6 enrollment splits between the two elementary class-size bands when
 * no district is selected: four of seven grades in K-3, three in grades 4-6.
 *
 * Only ever used to draw the empty-state prototype. Once a district is chosen
 * the model uses that district's own reported K-3 and grades 4-6 funding FTE,
 * which is what the statute directs - (3)(a) allocates on "the actual number
 * of annual average full-time equivalent students in each grade level."
 */
export const ELEMENTARY_BAND_SPLIT = { k3: 4 / 7, grades46: 3 / 7 };

/**
 * Every non-teacher staff line in the prototypical school table, RCW
 * 28A.150.260(5)(a), stated per prototypical school.
 *
 * `conditional` marks the six roles that (5)(b) funds only "to the extent of
 * and proportionate to a school district's demonstrated actual ratios" of
 * physical, social and emotional support staff - the money is not unconditional
 * the way the rest of the table is.
 */
export const STAFF_ROLES = [
  { label: 'Principals', statutory: 'Principals, assistant principals, and other certificated building-level administrators', elementary: 1.253, middle: 1.353, high: 1.88 },
  { label: 'Paraeducators', statutory: 'Paraeducators, including any aspect of educational instructional services provided by classified employees', elementary: 1.012, middle: 0.776, high: 0.728 },
  { label: 'Office staff', statutory: 'Office support and other noninstructional aides', elementary: 2.088, middle: 2.401, high: 3.345 },
  { label: 'Custodians', statutory: 'Custodians', elementary: 1.657, middle: 1.942, high: 2.965 },
  { label: 'Teacher-librarians', statutory: 'Teacher-librarians, a function that includes information literacy, technology, and media to support school library media programs', elementary: 0.663, middle: 0.519, high: 0.523 },
  { label: 'Counselors', statutory: 'Counselors', elementary: 0.993, middle: 1.716, high: 3.039, conditional: true },
  { label: 'Nurses', statutory: 'Nurses', elementary: 0.585, middle: 0.888, high: 0.824, conditional: true },
  { label: 'Social workers', statutory: 'Social workers', elementary: 0.311, middle: 0.088, high: 0.127, conditional: true },
  { label: 'Psychologists', statutory: 'Psychologists', elementary: 0.104, middle: 0.024, high: 0.049, conditional: true },
  { label: 'Student-safety staff', statutory: 'Classified staff providing student and staff safety', elementary: 0.079, middle: 0.092, high: 0.141, conditional: true },
  { label: 'Parent involvement coordinators', statutory: 'Parent involvement coordinators', elementary: 0.0825, middle: 0, high: 0, conditional: true },
] as const;

export const PROTOTYPES: Record<
  SchoolType,
  {
    label: string;
    grades: string;
    /** Average annual FTE students in the model school, (3)(b). */
    proto: number;
    /** Planning-time factor that applies to this level's teacher units. */
    planningTime: number;
    /**
     * The funded general education class sizes this level's teachers are
     * generated from, with the band each one covers. Elementary spans two.
     */
    classSizes: { label: string; size: number }[];
  }
> = {
  elementary: {
    label: 'Elementary',
    grades: 'K-6',
    proto: 400,
    planningTime: PLANNING_TIME.elementary,
    classSizes: [
      { label: 'K-3', size: CLASS_SIZE.k3 },
      { label: 'grades 4-6', size: CLASS_SIZE.grades46 },
    ],
  },
  middle: {
    label: 'Middle',
    grades: '7-8',
    proto: 432,
    planningTime: PLANNING_TIME.secondary,
    classSizes: [{ label: 'grades 7-8', size: CLASS_SIZE.grades78 }],
  },
  high: {
    label: 'High school',
    grades: '9-12',
    proto: 600,
    planningTime: PLANNING_TIME.secondary,
    classSizes: [{ label: 'grades 9-12', size: CLASS_SIZE.grades912 }],
  },
};

/**
 * Funded teacher FTE for one grade band: enrollment over class size, then
 * grossed up for planning time. Both halves of (4)(a)(i), not just the first.
 */
export function teacherUnits(fte: number, classSize: number, planningTime: number) {
  return (fte / classSize) * (1 + planningTime);
}

/** District-wide support staff per 1,000 K-12 FTE, RCW 28A.150.260(6)(a). */
export const DISTRICT_WIDE_STAFF = [
  { label: 'Facilities, maintenance and grounds', per1000: 1.813 },
  { label: 'Technology', per1000: 0.628 },
  { label: 'Warehouse, laborers and mechanics', per1000: 0.332 },
];

/**
 * Central administration, RCW 28A.150.260(6)(b): 5.30 percent of the staff
 * units generated under (4)(a), (5) and (6)(a). A district office is funded as
 * a percentage of its schools.
 */
export const CENTRAL_ADMIN_RATE = 0.053;

/**
 * Materials, supplies and operating costs, RCW 28A.150.260(8).
 *
 * Both figures are statutory floors that (8)(a) and (8)(b) index to the
 * implicit price deflator beginning in the 2026-27 school year, so from that
 * year forward the operative allocation is these numbers times the inflation
 * adjustment, which lives in the appropriations act rather than the RCW.
 */
export const MSOC = {
  perStudent: 1614.28,
  highSchoolAddOn: 214.84,
  inflationIndexedFrom: '2026-27',
};
