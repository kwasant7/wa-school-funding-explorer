'use client';

/**
 * The Sources strip under a grounded answer.
 *
 * Internal pages and official external sources are visually distinct and
 * labelled in text, not by colour alone - "Site" versus "Official" is readable
 * to a screen reader and to anyone who cannot separate the two chip colours.
 */
import Link from 'next/link';
import type { AssistantSource } from '@/lib/assistant/types';

export default function AssistantSources({
  sources,
  heading,
  externalLabel,
}: {
  sources: AssistantSource[];
  heading: string;
  externalLabel: string;
}) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-line pt-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        {heading}
      </p>
      <ul className="mt-1.5 space-y-1">
        {sources.map((source) => {
          const external = source.type === 'official';
          const chip = (
            <span
              className={`mr-1.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                external
                  ? 'bg-accent-wash text-accent-deep'
                  : 'bg-paper text-ink-secondary'
              }`}
            >
              {external ? 'Official' : 'Site'}
            </span>
          );
          return (
            <li key={source.id} className="text-xs leading-snug">
              {chip}
              {external ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline underline-offset-2 hover:text-accent-deep"
                >
                  {source.label}
                  <span className="sr-only"> ({externalLabel})</span>
                  <span aria-hidden> ↗</span>
                </a>
              ) : (
                <Link
                  href={source.url}
                  className="font-medium text-accent underline underline-offset-2 hover:text-accent-deep"
                >
                  {source.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
