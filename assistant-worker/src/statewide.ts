/**
 * Statewide figures, rendered for the model as prose.
 *
 * Kept out of openai.ts because it is pure formatting with no dependencies,
 * which makes it directly testable - the assembly in buildInput is not.
 */
import { bigDollars, commas, dollars, labelled, num } from './format.ts';

/**
 * Render the statewide figures as prose rather than leaving them in the JSON
 * dump below.
 *
 * Two reasons, both observed rather than theoretical. The model quotes JSON
 * paths back at visitors - "see the statewide block under perPupil" - and no
 * amount of forbidding it in the prompt stopped that, because the key names
 * were sitting in front of it. And money formatted here is money the model
 * cannot reformat into a wall of digits.
 */
export function statewideSection(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const revenue =
    record.revenue && typeof record.revenue === 'object'
      ? (record.revenue as Record<string, unknown>)
      : {};
  const perPupil =
    record.perPupil && typeof record.perPupil === 'object'
      ? (record.perPupil as Record<string, unknown>)
      : {};

  const year = typeof record.schoolYear === 'string' ? record.schoolYear : null;
  const total = num(revenue.total);
  const average = num(perPupil.average);
  // Without a total or an average there is nothing worth a section of its own.
  if (!year || (total === null && average === null)) return null;

  const lines: string[] = [];
  if (total !== null) {
    const split = labelled(
      [
        ['state', revenue.state],
        ['local', revenue.local],
        ['federal', revenue.federal],
        ['other', revenue.other],
      ],
      bigDollars
    );
    lines.push(
      `Total revenue for all Washington school districts: ${bigDollars(total)}.` +
        (split.length > 0 ? ` By source: ${split.join('; ')}.` : '')
    );
  }
  const spending = num(record.expenditures);
  if (spending !== null) lines.push(`Total spending: ${bigDollars(spending)}.`);

  const headcount = num(record.headcount);
  const fundingEnrollment = num(record.fundingEnrollment);
  const districtCount = num(record.districtCount);
  if (headcount !== null) {
    lines.push(
      `Students: ${commas(headcount)} October headcount` +
        (fundingEnrollment !== null ? `, ${commas(fundingEnrollment)} funding FTE` : '') +
        (districtCount !== null ? `, across ${commas(districtCount)} districts` : '') +
        '.'
    );
  }

  const spread = labelled(
    [
      ['average', perPupil.average],
      ['median', perPupil.median],
      ['lowest', perPupil.min],
      ['highest', perPupil.max],
    ],
    dollars
  );
  if (spread.length > 0) {
    lines.push(
      `Per-pupil funding across districts: ${spread.join(', ')}. ` +
        'These describe the spread across districts; they are not any one district\'s figure, ' +
        'and they do not identify which district is highest or lowest.'
    );
  }

  /*
    Worded as a fact sheet, not a place, and deliberately not a markdown
    heading. Earlier wordings like "Washington statewide totals" got quoted
    straight back to visitors as a page to go and look at, which does not
    exist - and a "## ..." title got echoed the same way, including verbatim in
    English inside a Spanish reply.
  */
  return (
    `The figures below are this website's published statewide figures for Washington, all ` +
    `districts, ${year}. State them directly. This is data, not a page on the site: never ` +
    'quote these words back to the visitor and never refer them to it.\n' +
    lines.join(' ')
  );
}
