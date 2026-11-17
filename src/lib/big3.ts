/**
 * The "Big 3" - special education, transportation and MSOC - for one district,
 * as AESD's Big 3 dashboard reports it (see scripts/fetch-big3.py for how the
 * figures are defined and where they come from).
 *
 * One place does the arithmetic so the brief, its PDF and anything else that
 * quotes these gaps cannot drift apart: a gap is what a program costs minus the
 * funding that arrives for it, and a district's total counts only the programs
 * that fall short.
 */
import big3Json from '@/data/big3.json';

export type Big3Program = { revenue: number; cost: number };
export type Big3Key = 'sped' | 'transportation' | 'msoc';
export type Big3Record = Record<Big3Key, Big3Program> & {
  /** K-12 basic plus alternative learning students, without Running Start. */
  students: number;
};

export const BIG3_YEAR: string = big3Json.schoolYear;
const BIG3 = big3Json.districts as Record<string, Big3Record>;

export const BIG3_KEYS: readonly Big3Key[] = ['sped', 'transportation', 'msoc'];

/** AESD's figures for this district, or null where it publishes none. */
export function big3For(code: string): Big3Record | null {
  return BIG3[code] ?? null;
}

/** What the program costs beyond its funding; negative when funding covers it. */
export function big3Gap(program: Big3Program): number {
  return program.cost - program.revenue;
}

export type Big3Totals = {
  gaps: Record<Big3Key, number>;
  /** Only the programs that fall short, added together. */
  total: number;
  /** `total` divided by AESD's student count, as its per-pupil amounts are. */
  perStudent: number;
};

export function big3Totals(record: Big3Record): Big3Totals {
  const gaps = {
    sped: big3Gap(record.sped),
    transportation: big3Gap(record.transportation),
    msoc: big3Gap(record.msoc),
  };
  const total = BIG3_KEYS.reduce((sum, key) => sum + Math.max(0, gaps[key]), 0);
  return {
    gaps,
    total,
    perStudent: record.students > 0 ? total / record.students : 0,
  };
}
