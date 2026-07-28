'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import data from '@/data/districts.json';
import levyData from '@/data/levy.json';
import spendingData from '@/data/spending.json';
import allocationData from '@/data/allocation.json';
import DistrictCombobox from '@/components/DistrictCombobox';
import { fmtInt, fmtMoney, fmtMoneyFull, fmtSignedMoney } from '@/lib/format';

const SELECTED_DISTRICT_KEY = 'wa-selected-district';

/** Positions on every slider, independent of the lever's own units. */
const SLIDER_STEPS = 1000;

/**
 * Maps a 0-1000 slider position onto a lever's own units. The value stays
 * continuous - quantizing it back onto a lever's display increment is what
 * made these feel notchy (the English learner slider had only 21 stops across
 * its whole range). Labels round for display; the value underneath does not.
 * Position 0 and 1000 land exactly on min and max.
 */
function valueAtPosition(position: number, min: number, max: number) {
  if (position <= 0) return min;
  if (position >= SLIDER_STEPS) return max;
  return min + (position / SLIDER_STEPS) * (max - min);
}

/**
 * Where to park a floating chart label, held a little inside both ends so it
 * cannot clip off the edge of the bar.
 */
function markerPct(value: number, scale: number) {
  return `${Math.max(8, Math.min(92, (100 * value) / scale))}%`;
}

/** Inline citation link, styled to read as emphasis rather than decoration. */
function StatuteLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-ink underline underline-offset-2 hover:text-accent"
    >
      {children}
    </a>
  );
}

const LEA = levyData.assumptions;
type LevyDistrict = (typeof levyData.districts)[keyof typeof levyData.districts];
const LEVY_DISTRICTS = levyData.districts as Record<string, LevyDistrict>;

/** F-196 actual 2024-25 spending, per district, for the levers that have it. */
type DistrictSpending = (typeof spendingData.districts)[keyof typeof spendingData.districts];
const SPENDING = spendingData.districts as Record<string, DistrictSpending>;

/**
 * What a district actually spent per unit on a lever's program, so the chart
 * can show the real cost next to what the state formula pays. Returns null for
 * levers with no comparable F-196 line.
 */
function actualSpendPerUnit(leverId: LeverId, code: string): number | null {
  const spend = SPENDING[code];
  if (!spend) return null;
  switch (leverId) {
    case 'spedMultiplier':
      // Expressed as the multiplier that would fully fund actual spending.
      return spend.spedPerStudent > 0
        ? spend.spedPerStudent / BASELINE_SPED_ALLOCATION
        : null;
    case 'msoc':
      return spend.msocPerStudent > 0 ? spend.msocPerStudent : null;
    case 'transportation':
      return spend.transportationPerStudent > 0
        ? spend.transportationPerStudent
        : null;
    default:
      return null;
  }
}

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

/** A district's maximum enrichment levy authority: lesser of rate and per-pupil cap. */
function levyAuthority(district: LevyDistrict, rate: number, perPupil: number) {
  return Math.min((rate * district.av) / 1000, perPupil * district.enrollment);
}

const LARGE_DISTRICTS = new Set<string>(LEA.largeDistrictCodes);

/**
 * The per-pupil levy cap a district actually lives under today. RCW 84.52.0531
 * gives districts of 40,000+ FTE students a higher limit - Seattle is the only
 * one, and OSPI's own LevyCalc sheet hardcodes that same split. Using the
 * standard cap for Seattle would understate what it can legally collect by
 * about $33M, so the district-specific figure is what the cards use.
 */
function currentCapFor(code: string) {
  return LARGE_DISTRICTS.has(code)
    ? LEA.maxLevyPerPupilLarge
    : LEA.maxLevyPerPupil;
}

/**
 * What raising the per-pupil cap does for one district, split by whether the
 * money needs a new election.
 *
 * Many districts have already passed a levy larger than the cap lets them
 * collect - 46 of them in 2026, Bellevue by $8.9M - so the first dollars a
 * higher cap frees up are dollars voters ALREADY approved. Only past that
 * point does a district have to go back to the ballot.
 */
function levyRoom(levy: LevyDistrict, newPerPupil: number, currentCap: number) {
  const approved = levy.levy;
  const nowAuthority = levyAuthority(levy, LEA.maxLevyRate, currentCap);
  // A district already above the standard cap keeps its own higher limit until
  // the slider passes it, so moving the slider never *lowers* its authority.
  const newAuthority = levyAuthority(
    levy,
    LEA.maxLevyRate,
    Math.max(newPerPupil, currentCap)
  );
  const collectedToday = Math.min(approved, nowAuthority);
  const unlocked = Math.max(0, Math.min(approved, newAuthority) - collectedToday);
  const needsVote = Math.max(0, newAuthority - Math.max(approved, nowAuthority));
  return {
    approved,
    nowAuthority,
    newAuthority,
    collectedToday,
    /** Voter-approved money the cap blocks today; no new election needed. */
    unlocked,
    /** Room beyond what voters have already said yes to. */
    needsVote,
    total: unlocked + needsVote,
    cappedBelowApproved: approved > nowAuthority,
  };
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
): {
  newMoney: number;
  local?: boolean;
  /** Levy only: money voters already approved that the cap blocks today. */
  unlocked?: number;
  /** Levy only: money that would still need a new election. */
  needsVote?: number;
} | null {
  const r = d.record;
  switch (leverId) {
    case 'levyPerPupil': {
      if (!d.levy) return null;
      const room = levyRoom(
        d.levy,
        values.levyPerPupil,
        currentCapFor(r.code)
      );
      return {
        newMoney: room.total,
        local: true,
        unlocked: room.unlocked,
        needsVote: room.needsVote,
      };
    }
    case 'leaThreshold': {
      if (!d.levy) return null;
      return {
        newMoney:
          leaFor(d.levy, LEA.leaThresholdPerPupil + values.leaThreshold).payable -
          leaFor(d.levy, LEA.leaThresholdPerPupil).payable,
      };
    }
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
          (values.spedMultiplier - 1.16),
      };
    case 'msoc':
      return { newMoney: r.fundingEnrollment * (values.msoc - 1_614) };
    case 'transportation':
      // No public per-district split here, so scale the statewide program by
      // this district's own enrollment.
      return {
        newMoney:
          (values.transportation - BASELINE_TRANSPORTATION_PER_STUDENT) *
          r.enrollment,
      };
    default:
      return null;
  }
}

const STUDENTS = data.statewide.enrollment;
const BASELINE_ELL_PER_STUDENT = 1_800;
const BASELINE_SPED_ALLOCATION = 12_000;
/*
  Pupil transportation operations, summed from every district's actual 2024-25
  state allotment (revenue code 4199) rather than a rounded guess at the size
  of the program. The previous hard-coded $1.2B was about a third too high,
  which pushed the slider's starting point to roughly $1,085 per student when
  the real figure is nearer $718. Bus purchases are excluded: those run through
  the Transportation Vehicle Fund, not the general fund.
*/
const BASELINE_TRANSPORTATION = Object.values(allocationData.districts).reduce(
  (sum, d) => sum + d.transportation,
  0
);
const BASELINE_TRANSPORTATION_PER_STUDENT = BASELINE_TRANSPORTATION / STUDENTS;

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
    bill: (
      <>
        Most recently changed by{' '}
        <a
          className="font-semibold underline underline-offset-2"
          href="https://app.leg.wa.gov/billsummary?BillNumber=2049&Year=2025"
          target="_blank"
          rel="noopener noreferrer"
        >
          ESHB 2049 (2025)
        </a>
        , which raised the levy lid.
      </>
    ),
    note: (
      <>
        Set on a schedule by{' '}
        <StatuteLink href="https://app.leg.wa.gov/billsummary?BillNumber=2049&Year=2025">
          ESHB 2049 (2025)
        </StatuteLink>{' '}
        in{' '}
        <StatuteLink href="https://app.leg.wa.gov/rcw/default.aspx?cite=84.52.0531">
          RCW 84.52.0531
        </StatuteLink>
        : it reaches{' '}
        <strong className="text-ink">$3,838 in 2026</strong> (today&apos;s
        slider default), then a flat{' '}
        <strong className="text-ink">$5,035 in 2031</strong>, when the statute
        drops the district-size split and the same limit applies everywhere.
        Until then districts of 40,000 or more students - Seattle is the only
        one - get a higher cap, <strong className="text-ink">$4,506</strong> in
        2026, and the cards below use it. Raising the cap releases money
        a district&apos;s voters have already approved but the cap holds back;
        past that point, collecting more would take a new levy vote.
      </>
    ),
    impactKey: null,
    baseline: LEA.maxLevyPerPupil,
    min: LEA.maxLevyPerPupil,
    max: 6_000,
    step: 25,
    effect: (value: number) => `$${fmtInt(Math.round(value))} per student`,
    unit: 'local only',
    markers: [{ value: 5_035, label: '$5,035 · 2031 cap' }],
  },
  {
    id: 'leaThreshold',
    group: 'Local levies and state match',
    icon: 'lea',
    color: '#8b5cf6',
    label: 'Local Effort Assistance (LEA)',
    sliderLabel: 'LEA increase, per student',
    description:
      'The state compares a district’s property wealth with a statewide goal, then fills the gap for districts below it.',
    bill: (
      <>
        Most recently changed by{' '}
        <a
          className="font-semibold underline underline-offset-2"
          href="https://app.leg.wa.gov/billsummary?BillNumber=2050&Year=2025"
          target="_blank"
          rel="noopener noreferrer"
        >
          HB 2050 (2025)
        </a>
        , which changed the enrollment counted in LEA calculations.
      </>
    ),
    note: (
      <>
        This is a wealth test, not the district&apos;s actual levy. Washington
        checks what its property could raise at{' '}
        <strong className="text-ink">$1.50 per $1,000</strong>; where that
        falls below the goal, the state provides Local Effort Assistance. The
        2026 goal is{' '}
        <strong className="text-ink">
          {fmtMoneyFull(Math.round(LEA.leaThresholdPerPupil))} per student
        </strong>
        , and this slider raises it.{' '}
        <Link href="/lea" className="font-semibold text-accent hover:underline">
          See the full formula, step by step →
        </Link>
      </>
    ),
    impactKey: 'lea',
    baseline: 0,
    min: 0,
    max: 1_800,
    step: 25,
    effect: (value: number) =>
      value === 0 ? 'No increase' : `+$${fmtInt(Math.round(value))} per student`,
    unit: 'per student',
    // The slider measures an increase, so "today" is the standing threshold.
    todayLabel: `${fmtMoneyFull(Math.round(LEA.leaThresholdPerPupil))} goal`,
    markers: [],
  },
  {
    id: 'ellWeight',
    group: 'Student needs',
    icon: 'ell',
    color: '#009978',
    label: 'English learner support',
    sliderLabel: 'Dollars per English learner',
    description: 'Language help for students learning English.',
    bill: (
      <>
        The funding framework shown here comes from{' '}
        <a
          className="font-semibold underline underline-offset-2"
          href="https://app.leg.wa.gov/billsummary?BillNumber=2261&Year=2009"
          target="_blank"
          rel="noopener noreferrer"
        >
          ESHB 2261 (2009)
        </a>
        , Washington&apos;s core prototypical-school funding law.
      </>
    ),
    note: (
      <>
        The{' '}
        <StatuteLink href="https://app.leg.wa.gov/rcw/default.aspx?cite=28A.180">
          Transitional Bilingual Instruction Program
        </StatuteLink>{' '}
        (RCW 28A.180) funds language support until a student tests out.
        Districts with recent immigration or refugee resettlement carry most of
        this cost.
      </>
    ),
    impactKey: 'ell',
    baseline: 1,
    min: 1,
    max: 2,
    // The control has 1,000 physical positions, so $1.80 increments keep it
    // genuinely smooth rather than visibly snapping between dollar amounts.
    step: 0.001,
    effect: (value: number) =>
      `$${fmtInt(Math.round(BASELINE_ELL_PER_STUDENT * value))} per English learner`,
    unit: 'per student',
    markers: [],
  },
  {
    id: 'spedMultiplier',
    group: 'Student needs',
    icon: 'sped',
    color: '#d15f78',
    label: 'Special education',
    sliderLabel: 'Special education funding multiplier',
    description: 'Washington funds special education as a multiplier on basic education.',
    bill: (
      <>
        Most recently changed by{' '}
        <a
          className="font-semibold underline underline-offset-2"
          href="https://app.leg.wa.gov/billsummary?BillNumber=5263&Year=2025"
          target="_blank"
          rel="noopener noreferrer"
        >
          E2SSB 5263 (2025)
        </a>
        , which increased special-education funding.
      </>
    ),
    note: (
      <>
        Special education is funded as a multiplier on top of basic education,
        under{' '}
        <StatuteLink href="https://app.leg.wa.gov/rcw/default.aspx?cite=28A.150.390">
          RCW 28A.150.390
        </StatuteLink>
        . Districts have long reported spending more than the formula provides;
        2025&apos;s{' '}
        <StatuteLink href="https://app.leg.wa.gov/billsummary?BillNumber=5263&Year=2025">
          E2SSB 5263
        </StatuteLink>{' '}
        raised it and removed the enrollment cap, but the gap is still debated.
      </>
    ),
    impactKey: 'sped',
    baseline: 1.16,
    min: 1.16,
    // Reaches 3.00x so the slider can always close the gap to what a district
    // actually spends: statewide that takes about 1.57x, and the highest-cost
    // large districts (Bellevue, Seattle) 2.4-2.7x.
    max: 3,
    step: 0.01,
    effect: (value: number) => `${value.toFixed(2)}× basic education`,
    unit: 'multiplier',
    markers: [],
  },
  {
    id: 'msoc',
    group: 'School operations',
    icon: 'msoc',
    color: '#bd7600',
    label: 'Materials, Supplies, & Operating Costs (MSOC)',
    sliderLabel: 'MSOC dollars per student',
    description: 'Curriculum, technology, utilities, and insurance.',
    bill: (
      <>
        Most recently changed by{' '}
        <a
          className="font-semibold underline underline-offset-2"
          href="https://app.leg.wa.gov/billsummary?BillNumber=5192&Year=2025"
          target="_blank"
          rel="noopener noreferrer"
        >
          ESSB 5192 (2025)
        </a>
        , which increased MSOC allocations.
      </>
    ),
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
    // Statewide, districts spend about $1,776 per FTE on the operating costs
    // MSOC is meant to cover; the median district runs $2,179 and small
    // districts far more, because fixed costs spread over few students.
    // $4,500 clears all but the smallest 60 of 315 (only 3 of the 113
    // districts above 2,000 students).
    max: 4_500,
    step: 25,
    effect: (value: number) => `$${fmtInt(Math.round(value))} per student`,
    unit: 'per student',
    markers: [],
  },
  {
    id: 'transportation',
    group: 'School operations',
    icon: 'transportation',
    color: '#9a6a39',
    label: 'Student transportation',
    sliderLabel: 'Transportation dollars per student',
    description: 'Buses, drivers, fuel, and required routes.',
    bill: (
      <>
        Most recently changed by{' '}
        <a
          className="font-semibold underline underline-offset-2"
          href="https://app.leg.wa.gov/billsummary?BillNumber=5009&Year=2025"
          target="_blank"
          rel="noopener noreferrer"
        >
          ESSB 5009 (2025)
        </a>
        , which updated transportation allocations for different vehicle types.
      </>
    ),
    note: (
      <>
        Transportation is funded by a separate formula (
        <StatuteLink href="https://app.leg.wa.gov/rcw/default.aspx?cite=28A.160.192">
          RCW 28A.160.192
        </StatuteLink>
        ) based on the students a district actually carries and how far. Rural
        districts with long routes and districts running required special
        education routes feel changes here most.{' '}
        <strong className="text-ink">
          Both figures here are per enrolled student, not per bus rider
        </strong>{' '}
        - most students never board a bus, so the cost of actually carrying one
        is far higher than these numbers suggest. Bus purchases are excluded
        too: those run through the Transportation Vehicle Fund rather than the
        general fund.
      </>
    ),
    impactKey: 'transportation',
    baseline: BASELINE_TRANSPORTATION_PER_STUDENT,
    min: BASELINE_TRANSPORTATION_PER_STUDENT,
    max: 2_500,
    step: 25,
    effect: (value: number) => `$${fmtInt(Math.round(value))} per student`,
    unit: 'per student',
    markers: [],
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
    bill: (
      <>
        This is a modeled policy proposal, not current law: Washington has no
        statewide high-poverty concentration bonus. It is modeled on{' '}
        <StatuteLink href="https://www.cde.ca.gov/fg/aa/lc/lcffoverview.asp">
          California&apos;s Local Control Funding Formula
        </StatuteLink>
        .
      </>
    ),
    note: (
      <>
        California&apos;s LCFF pays a{' '}
        <strong className="text-ink">concentration grant</strong> to districts
        where more than 55% of students are low-income, English learners, or in
        foster care - on the theory that concentrated poverty costs more to
        address than the same students spread thinly. This slider models the
        same idea for Washington at a{' '}
        <strong className="text-ink">60% low-income</strong> threshold. It is an
        all-or-nothing cliff: a district just under the line receives nothing.
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
        : `+$${fmtInt(Math.round(value))} per low-income student`,
    unit: 'per student',
    todayLabel: '$0 per student',
    markers: [],
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
    const cap = currentCapFor(district.record.code);
    const room = levyRoom(levy, values.levyPerPupil, cap);
    const today = perStudent(room.collectedToday);
    const plan = perStudent(room.newAuthority);
    const approved = perStudent(room.approved);
    const ceiling = (levy.av * LEA.maxLevyRate) / 1000 / levy.enrollment;
    const scale = Math.max(ceiling, plan, approved);
    const pct = (v: number) => `${Math.max(0, Math.min(100, (100 * v) / scale))}%`;
    const unlocked = perStudent(room.unlocked);
    const needsVote = perStudent(room.needsVote);

    return (
      <figure>
        <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-series-state" />
            Collected today
          </span>
          {room.unlocked > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-series-local" />
              Already approved, cap-blocked
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-accent-soft" />
            Would need a new vote
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
                {unlocked > 0 && (
                  <div
                    className="h-full bg-series-local flex items-center justify-center text-white text-xs font-semibold"
                    style={{ width: pct(unlocked) }}
                  >
                    {unlocked / scale > 0.12 &&
                      `+${fmtMoneyFull(Math.round(unlocked))}`}
                  </div>
                )}
                {needsVote > 0 && (
                  <div
                    className="h-full bg-accent-soft"
                    style={{ width: pct(needsVote) }}
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
        {room.cappedBelowApproved && (
          <p className="mt-4 text-sm text-ink-secondary">
            {name}&apos;s voters have already approved a levy of{' '}
            <strong className="text-ink">{fmtMoney(room.approved)}</strong>, but
            the {fmtMoneyFull(Math.round(cap))} cap
            {cap !== LEA.maxLevyPerPupil
              ? ' it qualifies for as a district above 40,000 students'
              : ''}{' '}
            only lets it collect{' '}
            <strong className="text-ink">{fmtMoney(room.collectedToday)}</strong>.
            {room.unlocked > 0
              ? ` Raising the cap frees ${fmtMoney(room.unlocked)} of that without another election.`
              : ' Raising the cap is what would release the rest.'}
          </p>
        )}
      </figure>
    );
  }

  // LEA: a district's property wealth at the standard $1.50 rate compared
  // with the statewide goal. The chart intentionally shows the wealth test,
  // not the levy voters actually approved.
  if (lever.id === 'leaThreshold' && levy) {
    const baselineGoal = LEA.leaThresholdPerPupil;
    const goal = baselineGoal + values.leaThreshold;
    const wealth = leaFor(levy, baselineGoal).capacityPerPupil;
    const baselineHelp = Math.max(0, baselineGoal - wealth);
    const addedByPolicy = Math.max(0, goal - Math.max(baselineGoal, wealth));
    const chartTotal = Math.max(wealth, goal);
    const scale = chartTotal || 1;
    const pct = (v: number) => `${Math.max(0, Math.min(100, (100 * v) / scale))}%`;
    // Keep the floating "Goal" label from clipping off the right edge when
    // the goal line sits at the very end of the bar.
    const labelPct = (v: number) => `${Math.max(0, Math.min(96, (100 * v) / scale))}%`;
    const propertyValuePerStudent = levy.av / levy.enrollment;
    const qualifies = wealth < goal;
    return (
      <figure>
        <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#94a3b8]" />
            What their property could raise
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#8b5cf6]" />
            State help (LEA)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#c4b5fd]" />
            Added by your policy
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 border-t-2 border-dashed border-[#8b5cf6]"
              aria-hidden
            />
            Goal
          </span>
        </figcaption>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-28 shrink-0 text-right">
            <p className="font-bold leading-tight">{name}</p>
            <p className="text-[11px] text-ink-muted">
              {qualifies ? 'State help available' : 'No state help'}
            </p>
          </div>
          <div className="relative flex-1 h-16 pt-6">
            <div
              className="absolute top-0 z-10 whitespace-nowrap text-sm font-bold tabular-nums text-[#7c3aed]"
              style={{ left: labelPct(goal), transform: 'translateX(-50%)' }}
            >
              {values.leaThreshold > 0 ? 'Your goal' : 'Goal today'}:{' '}
              {fmtMoneyFull(Math.round(goal))}
            </div>
            <div className="absolute inset-x-0 bottom-0 h-10 rounded bg-[#e2e8f0]" />
            <div className="absolute inset-x-0 bottom-0 flex h-10">
              <div
                className="h-full rounded-l bg-[#94a3b8] flex items-center justify-center text-sm font-semibold text-white"
                style={{ width: pct(wealth) }}
              >
                {wealth / scale > 0.16 && fmtMoneyFull(Math.round(wealth))}
              </div>
              {baselineHelp > 0 && (
                <div
                  className="h-full bg-[#8b5cf6] flex items-center justify-center text-sm font-semibold text-white"
                  style={{ width: pct(baselineHelp) }}
                >
                  {baselineHelp / scale > 0.16 && fmtMoneyFull(Math.round(baselineHelp))}
                </div>
              )}
              {addedByPolicy > 0 && (
                <div
                  className="h-full bg-[#c4b5fd] flex items-center justify-center text-sm font-semibold text-[#3b0764]"
                  style={{ width: pct(addedByPolicy) }}
                >
                  {addedByPolicy / scale > 0.16 && `+${fmtMoneyFull(Math.round(addedByPolicy))}`}
                </div>
              )}
            </div>
            <div
              className="absolute bottom-0 h-10 border-l-[3px] border-dashed border-[#8b5cf6]"
              style={{ left: pct(goal) }}
              title={`Goal: ${fmtMoneyFull(Math.round(goal))} per student`}
            />
          </div>
          <div className="w-20 shrink-0 text-lg font-bold tabular-nums">
            {fmtMoneyFull(Math.round(chartTotal))}
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-secondary">
          $1.50/$1,000 ×{' '}
          {fmtMoneyFull(Math.round(propertyValuePerStudent))} in property value
          per student = <strong className="text-ink">{fmtMoneyFull(Math.round(wealth))}</strong>.
          {' '}
          {qualifies
            ? `${name} falls below the ${fmtMoneyFull(Math.round(goal))} goal, so it qualifies for LEA.`
            : `${name} is above the ${fmtMoneyFull(Math.round(goal))} goal, so it does not qualify for LEA.`}
        </p>
      </figure>
    );
  }

  // Special education is expressed as the excess-cost multiplier used in the
  // formula, rather than as a made-up dollar amount per student. The dashed
  // line is the multiplier that would cover what this district really spends.
  if (lever.id === 'spedMultiplier') {
    const spent = actualSpendPerUnit('spedMultiplier', district.record.code);
    const spentPerStudent = SPENDING[district.record.code]?.spedPerStudent ?? 0;
    // Headroom keeps the dashed spending rule off the bar's right edge.
    const scale = Math.max(lever.max, spent ? spent * 1.02 : 0);
    const pct = (v: number) => `${Math.max(0, Math.min(100, (100 * v) / scale))}%`;
    const added = values.spedMultiplier - lever.baseline;
    const covered = spent != null && values.spedMultiplier >= spent;
    return (
      <figure>
        <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#d15f78]" />
            Current formula multiplier
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#f9c7d1]" />
            Your increase
          </span>
          {spent != null && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 border-t-2 border-dashed border-ink" />
              What they actually spend
            </span>
          )}
        </figcaption>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-28 shrink-0 text-right">
            <p className="font-bold leading-tight">{name}</p>
            <p className="text-[11px] text-ink-muted">
              {fmtInt(district.record.demo.sped)} students served
            </p>
          </div>
          <div className="relative flex-1 h-16 pt-6">
            {spent != null && (
              <div
                className="absolute top-0 z-10 whitespace-nowrap text-sm font-bold tabular-nums text-ink"
                style={{ left: markerPct(spent, scale), transform: 'translateX(-50%)' }}
              >
                Actually spends: {spent.toFixed(2)}×
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex h-10 rounded overflow-hidden">
              <div
                className="h-full bg-[#d15f78] flex items-center justify-center text-sm font-semibold text-white"
                style={{ width: pct(lever.baseline) }}
              >
                {lever.baseline / scale > 0.16 && `${lever.baseline.toFixed(2)}×`}
              </div>
              {added > 0 && (
                <div
                  className="h-full bg-[#f9c7d1] flex items-center justify-center text-sm font-semibold text-[#831843]"
                  style={{ width: pct(added) }}
                >
                  {added / scale > 0.16 && `+${added.toFixed(2)}×`}
                </div>
              )}
            </div>
            {spent != null && (
              <div
                className="absolute bottom-0 h-10 border-l-[3px] border-dashed border-ink"
                style={{ left: pct(spent) }}
                title={`Actually spent: ${spent.toFixed(2)}x basic education`}
              />
            )}
          </div>
          <div className="w-20 shrink-0 text-lg font-bold tabular-nums">
            {values.spedMultiplier.toFixed(2)}×
          </div>
        </div>
        {spent != null && (
          <p className="mt-4 text-sm text-ink-secondary">
            {name} spends{' '}
            <strong className="text-ink">{fmtMoneyFull(spentPerStudent)}</strong>{' '}
            per student with a disability - about{' '}
            <strong className="text-ink">{spent.toFixed(2)}×</strong> basic
            education.{' '}
            {covered
              ? 'Your plan covers that in full.'
              : `Today's ${lever.baseline.toFixed(2)}× formula leaves the rest for the district to cover out of other money.`}
            {spent > lever.max && ' Fully funding it is past the top of this slider.'}
          </p>
        )}
      </figure>
    );
  }

  // The concentration bonus is all-or-nothing at 60% low-income. Below that
  // line this district gets nothing at any slider value, so show that plainly
  // instead of a bar implying money it will never receive.
  if (lever.id === 'povertyBonus') {
    const share =
      district.record.enrollment > 0
        ? district.record.demo.lowIncome / district.record.enrollment
        : 0;
    if (share < 0.6) {
      return (
        <p className="text-sm text-ink-secondary">
          <strong className="text-ink">{name}</strong> is{' '}
          <strong className="text-ink">{(100 * share).toFixed(0)}%</strong>{' '}
          low-income, under the 60% line this bonus is built around, so it
          receives <strong className="text-ink">nothing</strong> from this
          policy no matter how high the amount goes.
        </p>
      );
    }
  }

  // Everything else: a simple today-vs-plan per-student comparison.
  const counts: Partial<Record<LeverId, { base: number; now: number; who: string }>> = {
    povertyBonus: {
      base: 0,
      now: values.povertyBonus,
      who: `${fmtInt(district.record.demo.lowIncome)} low-income students`,
    },
    ellWeight: {
      base: BASELINE_ELL_PER_STUDENT,
      now: BASELINE_ELL_PER_STUDENT * values.ellWeight,
      who: `${fmtInt(district.record.demo.ell)} English learners`,
    },
    msoc: {
      base: 1_614,
      now: values.msoc,
      who: `${fmtInt(Math.round(district.record.fundingEnrollment))} funding FTE`,
    },
    transportation: {
      base: BASELINE_TRANSPORTATION_PER_STUDENT,
      now: values.transportation,
      who: `${fmtInt(district.record.enrollment)} students`,
    },
  };
  const c = counts[lever.id];
  if (!c) return null;
  // MSOC and transportation have a real F-196 spending line to compare with;
  // the rest are formula-only, so the chart stays a plain today-vs-plan bar.
  const spent = actualSpendPerUnit(lever.id, district.record.code);
  // A hair of headroom past the spending line so its dashed rule never sits
  // on the bar's right edge, where it would render half outside.
  const scale = Math.max(c.now, c.base, spent ? spent * 1.02 : 0) || 1;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (100 * v) / scale))}%`;
  const added = Math.max(0, c.now - c.base);
  const covered = spent != null && c.now >= spent;

  return (
    <figure>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-series-state" />
          Today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-series-local" />
          Your plan adds
        </span>
        {spent != null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 border-t-2 border-dashed border-ink" />
            What they actually spend
          </span>
        )}
      </figcaption>
      <div className={`flex items-center gap-3 ${spent != null ? 'mt-4' : 'mt-3'}`}>
        <div className="w-28 shrink-0 text-right">
          <p className="font-bold leading-tight">{name}</p>
          <p className="text-[11px] text-ink-muted">{c.who}</p>
        </div>
        {spent == null ? (
          <div className="flex-1 h-9 flex rounded overflow-hidden">
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
                className={`h-full bg-series-local flex items-center justify-center text-sm font-semibold text-white ${c.base > 0 ? '' : 'rounded-l'}`}
                style={{ width: pct(added) }}
              >
                {added / scale > 0.1 && `+${fmtMoneyFull(Math.round(added))}`}
              </div>
            )}
          </div>
        ) : (
          <div className="relative flex-1 h-16 pt-6">
            <div
              className="absolute top-0 z-10 whitespace-nowrap text-sm font-bold tabular-nums text-ink"
              style={{ left: markerPct(spent, scale), transform: 'translateX(-50%)' }}
            >
              Actually spends: {fmtMoneyFull(Math.round(spent))}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex h-10 rounded overflow-hidden">
              {c.base > 0 && (
                <div
                  className="h-full bg-series-state flex items-center justify-center text-white text-sm font-semibold"
                  style={{ width: pct(c.base) }}
                >
                  {c.base / scale > 0.16 && fmtMoneyFull(Math.round(c.base))}
                </div>
              )}
              {added > 0 && (
                <div
                  className="h-full bg-series-local flex items-center justify-center text-sm font-semibold text-white"
                  style={{ width: pct(added) }}
                >
                  {added / scale > 0.1 && `+${fmtMoneyFull(Math.round(added))}`}
                </div>
              )}
            </div>
            <div
              className="absolute bottom-0 h-10 border-l-[3px] border-dashed border-ink"
              style={{ left: pct(spent) }}
              title={`Actually spent: ${fmtMoneyFull(Math.round(spent))} per student`}
            />
          </div>
        )}
        <div className="w-20 shrink-0 text-lg font-bold tabular-nums">
          {fmtMoneyFull(Math.round(c.now))}
        </div>
      </div>
      {spent != null && (
        <p className="mt-4 text-sm text-ink-secondary">
          {name} spends{' '}
          <strong className="text-ink">{fmtMoneyFull(Math.round(spent))}</strong>{' '}
          per student here, against{' '}
          <strong className="text-ink">{fmtMoneyFull(Math.round(c.base))}</strong>{' '}
          from the formula.{' '}
          {covered
            ? 'Your plan covers that in full.'
            : `Closing the gap takes ${fmtMoneyFull(Math.round(spent - c.base))} more per student.`}
          {spent > lever.max && ' That is past the top of this slider.'}
        </p>
      )}
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
  // Seattle already sits above the standard levy cap, so its effective policy
  // is its own higher limit until the slider passes it. Showing the raw slider
  // value there would contradict both the "Today" label and the $0 impact.
  const districtCap =
    lever.id === 'levyPerPupil' && district
      ? currentCapFor(district.record.code)
      : null;
  const shownValue = districtCap != null ? Math.max(value, districtCap) : value;
  const impact = district ? leverImpactFor(lever.id, values, district) : null;
  const current = district?.record.rev.total ?? 0;
  const newMoney = impact?.newMoney ?? 0;

  /*
    Two levers have a real eligibility test: LEA is a wealth test, and the
    poverty bonus has a 60% cliff. For a district that fails the test, showing
    "+$1,800 per student" next to the slider - and again at the top of its
    range - reads as money arriving when the actual answer is zero. Those
    labels become "Does not qualify" instead.
  */
  const gated = lever.id === 'leaThreshold' || lever.id === 'povertyBonus';
  const failsAt = (v: number) =>
    !!district &&
    gated &&
    v !== lever.baseline &&
    Math.round(
      leverImpactFor(lever.id, { ...values, [lever.id]: v }, district)?.newMoney ?? 0
    ) === 0;
  const disqualified = failsAt(value);
  const disqualifiedAtMax = failsAt(lever.max);

  return (
    <section
      className={`card border-l-4 p-5 md:p-6 ${
        lever.id === 'leaThreshold' ? 'bg-[#f7f4ff]' : ''
      }`}
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
          <p className="mt-2 text-sm text-ink-secondary">
            {lever.bill}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={lever.id} className="text-sm font-semibold">
            {lever.sliderLabel}
          </label>
          {disqualified ? (
            <span className="text-lg font-bold text-ink-muted">
              Does not qualify
            </span>
          ) : (
            <span
              className="text-lg font-bold tabular-nums"
              style={{ color: lever.color }}
            >
              {lever.effect(shownValue)}
            </span>
          )}
        </div>
        <div className="relative mt-2">
          {/*
            The slider runs on a normalized 0-1000 position rather than the
            lever's own units. A raw `step` that does not divide evenly into
            (max - min) leaves the top of the range unreachable - the levy cap
            stopped at $5,988 of $6,000 - and coarse steps feel notchy. One
            thousand positions is smooth and always lands exactly on max.
          */}
          <input
            id={lever.id}
            type="range"
            min={0}
            max={SLIDER_STEPS}
            step={1}
            value={Math.round(
              ((value - lever.min) / (lever.max - lever.min)) * SLIDER_STEPS
            )}
            onInput={(event) => {
              const position = Number(event.currentTarget.value);
              setValues((previous) => ({
                ...previous,
                [lever.id]: valueAtPosition(position, lever.min, lever.max),
              }));
            }}
            className="range-slider w-full"
            style={
              {
                '--track-color': lever.color,
                '--fill': `${(value - lever.min) / (lever.max - lever.min)}`,
              } as React.CSSProperties
            }
          />
          {lever.markers.map((marker) => {
            const pct =
              ((marker.value - lever.min) / (lever.max - lever.min)) * 100;
            return (
              <div
                key={marker.value}
                className="pointer-events-none absolute top-full flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${pct}%` }}
              >
                <div
                  className="h-1.5 w-0.5"
                  style={{ backgroundColor: lever.color }}
                />
                <span
                  className="mt-0.5 whitespace-nowrap text-[10px] font-semibold"
                  style={{ color: lever.color }}
                >
                  {marker.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-ink-muted mt-4">
          <span>
            Today (
            {'todayLabel' in lever && lever.todayLabel
              ? lever.todayLabel
              : // Seattle's levy cap is higher than every other district's, so
                // "today" for this lever depends on who is selected.
                lever.effect(districtCap ?? lever.baseline)}
            )
          </span>
          <span>
            {disqualifiedAtMax
              ? 'Still does not qualify'
              : lever.effect(lever.max)}
          </span>
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
    // A policy plan belongs to the district it was built for. Starting a new
    // district with the old sliders would make its summary look pre-filled.
    setValues(BASELINE);
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
    let unlocked = 0;
    let needsVote = 0;
    const zeroLevers: string[] = [];
    // Every moved lever that pays this district something, so the headline
    // number can be read back as the list of choices that produced it.
    const breakdown: {
      id: LeverId;
      label: string;
      color: string;
      effect: string;
      amount: number;
      local: boolean;
    }[] = [];
    if (!district)
      return { state, local, unlocked, needsVote, zeroLevers, breakdown };
    for (const lever of LEVERS) {
      if (values[lever.id] === lever.baseline) continue;
      const impact = leverImpactFor(lever.id, values, district);
      const amount = impact?.newMoney ?? 0;
      if (impact?.local) local += amount;
      else state += amount;
      unlocked += impact?.unlocked ?? 0;
      needsVote += impact?.needsVote ?? 0;
      // Flag levers the user moved that do nothing here, so the difference
      // between the statewide and district totals is explained rather than
      // looking like a bug.
      if (Math.round(amount) === 0) zeroLevers.push(lever.label);
      else
        breakdown.push({
          id: lever.id,
          label: lever.label,
          color: lever.color,
          effect: lever.effect(values[lever.id]),
          amount,
          local: Boolean(impact?.local),
        });
    }
    breakdown.sort((a, b) => b.amount - a.amount);
    return { state, local, unlocked, needsVote, zeroLevers, breakdown };
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
            <li>
              &ldquo;What they actually spend&rdquo; on special education,
              MSOC and transportation is this district&apos;s own{' '}
              <strong className="text-ink">2024-25 F-196</strong> General Fund
              actuals: special education is programs 21/22/24/26, MSOC is
              supplies, purchased services and travel (objects 5, 7 and 8){' '}
              <strong className="text-ink">within basic education</strong>{' '}
              (programs 01, 02 and 03) plus purchased services and travel
              (objects 7 and 8) in district-wide support (program 97), and
              transportation is program 99. Scoping MSOC that way matters:
              counting every non-salary object across every program would pull
              in capital outlay and the non-salary share of special education,
              transportation, and food service, double-counting the other two
              lines. Because these are{' '}
              <strong className="text-ink">General Fund only</strong>,
              transportation excludes buses bought through the Transportation
              Vehicle Fund and so understates the true cost - for most districts
              it lands below the modeled state allocation for that reason.
            </li>
            <li>
              The MSOC slider starts at the{' '}
              <strong className="text-ink">$1,614 per-student</strong> rate set
              for 2025-26, while the spending it is compared against is 2024-25
              actuals, so the two sit one year apart. The slider also models a
              single flat rate and leaves out the separate{' '}
              <strong className="text-ink">~$215 per-student</strong> add-on the
              formula pays for grades 9-12, so it understates what districts
              with high schools actually receive.
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
              districtTotals.state + districtTotals.local > 0 ? 'text-accent-deep' : 'text-ink'
            }`}
          >
            {fmtSignedMoney(districtTotals.state + districtTotals.local)}
            {Math.round(districtTotals.state + districtTotals.local) !== 0 && (
              <span className="text-base font-normal text-ink-secondary"> / year</span>
            )}
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            {districtTotals.state + districtTotals.local === 0
              ? 'No money from your plan reaches this district yet.'
              : `${((100 * (districtTotals.state + districtTotals.local)) / district.record.rev.total).toFixed(2)}% on top of its ${fmtMoney(district.record.rev.total)} budget.`}
          </p>
          {/*
            Levy room splits in two. Money the cap blocks today is money voters
            have ALREADY approved, so calling all of it "if voters approve"
            would be wrong for the 46 districts in that position.
          */}
          {districtTotals.unlocked > 0 && (
            <p className="mt-2 text-sm text-ink-secondary">
              <strong className="text-ink">
                {fmtSignedMoney(districtTotals.unlocked)}
              </strong>{' '}
              of that is local levy money{' '}
              <strong className="text-ink">voters have already approved</strong>{' '}
              but the cap blocks today - no new election needed.
            </p>
          )}
          {districtTotals.needsVote > 0 && (
            <p className="mt-2 text-sm text-ink-secondary">
              <strong className="text-ink">
                {fmtSignedMoney(districtTotals.needsVote)}
              </strong>{' '}
              of that is local levy room beyond what voters have approved, so it
              would take a new levy vote.
            </p>
          )}
          {/* Which slider produced which share of the headline number. */}
          {districtTotals.breakdown.length > 0 && (
            <ul className="mt-4 pt-4 border-t border-line space-y-2.5">
              {districtTotals.breakdown.map((item) => {
                const total = districtTotals.state + districtTotals.local;
                const share = total > 0 ? (100 * item.amount) / total : 0;
                return (
                  <li key={item.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-sm align-middle"
                          style={{ backgroundColor: item.color }}
                        />
                        <strong className="text-ink">{item.label}</strong>{' '}
                        <span className="text-ink-muted">- {item.effect}</span>
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-ink">
                        {fmtSignedMoney(item.amount)}
                        {item.local && (
                          <span className="ml-1 font-normal text-xs text-ink-muted">
                            local
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1 ml-[18px] h-1.5 rounded-full bg-baseline/40">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(2, share)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
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
              : at these settings this district receives nothing.
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
