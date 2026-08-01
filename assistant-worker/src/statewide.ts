/**
 * Statewide figures, rendered for the model as prose.
 *
 * Kept out of openai.ts because it is pure formatting with no dependencies,
 * which makes it directly testable - the assembly in buildInput is not.
 */
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Thousands separators without depending on Intl being present in the runtime. */
function commas(value: number): string {
  const rounded = Math.round(Math.abs(value)).toString();
  const grouped = rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return value < 0 ? `-${grouped}` : grouped;
}

function dollars(value: number): string {
  return `$${commas(value)}`;
}

/** Big totals read better abbreviated; the exact figure follows in parentheses. */
function bigDollars(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)} billion (${dollars(value)})`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)} million (${dollars(value)})`;
  return dollars(value);
}

/** "state $16.2 billion" for each entry that carries a usable number. */
function labelled(
  pairs: [string, unknown][],
  format: (value: number) => string
): string[] {
  const out: string[] = [];
  for (const [label, raw] of pairs) {
    const value = num(raw);
    if (value !== null) out.push(`${label} ${format(value)}`);
  }
  return out;
}

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
    The heading is worded as a fact sheet, not a place. Earlier wordings like
    "Washington statewide totals" got quoted straight back to visitors as a
    page to go and look at, which does not exist.
  */
  return (
    `## Verified figures you may state directly. Washington, all districts, ${year}. ` +
    'This is data, not a page on the site, so never refer the visitor to it.\n' +
    lines.join(' ')
  );
}
