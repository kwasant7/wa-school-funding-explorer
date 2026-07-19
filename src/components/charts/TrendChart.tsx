'use client';

import { useState } from 'react';

type Point = { label: string; value: number | null };

const W = 340;
const H = 120;
const PAD = { top: 14, right: 52, bottom: 20, left: 8 };

/**
 * Small single-series line chart across school years. Direct end label carries
 * the latest value; hover reveals each point.
 */
export default function TrendChart({
  points,
  format,
  ariaLabel,
}: {
  points: Point[];
  format: (v: number) => string;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (values.length < 2) {
    return <p className="text-sm text-ink-muted">Not enough years of data.</p>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lo = min - span * 0.12;
  const hi = max + span * 0.12;

  const x = (i: number) =>
    PAD.left + (i * (W - PAD.left - PAD.right)) / (points.length - 1);
  const y = (v: number) =>
    PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  // Consecutive runs of non-null points (a gap year breaks the line)
  const runs: { i: number; v: number }[][] = [];
  let run: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push({ i, v: p.value });
    }
  });
  if (run.length) runs.push(run);

  const lastIdx = points.map((p) => p.value).lastIndexOf(values[values.length - 1]);
  const gridVals = [lo + (hi - lo) * 0.15, lo + (hi - lo) * 0.85];
  const active = hover !== null && points[hover].value !== null ? hover : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${ariaLabel}: ${points
          .filter((p) => p.value !== null)
          .map((p) => `${p.label} ${format(p.value as number)}`)
          .join(', ')}`}
      >
        {gridVals.map((g) => (
          <g key={g}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(g)}
              y2={y(g)}
              stroke="#e1e0d9"
              strokeWidth="1"
            />
            <text x={W - PAD.right + 4} y={y(g) + 3} fontSize="9" fill="#898781">
              {format(g)}
            </text>
          </g>
        ))}
        {runs.map((r, ri) => (
          <polyline
            key={ri}
            points={r.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
            fill="none"
            stroke="#2a78d6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {points.map(
          (p, i) =>
            p.value !== null && (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={active === i ? 5 : 4}
                fill="#2a78d6"
                stroke="#fcfcfb"
                strokeWidth="2"
              />
            )
        )}
        {active === null && lastIdx >= 0 && points[lastIdx].value !== null && (
          <text
            x={x(lastIdx)}
            y={y(points[lastIdx].value as number) - 8}
            fontSize="10"
            fontWeight="600"
            fill="#0b0b0b"
            textAnchor="end"
          >
            {format(points[lastIdx].value as number)}
          </text>
        )}
        {points.map((p, i) => (
          <text
            key={p.label}
            x={x(i)}
            y={H - 6}
            fontSize="8.5"
            fill="#898781"
            textAnchor={i === 0 ? 'start' : 'middle'}
          >
            {p.label.slice(2)}
          </text>
        ))}
        {/* generous hover targets */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={x(i) - (W - PAD.left - PAD.right) / (points.length - 1) / 2}
            y={0}
            width={(W - PAD.left - PAD.right) / (points.length - 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {active !== null && (
        <div
          className="pointer-events-none absolute -top-1 card px-2.5 py-1.5 text-xs shadow-sm whitespace-nowrap"
          style={{
            left: `${(100 * x(active)) / W}%`,
            transform: `translateX(${active > points.length / 2 ? '-100%' : '0'})`,
          }}
        >
          <span className="text-ink-muted">{points[active].label}: </span>
          <span className="font-semibold">{format(points[active].value as number)}</span>
        </div>
      )}
    </div>
  );
}
