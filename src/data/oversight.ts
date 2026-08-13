/**
 * Districts under OSPI financial oversight.
 *
 * When a district cannot produce a balanced budget it must ask OSPI for
 * "binding conditions" (RCW 28A.505.110) - targets for fund balance, more
 * frequent reporting, and regular meetings with the state. Two consecutive
 * years on binding conditions, or an unsatisfactory financial plan, can
 * escalate to a Financial Oversight Committee and then to enhanced oversight
 * with a state-appointed special administrator.
 *
 * This is the sharpest public signal that a district's finances are in
 * trouble, and it is not derivable from the F-196 numbers alone - so it is
 * transcribed by hand from OSPI's page and dated.
 *
 * Source, checked 2026-07-28:
 * https://ospi.k12.wa.us/policy-funding/school-apportionment/guidance-and-tools/school-district-budget-challenges-and-financial-insolvency
 *
 * To refresh: open that page, read the "School Districts on Binding
 * Conditions" section, and update both the entries and CHECKED_ON below.
 */
export const OVERSIGHT_SOURCE =
  'https://ospi.k12.wa.us/policy-funding/school-apportionment/guidance-and-tools/school-district-budget-challenges-and-financial-insolvency';

export const OVERSIGHT_CHECKED_ON = 'July 28, 2026';

export type OversightLevel = 'binding' | 'enhanced';

export type Oversight = {
  level: OversightLevel;
  /** Date of the most recent document OSPI has posted for this district. */
  since: string;
  /** One line on what state involvement looks like here. */
  detail: string;
  /**
   * What the district itself has done since oversight began - cuts, sales,
   * a recovering reserve. Optional and, unlike `detail`, not transcribed from
   * OSPI: a district's own corrective steps rarely show up on that page at
   * all, let alone promptly, so this is filled in by hand from local
   * reporting or firsthand knowledge of the district as it comes in. Only
   * write this when it can be said plainly and without inventing a figure
   * nobody actually gave you - "cut central-office staff" is fine even
   * without a headcount, a made-up headcount is not.
   */
  response?: string;
};

export const OVERSIGHT: Record<string, Oversight> = {
  // Whatcom - on binding conditions since July 2023.
  '37507': {
    level: 'binding',
    since: 'October 2025',
    detail: 'On binding conditions since 2023; most recent OSPI update October 2025.',
  },
  // Walla Walla - escalated past binding conditions into enhanced oversight,
  // and a dissolution petition was rescinded in March 2026.
  '36402': {
    level: 'enhanced',
    since: 'March 2026',
    detail:
      'Escalated from binding conditions to enhanced financial oversight; a dissolution petition was rescinded in March 2026.',
  },
  '34002': {
    level: 'binding',
    since: 'September 2024',
    detail: 'Binding conditions letter issued September 2024.',
  },
  '23309': {
    level: 'binding',
    since: 'May 2026',
    detail: 'On binding conditions since January 2025; most recent OSPI update May 2026.',
  },
  '39120': {
    level: 'binding',
    since: 'April 2026',
    detail: 'Most recent OSPI binding conditions update April 2026.',
  },
  '17405': {
    level: 'binding',
    since: 'July 2025',
    detail: 'Binding conditions letter issued July 2025.',
    response:
      'Since then Bellevue has concentrated its cuts in the central office rather than the classroom, reducing central-office staff while keeping most student-facing programs running, and is preparing to sell a piece of district-owned land to help rebuild its reserves. Its financial position has reportedly improved since.',
  },
  '03052': {
    level: 'binding',
    since: 'June 2026',
    detail: 'Binding conditions letter issued June 2026.',
  },
  // Snohomish - has a state-appointed special administrator, the furthest
  // step short of dissolution.
  '31025': {
    level: 'enhanced',
    since: 'January 2026',
    detail:
      'Under binding conditions with a state-appointed special administrator; most recent OSPI update January 2026.',
  },
};

export function oversightFor(code: string): Oversight | null {
  return OVERSIGHT[code] ?? null;
}
