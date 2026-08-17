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

/**
 * Internal routes the assistant is allowed to navigate to.
 *
 * The six topic explainers belong here as much as the five main tabs do: they
 * are the pages written to answer the questions people actually ask the
 * assistant, and leaving them out meant a reader asking how the prototypical
 * model works could not be taken to the page about the prototypical model.
 */
export const ALLOWED_ROUTES = [
  '/',
  '/districts',
  '/simulator',
  '/take-action',
  '/sources',
  '/lea',
  '/washington-school-funding',
  '/prototypical-school-funding-model',
  '/msoc-funding',
  '/special-education-funding',
  '/school-levies-and-lea',
  '/school-transportation-funding',
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

/**
 * Statewide totals for the year in view.
 *
 * Sent on every question. It is a fixed ~200 bytes and it is what the most
 * common questions on the site are actually about - the average per student,
 * what the state spends in total, how wide the spread between districts is -
 * none of which can be derived from a single district's row.
 */
export type ContextStatewide = {
  schoolYear: string;
  districtCount: number;
  headcount: number;
  fundingEnrollment: number;
  revenue: { state: number; local: number; federal: number; other: number; total: number };
  expenditures: number;
  surplus: number;
  /** Across districts, not across students: an unweighted per-district spread. */
  perPupil: { average: number; median: number; min: number; max: number };
};

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

/**
 * One district, one school year, in the few figures a follow-up question
 * actually asks for.
 *
 * Deliberately much thinner than ContextDistrict. A visitor who has just been
 * told this year's number asks "what about in 22-23?", and answering that
 * needs the headline figures for every year, not the demographic breakdown for
 * every year - which would be six times the payload to answer a question
 * nobody asks.
 */
export type ContextDistrictYear = {
  schoolYear: string;
  fundingEnrollment: number;
  headcount: number;
  perPupil: number;
  revenueTotal: number;
  expenditures: number;
  surplus: number;
  reserveRatio: number | null;
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
  /*
    Carries the same figures as `district`, not just a label. A visitor asking
    "how does Bellevue compare?" while Seattle is selected needs both sets of
    numbers in front of the model, or the comparison is answered from one side.
  */
  comparisonDistrict: ContextDistrict | null;
  /**
   * Every year on record for the district in `district`, so a question about
   * another year is answered rather than deflected to the year control.
   */
  districtHistory: ContextDistrictYear[] | null;
  statewide: ContextStatewide;
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
