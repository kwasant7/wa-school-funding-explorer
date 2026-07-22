'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type ComboDistrict = { code: string; name: string; county: string };

/**
 * Searchable district picker - same type-ahead behavior as the home page's
 * "Start with your own school district" box. Calls onPick with the district
 * code when one is chosen.
 */
export default function DistrictCombobox({
  districts,
  onPick,
  selectedName,
  placeholder = 'Choose or search for a district',
}: {
  districts: ComboDistrict[];
  onPick: (code: string) => void;
  /** Name of the currently-selected district, shown in the field at rest
   * (e.g. after loading a prior selection from storage). Omit for
   * fire-and-forget pickers that navigate away on selection. */
  selectedName?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(selectedName ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Keep the field in sync when the selection changes from outside (e.g. a
  // saved district loads after mount, or the parent clears the selection).
  useEffect(() => {
    setQuery(selectedName ?? '');
  }, [selectedName]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = q
      ? districts
          .map((d) => {
            const name = d.name.toLowerCase();
            let score = 3;
            if (name.startsWith(q)) score = 0;
            else if (name.includes(q)) score = 1;
            else if (d.county.toLowerCase().includes(q)) score = 2;
            return { d, score };
          })
          .filter((x) => x.score < 3)
      : districts.map((d) => ({ d, score: 0 }));
    return scored
      .sort((a, b) => a.score - b.score || a.d.name.localeCompare(b.d.name))
      .map((x) => x.d);
  }, [districts, query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (code: string) => {
    onPick(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={ref} className="relative max-w-md">
      <div className="relative">
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="combo-district-options"
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches[activeIndex] ? `combo-option-${matches[activeIndex].code}` : undefined
          }
          value={query}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && open && matches[activeIndex]) {
              e.preventDefault();
              pick(matches[activeIndex].code);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          onBlur={() => setQuery(selectedName ?? '')}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full px-4 py-2.5 pr-12 card rounded-lg text-base placeholder:text-ink-muted"
        />
        <button
          type="button"
          aria-label={open ? 'Close district list' : 'Open district list'}
          aria-expanded={open}
          onClick={() => {
            setOpen((v) => !v);
            setActiveIndex(0);
          }}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-secondary"
        >
          <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
      </div>
      {open && (
        <ul
          id="combo-district-options"
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full card shadow-lg overflow-y-auto"
        >
          {matches.length > 0 ? (
            matches.slice(0, 60).map((d, index) => (
              <li key={d.code} id={`combo-option-${d.code}`} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(d.code)}
                  className={`w-full text-left px-4 py-2.5 text-sm ${index === activeIndex ? 'bg-accent-wash' : ''}`}
                >
                  <span className="font-medium">{d.name}</span>
                  <span className="text-ink-muted"> · {d.county} County</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-ink-muted">No matching school districts</li>
          )}
        </ul>
      )}
    </div>
  );
}
