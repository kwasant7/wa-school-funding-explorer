'use client';

/**
 * The assistant's front door, and nothing else.
 *
 * FundingAssistant reaches lib/assistant/context, which reaches lib/data, which
 * imports history.json - a one-megabyte six-year dataset. Because the assistant
 * was mounted directly in the root layout, webpack put that megabyte in the
 * shared chunk of every route: /sources and /404 downloaded the full funding
 * history to render static text, and it was roughly half of every page's
 * JavaScript.
 *
 * So the layout now mounts this instead: a button that looks exactly like the
 * real launcher and pulls the assistant in on first click. Visitors who never
 * open the guide never pay for it, and the ones who do wait on a single
 * interaction-triggered fetch rather than on every page load.
 *
 * The markup here has to stay in step with the launcher button inside
 * FundingAssistant - the swap should be invisible.
 */
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { assistantStrings } from '@/lib/assistant/i18n';
import { useAssistantLanguage } from '@/lib/assistant/use-language';

const FundingAssistant = dynamic(
  () => import('@/components/assistant/FundingAssistant'),
  { ssr: false },
);

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z" />
      <path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" />
    </svg>
  );
}

export default function AssistantLauncher() {
  const [loaded, setLoaded] = useState(false);
  const language = useAssistantLanguage();
  const strings = assistantStrings(language);

  if (loaded) return <FundingAssistant initialOpen />;

  return (
    /*
      data-nosnippet: this button ships in the static HTML of every route, so
      without it "Site guide" is a candidate snippet for any page on the site -
      chrome describing a chat widget, offered to someone searching for funding
      data. The assistant's own conversation UI is inside FundingAssistant,
      which is client-only and never reaches a crawler at all.
    */
    <div data-no-translate data-nosnippet>
      <button
        type="button"
        onClick={() => setLoaded(true)}
        aria-haspopup="dialog"
        aria-expanded={false}
        aria-label={strings.open}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-accent-deep/20 bg-accent px-4 py-3 text-white shadow-lg transition-transform duration-150 hover:scale-[1.03] hover:bg-accent-deep motion-reduce:transition-none md:bottom-6 md:right-6"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <SparkIcon className="h-5 w-5" />
        <span className="text-sm font-semibold">{strings.title}</span>
      </button>
    </div>
  );
}
