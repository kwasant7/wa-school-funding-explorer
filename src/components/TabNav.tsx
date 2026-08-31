'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'How It Works' },
  { href: '/districts', label: 'District Explorer' },
  { href: '/simulator', label: 'Policy Simulator' },
  { href: '/take-action', label: 'Take Action' },
  { href: '/sources', label: 'Sources' },
];

export default function TabNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="mt-4 md:-mb-px">
      {/*
        Two layouts, because an underline tab row only reads as a tab row when
        it is one row. Five tabs do not fit 375px, and wrapping them left three
        ragged rows with the underlines of the first two floating in the middle
        of the header, attached to nothing. Scrolling them was worse: iOS hides
        overlay scrollbars, so "Take Action" and "Sources" sat off-screen with
        nothing to say they existed.

        On a phone they are a 2-column grid of bordered cards - the fifth spans
        the row so the grid never ends ragged - and the current section is
        filled rather than underlined. From md up the cards drop their box and
        become the original underline row.
      */}
      <ul className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-x-2 md:gap-y-0">
        {TABS.map((tab, i) => {
          const active =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href);
          return (
            <li
              key={tab.href}
              className={i === TABS.length - 1 ? 'col-span-2 md:col-span-1' : undefined}
            >
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-sm transition-colors md:inline-flex md:items-baseline md:rounded-none md:border-x-0 md:border-t-0 md:border-b-2 md:bg-transparent md:px-4 md:text-base ${
                  active
                    ? 'border-accent bg-accent-wash font-semibold text-ink'
                    : 'border-line text-ink-secondary hover:text-ink md:border-transparent md:hover:border-line'
                }`}
              >
                <span
                  className={`text-xs tabular-nums ${
                    active ? 'text-accent' : 'text-ink-muted'
                  }`}
                >
                  0{i + 1}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
