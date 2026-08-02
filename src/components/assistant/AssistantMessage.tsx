'use client';

/**
 * One turn in the conversation: a visitor question, or an assistant answer
 * with its citations, action confirmations, and offered actions.
 */
import { useState } from 'react';
import type { AssistantStrings } from '@/lib/assistant/i18n';
import type { AssistantAction, AssistantTurn } from '@/lib/assistant/types';
import AssistantSources from '@/components/assistant/AssistantSources';
import RevealedText from '@/components/assistant/RevealedText';

function CheckIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="mt-0.5 h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5l3.5 3.5L13 4.5" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="mt-0.5 h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 5.5v3.5M8 11.5h.01" />
      <circle cx="8" cy="8" r="6.5" />
    </svg>
  );
}

export default function AssistantMessage({
  turn,
  strings,
  onRunAction,
  onRetry,
  animate = false,
  onReveal,
}: {
  turn: AssistantTurn;
  strings: AssistantStrings;
  onRunAction: (action: AssistantAction) => void;
  onRetry: () => void;
  /** True only for an answer that has just arrived, so it types itself in. */
  animate?: boolean;
  onReveal?: () => void;
}) {
  /*
    Everything that hangs off the answer - the confidence caveat, the action
    confirmations, the citations - waits for the text to finish. Showing them
    against a half-written answer puts the footnotes before the sentence they
    belong to, and each one appearing is another jump in the panel's height,
    which is the thing being fixed.
  */
  const [revealed, setRevealed] = useState(!animate);
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-sm text-white">
          {turn.text}
        </div>
      </div>
    );
  }

  if (turn.error) {
    return (
      <div className="rounded-xl border border-critical/40 bg-red-50 p-3">
        <p className="flex gap-2 text-sm text-ink">
          <span className="text-critical">
            <WarningIcon />
          </span>
          <span>{turn.error.message}</span>
        </p>
        {turn.error.retryable && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-accent hover:border-accent"
          >
            {strings.retry}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[95%]">
      <div className="rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-3 text-sm text-ink-secondary">
        <RevealedText
          text={turn.text}
          animate={animate}
          onReveal={onReveal}
          onDone={setRevealed}
        />

        {/*
          A low-confidence answer says so in words rather than only dimming
          something, so the caveat survives for a screen reader.
        */}
        {revealed && turn.confidence === 'low' && (
          <p className="mt-2.5 border-t border-line pt-2 text-xs text-ink-muted">
            {strings.confidenceLow}
          </p>
        )}

        {revealed && turn.performed && turn.performed.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-line pt-2.5">
            {turn.performed.map((label) => (
              <li key={label} className="flex gap-1.5 text-xs font-medium text-good">
                <CheckIcon />
                <span>
                  <span className="sr-only">{strings.performed}: </span>
                  {label}
                </span>
              </li>
            ))}
          </ul>
        )}

        {revealed && turn.offered && turn.offered.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
            {turn.offered.map((offer) => (
              <button
                key={offer.label}
                type="button"
                onClick={() => onRunAction(offer.action)}
                className="rounded-lg border border-accent-soft bg-accent-wash px-2.5 py-1 text-xs font-semibold text-accent-deep transition-colors hover:border-accent"
              >
                {offer.label}
              </button>
            ))}
          </div>
        )}

        {revealed && turn.sources && (
          <AssistantSources
            sources={turn.sources}
            heading={strings.sources}
            externalLabel={strings.externalLink}
          />
        )}
      </div>
    </div>
  );
}
