/**
 * Renders a district brief to a real PDF, in the browser, with no dependency.
 *
 * Why hand-rolled rather than jsPDF or html2canvas:
 *
 * - A canvas-based export rasterises the page. The result is a picture of
 *   text - unsearchable, unselectable, and unreadable to a screen reader. This
 *   brief exists to be taken to a legislator's office, so the text has to
 *   survive the trip.
 * - jsPDF is ~150KB gzipped for what is, here, a single column of prose. This
 *   page was deliberately trimmed from 439kB to 211kB; adding most of that
 *   back for an occasional download would undo it.
 *
 * The brief is structured text and a few rules, which is close to the simplest
 * thing PDF can express. Using the standard Type 1 fonts (Helvetica), which
 * every reader has built in, means no font embedding and no binary handling -
 * the whole file is generated as a string. Text stays selectable, searchable
 * and copyable.
 *
 * The tradeoff is that the standard fonts are limited to WinAnsi (Latin-1).
 * That is sufficient because the brief's own text is English - see the note on
 * translation coverage in the README. Characters outside WinAnsi degrade to a
 * sensible ASCII equivalent rather than corrupting the file.
 */
import type { DistrictBrief } from '@/lib/diagnosis';

/* ------------------------------------------------------------------ *
 * Font metrics
 * ------------------------------------------------------------------ */

/**
 * Adobe's published Helvetica widths for codes 32-126, in 1/1000 em.
 *
 * These have to be the real values, not estimates: the viewer lays the text
 * out with them, so a wrong table means lines that overflow the margin or wrap
 * short of it, and there is no reflow to hide the error.
 */
// prettier-ignore
const HELVETICA = [
  278,278,355,556,556,889,667,222,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
  1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
  667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
  222,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
  556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,
];
// prettier-ignore
const HELVETICA_BOLD = [
  278,333,474,556,556,889,722,278,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
  975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,
  667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
  278,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,
  611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,
];

/** Widths for the WinAnsi high range this document can actually produce. */
const HIGH_WIDTHS: Record<number, number> = {
  133: 1000, // ellipsis
  145: 222, // left single quote
  146: 222, // right single quote
  147: 333, // left double quote
  148: 333, // right double quote
  149: 350, // bullet
  150: 556, // en dash
  151: 1000, // em dash
  183: 278, // middle dot
  215: 584, // multiply
};

/**
 * Unicode to WinAnsi. Anything outside the map falls back to an ASCII
 * lookalike so a stray character degrades the typography rather than the file.
 */
const WIN_ANSI: Record<string, number> = {
  '‘': 145,
  '’': 146,
  '“': 147,
  '”': 148,
  '•': 149,
  '–': 150,
  '—': 151,
  '…': 133,
  '·': 183,
  '×': 215,
  '−': 45, // true minus renders as hyphen
  ' ': 32,
  '→': 45,
  '↑': 94,
  '↓': 118,
  '≈': 126,
  '÷': 247,
};

type FontName = 'regular' | 'bold';

function codeFor(char: string): number {
  const point = char.charCodeAt(0);
  if (point >= 32 && point <= 126) return point;
  const mapped = WIN_ANSI[char];
  if (mapped !== undefined) return mapped;
  // Unknown: a space is less disruptive in a printed brief than a black box.
  return 32;
}

function charWidth(code: number, font: FontName): number {
  if (code >= 32 && code <= 126) {
    return (font === 'bold' ? HELVETICA_BOLD : HELVETICA)[code - 32];
  }
  return HIGH_WIDTHS[code] ?? 556;
}

function measure(text: string, font: FontName, size: number): number {
  let total = 0;
  for (const char of text) total += charWidth(codeFor(char), font);
  return (total * size) / 1000;
}

/**
 * Exposed for the overflow test, which re-measures every drawn line to prove
 * none of them runs past the margin. Nothing in the app should call this.
 */
export const measureForTest = measure;

/** Escape for a PDF literal string, emitting WinAnsi bytes as octal. */
function pdfString(text: string): string {
  let out = '';
  for (const char of text) {
    const code = codeFor(char);
    if (code === 40 || code === 41 || code === 92) out += `\\${char}`;
    else if (code < 32 || code > 126) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(code);
  }
  return out;
}

/** Greedy wrap. Words longer than the column are hard-broken rather than bleeding out. */
function wrap(text: string, font: FontName, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, font, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);

    if (measure(word, font, size) <= maxWidth) {
      line = word;
      continue;
    }
    let chunk = '';
    for (const char of word) {
      if (measure(chunk + char, font, size) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/* ------------------------------------------------------------------ *
 * Document builder
 * ------------------------------------------------------------------ */

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 66; // room for the footer rule and caption

// The site's palette, converted to PDF's 0-1 RGB.
const INK = [0.043, 0.043, 0.043] as const;
const INK_SECONDARY = [0.322, 0.318, 0.306] as const;
const INK_MUTED = [0.537, 0.529, 0.506] as const;
const ACCENT = [0.145, 0.416, 0.749] as const;
const ACCENT_DEEP = [0.063, 0.259, 0.506] as const;
const LINE = [0.882, 0.878, 0.851] as const;
const WASH = [0.933, 0.957, 0.984] as const;

type Rgb = readonly [number, number, number];

class Pdf {
  private pages: string[] = [];
  private ops: string[] = [];
  y = PAGE_H - MARGIN;

  private push(op: string) {
    this.ops.push(op);
  }

  private colour(rgb: Rgb) {
    this.push(`${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`);
  }

  /** Start a new page, carrying nothing over. */
  newPage() {
    this.pages.push(this.ops.join('\n'));
    this.ops = [];
    this.y = PAGE_H - MARGIN;
  }

  /** Break before drawing if `needed` points will not fit. */
  ensure(needed: number) {
    if (this.y - needed < BOTTOM) this.newPage();
  }

  text(
    content: string,
    options: {
      x?: number;
      size?: number;
      font?: FontName;
      colour?: Rgb;
      leading?: number;
      width?: number;
    } = {}
  ) {
    const {
      x = MARGIN,
      size = 10,
      font = 'regular',
      colour = INK_SECONDARY,
      leading = size * 1.42,
      width = CONTENT_W - (x - MARGIN),
    } = options;

    const fontRef = font === 'bold' ? '/F2' : '/F1';
    for (const line of wrap(content, font, size, width)) {
      this.ensure(leading);
      this.colour(colour);
      this.push(`BT ${fontRef} ${size} Tf 1 0 0 1 ${x} ${(this.y - size).toFixed(2)} Tm (${pdfString(line)}) Tj ET`);
      this.y -= leading;
    }
  }

  rect(x: number, y: number, w: number, h: number, colour: Rgb) {
    this.colour(colour);
    this.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  rule(colour: Rgb = LINE, inset = 0) {
    this.ensure(10);
    this.rect(MARGIN + inset, this.y, CONTENT_W - inset, 0.7, colour);
    this.y -= 10;
  }

  gap(points: number) {
    this.y -= points;
  }

  /**
   * Finish the document. Footers are stamped here, once the total page count
   * is known, so "Page 2 of 3" can be honest.
   */
  build(footerLeft: string): Blob {
    this.pages.push(this.ops.join('\n'));
    this.ops = [];

    const total = this.pages.length;
    const streams = this.pages.map((content, index) => {
      const footer: string[] = [];
      const y = MARGIN - 16;
      footer.push(
        `${LINE[0].toFixed(3)} ${LINE[1].toFixed(3)} ${LINE[2].toFixed(3)} rg`,
        `${MARGIN} ${y + 14} ${CONTENT_W} 0.7 re f`,
        `${INK_MUTED[0].toFixed(3)} ${INK_MUTED[1].toFixed(3)} ${INK_MUTED[2].toFixed(3)} rg`,
        `BT /F1 7.5 Tf 1 0 0 1 ${MARGIN} ${y} Tm (${pdfString(footerLeft)}) Tj ET`
      );
      const label = `Page ${index + 1} of ${total}`;
      const labelX = PAGE_W - MARGIN - measure(label, 'regular', 7.5);
      footer.push(`BT /F1 7.5 Tf 1 0 0 1 ${labelX.toFixed(2)} ${y} Tm (${pdfString(label)}) Tj ET`);
      return `${content}\n${footer.join('\n')}`;
    });

    /*
      Objects: 1 catalog, 2 page tree, 3-4 fonts, then a page and a content
      stream per page. The xref table needs each object's byte offset, so the
      body is assembled while the offsets are recorded.
    */
    const objects: string[] = [];
    const pageIds = streams.map((_, index) => 5 + index * 2);

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${total} >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    streams.forEach((stream, index) => {
      const pageId = pageIds[index];
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
      objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    let body = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = body.length;
      body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }

    const xrefOffset = body.length;
    let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) {
      xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    body += `${xref}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    // Latin-1 preserves the octal-escaped WinAnsi bytes exactly; UTF-8 would
    // re-encode them and break every byte offset in the xref table.
    const bytes = new Uint8Array(body.length);
    for (let i = 0; i < body.length; i += 1) bytes[i] = body.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: 'application/pdf' });
  }
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

function statBoxes(pdf: Pdf, stats: DistrictBrief['stats']) {
  const columns = 2;
  const gutter = 12;
  const boxW = (CONTENT_W - gutter * (columns - 1)) / columns;

  for (let i = 0; i < stats.length; i += columns) {
    const row = stats.slice(i, i + columns);
    // Height is driven by the tallest note in the row so the boxes align.
    const noteLines = Math.max(
      ...row.map((stat) => wrap(stat.note, 'regular', 7.5, boxW - 16).length)
    );
    const boxH = 48 + noteLines * 10;
    pdf.ensure(boxH + 8);

    const top = pdf.y;
    row.forEach((stat, column) => {
      const x = MARGIN + column * (boxW + gutter);
      pdf.rect(x, top - boxH, boxW, boxH, [0.988, 0.988, 0.984]);
      pdf.rect(x, top - boxH, boxW, 0.7, LINE);
      pdf.rect(x, top, boxW, 0.7, LINE);
      pdf.rect(x, top - boxH, 0.7, boxH, LINE);
      pdf.rect(x + boxW - 0.7, top - boxH, 0.7, boxH, LINE);

      pdf.y = top - 8;
      pdf.text(stat.label, { x: x + 8, size: 8, colour: INK_SECONDARY, width: boxW - 16, leading: 11 });
      pdf.text(stat.value, { x: x + 8, size: 15, font: 'bold', colour: INK, width: boxW - 16, leading: 19 });
      pdf.text(stat.note, { x: x + 8, size: 7.5, colour: INK_MUTED, width: boxW - 16, leading: 10 });
    });

    pdf.y = top - boxH - 8;
  }
}

function issueSection(pdf: Pdf, issue: DistrictBrief['issues'][number], index: number) {
  // Keep the number, title and at least the headline together; a section that
  // starts one line above a page break reads as an orphan.
  pdf.ensure(72);
  pdf.gap(6);

  const badgeSize = 15;
  const badgeTop = pdf.y;
  pdf.rect(MARGIN, badgeTop - badgeSize, badgeSize, badgeSize, ACCENT);

  /*
    Optically centre the numeral. Text is positioned by its baseline, not its
    box, so placing the baseline at the badge's midpoint sits the digit high -
    all of its mass is above the baseline. Digits reach cap height (0.717 em in
    Helvetica) and nothing descends, so the baseline belongs one cap-height's
    worth up from the bottom inset.
  */
  const numeralSize = 9;
  const capHeight = numeralSize * 0.717;
  const numeral = String(index + 1);
  const numeralX = MARGIN + (badgeSize - measure(numeral, 'bold', numeralSize)) / 2;
  pdf.y = badgeTop - (badgeSize - capHeight) / 2 + numeralSize - capHeight;
  pdf.text(numeral, {
    x: numeralX,
    size: numeralSize,
    font: 'bold',
    colour: [1, 1, 1],
    width: badgeSize,
    leading: 0,
  });

  pdf.y = badgeTop;
  const indent = MARGIN + badgeSize + 9;
  pdf.text(issue.title, {
    x: indent,
    size: 11.5,
    font: 'bold',
    colour: INK,
    width: CONTENT_W - (indent - MARGIN),
    leading: 14.5,
  });
  pdf.gap(2);
  pdf.text(issue.headline, {
    x: indent,
    size: 9.5,
    colour: INK_SECONDARY,
    width: CONTENT_W - (indent - MARGIN),
    leading: 13,
  });
  pdf.gap(6);

  for (const bullet of issue.bullets) {
    pdf.ensure(16);
    const bulletTop = pdf.y;
    pdf.rect(indent + 1, bulletTop - 7, 2.5, 2.5, ACCENT);
    pdf.y = bulletTop;
    pdf.text(bullet, {
      x: indent + 10,
      size: 9,
      colour: INK_SECONDARY,
      width: CONTENT_W - (indent + 10 - MARGIN),
      leading: 12.4,
    });
    pdf.gap(3);
  }

  // "The ask" panel. Measured before drawing so the wash sits behind the text.
  const askWidth = CONTENT_W - (indent - MARGIN) - 20;
  const askLines = wrap(issue.ask, 'regular', 9, askWidth).length;
  const refLines = issue.refs.reduce(
    (sum, ref) => sum + wrap(`${ref.bill} - ${ref.note}`, 'regular', 7.5, askWidth).length,
    0
  );
  const askH = 26 + askLines * 12.4 + (refLines > 0 ? 6 + refLines * 10 : 0);

  pdf.gap(4);
  pdf.ensure(askH + 6);
  const askTop = pdf.y;
  pdf.rect(indent, askTop - askH, CONTENT_W - (indent - MARGIN), askH, WASH);
  pdf.rect(indent, askTop - askH, 2.5, askH, ACCENT);

  pdf.y = askTop - 9;
  pdf.text('THE ASK', {
    x: indent + 10,
    size: 7.5,
    font: 'bold',
    colour: ACCENT_DEEP,
    width: askWidth,
    leading: 11,
  });
  pdf.text(issue.ask, { x: indent + 10, size: 9, colour: INK, width: askWidth, leading: 12.4 });

  if (issue.refs.length > 0) {
    pdf.gap(3);
    for (const ref of issue.refs) {
      pdf.text(`${ref.bill} - ${ref.note}`, {
        x: indent + 10,
        size: 7.5,
        colour: INK_SECONDARY,
        width: askWidth,
        leading: 10,
      });
    }
  }

  pdf.y = askTop - askH - 12;
}

export type BriefPdfMeta = {
  /** School year the figures describe. */
  year: string;
  /** Canonical page URL, printed in the footer so the PDF is traceable. */
  siteUrl: string;
};

/** Build the PDF. Returns a Blob ready to download. */
export function buildBriefPdf(brief: DistrictBrief, meta: BriefPdfMeta): Blob {
  const pdf = new Pdf();

  pdf.text('WA SCHOOL FUNDING EXPLORER', {
    size: 8,
    font: 'bold',
    colour: ACCENT,
    leading: 13,
  });
  pdf.gap(2);
  pdf.text(`What needs to change in ${brief.name}`, {
    size: 19,
    font: 'bold',
    colour: INK,
    leading: 23,
  });
  pdf.gap(8);
  pdf.text(brief.headline, { size: 11.5, font: 'bold', colour: INK, leading: 15 });
  pdf.gap(6);
  pdf.text(brief.summary, { size: 9.5, colour: INK_SECONDARY, leading: 13.2 });
  pdf.gap(12);

  statBoxes(pdf, brief.stats);
  pdf.gap(6);
  pdf.rule();

  if (brief.steadyNote) {
    pdf.text(brief.steadyNote, { size: 9.5, colour: INK_SECONDARY, leading: 13.2 });
  } else {
    brief.issues.forEach((issue, index) => issueSection(pdf, issue, index));
  }

  pdf.gap(4);
  pdf.rule();
  pdf.text(
    `Every figure above is computed from the OSPI data behind this site - F-196 revenue and expenditure actuals and the Apportionment final extract for ${meta.year}, the enrichment levy worksheet, and OSPI enrollment and demographic reporting. Districts are ranked against the other 314 in Washington, so "unusually high" always means unusual for this state.`,
    { size: 7.5, colour: INK_MUTED, leading: 10.5 }
  );
  pdf.gap(3);
  pdf.text(
    'This brief explains the educational content and data on this website. It is not an official fiscal or legal source. An independent civic education project, not affiliated with OSPI or the Washington State Legislature.',
    { size: 7.5, colour: INK_MUTED, leading: 10.5 }
  );
  pdf.gap(3);
  pdf.text(`Full sources and methodology: ${meta.siteUrl}/sources`, {
    size: 7.5,
    colour: ACCENT,
    leading: 10.5,
  });

  return pdf.build(`${brief.name} - ${meta.year} - ${meta.siteUrl}`);
}

/** A filesystem-safe name, e.g. "bellevue-school-district-brief-2024-25.pdf". */
export function briefFileName(brief: DistrictBrief, year: string): string {
  const slug = brief.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}-brief-${year}.pdf`;
}

/**
 * Trigger the download.
 *
 * The object URL is revoked on the next tick rather than immediately: Safari
 * reads the blob asynchronously after the synthetic click, and revoking too
 * early produces an empty file.
 */
export function downloadBriefPdf(brief: DistrictBrief, meta: BriefPdfMeta) {
  const blob = buildBriefPdf(brief, meta);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = briefFileName(brief, meta.year);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
