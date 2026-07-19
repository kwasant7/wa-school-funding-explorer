'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { yearData } from '@/lib/data';
import { fmtInt, fmtMoneyFull } from '@/lib/format';

type MapFile = {
  w: number;
  h: number;
  districts: { code: string; name: string; d: string }[];
};

// Sequential blue ramp (light -> dark) for per-student funding quintiles
const RAMP = ['#cde2fb', '#9ec5f4', '#5598e7', '#256abf', '#104281'];
const NO_DATA = '#e1e0d9';

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
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragged = useRef(false);

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
    const values = yd.districts.map((d) => d.perPupil).sort((a, b) => a - b);
    const q = (p: number) => values[Math.min(values.length - 1, Math.floor(p * values.length))];
    const cuts = [q(0.2), q(0.4), q(0.6), q(0.8)];
    const fills = new Map<string, string>();
    const info = new Map<string, { name: string; perPupil: number; enrollment: number }>();
    if (map) {
      for (const d of map.districts) {
        const data = byCode.get(d.code);
        if (!data) {
          fills.set(d.code, NO_DATA);
          continue;
        }
        let i = 0;
        while (i < 4 && data.perPupil > cuts[i]) i++;
        fills.set(d.code, RAMP[i]);
        info.set(d.code, {
          name: data.name,
          perPupil: data.perPupil,
          enrollment: data.enrollment,
        });
      }
    }
    return { fills, info, breaks: [values[0], ...cuts, values[values.length - 1]] };
  }, [map, year]);

  if (!map || !view) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-ink-muted">
        Loading map…
      </div>
    );
  }

  const zoomLevel = map.w / view.w;

  function clampView(v: { x: number; y: number; w: number; h: number }) {
    if (!map) return v;
    const w = Math.min(Math.max(v.w, map.w / 40), map.w);
    const h = (w / map.w) * map.h;
    const x = Math.min(Math.max(v.x, -w * 0.25), map.w - w * 0.75);
    const y = Math.min(Math.max(v.y, -h * 0.25), map.h - h * 0.75);
    return { x, y, w, h };
  }

  function svgPoint(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: view!.x + ((clientX - rect.left) / rect.width) * view!.w,
      y: view!.y + ((clientY - rect.top) / rect.height) * view!.h,
    };
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    setView((v) => {
      if (!v) return v;
      const p = svgPoint(clientX, clientY);
      const w = v.w / factor;
      const h = v.h / factor;
      return clampView({
        x: p.x - ((p.x - v.x) / v.w) * w,
        y: p.y - ((p.y - v.y) / v.h) * h,
        w,
        h,
      });
    });
  }

  function zoomCenter(factor: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  return (
    <div ref={wrapRef} className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="w-full rounded-lg bg-accent-wash/40 touch-none"
        style={{ cursor: 'grab', aspectRatio: `${map.w} / ${map.h}` }}
        role="img"
        aria-label={`Map of Washington school districts, colored by funding per student in ${year}. Click a district to open its profile.`}
        onWheel={(e) => {
          e.preventDefault();
          zoomAt(e.clientX, e.clientY, Math.pow(1.0015, -e.deltaY));
        }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          dragged.current = false;
        }}
        onPointerMove={(e) => {
          const prev = pointers.current.get(e.pointerId);
          if (!prev) {
            // plain hover
            setTip({ x: e.clientX, y: e.clientY });
            return;
          }
          const pts = pointers.current;
          if (pts.size === 1) {
            const dx = e.clientX - prev.x;
            const dy = e.clientY - prev.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) dragged.current = true;
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
          } else if (pts.size === 2) {
            const [a, b] = Array.from(pts.values());
            const distBefore = Math.hypot(a.x - b.x, a.y - b.y);
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const [a2, b2] = Array.from(pts.values());
            const distAfter = Math.hypot(a2.x - b2.x, a2.y - b2.y);
            if (distBefore > 0) {
              dragged.current = true;
              zoomAt((a2.x + b2.x) / 2, (a2.y + b2.y) / 2, distAfter / distBefore);
            }
          }
        }}
        onPointerUp={(e) => pointers.current.delete(e.pointerId)}
        onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
        onPointerLeave={() => {
          setHovered(null);
          setTip(null);
        }}
        onDoubleClick={(e) => zoomAt(e.clientX, e.clientY, 2)}
      >
        {map.districts.map((d) => (
          <path
            key={d.code}
            d={d.d}
            fill={fills.get(d.code) ?? NO_DATA}
            stroke={hovered === d.code ? '#0b0b0b' : '#fcfcfb'}
            strokeWidth={hovered === d.code ? 1.5 : 0.7}
            vectorEffect="non-scaling-stroke"
            onPointerEnter={() => setHovered(d.code)}
            onClick={() => {
              if (!dragged.current) onSelect(d.code);
            }}
            style={{ cursor: 'pointer' }}
          >
            <title>{info.get(d.code)?.name ?? d.name}</title>
          </path>
        ))}
      </svg>

      {/* zoom controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {[
          ['+', () => zoomCenter(1.6), 'Zoom in'],
          ['−', () => zoomCenter(1 / 1.6), 'Zoom out'],
          ['⟲', () => setView({ x: 0, y: 0, w: map.w, h: map.h }), 'Reset view'],
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

      {/* tooltip */}
      {hovered && tip && (
        <div
          className="pointer-events-none absolute z-10 card px-3 py-2 text-xs shadow-md whitespace-nowrap"
          style={{
            left: Math.min(
              tip.x - (wrapRef.current?.getBoundingClientRect().left ?? 0) + 12,
              (wrapRef.current?.clientWidth ?? 300) - 170
            ),
            top: tip.y - (wrapRef.current?.getBoundingClientRect().top ?? 0) + 12,
          }}
        >
          <div className="font-semibold text-sm">
            {info.get(hovered)?.name ?? map.districts.find((d) => d.code === hovered)?.name}
          </div>
          {info.get(hovered) ? (
            <div className="text-ink-secondary mt-0.5">
              {fmtMoneyFull(info.get(hovered)!.perPupil)} per student ·{' '}
              {fmtInt(info.get(hovered)!.enrollment)} students
            </div>
          ) : (
            <div className="text-ink-muted mt-0.5">No data for {year}</div>
          )}
          <div className="text-accent mt-0.5">Click to open →</div>
        </div>
      )}

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-secondary">
        <span className="font-medium text-ink">Funding per student ({year}):</span>
        {RAMP.map((c, i) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: c }} />
            {i === 0
              ? `under ${fmtMoneyFull(breaks[1])}`
              : i === RAMP.length - 1
                ? `over ${fmtMoneyFull(breaks[4])}`
                : `${fmtMoneyFull(breaks[i])}–${fmtMoneyFull(breaks[i + 1])}`}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: NO_DATA }} />
          no data
        </span>
        <span className="text-ink-muted">
          scroll or pinch to zoom{zoomLevel > 1.05 ? ` · ${zoomLevel.toFixed(1)}×` : ''}
        </span>
      </div>
    </div>
  );
}
