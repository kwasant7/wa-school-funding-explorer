'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { yearData } from '@/lib/data';
import DistrictCombobox from '@/components/DistrictCombobox';
import { fmtInt, fmtMoneyFull } from '@/lib/format';

type MapFile = {
  w: number;
  h: number;
  land?: string;
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

type Metric = 'perPupil' | 'reserveRatio';

/*
  Reserve ratio leads and is the default view. It is the measure with a fixed,
  meaningful threshold - below 5% a district is one bad year from cuts - so it
  answers "is my district in trouble?" directly, whereas funding per student
  only means something once you know how big and how rural the district is.
*/
const METRICS: { id: Metric; label: string }[] = [
  { id: 'reserveRatio', label: 'Reserve ratio' },
  { id: 'perPupil', label: 'Funding per student' },
];

let mapCache: MapFile | null = null;

export default function WaMap({
  year,
  onSelect,
}: {
  year: string;
  onSelect: (code: string) => void;
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
        } else {
          fills.set(d.code, rampColor(rank.get(d.code) ?? 0));
        }
        info.set(d.code, {
          name: data.name,
          county: data.county,
          perPupil: data.perPupil,
          enrollment: data.enrollment,
          reserveRatio: data.reserveRatio,
        });
      }
    }
    return { fills, info };
  }, [map, year, metric]);

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
    return (
      <div className="h-64 flex items-center justify-center text-sm text-ink-muted">
        Loading map…
      </div>
    );
  }

  return (
    <div className="relative select-none">
      {/* Searchable picker: jump straight to a district's page */}
      <div className="mb-3">
        <DistrictCombobox districts={comboDistricts} onPick={onSelect} />
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
          style={{ touchAction: 'pan-y', aspectRatio: `${map.w} / ${map.h}`, backgroundColor: '#e2f3f8' }}
          role="img"
          aria-label={`Map of Washington school districts, colored by ${
            metric === 'perPupil' ? 'funding per student' : 'reserve ratio'
          } in ${year}. Click a district to open its profile.`}
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
            } else if (pts.size === 1 && e.pointerType === 'mouse') {
              const dx = e.clientX - prev.x;
              const dy = e.clientY - prev.y;
              if (Math.abs(dx) + Math.abs(dy) > 2) dragged.current = true;
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
          <defs>
            <clipPath id="wa-land-extent">
              {map.land ? (
                <path d={map.land} />
              ) : (
                map.districts.map((district) => (
                  <path key={`clip-${district.code}`} d={district.d} />
                ))
              )}
            </clipPath>
          </defs>
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
          <g pointerEvents="none" aria-hidden="true" clipPath="url(#wa-land-extent)">
            {(map.water ?? []).map((water, index) => (
              <path key={index} d={water.d} fill="#9fd4ef" />
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

            Not clipped to wa-land-extent: that clip traces a lower-resolution
            coastline from a different data source than the OSPI district
            boundaries, so it disagreed with district shapes near water
            (chewing up Peninsula/South Kitsap and nearly erasing Vashon
            Island). District polygons are already correct, closed shapes and
            don't need re-clipping against a second, mismatched coastline.
          */}
          {hovered && (
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
              // Whichever metric the map is currently colored by leads the
              // tooltip - a reader hovering the reserve-ratio view wants that
              // number first, not funding per student.
              const [first, second] =
                metric === 'reserveRatio' ? [reserve, perFte] : [perFte, reserve];
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
        <div className="absolute top-2 right-2 flex flex-col gap-1">
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
              className="w-8 h-8 card flex items-center justify-center text-lg font-semibold text-ink-secondary hover:border-accent hover:text-accent"
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
        <span className="text-ink-muted">
          click a district to open it · pinch or Ctrl+scroll to zoom · drag to pan
        </span>
      </div>
    </div>
  );
}
