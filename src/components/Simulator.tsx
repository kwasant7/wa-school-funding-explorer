'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import data from '@/data/districts.json';
import levyData from '@/data/levy.json';
import DistrictCombobox from '@/components/DistrictCombobox';
import { fmtInt, fmtMoney, fmtMoneyFull, fmtSignedMoney } from '@/lib/format';

const SELECTED_DISTRICT_KEY = 'wa-selected-district';

const LEA = levyData.assumptions;
type LevyDistrict = (typeof levyData.districts)[keyof typeof levyData.districts];
const LEVY_DISTRICTS = levyData.districts as Record<string, LevyDistrict>;

/**
 * Washington's Local Effort Assistance formula, exactly as OSPI computes it
 * (LevyCalc rows Q, R, V, X):
 *   capacity/pupil = AV x $1.50 / 1,000 / enrollment
 *   max LEA/pupil  = threshold - capacity/pupil
 *   payable LEA    = max LEA/pupil x enrollment x min(levy rate / $1.50, 1)
 */
function leaFor(district: LevyDistrict, threshold: number) {
  const capacityPerPupil = (district.av * LEA.leaMaxRate) / 1000 / district.enrollment;
  const maxPerPupil = Math.max(0, threshold - capacityPerPupil);
  const maxLea = maxPerPupil * district.enrollment;
  const effort = Math.min(district.levyRate / LEA.leaMaxRate, 1);
  return {
    capacityPerPupil,
    maxPerPupil,
    maxLea,
    effort,
    payable: maxLea * effort,
  };
}

/** Statewide LEA cost at a given threshold, summed from real district data. */
/** A district's maximum enrichment levy authority: lesser of rate and per-pupil cap. */
function levyAuthority(district: LevyDistrict, rate: number, perPupil: number) {
  return Math.min((rate * district.av) / 1000, perPupil * district.enrollment);
}

/** districts.json record joined with its levy/LEA inputs. */
type DistrictRecord = (typeof data.districts)[number];
export type SimDistrict = {
  record: DistrictRecord;
  levy: LevyDistrict | null;
};

/**
 * What one lever adds for one district. Returns null when the lever has no
 * meaningful district-level split (e.g. statewide transportation).
 */
function leverImpactFor(
  leverId: LeverId,
  values: Values,
  d: SimDistrict
): { newMoney: number; local?: boolean } | null {
  const r = d.record;
  switch (leverId) {
    case 'levyPerPupil': {
      if (!d.levy) return null;
      const now = Math.min(
        d.levy.levy,
        levyAuthority(d.levy, LEA.maxLevyRate, LEA.maxLevyPerPupil)
      );
      const next = levyAuthority(d.levy, LEA.maxLevyRate, values.levyPerPupil);
      return { newMoney: Math.max(0, next - now), local: true };
    }
    case 'leaThreshold': {
      if (!d.levy) return null;
      return {
        newMoney:
          leaFor(d.levy, values.leaThreshold).payable -
          leaFor(d.levy, LEA.leaThresholdPerPupil).payable,
      };
    }
    case 'lowIncomeWeight':
      return {
        newMoney:
          r.demo.lowIncome *
          BASELINE_LAP_PER_STUDENT *
          (values.lowIncomeWeight - 1),
      };
    case 'povertyBonus':
      return {
        newMoney:
          r.enrollment > 0 && r.demo.lowIncome / r.enrollment >= 0.6
            ? r.demo.lowIncome * values.povertyBonus
            : 0,
      };
    case 'ellWeight':
      return {
        newMoney:
          r.demo.ell * BASELINE_ELL_PER_STUDENT * (values.ellWeight - 1),
      };
    case 'spedMultiplier':
      return {
        newMoney:
          r.demo.sped *
          BASELINE_SPED_ALLOCATION *
          (values.spedMultiplier - 1.12),
      };
    case 'msoc':
      return { newMoney: r.fundingEnrollment * (values.msoc - 1_614) };
    case 'transportation':
      // No public per-district split here, so scale the statewide program by
      // this district's share of students.
      return {
        newMoney:
          BASELINE_TRANSPORTATION *
          (values.transportation / 100 - 1) *
          (r.enrollment / STUDENTS),
      };
    default:
      return null;
  }
}

const STUDENTS = data.statewide.enrollment;
const BASELINE_LAP_PER_STUDENT = 1_500;
const BASELINE_ELL_PER_STUDENT = 1_800;
const BASELINE_SPED_ALLOCATION = 12_000;
const BASELINE_TRANSPORTATION = 1_200_000_000;

const LEVERS = [
  {
    id: 'levyPerPupil',
    group: 'Local levies and state match',
    icon: 'levy',
    color: '#256abf',
    label: 'Levy cap',
    sliderLabel: 'Per-student levy dollar cap',
    description:
      'The state limits how much local school tax voters can approve per student.',
    note: (
      <>
        This is a statewide cap, the same for every district under 40,000
        students, set on a schedule by{' '}
        <strong className="text-ink">ESHB 2049 (2025)</strong>. It reaches{' '}
        <strong className="text-ink">$3,838 in 2026</strong> (today&apos;s
        slider default) and <strong className="text-ink">$5,035 by 2031</strong>
        . A higher cap does not raise money by itself - voters still have to
        approve any levy increase at the ballot.
      </>
    ),
    impactKey: null,
    baseline: LEA.maxLevyPerPupil,
    min: LEA.maxLevyPerPupil,
    max: 6_000,
    step: 25,
    effect: (value: number) => `$${fmtInt(Math.round(value))} per student`,
    unit: 'local only',
  },
  {
    id: 'leaThreshold',
    group: 'Local levies and state match',
    icon: 'lea',
    color: '#168a61',
    label: 'Local Effort Assistance (LEA)',
    sliderLabel: 'Per-student state guarantee (LEA)',
    description:
      'The state promises every district a set amount per student. If a district’s own levy cannot reach it, the state pays the difference.',
    note: (
      <>
        A district&apos;s{' '}
        <strong className="text-ink">$1.50 per $1,000</strong> of property value
        sets how much it can raise on its own. Whatever that leaves below the
        guarantee, the state fills in as Local Effort Assistance - but only in
        proportion to the levy rate voters actually approved.
      </>
    ),
    impactKey: 'lea',
    baseline: LEA.leaThresholdPerPupil,
    min: LEA.leaThresholdPerPupil,
    max: 4_000,
    step: 25,
    effect: (value: number) =>
      `$${fmtInt(Math.round(value))} guaranteed per student`,
    unit: 'per student',
  },
  {
    id: 'lowIncomeWeight',
    group: 'Student needs',
    icon: 'lowIncome',
    color: '#7a4bb7',
    label: 'Low-income support (LAP)',
    sliderLabel: 'LAP dollars per low-income student',
    description: 'Extra help for students from low-income families.',
    note: (
      <>
        The Learning Assistance Program pays for tutoring, extra reading and
        math help, and staff time for students who are behind. It follows{' '}
        <strong className="text-ink">low-income enrollment</strong>, so the
        same change is worth far more in a high-poverty district.
      </>
    ),
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
    id: 'ellWeight',
    group: 'Student needs',
    icon: 'ell',
    color: '#009978',
    label: 'English learner support',
    sliderLabel: 'Dollars per English learner',
    description: 'Language help for students learning English.',
    note: (
      <>
        The Transitional Bilingual Instruction Program funds language support
        until a student tests out. Districts with recent immigration or refugee
        resettlement carry most of this cost.
      </>
    ),
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
    color: '#d15f78',
    label: 'Special education',
    sliderLabel: 'Special education excess-cost multiplier',
    description: 'Services for students with disabilities.',
    note: (
      <>
        Special education is funded as a multiplier on top of basic education.
        Districts have long reported spending more than the formula provides;
        2025's <strong className="text-ink">SB 5263</strong> raised it and
        removed the enrollment cap, but the gap is still debated.
      </>
    ),
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
    id: 'msoc',
    group: 'School operations',
    icon: 'msoc',
    color: '#bd7600',
    label: 'Materials, Supplies, & Operating Costs (MSOC)',
    sliderLabel: 'MSOC dollars per student',
    description: 'Curriculum, technology, utilities, and insurance.',
    note: (
      <>
        MSOC covers everything that is not staff pay: curriculum, technology,
        utilities, and insurance. Because it is a flat per-student amount, it is
        the lever that reaches every district equally.
      </>
    ),
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
    color: '#9a6a39',
    label: 'Student transportation',
    sliderLabel: 'Transportation funding level',
    description: 'Buses, drivers, fuel, and required routes.',
    note: (
      <>
        Transportation is funded by a separate formula based on the students a
        district actually carries and how far. Rural districts with long routes
        and districts running required special education routes feel changes
        here most.
      </>
    ),
    impactKey: 'transportation',
    baseline: 100,
    min: 100,
    max: 140,
    step: 5,
    effect: (value: number) =>
      `${fmtMoney(BASELINE_TRANSPORTATION * (value / 100))} statewide`,
    unit: 'statewide',
  },
  {
    id: 'povertyBonus',
    group: 'Student needs',
    icon: 'poverty',
    color: '#7257c7',
    label: 'High-poverty school bonus',
    sliderLabel: 'Bonus per student in high-poverty districts',
    description:
      'Extra money for schools where most students are low-income.',
    note: (
      <>
        Washington does not currently pay a concentration bonus. This models one:
        extra dollars only where at least{' '}
        <strong className="text-ink">60% of students are low-income</strong>,
        on the theory that concentrated poverty costs more to address than the
        same number of students spread across a wealthier district.
      </>
    ),
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
type Lever = (typeof LEVERS)[number];
type Values = Record<LeverId, number>;

/** Uppercase label + value, the stat strip along the bottom of each card. */
function CardStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'plain';
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-0.5 text-lg font-bold tabular-nums ${
          tone === 'good' ? 'text-good' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * The per-district picture for one lever: a solid bar for today, a lighter
 * segment for what the change adds, and (for the levy cap) a dashed marker
 * showing the ceiling the district's tax base could physically support.
 */
function LeverBar({
  lever,
  values,
  district,
}: {
  lever: Lever;
  values: Values;
  district: SimDistrict;
}) {
  const levy = district.levy;
  const name = district.record.name
    .replace(/ School District.*$/, '')
    .replace(/ Public Schools$/, '');

  // Levy cap: today's collectible levy, the room a higher cap opens, and the
  // tax-base ceiling ($2.50 per $1,000 of assessed value).
  if (lever.id === 'levyPerPupil' && levy) {
    const perStudent = (total: number) => total / levy.enrollment;
    const todayTotal = Math.min(
      levy.levy,
      levyAuthority(levy, LEA.maxLevyRate, LEA.maxLevyPerPupil)
    );
    const planTotal = levyAuthority(levy, LEA.maxLevyRate, values.levyPerPupil);
    const today = perStudent(todayTotal);
    const plan = perStudent(planTotal);
    const ceiling = (levy.av * LEA.maxLevyRate) / 1000 / levy.enrollment;
    const scale = Math.max(ceiling, plan) * 1.08;
    const pct = (v: number) => `${Math.max(0, Math.min(100, (100 * v) / scale))}%`;
    const added = Math.max(0, plan - today);

    return (
      <figure>
        <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-series-state" />
            Levy today
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-accent-soft" />
            Room the new cap opens
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 border-t-2 border-dashed"
              style={{ borderColor: '#256abf' }}
            />
            Tax-base ceiling
          </span>
        </figcaption>
        <div className="mt-3 flex items-center gap-3">
          <div className="w-28 shrink-0 text-right">
            <p className="font-bold leading-tight">{name}</p>
            <p className="text-[11px] text-ink-muted">
              Ceiling: {fmtMoneyFull(Math.round(ceiling))}
            </p>
          </div>
          <div className="relative flex-1 h-9">
            <div className="absolute inset-0 flex items-center">
              <div className="flex h-9 w-full">
                <div
                  className="h-full rounded-l bg-series-state flex items-center justify-center text-white text-sm font-semibold"
                  style={{ width: pct(today) }}
                >
                  {today / scale > 0.16 && fmtMoneyFull(Math.round(today))}
                </div>
                {added > 0 && (
                  <div
                    className="h-full bg-accent-soft"
                    style={{ width: pct(added) }}
                  />
                )}
              </div>
            </div>
            {/* dashed tax-base ceiling marker */}
            <div
              className="absolute top-0 h-9 border-l-2 border-dashed"
              style={{ left: pct(ceiling), borderColor: '#256abf' }}
              title={`Tax-base ceiling: ${fmtMoneyFull(Math.round(ceiling))} per student`}
            />
          </div>
          <div className="w-20 shrink-0 text-lg font-bold tabular-nums">
            {fmtMoneyFull(Math.round(plan))}
          </div>
        </div>
      </figure>
    );
  }

  // LEA: what the district's own $1.50 levy raises vs the state guarantee.
  if (lever.id === 'leaThreshold' && levy) {
    const now = leaFor(levy, LEA.leaThresholdPerPupil);
    const plan = leaFor(levy, values.leaThreshold);
    // Keep the same scale across settings so the bar's length communicates
    // the amount, instead of always stretching the selected value to the end.
    const scale = Math.max(lever.max, now.capacityPerPupil) * 1.08;
    const pct = (v: number) => `${Math.max(0, Math.min(100, (100 * v) / scale))}%`;
    const ownLevy = Math.min(now.capacityPerPupil, values.leaThreshold);
    return (
      <figure>
        <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-series-local" />
            Their own $1.50 levy: {fmtMoneyFull(Math.round(ownLevy))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-series-state" />
            State fills the gap: {fmtMoneyFull(Math.round(plan.maxPerPupil))}
          </span>
        </figcaption>
        <div className="mt-3 flex items-center gap-3">
          <div className="w-28 shrink-0 text-right">
            <p className="font-bold leading-tight">{name}</p>
            <p className="text-[11px] text-ink-muted">
              Raises {fmtMoneyFull(Math.round(now.capacityPerPupil))}
            </p>
          </div>
          <div className="relative flex-1 h-12 pt-3">
            <div className="absolute inset-x-0 bottom-0 h-9 rounded bg-baseline/35" />
            <div className="absolute inset-x-0 bottom-0 h-9 flex">
              <div
                className="absolute -top-5 text-xs font-semibold tabular-nums text-series-local"
                style={{ width: pct(ownLevy), minWidth: '4rem', textAlign: 'center' }}
              >
                {fmtMoneyFull(Math.round(ownLevy))}
              </div>
            <div
              className="h-full rounded-l bg-series-local"
              style={{ width: pct(ownLevy) }}
            />
            {plan.maxPerPupil > 0 && (
              <div
                className="h-full bg-series-state flex items-center justify-center text-white text-sm font-semibold"
                style={{ width: pct(plan.maxPerPupil) }}
              >
                {plan.maxPerPupil / scale > 0.16 &&
                  fmtMoneyFull(Math.round(plan.maxPerPupil))}
              </div>
            )}
            </div>
          </div>
          <div className="w-20 shrink-0 text-lg font-bold tabular-nums">
            {fmtMoneyFull(Math.round(values.leaThreshold))}
          </div>
        </div>
        {plan.maxPerPupil <= 0 && (
          <p className="mt-2 text-xs text-ink-muted">
            {name} already raises more than the guarantee on its own, so it
            receives no state match.
          </p>
        )}
      </figure>
    );
  }

  // Everything else: a simple today-vs-plan per-student comparison.
  const counts: Partial<Record<LeverId, { base: number; now: number; who: string }>> = {
    lowIncomeWeight: {
      base: BASELINE_LAP_PER_STUDENT,
      now: BASELINE_LAP_PER_STUDENT * values.lowIncomeWeight,
      who: `${fmtInt(district.record.demo.lowIncome)} low-income students`,
    },
    povertyBonus: {
      base: 0,
      now: values.povertyBonus,
      who:
        district.record.enrollment > 0 &&
        district.record.demo.lowIncome / district.record.enrollment >= 0.6
          ? `${fmtInt(district.record.demo.lowIncome)} students qualify`
          : 'This district does not qualify',
    },
    ellWeight: {
      base: BASELINE_ELL_PER_STUDENT,
      now: BASELINE_ELL_PER_STUDENT * values.ellWeight,
      who: `${fmtInt(district.record.demo.ell)} English learners`,
    },
    spedMultiplier: {
      base: 0,
      now: BASELINE_SPED_ALLOCATION * (values.spedMultiplier - 1.12),
      who: `${fmtInt(district.record.demo.sped)} students with disabilities`,
    },
    msoc: {
      base: 1_614,
      now: values.msoc,
      who: `${fmtInt(Math.round(district.record.fundingEnrollment))} funding FTE`,
    },
  };
  const c = counts[lever.id];
  if (!c) return null;
  // Use the policy's comparison ceiling, not the current selection, so a
  // short bar stays short instead of looking like it fills the whole scale.
  const scale = Math.max(lever.max, c.now, c.base) * 1.08 || 1;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (100 * v) / scale))}%`;
  const added = Math.max(0, c.now - c.base);

  return (
    <figure>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-series-state" />
          Today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-accent-soft" />
          Your plan adds
        </span>
      </figcaption>
      <div className="mt-3 flex items-center gap-3">
        <div className="w-28 shrink-0 text-right">
          <p className="font-bold leading-tight">{name}</p>
          <p className="text-[11px] text-ink-muted">{c.who}</p>
        </div>
        <div className="flex-1 h-9 flex rounded bg-baseline/35 overflow-hidden">
          {c.base > 0 && (
            <div
              className="h-full rounded-l bg-series-state flex items-center justify-center text-white text-sm font-semibold"
              style={{ width: pct(c.base) }}
            >
              {c.base / scale > 0.16 && fmtMoneyFull(Math.round(c.base))}
            </div>
          )}
          {added > 0 && (
            <div
              className={`h-full bg-accent-soft ${c.base > 0 ? '' : 'rounded-l'}`}
              style={{ width: pct(added) }}
            />
          )}
        </div>
        <div className="w-20 shrink-0 text-lg font-bold tabular-nums">
          {fmtMoneyFull(Math.round(c.now))}
        </div>
      </div>
    </figure>
  );
}

/** One numbered policy card: slider, context, district picture, stat strip. */
function LeverCard({
  lever,
  index,
  values,
  setValues,
  district,
}: {
  lever: Lever;
  index: number;
  values: Values;
  setValues: React.Dispatch<React.SetStateAction<Values>>;
  district: SimDistrict | null;
}) {
  const value = values[lever.id];
  const changed = value !== lever.baseline;
  const impact = district ? leverImpactFor(lever.id, values, district) : null;
  const current = district?.record.rev.total ?? 0;
  const newMoney = impact?.newMoney ?? 0;

  return (
    <section
      className="card border-l-4 p-5 md:p-6"
      style={{ borderLeftColor: lever.color }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: changed ? lever.color : `${lever.color}18`,
            color: changed ? '#fff' : lever.color,
          }}
        >
          <LeverIcon name={lever.icon} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-bold">
            {index}. {lever.label}
          </h2>
          <p className="mt-0.5 text-ink-secondary">{lever.description}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={lever.id} className="text-sm font-semibold">
            {lever.sliderLabel}
          </label>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: lever.color }}
          >
            {lever.effect(value)}
          </span>
        </div>
        <input
          id={lever.id}
          type="range"
          min={lever.min}
          max={lever.max}
          step={lever.step}
          value={value}
          onInput={(event) => {
            const next = Number(event.currentTarget.value);
            setValues((previous) => ({ ...previous, [lever.id]: next }));
          }}
          className="mt-2 w-full"
          style={{ accentColor: lever.color }}
        />
        <div className="flex justify-between text-xs text-ink-muted">
          <span>Today</span>
          {changed && (
            <button
              type="button"
              onClick={() =>
                setValues((previous) => ({
                  ...previous,
                  [lever.id]: lever.baseline,
                }))
              }
              className="hover:underline"
              style={{ color: lever.color }}
            >
              Undo
            </button>
          )}
          <span>Most generous</span>
        </div>
      </div>

      {lever.note && (
        <p className="mt-4 text-sm text-ink-secondary">{lever.note}</p>
      )}

      {district && (
        <div className="mt-5">
          <LeverBar lever={lever} values={values} district={district} />
        </div>
      )}

      {district && impact && (
        <div className="mt-5 pt-4 border-t border-line grid grid-cols-2 md:grid-cols-4 gap-4">
          <CardStat label="Current revenue" value={fmtMoney(current)} />
          <CardStat
            label={impact.local ? 'New local room' : 'New money'}
            value={newMoney > 0 ? `+${fmtMoney(newMoney)}` : fmtMoney(0)}
            tone={newMoney > 0 ? 'good' : 'plain'}
          />
          <CardStat label="New total" value={fmtMoney(current + newMoney)} />
          <CardStat
            label="Change"
            value={
              current > 0
                ? `${newMoney > 0 ? '+' : ''}${((100 * newMoney) / current).toFixed(2)}%`
                : '-'
            }
            tone={newMoney > 0 ? 'good' : 'plain'}
          />
        </div>
      )}
    </section>
  );
}

const BASELINE = Object.fromEntries(
  LEVERS.map((lever) => [lever.id, lever.baseline])
) as Values;

export default function Simulator() {
  const [values, setValues] = useState<Values>(BASELINE);
  const [code, setCode] = useState('');
  const dirty = LEVERS.some(
    (lever) => values[lever.id] !== lever.baseline
  );

  // Restore whatever district the visitor picked elsewhere on the site.
  useEffect(() => {
    const saved = window.localStorage.getItem(SELECTED_DISTRICT_KEY);
    if (saved && data.districts.some((d) => d.code === saved)) setCode(saved);
  }, []);

  const pickerDistricts = useMemo(
    () =>
      [...data.districts]
        .map((d) => ({ code: d.code, name: d.name, county: d.county }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );
  const district: SimDistrict | null = useMemo(() => {
    const record = data.districts.find((d) => d.code === code);
    if (!record) return null;
    return { record, levy: LEVY_DISTRICTS[code] ?? null };
  }, [code]);

  const chooseDistrict = (next: string) => {
    setCode(next);
    if (next) window.localStorage.setItem(SELECTED_DISTRICT_KEY, next);
  };

  /**
   * This district's own totals. Kept separate from the statewide figures
   * because a lever can cost the state billions and still send this district
   * nothing - a property-rich district gets no LEA, for instance.
   */
  const districtTotals = useMemo(() => {
    let state = 0;
    let local = 0;
    const zeroLevers: string[] = [];
    if (!district) return { state, local, zeroLevers };
    for (const lever of LEVERS) {
      if (values[lever.id] === lever.baseline) continue;
      const impact = leverImpactFor(lever.id, values, district);
      const amount = impact?.newMoney ?? 0;
      if (impact?.local) local += amount;
      else state += amount;
      // Flag levers the user moved that do nothing here, so the difference
      // between the statewide and district totals is explained rather than
      // looking like a bug.
      if (Math.round(amount) === 0) zeroLevers.push(lever.label);
    }
    return { state, local, zeroLevers };
  }, [district, values]);

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
              Local Effort Assistance uses Washington&apos;s actual formula and
              real district data - assessed valuation, voter-approved levy, and
              LEA enrollment from OSPI&apos;s{' '}
              <a
                className="text-accent hover:underline"
                href="https://ospi.k12.wa.us/policy-funding/school-apportionment/budget-preparations"
                target="_blank"
                rel="noopener noreferrer"
              >
                Enrichment Levy Pre-Ballot Approval worksheet
              </a>
              . A district&apos;s $1.50 levy capacity is subtracted from the
              state guarantee ({fmtMoneyFull(LEA.leaThresholdPerPupil)} per
              student for calendar {levyData.calendarYear}), then scaled by its
              levy rate. Statewide cost is summed district by district.
            </li>
            <li>
              &ldquo;Actually received&rdquo; LEA is F-196 revenue code 3300 for
              2024-25, a different period than the {levyData.calendarYear}{' '}
              estimate, so the two will not match exactly.
            </li>
            <li>
              A district&apos;s levy limit is the lesser of the tax-rate cap and
              the per-student cap, so raising the rate does not always raise the
              limit. Transportation uses a rounded statewide program estimate.
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

      {/* Pick a district first: every card below is then shown for it. */}
      <section className="mt-8 card p-5 md:p-6 bg-accent-wash border-accent-soft">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg md:text-xl font-bold">
              Start by choosing a district
            </h2>
            <p className="mt-1 text-sm text-ink-secondary max-w-2xl">
              Every policy below will show what it would mean for that district:
              its own numbers, and the money the change would add.
            </p>
          </div>
          <div className="w-full md:w-80">
            <DistrictCombobox
              districts={pickerDistricts}
              onPick={chooseDistrict}
              selectedName={district?.record.name}
              placeholder="Choose or search for a district"
            />
          </div>
        </div>
        {district && (
          <p className="mt-3 text-sm text-ink-secondary">
            <strong className="text-ink">{district.record.name}</strong> -{' '}
            {fmtInt(district.record.enrollment)} students,{' '}
            {fmtMoney(district.record.rev.total)} in general fund revenue.
          </p>
        )}
      </section>

      {district && (
        <section className="mt-6 card p-5 border-l-4 border-l-accent">
          <h2 className="text-sm text-ink-secondary">
            Your plan for{' '}
            <strong className="text-ink">
              {district.record.name.replace(/ School District.*$/, '')}
            </strong>
          </h2>
          <p
            className={`mt-1 text-4xl font-bold tracking-tight ${
              districtTotals.state > 0 ? 'text-accent-deep' : 'text-ink'
            }`}
          >
            {fmtSignedMoney(districtTotals.state)}
            {Math.round(districtTotals.state) !== 0 && (
              <span className="text-base font-normal text-ink-secondary"> / year</span>
            )}
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            {districtTotals.state === 0
              ? 'No state money from your plan reaches this district yet.'
              : `${((100 * districtTotals.state) / district.record.rev.total).toFixed(2)}% on top of its ${fmtMoney(district.record.rev.total)} budget.`}
          </p>
          {districtTotals.local > 0 && (
            <p className="mt-2 text-sm text-ink-secondary">
              Plus <strong className="text-ink">{fmtSignedMoney(districtTotals.local)}</strong>{' '}
              of local levy room, if voters approve it.
            </p>
          )}
          {districtTotals.zeroLevers.length > 0 && (
            <p className="mt-3 pt-3 border-t border-line text-xs text-ink-muted">
              Nothing from{' '}
              {districtTotals.zeroLevers.map((label, i) => (
                <span key={label}>
                  {i > 0 && (i === districtTotals.zeroLevers.length - 1 ? ' or ' : ', ')}
                  <strong className="text-ink-secondary">{label}</strong>
                </span>
              ))}
              : this district does not qualify.
            </p>
          )}
        </section>
      )}

      <div className="mt-6 space-y-5">
        {!district && (
          <p className="card p-5 text-sm text-ink-muted">
            Pick a district above to see each policy applied to real numbers.
          </p>
        )}
        {LEVERS.map((lever, i) => (
          <LeverCard
            key={lever.id}
            lever={lever}
            index={i + 1}
            values={values}
            setValues={setValues}
            district={district}
          />
        ))}
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
      </div>
    </div>
  );
}
