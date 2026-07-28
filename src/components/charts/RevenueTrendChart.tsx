'use client';

import { useState } from 'react';
import { fmtMoney } from '@/lib/format';

export type YearSlice = {
  label: string;
  local: number;
  state: number;
  federal: number;
  other: number;
  total: number;
};

const SERIES: { key: 'state' | 'local' | 'federal' | 'other'; label: string; color: string }[] = [
  { key: 'state', label: 'State', color: '#2a78d6' },
  { key: 'local', label: 'Local', color: '#1baf7a' },
  { key: 'federal', label: 'Federal', color: '#eda100' },
  { key: 'other', label: 'Other', color: '#94a3b8' },
];

/**
 * Where a district's money came from, year by year. Shares rather than raw
 * dollars is the point: the interesting movement is federal COVID money
 * arriving and then falling away, which a dollar-height chart buries under
 * general growth.
 */
export default function RevenueTrendChart({ years }: { years: YearSlice[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const points = years.filter((y) => y.total > 0);
  if (points.length < 2) {
    return <p className="text-sm text-ink-muted">Not enough years of data.</p>;
  }

  return (
    <figure>
      <div className="flex gap-1.5">
        {points.map((y) => {
          const segs = SERIES.map((s) => ({
            ...s,
            value: y[s.key],
            share: (100 * y[s.key]) / y.total,
          })).filter((s) => s.share > 0);
          return (
            <div key={y.label} className="flex min-w-0 flex-1 flex-col">
              <div
                className="flex h-40 w-full flex-col-reverse overflow-hidden rounded"
                role="img"
                aria-label={`${y.label}: ${segs
                  .map((s) => `${s.label} ${Math.round(s.share)}%`)
                  .join(', ')}`}
              >
                {segs.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-center transition-opacity"
                    style={{
                      height: `${s.share}%`,
                      background: s.color,
                      opacity: hover && hover !== s.key ? 0.35 : 1,
                    }}
                    onMouseEnter={() => setHover(s.key)}
                    onMouseLeave={() => setHover(null)}
                    title={`${y.label} ${s.label}: ${fmtMoney(s.value)} (${Math.round(s.share)}%)`}
                  >
                    {s.share >= 11 && (
                      <span className="select-none text-[11px] font-semibold text-white tabular-nums">
                        {Math.round(s.share)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-1.5 text-center text-[11px] leading-tight text-ink-muted tabular-nums">
                {y.label.slice(2)}
              </div>
              <div className="text-center text-[11px] font-medium leading-tight tabular-nums">
                {fmtMoney(y.total)}
              </div>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {SERIES.map((s) => (
          <span
            key={s.key}
            className="flex items-center gap-1.5"
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color }}
              aria-hidden
            />
            <span className="text-ink-secondary">{s.label}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
