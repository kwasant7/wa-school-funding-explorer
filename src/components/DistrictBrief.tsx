'use client';

/**
 * The brief for a single district: what is wrong with its funding, in
 * pictures, and what to ask a lawmaker for.
 *
 * Written for a reader with no background in school finance - a student, a
 * parent at a board meeting - so each problem gets one number, one chart and
 * one sentence, and the supporting citations collapse out of the way. An
 * earlier version argued the case in full prose and ran to seven hundred
 * words; it was accurate and almost nobody would have finished it.
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import StatTile from '@/components/StatTile';
import IssueVisual from '@/components/brief/IssueVisual';
import {
  briefFor,
  DIAGNOSIS_YEAR,
  type DistrictBrief as Brief,
  type Issue,
} from '@/lib/diagnosis';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function DownloadIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2.5v7.5M4.75 7.25 8 10.5l3.25-3.25M2.5 12.5h11" />
    </svg>
  );
}

/**
 * Download the brief as a PDF.
 *
 * The generator is imported on click rather than with the page. It is only
 * needed by the fraction of visitors who actually want the file, and this page
 * already carries the heaviest bundle on the site - there is no reason to make
 * everyone pay for it up front.
 */
function DownloadBriefButton({ brief }: { brief: Brief }) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');

  const download = useCallback(async () => {
    setState('working');
    try {
      const { downloadBriefPdf } = await import('@/lib/brief-pdf');
      downloadBriefPdf(brief, {
        year: DIAGNOSIS_YEAR,
        siteUrl: `${window.location.origin}${BASE_PATH}`,
      });
      setState('idle');
    } catch {
      setState('error');
    }
  }, [brief]);

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={() => void download()}
        disabled={state === 'working'}
        className="inline-flex items-center gap-2 rounded-xl border border-accent-soft bg-accent-wash px-3.5 py-2 text-sm font-semibold text-accent-deep transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-70"
      >
        <DownloadIcon />
        {state === 'working' ? 'Preparing…' : 'Download this brief'}
        <span className="font-normal text-ink-muted">PDF</span>
      </button>
      {/* Announced rather than only coloured, so the failure is not silent. */}
      <p role="status" aria-live="polite" className="sr-only">
        {state === 'working' ? 'Preparing the PDF' : ''}
      </p>
      {state === 'error' && (
        <p className="mt-1.5 text-xs text-critical">
          Could not build the PDF. Try again, or print this page instead.
        </p>
      )}
    </div>
  );
}

/**
 * One problem, as a card: a number, a picture, and one thing to ask for.
 *
 * The bill citations are collapsed behind a <details> rather than listed. They
 * are the part a curious reader or a journalist wants and the part that made
 * the old brief look like homework - keeping them one click away means the
 * page can be read in a minute without losing the receipts.
 */
function IssueCard({ issue, index }: { issue: Issue; index: number }) {
  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white"
        >
          {index + 1}
        </span>
        <h3 className="text-lg font-bold leading-snug md:text-xl">{issue.title}</h3>
      </div>

      <p className="mt-2.5 text-ink-secondary">{issue.fact}</p>

      <IssueVisual visual={issue.visual} />

      <div className="mt-4 rounded-xl border border-accent-soft bg-accent-wash p-3.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-deep">
          What to ask for
        </p>
        <p className="mt-1 font-medium text-ink">{issue.ask}</p>
      </div>

      {issue.refs.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-xs font-semibold text-accent hover:underline">
            Where this comes from
          </summary>
          <ul className="mt-2 space-y-1.5">
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
        </details>
      )}
    </section>
  );
}

export default function DistrictBrief({ code }: { code: string }) {
  const brief: Brief | null = briefFor(code);
  if (!brief) return null;

  return (
    <section data-assistant-section="district-brief" className="mt-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-accent uppercase tracking-wide">
            Your district&apos;s brief
          </p>
          <h2 className="mt-1 text-2xl md:text-3xl font-bold">
            What needs to change in{' '}
            <span data-no-translate>{brief.name}</span>
          </h2>
        </div>
        <DownloadBriefButton brief={brief} />
      </div>

      <p className="mt-2 max-w-2xl text-ink-secondary">{brief.summary}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <p className="mt-5 card p-5 text-ink-secondary">{brief.steadyNote}</p>
      ) : (
        /*
          One card per problem, side by side on a wide screen. The old brief
          stacked everything in a single tall column, which made four problems
          read as one long document; separate cards let a reader take in the
          shape of all four before reading any of them.
        */
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {brief.issues.map((issue, index) => (
            <IssueCard key={issue.id} issue={issue} index={index} />
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        All numbers come from OSPI records for {DIAGNOSIS_YEAR}, and each
        district is compared against the other 314 in Washington.{' '}
        <Link href="/sources" className="font-semibold text-accent hover:underline">
          See where the data comes from
        </Link>
        .
      </p>

      <details className="mt-2 group">
        <summary className="cursor-pointer text-xs font-semibold text-accent hover:underline">
          How these problems are picked
        </summary>
        <div className="mt-2 max-w-2xl text-xs text-ink-secondary space-y-1.5">
          <p>
            A problem only appears here if this district&apos;s number is both
            large in dollar terms and unusual next to the rest of the state -
            not just below average. The cutoffs, in the rank a district needs
            to clear:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              Special education, everyday running costs: gap per student in
              the top 45% of districts, and at least $300 (special education)
              or $250 (running costs) per student.
            </li>
            <li>
              Transportation, English learners: gap or share in the top 30%,
              and at least $120 per student or 12% of enrollment.
            </li>
            <li>Student poverty: share in the top 28%, and at least 60% of enrollment.</li>
            <li>
              Not much local property to tax: Local Effort Assistance share in
              the top 30% of districts that receive any.
            </li>
          </ul>
          <p>
            A district that clears none of these gets a short brief saying so
            - not a manufactured problem list. Clearing a cutoff means a
            problem is worth naming here, not that districts below it have
            nothing to improve.
          </p>
        </div>
      </details>
    </section>
  );
}
