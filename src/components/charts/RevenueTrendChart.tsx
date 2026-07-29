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

const W = 680;
const H = 190;
const PAD = { top: 10, right: 12, bottom: 26, left: 12 };

/**
 * Where a district's money came from, as a smooth stacked-share ribbon rather
 * than a row of separate bars. A stacked area reads the shift in composition
 * (federal aid arriving for COVID, then receding as ESSER expired) as a
 * single continuous shape instead of four disconnected columns the eye has to
 * compare bar-by-bar - and it does that without needing a number stamped on
 * every band, which is what made the bar version feel busy.
 */
export default function RevenueTrendChart({ years }: { years: YearSlice[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = years.filter((y) => y.total > 0);
  if (points.length < 2) {
    return <p className="text-sm text-ink-muted">Not enough years of data.</p>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (share: number) => PAD.top + (1 - share / 100) * innerH;

  // Cumulative lower/upper share bounds for each series, per year - the
  // stack order is the same as the legend: state at the bottom, other on top.
  const stacks = points.map((p) => {
    let run = 0;
    return SERIES.map((s) => {
      const share = (100 * p[s.key]) / p.total;
      const lower = run;
      run += share;
      return { key: s.key, share, lower, upper: run };
    });
  });

  const bands = SERIES.map((s, si) => {
    const top = points.map((_, i) => `${x(i)},${y(stacks[i][si].upper)}`);
    const bottom = points
      .map((_, i) => `${x(i)},${y(stacks[i][si].lower)}`)
      .reverse();
    return { ...s, path: `M${top.join('L')}L${bottom.join('L')}Z` };
  });

  const active = hover != null ? points[hover] : null;
  const activeStack = hover != null ? stacks[hover] : null;

  return (
    <figure>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Revenue mix by year: ${points
            .map(
              (p) =>
                `${p.label} ${SERIES.map((s) => `${s.label} ${Math.round((100 * p[s.key]) / p.total)}%`).join(', ')}`
            )
            .join('; ')}`}
        >
          {bands.map((b) => (
            <path
              key={b.key}
              d={b.path}
              fill={b.color}
              opacity={hover != null && activeStack ? 0.9 : 0.82}
              style={{ transition: 'opacity 120ms' }}
            />
          ))}
          {/* Guideline + year ticks */}
          {points.map((p, i) => (
            <g key={p.label}>
              {hover === i && (
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={PAD.top}
                  y2={PAD.top + innerH}
                  stroke="#fcfcfb"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  opacity={0.8}
                />
              )}
              <text
                x={x(i)}
                y={H - 8}
                fontSize="10"
                fill="#898781"
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              >
                {p.label.slice(2)}
              </text>
            </g>
          ))}
          {/* Generous hover targets, one per year */}
          {points.map((_, i) => (
            <rect
              key={i}
              x={x(i) - innerW / (points.length - 1) / 2}
              y={0}
              width={innerW / (points.length - 1)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>

        {active && activeStack && (
          <div
            className="pointer-events-none absolute top-1 card px-2.5 py-2 text-xs shadow-md"
            style={{
              left: `${(100 * x(hover!)) / W}%`,
              transform: `translateX(${hover! > points.length / 2 ? '-100%' : '0'})`,
            }}
          >
            <p className="font-semibold">
              {active.label} · {fmtMoney(active.total)}
            </p>
            <div className="mt-1 space-y-0.5">
              {SERIES.map((s, si) => (
                <p key={s.key} className="flex items-center gap-1.5 tabular-nums">
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ background: s.color }}
                    aria-hidden
                  />
                  <span className="text-ink-secondary">{s.label}</span>
                  <span className="font-medium">
                    {fmtMoney(active[s.key])} ({Math.round(activeStack[si].share)}%)
                  </span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
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
