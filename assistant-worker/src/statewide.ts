/**
 * Statewide figures, rendered for the model as prose.
 *
 * Kept out of openai.ts because it is pure formatting with no dependencies,
 * which makes it directly testable - the assembly in buildInput is not.
 */
import { bigDollars, commas, dollars, labelled, num, record } from './format.ts';

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

  /*
    Stated rather than left to be derived. Revenue and spending were both here
    and the difference was not, so the model subtracted one from the other and
    wrote the result as bare exact dollars - correct, but a computation the
    prompt tells it not to do and in a format the site does not use.
  */
  const surplus = num(record.surplus);
  if (surplus !== null) {
    lines.push(
      surplus < 0
        ? `Districts spent ${bigDollars(Math.abs(surplus))} more than they took in: a deficit.`
        : `Districts took in ${bigDollars(surplus)} more than they spent: a surplus.`
    );
  }

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

  /*
    The extremes are named. Unattributed, the model went from "this block does
    not say which districts these are" to telling visitors the site does not
    publish it - while every district's per-student figure is on the map and in
    the District Explorer.
  */
  const minName = typeof perPupil.minDistrict === 'string' ? perPupil.minDistrict : null;
  const maxName = typeof perPupil.maxDistrict === 'string' ? perPupil.maxDistrict : null;
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
      `Per-pupil funding across districts: ${spread.join(', ')}.` +
        (minName ? ` The lowest is ${minName}.` : '') +
        (maxName ? ` The highest is ${maxName}.` : '') +
        ' These describe the spread across districts; they are not any one district\'s figure. ' +
        'The average is every dollar divided by every student, so it is not the average of the ' +
        'district figures and not the median.'
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


/**
 * Statewide headline figures for every year the site holds, one line each.
 *
 * The statewide block above carries only the year in view, and without this
 * the guide answered "what was the total in 2019-20?" with "the context does
 * not include that" - then answered it correctly the moment the visitor moved
 * the year control themselves. The figure was on the site the whole time.
 */
export function statewideHistorySection(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const lines: string[] = [];
  for (const entry of value) {
    const row = record(entry);
    if (!row) continue;
    const year = typeof row.schoolYear === 'string' ? row.schoolYear : null;
    if (!year) continue;

    const parts = [
      num(row.revenueTotal) === null
        ? null
        : `${bigDollars(num(row.revenueTotal)!)} total revenue`,
      num(row.perPupilAverage) === null
        ? null
        : `${dollars(num(row.perPupilAverage)!)} average per student`,
      num(row.perPupilMedian) === null
        ? null
        : `${dollars(num(row.perPupilMedian)!)} median per student`,
      num(row.headcount) === null
        ? null
        : `${commas(num(row.headcount)!)} October headcount`,
    ].filter(Boolean);
    if (parts.length > 0) lines.push(`${year}: ${parts.join(', ')}.`);
  }

  if (lines.length === 0) return null;

  return (
    'Washington statewide figures for every school year this website holds. Answer a ' +
    'question about any of these years from the matching line, whatever year the page is ' +
    'set to, and say which year your figure is from. Never tell the visitor to change the ' +
    'year control to get an answer that is already here. A year not listed is one the site ' +
    'has no record of. This is data, not a page on the site: never quote these words back ' +
    'to the visitor, and never close by sending them to "the statewide totals" or any other ' +
    'place for a figure that is already in your answer.\n' +
    lines.join('\n')
  );
}

/**
 * Program spending actuals and the levy limits.
 *
 * Both carry their own year rather than the year in view, because neither
 * moves with it: the levy limits are for a later school year than the spending
 * actuals. Every line says which year it describes, so a correct figure cannot
 * be read under the wrong heading.
 */
export function statewideFinanceSection(value: unknown): string | null {
  const d = record(value);
  if (!d) return null;

  const lines: string[] = [];
  const spending = record(d.spending);
  const year = typeof d.schoolYear === 'string' ? d.schoolYear : null;

  if (spending && year) {
    const rows = [
      num(spending.sped) === null
        ? null
        : `special education ${bigDollars(num(spending.sped)!)}` +
          (num(spending.spedPerStudent) === null
            ? ''
            : ` (${dollars(num(spending.spedPerStudent)!)} per student served)`),
      num(spending.transportation) === null
        ? null
        : `student transportation ${bigDollars(num(spending.transportation)!)}` +
          (num(spending.transportationPerStudent) === null
            ? ''
            : ` (${dollars(num(spending.transportationPerStudent)!)} per student)`),
      num(spending.msoc) === null
        ? null
        : `materials, supplies and operating costs ${bigDollars(num(spending.msoc)!)}` +
          (num(spending.msocPerStudent) === null
            ? ''
            : ` (${dollars(num(spending.msocPerStudent)!)} per student)`),
    ].filter(Boolean);
    if (rows.length > 0) {
      lines.push(
        `What districts actually spent statewide in ${year}, from F-196 actuals: ` +
          `${rows.join('; ')}. This is spending, not what the state allocated and not revenue.`
      );
    }
  }

  const limits = record(d.levyLimits);
  if (limits) {
    const levyYear =
      typeof limits.levySchoolYear === 'string' ? limits.levySchoolYear : 'the levy year';
    const cap = num(limits.maxLevyPerPupil);
    const capLarge = num(limits.maxLevyPerPupilLarge);
    const rate = num(limits.maxLevyRate);
    const threshold = num(limits.leaThresholdPerPupil);
    const leaRate = num(limits.leaMaxRate);
    const parts: string[] = [];
    if (cap !== null) {
      parts.push(
        `a district may collect up to ${dollars(cap)} per student` +
          (capLarge !== null
            ? `, or ${dollars(capLarge)} for districts of 40,000 students or more`
            : '')
      );
    }
    if (rate !== null) parts.push(`and no more than $${rate.toFixed(2)} per $1,000 of assessed value`);
    if (parts.length > 0) {
      lines.push(`Enrichment levy limits for ${levyYear}: ${parts.join(', ')}.`);
    }
    if (threshold !== null) {
      lines.push(
        `Local Effort Assistance for ${levyYear} brings a district up to ${dollars(threshold)} ` +
          'per student' +
          (leaRate !== null ? ` at a levy rate of $${leaRate.toFixed(2)} per $1,000` : '') +
          '. LEA is state equalization money paid by the state, not local levy revenue and not ' +
          'federal money.'
      );
    }
  }

  if (lines.length === 0) return null;

  return (
    "These are this website's published statewide spending and levy figures. State them " +
    'directly, with the year each line names. This is data, not a page on the site: never ' +
    'quote these words back to the visitor and never refer them to it.\n' +
    lines.join(' ')
  );
}
