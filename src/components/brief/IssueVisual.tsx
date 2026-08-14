'use client';

/**
 * The five pictures a brief can draw.
 *
 * Each one has to survive three things: being read by someone who skipped the
 * sentence above it, being read by a screen reader, and being printed in
 * black and white. So every chart states its numbers as text inside the
 * figure, carries a plain-language `role="img"` label, and never uses colour
 * as the only difference between two bars - the shorter bar is shorter, which
 * is the actual message.
 */
import { fmtInt, fmtMoney, fmtMoneyOnGrid } from '@/lib/format';
import type { IssueVisual as Visual } from '@/lib/diagnosis';

/**
 * A bar label, at whatever precision the figure was aligned to.
 *
 * When `step` is set the two bars and the caption were snapped onto one grid by
 * `shortfall()` in diagnosis.ts, and the labels have to be printed at that
 * precision or the arithmetic stops closing. Figures that are not a subtraction
 * (a ratio, a headcount) carry no grid and use the ordinary site formatter.
 */
function value(n: number, visual: Extract<Visual, { kind: 'versus' }>): string {
  if (visual.format !== 'money') return fmtInt(Math.round(n));
  return visual.step ? fmtMoneyOnGrid(n, visual.step) : fmtMoney(n);
}

/**
 * Two bars, cost above funding.
 *
 * In the briefs the cost bar is always the longer one - an issue is by
 * definition a shortfall - and putting the smaller funding bar second makes
 * the missing length the last thing the eye travels over. The Big 3 card
 * reuses this figure for programs where funding won, keeping the same order
 * so the story stays "here is the bill, here is the cheque"; those figures
 * set `covered` and get a green caption instead of the red one.
 */
function Versus({ visual }: { visual: Extract<Visual, { kind: 'versus' }> }) {
  const max = Math.max(visual.a, visual.b, 1);
  const rows = [
    { label: visual.aLabel, amount: visual.a, tone: 'full' as const },
    { label: visual.bLabel, amount: visual.b, tone: 'short' as const },
  ];

  return (
    <figure
      className="mt-3"
      role="img"
      aria-label={`${visual.aLabel}: ${value(visual.a, visual)}. ${visual.bLabel}: ${value(visual.b, visual)}. ${visual.gapLabel}.`}
    >
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-3 text-xs text-ink-secondary">
              <span>{row.label}</span>
              <span className="font-bold tabular-nums text-ink">
                {value(row.amount, visual)}
              </span>
            </div>
            <div className="mt-1 h-6 w-full rounded-md bg-paper">
              <div
                className={`h-full rounded-md ${
                  row.tone === 'full' ? 'bg-accent' : 'bg-accent-soft'
                }`}
                style={{ width: `${Math.max(2, (100 * row.amount) / max)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <figcaption
        className={`mt-2 text-sm font-bold ${visual.covered ? 'text-good' : 'text-critical'}`}
      >
        {visual.gapLabel}
      </figcaption>
    </figure>
  );
}

/**
 * A hundred dots, some filled.
 *
 * A percentage asks the reader to do arithmetic; a hundred dots asks them to
 * look. The statewide figure sits underneath as its own short row so the two
 * can be compared by length without reading either number.
 */
function Dots({ visual }: { visual: Extract<Visual, { kind: 'dots' }> }) {
  const filled = Math.max(0, Math.min(100, visual.filled));
  const compare = Math.max(0, Math.min(100, visual.compare));

  return (
    <figure
      className="mt-3"
      role="img"
      aria-label={`${filled} out of every 100 ${visual.label}, compared with ${compare} out of 100 ${visual.compareLabel}.`}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-accent">{filled}</span>
        <span className="text-sm text-ink-secondary">
          out of every 100 {visual.label}
        </span>
      </div>
      <div aria-hidden className="mt-2 grid w-fit grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]">
        {Array.from({ length: 100 }, (_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${i < filled ? 'bg-accent' : 'bg-line'}`}
          />
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-ink-secondary">
        Statewide it is{' '}
        <strong className="text-ink">{compare} out of 100</strong>.
      </figcaption>
    </figure>
  );
}

/** Savings against the level below which one bad year forces cuts. */
function Gauge({ visual }: { visual: Extract<Visual, { kind: 'gauge' }> }) {
  // Negative reserves are real and have to be drawable, so the track spans a
  // little below zero rather than clamping the bar to nothing.
  const min = Math.min(0, visual.value);
  const max = Math.max(visual.safe * 3, visual.value, 15);
  const span = max - min || 1;
  const position = (n: number) => `${((n - min) / span) * 100}%`;
  const negative = visual.value < 0;

  return (
    <figure
      className="mt-3"
      role="img"
      aria-label={`${visual.label}: ${visual.value.toFixed(1)} percent of a year of spending. ${visual.safeLabel}: ${visual.safe} percent.`}
    >
      <div className="flex items-baseline gap-2">
        <span
          className={`text-3xl font-bold tabular-nums ${negative ? 'text-critical' : 'text-ink'}`}
        >
          {visual.value.toFixed(1)}%
        </span>
        <span className="text-sm text-ink-secondary">{visual.label}</span>
      </div>
      <div className="relative mt-3 h-6 w-full rounded-md bg-paper">
        <div
          className={`h-full rounded-md ${negative ? 'bg-critical' : 'bg-accent'}`}
          style={{
            left: position(Math.min(0, visual.value)),
            width: position(min + Math.abs(visual.value)),
            position: 'absolute',
          }}
        />
        {/* The safe line, drawn on top so it reads as a threshold, not a bar. */}
        <div
          className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-ink"
          style={{ left: position(visual.safe) }}
        />
      </div>
      <figcaption className="mt-2 text-xs text-ink-secondary">
        The black line is the {visual.safeLabel.toLowerCase()} ({visual.safe}%). Below it,
        one bad year means cuts.
      </figcaption>
    </figure>
  );
}

/** Escalating states, with this district's marked. */
function Steps({ visual }: { visual: Extract<Visual, { kind: 'steps' }> }) {
  return (
    <figure
      className="mt-3"
      role="img"
      aria-label={`Stage ${visual.current + 1} of ${visual.steps.length}: ${visual.steps[visual.current]}.`}
    >
      <ol className="flex gap-1.5">
        {visual.steps.map((step, i) => {
          /*
            Only the current stage is red. Filling earlier stages in the same
            colour painted "Healthy" as an alarm; grey reads as "passed".
          */
          const here = i === visual.current;
          const passed = i < visual.current;
          return (
            <li key={step} className="flex-1">
              <div
                className={`h-1.5 rounded-full ${
                  here ? 'bg-critical' : passed ? 'bg-baseline' : 'bg-line'
                }`}
              />
              <p
                className={`mt-1.5 text-[11px] leading-tight ${
                  here ? 'font-bold text-critical' : 'text-ink-muted'
                }`}
              >
                {step}
                {/* Not colour alone: the current stage is named in text too. */}
                {here && <span className="sr-only"> - this district is here</span>}
              </p>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/** One number falling between two years. */
function Trend({ visual }: { visual: Extract<Visual, { kind: 'trend' }> }) {
  const max = Math.max(visual.from, visual.to, 1);

  return (
    <figure
      className="mt-3"
      role="img"
      aria-label={`${fmtInt(Math.round(visual.from))} students in ${visual.fromLabel}, ${fmtInt(Math.round(visual.to))} in ${visual.toLabel}. ${visual.changeLabel}.`}
    >
      <div className="flex items-end gap-4">
        {[
          { label: visual.fromLabel, amount: visual.from },
          { label: visual.toLabel, amount: visual.to },
        ].map((point, i) => (
          <div key={point.label} className="flex-1">
            <p className="text-lg font-bold tabular-nums text-ink">
              {fmtInt(Math.round(point.amount))}
            </p>
            <div
              className={`mt-1 rounded-t-md ${i === 0 ? 'bg-accent-soft' : 'bg-accent'}`}
              style={{ height: `${Math.max(8, (56 * point.amount) / max)}px` }}
            />
            <p className="mt-1 text-xs text-ink-secondary">{point.label}</p>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-sm font-bold text-critical">
        {visual.changeLabel}
      </figcaption>
    </figure>
  );
}

export default function IssueVisual({ visual }: { visual: Visual }) {
  switch (visual.kind) {
    case 'versus':
      return <Versus visual={visual} />;
    case 'dots':
      return <Dots visual={visual} />;
    case 'gauge':
      return <Gauge visual={visual} />;
    case 'steps':
      return <Steps visual={visual} />;
    case 'trend':
      return <Trend visual={visual} />;
    default:
      return null;
  }
}
