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

/*
  Not rounded. Reserve ratios are stored to one decimal, so a rounded 8.2 line
  let Seattle's 8.155% (about 30 days, stored as 8.2) pass a strict `<` test
  and miss the "less than one month" label.
*/
const percentOfYear = (days: number) => (100 * days) / 365;

/** About 16.4 - the State Auditor's 60-day benchmark as a share of annual spending. */
export const RESERVE_BENCHMARK_PCT = percentOfYear(RESERVE_BENCHMARK_DAYS);
/** About 8.2 - one month of spending. */
export const RESERVE_THIN_PCT = percentOfYear(RESERVE_THIN_DAYS);

/**
 * Depth past which a negative fund balance is a real reserve shortfall rather
 * than a near-breakeven miss. A district can close a hair below zero - Bellevue
 * ended 2024-25 at -0.2% of spending, about $694K on a $426M budget - without
 * having "spent all its savings". Five days of spending (~1.4%) is the line:
 * shallower than this is described as a small year-end shortfall, deeper as
 * exhausted reserves carried forward.
 */
export const RESERVE_MARGINAL_NEGATIVE_PCT = -percentOfYear(5);

/** A reserve ratio (percent of annual spending) as days of operation. */
export function reserveDays(ratioPct: number) {
  return Math.round((ratioPct * 365) / 100);
}

/**
 * How much the ending fund balance actually moved this year, from the two
 * year-end balances. Not the same as revenue minus spending: general-fund
 * money moved to other funds (capital projects, debt service, buses) and
 * prior-year adjustments change the balance without appearing in either
 * total. Null when either balance is missing, including the first year.
 */
export function fundBalanceChange(d: {
  fundBalance: number | null;
  priorFundBalance?: number | null;
}): number | null {
  return d.fundBalance != null && d.priorFundBalance != null
    ? d.fundBalance - d.priorFundBalance
    : null;
}

/**
 * Whether the fund balance moved differently enough from revenue minus
 * spending that a reader needs to be told why - more than $100,000 and more
 * than half a percent of the year's spending.
 */
export function balanceGapIsMaterial(surplus: number, change: number | null, spending: number): boolean {
  if (change == null) return false;
  const gap = Math.abs(change - surplus);
  return gap > 100_000 && gap > 0.005 * spending;
}
