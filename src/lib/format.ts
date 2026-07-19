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

export function pct(part: number, whole: number, digits = 0): string {
  if (!whole) return '0%';
  return `${((100 * part) / whole).toFixed(digits)}%`;
}
