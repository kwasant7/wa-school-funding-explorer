'use client';

import { useState } from 'react';
import { CLASS_SIZE } from '@/lib/prototypical-model';

const BANDS = [
  { label: 'K-3', size: CLASS_SIZE.k3, note: 'Smallest - and the one band where running larger classes costs a district the funding.' },
  { label: 'Grades 4-6', size: CLASS_SIZE.grades46, note: 'Ten more students per teacher than 3rd grade.' },
  { label: 'Grades 7-8', size: CLASS_SIZE.grades78, note: 'The middle school general education rate.' },
  { label: 'Grades 9-12', size: CLASS_SIZE.grades912, note: 'The largest funded general education class size.' },
  { label: 'Career & tech ed', size: CLASS_SIZE.cte, note: 'Applies in middle and high school alike.' },
  { label: 'Lab science', size: CLASS_SIZE.laboratoryScience, note: 'An enhancement for two laboratory science classes per high school student.' },
  { label: 'Skill centers', size: CLASS_SIZE.skillCenter, note: 'The smallest funded class in the formula.' },
];

export default function ClassSizeViz() {
  const [idx, setIdx] = useState(0);
  const band = BANDS[idx];
  const whole = Math.floor(band.size);

  return (
    <div className="card p-5 md:p-6">
      <h3 className="font-bold text-lg">One teacher, how many students?</h3>
      <p className="mt-1 text-sm text-ink-secondary">
        Tap a grade band - these are the class sizes the state pays for. They
        are not a legal cap, with one exception: K-3 money is paid only in
        proportion to the class sizes a district can show it actually runs.
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
