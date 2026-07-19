'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtInt, fmtMoney, fmtMoneyFull } from '@/lib/format';

const FORMATS = {
  money: (v: number) => fmtMoney(v),
  moneyFull: (v: number) => fmtMoneyFull(Math.round(v)),
  int: (v: number) => fmtInt(Math.round(v)),
  plain: (v: number) => String(Math.round(v)),
} as const;

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
  const format = FORMATS[kind];

  useEffect(() => {
    const el = ref.current;
    if (!el || started.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        io.disconnect();
        const t0 = performance.now();
        const dur = 1100;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(value * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return <span ref={ref}>{format(display)}</span>;
}
