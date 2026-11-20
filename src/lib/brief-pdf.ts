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
import type { DistrictBrief, IssueVisual } from '@/lib/diagnosis';
import { onePageFor, ordinal, type OnePage } from '@/lib/brief-onepage';
import { alignPair, fmtInt, fmtMoney, fmtMoneyFull, fmtMoneyOnGrid } from '@/lib/format';

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

/**
 * Helvetica-Bold's curly quotes are wider than the regular face's (a bold
 * closing quote is 500 units, not 333), so a bold heading measured with the
 * regular widths ran the next word into its quote mark.
 */
const HIGH_WIDTHS_BOLD: Record<number, number> = {
  ...HIGH_WIDTHS,
  145: 278,
  146: 278,
  147: 500,
  148: 500,
};

function charWidth(code: number, font: FontName): number {
  if (code >= 32 && code <= 126) {
    return (font === 'bold' ? HELVETICA_BOLD : HELVETICA)[code - 32];
  }
  return (font === 'bold' ? HIGH_WIDTHS_BOLD : HIGH_WIDTHS)[code] ?? 556;
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

/**
 * Exposed so the WinAnsi escaping can be tested directly.
 *
 * The brief's own copy happens to be pure ASCII today, which means no district
 * exercises the high-byte path. Testing through generated content would have
 * silently stopped covering it the moment the wording changed - which is
 * exactly what happened - so the encoder is tested on its own inputs instead.
 */
export const pdfStringForTest = pdfString;

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
const LINE = [0.882, 0.878, 0.851] as const;
const ACCENT_SOFT = [0.804, 0.886, 0.984] as const;
const GOOD = [0, 0.388, 0] as const;
const GOOD_WASH = [0.941, 0.992, 0.957] as const;
const PAPER = [0.976, 0.976, 0.969] as const;
const CRITICAL = [0.816, 0.231, 0.231] as const;
const BASELINE = [0.765, 0.761, 0.718] as const;

type Rgb = readonly [number, number, number];

const WASH = [0.933, 0.957, 0.984] as const;
const DEEP = [0.063, 0.259, 0.506] as const;
const TILE = [0.988, 0.988, 0.984] as const;
const WHITE = [1, 1, 1] as const;
// The revenue-source colours the site's charts use (state blue, local green,
// federal orange, other green) - varied so the mix reads at a glance.
const SERIES: Record<'state' | 'local' | 'federal' | 'other', Rgb> = {
  state: [0.165, 0.471, 0.839],
  local: [0.106, 0.686, 0.478],
  federal: [0.929, 0.631, 0],
  other: [0, 0.514, 0],
};

// Modern brief palette.
const INDIGO = [0.188, 0.337, 0.827] as const;
const INDIGO_SOFT = [0.776, 0.804, 0.929] as const; // funding bars
const TINT = [0.961, 0.969, 0.996] as const;         // ask-card fill
const AMBER = [0.761, 0.255, 0.047] as const;        // shortfall
const AMBER_SOFT = [0.992, 0.941, 0.909] as const;
const EMERALD = [0.059, 0.482, 0.373] as const;      // covered / above
const EMERALD_SOFT = [0.918, 0.965, 0.945] as const;
const SLATE = [0.404, 0.439, 0.502] as const;
const BENCH = [0.702, 0.149, 0.118] as const;        // reserve benchmark line
const CARD_BG = [0.988, 0.988, 0.992] as const;
const CARD_LINE = [0.914, 0.914, 0.925] as const;

/** A stretch of text in one weight and colour, for lines that mix both. */
type Run = { text: string; bold?: boolean; colour?: Rgb };

type TextOptions = {
  x: number;
  /** Distance from the top edge of the page to the top of the first line. */
  top: number;
  width: number;
  size?: number;
  bold?: boolean;
  colour?: Rgb;
  leading?: number;
  align?: 'left' | 'right';
  /** Measure only: report the height without drawing. */
  measureOnly?: boolean;
};

/**
 * A document drawn at absolute positions, a page at a time.
 *
 * The layout is a set of boxes placed by hand rather than text flowing down a
 * column, so every method takes `top`, the distance down from the top edge of
 * the current page, and converts to PDF's bottom-up coordinates in one place.
 *
 * Everything is drawn in layout units and scaled up once per page by `scale`:
 * the page is laid out as though it were 1/scale as wide and as tall, then
 * magnified, so every size in the layout - type included - prints that much
 * larger without a single number in it changing. Tuning how large the brief
 * reads is therefore one constant, not a hundred.
 */
class Pdf {
  private pages: string[][] = [[]];
  private current = 0;

  private readonly scale: number;

  constructor(scale: number) {
    this.scale = scale;
  }

  /** Page width and height in layout units. */
  get width() {
    return PAGE_W / this.scale;
  }
  get height() {
    return PAGE_H / this.scale;
  }
  get pageCount() {
    return this.pages.length;
  }

  private push(op: string) {
    this.pages[this.current].push(op);
  }

  private colour(rgb: Rgb) {
    this.push(`${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`);
  }

  /** Start a new page and draw on it from now on. */
  newPage() {
    this.pages.push([]);
    this.current = this.pages.length - 1;
  }

  /** Draw on an earlier page, then return - for stamping "Page 1 of 2" once the count is known. */
  onPage(index: number, draw: () => void) {
    const was = this.current;
    this.current = index;
    draw();
    this.current = was;
  }

  /**
   * Wrapped text in which runs may differ in weight and colour. Returns the
   * height it takes, so callers can stack boxes without a second measuring
   * pass; `measureOnly` skips the drawing for the callers that size a box
   * before painting it.
   */
  rich(runs: Run[], options: Omit<TextOptions, 'bold' | 'align'>): number {
    const { x, top, width, size = 8, colour = INK_SECONDARY, measureOnly = false } = options;
    const leading = options.leading ?? size * 1.32;

    /*
      Text is broken into words, but words that touch across a change of style
      ("legislators" in bold, then "." in regular) must stay together and sit
      with no space between them, so they travel as one unbreakable chunk.
    */
    type Piece = { text: string; font: FontName; colour: Rgb };
    const chunks: Piece[][] = [];
    let spaced = true;
    for (const run of runs) {
      const pieceStyle = { font: (run.bold ? 'bold' : 'regular') as FontName, colour: run.colour ?? colour };
      for (const token of run.text.match(/\s+|\S+/g) ?? []) {
        if (/^\s/.test(token)) {
          spaced = true;
          continue;
        }
        if (spaced || chunks.length === 0) chunks.push([{ text: token, ...pieceStyle }]);
        else chunks[chunks.length - 1].push({ text: token, ...pieceStyle });
        spaced = false;
      }
    }

    const space = measure(' ', 'regular', size);
    const chunkWidth = (chunk: Piece[]) =>
      chunk.reduce((sum, piece) => sum + measure(piece.text, piece.font, size), 0);
    const lines: Piece[][][] = [];
    let line: Piece[][] = [];
    let used = 0;
    for (const chunk of chunks) {
      const w = chunkWidth(chunk);
      if (line.length > 0 && used + space + w > width) {
        lines.push(line);
        line = [];
        used = 0;
      }
      used += (line.length > 0 ? space : 0) + w;
      line.push(chunk);
    }
    if (line.length > 0) lines.push(line);

    if (!measureOnly) {
      lines.forEach((lineChunks, row) => {
        let cursor = x;
        lineChunks.forEach((chunk, index) => {
          if (index > 0) cursor += space;
          for (const piece of chunk) {
            this.colour(piece.colour);
            const baseline = this.height - top - row * leading - size;
            this.push(
              `BT ${piece.font === 'bold' ? '/F2' : '/F1'} ${size} Tf 1 0 0 1 ${cursor.toFixed(2)} ${baseline.toFixed(2)} Tm (${pdfString(piece.text)}) Tj ET`
            );
            cursor += measure(piece.text, piece.font, size);
          }
        });
      });
    }
    return lines.length * leading;
  }

  /** Plain wrapped text in one style; `align: 'right'` is for single lines. */
  at(content: string, options: TextOptions): number {
    const { bold, align, ...rest } = options;
    if (align === 'right') {
      const w = measure(content, bold ? 'bold' : 'regular', options.size ?? 8);
      return this.rich([{ text: content, bold }], { ...rest, x: options.x + options.width - w, width: w + 1 });
    }
    return this.rich([{ text: content, bold }], rest);
  }

  box(x: number, top: number, w: number, h: number, colour: Rgb) {
    this.colour(colour);
    this.push(`${x.toFixed(2)} ${(this.height - top - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  /** A filled rectangle with rounded corners, drawn as four curves and four edges. */
  round(x: number, top: number, w: number, h: number, r: number, colour: Rgb) {
    if (r <= 0) return this.box(x, top, w, h, colour);
    const k = 0.5523 * r;
    const left = x;
    const right = x + w;
    const bottom = this.height - top - h;
    const up = this.height - top;
    const f = (n: number) => n.toFixed(2);
    this.colour(colour);
    this.push(
      `${f(left + r)} ${f(bottom)} m ` +
        `${f(right - r)} ${f(bottom)} l ` +
        `${f(right - r + k)} ${f(bottom)} ${f(right)} ${f(bottom + r - k)} ${f(right)} ${f(bottom + r)} c ` +
        `${f(right)} ${f(up - r)} l ` +
        `${f(right)} ${f(up - r + k)} ${f(right - r + k)} ${f(up)} ${f(right - r)} ${f(up)} c ` +
        `${f(left + r)} ${f(up)} l ` +
        `${f(left + r - k)} ${f(up)} ${f(left)} ${f(up - r + k)} ${f(left)} ${f(up - r)} c ` +
        `${f(left)} ${f(bottom + r)} l ` +
        `${f(left)} ${f(bottom + r - k)} ${f(left + r - k)} ${f(bottom)} ${f(left + r)} ${f(bottom)} c h f`
    );
  }

  /** A rounded box with a hairline border: the border colour, then the fill inset by it. */
  ring(x: number, top: number, w: number, h: number, r: number, border: Rgb, fill: Rgb) {
    this.round(x, top, w, h, r, border);
    this.round(x + 0.7, top + 0.7, w - 1.4, h - 1.4, Math.max(0, r - 0.7), fill);
  }

  /** Finish the document. */
  build(): Blob {
    const s = this.scale.toFixed(4);
    const streams = this.pages.map((ops) => `q ${s} 0 0 ${s} 0 0 cm\n${ops.join('\n')}\nQ`);

    /*
      Objects: 1 catalog, 2 page tree, 3-4 fonts, then a page and its content
      stream per page. The xref table needs each object's byte offset, so the
      body is assembled while the offsets are recorded.
    */
    const objects: string[] = [];
    const pageIds = streams.map((_, index) => 5 + index * 2);
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${streams.length} >>`;
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

/**
 * How much larger than its layout units the brief prints. The layout is
 * written for a page 1/PDF_SCALE as wide, then magnified, so raising this makes
 * every size - type included - bigger and the layout reflows to fit. It is the
 * single control for how large the brief reads; the tests prove every district
 * still fits in MAX_PAGES at this value.
 */
const PDF_SCALE = 1.4;
/** The brief is built to fit this many pages. */
const MAX_PAGES = 2;
const PAD_X = 28;
const PAGE_TOP = 24;
const FOOT_BOTTOM = 16;

/**
 * A bar label, matching the web renderer exactly.
 *
 * This deliberately shares `fmtMoneyOnGrid` with IssueVisual.tsx rather than
 * keeping a local copy. The two used to be byte-identical duplicates, which
 * meant a rounding fix applied on screen would silently leave the printed
 * brief - the artifact people actually hand to a legislator - still wrong.
 */
function visualValue(
  n: number,
  visual: Extract<IssueVisual, { kind: 'versus' }>,
): string {
  if (visual.format !== 'money') return Math.round(n).toLocaleString('en-US');
  return visual.step ? fmtMoneyOnGrid(n, visual.step) : fmtMoney(n);
}

const MINI_ROW = 10;

/**
 * An issue's picture, small enough to sit beside its sentence. The shapes are
 * the ones the web page draws, in the same colours, so someone who read the
 * page recognises the printout. Returns the height it took.
 */
function miniVisual(
  pdf: Pdf,
  visual: IssueVisual,
  x: number,
  top: number,
  width: number,
  measureOnly: boolean
): number {
  type Row = { label: string; value: string; amount: number; fill: Rgb };

  const bars = (rows: Row[]): number => {
    if (measureOnly) return rows.length * MINI_ROW;
    const labelW = Math.min(110, Math.max(...rows.map((r) => measure(r.label, 'regular', 6.6))) + 4);
    const valueW = Math.max(...rows.map((r) => measure(r.value, 'bold', 6.6))) + 2;
    const barX = x + labelW + 5;
    const barW = width - labelW - valueW - 10;
    const max = Math.max(...rows.map((r) => r.amount), 1);
    rows.forEach((row, i) => {
      const rowTop = top + i * MINI_ROW;
      pdf.at(row.label, { x, top: rowTop + 1, width: labelW, size: 6.6, colour: INK_SECONDARY });
      pdf.box(barX, rowTop + 1.5, barW, 6.5, PAPER);
      pdf.box(barX, rowTop + 1.5, Math.max(1.5, (barW * row.amount) / max), 6.5, row.fill);
      pdf.at(row.value, {
        x: x + width - valueW,
        top: rowTop + 1,
        width: valueW,
        size: 6.6,
        bold: true,
        colour: INK,
        align: 'right',
      });
    });
    return rows.length * MINI_ROW;
  };

  switch (visual.kind) {
    case 'versus':
      return bars([
        { label: visual.aLabel, value: visualValue(visual.a, visual), amount: visual.a, fill: ACCENT },
        { label: visual.bLabel, value: visualValue(visual.b, visual), amount: visual.b, fill: ACCENT_SOFT },
      ]);

    case 'dots':
      // Fifty-odd dots do not fit beside a sentence; two bars say the same.
      return bars([
        { label: 'Here', value: `${visual.filled}%`, amount: visual.filled, fill: ACCENT },
        {
          label: visual.compareLabel.charAt(0).toUpperCase() + visual.compareLabel.slice(1),
          value: `${visual.compare}%`,
          amount: visual.compare,
          fill: ACCENT_SOFT,
        },
      ]);

    case 'trend':
      if (measureOnly) return 2 * MINI_ROW + 10;
      bars([
        { label: visual.fromLabel, value: Math.round(visual.from).toLocaleString('en-US'), amount: visual.from, fill: ACCENT_SOFT },
        { label: visual.toLabel, value: Math.round(visual.to).toLocaleString('en-US'), amount: visual.to, fill: ACCENT },
      ]);
      pdf.at(visual.changeLabel, {
        x,
        top: top + 2 * MINI_ROW + 1,
        width,
        size: 7,
        bold: true,
        colour: CRITICAL,
      });
      return 2 * MINI_ROW + 10;

    case 'gauge': {
      const reading = `${visual.value.toFixed(1)}%`;
      const labelW = Math.min(110, measure(visual.label, 'regular', 6.6) + 4);
      const valueW = measure(reading, 'bold', 6.6) + 2;
      const barX = x + labelW + 5;
      const barW = width - labelW - valueW - 10;
      // The note can take two lines on a narrow column; the gauge is as tall as it is.
      const noteText = `Black line: ${visual.safeLabel} (${visual.safe.toFixed(1)}% of a year's spending).`;
      const noteH = pdf.at(noteText, {
        x: barX, top: 0, width: barW, size: 6.2, leading: 7.6, measureOnly: true,
      });
      if (measureOnly) return 11.5 + noteH + 1;
      const min = Math.min(0, visual.value);
      const max = Math.max(visual.safe * 1.5, visual.value, 15);
      const span = max - min || 1;
      const at = (n: number) => barX + ((n - min) / span) * barW;

      pdf.at(visual.label, { x, top: top + 1, width: labelW, size: 6.6, colour: INK_SECONDARY });
      pdf.box(barX, top + 1.5, barW, 6.5, PAPER);
      const from = at(Math.min(0, visual.value));
      const to = at(Math.max(0, visual.value));
      pdf.box(from, top + 1.5, Math.max(1.5, to - from), 6.5, visual.value < 0 ? CRITICAL : ACCENT);
      // The safe line stands proud of the bar so it reads as a threshold.
      pdf.box(at(visual.safe), top - 0.5, 1.2, 10.5, INK);
      pdf.at(reading, {
        x: x + width - valueW,
        top: top + 1,
        width: valueW,
        size: 6.6,
        bold: true,
        colour: visual.value < 0 ? CRITICAL : INK,
        align: 'right',
      });
      pdf.at(noteText, {
        x: barX,
        top: top + 11.5,
        width: barW,
        size: 6.2,
        colour: INK_MUTED,
        leading: 7.6,
      });
      return 11.5 + noteH + 1;
    }

    case 'steps': {
      if (measureOnly) return 15;
      const gap = 4;
      const stepW = (width - gap * (visual.steps.length - 1)) / visual.steps.length;
      visual.steps.forEach((step, i) => {
        const left = x + i * (stepW + gap);
        /*
          Only the stage the district is actually at is red. Filling the
          earlier ones in the same colour painted "Healthy" as an alarm, which
          is the opposite of what it means; grey reads as "already passed".
        */
        const tone = i < visual.current ? BASELINE : i === visual.current ? CRITICAL : LINE;
        pdf.box(left, top + 1, stepW, 2.5, tone);
        pdf.at(step, {
          x: left,
          top: top + 5,
          width: stepW,
          size: 6.2,
          bold: i === visual.current,
          colour: i === visual.current ? CRITICAL : INK_MUTED,
        });
      });
      return 15;
    }
  }
}

/** What was left off to keep the brief to two pages, from least to most important. */
type Attempt = { message: boolean; problems: number };

const ATTEMPTS: Attempt[] = [
  { message: true, problems: 3 },
  { message: false, problems: 3 },
  { message: false, problems: 2 },
  { message: false, problems: 1 },
  { message: false, problems: 0 },
];

export type BriefPdfMeta = {
  /** School year the figures describe. */
  year: string;
  /** Canonical page URL, printed in the footer so the PDF is traceable. */
  siteUrl: string;
};

/**
 * Lay the brief out: page one is where the district stands (the Explorer's
 * numbers and the Big 3), page two is what to do about it (the asks, who to
 * ask, and something to say). Block heights are measured before anything is
 * drawn, so a block that would straddle a page boundary moves whole to the
 * next page instead.
 */
function drawBrief(
  pdf: Pdf,
  page: OnePage,
  meta: BriefPdfMeta,
  attempt: Attempt
): { overflow: boolean } {
  const X = PAD_X;
  const W = pdf.width - PAD_X * 2;
  const siteHost = meta.siteUrl.replace(/^https?:\/\//, '');
  let y = PAGE_TOP;
  let overflow = false;

  // --- Footer geometry: the same on every page, so measured once ------------------
  const footer =
    `OSPI records for ${meta.year}; levy and bills use their own dates` +
    (page.big3
      ? '. The Big 3 figures are those of the AESD Big 3 dashboard, built from OSPI F-196 actuals and apportionment.'
      : '.') +
    " Each problem is ranked against Washington's school districts; charter and tribal compact schools are left out of that comparison. Not an official fiscal or legal source: " +
    'an independent civic education project, not affiliated with OSPI or the Washington State Legislature. ' +
    `Sources: ${siteHost}/sources`;
  const pageLabelW = 40;
  const footerH = pdf.at(footer, {
    x: X, top: 0, width: W - pageLabelW, size: 6, leading: 7.8, measureOnly: true,
  });
  const footerTop = pdf.height - FOOT_BOTTOM - footerH - 4;
  const limit = footerTop - 8;

  // --- Page flow ----------------------------------------------------------------------
  const runningHeader = () => {
    pdf.at(page.name, { x: X, top: PAGE_TOP, width: W * 0.6, size: 8.6, bold: true, colour: INK });
    pdf.at(`Funding brief ${meta.year}  ·  ${siteHost}`, {
      x: X, top: PAGE_TOP + 1.4, width: W, size: 6.6, colour: INK_MUTED, align: 'right',
    });
    pdf.box(X, PAGE_TOP + 13, W, 0.7, LINE);
  };
  const continuePage = () => {
    pdf.newPage();
    runningHeader();
    y = PAGE_TOP + 22;
  };
  /** Make room for a block of height `h`, moving to a fresh page if it will not fit here. */
  const need = (h: number) => {
    if (y + h > limit) {
      if (y > PAGE_TOP + 24) continuePage();
      if (y + h > limit) overflow = true;
    }
  };

  const headingHeight = (title: string, subtitle: string) => {
    const subW = W - measure(title, 'bold', 9.6) - 6;
    const subH = subtitle
      ? pdf.at(subtitle, { x: 0, top: 0, width: subW, size: 7, leading: 8.6, measureOnly: true })
      : 0;
    return Math.max(13, 2.2 + subH + 3);
  };
  const heading = (title: string, subtitle: string) => {
    pdf.at(title, { x: X, top: y, width: W, size: 9.6, bold: true, colour: INK });
    if (subtitle) {
      pdf.at(subtitle, {
        x: X + measure(title, 'bold', 9.6) + 6,
        top: y + 2.2,
        width: W - measure(title, 'bold', 9.6) - 6,
        size: 7,
        colour: INK_MUTED,
        leading: 8.6,
      });
    }
    y += headingHeight(title, subtitle);
  };

  // =========================== PAGE ONE: where the district stands ====================
  // --- Header ---------------------------------------------------------------------------
  const urlW = 90;
  const nameW = W - urlW - 8;
  let titleSize = 22;
  while (measure(page.name, 'bold', titleSize) > W && titleSize > 13) titleSize -= 0.5;

  pdf.at('K12FUNDING.ORG', { x: X, top: y, width: W, size: 7, bold: true, colour: INDIGO });
  pdf.at(`FUNDING BRIEF  ·  ${meta.year}`, { x: X, top: y, width: W, size: 7, bold: true, colour: SLATE, align: 'right' });
  y += 10;
  pdf.box(X, y, W, 0.6, CARD_LINE);
  y += 12;
  y += pdf.at(page.name, { x: X, top: y, width: W, size: titleSize, bold: true, colour: INK, leading: titleSize * 1.12 }) + 2;
  const sub = [`${page.county} County`, page.esd, `${fmtInt(page.fundedStudents)} funded students`]
    .filter(Boolean)
    .join('  ·  ');
  y += pdf.at(sub, { x: X, top: y, width: W, size: 8.2, colour: SLATE, leading: 10.4 }) + 6;
  y += pdf.at(page.summary, { x: X, top: y, width: W, size: 8.8, colour: INK, leading: 12 }) + 2;

  // --- Centred label helper (the writer aligns left or right only) --------------------
  const centerText = (
    text: string, cxx: number, top: number, width: number, size: number, bold: boolean, colour: Rgb
  ) => {
    const tw = measure(text, bold ? 'bold' : 'regular', size);
    pdf.at(text, { x: cxx + (width - tw) / 2, top, width: tw + 2, size, bold, colour });
  };

  // --- Hero: where the district stands (the situation at a glance) ---------------------
  y += 4;
  pdf.at(`WHERE ${page.shortName.toUpperCase()} STANDS  ·  ${meta.year}`, {
    x: X, top: y, width: W, size: 6.6, bold: true, colour: SLATE,
  });
  y += 11;

  const hpad = 12;
  const iw = W - 2 * hpad;
  const coverRuns: Run[] =
    page.big3 && page.big3.total > 0
      ? [
          { text: `Across these three programs ${page.shortName} covered about ` },
          { text: fmtMoney(page.big3.total), bold: true, colour: AMBER },
          { text: ' from local and other general-fund money beyond what their dedicated funding paid for.' },
        ]
      : [{ text: 'Funding covers the cost of all three Big 3 programs here.' }];
  const coverH = page.big3
    ? pdf.rich(coverRuns, { x: 0, top: 0, width: iw, size: 7.2, leading: 9.4, measureOnly: true })
    : 0;
  const row1H = 39;
  const b3RowH = 24;
  const b3H = page.big3 ? 34 + page.big3.columns.length * b3RowH : 0;
  const footH = page.big3 ? 8 + coverH : 0;
  const cardH = hpad + row1H + b3H + footH + hpad;
  need(cardH + 6);
  pdf.ring(X, y, W, cardH, 6, CARD_LINE, CARD_BG);
  const cx0 = X + hpad;
  let hy = y + hpad;

  // Row 1: revenue per student against the state median
  pdf.at('REVENUE PER STUDENT', { x: cx0, top: hy, width: iw * 0.5, size: 6.3, bold: true, colour: SLATE });
  pdf.at(fmtMoneyFull(page.perPupilScale.value), { x: cx0, top: hy + 8, width: iw * 0.5, size: 20, bold: true, colour: INK, leading: 22 });
  {
    const d = page.perPupilScale.value - page.perPupilScale.median;
    const t = `${d >= 0 ? '+' : '-'}${fmtMoney(Math.abs(d))} ${d >= 0 ? 'above' : 'below'} the state median`;
    pdf.at(t, { x: cx0, top: hy + 31, width: iw * 0.6, size: 7, bold: true, colour: d >= 0 ? EMERALD : AMBER });
    const scaleW = 150;
    const sx = X + W - hpad - scaleW;
    const med = page.perPupilScale.median;
    const wMin = med * 0.6, wMax = med * 1.4;
    const pos = (Math.max(wMin, Math.min(wMax, page.perPupilScale.value)) - wMin) / (wMax - wMin);
    const sTop = hy + 15;
    pdf.round(sx, sTop, scaleW, 5, 2.5, [0.925, 0.927, 0.937] as const);
    pdf.round(sx, sTop, Math.max(5, scaleW * pos), 5, 2.5, INDIGO);
    pdf.box(sx + scaleW * 0.5 - 0.7, sTop - 3, 1.6, 11, INK);
    pdf.at('lower', { x: sx, top: sTop + 9, width: 40, size: 6.2, colour: SLATE });
    pdf.at('higher', { x: sx + scaleW - 40, top: sTop + 9, width: 40, size: 6.2, colour: SLATE, align: 'right' });
    pdf.at(`state median ${fmtMoneyFull(med)}`, { x: sx, top: sTop + 17, width: scaleW, size: 6.8, bold: true, colour: INK, align: 'right' });
  }
  hy += row1H;

  // Big 3 funding vs. cost, one shared bar scale so lengths compare
  if (page.big3) {
    // Set the Big 3 apart from the per-student scale above, with a bigger title.
    hy += 10;
    pdf.box(cx0, hy, iw, 0.5, CARD_LINE);
    hy += 8;
    pdf.at('The Big 3 gap', { x: cx0, top: hy, width: 200, size: 11, bold: true, colour: INK });
    pdf.at('funding vs. what it costs', {
      x: cx0 + measure('The Big 3 gap', 'bold', 11) + 8, top: hy + 3.5, width: iw, size: 6.6, colour: SLATE,
    });
    pdf.at('GAP', { x: cx0, top: hy + 3.5, width: iw, size: 6.6, bold: true, colour: SLATE, align: 'right' });
    hy += 16;
    const nameW3 = 118;
    const verdW = 86;
    const barsX = cx0 + nameW3;
    const barsW = iw - nameW3 - verdW - 8;
    const amtW = 40;
    const labW = 26;
    const maxVal = Math.max(...page.big3.columns.flatMap((c) => [c.cost, c.funding]), 1);
    const barMax = barsW - labW - amtW - 6;
    page.big3.columns.forEach((col, i) => {
      const ry = hy + i * b3RowH;
      pdf.at(col.title, { x: cx0, top: ry + 1, width: nameW3 - 4, size: 8, bold: true, colour: INK, leading: 9.2 });
      pdf.at(col.detail, { x: cx0, top: ry + 11, width: nameW3 - 4, size: 5.8, colour: SLATE, leading: 7 });
      const covered = col.cost <= col.funding;
      pdf.at('FUNDS', { x: barsX, top: ry + 1.5, width: labW, size: 5.8, colour: SLATE });
      pdf.box(barsX + labW, ry + 1.5, Math.max(2, barMax * (col.funding / maxVal)), 6.5, INDIGO_SOFT);
      pdf.at(fmtMoney(col.funding), { x: barsX + barsW - amtW, top: ry + 0.8, width: amtW, size: 6.6, bold: true, colour: INK, align: 'right' });
      pdf.at('COST', { x: barsX, top: ry + 12.5, width: labW, size: 5.8, colour: SLATE });
      pdf.box(barsX + labW, ry + 12.5, Math.max(2, barMax * (col.cost / maxVal)), 6.5, INDIGO);
      pdf.at(fmtMoney(col.cost), { x: barsX + barsW - amtW, top: ry + 11.8, width: amtW, size: 6.6, bold: true, colour: INK, align: 'right' });
      // Only flag a shortfall; where funding covers the cost the gap column is
      // left blank (the bars already show funding at or above cost).
      if (!covered) {
        const vx = cx0 + iw - verdW;
        const chip = `${fmtMoneyOnGrid(col.gap, 10000)} short`;
        const cw = measure(chip, 'bold', 7.6) + 12;
        pdf.round(vx + verdW - cw, ry + 2, cw, 13, 4, AMBER_SOFT);
        centerText(chip, vx + verdW - cw, ry + 4.6, cw, 7.6, true, AMBER);
      }
    });
    hy += page.big3.columns.length * b3RowH;
    pdf.box(cx0, hy, iw, 0.5, CARD_LINE);
    hy += 6;
    pdf.rich(coverRuns, { x: cx0, top: hy, width: iw, size: 7.2, colour: INK, leading: 9.4 });
  }
  y += cardH + 12;

  // --- Stat strip: four facts, hairline dividers, no boxes ----------------------------
  const tLow = page.tiles.find((t) => /low.income/i.test(t.label));
  const tResult = page.tiles.find((t) => /(spent more|took in|revenue minus)/i.test(t.label));
  const tBal = page.tiles.find((t) => /ending fund balance/i.test(t.label));
  const cells = [
    { k: 'Funded students', v: fmtInt(page.fundedStudents), n: 'funding FTE', neg: false },
    { k: 'Low income', v: tLow?.value ?? '', n: tLow?.note ?? '', neg: false },
    { k: 'Revenue - spending', v: tResult?.value ?? '$0', n: `${meta.year} operating result`, neg: tResult?.tone === 'critical' },
    { k: 'Ending fund balance', v: tBal?.value ?? 'Not reported', n: tBal?.note ?? '', neg: tBal?.tone === 'critical' },
  ];
  {
    const cellW = W / cells.length;
    cells.forEach((c, i) => {
      const inset = i === 0 ? 0 : 11;
      const cxx = X + i * cellW + inset;
      const cw = cellW - inset - 4;
      if (i > 0) pdf.box(X + i * cellW, y + 1, 0.5, 33, CARD_LINE);
      pdf.at(c.k.toUpperCase(), { x: cxx, top: y, width: cw, size: 6.1, bold: true, colour: SLATE });
      pdf.at(c.v, { x: cxx, top: y + 9, width: cw, size: 15, bold: true, colour: c.neg ? AMBER : INK, leading: 17 });
      pdf.at(c.n, { x: cxx, top: y + 27, width: cw, size: 6.2, colour: SLATE });
    });
    y += 40;
  }

  // --- Where the money comes from  |  Reserve ratio by year ---------------------------
  y += 18;
  const panelGap = 24;
  const panelW = (W - panelGap) / 2;
  const mixX = X;
  pdf.at('Where the money comes from', { x: mixX, top: y, width: panelW, size: 8, bold: true, colour: INK });
  pdf.at(`${fmtMoney(page.revenue.total)} total`, { x: mixX, top: y + 0.6, width: panelW, size: 6.6, colour: SLATE, align: 'right' });
  {
    let segX = mixX;
    const barTop = y + 12;
    const tot = page.revenue.total || 1;
    page.revenue.parts.forEach((p) => {
      const w = (panelW * p.amount) / tot;
      if (w <= 0) return;
      pdf.box(segX, barTop, w, 11, SERIES[p.key]);
      segX += w;
    });
    let ly = barTop + 17;
    page.revenue.parts.forEach((p) => {
      pdf.box(mixX, ly + 0.8, 6, 6, SERIES[p.key]);
      pdf.at(p.label, { x: mixX + 10, top: ly, width: panelW - 50, size: 7, colour: INK_SECONDARY });
      pdf.at(fmtMoney(p.amount), { x: mixX, top: ly, width: panelW, size: 7, bold: true, colour: INK, align: 'right' });
      ly += 11;
    });
  }
  const rx = X + panelW + panelGap;
  pdf.at('Reserve ratio by year', { x: rx, top: y, width: panelW, size: 8, bold: true, colour: INK });
  pdf.at('days of spending', { x: rx, top: y + 0.6, width: panelW, size: 6.6, colour: SLATE, align: 'right' });
  {
    const rr = page.reserveTrend;
    const n = rr.years.length;
    const colGap = 7;
    const colW = (panelW - colGap * (n - 1)) / n;
    const chartTop = y + 17;
    const chartH = 44;
    const benchPct = 16.4;
    const scaleMax = Math.max(benchPct, ...rr.ratios.filter((v): v is number => v != null), 1) * 1.08;
    const base = chartTop + chartH;
    const benchY = base - (benchPct / scaleMax) * chartH;
    for (let dx = 0; dx < panelW; dx += 5) pdf.box(rx + dx, benchY, 3, 0.8, BENCH);
    pdf.at('60-day benchmark', { x: rx, top: benchY - 8, width: panelW, size: 5.8, bold: true, colour: BENCH, align: 'right' });
    rr.ratios.forEach((v, i) => {
      const bx = rx + i * (colW + colGap);
      if (v != null) {
        const h = Math.max(1, (v / scaleMax) * chartH);
        const thin = v < 8.2;
        pdf.round(bx, base - h, colW, h, 1.5, thin ? ([0.918, 0.702, 0.541] as const) : ([0.624, 0.671, 0.902] as const));
        const days = Math.round((v * 365) / 100);
        centerText(`${v}%`, bx - 3, base - h - 14, colW + 6, 6.4, true, thin ? AMBER : INK_SECONDARY);
        centerText(`${days}d`, bx - 3, base - h - 7, colW + 6, 5.8, false, thin ? AMBER : SLATE);
      }
      centerText(rr.years[i], bx - 3, base + 2, colW + 6, 6, false, SLATE);
    });
    y = base + 11;
  }

  // =========================== PAGE TWO: what to do about it ===========================
  // The asks start a fresh page so that it can be taken to a legislator on its own.
  const problems = page.problems.slice(0, page.big3 ? attempt.problems : attempt.problems + 1);
  if (y > PAGE_TOP + 24) continuePage();

  if (problems.length > 0) {
    heading('What else needs to change', 'and what to ask your legislators for');
    y += 4;

    const badge = 17;
    const leftX = X + badge + 10;
    const askW = Math.round(W * 0.34);
    const gap = 16;
    const leftW = W - badge - 10 - askW - gap;
    const askX = X + W - askW;
    const askInner = askW - 24;

    const row = (problem: OnePage['problems'][number], index: number, top: number, draw: boolean) => {
      const m = !draw;
      let ly = top;
      ly += pdf.at(problem.title, { x: leftX, top: ly, width: leftW, size: 10.5, bold: true, colour: INK, leading: 12.6, measureOnly: m }) + 4;
      ly += pdf.at(problem.fact, { x: leftX, top: ly, width: leftW, size: 8.6, colour: INK_SECONDARY, leading: 11.4, measureOnly: m });
      if (problem.response) {
        ly += 3;
        ly += pdf.rich(
          [{ text: 'Already done:', bold: true, colour: EMERALD }, { text: ` ${problem.response}` }],
          { x: leftX, top: ly, width: leftW, size: 7.2, colour: INK_SECONDARY, leading: 9.2, measureOnly: m }
        );
      }
      const leftH = ly - top;

      const askTextH = pdf.at(problem.ask, { x: 0, top: 0, width: askInner, size: 9, bold: true, leading: 11, measureOnly: true });
      const citeH = problem.cite
        ? pdf.at(problem.cite, { x: 0, top: 0, width: askInner, size: 7, leading: 8.6, measureOnly: true })
        : 0;
      const askH = 10 + 7 + askTextH + (citeH ? 4 + citeH : 0) + 10;

      if (draw) {
        pdf.round(X, top, badge, badge, badge / 2, INK);
        centerText(String(index + 1), X, top + (badge - 9.5) / 2 + 0.6, badge, 9.5, true, WHITE);
        pdf.round(askX, top, askW, askH, 5, TINT);
        pdf.box(askX, top + 3, 3, askH - 6, INDIGO);
        pdf.at('ASK FOR', { x: askX + 12, top: top + 10, width: askInner, size: 6.3, bold: true, colour: INDIGO });
        let ay = top + 10 + 7;
        ay += pdf.at(problem.ask, { x: askX + 12, top: ay, width: askInner, size: 9, bold: true, colour: INK, leading: 11 });
        if (problem.cite) {
          pdf.at(problem.cite, { x: askX + 12, top: ay + 3, width: askInner, size: 7, colour: SLATE, leading: 8.6 });
        }
      }
      return Math.max(leftH, askH);
    };

    problems.forEach((problem, index) => {
      const h = row(problem, index, 0, false);
      need(h + 12);
      if (index > 0) pdf.box(X, y, W, 0.5, CARD_LINE);
      row(problem, index, y + (index > 0 ? 9 : 2), true);
      y += h + (index > 0 ? 14 : 8);
    });
  }

  // --- Who to ask ------------------------------------------------------------------------------
  y += 5;
  const total = page.delegations.length + page.moreDelegations;
  const whoSubtitle = `${page.shortName} is represented by ${total === 1 ? 'one legislative delegation' : `${total} legislative delegations`}`;
  if (page.delegations.length > 0) {
    const legGap = 16;
    const legW = (W - legGap * 2) / 3;
    const mostMembers = Math.max(...page.delegations.map((d) => d.members.length));
    const legH = 20 + mostMembers * 10;
    need(headingHeight('Who to ask', whoSubtitle) + legH + 18);
    heading('Who to ask', whoSubtitle);
    y += 1;
    page.delegations.forEach((d, i) => {
      const lx = X + i * (legW + legGap);
      pdf.at(`${ordinal(d.district)} District`, { x: lx, top: y, width: legW, size: 9.5, bold: true, colour: INK });
      pdf.at(`${d.percent}% of ${page.shortName}`, { x: lx, top: y + 11, width: legW, size: 6.8, colour: SLATE });
      d.members.forEach((member, r) => {
        const my = y + 21 + r * 10;
        pdf.at(member.chamber, { x: lx, top: my, width: 26, size: 8.2, bold: true, colour: SLATE });
        pdf.at(member.name, { x: lx + 26, top: my, width: legW - 26, size: 8.2, colour: INK });
      });
    });
    y += legH + 2;
  }
  const how: Run[] = [
    { text: 'School and legislative boundaries do not match, so ' },
    { text: 'confirm yours from your home address at app.leg.wa.gov/DistrictFinder', bold: true, colour: INK },
    { text: '. Contact details: ' },
    { text: 'leg.wa.gov/legislators', bold: true, colour: INK },
    {
      text:
        page.moreDelegations > 0
          ? `. ${page.shortName} also overlaps ${page.moreDelegations} more legislative ${page.moreDelegations === 1 ? 'district' : 'districts'}; see ${siteHost}/take-action.`
          : '.',
    },
  ];
  const howH = pdf.rich(how, { x: X, top: 0, width: W, size: 7.6, leading: 9.8, measureOnly: true });
  need(howH);
  y += pdf.rich(how, { x: X, top: y, width: W, size: 7.6, colour: INK_SECONDARY, leading: 9.8 });

  // --- Something to say -----------------------------------------------------------------------------
  if (attempt.message) {
    y += 9;
    const innerW = W - 32;
    const quote = `“${page.message}”`;
    const quoteH = pdf.at(quote, { x: 0, top: 0, width: innerW, size: 8.8, leading: 11.6, measureOnly: true });
    const boxH = 10 + 8 + quoteH + 10;
    need(boxH);
    pdf.ring(X, y, W, boxH, 6, CARD_LINE, CARD_BG);
    pdf.box(X + 12, y + 10, 3.5, boxH - 20, INDIGO);
    pdf.at('SAY IT IN THIRTY SECONDS', { x: X + 23, top: y + 10, width: innerW, size: 6.3, bold: true, colour: SLATE });
    pdf.at(quote, { x: X + 23, top: y + 20, width: innerW - 8, size: 8.8, colour: INK, leading: 11.6 });
    y += boxH;
  }

  // --- Footer, once the page count is known ---------------------------------------------------------
  const pages = pdf.pageCount;
  for (let i = 0; i < pages; i += 1) {
    pdf.onPage(i, () => {
      pdf.box(X, footerTop, W, 0.7, LINE);
      pdf.at(footer, { x: X, top: footerTop + 3.5, width: W - pageLabelW, size: 6, colour: INK_MUTED, leading: 7.8 });
      pdf.at(`Page ${i + 1} of ${pages}`, {
        x: X + W - pageLabelW, top: footerTop + 3.5, width: pageLabelW, size: 6, colour: INK_MUTED, align: 'right',
      });
    });
  }

  return { overflow };
}

export type SheetFit = {
  /** Index into ATTEMPTS; 0 means nothing had to be left off. */
  attempt: number;
  pages: number;
  fits: boolean;
};

/**
 * Draw the brief, dropping the least important parts one at a time until it
 * fits on two pages: the spoken message first, then the lowest-ranked
 * problems. Almost every district fits whole.
 */
function renderBrief(page: OnePage, meta: BriefPdfMeta): { pdf: Pdf; fit: SheetFit } {
  let result: { pdf: Pdf; fit: SheetFit } | null = null;
  for (let attempt = 0; attempt < ATTEMPTS.length; attempt += 1) {
    const pdf = new Pdf(PDF_SCALE);
    const { overflow } = drawBrief(pdf, page, meta, ATTEMPTS[attempt]);
    result = {
      pdf,
      fit: { attempt, pages: pdf.pageCount, fits: pdf.pageCount <= MAX_PAGES && !overflow },
    };
    if (result.fit.fits) break;
  }
  return result!;
}

/** Exposed so the tests can prove every district fits in two pages. */
export function sheetFitForTest(code: string, meta: BriefPdfMeta): SheetFit | null {
  const page = onePageFor(code);
  return page ? renderBrief(page, meta).fit : null;
}

/** How much larger than its layout units the brief prints; for the overflow test. */
export const pdfScaleForTest = PDF_SCALE;

/** The PDF for a hand-built page, so a test can draw a case no district has today. */
export function pdfForPageForTest(page: OnePage, meta: BriefPdfMeta): Blob {
  return renderBrief(page, meta).pdf.build();
}

/** Build the PDF. Returns a Blob ready to download. */
export function buildBriefPdf(brief: DistrictBrief, meta: BriefPdfMeta): Blob {
  const page = onePageFor(brief.code);
  if (!page) throw new Error(`No one-page brief for district ${brief.code}`);
  return renderBrief(page, meta).pdf.build();
}

/**
 * The district's own name, as a filesystem-safe file name, e.g.
 * "Tacoma School District.pdf". Characters that Windows and macOS refuse in a
 * file name (a few charter schools are called "Summit Public School: Atlas" or
 * "Impact | Black River Elementary") become a dash; everything else is kept so
 * the file reads as the district it is about.
 */
export function briefFileName(brief: DistrictBrief): string {
  const name = brief.name
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s*[\\/:*?"<>|]+\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    // Windows drops trailing dots and spaces, which would silently rename it.
    .replace(/^[\s.-]+|[\s.]+$/g, '');
  return `${name || 'School District'}.pdf`;
}

/**
 * Hand the brief to the browser as a download, saved as the district's own name.
 * A download is how the file gets that name: a PDF opened in a tab from a blob
 * address has none, and saving it from the viewer leaves the reader to rename a
 * string of hex digits. It also opens no tab, so nothing can be blocked.
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
  link.download = briefFileName(brief);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
