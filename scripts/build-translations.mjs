import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SOURCE_DIRS = ['src/app', 'src/components'];

/*
  Individual files outside those directories that still render prose onto the
  page. src/lib is deliberately not scanned wholesale: it also holds the PDF
  writer, whose string literals are PDF syntax rather than English (`<< /Type
  /Catalog /Pages 2 0 R >>`, `) Tj ET`), and the assistant's i18n table, whose
  strings are already Spanish, Chinese and the rest - running those back
  through a translator would be nonsense. Scanning all of src/lib collected
  383 strings; this one file contributes 83 with none of that junk.

  Note what this can and cannot reach. The runtime looks up whole DOM text
  nodes, so only diagnosis.ts's static strings - issue titles, the card asks,
  the chart labels - can ever match. Its facts are template literals whose
  numbers are interpolated at render time, so the DOM carries one string with
  the district's own figures in it and the dictionary's fragments cannot match
  by construction. Those stay English until the runtime learns to match around
  a placeholder, which is a different mechanism than this file.
*/
const SOURCE_FILES = ['src/lib/diagnosis.ts'];
const OUTPUT = path.join(ROOT, 'src/data/translations.json');
const LANGUAGES = {
  es: 'es',
  zh: 'zh-CN',
  vi: 'vi',
  ru: 'ru',
  tl: 'tl',
  ko: 'ko',
};

const TEXT_PROPERTIES = new Set([
  'label',
  'title',
  'description',
  'blurb',
  'text',
  'heading',
  'summary',
  'detail',
  'body',
  'caption',
  'group',
  'name',
  'format',
  'note',
  'callout',
  'explanation',
  // Props that render visible copy on this site specifically: stat captions,
  // slider labels, scatter-axis titles, and the status/why-it-matters lines on
  // the bill cards.
  'cap',
  'ariaLabel',
  'sliderLabel',
  'todayLabel',
  'axis',
  'noun',
  'significance',
  'status',
]);

/*
  JSX text arrives from the TypeScript AST exactly as written in the source,
  entities and all - "Washington&apos;s" - but the browser hands the runtime
  the decoded character, "Washington's". Keying the dictionary on the raw form
  meant those strings could never be looked up at runtime, which is why whole
  paragraphs stayed in English on a translated page.
*/
const ENTITIES = {
  // Straight apostrophe (U+0027), which is what the browser renders - not the
  // typographic ’ (U+2019). Getting this wrong would leave the key subtly
  // different from the DOM text and the lookup would still miss.
  '&apos;': "'",
  '&quot;': '"',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&times;': '×',
  '&lt;': '<',
  '&gt;': '>',
  // Must run last so it cannot re-introduce an entity from decoded output.
  '&amp;': '&',
};

function decodeEntities(value) {
  let out = value.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16))
  );
  out = out.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
  for (const [entity, char] of Object.entries(ENTITIES)) {
    out = out.split(entity).join(char);
  }
  return out;
}

function normalize(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function looksLikeProse(value) {
  if (!/[A-Za-z]/.test(value) || value.length < 2) return false;
  if (
    value.startsWith('http') ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('@/') ||
    value.includes('className') ||
    value.includes('hover:') ||
    value.includes('md:') ||
    value.includes('lg:')
  ) {
    return false;
  }
  return value.includes(' ') || /^[A-Z][A-Za-z&/ -]{2,}$/.test(value);
}

async function sourceFiles(directory) {
  const entries = await fs.readdir(path.join(ROOT, directory), {
    withFileTypes: true,
  });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(relative)));
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      files.push(relative);
    }
  }
  return files;
}

function addText(collection, value) {
  const text = normalize(value);
  if (looksLikeProse(text)) collection.add(text);
}

function collectStrings(sourceText, filename, collection) {
  const source = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  function visit(node) {
    if (ts.isJsxText(node)) {
      addText(collection, node.getText(source));
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;

      if (
        ts.isImportDeclaration(parent) ||
        ts.isExportDeclaration(parent) ||
        (ts.isJsxAttribute(parent) &&
          parent.name.getText(source) === 'className')
      ) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isJsxAttribute(parent)) {
        /*
          Props carrying visible copy count too, not just the accessibility
          attributes. <StatTile label="Students" note="Funding FTE, not
          October headcount" /> renders both of those on screen, and only
          checking aria-label/placeholder/title/alt meant every stat tile,
          card heading and caption passed as a prop was missing from the
          dictionary and stayed in English on a translated page.
        */
        const attribute = parent.name.getText(source);
        if (
          ['aria-label', 'placeholder', 'title', 'alt'].includes(attribute) ||
          TEXT_PROPERTIES.has(attribute)
        ) {
          addText(collection, node.text);
        }
      } else if (ts.isPropertyAssignment(parent)) {
        const property = parent.name.getText(source).replace(/['"]/g, '');
        if (TEXT_PROPERTIES.has(property)) addText(collection, node.text);
      } else if (looksLikeProse(node.text)) {
        addText(collection, node.text);
      }
    }

    if (ts.isTemplateExpression(node)) {
      addText(collection, node.head.text);
      for (const span of node.templateSpans) {
        addText(collection, span.literal.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
}

async function translate(text, target) {
  const url = new URL(
    'https://translate.googleapis.com/translate_a/single'
  );
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'en');
  url.searchParams.set('tl', target);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) {
      const payload = await response.json();
      return payload[0].map((part) => part[0]).join('');
    }
    await new Promise((resolve) =>
      setTimeout(resolve, 400 * 2 ** attempt)
    );
  }

  throw new Error(`Could not translate: ${text}`);
}

const files = [
  ...(
    await Promise.all(SOURCE_DIRS.map((directory) => sourceFiles(directory)))
  ).flat(),
  ...SOURCE_FILES,
];
const strings = new Set();

for (const filename of files) {
  collectStrings(
    await fs.readFile(path.join(ROOT, filename), 'utf8'),
    filename,
    strings
  );
}

const sourceStrings = [...strings].sort((a, b) => a.localeCompare(b));
const existing = await fs
  .readFile(OUTPUT, 'utf8')
  .then((value) => JSON.parse(value))
  .catch(() => ({}));
const output = {};

for (const [language, target] of Object.entries(LANGUAGES)) {
  /*
    Seed only from strings the source still contains. Copy that has been
    reworded - or that moved into a runtime expression, the way the levy cap
    figures did when they started reading from levy.json - leaves behind a key
    the browser can never produce and so can never match. Carrying those
    forever would grow a file every visitor downloads.
  */
  const previous = existing[language] ?? {};
  output[language] = Object.fromEntries(
    sourceStrings
      .filter((text) => previous[text])
      .map((text) => [text, previous[text]])
  );
  const missing = sourceStrings.filter((text) => !output[language][text]);
  let cursor = 0;

  const workers = Array.from({ length: 10 }, async () => {
    while (cursor < missing.length) {
      const text = missing[cursor];
      cursor += 1;
      output[language][text] = await translate(text, target);
    }
  });

  await Promise.all(workers);
  console.log(`${language}: ${Object.keys(output[language]).length} strings`);
}

await fs.writeFile(
  OUTPUT,
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8'
);

console.log(`Wrote ${OUTPUT}`);
