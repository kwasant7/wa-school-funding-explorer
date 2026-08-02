'use client';

/**
 * An answer that arrives a few words at a time rather than all at once.
 *
 * The reply is one validated JSON object - the Worker cannot hand over half an
 * answer, because Structured Outputs only guarantees the shape of a finished
 * one. So this is a reveal, not a stream: the text is already here, and what
 * is animated is how much of it is on screen. That difference is invisible to
 * a reader and it is the only honest way to get the familiar behaviour without
 * giving up the validation that stops a malformed answer rendering at all.
 *
 * It matters because an answer that appears complete in a single frame reads
 * as a page that jumped, not as something replying to you - the panel's height
 * changes between one frame and the next and the eye has nowhere to land.
 */
import { useEffect, useRef, useState } from 'react';
import { renderMarkdown } from '@/lib/assistant/markdown';

/**
 * Reveal rate. Fast enough not to make anyone wait on text that has already
 * arrived, slow enough to read as typing: a 200-character answer lands in
 * about 1.4s and nothing takes longer than the ceiling however long it runs.
 */
const MS_PER_CHAR = 7;
const MIN_DURATION_MS = 350;
const MAX_DURATION_MS = 2_200;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Markdown that is mid-word is still markdown, and a half-typed `**bold`
 * would show its asterisks for a frame or two before the closing pair
 * arrived. Dropping a trailing run of marker characters costs nothing and
 * keeps the punctuation of the source out of the reader's way.
 */
function trimPartialMarkup(text: string): string {
  return text.replace(/[*_`[\]()#-]+$/, '');
}

export default function RevealedText({
  text,
  animate,
  onReveal,
  onDone,
}: {
  text: string;
  /** False for restored history and for every turn but the newest. */
  animate: boolean;
  /** Called as the visible text grows, so the panel can stay scrolled down. */
  onReveal?: () => void;
  /** Called once the whole answer is on screen. */
  onDone?: (done: boolean) => void;
}) {
  const [shown, setShown] = useState(() => (animate ? 0 : text.length));
  const onRevealRef = useRef(onReveal);
  const onDoneRef = useRef(onDone);
  onRevealRef.current = onReveal;
  onDoneRef.current = onDone;

  useEffect(() => {
    /*
      A hidden tab gets no animation frames at all, so an answer that arrives
      while the visitor is looking at something else would sit at zero
      characters until they came back - a blank bubble where the reply is.
      There is nobody watching an animation in that case anyway, so the whole
      answer simply goes up at once.
    */
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (!animate || hidden || prefersReducedMotion()) {
      setShown(text.length);
      return;
    }

    const duration = Math.min(
      MAX_DURATION_MS,
      Math.max(MIN_DURATION_MS, text.length * MS_PER_CHAR)
    );
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setShown(Math.round(progress * text.length));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    /*
      Backstop. The tab can be hidden *after* this starts, which pauses the
      frame loop wherever it had got to. A timer is throttled in the
      background but it still fires, so the answer can never be left half
      written - the failure mode that matters here is losing text, not
      finishing the animation early.
    */
    const backstop = setTimeout(() => setShown(text.length), duration + 500);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(backstop);
    };
  }, [text, animate]);

  const done = shown >= text.length;

  // Reported through refs so a parent that re-renders on either signal cannot
  // restart the animation by handing over new callback identities.
  useEffect(() => {
    onRevealRef.current?.();
  }, [shown]);
  useEffect(() => {
    onDoneRef.current?.(done);
  }, [done]);

  const visible = done ? text : trimPartialMarkup(text.slice(0, shown));

  return <div className="space-y-2.5">{renderMarkdown(visible)}</div>;
}
