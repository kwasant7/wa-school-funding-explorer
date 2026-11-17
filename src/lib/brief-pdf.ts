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
import { alignPair, fmtInt, fmtMoney, fmtMoneyOnGrid } from '@/lib/format';

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
// The revenue-source colours the site's charts use.
const SERIES: Record<'state' | 'local' | 'federal' | 'other', Rgb> = {
  state: [0.165, 0.471, 0.839],
  local: [0.106, 0.686, 0.478],
  federal: [0.929, 0.631, 0],
  other: [0, 0.514, 0],
};

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
 * A page drawn at absolute positions.
 *
 * The brief is one sheet, so the layout is a set of boxes placed by hand
 * rather than text flowing down a column and breaking across pages. Every
 * method takes `top`, the distance down from the top edge, because that is how
 * a layout is read; this converts to PDF's bottom-up coordinates in one place.
 */
class Pdf {
  private ops: string[] = [];

  private push(op: string) {
    this.ops.push(op);
  }

  private colour(rgb: Rgb) {
    this.push(`${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`);
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
            const baseline = PAGE_H - top - row * leading - size;
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
    this.push(`${x.toFixed(2)} ${(PAGE_H - top - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  /** A filled rectangle with rounded corners, drawn as four curves and four edges. */
  round(x: number, top: number, w: number, h: number, r: number, colour: Rgb) {
    if (r <= 0) return this.box(x, top, w, h, colour);
    const k = 0.5523 * r;
    const left = x;
    const right = x + w;
    const bottom = PAGE_H - top - h;
    const up = PAGE_H - top;
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

  /**
   * Finish the document. `footer` is stamped bottom-left, or left off when the
   * page draws its own.
   */
  build(footer: string | null): Blob {
    const content = this.ops.join('\n');
    const stamp = footer
      ? [
          `${LINE[0].toFixed(3)} ${LINE[1].toFixed(3)} ${LINE[2].toFixed(3)} rg`,
          `${MARGIN} ${MARGIN - 2} ${CONTENT_W} 0.7 re f`,
          `${INK_MUTED[0].toFixed(3)} ${INK_MUTED[1].toFixed(3)} ${INK_MUTED[2].toFixed(3)} rg`,
          `BT /F1 7.5 Tf 1 0 0 1 ${MARGIN} ${MARGIN - 16} Tm (${pdfString(footer)}) Tj ET`,
        ].join('\n')
      : '';
    const stream = stamp ? `${content}\n${stamp}` : content;

    /*
      Objects: 1 catalog, 2 page tree, 3-4 fonts, 5 the page, 6 its content
      stream. The xref table needs each object's byte offset, so the body is
      assembled while the offsets are recorded.
    */
    const objects: string[] = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = '<< /Type /Pages /Kids [5 0 R] /Count 1 >>';
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objects[5] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`;
    objects[6] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;

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

const PAD_X = 36;
const PAGE_TOP = 30;
const FOOT_BOTTOM = 22;
const COL_W = PAGE_W - PAD_X * 2;

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
      if (measureOnly) return 20;
      const reading = `${visual.value.toFixed(1)}%`;
      const labelW = Math.min(110, measure(visual.label, 'regular', 6.6) + 4);
      const valueW = measure(reading, 'bold', 6.6) + 2;
      const barX = x + labelW + 5;
      const barW = width - labelW - valueW - 10;
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
      pdf.at(`Black line: ${visual.safeLabel} (${visual.safe}% of a year's spending).`, {
        x: barX,
        top: top + 11.5,
        width: barW,
        size: 6.2,
        colour: INK_MUTED,
      });
      return 20;
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

/** What was left off the sheet to make it fit, from least to most important. */
type Attempt = { message: boolean; trend: boolean; problems: number };

const ATTEMPTS: Attempt[] = [
  { message: true, trend: true, problems: 3 },
  { message: false, trend: true, problems: 3 },
  { message: false, trend: false, problems: 3 },
  { message: false, trend: false, problems: 2 },
  { message: false, trend: false, problems: 1 },
  { message: false, trend: false, problems: 0 },
];

export type BriefPdfMeta = {
  /** School year the figures describe. */
  year: string;
  /** Canonical page URL, printed in the footer so the PDF is traceable. */
  siteUrl: string;
};

/**
 * Lay the sheet out. Returns where the content ends and the lowest point it may
 * reach (the footer's top edge), so the caller can tell whether it fit.
 */
function drawOnePage(
  pdf: Pdf,
  page: OnePage,
  meta: BriefPdfMeta,
  attempt: Attempt
): { bottom: number; limit: number } {
  const X = PAD_X;
  const W = COL_W;
  const siteHost = meta.siteUrl.replace(/^https?:\/\//, '');
  let y = PAGE_TOP;

  const heading = (title: string, subtitle: string) => {
    pdf.at(title, { x: X, top: y, width: W, size: 9.6, bold: true, colour: INK });
    if (subtitle) {
      pdf.at(subtitle, {
        x: X + measure(title, 'bold', 9.6) + 5,
        top: y + 2.2,
        width: W - measure(title, 'bold', 9.6) - 5,
        size: 7,
        colour: INK_MUTED,
      });
    }
    y += 13;
  };

  // --- Header ---------------------------------------------------------------
  const nameW = W - 110;
  let titleSize = 21;
  while (measure(page.name, 'bold', titleSize) > nameW && titleSize > 12) titleSize -= 0.5;

  pdf.at(`WA SCHOOL FUNDING EXPLORER  ·  FUNDING BRIEF ${meta.year}`, {
    x: X, top: y, width: nameW, size: 6.6, bold: true, colour: ACCENT,
  });
  pdf.at(siteHost, { x: X + W - 100, top: y + 2, width: 100, size: 7.4, bold: true, colour: ACCENT, align: 'right' });
  pdf.at('Print and share', { x: X + W - 100, top: y + 12, width: 100, size: 7, colour: INK_MUTED, align: 'right' });
  y += 9;
  pdf.at(page.name, { x: X, top: y, width: nameW, size: titleSize, bold: true, colour: INK, leading: titleSize * 1.1 });
  y += titleSize * 1.1 + 2;
  const sub = [`${page.county} County`, page.esd, `${fmtInt(page.fundedStudents)} funded students`]
    .filter(Boolean)
    .join('  ·  ');
  pdf.at(sub, { x: X, top: y, width: nameW, size: 8, colour: INK_SECONDARY });
  y += 11 + 3;
  y += pdf.at(page.summary, { x: X, top: y, width: W, size: 8.4, colour: INK, leading: 11 }) + 5;

  // --- The District Explorer's headline numbers ----------------------------------
  const tileGap = 6;
  const tileW = (W - tileGap * (page.tiles.length - 1)) / page.tiles.length;
  const tileH = 41;
  page.tiles.forEach((tile, i) => {
    const tx = X + i * (tileW + tileGap);
    pdf.ring(tx, y, tileW, tileH, 3.5, LINE, TILE);
    pdf.at(tile.label, { x: tx + 6, top: y + 5, width: tileW - 12, size: 7, colour: INK_SECONDARY });
    pdf.at(tile.value, {
      x: tx + 6, top: y + 13.5, width: tileW - 12, size: 15, bold: true,
      colour: tile.tone === 'critical' ? CRITICAL : INK, leading: 17,
    });
    pdf.at(tile.note, { x: tx + 6, top: y + 31, width: tileW - 12, size: 6.8, colour: INK_MUTED });
  });
  y += tileH + 8;

  // --- Where the money comes from, and how revenue per student has moved ----------
  const panelGap = 14;
  const panelW = (W - panelGap) / 2;
  const mixX = X;
  pdf.at('Where the money comes from', { x: mixX, top: y, width: panelW, size: 7, bold: true, colour: INK });
  pdf.at(`${fmtMoney(page.revenue.total)} in ${meta.year}`, {
    x: mixX, top: y, width: panelW, size: 7, colour: INK_SECONDARY, align: 'right',
  });
  let segX = mixX;
  const barTop = y + 11;
  const totalRevenue = page.revenue.total || 1;
  page.revenue.parts.forEach((part) => {
    const segW = (panelW * part.amount) / totalRevenue;
    if (segW <= 0) return;
    pdf.box(segX, barTop, segW, 13, SERIES[part.key]);
    // A label goes inside only where it fits - the full "Local 15%" if there
    // is room, else just the percent; the legend below names every part.
    if (part.key === 'state' || part.key === 'local') {
      const full = `${part.label} ${part.percent}%`;
      const label = measure(full, 'bold', 6.6) + 8 <= segW ? full : `${part.percent}%`;
      if (measure(label, 'bold', 6.6) + 8 <= segW) {
        pdf.at(label, {
          x: segX + 4, top: barTop + 3.4, width: segW - 4, size: 6.6, bold: true, colour: WHITE,
        });
      }
    }
    segX += segW;
  });
  let legendX = mixX;
  page.revenue.parts.forEach((part) => {
    const text = `${part.label} ${fmtMoney(part.amount)}`;
    pdf.box(legendX, barTop + 17.5, 6, 6, SERIES[part.key]);
    pdf.at(text, { x: legendX + 9, top: barTop + 17, width: panelW, size: 6.6, colour: INK_SECONDARY });
    legendX += 9 + measure(text, 'regular', 6.6) + 9;
  });

  let panelH = 38;
  if (attempt.trend) {
    const tx = X + panelW + panelGap;
    pdf.at('Revenue per student, six years', { x: tx, top: y, width: panelW, size: 7, bold: true, colour: INK });
    const keyText = `${page.shortName}  -  state median`;
    pdf.at(keyText, { x: tx, top: y + 0.4, width: panelW, size: 6.2, colour: INK_MUTED, align: 'right' });

    const { years, values, median } = page.trend;
    const columns = years.length;
    const colGap = 6;
    const colW = (panelW - colGap * (columns - 1)) / columns;
    const maxValue = Math.max(...values.filter((v): v is number => v != null), ...median, 1);
    const maxBar = 30;
    const base = y + 11 + 8 + maxBar;
    years.forEach((year, i) => {
      const cx = tx + i * (colW + colGap);
      const value = values[i];
      if (value != null) {
        const h = (value / maxValue) * maxBar;
        pdf.box(cx, base - h, colW, h, ACCENT);
        pdf.at(`$${(value / 1000).toFixed(1)}K`, {
          x: cx - 3, top: base - h - 8, width: colW + 6, size: 6.3, bold: true, colour: INK,
        });
      }
      const medianH = (median[i] / maxValue) * maxBar;
      pdf.box(cx - 1, base - medianH - 0.65, colW + 2, 1.3, INK);
      pdf.at(year, { x: cx - 3, top: base + 1.5, width: colW + 6, size: 6.2, colour: INK_MUTED });
    });
    panelH = 11 + 8 + maxBar + 10;
  }
  y += panelH + 3;

  // --- The Big 3 --------------------------------------------------------------
  if (page.big3) {
    y += 7;
    heading(
      'The “Big 3” funding gaps',
      `${page.big3.year}  ·  where funding falls furthest short of what running a district costs`
    );
    const colGap3 = 9;
    const colW3 = (W - colGap3 * 2) / 3;
    let bottom3 = y;
    page.big3.columns.forEach((col, i) => {
      const cx = X + i * (colW3 + colGap3);
      let cy = y;
      pdf.at(col.title, { x: cx, top: cy, width: colW3, size: 8.8, bold: true, colour: INK });
      cy += 11;
      pdf.at(col.detail, { x: cx, top: cy, width: colW3, size: 6.6, colour: INK_MUTED });
      cy += 9.5;

      // Larger figure first and full width, as on the web card; the amounts are
      // snapped onto one grid so the two bars subtract to the caption.
      const covered = col.cost <= col.funding;
      const pair = alignPair(Math.max(col.cost, col.funding), Math.min(col.cost, col.funding), 3, 10_000);
      const rows = covered
        ? [
            { label: 'Funding it receives', amount: pair.a, fill: ACCENT },
            { label: 'What it really costs', amount: pair.b, fill: ACCENT_SOFT },
          ]
        : [
            { label: 'What it really costs', amount: pair.a, fill: ACCENT },
            { label: 'Funding it receives', amount: pair.b, fill: ACCENT_SOFT },
          ];
      rows.forEach((row) => {
        pdf.at(row.label, { x: cx, top: cy, width: colW3, size: 6.8, colour: INK_SECONDARY });
        pdf.at(fmtMoneyOnGrid(row.amount, pair.step), {
          x: cx, top: cy, width: colW3, size: 6.8, bold: true, colour: INK, align: 'right',
        });
        cy += 8.5;
        pdf.box(cx, cy, colW3, 7, PAPER);
        pdf.box(cx, cy, Math.max(1.5, (colW3 * row.amount) / (pair.a || 1)), 7, row.fill);
        cy += 9.5;
      });
      pdf.at(covered ? 'Covered by its funding' : `${fmtMoneyOnGrid(pair.gap, pair.step)} short`, {
        x: cx, top: cy + 0.5, width: colW3, size: 8.6, bold: true, colour: covered ? GOOD : CRITICAL,
      });
      cy += 13;
      const noteRuns: Run[] = col.isAsk
        ? [{ text: 'Ask:', bold: true, colour: DEEP }, { text: ` ${col.note}` }]
        : [{ text: col.note }];
      cy += pdf.rich(noteRuns, { x: cx, top: cy, width: colW3, size: 7, colour: INK_SECONDARY, leading: 9 });
      bottom3 = Math.max(bottom3, cy);
    });
    y = bottom3 + 4;

    // The total, and what "funding" counts - the one thing a reader cannot
    // guess, and the reason this differs from a state-money-only figure.
    const lead: Run[] =
      page.big3.total > 0
        ? [
            { text: 'Where funding fell short, the gaps add up to ' },
            { text: fmtMoney(page.big3.total), bold: true },
            { text: ' — about ' },
            { text: `$${fmtInt(Math.round(page.big3.perStudent))} per student`, bold: true },
            { text: ` — that ${page.shortName} covers from local levies and other local money.` },
          ]
        : [{ text: 'Funding covers the cost of all three programs here.' }];
    const leadW = W - 14;
    const note =
      '“Funding” counts every revenue line for these programs: state, federal special education (IDEA) and Medicaid money, and payments from other districts.';
    const leadH = pdf.rich(lead, { x: 0, top: 0, width: leadW, size: 7.6, colour: INK, leading: 9.6, measureOnly: true });
    const noteH = pdf.at(note, { x: 0, top: 0, width: leadW, size: 6.3, leading: 8, measureOnly: true });
    const totalH = 4 + leadH + 1 + noteH + 3;
    pdf.ring(X, y, W, totalH, 3.5, ACCENT_SOFT, WASH);
    pdf.rich(lead, { x: X + 7, top: y + 4, width: leadW, size: 7.6, colour: INK, leading: 9.6 });
    pdf.at(note, { x: X + 7, top: y + 4 + leadH + 1, width: leadW, size: 6.3, colour: INK_MUTED, leading: 8 });
    y += totalH;
  }

  // --- What else needs to change, and what to ask for ----------------------------
  const cap = page.big3 ? attempt.problems : attempt.problems + 1;
  const problems = page.problems.slice(0, cap);
  if (problems.length > 0) {
    y += 13;
    heading('What else needs to change', 'and what to ask your legislators for');
    pdf.box(X, y - 1, W, 0.7, LINE);
    y += 2;

    const badge = 13;
    const leftX = X + badge + 7;
    const askW = 150;
    const leftW = W - badge - 7 - askW - 7;
    const askX = X + W - askW;
    problems.forEach((problem, index) => {
      const rowTop = y;
      if (index > 0) pdf.box(X, rowTop, W, 0.7, LINE);
      const top = rowTop + 6;

      // Left: title, fact, picture, and what the district has already done.
      let ly = top;
      ly += pdf.at(problem.title, { x: leftX, top: ly, width: leftW, size: 8.8, bold: true, colour: INK, leading: 10.6 });
      ly += 1.5;
      ly += pdf.at(problem.fact, { x: leftX, top: ly, width: leftW, size: 8, colour: INK_SECONDARY, leading: 10.4 });
      ly += 2.5;
      ly += miniVisual(pdf, problem.visual, leftX, ly, leftW, false);
      if (problem.response) {
        ly += 1.5;
        ly += pdf.rich(
          [{ text: 'Already done:', bold: true, colour: GOOD }, { text: ` ${problem.response}` }],
          { x: leftX, top: ly, width: leftW, size: 6.6, colour: INK_SECONDARY, leading: 8.4 }
        );
      }

      // Right: the ask, with the bills and statutes behind it.
      const askInner = askW - 8.2;
      const textH = pdf.at(problem.ask, { x: 0, top: 0, width: askInner, size: 8, bold: true, leading: 9.8, measureOnly: true });
      const citeH = problem.cite
        ? pdf.at(problem.cite, { x: 0, top: 0, width: askInner, size: 6.4, leading: 8, measureOnly: true })
        : 0;
      const askH = 3.5 + 7.4 + textH + (citeH ? 1.5 + citeH : 0) + 3.5;
      pdf.box(askX, top, askW, askH, WASH);
      pdf.box(askX, top, 2.2, askH, ACCENT);
      let ay = top + 3.5;
      pdf.at('ASK', { x: askX + 8.2, top: ay, width: askInner, size: 6.2, bold: true, colour: ACCENT });
      ay += 7.4;
      ay += pdf.at(problem.ask, { x: askX + 8.2, top: ay, width: askInner, size: 8, bold: true, colour: INK, leading: 9.8 });
      if (problem.cite) {
        pdf.at(problem.cite, { x: askX + 8.2, top: ay + 1.5, width: askInner, size: 6.4, colour: INK_MUTED, leading: 8 });
      }

      // The number badge: a circle with the numeral set on its optical centre.
      const numeral = String(index + 1);
      const numeralSize = 7.5;
      const capHeight = numeralSize * 0.717;
      pdf.round(X, top + 1, badge, badge, badge / 2, ACCENT);
      pdf.at(numeral, {
        x: X + (badge - measure(numeral, 'bold', numeralSize)) / 2,
        top: top + 1 + badge / 2 + capHeight / 2 - numeralSize,
        width: badge,
        size: numeralSize,
        bold: true,
        colour: WHITE,
      });

      y = top + Math.max(ly - top, askH) + 6;
    });
  }

  // --- Who to ask -----------------------------------------------------------------
  y += 11;
  const total = page.delegations.length + page.moreDelegations;
  if (page.delegations.length > 0) {
    heading(
      'Who to ask',
      `${page.shortName} is represented by ${total === 1 ? 'one legislative delegation' : `${total} legislative delegations`}`
    );
    const legGap = 7;
    const legW = (W - legGap * 2) / 3;
    const mostMembers = Math.max(...page.delegations.map((d) => d.members.length));
    const legH = 4.5 + 10.5 + mostMembers * 9.4 + 3;
    page.delegations.forEach((d, i) => {
      const lx = X + i * (legW + legGap);
      pdf.ring(lx, y, legW, legH, 3.5, LINE, TILE);
      const head = `${ordinal(d.district)} District`;
      pdf.at(head, { x: lx + 6, top: y + 4.5, width: legW - 12, size: 7.8, bold: true, colour: INK });
      pdf.at(`·  ${d.percent}% of ${page.shortName}`, {
        x: lx + 6 + measure(head, 'bold', 7.8) + 4, top: y + 5.5, width: legW, size: 6.6, colour: INK_MUTED,
      });
      d.members.forEach((member, row) => {
        const my = y + 4.5 + 10.5 + row * 9.4;
        pdf.at(member.chamber, { x: lx + 6, top: my, width: 24, size: 7.4, bold: true, colour: INK });
        pdf.at(member.name, { x: lx + 6 + 22, top: my, width: legW - 30, size: 7.4, colour: INK_SECONDARY });
      });
    });
    y += legH + 4;
  }
  const how: Run[] = [
    { text: 'School and legislative boundaries do not match, so ' },
    { text: 'confirm yours from your home address at app.leg.wa.gov/DistrictFinder', bold: true, colour: INK },
    { text: '. Contact details: ' },
    { text: 'leg.wa.gov/legislators', bold: true, colour: INK },
    { text: page.moreDelegations > 0
        ? `. ${page.shortName} also overlaps ${page.moreDelegations} more legislative ${page.moreDelegations === 1 ? 'district' : 'districts'}; see ${siteHost}/take-action.`
        : '.' },
  ];
  y += pdf.rich(how, { x: X, top: y, width: W, size: 7, colour: INK_SECONDARY, leading: 9 });

  // --- Something to say -------------------------------------------------------------
  if (attempt.message) {
    y += 5;
    const innerW = W - 8.2 - 6;
    const quote = `“${page.message}”`;
    const quoteH = pdf.at(quote, { x: 0, top: 0, width: innerW, size: 7.8, leading: 10.2, measureOnly: true });
    const boxH = 4.5 + 7.6 + quoteH + 4.5;
    pdf.box(X, y, W, boxH, WASH);
    pdf.box(X, y, 2.2, boxH, ACCENT);
    pdf.at('SAY IT IN THIRTY SECONDS', { x: X + 8.2, top: y + 4.5, width: innerW, size: 6.4, bold: true, colour: ACCENT });
    pdf.at(quote, { x: X + 8.2, top: y + 4.5 + 7.6, width: innerW, size: 7.8, colour: INK, leading: 10.2 });
    y += boxH;
  }

  // --- Footer ---------------------------------------------------------------------------
  const footer =
    `All numbers come from OSPI records for ${meta.year}` +
    (page.big3
      ? '; the Big 3 figures are those of the AESD Big 3 dashboard, built from OSPI F-196 actuals and apportionment.'
      : '.') +
    ' Each district is compared with the other 314 in Washington. Not an official fiscal or legal source: ' +
    'an independent civic education project, not affiliated with OSPI or the Washington State Legislature. ' +
    `Sources: ${siteHost}/sources`;
  const footerH = pdf.at(footer, { x: X, top: 0, width: W, size: 5.9, leading: 7.7, measureOnly: true });
  const footerTop = PAGE_H - FOOT_BOTTOM - footerH - 4;
  pdf.box(X, footerTop, W, 0.7, LINE);
  pdf.at(footer, { x: X, top: footerTop + 3.5, width: W, size: 5.9, colour: INK_MUTED, leading: 7.7 });

  return { bottom: y, limit: footerTop - 6 };
}

export type SheetFit = {
  /** Index into ATTEMPTS; 0 means nothing had to be left off. */
  attempt: number;
  bottom: number;
  limit: number;
  fits: boolean;
};

/**
 * Draw the sheet, dropping the least important parts one at a time until it
 * fits on the page: the spoken message first, then the trend chart, then the
 * lowest-ranked problems. Almost every district fits whole.
 */
function renderSheet(page: OnePage, meta: BriefPdfMeta): { pdf: Pdf; fit: SheetFit } {
  let result: { pdf: Pdf; fit: SheetFit } | null = null;
  for (let attempt = 0; attempt < ATTEMPTS.length; attempt += 1) {
    const pdf = new Pdf();
    const { bottom, limit } = drawOnePage(pdf, page, meta, ATTEMPTS[attempt]);
    result = { pdf, fit: { attempt, bottom, limit, fits: bottom <= limit } };
    if (result.fit.fits) break;
  }
  return result!;
}

/** Exposed so the tests can prove every district fits on one sheet. */
export function sheetFitForTest(code: string, meta: BriefPdfMeta): SheetFit | null {
  const page = onePageFor(code);
  return page ? renderSheet(page, meta).fit : null;
}

/** Build the PDF. Returns a Blob ready to download. */
export function buildBriefPdf(brief: DistrictBrief, meta: BriefPdfMeta): Blob {
  const page = onePageFor(brief.code);
  if (!page) throw new Error(`No one-page brief for district ${brief.code}`);
  return renderSheet(page, meta).pdf.build(null);
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
 * Trigger a direct download of the brief. The button normally opens the PDF in
 * a tab (`window.open` on an object URL from `buildBriefPdf`), where it can be
 * read, printed or saved; this is the fallback for when that tab could not be
 * opened (a strict popup blocker, most often) - a reader who wanted the brief
 * should still get the file rather than nothing.
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
