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
 * Source, checked 2026-11-18:
 * https://ospi.k12.wa.us/policy-funding/school-apportionment/guidance-and-tools/school-district-budget-challenges-and-financial-insolvency
 *
 * To refresh: open that page, read the "School Districts on Binding
 * Conditions" section, and update both the entries and CHECKED_ON below.
 */
export const OVERSIGHT_SOURCE =
  'https://ospi.k12.wa.us/policy-funding/school-apportionment/guidance-and-tools/school-district-budget-challenges-and-financial-insolvency';

export const OVERSIGHT_CHECKED_ON = 'November 18, 2026';

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

/*
  Bellevue (17405) left this list: OSPI posted its formal release from binding
  conditions on November 16, 2026, and now lists it under "School Districts
  Exited from Binding Conditions".
*/
export const OVERSIGHT: Record<string, Oversight> = {
  // Mount Baker - on binding conditions since July 2023.
  '37507': {
    level: 'binding',
    since: 'October 2025',
    detail: 'On binding conditions since 2023; most recent OSPI update October 2025.',
  },
  // Prescott - OSPI's page files it under "Binding Conditions", but its letters
  // say more: enhanced financial oversight from June 2025, and the March 25,
  // 2026 letter says it "will remain under Enhanced Financial Oversight for
  // the 2026-27 school year". Read the letters, not just the page heading.
  '36402': {
    level: 'enhanced',
    since: 'March 2026',
    detail:
      'On binding conditions since March 2024 and under enhanced financial oversight since June 2025; OSPI rescinded its petition to dissolve the district in March 2026.',
  },
  // Yelm
  '34002': {
    level: 'binding',
    since: 'September 2026',
    detail: 'On binding conditions since September 2024; most recent OSPI update September 2026.',
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
  // Kiona-Benton City
  '03052': {
    level: 'binding',
    since: 'June 2026',
    detail: 'Binding conditions letter issued June 2026.',
  },
  // Marysville - had a state-appointed special administrator from September
  // 2024; OSPI changed its level of oversight in December 2025 and updated its
  // binding conditions in January 2026.
  '31025': {
    level: 'binding',
    since: 'January 2026',
    detail:
      'On binding conditions since 2023, with a state-appointed special administrator from 2024 until OSPI changed its level of oversight in December 2025; most recent OSPI update January 2026.',
  },
  // Burlington-Edison
  '29100': {
    level: 'binding',
    since: 'August 2026',
    detail: 'Binding conditions letter issued August 2026.',
  },
  // Vancouver
  '06037': {
    level: 'binding',
    since: 'August 2026',
    detail: 'Binding conditions letter issued August 2026.',
  },
  // Prosser
  '03116': {
    level: 'binding',
    since: 'September 2026',
    detail: 'Binding conditions letter issued September 2026.',
  },
};

export function oversightFor(code: string): Oversight | null {
  return OVERSIGHT[code] ?? null;
}
