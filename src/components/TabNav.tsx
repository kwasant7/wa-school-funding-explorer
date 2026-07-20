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
    <nav aria-label="Sections" className="-mb-px mt-4 overflow-x-auto">
      <ul className="flex gap-1 md:gap-2 whitespace-nowrap">
        {TABS.map((tab, i) => {
          const active =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-baseline gap-2 px-3 md:px-4 py-3 border-b-2 text-sm md:text-base transition-colors ${
                  active
                    ? 'border-accent text-ink font-semibold'
                    : 'border-transparent text-ink-secondary hover:text-ink hover:border-line'
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
