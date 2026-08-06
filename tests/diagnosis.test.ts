import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { briefFor, percentileOf, median, rate, plainMoney, metricsFor } from '@/lib/diagnosis';
import { alignPair, fmtMoney, fmtMoneyOnGrid, fmtInt } from '@/lib/format';
import districtsJson from '@/data/districts.json';
import baselineJson from '@/data/enrollment-baseline.json';
import levyJson from '@/data/levy.json';

const CODES = districtsJson.districts.map((d) => d.code);

/**
 * Read back a number the site printed.
 *
 * The point of these tests is to check what a reader sees, so they parse the
 * rendered strings rather than the underlying values - a formatter that drops
 * precision has to be caught here, not papered over by comparing floats.
 */
function parsePrinted(s: string): number | null {
  const m = /^(−|-)?\$([\d,.]+)\s*(billion|million|B|M|K)?/.exec(s.trim());
  if (!m) return null;
  let v = parseFloat(m[2].replace(/,/g, ''));
  const unit = m[3];
  if (unit === 'billion' || unit === 'B') v *= 1e9;
  else if (unit === 'million' || unit === 'M') v *= 1e6;
  else if (unit === 'K') v *= 1e3;
  return m[1] ? -v : v;
}

/** Mirrors IssueVisual.tsx `value()` and brief-pdf.ts `visualValue()`. */
function barLabel(n: number, visual: { format: 'money' | 'plain'; step?: number }): string {
  if (visual.format !== 'money') return fmtInt(Math.round(n));
  return visual.step ? fmtMoneyOnGrid(n, visual.step) : fmtMoney(n);
}

describe('alignPair', () => {
  test('puts both amounts and their difference on one grid', () => {
    const p = alignPair(9_895_701, 7_751_484);
    assert.equal(p.a - p.b, p.gap);
    assert.equal(p.a % p.step, 0);
    assert.equal(p.b % p.step, 0);
  });

  test('sizes the grid off the gap, not the bars', () => {
    // A $24k gap between two $1.4M bars: a grid picked off the bars would
    // round the gap away entirely.
    const p = alignPair(1_390_546, 1_366_688);
    assert.ok(p.gap > 0, 'gap must survive rounding');
    assert.ok(
      Math.abs(p.gap - 23_858) / 23_858 < 0.05,
      `gap ${p.gap} drifted more than 5% from 23858`,
    );
  });

  test('keeps the caption close to the true difference', () => {
    for (const [a, b] of [
      [9_895_701, 7_751_484],
      [2_335_841, 947_007],
      [640_409, 273_484],
      [2_216_835, 1_606_915],
      [75_169, 64_976],
    ] as [number, number][]) {
      const p = alignPair(a, b);
      const trueGap = a - b;
      assert.ok(
        Math.abs(p.gap - trueGap) / trueGap < 0.15,
        `${a} - ${b}: shown ${p.gap}, true ${trueGap}`,
      );
    }
  });

  test('handles two equal amounts without dividing by zero', () => {
    const p = alignPair(500, 500);
    assert.equal(p.gap, 0);
    assert.ok(Number.isFinite(p.step));
  });
});

describe('fmtMoneyOnGrid', () => {
  test('keeps the precision the grid established', () => {
    assert.equal(fmtMoneyOnGrid(9_900_000, 1e5), '$9.9M');
    assert.equal(fmtMoneyOnGrid(43_400_000, 1e5), '$43.4M');
  });

  test('steps down a unit rather than losing a digit', () => {
    // $1.39M at a $1,000 grid would need three decimals in millions.
    assert.equal(fmtMoneyOnGrid(1_391_000, 1e3), '$1,391K');
  });

  test('never prints more than two decimals', () => {
    for (const step of [1, 10, 1e2, 1e3, 1e4, 1e5, 1e6]) {
      for (const n of [812, 45_600, 1_391_000, 43_400_000, 2_100_000_000]) {
        const out = fmtMoneyOnGrid(n, step);
        const decimals = /\.(\d+)/.exec(out)?.[1].length ?? 0;
        assert.ok(decimals <= 2, `${out} (n=${n}, step=${step}) has ${decimals} decimals`);
      }
    }
  });

  test('round-trips a grid value without drift', () => {
    for (const step of [1e3, 1e4, 1e5]) {
      for (let k = 11; k < 99; k += 7) {
        const n = k * step;
        assert.equal(parsePrinted(fmtMoneyOnGrid(n, step)), n);
      }
    }
  });
});

describe('every rendered brief', () => {
  /*
    The regression this file exists for. 173 of 256 special-education figures
    once printed two bars that did not subtract to their own caption - the only
    check a reader can perform without leaving the page, failing inside the PDF
    people carry to a legislator. It shipped because the suite asserted PDF
    byte structure and never once asserted a figure.
  */
  test('prints bars that subtract to their own caption', () => {
    let checked = 0;

    for (const code of CODES) {
      const brief = briefFor(code);
      if (!brief) continue;

      for (const issue of brief.issues) {
        const v = issue.visual;
        if (v.kind !== 'versus' || v.step === undefined) continue;
        checked += 1;

        const a = parsePrinted(barLabel(v.a, v));
        const b = parsePrinted(barLabel(v.b, v));
        const gap = parsePrinted(v.gapLabel);
        assert.ok(
          a !== null && b !== null && gap !== null,
          `${code}/${issue.id}: unparseable labels`,
        );

        assert.ok(
          Math.abs((a as number) - (b as number) - (gap as number)) < 0.5,
          `${code}/${issue.id}: printed ${barLabel(v.a, v)} - ${barLabel(v.b, v)} ` +
            `= ${(a as number) - (b as number)}, but the caption reads "${v.gapLabel}"`,
        );
      }
    }

    assert.ok(checked > 300, `expected the corpus to exercise this; only saw ${checked}`);
  });

  test('never states a shortfall of zero', () => {
    for (const code of CODES) {
      const brief = briefFor(code);
      if (!brief) continue;
      for (const issue of brief.issues) {
        const v = issue.visual;
        if (v.kind !== 'versus' || v.step === undefined) continue;
        assert.notEqual(v.a - v.b, 0, `${code}/${issue.id} drew a zero gap`);
      }
    }
  });

  test('agrees with itself: the prose quotes the gap the chart draws', () => {
    /*
      The sentence above each figure restates the shortfall in words. Both come
      from the aligned gap, so a future edit that recomputes one from the raw
      difference has to fail here. Facts may carry other figures too - the levy
      card also names the full levy - so it is enough that one of them matches.
    */
    for (const code of CODES) {
      const brief = briefFor(code);
      if (!brief) continue;
      for (const issue of brief.issues) {
        const v = issue.visual;
        if (v.kind !== 'versus' || v.step === undefined) continue;
        const caption = parsePrinted(v.gapLabel);
        if (caption === null) continue;

        const quoted = (issue.fact.match(/\$[\d,.]+(?:\s*(?:million|billion))?/g) ?? [])
          .map((m) => parsePrinted(m))
          .filter((n): n is number => n !== null);

        assert.ok(
          quoted.some((n) => Math.abs(n - caption) < Math.max(1, v.step! / 2)),
          `${code}/${issue.id}: chart caption reads "${v.gapLabel}" (${caption}) ` +
            `but the sentence quotes ${quoted.join(', ')} — "${issue.fact}"`,
        );
      }
    }
  });

  /*
    Every district's brief text, scanned for the literal failure signature of
    a NaN/Infinity/undefined that leaked past a division-by-zero or a missing
    lookup. diagnosis.ts guards most of these deliberately (rate() returns 0
    on a zero denominator, several fields fall back to null) - this is the
    net that catches the next one that doesn't.
  */
  test('never leaks a NaN, Infinity, or undefined into user-facing text', () => {
    const BAD = /\bNaN\b|\bInfinity\b|\bundefined\b|\bnull\b/;
    for (const code of CODES) {
      const brief = briefFor(code);
      if (!brief) continue;
      const strings = [
        brief.summary,
        brief.emailIssue,
        brief.emailAsk,
        brief.emailFact ?? '',
        brief.steadyNote ?? '',
        ...brief.stats.flatMap((s) => [s.value, s.note]),
        ...brief.issues.flatMap((i) => [i.title, i.fact, i.ask]),
      ];
      for (const s of strings) {
        assert.ok(!BAD.test(s), `${code}: leaked into brief text — "${s}"`);
      }
    }
  });
});

describe('percentileOf', () => {
  test('ranks a value by the share of the list at or below it', () => {
    const sorted = [10, 20, 30, 40, 50];
    assert.equal(percentileOf(sorted, 30), 60); // 3 of 5 <= 30
    assert.equal(percentileOf(sorted, 5), 0); // below everything
    assert.equal(percentileOf(sorted, 50), 100); // at the max
  });

  test('returns 0 for an empty distribution rather than dividing by zero', () => {
    assert.equal(percentileOf([], 42), 0);
  });

  test('a value tied with every entry ranks at the top', () => {
    assert.equal(percentileOf([7, 7, 7, 7], 7), 100);
  });
});

describe('median', () => {
  test('returns the middle value of an odd-length sorted list', () => {
    assert.equal(median([1, 2, 3, 4, 5]), 3);
  });

  test('returns the LOWER of the two middle values on an even-length list', () => {
    // Deliberate: the result is always a value that actually occurs in the
    // data, never an average of two districts that doesn't correspond to any
    // real one.
    assert.equal(median([10, 20, 30, 40]), 20);
  });

  test('returns 0 for an empty list', () => {
    assert.equal(median([]), 0);
  });
});

describe('rate', () => {
  test('computes a plain percentage', () => {
    assert.equal(rate(25, 200), 12.5);
  });

  test('returns 0 on a zero denominator instead of NaN', () => {
    assert.equal(rate(10, 0), 0);
  });

  test('returns 0 on a negative denominator rather than a negative rate', () => {
    assert.equal(rate(10, -5), 0);
  });
});

describe('plainMoney', () => {
  test('spells out millions and billions in words', () => {
    assert.equal(plainMoney(2_500_000_000), '$2.5 billion');
    assert.equal(plainMoney(8_900_000), '$8.9 million');
  });

  test('rounds to whole millions above ten million', () => {
    assert.equal(plainMoney(43_600_000), '$44 million');
  });

  test('does not print the malformed "$1000,000" at the top of the thousands band', () => {
    // Regression: 999,600 used to round to 1000 thousands and get ",000"
    // pasted onto it, printing "$1000,000" instead of stepping up to millions.
    assert.equal(plainMoney(999_600), '$1.0 million');
    assert.equal(plainMoney(999_499), '$999,000');
  });

  test('keeps small amounts exact rather than rounding to a band', () => {
    assert.equal(plainMoney(45_231), '$45,231');
  });

  test('carries the sign through every band', () => {
    assert.equal(plainMoney(-45_231), '-$45,231');
    assert.equal(plainMoney(-8_900_000), '-$8.9 million');
  });
});

describe('metricsFor (buildMetrics edge cases)', () => {
  /*
    315 districts, but enrollment-baseline.json only has 309 and levy.json
    only has 30 fewer than the full set - real gaps in the source data, not a
    hypothetical. buildMetrics has to degrade these to null rather than
    produce a NaN, since `undefined > 0` happens to be false in JS and would
    silently paper over a stricter comparison introduced later.
  */
  const missingBaselineCode = districtsJson.districts.find(
    (d) => !(d.code in baselineJson.districts)
  )?.code;
  const missingLevyCode = districtsJson.districts.find(
    (d) => !(d.code in levyJson.districts)
  )?.code;

  test('a district absent from enrollment-baseline.json gets a null enrollment change, not NaN', () => {
    assert.ok(missingBaselineCode, 'expected at least one district missing a baseline entry');
    const m = metricsFor(missingBaselineCode!);
    assert.ok(m, `expected metrics for ${missingBaselineCode}`);
    assert.equal(m!.enrollmentChange, null);
  });

  test('a district absent from levy.json gets null/zero levy fields, not a throw', () => {
    assert.ok(missingLevyCode, 'expected at least one district missing a levy entry');
    const m = metricsFor(missingLevyCode!);
    assert.ok(m, `expected metrics for ${missingLevyCode}`);
    assert.equal(m!.avPerPupil, null);
    assert.equal(m!.capBlocked, 0);
  });

  test('an unknown district code returns null rather than throwing', () => {
    assert.equal(metricsFor('99999'), null);
  });
});
