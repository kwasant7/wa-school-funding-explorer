'use client';

import { useState } from 'react';

const BANDS = [
  { label: 'K–3', size: 17, note: 'Smallest — early grades benefit most from attention.' },
  { label: 'Grades 4–6', size: 27, note: 'Ten more students per teacher than 3rd grade.' },
  { label: 'Grades 7–8', size: 28.5, note: 'Rounded from the statutory 28.53.' },
  { label: 'Grades 9–12', size: 28.7, note: 'Rounded from the statutory 28.74.' },
  { label: 'Career & tech ed', size: 23, note: 'Lower because labs and shops need space.' },
];

export default function ClassSizeViz() {
  const [idx, setIdx] = useState(0);
  const band = BANDS[idx];
  const whole = Math.floor(band.size);

  return (
    <div className="card p-5 md:p-6">
      <h3 className="font-bold text-lg">One teacher, how many students?</h3>
      <p className="mt-1 text-sm text-ink-secondary">
        Tap a grade band — these are the class sizes the state pays for (not a
        legal cap on real classes).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {BANDS.map((b, i) => (
          <button
            key={b.label}
            onClick={() => setIdx(i)}
            className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
              i === idx
                ? 'bg-accent text-white border-accent'
                : 'border-line text-ink-secondary hover:border-accent hover:bg-accent-wash'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-5 flex-wrap" key={band.label}>
        <div className="flex flex-col items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-9 h-9" fill="#104281" aria-hidden>
            <circle cx="12" cy="6.5" r="4.5" />
            <path d="M3.5 22c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5z" />
          </svg>
          <span className="text-xs text-ink-secondary font-medium">1 teacher</span>
        </div>
        <div className="text-2xl text-ink-muted" aria-hidden>
          →
        </div>
        <div>
          <div className="flex flex-wrap gap-1.5 max-w-sm">
            {Array.from({ length: whole }, (_, i) => (
              <span
                key={i}
                className="dot-in inline-block w-3.5 h-3.5 rounded-full bg-series-state"
                style={{ animationDelay: `${i * 25}ms` }}
              />
            ))}
            {band.size % 1 > 0 && (
              <span
                className="dot-in inline-block h-3.5 rounded-full bg-series-state/50"
                style={{ width: `${(band.size % 1) * 14}px`, animationDelay: `${whole * 25}ms` }}
                title={`${band.size} average`}
              />
            )}
          </div>
          <p className="mt-2 text-sm">
            <strong className="tabular-nums">{band.size}</strong>{' '}
            <span className="text-ink-secondary">funded students · {band.note}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
