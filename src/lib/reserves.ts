/*
  Reserve benchmarks, in one place so every page draws the same lines.

  The reference is the Washington State Auditor's Office. Its Financial
  Intelligence Tool rates a school district's general fund by "fund balance
  sufficiency" - ending fund balance expressed as days of spending - against a
  benchmark of at least 60 days, and calls a year that misses it "Concerning".
  SAO takes the 60 days from GFOA's two-months-of-operating-spending guideline,
  and says the tool is not prescriptive guidance. Neither OSPI nor SAO
  recommends a minimum reserve percentage; each school board sets its own in
  policy (WSSDA model policy 6022). OSPI's financial-health model does score
  reserves, but on unrestricted balance against revenue, as a monitoring tool.
  Source: https://www.sao.wa.gov/sites/default/files/2024-10/FIT%20Financial%20Health%20Indicators%20Reference%20Guide.pdf

  This site's reserve ratio - total ending general-fund balance ÷ annual
  general-fund spending - is close to SAO's measure, which also counts debt
  service and transfers out in the denominator. So 60 days is read here as
  60/365 of a year's spending, about 16.4%.

  One month of spending is the site's own plain-language marker for "thin",
  not a state standard. It replaced a 5% line, about 18 days, after a district
  business office pointed out that 5% is less than a month of expenses.
*/

export const RESERVE_BENCHMARK_DAYS = 60;
export const RESERVE_THIN_DAYS = 30;

const percentOfYear = (days: number) => Math.round((1000 * days) / 365) / 10;

/** 16.4 - the State Auditor's 60-day benchmark as a share of annual spending. */
export const RESERVE_BENCHMARK_PCT = percentOfYear(RESERVE_BENCHMARK_DAYS);
/** 8.2 - one month of spending. */
export const RESERVE_THIN_PCT = percentOfYear(RESERVE_THIN_DAYS);

/** A reserve ratio (percent of annual spending) as days of operation. */
export function reserveDays(ratioPct: number) {
  return Math.round((ratioPct * 365) / 100);
}
