/**
 * Validation of everything the model returns, before any of it reaches the UI
 * or the page.
 *
 * The Worker validates too, but this runs again in the browser on purpose. The
 * Worker guarantees the JSON schema; only the browser knows whether district
 * "17405" exists, whether "2024-25" is a year this site has, or whether 4.2 is
 * inside the special-education slider's range. Validation belongs wherever the
 * facts are, so it happens in both places.
 *
 * Anything that fails is dropped rather than repaired. A dropped action means
 * the page simply does not change, which is always safe; a repaired one could
 * do something the visitor never asked for.
 */
import {
  ALLOWED_ROUTES,
  ALLOWED_SECTIONS,
  type AllowedRoute,
  type AllowedSectionId,
  type AssistantAction,
  type AssistantConfidence,
  type AssistantResponse,
  type AssistantSource,
} from '@/lib/assistant/types';
import { assistantSource } from '@/lib/assistant/knowledge';
import { clampControlValue, isSimulatorControlId } from '@/lib/simulator-config';
import { YEARS } from '@/lib/data';
import districtsData from '@/data/districts.json';

const ROUTE_SET = new Set<string>(ALLOWED_ROUTES);
const SECTION_SET = new Set<string>(ALLOWED_SECTIONS);
const YEAR_SET = new Set<string>(YEARS);
const DISTRICT_CODES = new Set<string>(
  districtsData.districts.map((district) => district.code)
);

export function isAllowedRoute(route: string): route is AllowedRoute {
  return ROUTE_SET.has(route);
}

export function isAllowedSection(id: string): id is AllowedSectionId {
  return SECTION_SET.has(id);
}

export function isKnownDistrictCode(code: string): boolean {
  return DISTRICT_CODES.has(code);
}

export function isKnownYear(year: string): boolean {
  return YEAR_SET.has(year);
}

/**
 * Narrow one action. Returns null for anything unrecognised, out of range, or
 * referring to data this site does not have.
 */
export function validateAction(input: unknown): AssistantAction | null {
  if (!input || typeof input !== 'object') return null;
  const action = input as Record<string, unknown>;
  const type = action.type;
  if (typeof type !== 'string') return null;

  switch (type) {
    case 'navigate': {
      const route = action.route;
      if (typeof route !== 'string' || !isAllowedRoute(route)) return null;
      return { type: 'navigate', route };
    }
    case 'scroll_to_section':
    case 'highlight_section': {
      const sectionId = action.sectionId;
      if (typeof sectionId !== 'string' || !isAllowedSection(sectionId)) return null;
      return { type, sectionId };
    }
    case 'select_district': {
      const districtCode = action.districtCode;
      if (typeof districtCode !== 'string' || !isKnownDistrictCode(districtCode)) {
        return null;
      }
      return { type: 'select_district', districtCode };
    }
    case 'clear_district':
      return { type: 'clear_district' };
    case 'set_school_year': {
      const year = action.year;
      if (typeof year !== 'string' || !isKnownYear(year)) return null;
      return { type: 'set_school_year', year };
    }
    case 'set_simulator_control': {
      const controlId = action.controlId;
      const value = action.value;
      if (typeof controlId !== 'string' || !isSimulatorControlId(controlId)) return null;
      if (typeof value !== 'number') return null;
      const clamped = clampControlValue(controlId, value);
      if (!clamped) return null;
      return { type: 'set_simulator_control', controlId, value: clamped.value };
    }
    case 'reset_simulator':
      return { type: 'reset_simulator' };
    case 'open_source': {
      const sourceId = action.sourceId;
      if (typeof sourceId !== 'string' || !assistantSource(sourceId)) return null;
      return { type: 'open_source', sourceId };
    }
    default:
      return null;
  }
}

/**
 * Resolve cited source IDs to real source records.
 *
 * The model is never given URLs and is never asked to produce one - it returns
 * IDs from a supplied allow-list, and they are looked up here. That is what
 * makes a fabricated citation impossible rather than merely unlikely.
 */
export function validateSources(input: unknown): AssistantSource[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const resolved: AssistantSource[] = [];
  for (const entry of input) {
    const id =
      typeof entry === 'string'
        ? entry
        : entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string'
          ? (entry as { id: string }).id
          : null;
    if (!id || seen.has(id)) continue;
    const source = assistantSource(id);
    if (!source) continue;
    seen.add(id);
    resolved.push(source);
    if (resolved.length >= 6) break;
  }
  return resolved;
}

function validateConfidence(input: unknown): AssistantConfidence {
  return input === 'high' || input === 'medium' || input === 'low' ? input : 'low';
}

const MAX_REPLY_CHARS = 6_000;

/**
 * Validate a whole response. Returns null only when there is no usable reply
 * text at all, which the caller surfaces as an invalid-response error.
 */
export function validateResponse(input: unknown): AssistantResponse | null {
  if (!input || typeof input !== 'object') return null;
  const payload = input as Record<string, unknown>;

  const reply = typeof payload.reply === 'string' ? payload.reply.trim() : '';
  if (!reply) return null;

  const actions = Array.isArray(payload.actions)
    ? payload.actions
        .map(validateAction)
        .filter((action): action is AssistantAction => action !== null)
        // A single answer changing the page five times would be disorienting.
        .slice(0, 3)
    : [];

  const suggestedQuestions = Array.isArray(payload.suggestedQuestions)
    ? payload.suggestedQuestions
        .filter(
          (question): question is string =>
            typeof question === 'string' && question.trim().length > 0
        )
        .map((question) => question.trim().slice(0, 160))
        .slice(0, 3)
    : [];

  return {
    reply: reply.slice(0, MAX_REPLY_CHARS),
    actions,
    sources: validateSources(payload.sources),
    suggestedQuestions,
    confidence: validateConfidence(payload.confidence),
  };
}
