'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { yearData } from '@/lib/data';
import { LATEST } from '@/lib/years';
import regionalizationJson from '@/data/regionalization.json';
import DistrictCombobox from '@/components/DistrictCombobox';
import { fmtInt, fmtMoneyFull } from '@/lib/format';

type MapFile = {
  w: number;
  h: number;
  districts: { code: string; name: string; d: string }[];
  water?: { name?: string; d: string }[];
};

// Purple -> blue ramp: purple is the least funded per student, blue the most.
// Lightness climbs with the value as well as hue, so the ordering survives
// greyscale printing and the two ends stay distinguishable for colour-blind
// readers. Deliberately not the green/red of the reserve-ratio scale, because
// low per-student funding is not automatically "bad" the way an empty reserve
// is - small rural districts sit at the top of this scale for cost reasons.
const RAMP = ['#e3d3f5', '#b98ee0', '#8a7fd6', '#4a7fd0', '#10429b'];

// Legend end-labels. Taken out of the ramp itself because the pale end of a
// map ramp is far too light to read as text on paper-white.
const RAMP_LOW_LABEL = '#7c3aed';
const RAMP_HIGH_LABEL = '#10429b';
const NO_DATA = '#e1e0d9';

/*
  One water color for the whole map. The inland lakes used to be painted a
  brighter blue than the Sound, which reads as two different kinds of water on
  a map where the difference means nothing - Lake Washington stood out beside
  Mercer Island more than any funding color did.
*/
const WATER = '#e2f3f8';

// How far past the state extent you can zoom out (breathing room around WA)
const MAX_OUT = 1.45;

// Tooltip footprint, used to decide which side of the cursor it sits on.
const TOOLTIP_W = 190;
const TOOLTIP_H = 46;

function lerpColor(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return (
    '#' +
    pa
      .map((v, i) =>
        Math.round(v + (pb[i] - v) * t)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

function rampColor(t: number) {
  const scaled = Math.min(0.9999, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.floor(scaled);
  return lerpColor(RAMP[i], RAMP[i + 1], scaled - i);
}

/**
 * Reserve ratio uses a diverging red -> amber -> green scale anchored on values
 * that actually mean something: 0% (no cushion at all) and 5% (the minimum
 * experts recommend). Lightness also rises across the ramp so the scale stays
 * readable for red/green color blindness; exact values are in the tooltip.
 */
const RESERVE_STOPS: [number, string][] = [
  [-5, '#7f1d1d'], // deeply negative - insolvent
  [0, '#d03b3b'], // no cushion
  [2.5, '#eb6834'], // well below the recommended floor
  [5, '#eda100'], // right at the 4-5% minimum
  [10, '#5faa4a'], // comfortable
  [20, '#0b7a28'], // strong reserves
];

function reserveColor(rr: number) {
  const stops = RESERVE_STOPS;
  if (rr <= stops[0][0]) return stops[0][1];
  if (rr >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0] = stops[i];
    const [v1, c1] = stops[i + 1];
    if (rr >= v0 && rr <= v1) {
      return lerpColor(c0, c1, (rr - v0) / (v1 - v0));
    }
  }
  return stops[stops.length - 1][1];
}

/*
  Regionalization runs dark purple (1.00, the statewide base - about half the
  state) up to yellow (the +22% peak) - the plasma path, violet through
  magenta and orange. Lightness rises monotonically from near-black to
  near-white, so the ordering reads in greyscale and for every kind of color
  blindness. The scale is absolute over the LEAP range, not ranked: 1.00
  means the same thing on every map.
*/
const REGION_RAMP = ['#3b0764', '#7e03a8', '#cc4778', '#f89441', '#f5e626'];
const REGION_LOW_LABEL = '#3b0764';
// The ramp's yellow end is unreadable as text on paper-white, so the legend's
// high label darkens to amber - same reasoning as RAMP_LOW_LABEL above.
const REGION_HIGH_LABEL = '#a16207';

/*
  Factors pinned to the site's model year: LEAP Document 3 is a forward
  schedule starting 2023-24, so coloring the 2019-20 map by it would either
  gray the whole state or claim data we don't have. The legend names the year.
*/
const REGION_YEAR = regionalizationJson.years.includes(LATEST)
  ? LATEST
  : regionalizationJson.years[0];
const REGION_INDEX = regionalizationJson.years.indexOf(REGION_YEAR);
const REGION_FACTORS = new Map(
  Object.entries(
    regionalizationJson.districts as Record<string, { cis: number[] }>
  ).map(([code, d]) => [code, d.cis[REGION_INDEX]])
);
const REGION_MAX = Math.max(...Array.from(REGION_FACTORS.values()));

function regionColor(factor: number) {
  const t = (factor - 1) / (REGION_MAX - 1);
  const scaled = Math.min(0.9999, Math.max(0, t)) * (REGION_RAMP.length - 1);
  const i = Math.floor(scaled);
  return lerpColor(REGION_RAMP[i], REGION_RAMP[i + 1], scaled - i);
}

type Metric = 'perPupil' | 'reserveRatio' | 'regionalization';

/*
  Reserve ratio leads and is the default view. It is the measure with a fixed,
  meaningful threshold - below 5% a district is one bad year from cuts - so it
  answers "is my district in trouble?" directly, whereas funding per student
  only means something once you know how big and how rural the district is.
*/
const METRICS: { id: Metric; label: string }[] = [
  { id: 'reserveRatio', label: 'Reserve ratio' },
  { id: 'perPupil', label: 'Funding per student' },
  { id: 'regionalization', label: 'Regionalization' },
];

let mapCache: MapFile | null = null;

export default function WaMap({
  year,
  onSelect,
  onClear,
  selected = null,
}: {
  year: string;
  onSelect: (code: string) => void;
  /** Drop the selection, so the picker's clear button empties the page too. */
  onClear?: () => void;
  /**
   * The district whose profile is open below the map. It keeps a standing
   * outline so a reader scrolling through the profile can look back up and see
   * which shape on the state it belongs to.
   */
  selected?: string | null;
}) {
  const [map, setMap] = useState<MapFile | null>(mapCache);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [view, setView] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [metric, setMetric] = useState<Metric>('reserveRatio');
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; below: boolean; left: boolean } | null>(null);
  const dragged = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (mapCache) return;
    setLoadFailed(false);
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    fetch(`${base}/wa-districts-map.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((m: MapFile) => {
        mapCache = m;
        setMap(m);
      })
      /*
        A wrong BASE_PATH, a truncated file, or an offline visitor used to be
        indistinguishable from a request still in flight - the catch was
        empty, so `map` stayed null forever under a "Loading map..." message
        with no console output, no error state, and no way to retry.
      */
      .catch(() => setLoadFailed(true));
  }, [retryCount]);

  const homeView = useMemo(() => {
    if (!map) return null;
    const w = map.w * 1.08;
    const h = (w / map.w) * map.h;
    return { x: -(w - map.w) / 2, y: -(h - map.h) / 2, w, h };
  }, [map]);

  useEffect(() => {
    if (map && homeView && !view) setView(homeView);
  }, [map, homeView, view]);

  /* Within a hair of the home view - a float comparison would miss by the
     rounding a pinch leaves behind. */
  const atHome =
    !view || !homeView || Math.abs(view.w - homeView.w) < homeView.w * 0.01;

  const { fills, info } = useMemo(() => {
    const yd = yearData(year);
    const byCode = new Map(yd.districts.map((d) => [d.code, d]));
    const sorted = [...yd.districts].sort((a, b) => a.perPupil - b.perPupil);
    const rank = new Map(sorted.map((d, i) => [d.code, i / Math.max(1, sorted.length - 1)]));
    const fills = new Map<string, string>();
    const info = new Map<
      string,
      {
        name: string;
        county: string;
        perPupil: number;
        enrollment: number;
        reserveRatio: number | null;
        regionalization: number | null;
      }
    >();
    if (map) {
      for (const d of map.districts) {
        const data = byCode.get(d.code);
        if (!data) {
          fills.set(d.code, NO_DATA);
          continue;
        }
        if (metric === 'reserveRatio') {
          // Absolute scale - the 0% and 5% thresholds carry real meaning, so
          // don't rank-normalize the way per-student funding does.
          fills.set(
            d.code,
            data.reserveRatio == null ? NO_DATA : reserveColor(data.reserveRatio)
          );
        } else if (metric === 'regionalization') {
          const factor = REGION_FACTORS.get(d.code);
          fills.set(d.code, factor == null ? NO_DATA : regionColor(factor));
        } else {
          fills.set(d.code, rampColor(rank.get(d.code) ?? 0));
        }
        info.set(d.code, {
          name: data.name,
          county: data.county,
          perPupil: data.perPupil,
          enrollment: data.enrollment,
          reserveRatio: data.reserveRatio,
          regionalization: REGION_FACTORS.get(d.code) ?? null,
        });
      }
    }
    return { fills, info };
  }, [map, year, metric]);

  const selectedShape = useMemo(
    () => (selected ? map?.districts.find((d) => d.code === selected) ?? null : null),
    [map, selected]
  );
  const selectedName = selectedShape
    ? info.get(selectedShape.code)?.name ?? selectedShape.name
    : null;

  // Flat district list for the searchable picker
  const comboDistricts = useMemo(
    () =>
      yearData(year).districts.map((d) => ({ code: d.code, name: d.name, county: d.county })),
    [year]
  );

  function clampView(v: { x: number; y: number; w: number; h: number }) {
    if (!map) return v;
    const w = Math.min(Math.max(v.w, map.w / 40), map.w * MAX_OUT);
    const h = (w / map.w) * map.h;
    // When the view is wider/taller than the map, center the state instead of
    // letting it drift into a corner. Otherwise clamp so you can't pan the
    // map entirely off-screen.
    const x =
      w >= map.w ? (map.w - w) / 2 : Math.min(Math.max(v.x, -w * 0.35), map.w - w * 0.65);
    const y =
      h >= map.h ? (map.h - h) / 2 : Math.min(Math.max(v.y, -h * 0.35), map.h - h * 0.65);
    return { x, y, w, h };
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const v = viewRef.current;
    const svg = svgRef.current;
    if (!v || !svg) return;
    const rect = svg.getBoundingClientRect();
    const p = {
      x: v.x + ((clientX - rect.left) / rect.width) * v.w,
      y: v.y + ((clientY - rect.top) / rect.height) * v.h,
    };
    const w = v.w / factor;
    const h = v.h / factor;
    setView(
      clampView({
        x: p.x - ((p.x - v.x) / v.w) * w,
        y: p.y - ((p.y - v.y) / v.h) * h,
        w,
        h,
      })
    );
  }

  // Native wheel listener so we can preventDefault ONLY for pinch/Ctrl+scroll.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // regular scroll -> page scrolls
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.pow(1.01, -e.deltaY)); // faster wheel zoom
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, view === null]);

  function zoomCenter(factor: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  /**
   * The tooltip trails the cursor closely and sits below-right of it by
   * default. It used to be a wide card centred above the pointer, which
   * covered the district immediately north of the one being inspected -
   * exactly the comparison a reader is usually making. It flips to the other
   * side only when it would run off an edge.
   */
  function updateHoverPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    setHoverPoint({
      x,
      y,
      below: y < rect.height - TOOLTIP_H - 16,
      left: x > rect.width - TOOLTIP_W - 16,
    });
  }

  if (loadFailed) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-2 text-sm text-ink-secondary">
        <p>The map couldn&apos;t load.</p>
        <button
          type="button"
          onClick={() => setRetryCount((n) => n + 1)}
          className="font-semibold text-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!map || !view) {
    /*
      Holds the loaded map's footprint rather than collapsing to a short box,
      so the district profile rendered below doesn't get shoved down the page
      the moment the JSON lands. The ratio is the state extent's, restated as
      a constant because the real figures arrive with the file we're waiting
      on; being a few pixels off costs nothing here.
    */
    return (
      <div
        className="flex w-full items-center justify-center rounded-lg bg-[#e2f3f8] text-sm text-ink-muted"
        style={{ aspectRatio: '980 / 630' }}
      >
        Loading map…
      </div>
    );
  }

  return (
    <div className="relative select-none">
      {/* Searchable picker: jump straight to a district's page */}
      <div className="mb-3">
        {/*
          selectedName is passed so the field names the district that is
          outlined on the map. Without it the picker sat on its placeholder
          while a district was plainly selected below, which reads as the
          selection not having taken.
        */}
        <DistrictCombobox
          districts={comboDistricts}
          onPick={onSelect}
          onClear={onClear}
          selectedName={selectedName ?? undefined}
        />
        <span className="mt-1 block text-sm text-ink-muted">
          …or click your district on the map.
        </span>
      </div>

      {/* Metric selector: what the map colors represent */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-secondary">Color the map by</span>
        <div className="inline-flex rounded-lg border border-line overflow-hidden">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              aria-pressed={metric === m.id}
              className={`px-3.5 py-2 text-sm font-medium transition-colors ${
                metric === m.id
                  ? 'bg-accent text-white'
                  : 'bg-surface text-ink-secondary hover:bg-accent-wash'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className="w-full rounded-lg"
          /*
            At the home view the whole state is on screen and there is nothing
            to pan to, so the page keeps vertical scrolling and a swipe over
            the map scrolls past it as any visitor expects. Zoomed in, the map
            takes the gesture - otherwise a one-finger drag north or south is
            swallowed by page scroll and the map cannot be moved at all. The
            reset button returns both the view and the scrolling.
          */
          style={{
            touchAction: atHome ? 'pan-y' : 'none',
            aspectRatio: `${map.w} / ${map.h}`,
            backgroundColor: WATER,
          }}
          role="img"
          aria-label={`Map of Washington school districts, colored by ${
            metric === 'perPupil'
              ? `funding per student in ${year}`
              : metric === 'regionalization'
                ? `salary regionalization factor for ${REGION_YEAR}`
                : `reserve ratio in ${year}`
          }.${
            selectedName ? ` ${selectedName} is outlined.` : ''
          } Click a district to open its profile below the map.`}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            dragged.current = false;
          }}
          onPointerMove={(e) => {
            const pts = pointers.current;
            const prev = pts.get(e.pointerId);
            if (!prev) return;
            if (pts.size === 2) {
              const [a, b] = Array.from(pts.values());
              const before = Math.hypot(a.x - b.x, a.y - b.y);
              pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
              const [a2, b2] = Array.from(pts.values());
              const after = Math.hypot(a2.x - b2.x, a2.y - b2.y);
              if (before > 0) {
                dragged.current = true;
                zoomAt((a2.x + b2.x) / 2, (a2.y + b2.y) / 2, after / before);
              }
            } else if (pts.size === 1) {
              const dx = e.clientX - prev.x;
              const dy = e.clientY - prev.y;
              /*
                A finger is shakier than a mouse, so a tap that wobbles a
                couple of pixels must still count as a tap and open the
                district - only a real drag suppresses the click.
              */
              const slop = e.pointerType === 'mouse' ? 2 : 8;
              if (Math.abs(dx) + Math.abs(dy) > slop) dragged.current = true;
              const rect = svgRef.current!.getBoundingClientRect();
              setView((v) =>
                v
                  ? clampView({
                      ...v,
                      x: v.x - (dx / rect.width) * v.w,
                      y: v.y - (dy / rect.height) * v.h,
                    })
                  : v
              );
              pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            }
          }}
          onPointerUp={(e) => pointers.current.delete(e.pointerId)}
          onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
          onDoubleClick={(e) => zoomAt(e.clientX, e.clientY, 2.5)}
        >
          {/*
            District geometry arrives already clipped to land:
            fetch-boundaries.mjs intersects each jurisdictional OSPI polygon
            (which runs miles into Puget Sound and Lake Washington) with the
            state shoreline at build time. That is what keeps the Sound and
            the San Juan channels water-colored here, and it is why the
            stroked outlines below follow the coast - no render-time clipPath
            could do that, because clipping a stroke deletes it wherever the
            boundary crosses water instead of bending it along the shore.
          */}
          <g>
            {map.districts.map((d) => (
              <path
                key={d.code}
                d={d.d}
                fill={fills.get(d.code) ?? NO_DATA}
                stroke="#fcfcfb"
                strokeWidth={0.7}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: 'pointer' }}
                aria-label={
                  info.has(d.code)
                    ? `${info.get(d.code)!.name}, ${info.get(d.code)!.county} County`
                    : d.name
                }
                onMouseEnter={(e) => {
                  setHovered(d.code);
                  updateHoverPoint(e.clientX, e.clientY);
                }}
                onMouseMove={(e) => {
                  if (!dragged.current) updateHoverPoint(e.clientX, e.clientY);
                }}
                onMouseLeave={() => {
                  setHovered((h) => (h === d.code ? null : h));
                  setHoverPoint(null);
                }}
                onClick={() => {
                  if (dragged.current) return;
                  onSelect(d.code);
                }}
              />
            ))}
          </g>
          <g pointerEvents="none" aria-hidden="true">
            {(map.water ?? []).map((water, index) => (
              <path key={index} d={water.d} fill={WATER} />
            ))}
          </g>
          {/*
            The hovered district's highlight, redrawn on top of every other
            path. Each district used to carry its own conditional stroke, so a
            neighbor sharing a border and painted later in the list drew its
            own thin light edge right over part of the highlight - the
            outline looked broken or partial depending on which side of the
            shared border it was on. A single overlay painted last is never
            interrupted by paint order.

            Because the geometry itself is clipped to land, this outline hugs
            the shoreline: Vashon Island's traces the island's coast rather
            than a loop of open water, and a multi-island district draws one
            closed ring per island.
          */}
          {/*
            The selected district's standing outline.
            Hovering the selected district keeps this outline and skips
            the hover one rather than stacking two lines of different weights
            on the same border - this is the heavier of the two, so dropping
            back to the hover line would read as the selection being lost.

            Two strokes, not one: the fills underneath run from near-white
            (#e3d3f5, the pale end of the funding ramp) to near-black
            (#7f1d1d, an insolvent district), so no single colour reads on all
            of them. A white casing under a dark line is the standard
            cartographic answer - the pair is legible over anything.
          */}
          {selectedShape && (
            <g pointerEvents="none">
              <path
                d={selectedShape.d}
                fill="none"
                stroke="#fcfcfb"
                strokeWidth={4.5}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={selectedShape.d}
                fill="none"
                stroke="#0b0b0b"
                strokeWidth={2.2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}
          {hovered && hovered !== selected && (
            <path
              d={map.districts.find((d) => d.code === hovered)?.d}
              fill="none"
              stroke="#104281"
              strokeWidth={1.6}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
        </svg>

        {/* hover tooltip - compact, tucked beside the cursor */}
        {hovered && hoverPoint && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-line bg-surface px-2 py-1.5 shadow-md"
            style={{
              left: hoverPoint.x,
              top: hoverPoint.y,
              width: TOOLTIP_W,
              transform: `translate(${hoverPoint.left ? 'calc(-100% - 14px)' : '14px'}, ${
                hoverPoint.below ? '10px' : 'calc(-100% - 10px)'
              })`,
            }}
          >
            <p className="truncate text-xs font-semibold leading-tight" data-no-translate>
              {info.get(hovered)?.name ??
                map.districts.find((district) => district.code === hovered)?.name}
            </p>
            {info.get(hovered) ? (() => {
              const d = info.get(hovered)!;
              const perFte = <span key="perFte">{fmtMoneyFull(d.perPupil)}/FTE</span>;
              const reserve = (
                <span key="reserve">
                  {d.reserveRatio == null ? (
                    <span className="text-ink-muted">reserve n/a</span>
                  ) : (
                    <span
                      className={
                        d.reserveRatio < 0
                          ? 'text-critical'
                          : d.reserveRatio < 5
                            ? 'text-amber-600'
                            : 'text-good'
                      }
                    >
                      {d.reserveRatio.toFixed(1)}% reserve
                    </span>
                  )}
                </span>
              );
              const region = (
                <span key="region">
                  {d.regionalization == null
                    ? 'regionalization n/a'
                    : `${d.regionalization.toFixed(2)}× regionalization`}
                </span>
              );
              // Whichever metric the map is currently colored by leads the
              // tooltip - a reader hovering the reserve-ratio view wants that
              // number first, not funding per student.
              const [first, second] =
                metric === 'reserveRatio'
                  ? [reserve, perFte]
                  : metric === 'regionalization'
                    ? [region, perFte]
                    : [perFte, reserve];
              return (
                <p className="mt-0.5 text-[11px] leading-tight text-ink-secondary tabular-nums">
                  {first} · {second}
                </p>
              );
            })() : (
              <p className="mt-0.5 text-[11px] text-ink-muted">No data for {year}</p>
            )}
          </div>
        )}

        {/* zoom controls */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5">
          {[
            ['+', () => zoomCenter(2), 'Zoom in'],
            ['−', () => zoomCenter(0.5), 'Zoom out'],
            ['⟲', () => { if (homeView) setView(homeView); }, 'Reset view'],
          ].map(([label, fn, title]) => (
            <button
              key={label as string}
              type="button"
              onClick={fn as () => void}
              title={title as string}
              /*
                The visible glyph ("+", "−", "⟲") wins over `title` when a
                screen reader computes this button's accessible name, so
                VoiceOver announced nothing useful. aria-label overrides that
                with the same text already in `title`.
              */
              aria-label={title as string}
              className="w-10 h-10 card flex items-center justify-center text-lg font-semibold text-ink-secondary hover:border-accent hover:text-accent"
            >
              <span aria-hidden="true">{label as string}</span>
            </button>
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-secondary">
        {metric === 'perPupil' ? (
          <>
            <span className="font-medium text-ink">Funding per student ({year}):</span>
            <span className="flex items-center gap-2">
              <span className="font-medium" style={{ color: RAMP_LOW_LABEL }}>
                lower
              </span>
              <span
                className="inline-block h-3 w-32 md:w-44 rounded-sm"
                style={{ background: `linear-gradient(to right, ${RAMP.join(', ')})` }}
                aria-hidden
              />
              <span className="font-medium" style={{ color: RAMP_HIGH_LABEL }}>
                higher
              </span>
            </span>
            <span className="text-ink-muted">
              | ranked against every district, not an absolute scale
            </span>
          </>
        ) : metric === 'regionalization' ? (
          <>
            <span className="font-medium text-ink">
              Regionalization ({REGION_YEAR}):
            </span>
            <span className="flex items-center gap-2">
              <span className="font-medium" style={{ color: REGION_LOW_LABEL }}>
                1.00× base
              </span>
              <span
                className="inline-block h-3 w-40 md:w-56 rounded-sm"
                style={{ background: `linear-gradient(to right, ${REGION_RAMP.join(', ')})` }}
                aria-hidden
              />
              <span className="font-medium" style={{ color: REGION_HIGH_LABEL }}>
                {REGION_MAX.toFixed(2)}×
              </span>
            </span>
            <span className="text-ink-muted">
              | certificated salary allocations, scaled for local hiring costs
            </span>
          </>
        ) : (
          <>
            <span className="font-medium text-ink">Reserve ratio ({year}):</span>
            <span className="flex items-center gap-2">
              <span className="text-critical font-medium">no cushion</span>
              <span className="relative inline-block h-3 w-40 md:w-56 rounded-sm" aria-hidden>
                <span
                  className="absolute inset-0 rounded-sm"
                  style={{
                    background: `linear-gradient(to right, ${RESERVE_STOPS.map(
                      ([v, c]) => `${c} ${((v + 5) / 25) * 100}%`
                    ).join(', ')})`,
                  }}
                />
                {/* marker at the 5% recommended minimum */}
                <span
                  className="absolute -top-1 -bottom-1 w-px bg-ink"
                  style={{ left: `${((5 + 5) / 25) * 100}%` }}
                />
              </span>
              <span className="text-good font-medium">strong savings</span>
            </span>
            <span className="text-ink-muted">
              | tick = 5%, the level this site flags as thin
            </span>
          </>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: NO_DATA }} />
          no data
        </span>
        {selectedName && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm border-2 border-ink bg-transparent"
              aria-hidden
            />
            <span data-no-translate>{selectedName}</span> (open below)
          </span>
        )}
        <span className="text-ink-muted">
          tap a district to open its profile below · pinch or Ctrl+scroll to
          zoom · drag to pan
        </span>
      </div>
    </div>
  );
}
