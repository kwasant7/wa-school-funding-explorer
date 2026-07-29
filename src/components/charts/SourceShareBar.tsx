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
 * Below this share, a label centered on the segment would overflow past both
 * of its neighbors, not just one - that's the only case worth moving below
 * the bar instead. Everything else keeps its label inline, at the same size,
 * even if it pokes slightly into the next segment: that reads far better than
 * a label jumping to a different position depending on the number.
 */
const BELOW_BAR_MAX = 2;

export default function SourceShareBar({
  slices,
  caption,
}: {
  slices: SourceSlices;
  caption?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = SEGMENTS.reduce((s, seg) => s + slices[seg.key], 0);

  // Each visible segment's share and midpoint (as % across the bar), used to
  // place both the inline and below-bar labels.
  const parts: { key: string; label: string; share: number; center: number; color: string }[] = [];
  if (total) {
    let run = 0;
    for (const seg of SEGMENTS) {
      const share = (100 * slices[seg.key]) / total;
      if (share > 0) {
        parts.push({ key: seg.key, label: seg.label, share, center: run + share / 2, color: seg.color });
        run += share;
      }
    }
  }
  const inlineParts = parts.filter((p) => p.share > BELOW_BAR_MAX);
  const belowParts = parts.filter((p) => p.share <= BELOW_BAR_MAX);

  if (!total) return null;

  return (
    <figure>
      {/*
        The bar is a plain color strip; every label - inline or below - lives
        in an overlay so text can overflow past a narrow segment's own edges
        without being clipped by the bar's rounded corners.
      */}
      <div className="relative">
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
                className="transition-opacity"
                style={{
                  width: `${share}%`,
                  background: seg.color,
                  opacity: hover && hover !== seg.key ? 0.45 : 1,
                }}
                onMouseEnter={() => setHover(seg.key)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {inlineParts.map((p) => (
            <span
              key={p.key}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold text-white select-none transition-opacity"
              style={{
                left: `${p.center}%`,
                textShadow: '0 1px 2px rgb(0 0 0 / 0.35)',
                opacity: hover && hover !== p.key ? 0.45 : 1,
              }}
            >
              {Math.round(p.share)}%
            </span>
          ))}
        </div>
      </div>
      {/*
        Only a genuinely sliver-thin segment (2% or less) gets pushed below
        the bar instead - centering a label on a 1% slice would overflow both
        neighbors at once, which no longer reads as "belonging" to it.
      */}
      {belowParts.length > 0 && (
        <div className="relative h-4" aria-hidden>
          {belowParts.map((p) => (
            <span
              key={p.key}
              className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums leading-4 transition-opacity"
              style={{
                left: `${Math.min(97, Math.max(3, p.center))}%`,
                color: p.color,
                opacity: hover && hover !== p.key ? 0.45 : 1,
              }}
            >
              {p.share < 1 ? '<1' : Math.round(p.share)}%
            </span>
          ))}
        </div>
      )}
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
