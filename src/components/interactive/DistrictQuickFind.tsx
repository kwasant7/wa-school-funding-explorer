'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import data from '@/data/districts.json';
import { fmtInt, fmtMoneyFull } from '@/lib/format';

type District = (typeof data.districts)[number];

export default function DistrictQuickFind() {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<District | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return data.districts
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) || d.county.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [query]);

  const s = data.statewide;
  const diff = picked ? picked.perPupil - s.avgPerPupil : 0;

  return (
    <div className="card p-5 md:p-6 bg-accent-wash border-accent-soft">
      <h2 className="text-lg md:text-xl font-bold">
        Start with your own school district
      </h2>
      <p className="mt-1 text-sm text-ink-secondary">
        Type your district (or county) and see what it actually receives.
      </p>
      <div className="relative mt-3 max-w-md">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked(null);
          }}
          placeholder="Try “Seattle”, “Yakima”, “Spokane”…"
          className="w-full px-4 py-3 card rounded-lg text-base placeholder:text-ink-muted"
          aria-label="Search for your school district"
        />
        {matches.length > 0 && !picked && (
          <ul className="absolute z-10 mt-1 w-full card shadow-lg overflow-hidden">
            {matches.map((d) => (
              <li key={d.code}>
                <button
                  onClick={() => {
                    setPicked(d);
                    setQuery(d.name);
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
      {picked && (
        <div className="anim-rise mt-4 grid sm:grid-cols-3 gap-3">
          <div className="card px-4 py-3">
            <div className="text-xs text-ink-secondary">Funding per student</div>
            <div className="text-2xl font-bold">{fmtMoneyFull(picked.perPupil)}</div>
            <div className={`text-xs mt-0.5 ${diff >= 0 ? 'text-good' : 'text-critical'}`}>
              {diff >= 0 ? '+' : '−'}
              {fmtMoneyFull(Math.abs(diff)).slice(1)} vs state average
            </div>
          </div>
          <div className="card px-4 py-3">
            <div className="text-xs text-ink-secondary">Students</div>
            <div className="text-2xl font-bold">{fmtInt(picked.enrollment)}</div>
            <div className="text-xs text-ink-muted mt-0.5">{picked.county} County</div>
          </div>
          <Link
            href={`/districts?d=${picked.code}`}
            className="card px-4 py-3 flex flex-col justify-center hover:border-accent transition-colors group"
          >
            <span className="font-semibold text-accent group-hover:underline">
              Full profile & trends →
            </span>
            <span className="text-xs text-ink-muted mt-0.5">
              budgets, demographics, 6-year history
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
