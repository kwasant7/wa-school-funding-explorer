'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { District, LATEST, yearData } from '@/lib/data';
import { districtPath } from '@/lib/district-slug';
import { fmtInt, fmtMoneyFull } from '@/lib/format';
import { writeSelectedDistrict } from '@/lib/selected-district';

export default function DistrictQuickFind({
  onPick,
  year = LATEST,
  initialCode,
}: {
  onPick?: (district: District | null) => void;
  year?: string;
  /**
   * District to start on, so the page can open already personalized. The
   * search box has to be seeded along with it - a page showing one district's
   * figures above an empty search box reads as a bug.
   */
  initialCode?: string;
}) {
  const initial = initialCode
    ? (yearData(year).districts.find((d) => d.code === initialCode) ?? null)
    : null;
  const [query, setQuery] = useState(initial?.name ?? '');
  const [picked, setPicked] = useState<District | null>(initial);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const data = yearData(year);

  const matches = useMemo(() => {
    const q =
      picked && query === picked.name ? '' : query.trim().toLowerCase();
    return [...data.districts]
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) || d.county.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, year]);

  /*
    A district picked in one year may not exist in another - charters open and
    close - so re-resolve the selection whenever the year changes, and clear it
    if this year has no record of it.
  */
  useEffect(() => {
    if (!picked) return;
    const next = data.districts.find((d) => d.code === picked.code) ?? null;
    setPicked(next);
    setQuery(next ? next.name : '');
    onPick?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

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
    writeSelectedDistrict(district.code);
    onPick?.(district);
  };

  /*
    The panel stays plain and the tint goes on the picker inside it. Washing
    the whole card blue made the one control the section exists for the least
    distinct thing in it - the field read as a white gap in a blue box rather
    than as the thing to click.
  */
  return (
    <div className="card p-5 md:p-6">
      <h2 className="text-lg md:text-xl font-bold">
        Start with your own school district
      </h2>
      {/* Operating instructions for the control below - useless as a search
          snippet, and it sits high enough in the home page's HTML to be picked
          as one. The heading above it stays snippetable. */}
      <p className="mt-1 text-sm text-ink-secondary" data-nosnippet>
        Choose from the dropdown or type a district or county to narrow the list.
      </p>
      <div ref={selectorRef} className="relative mt-3 max-w-md">
        <div className="relative">
          <input
            ref={inputRef}
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
            className="district-search w-full px-4 py-3 pr-20 card rounded-lg text-base bg-accent-wash border-accent-soft placeholder:text-ink-muted"
            aria-label="Choose or search for your school district"
          />
          {query !== '' && (
            <button
              type="button"
              aria-label="Clear the district search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery('');
                setPicked(null);
                onPick?.(null);
                setOpen(true);
                setActiveIndex(0);
                inputRef.current?.focus();
              }}
              className="absolute inset-y-0 right-12 flex w-8 items-center justify-center text-ink-muted hover:text-ink"
            >
              {/* Same drawn X as DistrictCombobox, for the same reason as the
                  chevron below: this picker carries its own copy of the markup. */}
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                className="h-4 w-4"
              >
                <path d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5" />
              </svg>
            </button>
          )}
          <button
            type="button"
            aria-label={open ? 'Close district list' : 'Open district list'}
            aria-expanded={open}
            onClick={() => {
              setOpen((value) => !value);
              setActiveIndex(0);
            }}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-accent"
          >
            {/* Same drawn chevron as DistrictCombobox - this picker predates
                that component and carries its own copy of the markup. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <path d="M5 7.5 10 12.5 15 7.5" />
            </svg>
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
                    <span className="font-medium" data-no-translate>{district.name}</span>
                    <span className="text-ink-muted" data-no-translate>
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
              Both figures use funding FTE, the same denominator
            </div>
          </div>
          <div className="card px-4 py-3">
            <div className="text-xs text-ink-secondary">School district students</div>
            <div className="text-2xl font-bold">
              {fmtInt(Math.round(picked.fundingEnrollment))}
            </div>
            <div className="text-xs text-ink-muted mt-0.5">
              <span data-no-translate>{picked.name}</span> · funding FTE, not October headcount
            </div>
          </div>
          <Link
            href={districtPath(picked.code)}
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
            <span data-no-translate>{picked.name}</span>. ↓
          </p>
        </div>
      )}
    </div>
  );
}
