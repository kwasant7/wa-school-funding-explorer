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
 * Source, checked 2026-11-20 (each detail line read against the district's letters):
 * https://ospi.k12.wa.us/policy-funding/school-apportionment/guidance-and-tools/school-district-budget-challenges-and-financial-insolvency
 *
 * To refresh: open that page, read the "School Districts on Binding
 * Conditions" section, and update both the entries and CHECKED_ON below.
 */
export const OVERSIGHT_SOURCE =
  'https://ospi.k12.wa.us/policy-funding/school-apportionment/guidance-and-tools/school-district-budget-challenges-and-financial-insolvency';

export const OVERSIGHT_CHECKED_ON = 'November 20, 2026';

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
    detail:
      'Its board adopted a 2023-24 budget showing a negative balance, and it has been on binding conditions since 2023. OSPI\'s October 2025 update says the district "has made significant progress" and expects it to meet all conditions in November 2026.',
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
    detail:
      'Its board adopted a 2024-25 budget showing a negative balance, and it has been on binding conditions since September 2024. OSPI\'s September 2026 update says it will convene a Financial Oversight Committee if the district\'s 2025-26 financial statement misses its targets.',
  },
  '23309': {
    level: 'binding',
    since: 'May 2026',
    detail:
      'It ended 2023-24 with a negative balance and has been on binding conditions since January 2025. OSPI\'s May 2026 update says the district "has made significant progress" and is "on track to far exceed" its 2025-26 fund-balance condition.',
  },
  '39120': {
    level: 'binding',
    since: 'April 2026',
    // From OSPI's April 17, 2026 update letter (binding conditions began with
    // its June 4, 2025 letter).
    detail:
      "Its board adopted a budget showing a negative balance, and it has been on binding conditions since June 2025. OSPI's April 2026 update says the district \"has made significant progress\" and expects it to continue toward solvency.",
  },
  // Kiona-Benton City
  '03052': {
    level: 'binding',
    since: 'June 2026',
    detail:
      'Its board adopted a 2025-26 budget extension showing a negative balance, and OSPI set interim binding conditions in June 2026. OSPI expects to update these conditions, or form a Financial Oversight Committee, after reviewing its 2025-26 financial statements.',
  },
  // Marysville - from OSPI's January 13, 2026 letter: requested binding
  // conditions August 2023; Enhanced Financial Oversight with a special
  // administrator from August 2024; released "as an outcome of their improved
  // financial position"; binding conditions re-established through 2026-27.
  '31025': {
    level: 'binding',
    since: 'January 2026',
    detail:
      'Its board projected a negative 2023-24 balance and asked for binding conditions in 2023; a state-appointed special administrator followed in 2024. OSPI released it from that enhanced oversight in December 2025, citing its improved financial position, kept binding conditions in place, and said it will consider a full release in November 2026.',
  },
  // Burlington-Edison
  '29100': {
    level: 'binding',
    since: 'August 2026',
    detail:
      'Its board adopted a 2026-27 budget showing a negative balance, and OSPI set interim binding conditions in August 2026. OSPI expects to update these conditions, or form a Financial Oversight Committee, after reviewing its 2025-26 financial statements.',
  },
  // Vancouver
  '06037': {
    level: 'binding',
    since: 'August 2026',
    detail:
      'Its board adopted a 2025-26 budget extension showing a negative balance, and OSPI set interim binding conditions in August 2026. OSPI expects to update these conditions, or form a Financial Oversight Committee, after reviewing its 2025-26 financial statements.',
  },
  // Prosser
  '03116': {
    level: 'binding',
    since: 'September 2026',
    detail:
      'Its board adopted a 2025-26 budget extension showing a negative balance, and OSPI set interim binding conditions in September 2026. OSPI expects to update these conditions, or form a Financial Oversight Committee, after reviewing its 2025-26 financial statements.',
  },
};

export function oversightFor(code: string): Oversight | null {
  return OVERSIGHT[code] ?? null;
}
