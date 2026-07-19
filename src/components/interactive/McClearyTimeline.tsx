'use client';

import { useState } from 'react';

const EVENTS = [
  {
    year: '2007',
    title: 'Two families sue the state',
    body: 'Stephanie McCleary — a school employee and parent from Chimacum — and the Venema family argue Washington is shortchanging its constitutional duty, forcing districts to lean on local levies for basics.',
  },
  {
    year: '2012',
    title: 'The Supreme Court agrees',
    body: 'In McCleary v. State, the court rules unanimously that Washington is violating its paramount duty and orders the Legislature to fully fund basic education by 2018 — with the court watching.',
  },
  {
    year: '2014',
    title: 'Held in contempt',
    body: 'Progress is too slow. The Supreme Court holds the entire state government in contempt of court — a nearly unprecedented move against a sitting legislature.',
  },
  {
    year: '2015',
    title: '$100,000 a day',
    body: 'The court starts fining the state $100,000 per day, earmarked for education. The fines run for almost three years and top $100 million.',
  },
  {
    year: '2017',
    title: 'The grand bargain',
    body: 'Lawmakers pass EHB 2242: billions more per year in state funding, a higher state property tax, higher teacher salary allocations — and strict caps on the local levies districts had relied on.',
  },
  {
    year: '2018',
    title: 'Case closed',
    body: 'The court accepts the plan and ends the case. State per-student funding has climbed ever since — you can see the ramp in the District Explorer trends.',
  },
];

export default function McClearyTimeline() {
  const [idx, setIdx] = useState(0);
  const e = EVENTS[idx];

  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-center gap-1 overflow-x-auto pb-1" role="tablist" aria-label="McCleary timeline">
        {EVENTS.map((ev, i) => (
          <button
            key={ev.year}
            role="tab"
            aria-selected={i === idx}
            onClick={() => setIdx(i)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold tabular-nums transition-colors ${
              i === idx
                ? 'bg-accent text-white'
                : 'text-ink-secondary hover:bg-accent-wash'
            }`}
          >
            {ev.year}
          </button>
        ))}
      </div>
      <div className="relative mt-1 mb-4 h-1 rounded bg-line" aria-hidden>
        <div
          className="absolute inset-y-0 left-0 rounded bg-accent transition-all duration-300"
          style={{ width: `${((idx + 1) / EVENTS.length) * 100}%` }}
        />
      </div>
      <div key={e.year} className="anim-rise min-h-[7rem]">
        <h3 className="text-lg md:text-xl font-bold">
          <span className="text-accent tabular-nums">{e.year}</span> — {e.title}
        </h3>
        <p className="mt-2 text-ink-secondary max-w-2xl">{e.body}</p>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="px-3 py-1.5 rounded-md border border-line text-sm font-medium text-ink-secondary disabled:opacity-40 hover:border-accent"
        >
          ← Back
        </button>
        <button
          onClick={() => setIdx((i) => Math.min(EVENTS.length - 1, i + 1))}
          disabled={idx === EVENTS.length - 1}
          className="px-3 py-1.5 rounded-md border border-line text-sm font-medium text-accent disabled:opacity-40 hover:border-accent"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
