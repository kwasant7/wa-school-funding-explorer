'use client';

/**
 * The message box. A textarea rather than an input so a long question wraps
 * and stays readable, auto-growing to a capped height.
 *
 * Enter sends; Shift+Enter makes a newline. While a request is in flight the
 * send button becomes Stop, so the same control both starts and cancels - the
 * button never becomes a dead target the visitor has to wait out.
 */
import { useEffect, useRef } from 'react';
import type { AssistantStrings } from '@/lib/assistant/i18n';

const MAX_MESSAGE_CHARS = 1_000;
const MAX_TEXTAREA_PX = 132;

function SendIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 10h11M10 5.5l4.5 4.5L10 14.5" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
      <rect x="6" y="6" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export default function AssistantComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  disabled,
  strings,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
  strings: AssistantStrings;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the content, then scroll internally past the cap.
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [value]);

  const canSend = !busy && !disabled && value.trim().length > 0;

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <label htmlFor="assistant-input" className="sr-only">
        {strings.placeholder}
      </label>
      <textarea
        id="assistant-input"
        ref={textareaRef}
        rows={1}
        value={value}
        disabled={disabled}
        maxLength={MAX_MESSAGE_CHARS}
        placeholder={strings.placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSend();
          }
        }}
        className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-muted focus-visible:border-accent disabled:opacity-60"
      />
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          aria-label={strings.stop}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-secondary transition-colors hover:border-accent hover:text-accent"
        >
          <StopIcon />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSend}
          aria-label={strings.send}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:bg-baseline"
        >
          <SendIcon />
        </button>
      )}
    </form>
  );
}
