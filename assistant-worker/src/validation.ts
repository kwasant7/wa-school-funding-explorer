/**
 * Request validation and bounding.
 *
 * Everything arriving here is attacker-controlled: the Worker is a public
 * endpoint and nothing stops someone posting to it directly. So the request is
 * not merely type-checked, it is *rebuilt* - each field is read, bounded, and
 * copied into a fresh object. Anything unrecognised is dropped rather than
 * forwarded, so no caller can smuggle extra fields into the model payload or
 * inflate a request into an expensive one.
 */

export const LIMITS = {
  /** Whole request body. Generous for a page context, far below anything abusive. */
  bodyBytes: 64 * 1024,
  messageChars: 1_000,
  historyTurns: 10,
  historyChars: 4_000,
  knowledgeChunks: 6,
  knowledgeChars: 6_000,
  excerptChars: 1_500,
  headings: 10,
  sourceCatalogue: 60,
  visitorIdChars: 128,
} as const;

const LANGUAGES = ['en', 'es', 'zh', 'vi', 'ru', 'tl', 'ko'] as const;
export type Language = (typeof LANGUAGES)[number];

export type CleanMessage = { role: 'user' | 'assistant'; content: string };

export type CleanRequest = {
  message: string;
  language: Language;
  visitorId: string;
  context: Record<string, unknown>;
  knowledge: { id: string; title: string; text: string; sourceIds: string[] }[];
  availableSources: { id: string; label: string; type: string }[];
  history: CleanMessage[];
};

export type ValidationFailure = { error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function strArray(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    out.push(item.slice(0, maxChars));
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * Copy only the context fields the prompt actually uses.
 *
 * A pass-through would let a caller attach arbitrary text to the model input
 * under a plausible-looking key. Rebuilding the object means the payload can
 * only ever contain fields this function knows about.
 */
function cleanContext(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  const context: Record<string, unknown> = {
    pathname: str(value.pathname, 200),
    pageTitle: str(value.pageTitle, 200),
    schoolYear: typeof value.schoolYear === 'string' ? value.schoolYear.slice(0, 20) : null,
    availableYears: strArray(value.availableYears, 20, 20),
    headings: strArray(value.headings, LIMITS.headings, 160),
    excerpt: str(value.excerpt, LIMITS.excerptChars),
    availableSections: strArray(value.availableSections, 30, 60),
  };

  /*
    District, comparison, statewide, simulator and coverage are nested
    structures of numbers built by the site. They are re-serialised through
    JSON with a size cap rather than field-by-field: they carry no free text a
    prompt could hide in, and mirroring each field here would mean editing this
    file every time a figure is added to the context.

    A key absent from this list is dropped, not passed through - so a new
    context field the site starts sending will silently never reach the model
    until it is named here.
  */
  for (const key of [
    'district',
    'districtHistory',
    'comparisonDistrict',
    'statewide',
    'simulator',
    'dataCoverage',
  ]) {
    const nested = value[key];
    if (nested === null || nested === undefined) {
      context[key] = null;
      continue;
    }
    try {
      const encoded = JSON.stringify(nested);
      context[key] = encoded && encoded.length <= 4_000 ? JSON.parse(encoded) : null;
    } catch {
      context[key] = null;
    }
  }

  return context;
}

export function validateRequest(body: unknown): CleanRequest | ValidationFailure {
  if (!isRecord(body)) return { error: 'Malformed request body.' };

  const message = str(body.message, LIMITS.messageChars).trim();
  if (!message) return { error: 'A question is required.' };

  const languageRaw = typeof body.language === 'string' ? body.language : 'en';
  const language = (LANGUAGES as readonly string[]).includes(languageRaw)
    ? (languageRaw as Language)
    : 'en';

  // Only used as a rate-limit key, so restrict it to characters that cannot
  // confuse the storage key and cap the length.
  const visitorId =
    str(body.visitorId, LIMITS.visitorIdChars).replace(/[^A-Za-z0-9_-]/g, '') || 'anonymous';

  const knowledge: CleanRequest['knowledge'] = [];
  let knowledgeChars = 0;
  if (Array.isArray(body.knowledge)) {
    for (const item of body.knowledge) {
      if (!isRecord(item)) continue;
      const text = str(item.text, 2_000);
      if (!text) continue;
      if (knowledgeChars + text.length > LIMITS.knowledgeChars) break;
      knowledgeChars += text.length;
      knowledge.push({
        id: str(item.id, 80),
        title: str(item.title, 200),
        text,
        sourceIds: strArray(item.sourceIds, 8, 80),
      });
      if (knowledge.length >= LIMITS.knowledgeChunks) break;
    }
  }

  const availableSources: CleanRequest['availableSources'] = [];
  if (Array.isArray(body.availableSources)) {
    for (const item of body.availableSources) {
      if (!isRecord(item)) continue;
      const id = str(item.id, 80);
      if (!id) continue;
      availableSources.push({
        id,
        label: str(item.label, 160),
        type: item.type === 'official' ? 'official' : 'internal',
      });
      if (availableSources.length >= LIMITS.sourceCatalogue) break;
    }
  }

  // History is trimmed oldest-first so the most recent exchange always
  // survives the character budget.
  let history: CleanMessage[] = [];
  if (Array.isArray(body.history)) {
    for (const item of body.history) {
      if (!isRecord(item)) continue;
      const role = item.role === 'assistant' ? 'assistant' : 'user';
      const content = str(item.content, 2_000).trim();
      if (!content) continue;
      history.push({ role, content });
    }
    history = history.slice(-LIMITS.historyTurns);
    while (
      history.length > 0 &&
      history.reduce((sum, entry) => sum + entry.content.length, 0) > LIMITS.historyChars
    ) {
      history = history.slice(1);
    }
  }

  return {
    message,
    language,
    visitorId,
    context: cleanContext(body.context),
    knowledge,
    availableSources,
    history,
  };
}

export function isFailure(
  value: CleanRequest | ValidationFailure
): value is ValidationFailure {
  return 'error' in value;
}
