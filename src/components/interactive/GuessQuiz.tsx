'use client';

import { useState } from 'react';

export default function GuessQuiz({
  question,
  options,
  correctIndex,
  reveal,
}: {
  question: string;
  options: string[];
  correctIndex: number;
  reveal: React.ReactNode;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  return (
    <div className="card p-5 md:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        Pop quiz
      </p>
      <h3 className="mt-1 text-lg md:text-xl font-bold">{question}</h3>
      <div className="mt-4 grid sm:grid-cols-2 gap-2">
        {options.map((opt, i) => {
          const isCorrect = i === correctIndex;
          const isPicked = i === picked;
          let style =
            'border-line hover:border-accent hover:bg-accent-wash text-ink-secondary';
          if (answered) {
            if (isCorrect)
              style = 'border-good bg-green-50 text-ink font-semibold';
            else if (isPicked) style = 'border-critical bg-red-50 text-ink';
            else style = 'border-line text-ink-muted';
          }
          return (
            <button
              key={opt}
              disabled={answered}
              onClick={() => setPicked(i)}
              className={`text-left px-4 py-3 rounded-lg border text-sm md:text-base transition-colors ${style}`}
            >
              <span className="mr-2 font-semibold text-ink-muted">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
              {answered && isCorrect && ' ✓'}
              {answered && isPicked && !isCorrect && ' ✗'}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="anim-rise mt-4 border-t border-line pt-4 text-ink-secondary">
          <p className="font-semibold text-ink">
            {picked === correctIndex
              ? 'Correct — most people don’t believe it.'
              : 'Nope — it’s wilder than that.'}
          </p>
          <div className="mt-1 text-sm md:text-base">{reveal}</div>
        </div>
      )}
    </div>
  );
}
