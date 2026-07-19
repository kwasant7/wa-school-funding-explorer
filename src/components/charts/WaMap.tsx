'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { yearData } from '@/lib/data';
import { fmtInt, fmtMoney } from '@/lib/format';

type MapFile = {
  w: number;
  h: number;
  districts: { code: string; name: string; d: string }[];
};

// Sequential blue ramp (light -> dark) for total-funding quintiles
const RAMP = ['#cde2fb', '#9ec5f4', '#5598e7', '#256abf', '#104281'];
const NO_DATA = '#e1e0d9';

let mapCache: MapFile | null = null;

function pathBounds(d: string) {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    if (nums[i] < minX) minX = nums[i];
    if (nums[i] > maxX) maxX = nums[i];
    if (nums[i + 1] < minY) minY = nums[i + 1];
    if (nums[i + 1] > maxY) maxY = nums[i + 1];
  }
  return { minX, maxX, minY, maxY };
}

export default function WaMap({
  year,
  onSelect,
}: {
  year: string;
  onSelect: (code: string) => void;
}) {
  const [map, setMap] = useState<MapFile | null>(mapCache);
  const [view, setView] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
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

  useEffect(() => {
    if (map && !view) setView({ x: 0, y: 0, w: map.w, h: map.h });
  }, [map, view]);

  const { fills, info, breaks } = useMemo(() => {
    const yd = yearData(year);
    const byCode = new Map(yd.districts.map((d) => [d.code, d]));
    const values = yd.districts.map((d) => d.rev.total).sort((a, b) => a - b);
    const q = (p: number) => values[Math.min(values.length - 1, Math.floor(p * values.length))];
    const cuts = [q(0.2), q(0.4), q(0.6), q(0.8)];
    const fills = new Map<string, string>();
    const info = new Map<string, { name: string; total: number; enrollment: number }>();
    if (map) {
      for (const d of map.districts) {
        const data = byCode.get(d.code);
        if (!data) {
          fills.set(d.code, NO_DATA);
          continue;
        }
        let i = 0;
        while (i < 4 && data.rev.total > cuts[i]) i++;
        fills.set(d.code, RAMP[i]);
        info.set(d.code, {
          name: data.name,
          total: data.rev.total,
          enrollment: data.enrollment,
        });
      }
    }
    return { fills, info, breaks: cuts };
  }, [map, year]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!map || q.length < 2 || selected) return [];
    const yd = yearData(year);
    return yd.districts
      .filter((d) => d.name.toLowerCase().includes(q) || d.county.toLowerCase().includes(q))
      .slice(0, 7);
  }, [map, query, year, selected]);

  function clampView(v: { x: number; y: number; w: number; h: number }) {
    if (!map) return v;
    const w = Math.min(Math.max(v.w, map.w / 40), map.w);
    const h = (w / map.w) * map.h;
    const x = Math.min(Math.max(v.x, -w * 0.25), map.w - w * 0.75);
    const y = Math.min(Math.max(v.y, -h * 0.25), map.h - h * 0.75);
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
  // A normal two-finger scroll keeps scrolling the page.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // regular scroll -> page scrolls
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.pow(1.003, -e.deltaY));
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

  function zoomToDistrict(code: string) {
    if (!map) return;
    const d = map.districts.find((x) => x.code === code);
    if (!d) return;
    const b = pathBounds(d.d);
    const pad = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.9 + 12;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const w = Math.min(map.w, (b.maxX - b.minX) + pad);
    const h = (w / map.w) * map.h;
    setView(clampView({ x: cx - w / 2, y: cy - (h / 2), w, h }));
  }

  if (!map || !view) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-ink-muted">
        Loading map…
      </div>
    );
  }

  const selectedInfo = selected ? info.get(selected) : null;
  const selectedShape = selected ? map.districts.find((d) => d.code === selected) : null;

  return (
    <div className="relative select-none">
      {/* Search on the map */}
      <div className="relative max-w-md mb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          placeholder="Search a district to highlight it on the map…"
          aria-label="Search for a district on the map"
          className="w-full px-4 py-2.5 card rounded-lg text-base placeholder:text-ink-muted"
        />
        {matches.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full card shadow-lg overflow-hidden">
            {matches.map((d) => (
              <li key={d.code}>
                <button
                  onClick={() => {
                    setSelected(d.code);
                    setQuery(d.name);
                    zoomToDistrict(d.code);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent-wash"
                >
                  <span className="font-medium">{d.name}</span>
                  <span className="text-ink-muted"> · {d.county} County</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className="w-full rounded-lg bg-accent-wash/40"
          style={{ touchAction: 'pan-y', aspectRatio: `${map.w} / ${map.h}` }}
          role="img"
          aria-label={`Map of Washington school districts, colored by total funding in ${year}. Use the search box to highlight a district.`}
          onPointerDown={(e) => {
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          }}
          onPointerMove={(e) => {
            const pts = pointers.current;
            const prev = pts.get(e.pointerId);
            if (!prev) return;
            if (pts.size === 2) {
              // two-finger pinch -> zoom
              const [a, b] = Array.from(pts.values());
              const before = Math.hypot(a.x - b.x, a.y - b.y);
              pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
              const [a2, b2] = Array.from(pts.values());
              const after = Math.hypot(a2.x - b2.x, a2.y - b2.y);
              if (before > 0) zoomAt((a2.x + b2.x) / 2, (a2.y + b2.y) / 2, after / before);
            } else if (pts.size === 1 && e.pointerType === 'mouse') {
              // mouse drag -> pan (touch drag is left to the page for scrolling)
              const dx = e.clientX - prev.x;
              const dy = e.clientY - prev.y;
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
          onDoubleClick={(e) => zoomAt(e.clientX, e.clientY, 2)}
        >
          {map.districts.map((d) => (
            <path
              key={d.code}
              d={d.d}
              fill={fills.get(d.code) ?? NO_DATA}
              stroke="#fcfcfb"
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
              opacity={selected && selected !== d.code ? 0.55 : 1}
            />
          ))}
          {selectedShape && (
            <path
              d={selectedShape.d}
              fill="none"
              stroke="#0b0b0b"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
        </svg>

        {/* zoom controls */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {[
            ['+', () => zoomCenter(1.6), 'Zoom in'],
            ['−', () => zoomCenter(1 / 1.6), 'Zoom out'],
            ['⟲', () => { setView({ x: 0, y: 0, w: map.w, h: map.h }); }, 'Reset view'],
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

        {/* selected district card */}
        {selected && (
          <div className="anim-rise absolute left-2 bottom-2 card px-4 py-3 shadow-md max-w-[85%]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-sm md:text-base">
                  {selectedInfo?.name ?? selectedShape?.name}
                </div>
                {selectedInfo ? (
                  <div className="text-xs md:text-sm text-ink-secondary mt-0.5">
                    {fmtMoney(selectedInfo.total)} total funding ·{' '}
                    {fmtInt(selectedInfo.enrollment)} students
                  </div>
                ) : (
                  <div className="text-xs text-ink-muted mt-0.5">No data for {year}</div>
                )}
                {selectedInfo && (
                  <button
                    onClick={() => onSelect(selected)}
                    className="mt-1.5 text-sm font-medium text-accent hover:underline"
                  >
                    Open full profile →
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setSelected(null);
                  setQuery('');
                  setView({ x: 0, y: 0, w: map.w, h: map.h });
                }}
                aria-label="Clear selection"
                className="text-ink-muted hover:text-ink text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-secondary">
        <span className="font-medium text-ink">Total funding ({year}):</span>
        {RAMP.map((c, i) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: c }} />
            {i === 0
              ? `under ${fmtMoney(breaks[0])}`
              : i === RAMP.length - 1
                ? `over ${fmtMoney(breaks[3])}`
                : `${fmtMoney(breaks[i - 1])}–${fmtMoney(breaks[i])}`}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: NO_DATA }} />
          no data
        </span>
        <span className="text-ink-muted">
          pinch or Ctrl+scroll to zoom · drag to pan
        </span>
      </div>
    </div>
  );
}
