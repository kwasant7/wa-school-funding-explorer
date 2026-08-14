'use client';

/**
 * Without this file, any uncaught throw in a route - a malformed data file,
 * a non-null assertion on missing data, a chart handed a shape it doesn't
 * expect - unmounted the entire page to a blank white screen. On a static
 * export there is no server to fall back to, so that blank screen was the
 * only thing a visitor ever saw: indistinguishable from the site being down.
 *
 * This renders inside the root layout (the header, nav, and footer survive),
 * so a visitor can still navigate away even when one route breaks.
 */
import Link from 'next/link';

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
      <p className="text-sm font-semibold text-critical uppercase tracking-wide">
        Something went wrong
      </p>
      <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
        This page hit a snag
      </h1>
      <p className="mt-4 text-lg text-ink-secondary">
        That&apos;s a bug on this page, not something wrong with your data or
        your district. Try again, or head somewhere else on the site.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-deep"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-line px-4 py-2.5 font-semibold text-ink hover:border-accent hover:text-accent"
        >
          Back to How It Works
        </Link>
      </div>
    </div>
  );
}
