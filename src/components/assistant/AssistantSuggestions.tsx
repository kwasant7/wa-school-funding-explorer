'use client';

/** Clickable starter or follow-up questions. */
export default function AssistantSuggestions({
  heading,
  questions,
  onPick,
  disabled,
}: {
  heading: string;
  questions: string[];
  onPick: (question: string) => void;
  disabled: boolean;
}) {
  if (questions.length === 0) return null;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        {heading}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {questions.map((question) => (
          <li key={question}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(question)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:border-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
