'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import data from '@/data/districts.json';
import { fmtInt, fmtMoneyFull } from '@/lib/format';

type District = (typeof data.districts)[number];

export default function DistrictQuickFind({
  onPick,
}: {
  onPick?: (district: District | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<District | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectorRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q =
      picked && query === picked.name ? '' : query.trim().toLowerCase();
    return [...data.districts]
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) || d.county.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [query]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const s = data.statewide;
  const diff = picked ? picked.perPupil - s.avgPerPupil : 0;
  const pickDistrict = (district: District) => {
    setPicked(district);
    setQuery(district.name);
    setOpen(false);
    window.localStorage.setItem('wa-selected-district', district.code);
    onPick?.(district);
  };

  return (
    <div className="card p-5 md:p-6 bg-accent-wash border-accent-soft">
      <h2 className="text-lg md:text-xl font-bold">
        Start with your own school district
      </h2>
      <p className="mt-1 text-sm text-ink-secondary">
        Choose from the dropdown or type a district or county to narrow the list.
      </p>
      <div ref={selectorRef} className="relative mt-3 max-w-md">
        <div className="relative">
          <input
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls="district-options"
            aria-autocomplete="list"
            aria-activedescendant={
              open && matches[activeIndex]
                ? `district-option-${matches[activeIndex].code}`
                : undefined
            }
            value={query}
            onFocus={() => {
              setOpen(true);
              setActiveIndex(0);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setPicked(null);
              setOpen(true);
              setActiveIndex(0);
              onPick?.(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setOpen(true);
                setActiveIndex((index) =>
                  Math.min(index + 1, matches.length - 1)
                );
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (e.key === 'Enter' && open && matches[activeIndex]) {
                e.preventDefault();
                pickDistrict(matches[activeIndex]);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            placeholder="Choose or search for a district"
            className="w-full px-4 py-3 pr-12 card rounded-lg text-base placeholder:text-ink-muted"
            aria-label="Choose or search for your school district"
          />
          <button
            type="button"
            aria-label={open ? 'Close district list' : 'Open district list'}
            aria-expanded={open}
            onClick={() => {
              setOpen((value) => !value);
              setActiveIndex(0);
            }}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-secondary"
          >
            <span aria-hidden="true">{open ? '▴' : '▾'}</span>
          </button>
        </div>
        {open && (
          <ul
            id="district-options"
            role="listbox"
            className="absolute z-10 mt-1 max-h-72 w-full card shadow-lg overflow-y-auto"
          >
            {matches.length > 0 ? (
              matches.map((district, index) => (
                <li
                  key={district.code}
                  id={`district-option-${district.code}`}
                  role="option"
                  aria-selected={picked?.code === district.code}
                >
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => pickDistrict(district)}
                    className={`w-full text-left px-4 py-2.5 text-sm ${
                      index === activeIndex ? 'bg-accent-wash' : ''
                    }`}
                  >
                    <span className="font-medium">{district.name}</span>
                    <span className="text-ink-muted">
                      {' '}
                      · {district.county} County
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-sm text-ink-muted">
                No matching school districts
              </li>
            )}
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
            <div className="text-xs text-ink-muted mt-1">
              Uses funding FTE - not the headcount shown next to it
            </div>
          </div>
          <div className="card px-4 py-3">
            <div className="text-xs text-ink-secondary">School district students</div>
            <div className="text-2xl font-bold">{fmtInt(picked.enrollment)}</div>
            <div className="text-xs text-ink-muted mt-0.5">
              {picked.name} · October headcount
            </div>
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
          <p className="sm:col-span-3 text-sm text-accent-deep font-medium">
            The prototypical-school model below is now personalized to{' '}
            {picked.name}. ↓
          </p>
        </div>
      )}
    </div>
  );
}
