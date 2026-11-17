'use client';

/**
 * The brief for a single district: what is wrong with its funding, in
 * pictures, with the sources behind each one.
 *
 * Written for a reader with no background in school finance - a student, a
 * parent at a board meeting - so each problem gets one number, one chart and
 * one sentence, and the supporting citations collapse out of the way. An
 * earlier version argued the case in full prose and ran to seven hundred
 * words; it was accurate and almost nobody would have finished it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function PrinterIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 9V3.5h10V9" />
      <path d="M7 17H4.5A1.5 1.5 0 0 1 3 15.5v-5A1.5 1.5 0 0 1 4.5 9h15a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17" />
      <path d="M7 14h10v6.5H7z" />
    </svg>
  );
}

/**
 * Open the brief as a PDF in a new tab, so it lands where a link would - a
 * page the reader can read, print, or save on their own terms - rather than
 * an unannounced file dropping into their downloads folder.
 *
 * It is drawn as a full-width panel with a solid button because the printed
 * copy is the point of the brief - the thing a parent carries to a board
 * meeting - and a pale outlined chip beside the heading was easy to miss.
 *
 * The PDF is built in the background once the panel mounts, and the click
 * opens its address directly. The tab used to be opened blank first - before
 * the generator had even loaded - to stay inside the click for popup blockers,
 * which left an about:blank tab sitting there while the file was made. With
 * the PDF already built, the click can open the real thing synchronously.
 * The generator still loads as a separate chunk after the page is up, so it
 * adds nothing to the page's first load.
 */
type PdfLib = typeof import('@/lib/brief-pdf');

function DownloadBriefButton({ brief }: { brief: Brief }) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');
  // The generator module and a ready-made PDF's object URL, held for the click.
  const lib = useRef<PdfLib | null>(null);
  const pdfUrl = useRef<string | null>(null);

  const metaNow = useCallback(
    () => ({
      year: DIAGNOSIS_YEAR,
      siteUrl: `${window.location.origin}${BASE_PATH}`,
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    import('@/lib/brief-pdf')
      .then((mod) => {
        if (cancelled) return;
        lib.current = mod;
        url = URL.createObjectURL(mod.buildBriefPdf(brief, metaNow()));
        pdfUrl.current = url;
      })
      .catch(() => {
        // Nothing to report yet: a click before this finished builds it again,
        // and says so if that fails too.
      });
    return () => {
      cancelled = true;
      pdfUrl.current = null;
      if (url) {
        // Not revoked at once: a tab opened from it may still be loading.
        const stale = url;
        window.setTimeout(() => URL.revokeObjectURL(stale), 60_000);
      }
    };
  }, [brief, metaNow]);

  const openBrief = useCallback(async () => {
    const meta = metaNow();
    let ready =
      lib.current && pdfUrl.current ? { mod: lib.current, url: pdfUrl.current } : null;

    if (!ready) {
      // Clicked before the background build finished, or it failed: build now.
      setState('working');
      try {
        const mod = await import('@/lib/brief-pdf');
        const url = URL.createObjectURL(mod.buildBriefPdf(brief, meta));
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        ready = { mod, url };
      } catch {
        setState('error');
        return;
      }
    }

    // A tab opened straight onto the PDF, so the reader can read, print or
    // save it. If a strict popup blocker refuses it, fall back to a direct
    // download so they still get the file instead of nothing.
    if (!window.open(ready.url, '_blank')) {
      ready.mod.downloadBriefPdf(brief, meta);
    }
    setState('idle');
  }, [brief, metaNow]);

  return (
    <div className="mt-5 flex flex-col gap-4 rounded-2xl border-2 border-accent bg-accent-wash p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white"
        >
          <PrinterIcon />
        </span>
        <div>
          <p className="text-lg font-bold leading-snug text-accent-deep">
            Print this brief
          </p>
          <p className="mt-0.5 text-sm text-ink-secondary">
            A print-ready PDF of this brief. Bring a copy to a school board
            meeting or hand it to your legislator.
          </p>
        </div>
      </div>
      <div className="shrink-0">
        <button
          type="button"
          onClick={() => void openBrief()}
          disabled={state === 'working'}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-accent px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          <PrinterIcon />
          {state === 'working' ? 'Preparing…' : 'Open printable PDF'}
        </button>
        {/* Announced rather than only coloured, so the failure is not silent. */}
        <p role="status" aria-live="polite" className="sr-only">
          {state === 'working' ? 'Preparing the PDF' : ''}
        </p>
        {state === 'error' && (
          <p className="mt-1.5 text-xs text-critical">
            Could not open the PDF. Try again, or print this page instead.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * One problem, as a card: a number, a picture, and where it comes from.
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

      {issue.response && (
        <div className="mt-4 rounded-xl border border-good/40 bg-green-50 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-good">
            What the district has already done
          </p>
          <p className="mt-1 text-ink-secondary">{issue.response}</p>
          <p className="mt-1.5 text-xs text-ink-muted">
            Reported locally - not yet reflected on OSPI&apos;s oversight page.
          </p>
        </div>
      )}

      {issue.refs.length > 0 && (
        <details className="mt-3 group">
          <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-xs font-semibold text-accent hover:underline">
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
  // Memoised so the print button's ready-made PDF is rebuilt only when the
  // district changes, not on every render.
  const brief: Brief | null = useMemo(() => briefFor(code), [code]);
  if (!brief) return null;

  return (
    <section data-assistant-section="district-brief" className="mt-8">
      <h2 className="text-2xl md:text-3xl font-bold">
        What needs to change in{' '}
        <span data-no-translate>{brief.name}</span>
      </h2>

      <p className="mt-2 text-ink-secondary">{brief.summary}</p>

      <DownloadBriefButton brief={brief} />

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
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-xs font-semibold text-accent hover:underline">
          How these problems are picked
        </summary>
        <div className="mt-2 text-xs text-ink-secondary space-y-1.5">
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
