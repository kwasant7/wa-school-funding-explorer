'use client';

import { useState } from 'react';
import { fmtMoney, pct, pctLabel } from '@/lib/format';

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
    blurb: 'Apportionment from the state general fund - the prototypical model plus categorical programs',
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

/**
 * Segments narrower than this can't hold a centered "NN%" without crowding
 * their own edges. There are only four sources here and the bar is full
 * width, so a 3% slice is still comfortably wide - and the legend underneath
 * carries the exact dollars and share for every source regardless.
 */
const MIN_LABEL_SHARE = 3;

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
      {/*
        Labels sit inside their own flex child rather than in an absolutely
        positioned overlay. The bar has 2px gaps between segments, which an
        overlay measured in percentages cannot account for - the labels drift
        further off-centre with every gap they cross. Flex centering is exact
        by construction.
      */}
      <div
        className="flex h-7 rounded overflow-hidden bg-paper"
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
              className="flex items-center justify-center transition-opacity"
              style={{
                width: `${share}%`,
                background: seg.color,
                opacity: hover && hover !== seg.key ? 0.45 : 1,
              }}
              onMouseEnter={() => setHover(seg.key)}
              onMouseLeave={() => setHover(null)}
            >
              {share >= MIN_LABEL_SHARE && (
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
              <span
                className={hover === seg.key ? 'font-bold text-ink' : 'text-ink-secondary'}
              >
                {seg.label}
              </span>
              <span
                className={`tabular-nums ${hover === seg.key ? 'font-bold text-ink' : 'font-medium'}`}
              >
                {fmtMoney(v)} · {pctLabel(v, total)}
              </span>
            </div>
          );
        })}
      </div>
      {/*
        Reserved height, always present: swapping this line in and out on
        hover used to reflow everything below the chart on every mouse move.
        Now hovering only changes the text inside a slot that was already there.
      */}
      <p className="mt-2 min-h-[1.25rem] text-xs text-ink-muted">
        {hover ? SEGMENTS.find((s) => s.key === hover)?.blurb : caption ?? ''}
      </p>
    </figure>
  );
}
