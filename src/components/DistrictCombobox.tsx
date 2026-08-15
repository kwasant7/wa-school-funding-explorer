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
  onClear,
  selectedName,
  placeholder = 'Choose or search for a district',
  tone = 'tint',
}: {
  districts: ComboDistrict[];
  onPick: (code: string) => void;
  /**
   * Drop the selection entirely, returning the page to its no-district state.
   * Without it the clear button only empties the text, and the page keeps
   * showing everything it had already worked out for the old district - which
   * reads as the X not having done anything.
   */
  onClear?: () => void;
  /** Name of the currently-selected district, shown in the field at rest
   * (e.g. after loading a prior selection from storage). Omit for
   * fire-and-forget pickers that navigate away on selection. */
  selectedName?: string;
  placeholder?: string;
  /**
   * 'tint' is the default: the field carries the accent wash so it stands out
   * as the control on an otherwise plain panel. Pass 'plain' when the panel
   * itself is already tinted, where a tinted field on a tinted panel loses
   * the very contrast the wash exists to create.
   */
  tone?: 'tint' | 'plain';
}) {
  const [query, setQuery] = useState(selectedName ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
          ref={inputRef}
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
          className={`district-search w-full px-4 py-2.5 pr-20 card rounded-lg text-base placeholder:text-ink-muted ${
            tone === 'plain' ? 'bg-surface' : 'bg-accent-wash border-accent-soft'
          }`}
        />
        {query !== '' && (
          <button
            type="button"
            aria-label="Clear the district search"
            /*
              preventDefault keeps focus in the field: the input's onBlur
              restores the selected district's name, so letting this button
              take focus would put the name straight back and the clear would
              look like it did nothing.
            */
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery('');
              // Drop the selection itself, not just the text. Otherwise the
              // field empties while the page below still shows the old
              // district, and blur puts the name straight back.
              onClear?.();
              setOpen(true);
              setActiveIndex(0);
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-12 flex w-8 items-center justify-center text-ink-muted hover:text-ink"
          >
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
            setOpen((v) => !v);
            setActiveIndex(0);
          }}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-accent"
        >
          {/*
            A drawn chevron rather than the ▾ character. The glyph rendered at
            whatever size and weight the system font happened to give it -
            small and thin on macOS, and not resizable without scaling the
            font. This is sized in the markup and reads as a control.
          */}
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
                  <span className="font-medium" data-no-translate>{d.name}</span>
                  <span className="text-ink-muted" data-no-translate> · {d.county} County</span>
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
