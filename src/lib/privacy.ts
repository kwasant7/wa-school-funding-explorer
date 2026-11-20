import { fmtInt } from '@/lib/format';

/**
 * OSPI's small-group display rules, from "Ensuring Student Privacy in Public
 * Reporting" (September 2023): a student group under 10 is not shown, nor is
 * a group whose complement is under 10 (it can be backed out of the total),
 * and a group above 95% is shown only as "over 95%".
 *
 * OSPI's own Report Card file publishes most of these counts, but this site
 * turns them into named sentences, percentages and printed handouts about one
 * district, so every surface that shows a student-group count or share goes
 * through here. Calculations (the simulator, LAP per student) keep the raw
 * numbers; only what is displayed changes.
 */
export const SMALL_GROUP = 10;
export const TOP_RANGE_PCT = 95;

/** 'ok' shows as is; 'small' is 1-9 students; 'complement' leaves 1-9 outside it; 'high' is over 95%. */
export type GroupStatus = 'ok' | 'small' | 'complement' | 'high';

/** `suppressed` is true where OSPI's file already withheld the group (its ">95%" rule). */
export function groupStatus(count: number, total: number, suppressed = false): GroupStatus {
  if (suppressed) return 'high';
  if (total <= 0 || count <= 0) return 'ok';
  if (count < SMALL_GROUP) return 'small';
  if ((100 * count) / total > TOP_RANGE_PCT) return 'high';
  const rest = total - count;
  if (rest > 0 && rest < SMALL_GROUP) return 'complement';
  return 'ok';
}

/** A count for a table cell or a sentence: the number, or what stands in for it. */
export function groupCount(count: number, total: number, suppressed = false): string {
  switch (groupStatus(count, total, suppressed)) {
    case 'small':
      return 'Fewer than 10';
    case 'complement':
    case 'high':
      return 'Not shown';
    default:
      return fmtInt(count);
  }
}

/** A share of enrollment: the percentage, or what stands in for it. */
export function groupShare(count: number, total: number, digits = 1, suppressed = false): string {
  switch (groupStatus(count, total, suppressed)) {
    case 'high':
      return 'Over 95%';
    case 'small':
    case 'complement':
      return 'Not shown';
    default:
      return `${((100 * count) / Math.max(total, 1)).toFixed(digits)}%`;
  }
}

/** The share as a number where it may be shown, else null. */
export function groupRate(count: number, total: number, suppressed = false): number | null {
  return groupStatus(count, total, suppressed) === 'ok' && total > 0 ? (100 * count) / total : null;
}

/** Whether OSPI's own file withheld this group (see `demo.suppressed` in fetch-data). */
export function withheldByOspi(demo: { suppressed?: readonly unknown[] }, key: string): boolean {
  return (demo.suppressed ?? []).includes(key);
}
