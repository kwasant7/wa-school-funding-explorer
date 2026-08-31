'use client';

import { useMemo, useState } from 'react';
import { fmtInt, fmtMoneyFull } from '@/lib/format';

export type NeedPoint = {
  code: string;
  name: string;
  /** State revenue per funding FTE. */
  perStudent: number;
  lowIncome: number;
  ell: number;
  sped: number;
  enrollment: number;
};

type Axis = 'lowIncome' | 'ell' | 'sped';

const AXES: { id: Axis; label: string; noun: string; axis: string }[] = [
  {
    id: 'lowIncome',
    label: 'Low-income',
    noun: 'low-income students',
    axis: 'Share of students who are low-income',
  },
  {
    id: 'ell',
    label: 'ELL',
    noun: 'English language learners',
    axis: 'Share of students who are English language learners',
  },
  {
    id: 'sped',
    label: 'Special education',
    noun: 'students with disabilities',
    axis: 'Share of students with disabilities',
  },
];

const W = 720;
const H = 340;
// Left padding carries the "$40K" tick labels plus the rotated axis title
// standing outside them.
const PAD = { top: 16, right: 16, bottom: 42, left: 80 };

/**
 * Y range covering all but a handful of very small districts. Those sit far
 * above everyone else because of small-school funding enhancements, and
 * letting them set the scale would flatten all 300-odd real points into a
 * band at the bottom. They stay in the regression - only the drawing is
 * clipped, and the caption says how many.
 */
const Y_MIN = 10_000;
const Y_MAX = 40_000;

function leastSquares(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  const slope = sxy / sxx;
  return {
    slope,
    intercept: my - slope * mx,
    r2: (sxy * sxy) / (sxx * syy),
  };
}

/**
 * State funding per student against how much need a district carries. The
 * flat line is the finding: Washington's formula sends nearly the same amount
 * per student whether a district serves very few high-need students or very
 * many.
 */
export default function NeedVsFundingChart({
  points,
  highlight,
}: {
  points: NeedPoint[];
  highlight?: string;
}) {
  const [axis, setAxis] = useState<Axis>('lowIncome');
  const [hover, setHover] = useState<NeedPoint | null>(null);

  const { fit, xMax, offScale } = useMemo(() => {
    const xs = points.map((p) => p[axis]);
    const ys = points.map((p) => p.perStudent);
    const top = Math.max(0.2, Math.ceil(Math.max(...xs) * 10) / 10);
    return {
      fit: leastSquares(xs, ys),
      xMax: top,
      offScale: points.filter((p) => p.perStudent > Y_MAX).length,
    };
  }, [points, axis]);

  const x = (v: number) => PAD.left + (v / xMax) * (W - PAD.left - PAD.right);
  const y = (v: number) => {
    const clamped = Math.min(Y_MAX, Math.max(Y_MIN, v));
    return (
      PAD.top +
      (1 - (clamped - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PAD.top - PAD.bottom)
    );
  };

  const active = AXES.find((a) => a.id === axis)!;
  const yTicks = [10_000, 15_000, 20_000, 25_000, 30_000, 35_000, 40_000];
  const xTicks = Array.from({ length: 6 }, (_, i) => (xMax * i) / 5);

  return (
    <figure>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-line">
          {AXES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAxis(a.id)}
              aria-pressed={axis === a.id}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                axis === a.id
                  ? 'bg-accent text-white'
                  : 'bg-surface text-ink-secondary hover:bg-accent-wash'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        {fit && (
          <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-secondary">
            R² = {fit.r2.toFixed(3)}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`State funding per student against the share of ${active.noun}, by district. R squared ${
          fit ? fit.r2.toFixed(3) : 'not available'
        }.`}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="#e1e0d9"
              strokeWidth="1"
            />
            <text x={PAD.left - 8} y={y(t) + 3} fontSize="10" fill="#898781" textAnchor="end">
              ${Math.round(t / 1000)}K
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text
            key={t}
            x={x(t)}
            y={H - PAD.bottom + 16}
            fontSize="10"
            fill="#898781"
            textAnchor="middle"
          >
            {Math.round(t * 100)}%
          </text>
        ))}

        {points.map((p) => {
          const isHi = p.code === highlight;
          return (
            <circle
              key={p.code}
              cx={x(p[axis])}
              cy={y(p.perStudent)}
              r={isHi ? 6 : 3.5}
              fill={isHi ? '#d15f78' : '#2a78d6'}
              fillOpacity={isHi ? 1 : 0.42}
              stroke={isHi ? '#fcfcfb' : 'none'}
              strokeWidth={isHi ? 2 : 0}
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}

        {fit && (
          <line
            x1={x(0)}
            x2={x(xMax)}
            y1={y(fit.intercept)}
            y2={y(fit.intercept + fit.slope * xMax)}
            stroke="#104281"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        )}

        <line
          x1={PAD.left}
          x2={PAD.left}
          y1={PAD.top}
          y2={H - PAD.bottom}
          stroke="#c3c2b7"
        />
        {/*
          The vertical axis carried tick labels but no title, so "$25K" was a
          number with no unit attached - and this chart's whole argument is
          about what that number is (state money only, per student, not total
          revenue). Rotated rather than stacked so it cannot be mistaken for a
          heading.
        */}
        <text
          transform={`translate(15, ${(PAD.top + (H - PAD.bottom)) / 2}) rotate(-90)`}
          fontSize="11"
          fill="#52514e"
          textAnchor="middle"
          fontWeight="600"
        >
          State funding per student →
        </text>
        <text
          x={PAD.left}
          y={H - 6}
          fontSize="11"
          fill="#52514e"
          textAnchor="start"
          fontWeight="600"
        >
          {active.axis} →
        </text>
      </svg>

      {/*
        Two lines reserved, not one. A district's hover line wraps on a narrow
        card, and the extra line grew the figure, shifted the dots, and dropped
        the hover the moment it appeared.
      */}
      <p className="mt-1 min-h-[2.25rem] text-xs text-ink-muted">
        {hover ? (
          <>
            <strong className="text-ink">{hover.name}</strong> —{' '}
            {fmtMoneyFull(Math.round(hover.perStudent))} state per student ·{' '}
            {Math.round(hover[axis] * 100)}% {active.noun} ·{' '}
            {fmtInt(hover.enrollment)} students
          </>
        ) : (
          'Each dot is a district. Tap or hover one to see it.'
        )}
      </p>

      {/*
        The reading has to follow the number: with the small-district filters
        on, the R² here moves from ~0.01 to ~0.18, and a caption hard-wired to
        say "almost none" would then be contradicting its own figure.
      */}
      <figcaption className="mt-2 text-sm text-ink-secondary">
        {!fit || fit.r2 < 0.02 ? (
          <>
            The dashed line barely tilts: an R² of{' '}
            <strong className="text-ink">{fit ? fit.r2.toFixed(3) : '—'}</strong>{' '}
            means {active.noun} explain almost none of the difference in state
            funding per student.
          </>
        ) : fit.r2 < 0.3 ? (
          <>
            The dashed line tilts, but only gently: an R² of{' '}
            <strong className="text-ink">{fit.r2.toFixed(3)}</strong> means{' '}
            {active.noun} explain only a small part of the difference in state
            funding per student.
          </>
        ) : (
          <>
            The dashed line tilts: an R² of{' '}
            <strong className="text-ink">{fit.r2.toFixed(3)}</strong> means{' '}
            {active.noun} explain a meaningful part of the difference in state
            funding per student.
          </>
        )}
        {offScale > 0 && (
          <>
            {' '}
            {offScale} very small districts sit above this view, still counted
            in the trend line.
          </>
        )}
      </figcaption>
    </figure>
  );
}
