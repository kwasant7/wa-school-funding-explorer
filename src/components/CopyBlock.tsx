'use client';

import { useRef, useState } from 'react';

type CopyState = 'idle' | 'copied' | 'select';

export default function CopyBlock({ title, text }: { title: string; text: string }) {
  const [state, setState] = useState<CopyState>('idle');
  const preRef = useRef<HTMLPreElement>(null);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
    }
    if (ok) {
      setState('copied');
    } else if (preRef.current) {
      // Clipboard blocked - select the text so the user can copy manually
      const range = document.createRange();
      range.selectNodeContents(preRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      setState('select');
    }
    setTimeout(() => setState('idle'), 2500);
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-line bg-paper">
        <span className="text-sm font-semibold">{title}</span>
        <button
          onClick={copy}
          className={`text-sm font-medium px-3 py-1 rounded-md border transition-colors ${
            state === 'copied'
              ? 'bg-good text-white border-good'
              : 'text-accent border-line hover:border-accent'
          }`}
        >
          {state === 'copied'
            ? '✓ Copied'
            : state === 'select'
              ? 'Press ⌘C / Ctrl+C'
              : 'Copy'}
        </button>
      </div>
      <pre
        ref={preRef}
        className="px-4 py-4 text-sm whitespace-pre-wrap font-sans text-ink-secondary leading-relaxed"
      >
        {text}
      </pre>
    </div>
  );
}
