'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import data from '@/data/districts.json';
import { fmtInt, fmtMoney, fmtSignedMoney } from '@/lib/format';

/**
 * Illustrative model of the biggest levers in the prototypical school formula.
 * Grade-band split approximates K-3 as 4/13 of total enrollment.
 */
const STUDENTS = data.statewide.enrollment;
const K3_STUDENTS = Math.round(STUDENTS * (4 / 13));
const OLDER_STUDENTS = STUDENTS - K3_STUDENTS;
const SCHOOLS = Math.round(STUDENTS / 450); // ~schools statewide at prototypical size
const STATE_SHARE = data.statewide.revenues.state;

const LEVERS = [
  {
    id: 'k3Class',
    group: 'Class sizes',
    label: 'K–3 students per teacher',
    baseline: 17,
    min: 10,
    max: 28,
    step: 0.5,
    format: (v: number) => v.toString(),
  },
  {
    id: 'olderClass',
    group: 'Class sizes',
    label: 'Grades 4–12 students per teacher',
    baseline: 28.5,
    min: 18,
    max: 35,
    step: 0.5,
    format: (v: number) => v.toString(),
  },
  {
    id: 'teacherComp',
    group: 'People',
    label: 'Funded compensation per teacher (salary + benefits)',
    baseline: 100_000,
    min: 70_000,
    max: 150_000,
    step: 5_000,
    format: (v: number) => `$${fmtInt(v)}`,
  },
  {
    id: 'counselors',
    group: 'People',
    label: 'Counselors per school',
    baseline: 1.0,
    min: 0,
    max: 4,
    step: 0.25,
    format: (v: number) => v.toFixed(2),
  },
  {
    id: 'nurses',
    group: 'People',
    label: 'Nurses per school',
    baseline: 0.5,
    min: 0,
    max: 3,
    step: 0.25,
    format: (v: number) => v.toFixed(2),
  },
  {
    id: 'msoc',
    group: 'Dollars',
    label: 'Materials, supplies & operating costs per student (MSOC)',
    baseline: 1_614,
    min: 800,
    max: 4_000,
    step: 50,
    format: (v: number) => `$${fmtInt(v)}`,
  },
] as const;

type LeverId = (typeof LEVERS)[number]['id'];
type Values = Record<LeverId, number>;

const BASELINE: Values = Object.fromEntries(
  LEVERS.map((l) => [l.id, l.baseline])
) as Values;

const SUPPORT_COMP = 110_000; // counselor/nurse salary + benefits

function modelCosts(v: Values) {
  const teachers = K3_STUDENTS / v.k3Class + OLDER_STUDENTS / v.olderClass;
  const teacherCost = teachers * v.teacherComp;
  const counselors = SCHOOLS * v.counselors;
  const nurses = SCHOOLS * v.nurses;
  const supportCost = (counselors + nurses) * SUPPORT_COMP;
  const msocCost = STUDENTS * v.msoc;
  return {
    teachers,
    counselors,
    nurses,
    teacherCost,
    supportCost,
    msocCost,
    total: teacherCost + supportCost + msocCost,
  };
}

const BASE = modelCosts(BASELINE);

const COST_SEGMENTS = [
  { key: 'teacherCost', label: 'Teachers', color: '#2a78d6' },
  { key: 'supportCost', label: 'Counselors & nurses', color: '#1baf7a' },
  { key: 'msocCost', label: 'MSOC', color: '#eda100' },
] as const;

export default function Simulator() {
  const [values, setValues] = useState<Values>(BASELINE);
  const sim = useMemo(() => modelCosts(values), [values]);

  const delta = sim.total - BASE.total;
  const deltaPerStudent = delta / STUDENTS;
  const deltaPctOfState = (100 * delta) / STATE_SHARE;
  const dirty = LEVERS.some((l) => values[l.id] !== l.baseline);
  const maxTotal = Math.max(sim.total, BASE.total);

  const groups = Array.from(new Set(LEVERS.map((l) => l.group)));

  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        Policy Simulator
      </h1>
      <p className="mt-3 max-w-2xl text-ink-secondary">
        You&apos;re the Legislature now. Move the levers of the prototypical
        school model and see roughly what your version of the formula would cost
        — or save — statewide, using real 2024–25 enrollment (
        {fmtInt(STUDENTS)} students).
      </p>

      <div className="mt-4 card p-4 bg-accent-wash border-accent-soft text-sm text-ink-secondary max-w-2xl">
        <strong className="text-ink">Educational estimate.</strong> This models
        the biggest levers (~$7B of the ~$16B state share) with simplified
        statewide averages. Real fiscal notes account for grade-by-grade
        enrollment, regionalization, special education, and much more — treat
        results as ballpark, not budget.
      </div>

      <div className="mt-8 grid lg:grid-cols-[1fr,26rem] gap-6 items-start">
        {/* Levers */}
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group} className="card p-5">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-ink-secondary">
                {group}
              </h2>
              <div className="mt-4 space-y-5">
                {LEVERS.filter((l) => l.group === group).map((lever) => {
                  const v = values[lever.id];
                  const changed = v !== lever.baseline;
                  return (
                    <div key={lever.id}>
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <label
                          htmlFor={lever.id}
                          className="text-sm md:text-base"
                        >
                          {lever.label}
                        </label>
                        <span
                          className={`text-sm font-semibold tabular-nums px-2 py-0.5 rounded ${
                            changed
                              ? 'bg-accent text-white'
                              : 'text-ink-secondary'
                          }`}
                        >
                          {lever.format(v)}
                        </span>
                      </div>
                      <input
                        id={lever.id}
                        type="range"
                        min={lever.min}
                        max={lever.max}
                        step={lever.step}
                        value={v}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [lever.id]: Number(e.target.value),
                          }))
                        }
                        className="mt-2 w-full"
                        style={{ accentColor: '#256abf' }}
                        aria-describedby={`${lever.id}-baseline`}
                      />
                      <div
                        id={`${lever.id}-baseline`}
                        className="flex justify-between text-xs text-ink-muted"
                      >
                        <span>{lever.format(lever.min)}</span>
                        <span>
                          current law ≈ {lever.format(lever.baseline)}
                          {changed && (
                            <button
                              onClick={() =>
                                setValues((prev) => ({
                                  ...prev,
                                  [lever.id]: lever.baseline,
                                }))
                              }
                              className="ml-2 text-accent hover:underline"
                            >
                              reset
                            </button>
                          )}
                        </span>
                        <span>{lever.format(lever.max)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Results */}
        <aside className="lg:sticky lg:top-6 space-y-4">
          <div className="card p-5">
            <h2 className="text-sm text-ink-secondary">
              Your plan vs. current law
            </h2>
            <p
              className={`mt-1 text-4xl font-bold tracking-tight ${
                delta > 0 ? 'text-accent-deep' : delta < 0 ? 'text-good' : ''
              }`}
            >
              {fmtSignedMoney(delta)}
              {Math.round(delta) !== 0 && (
                <span className="text-base font-normal text-ink-secondary">
                  {' '}
                  / year
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-ink-secondary">
              {Math.round(delta) === 0
                ? 'Move a lever to see the cost of your plan.'
                : delta > 0
                  ? `more state spending — about ${deltaPctOfState.toFixed(1)}% of what the state currently sends districts`
                  : `less state spending — about ${Math.abs(deltaPctOfState).toFixed(1)}% of what the state currently sends districts`}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm border-t border-line pt-4">
              <div>
                <dt className="text-ink-secondary">Per student</dt>
                <dd className="font-semibold tabular-nums">
                  {fmtSignedMoney(deltaPerStudent)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-secondary">Funded teachers</dt>
                <dd className="font-semibold tabular-nums">
                  {sim.teachers - BASE.teachers === 0
                    ? fmtInt(Math.round(sim.teachers))
                    : `${sim.teachers > BASE.teachers ? '+' : '−'}${fmtInt(Math.round(Math.abs(sim.teachers - BASE.teachers)))}`}
                </dd>
              </div>
              <div>
                <dt className="text-ink-secondary">Funded counselors</dt>
                <dd className="font-semibold tabular-nums">
                  {fmtInt(Math.round(sim.counselors))}
                </dd>
              </div>
              <div>
                <dt className="text-ink-secondary">Funded nurses</dt>
                <dd className="font-semibold tabular-nums">
                  {fmtInt(Math.round(sim.nurses))}
                </dd>
              </div>
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-ink-secondary mb-3">
              What the modeled dollars pay for
            </h2>
            {(
              [
                ['Current law', BASE],
                ['Your plan', sim],
              ] as const
            ).map(([label, costs]) => (
              <div key={label} className="mb-4 last:mb-0">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-secondary">{label}</span>
                  <span className="font-semibold tabular-nums">
                    {fmtMoney(costs.total)}
                  </span>
                </div>
                <div
                  className="mt-1 flex h-5 rounded overflow-hidden"
                  style={{ gap: 2, width: `${(100 * costs.total) / maxTotal}%` }}
                  role="img"
                  aria-label={`${label}: ${COST_SEGMENTS.map((seg) => `${seg.label} ${fmtMoney(costs[seg.key])}`).join(', ')}`}
                >
                  {COST_SEGMENTS.map((seg) => (
                    <div
                      key={seg.key}
                      style={{
                        width: `${(100 * costs[seg.key]) / costs.total}%`,
                        background: seg.color,
                      }}
                      title={`${seg.label}: ${fmtMoney(costs[seg.key])}`}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {COST_SEGMENTS.map((seg) => (
                <span key={seg.key} className="flex items-center gap-1.5 text-xs text-ink-secondary">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={{ background: seg.color }}
                    aria-hidden
                  />
                  {seg.label}
                </span>
              ))}
            </div>
          </div>

          {dirty && (
            <button
              onClick={() => setValues(BASELINE)}
              className="w-full card px-4 py-2.5 text-sm font-medium text-accent hover:border-accent transition-colors"
            >
              Reset everything to current law
            </button>
          )}

          <p className="text-xs text-ink-muted">
            Like your plan? {' '}
            <Link href="/take-action" className="text-accent hover:underline">
              Tell your legislators about it →
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
