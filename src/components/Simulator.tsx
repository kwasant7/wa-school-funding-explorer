'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import data from '@/data/districts.json';
import { fmtInt, fmtMoney, fmtSignedMoney } from '@/lib/format';

const STUDENTS = data.statewide.enrollment;
const FUNDING_FTE = data.statewide.fundingEnrollment;
const STATE_SHARE = data.statewide.revenues.state;
const LOCAL_REVENUE = data.statewide.revenues.local;

const LOW_INCOME_STUDENTS = data.districts.reduce(
  (sum, district) => sum + district.demo.lowIncome,
  0
);
const ELL_STUDENTS = data.districts.reduce(
  (sum, district) => sum + district.demo.ell,
  0
);
const SPED_STUDENTS = data.districts.reduce(
  (sum, district) => sum + district.demo.sped,
  0
);
const HIGH_POVERTY_LOW_INCOME_STUDENTS = data.districts.reduce(
  (sum, district) =>
    district.enrollment > 0 &&
    district.demo.lowIncome / district.enrollment >= 0.6
      ? sum + district.demo.lowIncome
      : sum,
  0
);

const BASELINE_LAP_PER_STUDENT = 1_500;
const BASELINE_ELL_PER_STUDENT = 1_800;
const BASELINE_SPED_ALLOCATION = 12_000;
const BASELINE_LEA = 700_000_000;
const BASELINE_TRANSPORTATION = 1_200_000_000;

const LEVERS = [
  {
    id: 'lowIncomeWeight',
    group: 'Student needs',
    icon: 'lowIncome',
    label: 'Low-income support (LAP)',
    description: 'Extra help for students from low-income families.',
    impactKey: 'lowIncome',
    baseline: 1,
    min: 1,
    max: 2,
    step: 0.05,
    // Plain-language "what this actually does", instead of a bare multiplier
    effect: (value: number) =>
      `$${fmtInt(Math.round(BASELINE_LAP_PER_STUDENT * value))} per low-income student`,
    unit: 'per student',
  },
  {
    id: 'povertyBonus',
    group: 'Student needs',
    icon: 'poverty',
    label: 'High-poverty school bonus',
    description:
      'Extra money for schools where most students are low-income.',
    impactKey: 'poverty',
    baseline: 0,
    min: 0,
    max: 3_000,
    step: 100,
    effect: (value: number) =>
      value === 0
        ? 'No bonus today'
        : `+$${fmtInt(value)} per student in high-poverty districts`,
    unit: 'per student',
  },
  {
    id: 'ellWeight',
    group: 'Student needs',
    icon: 'ell',
    label: 'English learner support',
    description: 'Language help for students learning English.',
    impactKey: 'ell',
    baseline: 1,
    min: 1,
    max: 2,
    step: 0.05,
    effect: (value: number) =>
      `$${fmtInt(Math.round(BASELINE_ELL_PER_STUDENT * value))} per English learner`,
    unit: 'per student',
  },
  {
    id: 'spedMultiplier',
    group: 'Student needs',
    icon: 'sped',
    label: 'Special education',
    description: 'Services for students with disabilities.',
    impactKey: 'sped',
    baseline: 1.12,
    min: 1.12,
    max: 1.5,
    step: 0.01,
    effect: (value: number) =>
      value === 1.12
        ? 'Current level'
        : `+$${fmtInt(Math.round(BASELINE_SPED_ALLOCATION * (value - 1.12)))} per student with disabilities`,
    unit: 'per student',
  },
  {
    id: 'leaStrength',
    group: 'District equity',
    icon: 'lea',
    label: 'Help for property-poor districts',
    description:
      'State aid so districts with less local property wealth are not left behind.',
    impactKey: 'lea',
    baseline: 100,
    min: 100,
    max: 200,
    step: 5,
    effect: (value: number) =>
      `${fmtMoney(BASELINE_LEA * (value / 100))} statewide`,
    unit: 'statewide',
  },
  {
    id: 'levyCap',
    group: 'District equity',
    icon: 'levy',
    label: 'Local levy limit',
    description:
      'How much districts may raise locally if voters approve. Local money, not state money.',
    impactKey: null,
    baseline: 100,
    min: 100,
    max: 175,
    step: 5,
    effect: (value: number) =>
      value === 100
        ? "Today's limit"
        : `${fmtInt(value - 100)}% more local authority`,
    unit: 'local only',
  },
  {
    id: 'msoc',
    group: 'School operations',
    icon: 'msoc',
    label: 'Supplies & operating costs',
    description: 'Curriculum, technology, utilities, and insurance.',
    impactKey: 'msoc',
    baseline: 1_614,
    min: 1_614,
    max: 3_000,
    step: 50,
    effect: (value: number) => `$${fmtInt(value)} per student`,
    unit: 'per student',
  },
  {
    id: 'transportation',
    group: 'School operations',
    icon: 'transportation',
    label: 'Student transportation',
    description: 'Buses, drivers, fuel, and required routes.',
    impactKey: 'transportation',
    baseline: 100,
    min: 100,
    max: 140,
    step: 5,
    effect: (value: number) =>
      `${fmtMoney(BASELINE_TRANSPORTATION * (value / 100))} statewide`,
    unit: 'statewide',
  },
] as const;

/** Small pictograms so each lever reads at a glance. */
function LeverIcon({ name }: { name: string }) {
  const p = {
    viewBox: '0 0 24 24',
    className: 'h-5 w-5',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (name === 'lowIncome')
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 8.5c-.7-.6-1.6-.9-2.7-.9-1.6 0-2.8.8-2.8 2s1 1.8 3 2.3 3 1.2 3 2.4-1.3 2.1-3.1 2.1c-1.2 0-2.3-.4-3.1-1.1M12 5.5v13" />
      </svg>
    );
  if (name === 'poverty')
    return (
      <svg {...p}>
        <path d="m3 10 9-6 9 6M5 9v10h14V9M9 19v-5h6v5" />
      </svg>
    );
  if (name === 'ell')
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
      </svg>
    );
  if (name === 'sped')
    return (
      <svg {...p}>
        <path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z" />
      </svg>
    );
  if (name === 'lea')
    return (
      <svg {...p}>
        <path d="M4 20h16M6 20V10M12 20V6M18 20v-7" />
      </svg>
    );
  if (name === 'levy')
    return (
      <svg {...p}>
        <path d="M4 20h16M7 17h10M9 17V9h6v8M6 9h12L12 4z" />
      </svg>
    );
  if (name === 'msoc')
    return (
      <svg {...p}>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v14H6.5A2.5 2.5 0 0 0 4 20.5z" />
        <path d="M4 6.5v14M8 8h8M8 12h6" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M4 16V7a2 2 0 0 1 2-2h9v11M15 8h3.5L21 11v5h-2M4 16h2M11 16h6" />
      <circle cx="8" cy="17" r="1.6" />
      <circle cx="18" cy="17" r="1.6" />
    </svg>
  );
}

type LeverId = (typeof LEVERS)[number]['id'];
type Values = Record<LeverId, number>;

const BASELINE = Object.fromEntries(
  LEVERS.map((lever) => [lever.id, lever.baseline])
) as Values;

const IMPACT_SEGMENTS = [
  { key: 'lowIncome', label: 'Low-income / LAP', color: '#2a78d6' },
  { key: 'poverty', label: 'High-poverty bonus', color: '#7257c7' },
  { key: 'ell', label: 'ELL', color: '#1baf7a' },
  { key: 'sped', label: 'Special education', color: '#d15f78' },
  { key: 'lea', label: 'LEA', color: '#387a99' },
  { key: 'msoc', label: 'MSOC', color: '#eda100' },
  { key: 'transportation', label: 'Transportation', color: '#9a6a39' },
] as const;

function policyImpact(values: Values) {
  const impacts = {
    lowIncome:
      LOW_INCOME_STUDENTS *
      BASELINE_LAP_PER_STUDENT *
      (values.lowIncomeWeight - 1),
    poverty: HIGH_POVERTY_LOW_INCOME_STUDENTS * values.povertyBonus,
    ell:
      ELL_STUDENTS *
      BASELINE_ELL_PER_STUDENT *
      (values.ellWeight - 1),
    sped:
      SPED_STUDENTS *
      BASELINE_SPED_ALLOCATION *
      (values.spedMultiplier - 1.12),
    lea: BASELINE_LEA * (values.leaStrength / 100 - 1),
    msoc: FUNDING_FTE * (values.msoc - 1_614),
    transportation:
      BASELINE_TRANSPORTATION * (values.transportation / 100 - 1),
  };

  const stateTotal = Object.values(impacts).reduce(
    (sum, impact) => sum + impact,
    0
  );
  const localCapacity = LOCAL_REVENUE * (values.levyCap / 100 - 1);

  return { impacts, stateTotal, localCapacity };
}

export default function Simulator() {
  const [values, setValues] = useState<Values>(BASELINE);
  const result = useMemo(() => policyImpact(values), [values]);
  const dirty = LEVERS.some(
    (lever) => values[lever.id] !== lever.baseline
  );
  const groups = Array.from(new Set(LEVERS.map((lever) => lever.group)));
  const statePerStudent = result.stateTotal / STUDENTS;
  const statePercent = (100 * result.stateTotal) / STATE_SHARE;

  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        Build a school funding policy
      </h1>
      <p className="mt-3 max-w-3xl text-ink-secondary">
        Choose which student needs Washington should fund more strongly. Each
        slider is a policy lawmakers could actually change.
      </p>

      <section className="mt-8 card p-5 md:p-6">
        <h2 className="text-xl font-bold">How this works</h2>
        <p className="mt-2 text-ink-secondary">
          Washington sends extra money for students with extra needs. Turn those
          up and see what it would cost.
        </p>

        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: 'Start at today',
              body: 'Every slider begins at current law.',
              icon: (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </>
              ),
            },
            {
              title: 'Move a slider',
              body: 'Each one shows what students would get.',
              icon: (
                <>
                  <path d="M4 8h16M4 16h16" />
                  <circle cx="9" cy="8" r="2.5" />
                  <circle cx="15" cy="16" r="2.5" />
                </>
              ),
            },
            {
              title: 'See the cost',
              body: 'The total updates as you go.',
              icon: (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M15 8.5c-.7-.6-1.6-.9-2.7-.9-1.6 0-2.8.8-2.8 2s1 1.8 3 2.3 3 1.2 3 2.4-1.3 2.1-3.1 2.1c-1.2 0-2.3-.4-3.1-1.1M12 5.5v13" />
                </>
              ),
            },
          ].map((step) => (
            <li key={step.title} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {step.icon}
                </svg>
              </span>
              <div>
                <h3 className="font-bold">{step.title}</h3>
                <p className="mt-0.5 text-sm text-ink-secondary">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <details className="mt-5 pt-4 border-t border-line">
          <summary className="font-semibold text-accent cursor-pointer">
            Estimate details and assumptions
          </summary>
          <ul className="mt-3 space-y-2 text-sm text-ink-secondary list-disc pl-5">
            <li>
              This is an educational estimate for comparing ideas, not an
              official fiscal note. It applies simplified statewide averages to
              real 2024-25 enrollment.
            </li>
            <li>
              Low-income, English learner, and special education counts come
              from statewide district enrollment data.
            </li>
            <li>
              The high-poverty bonus applies to low-income students in districts
              where at least 60% of students are identified as low-income.
            </li>
            <li>
              Supplies and operating costs (MSOC) use annual-average funding FTE
              rather than October student headcount.
            </li>
            <li>
              Property-poor district aid and transportation use rounded
              statewide program estimates.
            </li>
            <li>
              The local levy limit is shown separately because it is local
              property-tax authority voters may approve, not state spending, and
              it assumes districts use the full increase.
            </li>
            <li>
              The far end of each slider is a comparison ceiling, not a
              recommendation or a prediction.
            </li>
          </ul>
        </details>
      </section>

      <div className="mt-8 grid lg:grid-cols-[1fr,27rem] gap-6 items-start">
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group} className="card p-5">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-ink-secondary">
                {group}
              </h2>
              <div className="mt-4 space-y-6">
                {LEVERS.filter((lever) => lever.group === group).map(
                  (lever) => {
                    const value = values[lever.id];
                    const changed = value !== lever.baseline;
                    const leverCost = lever.impactKey
                      ? result.impacts[lever.impactKey]
                      : lever.id === 'levyCap'
                        ? result.localCapacity
                        : 0;

                    return (
                      <div key={lever.id}>
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              changed
                                ? 'bg-accent text-white'
                                : 'bg-accent-wash text-accent-deep'
                            }`}
                          >
                            <LeverIcon name={lever.icon} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <label
                              htmlFor={lever.id}
                              className="block text-sm md:text-base font-semibold"
                            >
                              {lever.label}
                            </label>
                            <p className="mt-0.5 text-sm text-ink-secondary">
                              {lever.description}
                            </p>
                          </div>
                        </div>

                        {/* What the current setting actually means, in plain words */}
                        <div className="mt-3 flex items-baseline justify-between gap-3 flex-wrap">
                          <span
                            className={`text-base font-bold ${
                              changed ? 'text-accent-deep' : 'text-ink'
                            }`}
                          >
                            {lever.effect(value)}
                          </span>
                          {changed && leverCost !== 0 && (
                            <span className="text-sm font-semibold tabular-nums text-accent-deep">
                              {fmtSignedMoney(leverCost)}/yr
                              {lever.id === 'levyCap' && ' local'}
                            </span>
                          )}
                        </div>

                        <input
                          id={lever.id}
                          type="range"
                          min={lever.min}
                          max={lever.max}
                          step={lever.step}
                          value={value}
                          onInput={(event) => {
                            const nextValue = Number(
                              event.currentTarget.value
                            );
                            setValues((previous) => ({
                              ...previous,
                              [lever.id]: nextValue,
                            }));
                          }}
                          className="mt-2 w-full"
                          style={{ accentColor: '#256abf' }}
                          aria-describedby={`${lever.id}-scale`}
                        />
                        <div
                          id={`${lever.id}-scale`}
                          className="flex justify-between text-xs text-ink-muted"
                        >
                          <span>Today</span>
                          {changed ? (
                            <button
                              type="button"
                              onClick={() =>
                                setValues((previous) => ({
                                  ...previous,
                                  [lever.id]: lever.baseline,
                                }))
                              }
                              className="text-accent hover:underline"
                            >
                              Undo
                            </button>
                          ) : null}
                          <span>Most generous</span>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          ))}
        </div>

        <aside className="lg:sticky lg:top-6 space-y-4">
          <div className="card p-5">
            <h2 className="text-sm text-ink-secondary">
              Added state funding in your plan
            </h2>
            <p className="mt-1 text-4xl font-bold tracking-tight text-accent-deep">
              {fmtSignedMoney(result.stateTotal)}
              {Math.round(result.stateTotal) !== 0 && (
                <span className="text-base font-normal text-ink-secondary">
                  {' '}
                  / year
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-ink-secondary">
              {result.stateTotal === 0
                ? 'Increase a policy weight to build your plan.'
                : `About ${fmtSignedMoney(statePerStudent)} per student, or ${statePercent.toFixed(1)}% more than the current state share.`}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm border-t border-line pt-4">
              <div>
                <dt className="text-ink-secondary">Local levy capacity</dt>
                <dd className="font-semibold tabular-nums">
                  {fmtSignedMoney(result.localCapacity)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-secondary">Policies changed</dt>
                <dd className="font-semibold tabular-nums">
                  {
                    LEVERS.filter(
                      (lever) => values[lever.id] !== lever.baseline
                    ).length
                  }{' '}
                  of {LEVERS.length}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink-muted">
              Levy capacity is shown separately because it would be raised
              locally with voter approval, not paid from the state budget.
            </p>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-ink-secondary">
              Where your added state dollars go
            </h2>
            {result.stateTotal > 0 ? (
              <>
                <div
                  className="mt-4 flex h-7 rounded overflow-hidden"
                  style={{ gap: 2 }}
                  role="img"
                  aria-label={IMPACT_SEGMENTS.filter(
                    (segment) => result.impacts[segment.key] > 0
                  )
                    .map(
                      (segment) =>
                        `${segment.label}: ${fmtMoney(result.impacts[segment.key])}`
                    )
                    .join(', ')}
                >
                  {IMPACT_SEGMENTS.filter(
                    (segment) => result.impacts[segment.key] > 0
                  ).map((segment) => (
                    <div
                      key={segment.key}
                      style={{
                        width: `${(100 * result.impacts[segment.key]) / result.stateTotal}%`,
                        background: segment.color,
                      }}
                      title={`${segment.label}: ${fmtMoney(result.impacts[segment.key])}`}
                    />
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {IMPACT_SEGMENTS.filter(
                    (segment) => result.impacts[segment.key] > 0
                  )
                    .sort(
                      (a, b) =>
                        result.impacts[b.key] - result.impacts[a.key]
                    )
                    .map((segment) => (
                      <div
                        key={segment.key}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="flex items-center gap-2 text-ink-secondary">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-sm"
                            style={{ background: segment.color }}
                            aria-hidden
                          />
                          {segment.label}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {fmtMoney(result.impacts[segment.key])}
                        </span>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">
                Your funding mix will appear here as you add policy changes.
              </p>
            )}
          </div>

          {dirty && (
            <button
              type="button"
              onClick={() => setValues(BASELINE)}
              className="w-full card px-4 py-2.5 text-sm font-medium text-accent hover:border-accent transition-colors"
            >
              Reset all policies to current law
            </button>
          )}

          <p className="text-xs text-ink-muted">
            Want lawmakers to consider your priorities?{' '}
            <Link href="/take-action" className="text-accent hover:underline">
              Tell your legislators →
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
