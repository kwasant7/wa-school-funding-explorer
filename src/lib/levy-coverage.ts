/**
 * The last levy election OSPI's levy worksheet includes. levy.json's own
 * source note says which elections it covers; a levy passed after this date
 * still shows as "no levy approved" until OSPI posts a new worksheet, so the
 * pages say the date outright. scripts/audit-districts.ts checks that the
 * note still names this date, so a refreshed worksheet forces an update here.
 *
 * Added after the November 3, 2026 election: Battle Ground, Kiona-Benton City
 * and Yelm passed levies the worksheet (updated October 7) does not have.
 */
export const LEVY_ELECTIONS_THROUGH = 'April 28, 2026';
