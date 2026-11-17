/**
 * Tests for the one-page brief PDF.
 *
 * A malformed PDF fails in the reader, not at build time, so these assert the
 * structural invariants a viewer depends on - chiefly that every xref offset
 * points at the object it claims to. That table is byte offsets into the file,
 * which is exactly the kind of thing that breaks silently when the generator
 * changes and is invisible until someone opens the download.
 *
 * The brief is meant to be one sheet of paper for every district, so the
 * layout is checked against all of them rather than a sample: whether it fits
 * depends on how many problems, delegations and words a district has.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import districtsJson from '@/data/districts.json';
import { briefFor, type DistrictBrief } from '@/lib/diagnosis';
import {
  buildBriefPdf,
  briefFileName,
  measureForTest,
  pdfStringForTest,
  sheetFitForTest,
} from '@/lib/brief-pdf';

const META = {
  year: '2024-25',
  siteUrl: 'https://k12funding.org',
};

const TACOMA = '27010';
const BELLEVUE = '17405';
const SEATTLE = '17001'; // overlaps more legislative districts than fit on the sheet
const STEADY = '06119';
const ENHANCED_OVERSIGHT = '31025'; // Marysville: under oversight, with no response on record
const NO_BIG3 = '37902'; // a school AESD publishes no Big 3 figures for

const ALL_CODES = districtsJson.districts.map((d) => d.code);

async function bytesFor(code: string): Promise<string> {
  const brief = briefFor(code);
  assert.ok(brief, `no brief for ${code}`);
  const blob = buildBriefPdf(brief, META);
  const buffer = await blob.arrayBuffer();
  // Latin-1 so byte offsets and character indices stay in step.
  return Buffer.from(buffer).toString('latin1');
}

type Drawn = { font: 'regular' | 'bold'; size: number; x: number; y: number; text: string };

/** Every piece of text the page draws, with where and in what face. */
function drawnText(pdf: string): Drawn[] {
  return Array.from(
    pdf.matchAll(/BT (\/F[12]) ([\d.]+) Tf 1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm \(((?:[^()\\]|\\.)*)\) Tj ET/g),
    ([, font, size, x, y, body]) => ({
      font: font === '/F2' ? ('bold' as const) : ('regular' as const),
      size: Number(size),
      x: Number(x),
      y: Number(y),
      text: body
        .replace(/\\(\d{3})/g, (_m: string, oct: string) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\(.)/g, '$1'),
    })
  );
}

/** The page's words in drawing order, one space between pieces. */
function readable(pdf: string): string {
  return drawnText(pdf)
    .map((piece) => piece.text)
    .join(' ');
}

describe('brief PDF structure', () => {
  it('emits a well-formed header and trailer', async () => {
    const pdf = await bytesFor(TACOMA);
    assert.ok(pdf.startsWith('%PDF-1.4'));
    assert.ok(pdf.trimEnd().endsWith('%%EOF'));
    assert.ok(pdf.includes('/Type /Catalog'));
    assert.ok(pdf.includes('/Type /Pages'));
  });

  it('points every xref offset at the object it indexes', async () => {
    const pdf = await bytesFor(TACOMA);
    const start = Number(/startxref\s+(\d+)/.exec(pdf)?.[1]);
    assert.ok(Number.isFinite(start), 'no startxref');
    assert.equal(pdf.slice(start, start + 4), 'xref');

    const offsets = Array.from(
      pdf.slice(start).matchAll(/^(\d{10}) 00000 n/gm),
      (m) => Number(m[1])
    );
    assert.ok(offsets.length >= 6);
    offsets.forEach((offset, index) => {
      const id = index + 1;
      assert.ok(
        pdf.startsWith(`${id} 0 obj`, offset),
        `xref entry ${id} points at byte ${offset}, which is not "${id} 0 obj"`
      );
    });
  });

  it('declares a content length matching the actual stream', async () => {
    const pdf = await bytesFor(TACOMA);
    const matches = Array.from(pdf.matchAll(/<< \/Length (\d+) >>\nstream\n/g));
    assert.ok(matches.length > 0);
    for (const match of matches) {
      const declared = Number(match[1]);
      const from = (match.index ?? 0) + match[0].length;
      assert.equal(
        pdf.slice(from + declared, from + declared + 10),
        '\nendstream',
        'declared /Length does not reach exactly to endstream'
      );
    }
  });

  it('uses only the built-in fonts, so nothing needs embedding', async () => {
    const pdf = await bytesFor(TACOMA);
    assert.ok(pdf.includes('/BaseFont /Helvetica'));
    assert.ok(pdf.includes('/BaseFont /Helvetica-Bold'));
    assert.ok(pdf.includes('/Encoding /WinAnsiEncoding'));
    assert.equal(pdf.includes('/FontFile'), false);
  });

  it('is exactly one US Letter page, whatever the district', async () => {
    for (const code of [TACOMA, BELLEVUE, SEATTLE, STEADY, ENHANCED_OVERSIGHT, NO_BIG3]) {
      const pdf = await bytesFor(code);
      assert.equal((pdf.match(/\/Type \/Page\b/g) ?? []).length, 1, `${code} is not one page`);
      assert.ok(pdf.includes('/Count 1'));
      assert.ok(pdf.includes('/MediaBox [0 0 612 792]'));
    }
  });

  it('is small enough to be a reasonable download', async () => {
    const pdf = await bytesFor(SEATTLE);
    assert.ok(pdf.length < 100_000, `unexpectedly large: ${pdf.length} bytes`);
  });
});

describe('brief PDF fits on one sheet for every district', () => {
  it('lays all 315 out above the footer, nearly all without dropping anything', () => {
    const dropped: string[] = [];
    for (const code of ALL_CODES) {
      const fit = sheetFitForTest(code, META);
      assert.ok(fit, `no sheet for ${code}`);
      assert.ok(
        fit.fits,
        `${code} does not fit: content ends at ${fit.bottom.toFixed(1)}pt, limit ${fit.limit.toFixed(1)}pt`
      );
      if (fit.attempt > 0) dropped.push(code);
    }
    // Leaving out the spoken message or the trend chart is the designed
    // fallback, but it should be the exception, not how the sheet usually looks.
    assert.ok(
      dropped.length <= ALL_CODES.length * 0.05,
      `${dropped.length} districts had to drop something: ${dropped.slice(0, 10).join(', ')}`
    );
  });

  it('keeps every drawn word inside the page margins, for every district', async () => {
    /*
      The whole point of the metrics table: if a width is wrong, text runs off
      the page and the reader gives no warning. Re-measure each drawn word from
      its own font, size and x-position.
    */
    const LEFT_EDGE = 36 - 0.5;
    const RIGHT_EDGE = 612 - 36 + 0.5; // page width less the margin, with rounding slack
    for (const code of ALL_CODES) {
      const words = drawnText(await bytesFor(code));
      assert.ok(words.length > 80, `${code}: expected many drawn words, saw ${words.length}`);
      for (const word of words) {
        const right = word.x + measureForTest(word.text, word.font, word.size);
        assert.ok(
          word.x >= LEFT_EDGE && right <= RIGHT_EDGE,
          `${code}: "${word.text.slice(0, 40)}" spans ${word.x.toFixed(1)}-${right.toFixed(1)}pt, outside ${LEFT_EDGE}-${RIGHT_EDGE}`
        );
      }
    }
  });
});

describe('brief PDF content', () => {
  it('carries the district name, headline numbers and the Big 3', async () => {
    const text = readable(await bytesFor(TACOMA));
    for (const expected of [
      'WA SCHOOL FUNDING EXPLORER',
      'Tacoma School District',
      '$21,092', // revenue per student, from the District Explorer
      'Where the money comes from',
      'Revenue per student, six years',
      'funding gaps',
      '$2.56M', // transportation, as AESD's dashboard prints it
      'Covered by its funding', // special education
      'Where funding fell short',
    ]) {
      assert.ok(text.includes(expected), `missing "${expected}"`);
    }
  });

  it('asks lawmakers for something, and says who they are', async () => {
    const text = readable(await bytesFor(TACOMA));
    for (const expected of [
      'ASK',
      'Raise the local levy cap.',
      'Yasmin Trudeau',
      'Laurie Jinkins',
      '27th District',
      'app.leg.wa.gov/DistrictFinder',
      'SAY IT IN THIRTY SECONDS',
      'I live in Tacoma.',
    ]) {
      assert.ok(text.includes(expected), `missing "${expected}"`);
    }
  });

  it('names the districts that do not fit when a district spans many', async () => {
    const text = readable(await bytesFor(SEATTLE));
    assert.ok(/also overlaps \d+ more legislative districts/.test(text), 'no pointer to the rest');
  });

  it('omits the Big 3 and the delegation grid where there is nothing to show', async () => {
    const text = readable(await bytesFor(NO_BIG3));
    assert.equal(text.includes('funding gaps'), false);
    assert.equal(text.includes('Who to ask'), false);
    // The address-lookup advice stays: it is what makes the sheet useful.
    assert.ok(text.includes('app.leg.wa.gov/DistrictFinder'));
  });

  it('prints what the district has already done, where that is on record', async () => {
    // Bellevue is the one district under oversight with a recorded response.
    const text = readable(await bytesFor(BELLEVUE));
    assert.ok(text.includes('Already done:'));
    // And not where there is none: Marysville is under oversight without one.
    assert.equal(readable(await bytesFor(ENHANCED_OVERSIGHT)).includes('Already done:'), false);
  });

  it('sets punctuation against the word it follows, with no stray space', async () => {
    const words = drawnText(await bytesFor(TACOMA));
    const index = words.findIndex((w) => w.text === 'leg.wa.gov/legislators');
    assert.ok(index >= 0, 'contact line not found');
    const word = words[index];
    const next = words[index + 1];
    assert.equal(next.text, '.');
    const expectedX = word.x + measureForTest(word.text, word.font, word.size);
    assert.ok(
      Math.abs(next.x - expectedX) < 0.05,
      `period sits ${(next.x - expectedX).toFixed(2)}pt from "legislators"`
    );
  });

  it('keeps a space between a bold label and the sentence after it', async () => {
    // Pieces that touch across a change of style are joined with no space, so a
    // label has to carry its own: "Ask:Pay the real cost" ran together before.
    for (const code of [TACOMA, BELLEVUE]) {
      const words = drawnText(await bytesFor(code));
      const labels = words.filter((w) => w.text === 'Ask:' || w.text === 'Already done:');
      assert.ok(labels.length > 0, `${code}: no labels found`);
      for (const label of labels) {
        const next = words[words.indexOf(label) + 1];
        const end = label.x + measureForTest(label.text, label.font, label.size);
        assert.ok(
          next.x - end > 1,
          `${code}: "${label.text}" runs into "${next.text}" (${(next.x - end).toFixed(2)}pt apart)`
        );
      }
    }
  });

  it('escapes parentheses so they cannot terminate a PDF string early', async () => {
    // The transportation ask carries a bill number in parentheses.
    const pdf = await bytesFor(TACOMA);
    assert.ok(pdf.includes('\\(SB'), 'expected an escaped parenthesis');
    // A bare "(" inside a drawn string would break the content stream.
    for (const match of Array.from(pdf.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g))) {
      assert.equal(
        /(^|[^\\])[()]/.test(match[1]),
        false,
        `unescaped parenthesis in drawn text: ${match[1].slice(0, 60)}`
      );
    }
  });

  it('encodes non-ASCII as WinAnsi octal rather than raw UTF-8', () => {
    /*
      A raw multi-byte character would shift every byte offset in the xref
      table and break the file. WinAnsi 146 (a right single quote) is octal
      222; 151 (an em dash) is 227.
    */
    assert.equal(pdfStringForTest('district’s'), 'district\\222s');
    assert.equal(pdfStringForTest('a—b'), 'a\\227b');
    // Outside WinAnsi entirely: degrade, never emit a raw byte.
    assert.equal(pdfStringForTest('中'), ' ');
  });

  it('escapes the characters that would terminate a PDF string', () => {
    assert.equal(pdfStringForTest('a(b)c'), 'a\\(b\\)c');
    assert.equal(pdfStringForTest('a\\b'), 'a\\\\b');
  });

  it('measures bold curly quotes at their real width', () => {
    // A bold closing quote is 500 units, not the regular face's 333; measuring
    // it narrow ran the next word into the quote mark in the Big 3 heading.
    assert.ok(measureForTest('”', 'bold', 10) > measureForTest('”', 'regular', 10));
    assert.equal(measureForTest('”', 'bold', 10), 5);
  });

  it('never writes a byte above the ASCII range', async () => {
    // The invariant behind the xref table: one character, one byte.
    for (const code of [TACOMA, BELLEVUE, SEATTLE, STEADY, ENHANCED_OVERSIGHT, NO_BIG3]) {
      const pdf = await bytesFor(code);
      const offending = pdf.search(/[^\x00-\x7E]/);
      assert.equal(
        offending,
        -1,
        `high byte at ${offending} in the ${code} brief: ${JSON.stringify(pdf.slice(offending - 20, offending + 20))}`
      );
    }
  });
});

describe('brief PDF filename', () => {
  it('is the district name itself', () => {
    const brief = briefFor(BELLEVUE);
    assert.ok(brief);
    assert.equal(briefFileName(brief), 'Bellevue School District.pdf');
  });

  it('replaces characters a file name cannot hold', () => {
    const named = (name: string) => briefFileName({ name } as DistrictBrief);
    assert.equal(
      named('Impact | Black River Elementary'),
      'Impact - Black River Elementary.pdf'
    );
    assert.equal(named('Summit Public School: Atlas'), 'Summit Public School - Atlas.pdf');
    assert.equal(named('Mt. Baker School District'), 'Mt. Baker School District.pdf');
    assert.equal(named('  Odd / name.  '), 'Odd - name.pdf');
  });
});
