/**
 * A district's figures, rendered for the model as prose.
 *
 * Same reasoning as the statewide block, and the same observed failure: shown
 * a JSON dump, the model answers in the dump's vocabulary. Asked for Seattle's
 * funding FTE with the figure sitting right there under `fundingEnrollment`,
 * it replied that the site does not publish a funding FTE, quoted the raw key
 * name at the visitor, and told them to look under "the district context" - a
 * place that does not exist. Naming each figure the way a person would name it
 * fixes all three at once.
 *
 * The introduction has a job too. These figures are the site's own, for
 * whichever district the visitor asked about, so they are answerable wherever
 * that visitor happens to be standing - the model kept treating a district as
 * off-limits unless its page was open. It is also deliberately free of any
 * noun that sounds like a location: told the figures were "read from its own
 * data file", the model started closing replies with "see the Seattle data
 * file", inventing a destination out of the words describing its own input.
 */
import { bigDollars, commas, dollars, labelled, num, record } from './format.ts';

function pct(value: unknown): string | null {
  const n = num(value);
  return n === null ? null : `${n}%`;
}

/**
 * One district as a labelled fact sheet.
 *
 * `role` distinguishes the district the page is showing from one the visitor
 * merely named, so the model can tell which is which without the two blocks
 * running together.
 */
export function districtSection(
  value: unknown,
  role: 'primary' | 'comparison'
): string | null {
  const d = record(value);
  if (!d) return null;

  const name = typeof d.name === 'string' ? d.name : null;
  const year = typeof d.schoolYear === 'string' ? d.schoolYear : null;
  if (!name || !year) return null;

  const revenue = record(d.revenue) ?? {};
  const demographics = record(d.demographics) ?? {};
  const lines: string[] = [];

  const county = typeof d.county === 'string' ? d.county : null;
  const esd = typeof d.esd === 'string' ? d.esd : null;
  if (county || esd) {
    lines.push(
      `Location: ${[county ? `${county} County` : null, esd].filter(Boolean).join(', ')}.`
    );
  }

  /*
    Funding FTE and October headcount are named in full every time. They are
    the pair the site is most often asked about and the pair most often
    conflated, and the JSON key `fundingEnrollment` gave the model no hint
    that it was looking at the FTE figure at all.
  */
  const fte = num(d.fundingEnrollment);
  const headcount = num(d.headcount);
  if (fte !== null) {
    lines.push(
      `Funding FTE (the annual-average full-time-equivalent figure the state funds on): ${commas(fte)}.`
    );
  }
  if (headcount !== null) {
    lines.push(`October headcount (a different figure, do not give it as the FTE): ${commas(headcount)}.`);
  }

  const total = num(revenue.total);
  if (total !== null) {
    const split = labelled(
      [
        ['state', revenue.state],
        ['local levy and other local', revenue.local],
        ['federal', revenue.federal],
        ['other', revenue.other],
      ],
      bigDollars
    );
    lines.push(
      `Total general-fund revenue: ${bigDollars(total)}.` +
        (split.length > 0 ? ` By source: ${split.join('; ')}.` : '')
    );
  }

  const perPupil = num(d.perPupil);
  if (perPupil !== null) {
    lines.push(
      `Funding per student: ${dollars(perPupil)} (total revenue divided by funding FTE).`
    );
  }

  const spending = num(d.expenditures);
  if (spending !== null) lines.push(`Total spending: ${bigDollars(spending)}.`);

  const surplus = num(d.surplus);
  if (surplus !== null) {
    lines.push(
      surplus < 0
        ? `This year it spent ${bigDollars(Math.abs(surplus))} more than it took in, drawing that down from savings.`
        : `This year it took in ${bigDollars(surplus)} more than it spent, adding that to savings.`
    );
  }

  const fundBalance = num(d.fundBalance);
  const reserveRatio = num(d.reserveRatio);
  if (fundBalance !== null || reserveRatio !== null) {
    lines.push(
      'Savings: ' +
        [
          // A fund balance is a district-scale total, so it follows the same
          // "$60.0 million (exact)" convention as revenue - not the bare
          // digits a per-student figure gets.
          fundBalance === null ? null : `${bigDollars(fundBalance)} fund balance at year end`,
          reserveRatio === null
            ? null
            : `a reserve ratio of ${reserveRatio.toFixed(1)}% of annual spending (experts treat 4-5% as the safe minimum)`,
        ]
          .filter(Boolean)
          .join(', ') +
        '.'
    );
  }

  const demo = [
    ['low-income', pct(demographics.lowIncomePct)],
    ['English language learners', pct(demographics.ellPct)],
    ['students with disabilities', pct(demographics.spedPct)],
    ['experiencing homelessness', pct(demographics.homelessPct)],
    ['highly capable', pct(demographics.highlyCapablePct)],
  ]
    .filter(([, v]) => v)
    .map(([label, v]) => `${v} ${label}`);
  if (demo.length > 0) {
    lines.push(`Share of enrolled students: ${demo.join(', ')}.`);
  }

  const oversight = typeof d.oversight === 'string' ? d.oversight : null;
  if (oversight) lines.push(`State financial oversight: ${oversight}.`);

  if (lines.length === 0) return null;

  /*
    Deliberately not a markdown heading. An earlier version opened with
    "## Verified figures you may state directly" and the model closed its
    replies by sending visitors to "the 'Verified figures you may state
    directly' section" - in Spanish, quoting the English title. A model will
    echo a heading as a destination; a sentence it will not.
  */
  const whose =
    role === 'primary'
      ? `${name} for ${year}`
      : `${name} for ${year}, the district the visitor asked about`;

  return (
    `The figures below are this website's published figures for ${whose}. ` +
    'State them directly, whatever page the visitor is on - they do not become ' +
    'unavailable because a district page is closed. This is data, not a place on the site: ' +
    'never quote these words back to the visitor, never name them as a section, and never ' +
    'send the visitor anywhere to find them.\n' +
    lines.join(' ')
  );
}
