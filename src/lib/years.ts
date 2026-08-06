/**
 * Which school years the site has data for.
 *
 * Deliberately separate from lib/data.ts. Several modules need only the list of
 * year labels - the header's year picker, the assistant's request validator -
 * and importing them from lib/data.ts pulled in history.json, a one-megabyte
 * six-year dataset, purely to read a six-element array of strings. Because both
 * of those modules are reachable from the root layout, webpack put that
 * megabyte in the shared chunk of every route, so /404 and /sources downloaded
 * the full funding history to render text.
 *
 * scripts/fetch-data.mjs emits years.json (about 90 bytes) alongside
 * history.json, so the two cannot drift.
 */
import yearsJson from '@/data/years.json';

export const YEARS: string[] = yearsJson.years;
export const LATEST: string = yearsJson.latest;
