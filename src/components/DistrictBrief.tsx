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

import { useCallback, useState } from 'react';
import Link from 'next/link';
import StatTile from '@/components/StatTile';
import {
  briefFor,
  DIAGNOSIS_YEAR,
  type BarTone,
  type BriefVisual,
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

const BAR_COLOR: Record<BarTone, string> = {
  accent: '#256abf',
  warn: '#eda100',
  bad: '#d03b3b',
  good: '#006300',
  muted: '#c3c2b7',
};

/**
 * The evidence, drawn.
 *
 * Bars are sized against the largest value in their own set, not a shared
 * scale, because the comparison that matters is always inside one picture -
 * what a thing costs against what the state pays for it. A floor of 2% keeps a
 * near-zero value visible as a sliver instead of vanishing, which would read as
 * missing data rather than as a very small number.
 */
function Bars({ visual }: { visual: Extract<BriefVisual, { kind: 'bars' }> }) {
  const max = Math.max(...visual.bars.map((bar) => Math.abs(bar.value)), 1);

  return (
    <figure className="mt-3">
      <figcaption className="text-sm font-medium text-ink-secondary">
        {visual.caption}
      </figcaption>
      <div className="mt-2.5 space-y-2.5">
        {visual.bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink-secondary">{bar.label}</span>
              <span className="text-sm font-bold tabular-nums text-ink">{bar.display}</span>
            </div>
            <div className="mt-1 h-3 w-full rounded-full bg-line/70">
              <div
                className="h-3 rounded-full"
                style={{
                  width: `${Math.max(2, (Math.abs(bar.value) / max) * 100)}%`,
                  backgroundColor: BAR_COLOR[bar.tone],
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {visual.gap && (
        <div
          className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 rounded-lg border-l-4 bg-paper px-3 py-2"
          style={{ borderColor: BAR_COLOR[visual.gap.tone] }}
        >
          <span className="text-sm text-ink-secondary">{visual.gap.label}</span>
          <span
            className="text-base font-bold tabular-nums"
            style={{ color: BAR_COLOR[visual.gap.tone] }}
          >
            {visual.gap.value}
          </span>
        </div>
      )}
    </figure>
  );
}

/** State involvement is a position on a ladder, not a quantity. */
function Steps({ visual }: { visual: Extract<BriefVisual, { kind: 'steps' }> }) {
  return (
    <figure className="mt-3">
      <figcaption className="text-sm font-medium text-ink-secondary">
        {visual.caption}
      </figcaption>
      <ol className="mt-2.5 flex flex-wrap gap-1.5">
        {visual.steps.map((step, index) => {
          const here = index === visual.at;
          return (
            <li
              key={step}
              aria-current={here ? 'step' : undefined}
              className={`flex-1 min-w-[8rem] rounded-lg px-3 py-2 text-sm font-semibold ${
                here
                  ? 'bg-critical text-white'
                  : index < visual.at
                    ? 'bg-line text-ink-secondary'
                    : 'bg-paper text-ink-muted border border-line'
              }`}
            >
              {step}
              {here && <span className="block text-xs font-normal opacity-90">You are here</span>}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

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

      <div className="md:ml-10">
        {issue.visual.kind === 'bars' ? (
          <Bars visual={issue.visual} />
        ) : (
          <Steps visual={issue.visual} />
        )}
        <p className="mt-3 text-sm text-ink-secondary">{issue.plain}</p>
      </div>

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
          Every number here comes from state (OSPI) records for {DIAGNOSIS_YEAR},
          and every district is compared against the other 314 in Washington.{' '}
          <Link href="/sources" className="font-semibold text-accent hover:underline">
            See where the numbers come from
          </Link>
          .
        </p>
      </article>
    </section>
  );
}
