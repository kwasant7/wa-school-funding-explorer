/**
 * Local retrieval over the site's own knowledge, plus district-name matching.
 *
 * No vector database and no embedding call: the corpus is a few dozen short,
 * hand-written passages on one narrow subject, and for that a lexical scorer
 * with a domain synonym table beats a similarity search that would cost a
 * network round trip on every question. It also means retrieval is
 * deterministic and unit-testable.
 *
 * The scorer is IDF-weighted term overlap with three domain-specific boosts:
 * exact phrase hits, curated keyword hits, and expansion of the abbreviations
 * people actually type ("sped", "ELL", "MSOC", "LEA").
 */
import { KNOWLEDGE } from '@/lib/assistant/knowledge';
import type { AssistantKnowledgeChunk } from '@/lib/assistant/types';
import districtsData from '@/data/districts.json';

/** Words that carry no signal in a corpus that is entirely about school funding. */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does',
  'for', 'from', 'get', 'gets', 'has', 'have', 'how', 'i', 'in', 'is', 'it',
  'its', 'me', 'my', 'of', 'on', 'or', 'our', 'so', 'that', 'the', 'their',
  'them', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your',
  'about', 'into', 'more', 'much', 'many', 'tell', 'explain', 'show', 'please',
]);

/**
 * Abbreviation and jargon expansion. A visitor typing "sped" should reach the
 * special-education passage even though that passage spells the word out.
 */
const SYNONYMS: Record<string, string[]> = {
  sped: ['special', 'education', 'disabilities'],
  iep: ['special', 'education', 'disabilities'],
  idea: ['special', 'education', 'federal'],
  ell: ['english', 'learner', 'bilingual', 'multilingual'],
  mll: ['english', 'learner', 'bilingual', 'multilingual'],
  esl: ['english', 'learner', 'bilingual'],
  tbip: ['bilingual', 'english', 'learner'],
  msoc: ['materials', 'supplies', 'operating', 'costs'],
  lea: ['local', 'effort', 'assistance', 'equalization'],
  lap: ['learning', 'assistance', 'poverty'],
  fte: ['funding', 'enrollment', 'equivalent'],
  aafte: ['funding', 'enrollment', 'equivalent'],
  frpl: ['low', 'income', 'poverty'],
  levy: ['levy', 'local', 'cap'],
  lid: ['cap', 'levy'],
  esser: ['federal', 'pandemic'],
  ospi: ['state', 'superintendent'],
  rcw: ['statute', 'law'],
  mccleary: ['court', 'constitution', 'paramount'],
  cola: ['salary', 'compensation'],
  headcount: ['enrollment', 'october'],
  reserves: ['fund', 'balance', 'reserve'],
  deficit: ['fund', 'balance', 'surplus'],
  testify: ['testimony', 'committee', 'hearing'],
  legislator: ['legislators', 'representative', 'senator'],
  simulator: ['simulator', 'slider', 'lever'],
};

export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    // Curly quotes and dashes come from real keyboards and would otherwise
    // split tokens differently from the corpus.
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(query: string): string[] {
  const normalized = normalizeQuery(query);
  const raw = normalized
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^[-']+|[-']+$/g, ''))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  const expanded = new Set<string>();
  for (const token of raw) {
    expanded.add(token);
    // Cheap singularisation so "levies"/"levy" and "districts"/"district" meet.
    if (token.endsWith('ies') && token.length > 4) {
      expanded.add(`${token.slice(0, -3)}y`);
    } else if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) {
      expanded.add(token.slice(0, -1));
    }
    for (const synonym of SYNONYMS[token] ?? []) expanded.add(synonym);
  }
  return Array.from(expanded);
}

/** Bill references in any of the forms people actually write them. */
export function extractBillNumbers(query: string): string[] {
  const pattern = /\b((?:e?2?s?[hs]b|hb|sb|shb|ssb|eshb|essb|e2shb|e2ssb)\s?)(\d{3,4})\b/g;
  const text = normalizeQuery(query);
  const found: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    found.push(`${match[1].trim().toUpperCase()} ${match[2]}`);
  }
  return found;
}

/* ------------------------------------------------------------------ *
 * District matching
 * ------------------------------------------------------------------ */

type DistrictIndexEntry = {
  code: string;
  name: string;
  /** Name with "School District" and punctuation stripped, for loose matching. */
  simple: string;
};

const DISTRICT_INDEX: DistrictIndexEntry[] = districtsData.districts.map((district) => ({
  code: district.code,
  name: district.name,
  simple: simplifyDistrictName(district.name),
}));

function simplifyDistrictName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bschool district\b/g, '')
    .replace(/\bpublic schools\b/g, '')
    .replace(/\bno\.?\s*\d+\b/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find districts named in a question.
 *
 * Deliberately conservative. Several Washington districts are named after
 * ordinary words - Union Gap, Freeman, Liberty, Evergreen, Mount Vernon - and
 * matching a bare common word would drag an irrelevant district into context
 * on questions that never mentioned one. Single-token names must therefore
 * appear as a whole word AND be long enough to be distinctive.
 */
export function findDistrictsInQuery(query: string, limit = 2): DistrictIndexEntry[] {
  const normalized = normalizeQuery(query).replace(/[^a-z0-9\s-]/g, ' ');
  const padded = ` ${normalized.replace(/\s+/g, ' ').trim()} `;
  const hits: { entry: DistrictIndexEntry; score: number }[] = [];

  for (const entry of DISTRICT_INDEX) {
    if (!entry.simple) continue;
    const needle = ` ${entry.simple} `;
    if (padded.includes(needle)) {
      // Longer names are more specific: "Union Gap" should beat "Union".
      hits.push({ entry, score: entry.simple.length + 10 });
      continue;
    }
    // Multi-word districts also match on their distinctive first token
    // ("Bellevue" for "Bellevue School District"), but only if it is long.
    const first = entry.simple.split(' ')[0];
    if (first.length >= 6 && padded.includes(` ${first} `)) {
      hits.push({ entry, score: first.length });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const unique: DistrictIndexEntry[] = [];
  for (const hit of hits) {
    if (seen.has(hit.entry.code)) continue;
    seen.add(hit.entry.code);
    unique.push(hit.entry);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function districtByCode(code: string) {
  return districtsData.districts.find((district) => district.code === code) ?? null;
}

/* ------------------------------------------------------------------ *
 * Chunk scoring
 * ------------------------------------------------------------------ */

const CHUNK_TOKENS = KNOWLEDGE.map((chunk) => {
  const haystack = `${chunk.title} ${chunk.text} ${chunk.keywords.join(' ')}`;
  const tokens = new Set(
    haystack
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
  );
  return { chunk, tokens, lowerText: haystack.toLowerCase() };
});

/** Inverse document frequency, so "funding" counts for less than "regionalization". */
const IDF = (() => {
  const documentFrequency = new Map<string, number>();
  for (const { tokens } of CHUNK_TOKENS) {
    tokens.forEach((token) => {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    });
  }
  const total = CHUNK_TOKENS.length;
  const idf = new Map<string, number>();
  documentFrequency.forEach((frequency, token) => {
    idf.set(token, Math.log(1 + total / frequency));
  });
  return idf;
})();

export type RetrievalResult = {
  chunks: AssistantKnowledgeChunk[];
  districts: DistrictIndexEntry[];
  billNumbers: string[];
};

/**
 * Pick the passages worth sending. `limit` is small on purpose - the whole
 * corpus would be a few thousand tokens on every request, and the model
 * answers better from three relevant passages than from twenty.
 */
export function retrieve(query: string, limit = 4): RetrievalResult {
  const tokens = tokenize(query);
  const normalized = normalizeQuery(query);
  const scored: { chunk: AssistantKnowledgeChunk; score: number }[] = [];

  for (const { chunk, tokens: chunkTokens, lowerText } of CHUNK_TOKENS) {
    let score = 0;
    for (const token of tokens) {
      if (chunkTokens.has(token)) score += IDF.get(token) ?? 0.5;
    }
    // Curated keywords are a strong signal that this passage is the intended
    // answer, not merely a passage that shares vocabulary with the question.
    for (const keyword of chunk.keywords) {
      if (normalized.includes(keyword)) score += 2.5;
    }
    if (normalized.includes(chunk.title.toLowerCase())) score += 4;
    // A multi-word phrase appearing verbatim outweighs scattered token hits.
    for (const phrase of normalized.split(/[?.,;]/)) {
      const trimmed = phrase.trim();
      if (trimmed.length >= 12 && lowerText.includes(trimmed)) score += 3;
    }
    if (score > 0) scored.push({ chunk, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const districts = findDistrictsInQuery(query);
  const billNumbers = extractBillNumbers(query);

  let chunks = scored.slice(0, limit).map((entry) => entry.chunk);

  /*
    A question that matched nothing is usually either very short ("what is
    this?") or phrased in words the corpus does not use. Falling back to the
    orientation passages is far more useful than sending no grounding at all
    and letting the model answer from memory.
  */
  if (chunks.length === 0) {
    chunks = KNOWLEDGE.filter((chunk) =>
      ['site-navigation', 'data-coverage', 'disclaimer'].includes(chunk.id)
    ).slice(0, limit);
  }

  return {
    // Strip the retrieval-only `keywords` field before it goes over the wire.
    chunks: chunks.map(({ id, title, text, sourceIds }) => ({ id, title, text, sourceIds })),
    districts,
    billNumbers,
  };
}
