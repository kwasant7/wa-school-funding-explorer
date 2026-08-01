/**
 * The strict JSON Schema the model must fill in, plus the matching types.
 *
 * Duplicated deliberately from the Next app's src/lib/assistant/types.ts: the
 * Worker is a separate deployment with its own build and cannot import from
 * the site. The two are kept small so keeping them in step is cheap - if you
 * change one, change the other.
 *
 * `strict: true` plus `additionalProperties: false` everywhere means the
 * provider enforces the shape, so parsing here is a formality rather than a
 * hope. Every property is listed in `required` because strict mode requires
 * it; optionality is expressed by allowing an empty array instead.
 */

export const RESPONSE_SCHEMA_NAME = 'respond_to_visitor';

export type WorkerAction = Record<string, unknown>;

export type WorkerResponse = {
  reply: string;
  actions: WorkerAction[];
  sources: string[];
  suggestedQuestions: string[];
  confidence: 'high' | 'medium' | 'low';
};

/**
 * Actions are modelled as one open object rather than a discriminated union of
 * seven variants.
 *
 * `anyOf` with per-variant required fields is legal JSON Schema but strict
 * Structured Outputs is far more restrictive about it, and a rejected schema
 * fails the whole request. A single object with every field optional-by-null
 * is accepted reliably, and the browser narrows and validates each action
 * against the real district codes, years, and slider bounds anyway - which is
 * the check that actually matters, and one the schema could never perform.
 */
const ACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      enum: [
        'navigate',
        'scroll_to_section',
        'highlight_section',
        'select_district',
        'clear_district',
        'set_school_year',
        'set_simulator_control',
        'reset_simulator',
        'open_source',
      ],
      description: 'Which action to perform.',
    },
    route: {
      type: ['string', 'null'],
      enum: ['/', '/districts', '/simulator', '/take-action', '/sources', '/lea', null],
      description: 'For navigate: the internal route.',
    },
    sectionId: {
      type: ['string', 'null'],
      description:
        'For scroll_to_section or highlight_section: an id from availableSections in the context.',
    },
    districtCode: {
      type: ['string', 'null'],
      description:
        'For select_district: the district code exactly as given in the context or sources.',
    },
    year: {
      type: ['string', 'null'],
      description: 'For set_school_year: a value from availableYears in the context.',
    },
    controlId: {
      type: ['string', 'null'],
      enum: [
        'levyPerPupil',
        'leaThreshold',
        'ellWeight',
        'spedMultiplier',
        'msoc',
        'transportation',
        'povertyBonus',
        null,
      ],
      description: 'For set_simulator_control: which slider.',
    },
    value: {
      type: ['number', 'null'],
      description: 'For set_simulator_control: the requested value in the slider’s own units.',
    },
    sourceId: {
      type: ['string', 'null'],
      description: 'For open_source: an id from availableSources.',
    },
  },
  required: [
    'type',
    'route',
    'sectionId',
    'districtCode',
    'year',
    'controlId',
    'value',
    'sourceId',
  ],
} as const;

export const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: {
      type: 'string',
      description:
        'The answer for the visitor, in their language. Short by default - usually 40-90 words, leading with the direct answer and naming where on the site to see more. Longer only when the site does not cover the question or the visitor asked for depth. Plain text or light Markdown (bold, bullets, numbered lists).',
    },
    actions: {
      type: 'array',
      description:
        'Website actions to perform. Empty unless the visitor clearly asked for one.',
      items: ACTION_SCHEMA,
    },
    sources: {
      type: 'array',
      description:
        'Source IDs from availableSources that back this answer. Never invent an ID or a URL. Empty for pure navigation replies.',
      items: { type: 'string' },
    },
    suggestedQuestions: {
      type: 'array',
      description: 'Up to three short follow-up questions, in the visitor’s language.',
      items: { type: 'string' },
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description:
        'high when the supplied context fully answers the question; low when it does not.',
    },
  },
  required: ['reply', 'actions', 'sources', 'suggestedQuestions', 'confidence'],
} as const;
