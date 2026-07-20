import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SOURCE_DIRS = ['src/app', 'src/components'];
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
]);

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim();
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
        const attribute = parent.name.getText(source);
        if (['aria-label', 'placeholder', 'title', 'alt'].includes(attribute)) {
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

const files = (
  await Promise.all(SOURCE_DIRS.map((directory) => sourceFiles(directory)))
).flat();
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
  output[language] = { ...(existing[language] ?? {}) };
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
