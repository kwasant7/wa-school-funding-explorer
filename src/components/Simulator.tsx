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
    label: 'Low-income / LAP weight',
    description:
      'Adds more Learning Assistance Program dollars for each low-income student.',
    baseline: 1,
    min: 1,
    max: 2,
    step: 0.05,
    format: (value: number) => `${value.toFixed(2)}×`,
  },
  {
    id: 'povertyBonus',
    group: 'Student needs',
    label: 'High-poverty concentration bonus',
    description:
      'Adds dollars for each low-income student in a district where at least 60% of students are low-income.',
    baseline: 0,
    min: 0,
    max: 3_000,
    step: 100,
    format: (value: number) => `$${fmtInt(value)}`,
  },
  {
    id: 'ellWeight',
    group: 'Student needs',
    label: 'English learner (ELL) weight',
    description:
      'Adds more bilingual and language-learning support for each multilingual student.',
    baseline: 1,
    min: 1,
    max: 2,
    step: 0.05,
    format: (value: number) => `${value.toFixed(2)}×`,
  },
  {
    id: 'spedMultiplier',
    group: 'Student needs',
    label: 'Special education multiplier',
    description:
      'Raises the excess-cost multiplier used to fund services beyond basic education.',
    baseline: 1.12,
    min: 1.12,
    max: 1.5,
    step: 0.01,
    format: (value: number) => `${value.toFixed(2)}×`,
  },
  {
    id: 'leaStrength',
    group: 'District equity',
    label: 'Local Effort Assistance (LEA)',
    description:
      'Increases state levy-equalization aid for districts with lower property wealth.',
    baseline: 100,
    min: 100,
    max: 200,
    step: 5,
    format: (value: number) => `${fmtInt(value)}%`,
  },
  {
    id: 'levyCap',
    group: 'District equity',
    label: 'Local enrichment levy cap',
    description:
      'Lets voters authorize more local funding. This changes local capacity, not state spending.',
    baseline: 100,
    min: 100,
    max: 175,
    step: 5,
    format: (value: number) => `${fmtInt(value)}%`,
  },
  {
    id: 'msoc',
    group: 'School operations',
    label: 'MSOC dollars per funding FTE',
    description:
      'Funds materials, supplies, utilities, technology, insurance, and other operating costs.',
    baseline: 1_614,
    min: 1_614,
    max: 3_000,
    step: 50,
    format: (value: number) => `$${fmtInt(value)}`,
  },
  {
    id: 'transportation',
    group: 'School operations',
    label: 'Student transportation funding',
    description:
      'Raises the statewide amount available for buses, drivers, fuel, and required routes.',
    baseline: 100,
    min: 100,
    max: 140,
    step: 5,
    format: (value: number) => `${fmtInt(value)}%`,
  },
] as const;

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
        Instead of changing individual class sizes, choose which needs
        Washington should fund more strongly. Each lever represents a policy
        lawmakers could change in the state formula.
      </p>

      <div className="mt-4 card p-4 bg-accent-wash border-accent-soft text-sm text-ink-secondary max-w-3xl">
        <strong className="text-ink">Educational estimate.</strong> The
        simulator applies simplified statewide weights to real 2024-25
        enrollment. It is useful for comparing policy ideas, but it is not an
        official fiscal note. LEA and transportation use rounded current-program
        estimates, and levy capacity assumes districts could use the full
        increase.
      </div>

      <section className="mt-8 card p-5 md:p-6">
        <h2 className="text-xl font-bold">How this simulator works</h2>
        <p className="mt-2 max-w-3xl text-ink-secondary">
          Washington does not send every student the same amount. The state
          starts with basic funding, then uses separate formulas for student
          needs and district costs. This simulator lets you make those extra
          formulas stronger. It estimates the additional statewide cost of your
          choices compared with current law.
        </p>

        <ol className="mt-5 grid md:grid-cols-3 gap-5">
          <li>
            <span className="w-8 h-8 rounded-full bg-accent text-white font-bold flex items-center justify-center">
              1
            </span>
            <h3 className="mt-2 font-bold">Start at current law</h3>
            <p className="mt-1 text-sm text-ink-secondary">
              Every lever begins at its current modeled level. A result of
              &ldquo;no change&rdquo; means your plan matches the baseline.
            </p>
          </li>
          <li>
            <span className="w-8 h-8 rounded-full bg-accent text-white font-bold flex items-center justify-center">
              2
            </span>
            <h3 className="mt-2 font-bold">Strengthen a policy</h3>
            <p className="mt-1 text-sm text-ink-secondary">
              Move one or more levers. The simulator multiplies that policy by
              the statewide students or funding FTEs affected by it.
            </p>
          </li>
          <li>
            <span className="w-8 h-8 rounded-full bg-accent text-white font-bold flex items-center justify-center">
              3
            </span>
            <h3 className="mt-2 font-bold">Read the added cost</h3>
            <p className="mt-1 text-sm text-ink-secondary">
              The results show added state spending per year, per student, and
              by policy. Local levy capacity is shown separately.
            </p>
          </li>
        </ol>

        <div className="mt-5 pt-5 border-t border-line grid md:grid-cols-2 gap-5">
          <div>
            <h3 className="font-bold">What does a weight mean?</h3>
            <p className="mt-1 text-sm text-ink-secondary">
              A weight scales one program, not the entire school budget. For
              example, changing the low-income/LAP weight from 1.00× to 1.50×
              means the simulator adds 50% to its modeled LAP amount for every
              low-income student.
            </p>
          </div>
          <div>
            <h3 className="font-bold">Why is the levy result separate?</h3>
            <p className="mt-1 text-sm text-ink-secondary">
              State programs are paid through the state budget. An enrichment
              levy is local property-tax authority that voters may approve, so
              increasing its cap creates possible local capacity rather than a
              guaranteed state expense.
            </p>
          </div>
        </div>

        <details className="mt-5 pt-4 border-t border-line">
          <summary className="font-semibold text-accent cursor-pointer">
            See the calculation assumptions
          </summary>
          <ul className="mt-3 space-y-2 text-sm text-ink-secondary list-disc pl-5 max-w-3xl">
            <li>
              Low-income, English learner, and special education counts come
              from statewide district enrollment data.
            </li>
            <li>
              The high-poverty bonus applies to low-income students in districts
              where at least 60% of students are identified as low-income.
            </li>
            <li>
              MSOC uses annual-average funding FTE rather than October student
              headcount.
            </li>
            <li>
              LEA and transportation use rounded statewide program estimates
              because this is not the Legislature&apos;s full fiscal-note
              model.
            </li>
            <li>
              The maximum shown on a lever is a comparison ceiling, not a
              recommendation or a predicted policy outcome.
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

                    return (
                      <div key={lever.id}>
                        <div className="flex items-baseline justify-between gap-3 flex-wrap">
                          <label
                            htmlFor={lever.id}
                            className="text-sm md:text-base font-medium"
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
                            {lever.format(value)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-ink-secondary">
                          {lever.description}
                        </p>
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
                          className="mt-3 w-full"
                          style={{ accentColor: '#256abf' }}
                          aria-describedby={`${lever.id}-baseline`}
                        />
                        <div
                          id={`${lever.id}-baseline`}
                          className="flex justify-between text-xs text-ink-muted"
                        >
                          <span>Current: {lever.format(lever.baseline)}</span>
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
                              Reset this idea
                            </button>
                          ) : (
                            <span>Try increasing it</span>
                          )}
                          <span>Max: {lever.format(lever.max)}</span>
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
