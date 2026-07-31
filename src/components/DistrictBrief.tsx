'use client';

/**
 * The one-page brief for a single district: what is distinctive about its
 * funding problem, the numbers behind that claim, and what to ask for.
 *
 * Laid out as a document rather than a dashboard. Someone should be able to
 * read it top to bottom, print it, and walk into a legislator's office with
 * it. That is why the issues are numbered sections with bullets instead of
 * cards in a grid - a grid invites skimming, and the argument here is
 * cumulative.
 */

import Link from 'next/link';
import StatTile from '@/components/StatTile';
import {
  briefFor,
  DIAGNOSIS_YEAR,
  type DistrictBrief as Brief,
  type Issue,
} from '@/lib/diagnosis';

function IssueSection({ issue, index }: { issue: Issue; index: number }) {
  return (
    <section className="pt-6 first:pt-0 border-t first:border-t-0 border-line">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center"
        >
          {index + 1}
        </span>
        <div className="min-w-0">
          <h3 className="text-lg md:text-xl font-bold leading-snug">
            {issue.title}
          </h3>
          <p className="mt-1 font-medium text-ink-secondary">
            {issue.headline}
          </p>
        </div>
      </div>

      <ul className="mt-4 md:ml-10 space-y-2">
        {issue.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2.5 text-sm text-ink-secondary">
            <span aria-hidden className="mt-2 w-1.5 h-1.5 shrink-0 rounded-full bg-accent" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 md:ml-10 card bg-accent-wash border-accent-soft p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-deep">
          The ask
        </p>
        <p className="mt-1 text-sm text-ink">{issue.ask}</p>
        {issue.refs.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {issue.refs.map((ref) => (
              <li key={ref.bill} className="text-xs text-ink-secondary">
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-accent hover:underline"
                >
                  {ref.bill} ↗
                </a>{' '}
                {ref.note}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function DistrictBrief({ code }: { code: string }) {
  const brief: Brief | null = briefFor(code);
  if (!brief) return null;

  return (
    <section className="mt-8">
      <p className="text-sm font-semibold text-accent uppercase tracking-wide">
        Your district&apos;s brief
      </p>
      <h2 className="mt-1 text-2xl md:text-3xl font-bold">
        What needs to change in{' '}
        <span data-no-translate>{brief.name}</span>
      </h2>

      <article className="mt-4 card p-5 md:p-7">
        <p className="text-lg md:text-xl font-semibold leading-snug">
          {brief.headline}
        </p>
        <p className="mt-2 text-ink-secondary max-w-3xl">{brief.summary}</p>

        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {brief.stats.map((stat) => (
            <StatTile
              key={stat.label}
              label={stat.label}
              value={stat.value}
              note={stat.note}
            />
          ))}
        </div>

        {brief.steadyNote ? (
          <p className="mt-6 pt-6 border-t border-line text-sm text-ink-secondary">
            {brief.steadyNote}
          </p>
        ) : (
          <div className="mt-6 pt-6 border-t border-line space-y-6">
            {brief.issues.map((issue, index) => (
              <IssueSection key={issue.id} issue={issue} index={index} />
            ))}
          </div>
        )}

        <p className="mt-6 pt-4 border-t border-line text-xs text-ink-muted">
          Every figure above is computed from the OSPI data behind this site -
          F-196 revenue and expenditure actuals and the Apportionment final
          extract for {DIAGNOSIS_YEAR}, the enrichment levy worksheet, and OSPI
          enrollment and demographic reporting. Districts are ranked against the
          other 314 in Washington, so &quot;unusually high&quot; always means
          unusual for this state.{' '}
          <Link href="/sources" className="font-semibold text-accent hover:underline">
            See the full source list
          </Link>
          .
        </p>
      </article>
    </section>
  );
}
