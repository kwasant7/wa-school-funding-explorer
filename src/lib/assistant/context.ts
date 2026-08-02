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
  type ContextDistrictYear,
  type ContextSimulator,
  type ContextStatewide,
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

/**
 * Statewide totals for one school year.
 *
 * Read from `yearData` rather than the latest-year JSON so the figures track
 * whichever year the visitor is looking at: quoting 2024-25 averages at
 * someone viewing 2021-22 would be wrong in a way that looks authoritative.
 */
export function statewideContext(schoolYear: string): ContextStatewide {
  const year = YEARS.includes(schoolYear) ? schoolYear : LATEST;
  const record = yearData(year).statewide;
  return {
    schoolYear: year,
    districtCount: record.districts,
    headcount: record.enrollment,
    fundingEnrollment: Math.round(record.fundingEnrollment),
    revenue: {
      state: Math.round(record.revenues.state),
      local: Math.round(record.revenues.local),
      federal: Math.round(record.revenues.federal),
      other: Math.round(record.revenues.other),
      total: Math.round(record.revenues.total),
    },
    expenditures: Math.round(record.expenditures),
    surplus: Math.round(record.surplus),
    perPupil: {
      average: Math.round(record.avgPerPupil),
      median: Math.round(record.medianPerPupil),
      min: Math.round(record.minPerPupil),
      max: Math.round(record.maxPerPupil),
    },
  };
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
 * Every year this district reported, in headline figures only.
 *
 * The context used to carry the selected year and nothing else, so "what about
 * in 22-23?" - the most natural follow-up there is - got answered with "this
 * page only has 2024-25, switch the year over in the District Explorer". The
 * site holds all six years already; withholding them from the model made the
 * assistant worse at the one thing the data is good for.
 */
export function districtHistoryContext(code: string): ContextDistrictYear[] {
  const history: ContextDistrictYear[] = [];
  for (const year of YEARS) {
    const record = yearData(year).districts.find((district) => district.code === code);
    // Charters and compact schools open and close mid-series, so a missing
    // year is normal and is simply left out rather than sent as zeroes.
    if (!record) continue;
    history.push({
      schoolYear: year,
      fundingEnrollment: Math.round(record.fundingEnrollment),
      headcount: record.enrollment,
      perPupil: Math.round(record.perPupil),
      revenueTotal: Math.round(record.rev.total),
      expenditures: Math.round(record.exp),
      surplus: Math.round(record.surplus),
      reserveRatio: record.reserveRatio,
    });
  }
  return history;
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
  let comparison: ContextDistrict | null = null;
  if (snapshot.comparisonCode) {
    comparison = districtContext(snapshot.comparisonCode, schoolYear);
  } else if (extraDistrictCode && selectedCode && extraDistrictCode !== selectedCode) {
    comparison = districtContext(extraDistrictCode, schoolYear);
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
    districtHistory: district ? districtHistoryContext(district.code) : null,
    statewide: statewideContext(schoolYear),
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
