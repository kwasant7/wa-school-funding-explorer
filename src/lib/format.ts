export function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${sign}$${Math.round(abs / 1e3).toLocaleString()}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

export function fmtMoneyFull(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
}

export function fmtSignedMoney(n: number): string {
  if (Math.round(n) === 0) return 'no change';
  return `${n > 0 ? '+' : '−'}${fmtMoney(Math.abs(n)).replace('−', '')}`;
}

/**
 * Two amounts and their difference, rounded onto one shared display grid.
 *
 * The bars of a "versus" chart and the gap printed beneath them used to be
 * rounded independently, so 68% of district briefs shipped a figure whose two
 * bars did not subtract to its own caption - the one check a reader can make
 * without leaving the page, failing in the document people carry to a
 * legislator. Snapping all three onto a shared grid closes the arithmetic by
 * construction: `gap` here is the difference of the values actually printed,
 * not a separately-rounded copy of the true difference.
 *
 * The grid is chosen as the coarsest that still resolves the gap to two
 * significant figures, so the caption stays within a fraction of a percent of
 * the real shortfall while the bar labels stay short.
 */
export type AlignedPair = {
  /** First amount, as displayed. In every brief this is the larger (the
      cost); the Big 3 card keeps cost first even when funding won, so `a`
      can be the smaller of the two there. */
  a: number;
  /** Second amount, as displayed. */
  b: number;
  /** Exactly `a - b` - negative when `b` is the larger. */
  gap: number;
  /** Rounding step all three share. */
  step: number;
};

export function alignPair(a: number, b: number): AlignedPair {
  const spread = Math.abs(a - b);
  if (!(spread > 0)) return { a, b, gap: 0, step: 1 };

  /*
    Two significant figures on the gap. The grid is set by the gap rather than
    by the size of the bars, because the gap is the claim being made: a $24k
    shortfall between two $1.4M bars needs a $1,000 grid, and picking the grid
    off the bars would round it away to nothing.
  */
  const step = Math.max(1, 10 ** (Math.floor(Math.log10(spread)) - 1));
  const ra = Math.round(a / step) * step;
  const rb = Math.round(b / step) * step;
  return { a: ra, b: rb, gap: ra - rb, step };
}

const MONEY_UNITS: [number, string][] = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
  [1, ''],
];

/**
 * Money rendered without losing a grid's precision.
 *
 * `fmtMoney` picks its decimal count from the magnitude, which silently
 * discards the resolution `alignPair` just established - a $43.4M bar
 * collapsing to "$43M" reopens exactly the arithmetic gap these functions
 * exist to close. This picks the *unit* so the grid survives at no more than
 * two decimals, stepping down from "M" to "K" to whole dollars rather than
 * growing a long decimal tail. Two $1.4M bars a hair apart print as
 * "$1,391K" and "$1,367K", which is honest and still subtracts on sight.
 */
export function fmtMoneyOnGrid(n: number, step: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';

  for (const [unit, suffix] of MONEY_UNITS) {
    if (unit > 1 && abs < unit) continue;
    const decimals = Math.max(0, Math.ceil(Math.log10(unit / step) - 1e-9));
    if (decimals > 2) continue;
    const shown = (abs / unit).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${sign}$${shown}${suffix}`;
  }

  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

export function pct(part: number, whole: number, digits = 0): string {
  if (!whole) return '0%';
  return `${((100 * part) / whole).toFixed(digits)}%`;
}

/**
 * Percent of a whole, but never a flat "0%" for money that is actually there.
 * A $703,243 line rounding to "0%" reads as nothing at all, when the honest
 * answer is that it is small but non-zero.
 */
export function pctLabel(part: number, whole: number): string {
  if (!whole || part === 0) return '0%';
  const p = (100 * part) / whole;
  if (p > 0 && p < 0.5) return '<1%';
  if (p < 0 && p > -0.5) return '>−1%';
  return `${Math.round(p)}%`;
}
