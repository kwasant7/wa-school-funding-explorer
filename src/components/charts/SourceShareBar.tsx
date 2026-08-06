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
                /*
                  A solid white chip rather than white text straight on the
                  fill. White text failed WCAG contrast on three of these four
                  colors (as low as 2.17:1 on the federal amber) - a fix that
                  picked black-or-white per color still failed on the state
                  blue, since neither reaches 4.5:1 against it. A white chip
                  under dark text passes regardless of the segment color
                  underneath, including any color added later.
                */
                <span className="rounded bg-white px-1 py-0.5 text-[11px] font-semibold text-ink select-none">
                  {Math.round(share)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/*
        Hover must not change any element's size. Weight is fixed and only
        colour responds, because bolding a legend entry widens it, and at these
        widths a few extra pixels re-wraps the row - which changes the card's
        height, moves the bar out from under the cursor, and drops the hover.
        The result was a legend that flickered as fast as the mouse moved.
        `whitespace-nowrap` stops an entry from breaking mid-figure for the
        same reason.
      */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {SEGMENTS.map((seg) => {
          const v = slices[seg.key];
          if (v <= 0) return null;
          const active = hover === seg.key;
          return (
            <div
              key={seg.key}
              className="flex items-center gap-1.5 whitespace-nowrap text-sm"
              onMouseEnter={() => setHover(seg.key)}
              onMouseLeave={() => setHover(null)}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ background: seg.color }}
                aria-hidden
              />
              <span className={active ? 'text-ink' : 'text-ink-secondary'}>
                {seg.label}
              </span>
              <span
                className={`font-semibold tabular-nums ${active ? 'text-ink' : 'text-ink-secondary'}`}
              >
                {fmtMoney(v)} · {pctLabel(v, total)}
              </span>
            </div>
          );
        })}
      </div>
      {/*
        Every blurb is laid out in the same grid cell, so the row is always as
        tall as the longest one and showing a different line cannot change the
        card's height. A reserved single line was not enough: these blurbs wrap
        to two or three lines in a narrow card, and the growth was what pushed
        the bar around under the cursor.
      */}
      <div className="mt-2 grid text-xs text-ink-muted">
        {[
          ...SEGMENTS.map((seg) => ({ key: seg.key, text: seg.blurb })),
          { key: '__caption', text: caption ?? '' },
        ].map((item) => (
          <p
            key={item.key}
            aria-hidden={item.key !== (hover ?? '__caption')}
            className="col-start-1 row-start-1"
            style={{
              visibility: item.key === (hover ?? '__caption') ? 'visible' : 'hidden',
            }}
          >
            {item.text}
          </p>
        ))}
      </div>
    </figure>
  );
}
