'use client';

/**
 * Assembles the compact context object sent with each question.
 *
 * Everything numeric comes from the data modules and the assistant store, not
 * from reading the rendered page. Only two things are read from the DOM: the
 * visible headings and a short text excerpt, which give the model a sense of
 * what the visitor is actually looking at. Both are bounded hard - the whole
 * page would be tens of thousands of tokens and most of it is chrome.
 */
import {
  ALLOWED_SECTIONS,
  type AllowedSectionId,
  type AssistantLanguage,
  type AssistantPageContext,
  type ContextDistrict,
  type ContextSimulator,
} from '@/lib/assistant/types';
import { assistantSnapshot } from '@/lib/assistant/store';
import { LATEST, YEARS, yearData } from '@/lib/data';
import { oversightFor } from '@/data/oversight';
import districtsData from '@/data/districts.json';

const MAX_HEADINGS = 8;
const MAX_EXCERPT_CHARS = 1_200;

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((1000 * part) / whole) / 10 : 0;
}

/** A district's figures for one school year, or null if it has no row that year. */
export function districtContext(
  code: string,
  schoolYear: string
): ContextDistrict | null {
  const year = YEARS.includes(schoolYear) ? schoolYear : LATEST;
  const record = yearData(year).districts.find((district) => district.code === code);
  if (!record) return null;
  const oversight = oversightFor(code);
  return {
    code: record.code,
    name: record.name,
    county: record.county,
    esd: record.esd,
    schoolYear: year,
    fundingEnrollment: Math.round(record.fundingEnrollment),
    headcount: record.enrollment,
    perPupil: Math.round(record.perPupil),
    revenue: {
      state: Math.round(record.rev.state),
      local: Math.round(record.rev.local),
      federal: Math.round(record.rev.federal),
      other: Math.round(record.rev.other),
      total: Math.round(record.rev.total),
    },
    expenditures: Math.round(record.exp),
    surplus: Math.round(record.surplus),
    fundBalance: record.fundBalance == null ? null : Math.round(record.fundBalance),
    reserveRatio: record.reserveRatio,
    demographics: {
      lowIncomePct: pct(record.demo.lowIncome, record.enrollment),
      ellPct: pct(record.demo.ell, record.enrollment),
      spedPct: pct(record.demo.sped, record.enrollment),
      homelessPct: pct(record.demo.homeless, record.enrollment),
      highlyCapablePct: pct(record.demo.highlyCapable, record.enrollment),
    },
    oversight: oversight ? `${oversight.level}: ${oversight.detail}` : null,
  };
}

/**
 * Headings currently on screen. Gives the model the page's structure without
 * shipping the page.
 */
function visibleHeadings(): string[] {
  if (typeof document === 'undefined') return [];
  const nodes = Array.from(document.querySelectorAll('main h1, main h2'));
  const headings: string[] = [];
  for (const node of nodes) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text && text.length <= 120 && !headings.includes(text)) headings.push(text);
    if (headings.length >= MAX_HEADINGS) break;
  }
  return headings;
}

/**
 * A short excerpt of the page's own prose.
 *
 * Paragraphs only - tables and charts are already represented as structured
 * numbers elsewhere in the context, and their flattened text is mostly noise.
 */
function pageExcerpt(): string {
  if (typeof document === 'undefined') return '';
  const paragraphs = Array.from(document.querySelectorAll('main p'));
  const parts: string[] = [];
  let total = 0;
  for (const node of paragraphs) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < 40) continue;
    parts.push(text);
    total += text.length;
    if (total >= MAX_EXCERPT_CHARS) break;
  }
  return parts.join(' ').slice(0, MAX_EXCERPT_CHARS);
}

/** Which addressable regions this page actually rendered. */
function availableSections(): AllowedSectionId[] {
  if (typeof document === 'undefined') return [];
  const found: AllowedSectionId[] = [];
  for (const id of ALLOWED_SECTIONS) {
    if (document.querySelector(`[data-assistant-section="${id}"]`)) found.push(id);
  }
  return found;
}

function simulatorContext(): ContextSimulator | null {
  const snapshot = assistantSnapshot();
  if (!snapshot.simulatorValues) return null;
  const changed = snapshot.simulatorValues
    .filter((entry) => entry.value !== entry.baseline)
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      baseline: Math.round(entry.baseline * 1000) / 1000,
      value: Math.round(entry.value * 1000) / 1000,
    }));
  const impact = snapshot.simulatorImpact;
  return {
    changed,
    districtImpact: impact
      ? {
          stateDollars: Math.round(impact.stateDollars),
          localDollars: Math.round(impact.localDollars),
          levyAlreadyApproved: Math.round(impact.levyAlreadyApproved),
          levyNeedsVote: Math.round(impact.levyNeedsVote),
          breakdown: impact.breakdown
            .slice(0, 7)
            .map((item) => ({ label: item.label, amount: Math.round(item.amount) })),
        }
      : null,
  };
}

/**
 * Build the full context. `extraDistrictCode` carries a district the visitor
 * named in their question but has not selected, so "how does Yakima compare?"
 * can be answered with Yakima's real figures instead of a refusal.
 */
export function buildContext(options: {
  pathname: string;
  language: AssistantLanguage;
  extraDistrictCode?: string | null;
}): AssistantPageContext {
  const { pathname, language, extraDistrictCode = null } = options;
  const snapshot = assistantSnapshot();
  const schoolYear = snapshot.schoolYear ?? LATEST;

  const selectedCode = snapshot.districtCode;
  const primaryCode = selectedCode ?? extraDistrictCode;
  const district = primaryCode ? districtContext(primaryCode, schoolYear) : null;

  /*
    When the visitor names a district different from the selected one, the
    named district goes in the comparison slot so both sets of figures are
    available and the model does not have to guess which one is meant.
  */
  let comparison: { code: string; name: string } | null = null;
  if (snapshot.comparisonCode) {
    const record = districtsData.districts.find((d) => d.code === snapshot.comparisonCode);
    if (record) comparison = { code: record.code, name: record.name };
  } else if (extraDistrictCode && selectedCode && extraDistrictCode !== selectedCode) {
    const other = districtContext(extraDistrictCode, schoolYear);
    if (other) comparison = { code: other.code, name: other.name };
  }

  return {
    pathname,
    pageTitle: typeof document === 'undefined' ? '' : document.title,
    language,
    headings: visibleHeadings(),
    excerpt: pageExcerpt(),
    schoolYear,
    availableYears: [...YEARS],
    district,
    comparisonDistrict: comparison,
    simulator: simulatorContext(),
    availableSections: availableSections(),
    dataCoverage: {
      firstYear: YEARS[0],
      latestYear: LATEST,
      districtCount: districtsData.districts.length,
    },
  };
}

/**
 * The full record for a district named in a question but not selected, so the
 * model can answer about it directly. Returned separately from the primary
 * district so the two never get conflated.
 */
export function extraDistrictContext(
  code: string,
  schoolYear: string | null
): ContextDistrict | null {
  return districtContext(code, schoolYear ?? LATEST);
}
