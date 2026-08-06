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
import { fmtMoney, fmtMoneyOnGrid } from '@/lib/format';

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
const ACCENT_DEEP = [0.063, 0.259, 0.506] as const;
const LINE = [0.882, 0.878, 0.851] as const;
const WASH = [0.933, 0.957, 0.984] as const;
const ACCENT_SOFT = [0.804, 0.886, 0.984] as const;
const PAPER = [0.976, 0.976, 0.969] as const;
const CRITICAL = [0.816, 0.231, 0.231] as const;
const BASELINE = [0.765, 0.761, 0.718] as const;

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

/* ------------------------------------------------------------------ *
 * Visuals
 * ------------------------------------------------------------------ */

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

/**
 * Draw an issue's chart.
 *
 * These mirror the shapes the web page draws, in the same order and the same
 * colours, so someone who read the page recognises the printout. Each returns
 * having advanced pdf.y past what it drew.
 */
function drawVisual(pdf: Pdf, visual: IssueVisual, x: number, width: number) {
  switch (visual.kind) {
    case 'versus': {
      const max = Math.max(visual.a, visual.b, 1);
      const rows = [
        { label: visual.aLabel, amount: visual.a, fill: ACCENT },
        { label: visual.bLabel, amount: visual.b, fill: ACCENT_SOFT },
      ];
      for (const row of rows) {
        pdf.ensure(30);
        const top = pdf.y;
        pdf.text(row.label, {
          x,
          size: 8,
          colour: INK_SECONDARY,
          width: width - 70,
          leading: 10,
        });
        // The amount is right-aligned against the column edge, so the two
        // figures line up and can be compared without re-reading the labels.
        const amount = visualValue(row.amount, visual);
        const amountX = x + width - measure(amount, 'bold', 9);
        pdf.y = top;
        pdf.text(amount, {
          x: amountX,
          size: 9,
          font: 'bold',
          colour: INK,
          width: 70,
          leading: 10,
        });
        pdf.gap(2);
        const barTop = pdf.y;
        pdf.rect(x, barTop - 9, width, 9, PAPER);
        pdf.rect(x, barTop - 9, Math.max(2, (width * row.amount) / max), 9, row.fill);
        pdf.y = barTop - 9;
        pdf.gap(7);
      }
      pdf.text(visual.gapLabel, {
        x,
        size: 9,
        font: 'bold',
        colour: CRITICAL,
        width,
        leading: 12,
      });
      break;
    }

    case 'dots': {
      const filled = Math.max(0, Math.min(100, visual.filled));
      pdf.ensure(46);
      const headTop = pdf.y;
      pdf.text(String(filled), {
        x,
        size: 17,
        font: 'bold',
        colour: ACCENT,
        width: 40,
        leading: 19,
      });
      pdf.y = headTop - 5;
      pdf.text(`out of every 100 ${visual.label}`, {
        x: x + measure(String(filled), 'bold', 17) + 5,
        size: 8.5,
        colour: INK_SECONDARY,
        width: width - 40,
        leading: 11,
      });
      pdf.y = headTop - 21;

      // Twenty across, five down: a shape the eye can count in blocks.
      const perRow = 20;
      const dot = 3.2;
      const gap = 1.6;
      pdf.ensure(5 * (dot + gap) + 12);
      const gridTop = pdf.y;
      for (let i = 0; i < 100; i += 1) {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        pdf.rect(
          x + col * (dot + gap),
          gridTop - (row + 1) * (dot + gap),
          dot,
          dot,
          i < filled ? ACCENT : LINE
        );
      }
      pdf.y = gridTop - 5 * (dot + gap) - 4;
      pdf.text(`Statewide it is ${visual.compare} out of 100.`, {
        x,
        size: 7.5,
        colour: INK_SECONDARY,
        width,
        leading: 10,
      });
      break;
    }

    case 'gauge': {
      pdf.ensure(40);
      const min = Math.min(0, visual.value);
      const max = Math.max(visual.safe * 3, visual.value, 15);
      const span = max - min || 1;
      const at = (n: number) => x + ((n - min) / span) * width;

      const headTop = pdf.y;
      const reading = `${visual.value.toFixed(1)}%`;
      pdf.text(reading, {
        x,
        size: 17,
        font: 'bold',
        colour: visual.value < 0 ? CRITICAL : INK,
        width: 70,
        leading: 19,
      });
      pdf.y = headTop - 5;
      pdf.text(visual.label, {
        x: x + measure(reading, 'bold', 17) + 5,
        size: 8.5,
        colour: INK_SECONDARY,
        width: width - 70,
        leading: 11,
      });
      pdf.y = headTop - 22;

      const barTop = pdf.y;
      pdf.rect(x, barTop - 9, width, 9, PAPER);
      const from = at(Math.min(0, visual.value));
      const to = at(Math.max(0, visual.value));
      pdf.rect(
        from,
        barTop - 9,
        Math.max(2, to - from),
        9,
        visual.value < 0 ? CRITICAL : ACCENT
      );
      // The safe line sits proud of the bar so it reads as a threshold.
      pdf.rect(at(visual.safe), barTop - 12, 1, 15, INK);
      pdf.y = barTop - 13;
      pdf.text(
        /*
          Do not fold safeLabel into this sentence - it is a caption for the
          tick mark ("This site flags below 5%"), not a noun phrase, and
          lowercasing it into the middle of a clause produced broken grammar.
        */
        `The black line marks ${visual.safe}%, the level this site flags as thin. Below it, one bad year means cuts.`,
        { x, size: 7.5, colour: INK_SECONDARY, width, leading: 10 }
      );
      break;
    }

    case 'steps': {
      pdf.ensure(30);
      const top = pdf.y;
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
        pdf.rect(left, top - 4, stepW, 3, tone);
        pdf.y = top - 8;
        pdf.text(step, {
          x: left,
          size: 7,
          font: i === visual.current ? 'bold' : 'regular',
          colour: i === visual.current ? CRITICAL : INK_MUTED,
          width: stepW,
          leading: 9,
        });
      });
      pdf.y = top - 22;
      break;
    }

    case 'trend': {
      pdf.ensure(56);
      const max = Math.max(visual.from, visual.to, 1);
      const top = pdf.y;
      const colW = Math.min(90, (width - 12) / 2);
      const points = [
        { label: visual.fromLabel, amount: visual.from, fill: ACCENT_SOFT },
        { label: visual.toLabel, amount: visual.to, fill: ACCENT },
      ];
      points.forEach((point, i) => {
        const left = x + i * (colW + 12);
        const barH = Math.max(6, (30 * point.amount) / max);
        pdf.y = top;
        pdf.text(Math.round(point.amount).toLocaleString('en-US'), {
          x: left,
          size: 11,
          font: 'bold',
          colour: INK,
          width: colW,
          leading: 13,
        });
        pdf.rect(left, top - 13 - barH, colW, barH, point.fill);
        pdf.y = top - 15 - barH;
        pdf.text(point.label, {
          x: left,
          size: 7.5,
          colour: INK_SECONDARY,
          width: colW,
          leading: 10,
        });
      });
      pdf.y = top - 48;
      pdf.text(visual.changeLabel, {
        x,
        size: 9,
        font: 'bold',
        colour: CRITICAL,
        width,
        leading: 12,
      });
      break;
    }
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
  const bodyWidth = CONTENT_W - (indent - MARGIN);
  pdf.text(issue.title, {
    x: indent,
    size: 12,
    font: 'bold',
    colour: INK,
    width: bodyWidth,
    leading: 15,
  });
  pdf.gap(3);
  pdf.text(issue.fact, {
    x: indent,
    size: 9.5,
    colour: INK_SECONDARY,
    width: bodyWidth,
    leading: 13,
  });
  pdf.gap(8);
  drawVisual(pdf, issue.visual, indent, bodyWidth);
  pdf.gap(4);

  // "The ask" panel. Measured before drawing so the wash sits behind the text.
  const askWidth = CONTENT_W - (indent - MARGIN) - 20;
  const askLines = wrap(issue.ask, 'regular', 9.5, askWidth).length;
  // Citations collapse to one line of bill numbers. The page hides them behind
  // a disclosure; print has no such affordance, so they shrink instead.
  const refLine = issue.refs.map((ref) => ref.bill).join('  ·  ');
  const refLines = refLine ? wrap(refLine, 'regular', 7.5, askWidth).length : 0;
  const askH = 26 + askLines * 13 + (refLines > 0 ? 5 + refLines * 10 : 0);

  pdf.gap(4);
  pdf.ensure(askH + 6);
  const askTop = pdf.y;
  pdf.rect(indent, askTop - askH, CONTENT_W - (indent - MARGIN), askH, WASH);
  pdf.rect(indent, askTop - askH, 2.5, askH, ACCENT);

  pdf.y = askTop - 9;
  pdf.text('WHAT TO ASK FOR', {
    x: indent + 10,
    size: 7.5,
    font: 'bold',
    colour: ACCENT_DEEP,
    width: askWidth,
    leading: 11,
  });
  pdf.text(issue.ask, {
    x: indent + 10,
    size: 9.5,
    font: 'bold',
    colour: INK,
    width: askWidth,
    leading: 13,
  });

  if (refLine) {
    pdf.gap(2);
    pdf.text(refLine, {
      x: indent + 10,
      size: 7.5,
      colour: INK_MUTED,
      width: askWidth,
      leading: 10,
    });
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
  /*
    No separate headline line. It restated the first issue's title verbatim,
    so the reader met the same sentence twice before reaching any number.
  */
  pdf.gap(6);
  pdf.text(brief.summary, { size: 10, colour: INK_SECONDARY, leading: 13.8 });
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
  /*
    Kept to three short lines. The previous version ran long enough to push a
    lone URL onto a second page - a whole sheet of paper for one sentence.
  */
  pdf.text(
    `All numbers come from OSPI records for ${meta.year}. Each district is compared with the other 314 in Washington.`,
    { size: 7.5, colour: INK_MUTED, leading: 10.5 }
  );
  pdf.text(
    'Not an official fiscal or legal source. An independent civic education project, not affiliated with OSPI or the Washington State Legislature.',
    { size: 7.5, colour: INK_MUTED, leading: 10.5 }
  );
  pdf.text(`Sources: ${meta.siteUrl}/sources`, {
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
