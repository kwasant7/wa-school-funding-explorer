'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtInt, fmtMoney, fmtMoneyFull } from '@/lib/format';

const FORMATS = {
  money: (v: number) => fmtMoney(v),
  moneyFull: (v: number) => fmtMoneyFull(Math.round(v)),
  int: (v: number) => fmtInt(Math.round(v)),
  plain: (v: number) => String(Math.round(v)),
} as const;

const DURATION = 1100;

/** Animates a number from 0 to `value` the first time it scrolls into view. */
export default function CountUp({
  value,
  kind = 'int',
}: {
  value: number;
  kind?: keyof typeof FORMATS;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const started = useRef(false);
  const mounted = useRef(false);
  const format = FORMATS[kind];
  // The animation reads the newest value rather than the one captured when the
  // observer was created, so a value that changes mid-flight still lands right.
  const valueRef = useRef(value);
  valueRef.current = value;

  /*
    After the intro animation has run, `started` stays true forever - so a
    later change to `value` (switching school year) used to be ignored
    entirely, leaving the old figure on screen under a new year's label.
    Replaying the count-up on every switch would be noise, so the number just
    updates in place.
  */
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setDisplay(value);
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el || started.current) return;
    // Reduced motion: keep the real figure on screen, never animate it.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let settle: ReturnType<typeof setTimeout>;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        io.disconnect();
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / DURATION);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(valueRef.current * eased);
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        // Browsers pause requestAnimationFrame while a tab is hidden. Without
        // this backstop, switching tabs mid-animation leaves the number frozen
        // partway - showing, say, $4.5B for a $21.0B total - and it never
        // recovers, because the observer has already disconnected. Timers are
        // throttled in background tabs but still fire, so the true value lands
        // either way.
        settle = setTimeout(() => {
          cancelAnimationFrame(frame);
          setDisplay(valueRef.current);
        }, DURATION + 150);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [value]);

  return <span ref={ref}>{format(display)}</span>;
}
