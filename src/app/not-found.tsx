import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Without this file Next renders its own built-in 404 block inside the site
 * chrome: a different font stack, a `height: 100vh` that shoves the footer a
 * screen down, and an injected `prefers-color-scheme: dark` rule that turns the
 * whole page - header and footer included - black for anyone on a dark OS, even
 * though globals.css declares `color-scheme: light`. It also offered no way
 * back, which is where a visitor lands from any stale legislator link or
 * mistyped URL.
 */
export const metadata: Metadata = {
  title: 'Page not found',
  description:
    'That page does not exist on the WA School Funding Explorer. Start from the funding explainer, the district data, or the policy simulator.',
};

const DESTINATIONS = [
  { href: '/', title: 'How it works', blurb: 'The prototypical school model, start to finish.' },
  { href: '/districts', title: 'District Explorer', blurb: 'Funding and trends for all 315 districts.' },
  { href: '/simulator', title: 'Policy Simulator', blurb: 'Move the levers and see what each costs.' },
  { href: '/take-action', title: 'Take Action', blurb: 'Your district brief and your legislators.' },
  { href: '/sources', title: 'Sources & Methodology', blurb: 'Every dataset, statute and script.' },
];

export default function NotFound() {
  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
      <p className="text-sm font-semibold text-accent uppercase tracking-wide">
        404
      </p>
      <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
        That page does not exist
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        The link may be out of date, or the address may have a typo. Everything
        on the site is one click from here.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DESTINATIONS.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="card p-5 no-underline hover:border-accent"
          >
            <span className="block font-semibold text-accent">{d.title}</span>
            <span className="mt-1 block text-sm text-ink-secondary">
              {d.blurb}
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-sm text-ink-secondary">
        Looking for a particular district? Open the{' '}
        <Link href="/districts" className="font-semibold text-accent hover:underline">
          District Explorer
        </Link>{' '}
        and search by name.
      </p>
    </div>
  );
}
