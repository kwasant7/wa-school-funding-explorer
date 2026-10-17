/**
 * Tests for the assistant's pure logic - the parts where a silent regression
 * would be invisible in the UI: retrieval matching, and the validation layer
 * that stands between model output and the page.
 *
 * Run with `npm test`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  districtFinanceContext,
  statewideContext,
  statewideHistoryContext,
} from '@/lib/assistant/context';
import { LATEST, YEARS } from '@/lib/data';
import {
  extractBillNumbers,
  findDistrictsInQuery,
  normalizeQuery,
  retrieve,
  tokenize,
} from '@/lib/assistant/retrieval';
import {
  isAllowedRoute,
  isAllowedSection,
  isKnownDistrictCode,
  isKnownYear,
  validateAction,
  validateResponse,
  validateSources,
} from '@/lib/assistant/validation';
import { clampControlValue, isSimulatorControlId } from '@/lib/simulator-config';
import { assistantSource, ASSISTANT_SOURCES } from '@/lib/assistant/knowledge';
import { starterKeyForPath } from '@/lib/assistant/i18n';
import { requestsAction, shouldAutoRun } from '@/lib/assistant/intent';

describe('query normalization', () => {
  it('folds case, curly quotes and whitespace', () => {
    assert.equal(normalizeQuery('  What’s   the  LEVY  cap? '), "what's the levy cap?");
  });

  it('drops stop words and keeps meaningful terms', () => {
    const tokens = tokenize('What is the levy cap for my district?');
    assert.ok(tokens.includes('levy'));
    assert.ok(tokens.includes('cap'));
    assert.ok(!tokens.includes('what'));
    assert.ok(!tokens.includes('the'));
  });

  it('expands abbreviations people actually type', () => {
    assert.ok(tokenize('sped funding').includes('education'));
    assert.ok(tokenize('what is MSOC').includes('materials'));
    assert.ok(tokenize('explain LEA').includes('equalization'));
  });

  it('singularizes so plurals reach the same passages', () => {
    assert.ok(tokenize('levies').includes('levy'));
    assert.ok(tokenize('districts').includes('district'));
  });
});

describe('bill number extraction', () => {
  it('reads the common prefixes', () => {
    assert.deepEqual(extractBillNumbers('what happened to SB 5858?'), ['SB 5858']);
    assert.deepEqual(extractBillNumbers('tell me about ESHB 2049'), ['ESHB 2049']);
    assert.deepEqual(extractBillNumbers('HB2050 changed LEA'), ['HB 2050']);
  });

  it('finds nothing when no bill is mentioned', () => {
    assert.deepEqual(extractBillNumbers('how does the levy cap work?'), []);
  });
});

describe('district matching', () => {
  it('finds a district by its short name', () => {
    const hits = findDistrictsInQuery('how is Bellevue funded?');
    assert.equal(hits[0]?.name, 'Bellevue School District');
  });

  it('finds a district given its full name', () => {
    const hits = findDistrictsInQuery('show me Wahluke School District');
    assert.equal(hits[0]?.code, '13073');
  });

  it('does not match a bare common word that happens to be a district name', () => {
    // "Union Gap" is a district; "union" alone must not drag it in.
    const hits = findDistrictsInQuery('is there a union for teachers?');
    assert.equal(hits.length, 0);
  });

  it('ignores ordinary funding questions', () => {
    assert.equal(findDistrictsInQuery('what does per-student funding include?').length, 0);
  });

  /*
    Washington has two East Valleys and two West Valleys, told apart only by a
    parenthetical county. Naming the shared part used to match neither: the
    indexed name is "east valley spokane", and a visitor typing the official
    name puts "School District" between those halves. What came back instead
    were Spokane School District and Valley School District - two unrelated
    districts, each a substring of what was typed, ranked above the one meant.
  */
  it('returns both districts that share a name, not the words inside it', () => {
    const names = findDistrictsInQuery('Tell me about East Valley School District').map(
      (hit) => hit.name
    );
    assert.deepEqual(names.sort(), [
      'East Valley School District (Spokane)',
      'East Valley School District (Yakima)',
    ]);
  });

  it('matches a full official name, qualifier and all', () => {
    const hits = findDistrictsInQuery('how is East Valley School District (Spokane) funded?');
    assert.equal(hits[0]?.code, '32361');
  });

  it('matches a name that carries a bare district number', () => {
    const hits = findDistrictsInQuery('Index Elementary School District 63');
    assert.equal(hits[0]?.code, '31063');
  });

  it('still prefers the more specific of two overlapping names', () => {
    const hits = findDistrictsInQuery('Union Gap School District');
    assert.equal(hits[0]?.name, 'Union Gap School District');
  });
});

describe('statewide history context', () => {
  it('covers every school year the site holds', () => {
    const history = statewideHistoryContext();
    assert.deepEqual(
      history.map((row) => row.schoolYear),
      [...YEARS]
    );
  });

  it('carries the figures a year-over-year question asks for', () => {
    const latest = statewideHistoryContext().find((row) => row.schoolYear === LATEST);
    const current = statewideContext(LATEST);
    assert.equal(latest?.revenueTotal, current.revenue.total);
    assert.equal(latest?.perPupilAverage, current.perPupil.average);
    assert.equal(latest?.perPupilMedian, current.perPupil.median);
  });
});

describe('district finance context', () => {
  /*
    allocation.json and spending.json describe one year. Attaching them to any
    other year would put a real figure under a wrong label, which is worse than
    omitting it.
  */
  it('omits allocation and spending for a year they do not describe', () => {
    const older = districtFinanceContext('17001', YEARS[0]);
    assert.equal(older?.allocation ?? null, null);
    assert.equal(older?.spending ?? null, null);
  });

  it('carries allocation and spending for the year they do describe', () => {
    const finance = districtFinanceContext('17001', LATEST);
    assert.ok(finance?.allocation, 'expected an allocation for the latest year');
    assert.ok(finance?.spending, 'expected spending for the latest year');
  });

  it('labels the levy with its own school year, not the year in view', () => {
    const finance = districtFinanceContext('17001', LATEST);
    assert.ok(finance?.levy);
    assert.notEqual(finance.levy.levySchoolYear, LATEST);
    assert.match(finance.levy.levySchoolYear, /^\d{4}-\d{2}$/);
  });

  /*
    Entitlement and receipt are different figures for different years, and the
    gap is wide enough that presenting one as the other misstates a district's
    position by millions.
  */
  it('keeps payable and actual Local Effort Assistance apart', () => {
    const spokane = districtFinanceContext('32081', LATEST);
    assert.ok(spokane?.levy);
    assert.equal(spokane.levy.eligible, true);
    assert.notEqual(spokane.levy.payableLea, spokane.levy.actualLea);
  });

  it('reports a district that does not qualify for LEA as ineligible', () => {
    const seattle = districtFinanceContext('17001', LATEST);
    assert.equal(seattle?.levy?.eligible, false);
    assert.equal(seattle?.levy?.actualLea, 0);
  });
});

describe('retrieval', () => {
  it('returns the levy passage for a levy question', () => {
    const ids = retrieve('why is the levy cap blocking money voters approved?').chunks.map(
      (chunk) => chunk.id
    );
    assert.ok(ids.includes('levy-cap'));
  });

  it('returns the FTE passage when asked about enrollment counts', () => {
    const ids = retrieve('why are there two different student counts?').chunks.map(
      (chunk) => chunk.id
    );
    assert.ok(ids.includes('funding-fte-vs-headcount'));
  });

  it('falls back to orientation passages for an unmatched question', () => {
    const result = retrieve('zzzz qqqq');
    assert.ok(result.chunks.length > 0);
  });

  it('strips retrieval-only keywords before sending', () => {
    const [chunk] = retrieve('special education multiplier').chunks;
    assert.deepEqual(Object.keys(chunk).sort(), ['id', 'sourceIds', 'text', 'title']);
  });

  it('bounds how much it sends', () => {
    assert.ok(retrieve('funding levy district education students', 4).chunks.length <= 4);
  });
});

describe('simulator control bounds', () => {
  it('accepts a value inside the range', () => {
    const result = clampControlValue('spedMultiplier', 1.5);
    assert.deepEqual(result, { value: 1.5, clamped: false });
  });

  it('clamps above the maximum', () => {
    const result = clampControlValue('spedMultiplier', 99);
    assert.equal(result?.value, 3);
    assert.equal(result?.clamped, true);
  });

  it('clamps below current law rather than cutting funding', () => {
    const result = clampControlValue('msoc', 0);
    assert.equal(result?.value, 1_614);
    assert.equal(result?.clamped, true);
  });

  it('rejects non-finite values', () => {
    assert.equal(clampControlValue('msoc', Number.NaN), null);
    assert.equal(clampControlValue('msoc', Number.POSITIVE_INFINITY), null);
  });

  it('rejects unknown control ids', () => {
    assert.equal(isSimulatorControlId('teacherPay'), false);
    assert.equal(isSimulatorControlId('spedMultiplier'), true);
  });
});

describe('allow-lists', () => {
  it('accepts only real routes', () => {
    assert.equal(isAllowedRoute('/simulator'), true);
    assert.equal(isAllowedRoute('/admin'), false);
    assert.equal(isAllowedRoute('https://evil.example'), false);
  });

  it('accepts only known sections', () => {
    assert.equal(isAllowedSection('simulator-controls'), true);
    assert.equal(isAllowedSection('anything-else'), false);
  });

  it('accepts only real district codes and years', () => {
    assert.equal(isKnownDistrictCode('17405'), true);
    assert.equal(isKnownDistrictCode('00000'), false);
    assert.equal(isKnownYear('2024-25'), true);
    assert.equal(isKnownYear('2030-31'), false);
  });

  it('resolves only known source ids', () => {
    assert.ok(assistantSource('site-simulator'));
    assert.equal(assistantSource('made-up-source'), null);
  });

  it('publishes no source with an unexpected scheme', () => {
    for (const source of ASSISTANT_SOURCES) {
      assert.ok(
        source.url.startsWith('https://') || source.url.startsWith('/'),
        `${source.id} has an unexpected URL: ${source.url}`
      );
    }
  });
});

describe('action validation', () => {
  it('passes a well-formed navigate', () => {
    assert.deepEqual(validateAction({ type: 'navigate', route: '/districts' }), {
      type: 'navigate',
      route: '/districts',
    });
  });

  it('rejects an off-site navigate', () => {
    assert.equal(validateAction({ type: 'navigate', route: 'https://evil.example' }), null);
  });

  it('rejects an unknown district', () => {
    assert.equal(validateAction({ type: 'select_district', districtCode: '99999' }), null);
  });

  it('rejects a year the site has no data for', () => {
    assert.equal(validateAction({ type: 'set_school_year', year: '2031-32' }), null);
  });

  it('clamps an out-of-range simulator value instead of passing it through', () => {
    assert.deepEqual(
      validateAction({ type: 'set_simulator_control', controlId: 'spedMultiplier', value: 12 }),
      { type: 'set_simulator_control', controlId: 'spedMultiplier', value: 3 }
    );
  });

  it('rejects a non-numeric simulator value', () => {
    assert.equal(
      validateAction({ type: 'set_simulator_control', controlId: 'msoc', value: '2000' }),
      null
    );
  });

  it('rejects an unknown action type', () => {
    assert.equal(validateAction({ type: 'delete_everything' }), null);
    assert.equal(validateAction(null), null);
    assert.equal(validateAction('navigate'), null);
  });
});

describe('source validation', () => {
  it('resolves ids to real records and drops invented ones', () => {
    const sources = validateSources(['site-simulator', 'not-a-source', 'rcw-84-52-0531']);
    assert.deepEqual(
      sources.map((source) => source.id),
      ['site-simulator', 'rcw-84-52-0531']
    );
  });

  it('never accepts a model-supplied URL', () => {
    const sources = validateSources([
      { id: 'site-simulator', url: 'https://evil.example' } as unknown,
    ]);
    assert.equal(sources[0].url, '/simulator');
  });

  it('deduplicates', () => {
    assert.equal(validateSources(['site-home', 'site-home']).length, 1);
  });
});

describe('response validation', () => {
  it('accepts a complete response', () => {
    const result = validateResponse({
      reply: 'The levy cap limits local collections.',
      actions: [{ type: 'navigate', route: '/simulator' }],
      sources: ['rcw-84-52-0531'],
      suggestedQuestions: ['What is LEA?', 'How is my district affected?'],
      confidence: 'high',
    });
    assert.equal(result?.reply, 'The levy cap limits local collections.');
    assert.equal(result?.actions.length, 1);
    assert.equal(result?.sources.length, 1);
    assert.equal(result?.confidence, 'high');
  });

  it('rejects an empty reply', () => {
    assert.equal(validateResponse({ reply: '   ', confidence: 'high' }), null);
    assert.equal(validateResponse({}), null);
    assert.equal(validateResponse(null), null);
  });

  it('drops invalid actions but keeps the answer', () => {
    const result = validateResponse({
      reply: 'Here is an answer.',
      actions: [{ type: 'navigate', route: '/evil' }, { type: 'reset_simulator' }],
      sources: [],
      suggestedQuestions: [],
      confidence: 'medium',
    });
    assert.equal(result?.actions.length, 1);
    assert.equal(result?.actions[0].type, 'reset_simulator');
  });

  it('defaults an unrecognised confidence to low', () => {
    const result = validateResponse({ reply: 'x', confidence: 'certain' });
    assert.equal(result?.confidence, 'low');
  });

  it('caps suggested questions at three', () => {
    const result = validateResponse({
      reply: 'x',
      suggestedQuestions: ['a', 'b', 'c', 'd', 'e'],
      confidence: 'low',
    });
    assert.equal(result?.suggestedQuestions.length, 3);
  });

  it('caps how many actions one answer may perform', () => {
    const result = validateResponse({
      reply: 'x',
      actions: Array.from({ length: 9 }, () => ({ type: 'reset_simulator' })),
      confidence: 'low',
    });
    assert.ok((result?.actions.length ?? 0) <= 3);
  });
});

describe('action intent gating', () => {
  it('treats explicit commands as requests', () => {
    assert.equal(requestsAction('take me to the simulator'), true);
    assert.equal(requestsAction('show me Bellevue'), true);
    assert.equal(requestsAction('switch to 2023-24'), true);
    assert.equal(requestsAction('set the multiplier to 1.5'), true);
  });

  it('recognises commands in other site languages', () => {
    assert.equal(requestsAction('muéstrame Bellevue'), true);
    assert.equal(requestsAction('打开模拟器'), true);
    assert.equal(requestsAction('покажи данные'), true);
  });

  it('does not treat an explanatory question as a request', () => {
    assert.equal(requestsAction('what is the levy cap?'), false);
    assert.equal(requestsAction('why does my district get less money?'), false);
  });

  it('does not fire on a cue buried inside another word', () => {
    // "changed" contains "change"; a past-tense question is not a command.
    assert.equal(requestsAction('what changed in 2023-24?'), false);
    assert.equal(requestsAction('which districts opened after 2019?'), false);
  });

  it('does not fire on this site\'s own starter questions', () => {
    assert.equal(
      requestsAction('How does this district compare with the state average?'),
      false
    );
    assert.equal(requestsAction('Which setting has the largest statewide effect?'), false);
    assert.equal(requestsAction('Explain this district\'s funding sources.'), false);
  });

  it('always allows viewport-only actions, but gates state changes', () => {
    const scroll = { type: 'scroll_to_section', sectionId: 'trends' } as const;
    const setYear = { type: 'set_school_year', year: '2023-24' } as const;
    assert.equal(shouldAutoRun(scroll, 'what are the trends?'), true);
    assert.equal(shouldAutoRun(setYear, 'what changed in 2023-24?'), false);
    assert.equal(shouldAutoRun(setYear, 'switch to 2023-24'), true);
  });
});

describe('starter question routing', () => {
  it('maps each page, base path and trailing slash included', () => {
    assert.equal(starterKeyForPath('/'), 'home');
    assert.equal(starterKeyForPath('/districts'), 'districts');
    assert.equal(starterKeyForPath('/simulator/'), 'simulator');
    assert.equal(starterKeyForPath('/wa-school-funding-explorer/take-action/'), 'takeAction');
    assert.equal(starterKeyForPath('/sources'), 'sources');
    assert.equal(starterKeyForPath('/lea'), 'lea');
  });
});

describe('statewide context', () => {
  it('reports the real figures for the year asked for, not the latest year', () => {
    const latest = statewideContext(LATEST);
    assert.equal(latest.schoolYear, LATEST);
    assert.ok(latest.perPupil.average > 0);
    assert.ok(latest.revenue.total > 0);

    // The point of taking a year argument: an earlier year must differ.
    const earlier = statewideContext(YEARS[0]);
    assert.equal(earlier.schoolYear, YEARS[0]);
    assert.notEqual(earlier.perPupil.average, latest.perPupil.average);
  });

  it('keeps the per-pupil spread ordered, so min/median/max cannot be quoted as each other', () => {
    const { perPupil } = statewideContext(LATEST);
    assert.ok(perPupil.min < perPupil.median, 'min below median');
    assert.ok(perPupil.median < perPupil.max, 'median below max');
    assert.ok(perPupil.average >= perPupil.min && perPupil.average <= perPupil.max);
  });

  it('falls back to the latest year rather than throwing on an unknown one', () => {
    assert.equal(statewideContext('1999-00').schoolYear, LATEST);
  });

  it('adds up: the revenue split equals the total', () => {
    const { revenue } = statewideContext(LATEST);
    const parts = revenue.state + revenue.local + revenue.federal + revenue.other;
    // Rounded independently, so allow a dollar of drift per component.
    assert.ok(Math.abs(parts - revenue.total) <= 4, `${parts} vs ${revenue.total}`);
  });
});
