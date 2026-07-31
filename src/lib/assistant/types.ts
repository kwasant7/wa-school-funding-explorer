/**
 * Shared contract between the browser assistant and the Cloudflare Worker.
 *
 * The Worker keeps its own copy of the response types (it cannot import from
 * the Next app), so any change here needs the same change in
 * assistant-worker/src/schema.ts. The two are kept deliberately small for
 * that reason.
 */
import type { SimulatorControlId } from '@/lib/simulator-config';

export const ASSISTANT_LANGUAGES = ['en', 'es', 'zh', 'vi', 'ru', 'tl', 'ko'] as const;
export type AssistantLanguage = (typeof ASSISTANT_LANGUAGES)[number];

export function isAssistantLanguage(value: string): value is AssistantLanguage {
  return (ASSISTANT_LANGUAGES as readonly string[]).includes(value);
}

/** Internal routes the assistant is allowed to navigate to. */
export const ALLOWED_ROUTES = [
  '/',
  '/districts',
  '/simulator',
  '/take-action',
  '/sources',
  '/lea',
] as const;
export type AllowedRoute = (typeof ALLOWED_ROUTES)[number];

/**
 * Page regions the assistant may scroll to or highlight. Each one is rendered
 * with a matching `data-assistant-section` attribute; nothing else on the page
 * is addressable, so the model cannot invent a target.
 */
export const ALLOWED_SECTIONS = [
  'hero',
  'district-picker',
  'funding-sources',
  'prototypical-model',
  'funding-journey',
  'district-stats',
  'fund-balance',
  'trends',
  'demographics',
  'simulator-controls',
  'simulator-summary',
  'delegation',
  'district-brief',
  'templates',
  'bills',
  'resources',
  'sources-list',
  'methodology',
] as const;
export type AllowedSectionId = (typeof ALLOWED_SECTIONS)[number];

export type AssistantAction =
  | { type: 'navigate'; route: AllowedRoute }
  | { type: 'scroll_to_section'; sectionId: AllowedSectionId }
  | { type: 'highlight_section'; sectionId: AllowedSectionId }
  | { type: 'select_district'; districtCode: string }
  | { type: 'clear_district' }
  | { type: 'set_school_year'; year: string }
  | { type: 'set_simulator_control'; controlId: SimulatorControlId; value: number }
  | { type: 'reset_simulator' }
  | { type: 'open_source'; sourceId: string };

export type AssistantActionType = AssistantAction['type'];

export type AssistantSourceType = 'internal' | 'official';

export type AssistantSource = {
  id: string;
  label: string;
  url: string;
  type: AssistantSourceType;
  description?: string;
};

export type AssistantConfidence = 'high' | 'medium' | 'low';

/** The validated shape the Worker returns and the UI renders. */
export type AssistantResponse = {
  reply: string;
  actions: AssistantAction[];
  sources: AssistantSource[];
  suggestedQuestions: string[];
  confidence: AssistantConfidence;
};

/* ------------------------------------------------------------------ *
 * Page context
 * ------------------------------------------------------------------ */

export type ContextDistrict = {
  code: string;
  name: string;
  county: string;
  esd: string;
  schoolYear: string;
  fundingEnrollment: number;
  headcount: number;
  perPupil: number;
  revenue: { state: number; local: number; federal: number; other: number; total: number };
  expenditures: number;
  surplus: number;
  fundBalance: number | null;
  reserveRatio: number | null;
  demographics: {
    lowIncomePct: number;
    ellPct: number;
    spedPct: number;
    homelessPct: number;
    highlyCapablePct: number;
  };
  oversight: string | null;
};

export type ContextSimulator = {
  /** Only controls the visitor has actually moved off current law. */
  changed: {
    id: SimulatorControlId;
    label: string;
    baseline: number;
    value: number;
  }[];
  /** What the plan sends the selected district, if one is chosen. */
  districtImpact: {
    stateDollars: number;
    localDollars: number;
    levyAlreadyApproved: number;
    levyNeedsVote: number;
    breakdown: { label: string; amount: number }[];
  } | null;
};

export type AssistantPageContext = {
  pathname: string;
  pageTitle: string;
  language: AssistantLanguage;
  headings: string[];
  excerpt: string;
  schoolYear: string | null;
  availableYears: string[];
  district: ContextDistrict | null;
  comparisonDistrict: { code: string; name: string } | null;
  simulator: ContextSimulator | null;
  availableSections: AllowedSectionId[];
  dataCoverage: { firstYear: string; latestYear: string; districtCount: number };
};

/* ------------------------------------------------------------------ *
 * Wire format
 * ------------------------------------------------------------------ */

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantKnowledgeChunk = {
  id: string;
  title: string;
  text: string;
  sourceIds: string[];
};

export type AssistantChatRequest = {
  message: string;
  language: AssistantLanguage;
  visitorId: string;
  context: AssistantPageContext;
  knowledge: AssistantKnowledgeChunk[];
  /** Source IDs the model is permitted to cite, with labels for reference. */
  availableSources: { id: string; label: string; type: AssistantSourceType }[];
  history: AssistantChatMessage[];
};

export type AssistantErrorCode =
  | 'not_configured'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'rate_limited'
  | 'bad_request'
  | 'server'
  | 'invalid_response';

export type AssistantClientError = {
  code: AssistantErrorCode;
  /** Already-localized, safe to show. Never contains provider internals. */
  message: string;
  retryable: boolean;
};

/** What the UI stores per turn, including anything it acted on. */
export type AssistantTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: AssistantSource[];
  suggestedQuestions?: string[];
  /** Actions performed automatically, rendered as small confirmations. */
  performed?: string[];
  /** Actions offered but not performed, rendered as buttons. */
  offered?: { label: string; action: AssistantAction }[];
  confidence?: AssistantConfidence;
  error?: AssistantClientError;
  createdAt: number;
};
