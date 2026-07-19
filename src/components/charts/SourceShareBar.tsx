'use client';

import { useState } from 'react';
import { fmtMoney, pct } from '@/lib/format';

export type SourceSlices = {
  local: number;
  state: number;
  federal: number;
  other: number;
};

const SEGMENTS: { key: keyof SourceSlices; label: string; color: string; blurb: string }[] = [
  {
    key: 'state',
    label: 'State',
    color: '#2a78d6',
    blurb: 'Apportionment from the state general fund — the prototypical model plus categorical programs',
  },
  {
    key: 'local',
    label: 'Local',
    color: '#1baf7a',
    blurb: 'Voter-approved enrichment levies and other local revenue',
  },
  {
    key: 'federal',
    label: 'Federal',
    color: '#eda100',
    blurb: 'Federal programs like Title I and special education (IDEA) grants',
  },
  {
    key: 'other',
    label: 'Other',
    color: '#008300',
    blurb: 'Payments from other districts and agencies',
  },
];

export default function SourceShareBar({
  slices,
  caption,
}: {
  slices: SourceSlices;
  caption?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = SEGMENTS.reduce((s, seg) => s + slices[seg.key], 0);
  if (!total) return null;

  return (
    <figure>
      <div
        className="flex h-6 rounded overflow-hidden bg-paper"
        style={{ gap: 2 }}
        role="img"
        aria-label={`Funding sources: ${SEGMENTS.map(
          (s) => `${s.label} ${pct(slices[s.key], total)}`
        ).join(', ')}`}
      >
        {SEGMENTS.map((seg) => {
          const share = (100 * slices[seg.key]) / total;
          if (share <= 0) return null;
          return (
            <div
              key={seg.key}
              className="relative flex items-center justify-center transition-opacity"
              style={{
                width: `${share}%`,
                background: seg.color,
                opacity: hover && hover !== seg.key ? 0.45 : 1,
              }}
              onMouseEnter={() => setHover(seg.key)}
              onMouseLeave={() => setHover(null)}
            >
              {share >= 12 && (
                <span className="text-xs font-semibold text-white select-none">
                  {Math.round(share)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {SEGMENTS.map((seg) => {
          const v = slices[seg.key];
          if (v <= 0) return null;
          return (
            <div
              key={seg.key}
              className="flex items-center gap-1.5 text-sm"
              onMouseEnter={() => setHover(seg.key)}
              onMouseLeave={() => setHover(null)}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ background: seg.color }}
                aria-hidden
              />
              <span className="text-ink-secondary">{seg.label}</span>
              <span className="font-medium tabular-nums">
                {fmtMoney(v)} · {pct(v, total)}
              </span>
            </div>
          );
        })}
      </div>
      {hover && (
        <p className="mt-2 text-xs text-ink-muted">
          {SEGMENTS.find((s) => s.key === hover)?.blurb}
        </p>
      )}
      {caption && !hover && (
        <p className="mt-2 text-xs text-ink-muted">{caption}</p>
      )}
    </figure>
  );
}
