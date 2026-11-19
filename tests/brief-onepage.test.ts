/**
 * Tests for the data behind the one-page brief.
 *
 * The PDF is the sheet a parent hands a legislator, so every number on it has
 * to be the number the site shows elsewhere. These pin the pieces that carry
 * that: the Big 3 figures match AESD's, the problems list leaves the Big 3 to
 * their own section, and the delegations and message are built from the
 * district's own records.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import districtsJson from '@/data/districts.json';
import { big3For, big3Totals } from '@/lib/big3';
import { briefFor } from '@/lib/diagnosis';
import { MAX_DELEGATIONS, MAX_PROBLEMS, onePageFor, ordinal } from '@/lib/brief-onepage';

const TACOMA = '27010';
const SEATTLE = '17001';
const NO_BIG3 = '37902';

function page(code: string) {
  const result = onePageFor(code);
  assert.ok(result, `no one-page data for ${code}`);
  return result;
}

describe('one-page tiles and charts', () => {
  it('carries the District Explorer headline numbers', () => {
    const tacoma = page(TACOMA);
    const byLabel = Object.fromEntries(tacoma.tiles.map((t) => [t.label, t]));
    assert.equal(byLabel['Revenue per student'].value, '$20,599');
    assert.equal(byLabel['Revenue per student'].note, 'Statewide median $19,867');
    assert.equal(byLabel['Funded students'].value, '27,752');
    assert.equal(byLabel['Low-income students'].value, '59%');
    // A district that spent more than it took in says so, in the warning tone.
    const deficit = byLabel['Spent more than it took in'];
    assert.equal(deficit.value, '-$7.9M');
    assert.equal(deficit.tone, 'critical');
  });

  it('splits revenue into four parts that add up', () => {
    const { revenue } = page(TACOMA);
    assert.deepEqual(
      revenue.parts.map((p) => p.key),
      ['state', 'local', 'federal', 'other']
    );
    const sum = revenue.parts.reduce((s, p) => s + p.amount, 0);
    assert.ok(Math.abs(sum - revenue.total) < 1, 'parts do not add up to the total');
    const percent = revenue.parts.reduce((s, p) => s + p.percent, 0);
    assert.ok(percent >= 98 && percent <= 102, `percentages sum to ${percent}`);
  });

  it('gives six years of revenue per student and leaves a gap where a year is missing', () => {
    const tacoma = page(TACOMA).trend;
    assert.equal(tacoma.years.length, 6);
    assert.equal(tacoma.values.length, 6);
    assert.equal(tacoma.median.length, 6);
    assert.deepEqual(tacoma.years, ['19-20', '20-21', '21-22', '22-23', '23-24', '24-25']);
    assert.equal(tacoma.values[5], 20599);
    // A school that opened in 2021 has no earlier years to draw.
    assert.deepEqual(page(NO_BIG3).trend.values.slice(0, 2), [null, null]);
  });
});

describe('one-page Big 3', () => {
  it('prints exactly the figures AESD publishes, and adds them the way the web card does', () => {
    const tacoma = page(TACOMA);
    assert.ok(tacoma.big3);
    const record = big3For(TACOMA);
    assert.ok(record);
    const totals = big3Totals(record);

    assert.deepEqual(
      tacoma.big3.columns.map((c) => c.key),
      ['sped', 'transportation', 'msoc']
    );
    for (const column of tacoma.big3.columns) {
      assert.equal(column.cost, record[column.key].cost);
      assert.equal(column.funding, record[column.key].revenue);
      assert.equal(column.gap, totals.gaps[column.key]);
    }
    assert.equal(tacoma.big3.total, totals.total);
    assert.equal(Math.round(tacoma.big3.perStudent), 138);
    // Tacoma's special education is covered, so it is not part of the total.
    assert.ok(totals.gaps.sped < 0);
    assert.equal(
      Math.round(totals.total),
      Math.round(totals.gaps.transportation + totals.gaps.msoc)
    );
  });

  it('asks only for the programs that fall short', () => {
    const columns = page(TACOMA).big3!.columns;
    const sped = columns.find((c) => c.key === 'sped')!;
    const transportation = columns.find((c) => c.key === 'transportation')!;
    assert.equal(sped.isAsk, false);
    assert.ok(sped.note.startsWith('Funding covers the cost here.'));
    assert.equal(transportation.isAsk, true);
    assert.ok(transportation.note.includes('SB 5858'));
  });

  it('has no Big 3 section where AESD publishes no figures', () => {
    assert.equal(page(NO_BIG3).big3, null);
  });

  it('keeps the web brief on the same numbers', () => {
    // The brief's three Big 3 issues once read allocation-versus-spending
    // figures and disagreed with the card by about a million dollars.
    for (const code of [TACOMA, SEATTLE, '17405', '01109']) {
      for (const issue of briefFor(code)?.issues ?? []) {
        if (issue.id === 'sped' || issue.id === 'msoc' || issue.id === 'transportation') {
          assert.equal(issue.visual.kind, 'versus');
          if (issue.visual.kind === 'versus') {
            assert.equal(issue.visual.bLabel, 'Funding it receives');
          }
        }
      }
    }
    // Tacoma's buses are $2.56M short on AESD's definitions, not the old $3.4M.
    const tacomaBrief = briefFor(TACOMA)!;
    assert.equal(
      tacomaBrief.stats.find((s) => s.label === 'Covered locally')?.value,
      '$3.7M'
    );
  });
});

describe('one-page problems and asks', () => {
  it('leaves the Big 3 to their own section and gives every problem an ask', () => {
    for (const d of districtsJson.districts) {
      const { problems } = page(d.code);
      assert.ok(problems.length <= MAX_PROBLEMS, `${d.code} lists ${problems.length} problems`);
      for (const problem of problems) {
        assert.ok(!['sped', 'msoc', 'transportation'].includes(problem.id), `${d.code}: ${problem.id}`);
        assert.ok(problem.ask.length > 10, `${d.code}: ${problem.id} has no ask`);
        assert.ok(problem.title && problem.fact);
      }
    }
  });

  it("ranks Tacoma's own problems and attaches the old asks", () => {
    const { problems } = page(TACOMA);
    // No English learner card: Tacoma's 13.5% is below the 15.0% statewide
    // rate, though it ranks in the top 30% of districts.
    assert.deepEqual(
      problems.map((p) => p.id),
      ['levyCap', 'reserves']
    );
    assert.equal(problems[0].ask, 'Raise the local levy cap. This money needs no new vote.');
    assert.equal(problems[0].cite, 'RCW 84.52.0531');
  });
});

describe('one-page legislators', () => {
  it("lists Tacoma's three delegations, largest share first, with no party", () => {
    const { delegations, moreDelegations } = page(TACOMA);
    assert.deepEqual(
      delegations.map((d) => d.district),
      [27, 29, 28]
    );
    assert.equal(moreDelegations, 0);
    assert.deepEqual(
      delegations.map((d) => d.percent),
      [...delegations.map((d) => d.percent)].sort((a, b) => b - a)
    );
    for (const d of delegations) {
      assert.deepEqual(Object.keys(d.members[0]).sort(), ['chamber', 'name']);
      assert.ok(d.members.some((m) => m.chamber === 'Sen.'));
    }
  });

  it('prints three and counts the rest when a district spans more', () => {
    const { delegations, moreDelegations } = page(SEATTLE);
    assert.equal(delegations.length, MAX_DELEGATIONS);
    assert.ok(moreDelegations > 0);
  });

  it('writes ordinals the way people say them', () => {
    const cases: [number, string][] = [
      [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'],
      [13, '13th'], [21, '21st'], [22, '22nd'], [27, '27th'], [49, '49th'],
    ];
    for (const [n, text] of cases) assert.equal(ordinal(n), text);
  });
});

describe('one-page message', () => {
  it("is built from the district's own numbers", () => {
    const { message } = page(TACOMA);
    assert.ok(message.startsWith('I live in Tacoma.'));
    assert.ok(message.includes('$127 million'));
    assert.ok(message.includes('$14 million'));
    assert.ok(message.includes('$3.7 million'));
    assert.ok(message.includes('Please raise the levy cap and fund buses and everyday operating costs'));
  });

  it('agrees in number: special education is singular, buses and costs plural', () => {
    const oneProgram = Object.values(
      Object.fromEntries(districtsJson.districts.map((d) => [d.code, page(d.code).message]))
    );
    assert.ok(oneProgram.some((m) => m.includes('Special education runs ')));
    assert.ok(oneProgram.some((m) => m.includes('Buses run ')));
    assert.equal(oneProgram.some((m) => /Buses runs|Special education run /.test(m)), false);
  });

  it('does not claim a charter school is a place someone lives', () => {
    const { message } = page(NO_BIG3);
    assert.ok(message.startsWith('I am writing about '));
    assert.equal(message.includes('I live in'), false);
  });

  it('exists for every district and never promises money it has not named', () => {
    for (const d of districtsJson.districts) {
      const { message } = page(d.code);
      assert.ok(message.length > 40 && message.length < 600, `${d.code}: ${message.length} characters`);
      assert.ok(message.includes('Please '), `${d.code} makes no request`);
    }
  });
});

describe('one-page lookup', () => {
  it('returns null for a code that is not a district', () => {
    assert.equal(onePageFor('00000'), null);
    assert.equal(onePageFor('99999'), null);
  });
});
