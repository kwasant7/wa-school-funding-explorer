/**
 * A ~40-line module loader so `node --test` can run the app's own TypeScript
 * sources directly.
 *
 * Two things stand between Node and these files. The app imports through the
 * `@/` alias, which is a tsconfig `paths` mapping Node knows nothing about;
 * and it imports `.json` with a bare specifier, which Node only allows with an
 * import attribute. Both are resolved here rather than by adding a bundler or
 * a test framework to a project that has neither.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SRC = pathToFileURL(`${path.resolve(import.meta.dirname, '..', 'src')}/`).href;

/**
 * TypeScript source omits the file extension; Node's ESM resolver requires
 * one. Try the extensions this project actually uses, in the order tsc would.
 */
const EXTENSIONS = ['.ts', '.tsx', '.json', '/index.ts', '/index.tsx'];

function withExtension(url) {
  if (existsSync(fileURLToPath(url))) return url;
  for (const extension of EXTENSIONS) {
    const candidate = `${url}${extension}`;
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  return url;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const target = withExtension(new URL(specifier.slice(2), SRC).href);
    return nextResolve(target, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    // Hand JSON back as an ES module so no import attribute is needed at the
    // call site, keeping the app's source unchanged for tests.
    const raw = readFileSync(fileURLToPath(url), 'utf8');
    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${raw};`,
    };
  }
  return nextLoad(url, context);
}
