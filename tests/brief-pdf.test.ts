/**
 * Tests for the brief PDF writer.
 *
 * A malformed PDF fails in the reader, not at build time, so these assert the
 * structural invariants a viewer depends on - chiefly that every xref offset
 * points at the object it claims to. That table is byte offsets into the file,
 * which is exactly the kind of thing that breaks silently when the generator
 * changes and is invisible until someone opens the download.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { briefFor } from '@/lib/diagnosis';
import { buildBriefPdf, briefFileName } from '@/lib/brief-pdf';

const META = {
  year: '2024-25',
  siteUrl: 'https://kwasant7.github.io/wa-school-funding-explorer',
};

// Bellevue has four issues and spills to a second page; Battle Ground scores
// no outlier and takes the short single-page path.
const BELLEVUE = '17405';
const STEADY = '06119';
// Marysville is the enhanced-oversight case, whose section title carries the
// corpus's only curly apostrophe.
const ENHANCED_OVERSIGHT = '31025';

async function bytesFor(code: string): Promise<string> {
  const brief = briefFor(code);
  assert.ok(brief, `no brief for ${code}`);
  const blob = buildBriefPdf(brief, META);
  const buffer = await blob.arrayBuffer();
  // Latin-1 so byte offsets and character indices stay in step.
  return Buffer.from(buffer).toString('latin1');
}

describe('brief PDF structure', () => {
  it('emits a well-formed header and trailer', async () => {
    const pdf = await bytesFor(BELLEVUE);
    assert.ok(pdf.startsWith('%PDF-1.4'));
    assert.ok(pdf.trimEnd().endsWith('%%EOF'));
    assert.ok(pdf.includes('/Type /Catalog'));
    assert.ok(pdf.includes('/Type /Pages'));
  });

  it('points every xref offset at the object it indexes', async () => {
    const pdf = await bytesFor(BELLEVUE);
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
    const pdf = await bytesFor(BELLEVUE);
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
    const pdf = await bytesFor(BELLEVUE);
    assert.ok(pdf.includes('/BaseFont /Helvetica'));
    assert.ok(pdf.includes('/BaseFont /Helvetica-Bold'));
    assert.ok(pdf.includes('/Encoding /WinAnsiEncoding'));
    assert.equal(pdf.includes('/FontFile'), false);
  });

  it('paginates: a four-issue brief runs long, a steady one does not', async () => {
    const long = await bytesFor(BELLEVUE);
    const short = await bytesFor(STEADY);
    const count = (pdf: string) => (pdf.match(/\/Type \/Page\b/g) ?? []).length;
    assert.ok(count(long) >= 2, 'expected the full brief to need more than one page');
    assert.equal(count(short), 1);
    assert.ok(/\/Count (\d+)/.test(long));
  });

  it('is small enough to be a reasonable download', async () => {
    const pdf = await bytesFor(BELLEVUE);
    assert.ok(pdf.length < 60_000, `unexpectedly large: ${pdf.length} bytes`);
  });
});

describe('brief PDF content', () => {
  it('carries the district name and headline into the file', async () => {
    const pdf = await bytesFor(BELLEVUE);
    assert.ok(pdf.includes('Bellevue School District'));
    assert.ok(pdf.includes('THE ASK'));
    assert.ok(pdf.includes('WA SCHOOL FUNDING EXPLORER'));
  });

  it('escapes parentheses so they cannot terminate a PDF string early', async () => {
    const pdf = await bytesFor(BELLEVUE);
    // The oversight bullet cites "(RCW 28A.505.110)".
    assert.ok(pdf.includes('\\(RCW 28A.505.110\\)'));
    // A bare "(" inside a drawn string would break the content stream.
    for (const match of Array.from(pdf.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g))) {
      assert.equal(
        /(^|[^\\])[()]/.test(match[1]),
        false,
        `unescaped parenthesis in drawn text: ${match[1].slice(0, 60)}`
      );
    }
  });

  it('encodes a curly apostrophe as its WinAnsi octal, not raw UTF-8', async () => {
    /*
      Marysville is under enhanced oversight, and that section's title is the
      one string in the corpus carrying a curly apostrophe (U+2019). WinAnsi
      146 is octal 222; emitting the character raw would be multi-byte UTF-8
      and would shift every subsequent byte offset in the xref table.
    */
    const pdf = await bytesFor(ENHANCED_OVERSIGHT);
    assert.ok(pdf.includes('district\\222s'), 'expected an octal-escaped U+2019');
    assert.equal(pdf.includes('’'), false, 'raw U+2019 would corrupt byte offsets');
  });

  it('never writes a byte above the ASCII range', async () => {
    // The invariant behind the xref table: one character, one byte.
    for (const code of [BELLEVUE, STEADY, ENHANCED_OVERSIGHT]) {
      const pdf = await bytesFor(code);
      const offending = pdf.search(/[^\x00-\x7E]/);
      assert.equal(
        offending,
        -1,
        `high byte at ${offending} in the ${code} brief: ${JSON.stringify(pdf.slice(offending - 20, offending + 20))}`
      );
    }
  });

  it('keeps every drawn line inside the printable column', async () => {
    /*
      The whole point of the metrics table: if a width is wrong, text runs off
      the page and the reader gives no warning. Re-measure each drawn string
      from its own font, size and x-position.
    */
    const pdf = await bytesFor(BELLEVUE);
    const drawn = Array.from(
      pdf.matchAll(/BT (\/F[12]) ([\d.]+) Tf 1 0 0 1 ([\d.]+) [\d.]+ Tm \(((?:[^()\\]|\\.)*)\) Tj ET/g)
    );
    assert.ok(drawn.length > 40, `expected many drawn strings, saw ${drawn.length}`);

    const { measureForTest } = (await import('@/lib/brief-pdf')) as unknown as {
      measureForTest: (t: string, f: 'regular' | 'bold', s: number) => number;
    };

    const RIGHT_EDGE = 612 - 54 + 0.5; // page width less the margin, with rounding slack
    for (const [, font, size, x, body] of drawn) {
      const text = body
        .replace(/\\(\d{3})/g, (_m: string, oct: string) =>
          String.fromCharCode(parseInt(oct, 8))
        )
        .replace(/\\(.)/g, '$1');
      const right = Number(x) + measureForTest(text, font === '/F2' ? 'bold' : 'regular', Number(size));
      assert.ok(
        right <= RIGHT_EDGE,
        `line overflows the margin by ${(right - RIGHT_EDGE).toFixed(1)}pt: "${text.slice(0, 60)}"`
      );
    }
  });
});

describe('brief PDF filename', () => {
  it('is filesystem-safe and identifies the district and year', () => {
    const brief = briefFor(BELLEVUE);
    assert.ok(brief);
    assert.equal(
      briefFileName(brief, '2024-25'),
      'bellevue-school-district-brief-2024-25.pdf'
    );
  });

  it('handles a district name with punctuation', () => {
    const seattle = briefFor('17001');
    assert.ok(seattle);
    const name = briefFileName(seattle, '2024-25');
    assert.match(name, /^[a-z0-9-]+\.pdf$/);
  });
});
