/**
 * Number formatting shared by every context section rendered as prose.
 *
 * Lives apart from the sections themselves because both the statewide block
 * and the district blocks have to format money identically - a visitor who
 * asks about the state and then about their district should not see the same
 * kind of figure written two different ways.
 */

export function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Thousands separators without depending on Intl being present in the runtime. */
export function commas(value: number): string {
  const rounded = Math.round(Math.abs(value)).toString();
  const grouped = rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return value < 0 ? `-${grouped}` : grouped;
}

export function dollars(value: number): string {
  return `$${commas(value)}`;
}

/** Big totals read better abbreviated; the exact figure follows in parentheses. */
export function bigDollars(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)} billion (${dollars(value)})`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)} million (${dollars(value)})`;
  return dollars(value);
}

/** "state $16.2 billion" for each entry that carries a usable number. */
export function labelled(
  pairs: [string, unknown][],
  format: (value: number) => string
): string[] {
  const out: string[] = [];
  for (const [label, raw] of pairs) {
    const value = num(raw);
    if (value !== null) out.push(`${label} ${format(value)}`);
  }
  return out;
}

export function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
