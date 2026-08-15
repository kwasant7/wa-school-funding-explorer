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
const H = 240;
const PAD = { top: 10, right: 12, bottom: 26, left: 34 };
/** Share of a band the bar fills; the rest is the gap between columns. */
const BAR_FILL = 0.62;
/*
  A segment shorter than this cannot hold a 10px number without the text
  crowding the band above it, so those shares are left to the axis and the
  hover card rather than stamped on and overlapping.
*/
const MIN_LABEL_SHARE = 7;

const TICKS = [0, 25, 50, 75, 100];

/**
 * Where a district's money came from, as one stacked column per year.
 *
 * Each column is a full 100%, so the columns compare composition rather than
 * size, and the percentage is written on any band tall enough to hold it -
 * the shift the chart exists to show (federal aid arriving for COVID, then
 * receding as ESSER expired) can be read off the bars themselves instead of
 * being estimated against an axis or uncovered by hovering.
 */
export default function RevenueTrendChart({ years }: { years: YearSlice[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = years.filter((y) => y.total > 0);
  if (points.length < 2) {
    return <p className="text-sm text-ink-muted">Not enough years of data.</p>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const bandW = innerW / points.length;
  const barW = bandW * BAR_FILL;
  const bandX = (i: number) => PAD.left + i * bandW;
  const barX = (i: number) => bandX(i) + (bandW - barW) / 2;
  const y = (share: number) => PAD.top + (1 - share / 100) * innerH;

  // Cumulative lower/upper share bounds per series, per year - stacked in the
  // legend's order, state at the bottom and other on top.
  const stacks = points.map((p) => {
    let run = 0;
    return SERIES.map((s) => {
      const share = (100 * p[s.key]) / p.total;
      const lower = run;
      run += share;
      return { key: s.key, share, lower, upper: run };
    });
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
          {/* Percentage axis, behind the bars */}
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={y(t)}
                y2={y(t)}
                stroke="#e7e5e0"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={y(t) + 3.5}
                fontSize="10"
                fill="#898781"
                textAnchor="end"
              >
                {t}%
              </text>
            </g>
          ))}

          {points.map((p, i) => (
            <g key={p.label}>
              {stacks[i].map((seg, si) => {
                const h = (seg.share / 100) * innerH;
                if (h <= 0) return null;
                return (
                  <g key={seg.key}>
                    <rect
                      x={barX(i)}
                      y={y(seg.upper)}
                      width={barW}
                      height={h}
                      fill={SERIES[si].color}
                      opacity={hover == null || hover === i ? 1 : 0.55}
                      style={{ transition: 'opacity 120ms' }}
                    />
                    {seg.share >= MIN_LABEL_SHARE && (
                      <text
                        x={barX(i) + barW / 2}
                        y={y(seg.lower + seg.share / 2) + 3.5}
                        fontSize="10"
                        fontWeight="600"
                        fill="#ffffff"
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        {Math.round(seg.share)}%
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={barX(i) + barW / 2}
                y={H - 8}
                fontSize="10"
                fill="#898781"
                textAnchor="middle"
              >
                {p.label.slice(2)}
              </text>
            </g>
          ))}

          {/* Generous hover targets, one per year */}
          {points.map((p, i) => (
            <rect
              key={`hit-${p.label}`}
              x={bandX(i)}
              y={0}
              width={bandW}
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
              left: `${(100 * (barX(hover!) + barW / 2)) / W}%`,
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
