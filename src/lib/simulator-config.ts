/**
 * The Policy Simulator's control bounds, in one place.
 *
 * Simulator.tsx owns the sliders, their copy, and the impact maths. But the
 * assistant also has to validate a request like "set the special education
 * multiplier to 1.5" before it touches the page, and it cannot import
 * Simulator.tsx to do it - that module is a large client component that pulls
 * in every chart on the page.
 *
 * So the numeric envelope of each control lives here and Simulator.tsx reads
 * it. One source of truth: if a bound moves, the slider and the assistant's
 * validator move together, and there is no second table to forget.
 */
import levyData from '@/data/levy.json';
import allocationData from '@/data/allocation.json';
import districtsData from '@/data/districts.json';

const LEA = levyData.assumptions;

const STATEWIDE_ENROLLMENT = districtsData.statewide.enrollment;

/*
  Pupil transportation operations, summed from every district's actual state
  allotment rather than a rounded guess. Kept here because it is the floor of
  the transportation slider, and the assistant has to know that floor to reject
  a value below current law.
*/
const BASELINE_TRANSPORTATION = Object.values(allocationData.districts).reduce(
  (sum, district) => sum + district.transportation,
  0
);

export const BASELINE_TRANSPORTATION_PER_STUDENT =
  BASELINE_TRANSPORTATION / STATEWIDE_ENROLLMENT;

export type SimulatorControlId =
  | 'levyPerPupil'
  | 'leaThreshold'
  | 'ellWeight'
  | 'spedMultiplier'
  | 'msoc'
  | 'transportation'
  | 'povertyBonus'
  | 'lapHours';

export type SimulatorControlSpec = {
  id: SimulatorControlId;
  /** Plain-language name, used in assistant confirmations. */
  label: string;
  /** Value under current Washington law - every slider starts here. */
  baseline: number;
  min: number;
  max: number;
  step: number;
  /** How to describe the number: dollars per student, a bare multiplier, or hours per week. */
  kind: 'money' | 'multiplier' | 'hours';
  /** Search terms that should resolve to this control. */
  aliases: string[];
};

export const SIMULATOR_CONTROLS: readonly SimulatorControlSpec[] = [
  {
    id: 'levyPerPupil',
    label: 'Levy cap',
    baseline: LEA.maxLevyPerPupil,
    min: LEA.maxLevyPerPupil,
    max: 6_000,
    step: 25,
    kind: 'money',
    aliases: ['levy cap', 'levy lid', 'enrichment levy', 'levy limit', 'local levy'],
  },
  {
    id: 'leaThreshold',
    label: 'Local Effort Assistance (LEA)',
    baseline: 0,
    min: 0,
    max: 1_800,
    step: 25,
    kind: 'money',
    aliases: [
      'lea',
      'local effort assistance',
      'levy equalization',
      'equalization',
      'lea threshold',
    ],
  },
  {
    id: 'ellWeight',
    label: 'English learner support',
    baseline: 1,
    min: 1,
    max: 2,
    step: 0.001,
    kind: 'multiplier',
    aliases: [
      'ell',
      'english learner',
      'english language learner',
      'multilingual',
      'bilingual',
      'tbip',
    ],
  },
  {
    id: 'spedMultiplier',
    label: 'Special education',
    baseline: 1.16,
    min: 1.16,
    max: 3,
    step: 0.01,
    kind: 'multiplier',
    aliases: [
      'sped',
      'special education',
      'special ed',
      'students with disabilities',
      'idea',
      'multiplier',
    ],
  },
  {
    id: 'msoc',
    label: 'Materials, Supplies, & Operating Costs (MSOC)',
    baseline: 1_614,
    min: 1_614,
    max: 4_500,
    step: 25,
    kind: 'money',
    aliases: [
      'msoc',
      'materials',
      'supplies',
      'operating costs',
      'utilities',
      'insurance',
      'textbooks',
    ],
  },
  {
    id: 'transportation',
    label: 'Student transportation',
    baseline: BASELINE_TRANSPORTATION_PER_STUDENT,
    min: BASELINE_TRANSPORTATION_PER_STUDENT,
    max: 2_500,
    step: 25,
    kind: 'money',
    aliases: ['transportation', 'buses', 'bus', 'transport', 'routes'],
  },
  {
    id: 'povertyBonus',
    label: 'High-poverty school bonus',
    baseline: 0,
    min: 0,
    max: 3_000,
    step: 100,
    kind: 'money',
    aliases: ['poverty', 'high poverty', 'low income', 'poverty bonus'],
  },
  {
    id: 'lapHours',
    label: 'Learning Assistance Program hours',
    /*
      Current law's extended-support hours per eligible low-income student per
      week, RCW 28A.150.260(10)(a). Mirrors LAP_HOURS_PER_WEEK in lib/lap.ts -
      kept literal here so this config stays free of that module's data
      imports; tests/lap.test.ts asserts the two never drift.
    */
    baseline: 2.3975,
    min: 2.3975,
    max: 4.8,
    step: 0.05,
    kind: 'hours',
    aliases: ['lap', 'learning assistance', 'lap hours', 'extended support'],
  },
] as const;

const CONTROLS_BY_ID = new Map<string, SimulatorControlSpec>(
  SIMULATOR_CONTROLS.map((control) => [control.id, control])
);

export function simulatorControl(id: string): SimulatorControlSpec | null {
  return CONTROLS_BY_ID.get(id) ?? null;
}

export function isSimulatorControlId(id: string): id is SimulatorControlId {
  return CONTROLS_BY_ID.has(id);
}

/**
 * Clamp a requested value into a control's legal range, refusing anything
 * that is not a finite number.
 *
 * Returns the clamped value plus whether clamping happened, so the assistant
 * can tell the visitor "that is below current law, so I set it to the minimum"
 * instead of silently doing something different from what was asked.
 */
export function clampControlValue(
  id: SimulatorControlId,
  value: number
): { value: number; clamped: boolean } | null {
  const control = CONTROLS_BY_ID.get(id);
  if (!control) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const clampedValue = Math.min(control.max, Math.max(control.min, value));
  return {
    value: clampedValue,
    // Float noise from the model (1.4999999) should not read as a clamp.
    clamped: Math.abs(clampedValue - value) > 1e-9,
  };
}
