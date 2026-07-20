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

// Sequential blue ramp (light -> dark); districts are colored on a continuous
// gradient by their percentile rank of per-student funding.
const RAMP = ['#cde2fb', '#9ec5f4', '#5598e7', '#256abf', '#104281'];
const NO_DATA = '#e1e0d9';

// How far past the state extent you can zoom out (breathing room around WA)
const MAX_OUT = 1.45;

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

let mapCache: MapFile | null = null;

export default function WaMap({
  year,
  onSelect,
}: {
  year: string;
  onSelect: (code: string) => void;
}) {
  const [map, setMap] = useState<MapFile | null>(mapCache);
  const [view, setView] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const dragged = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (mapCache) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    fetch(`${base}/wa-districts-map.json`)
      .then((r) => r.json())
      .then((m: MapFile) => {
        mapCache = m;
        setMap(m);
      })
      .catch(() => {});
  }, []);

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
      { name: string; county: string; perPupil: number; enrollment: number }
    >();
    if (map) {
      for (const d of map.districts) {
        const data = byCode.get(d.code);
        if (!data) {
          fills.set(d.code, NO_DATA);
          continue;
        }
        fills.set(d.code, rampColor(rank.get(d.code) ?? 0));
        info.set(d.code, {
          name: data.name,
          county: data.county,
          perPupil: data.perPupil,
          enrollment: data.enrollment,
        });
      }
    }
    return { fills, info };
  }, [map, year]);

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

  function updateHoverPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const horizontalPadding = Math.min(125, rect.width * 0.3);
    setHoverPoint({
      x: Math.min(Math.max(clientX - rect.left, horizontalPadding), rect.width - horizontalPadding),
      y: clientY - rect.top,
      below: clientY - rect.top < 90,
    });
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

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className="w-full rounded-lg"
          style={{ touchAction: 'pan-y', aspectRatio: `${map.w} / ${map.h}`, backgroundColor: '#e2f3f8' }}
          role="img"
          aria-label={`Map of Washington school districts, colored by funding per student in ${year}. Click a district to open its profile.`}
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
          <g clipPath="url(#wa-land-extent)">
            {map.districts.map((d) => (
              <path
                key={d.code}
                d={d.d}
                fill={fills.get(d.code) ?? NO_DATA}
                stroke={hovered === d.code ? '#104281' : '#fcfcfb'}
                strokeWidth={hovered === d.code ? 1.6 : 0.7}
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
        </svg>

        {/* hover tooltip */}
        {hovered && hoverPoint && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[min(16rem,80%)] card px-3 py-2 shadow-md"
            style={{
              left: hoverPoint.x,
              top: hoverPoint.y,
              transform: hoverPoint.below
                ? 'translate(-50%, 12px)'
                : 'translate(-50%, calc(-100% - 12px))',
            }}
          >
            <p className="text-sm font-semibold">
              {info.get(hovered)?.name ??
                map.districts.find((district) => district.code === hovered)?.name}
            </p>
            {info.get(hovered) ? (
              <>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {info.get(hovered)!.county} County
                </p>
                <p className="mt-1 text-xs text-ink-secondary">
                  {fmtMoneyFull(info.get(hovered)!.perPupil)} per funding FTE ·{' '}
                  {fmtInt(info.get(hovered)!.enrollment)} students
                </p>
                <p className="mt-1 text-xs font-medium text-accent">Click to open →</p>
              </>
            ) : (
              <p className="mt-1 text-xs text-ink-muted">No data for {year}</p>
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
              onClick={fn as () => void}
              title={title as string}
              className="w-8 h-8 card flex items-center justify-center text-lg font-semibold text-ink-secondary hover:border-accent hover:text-accent"
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-secondary">
        <span className="font-medium text-ink">Funding per student ({year}):</span>
        <span className="flex items-center gap-2">
          lower per student
          <span
            className="inline-block h-3 w-32 md:w-44 rounded-sm"
            style={{ background: `linear-gradient(to right, ${RAMP.join(', ')})` }}
            aria-hidden
          />
          higher per student
        </span>
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
