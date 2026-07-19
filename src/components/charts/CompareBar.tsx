/**
 * A horizontal percentage bar (district value) with a tick marking the state
 * average, so every district reads against the same reference.
 */
export default function CompareBar({
  label,
  value,
  reference,
}: {
  label: string;
  value: number; // 0-100
  reference: number; // 0-100 state average
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = Math.max(0, Math.min(100, reference));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-secondary">{label}</span>
        <span className="font-medium tabular-nums">
          {v.toFixed(0)}%{' '}
          <span className="text-ink-muted font-normal">
            (state {r.toFixed(0)}%)
          </span>
        </span>
      </div>
      <div className="relative mt-1 h-3 rounded bg-accent-soft/60">
        <div
          className="absolute inset-y-0 left-0 rounded-l bg-series-state"
          style={{ width: `${v}%`, borderRadius: v > 98 ? 4 : '4px 4px 4px 4px' }}
        />
        <div
          className="absolute -inset-y-0.5 w-0.5 bg-accent-deep"
          style={{ left: `calc(${r}% - 1px)` }}
          title={`State average: ${r.toFixed(0)}%`}
        />
      </div>
    </div>
  );
}
