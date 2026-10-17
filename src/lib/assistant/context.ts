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
  type ContextDistrictFinance,
  type ContextSimulator,
  type ContextStatewide,
  type ContextStatewideFinance,
  type ContextStatewideYear,
} from '@/lib/assistant/types';
import { assistantSnapshot } from '@/lib/assistant/store';
import { LATEST, YEARS, yearData } from '@/lib/data';
import { oversightFor } from '@/data/oversight';
import districtsData from '@/data/districts.json';
import allocationData from '@/data/allocation.json';
import spendingData from '@/data/spending.json';
import levyData from '@/data/levy.json';

const MAX_HEADINGS = 8;
const MAX_EXCERPT_CHARS = 1_200;

/*
  allocation.json, spending.json and levy.json each describe one period, not
  the whole series. Attaching them to whichever year the visitor happens to be
  viewing would put 2024-25 spending under a 2021-22 heading - a real figure
  under a wrong label, which is the one failure mode this context is built to
  avoid. Each is gated on its own year and labelled with it.
*/
const ALLOCATION_YEAR = allocationData.schoolYear;
const SPENDING_YEAR = spendingData.schoolYear;

/**
 * The levy workbook is keyed by collection (calendar) year; the site states it
 * as the school year that money is spent in, so the assistant must too.
 */
function schoolYearOf(calendarYear: number): string {
  return `${calendarYear - 1}-${String(calendarYear).slice(-2)}`;
}
const LEVY_SCHOOL_YEAR = schoolYearOf(levyData.calendarYear);

type LevyRow = (typeof levyData.districts)[keyof typeof levyData.districts];
type AllocationRow = (typeof allocationData.districts)[keyof typeof allocationData.districts];
type SpendingRow = (typeof spendingData.districts)[keyof typeof spendingData.districts];
const LEVY_ROWS = levyData.districts as Record<string, LevyRow>;
const ALLOCATION_ROWS = allocationData.districts as Record<string, AllocationRow>;
const SPENDING_ROWS = spendingData.districts as Record<string, SpendingRow>;

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
      minDistrict: extremeDistrictName(year, 'min'),
      maxDistrict: extremeDistrictName(year, 'max'),
    },
  };
}

/** Which district holds the highest or lowest per-student figure that year. */
function extremeDistrictName(year: string, end: 'min' | 'max'): string | null {
  const districts = yearData(year).districts;
  let best: { name: string; perPupil: number } | null = null;
  for (const district of districts) {
    if (!Number.isFinite(district.perPupil)) continue;
    if (
      !best ||
      (end === 'min' ? district.perPupil < best.perPupil : district.perPupil > best.perPupil)
    ) {
      best = { name: district.name, perPupil: district.perPupil };
    }
  }
  return best ? best.name : null;
}

/**
 * Statewide headline figures for every year on record.
 *
 * The counterpart to districtHistoryContext, and it exists for the same
 * reason: the site holds all six years, and withholding five of them turned
 * "what was the total in 2019-20?" into a refusal that the year control - and
 * nothing else - could lift.
 */
export function statewideHistoryContext(): ContextStatewideYear[] {
  return YEARS.map((year) => {
    const record = yearData(year).statewide;
    return {
      schoolYear: year,
      revenueTotal: Math.round(record.revenues.total),
      headcount: record.enrollment,
      perPupilAverage: Math.round(record.avgPerPupil),
      perPupilMedian: Math.round(record.medianPerPupil),
    };
  });
}

/**
 * Statewide program spending and the levy limits.
 *
 * Both are single-period datasets, so both carry their own year rather than
 * the one in view. The levy limits in particular are for a *later* school year
 * than the spending actuals, and the site says so on every page that shows
 * them.
 */
export function statewideFinanceContext(): ContextStatewideFinance {
  const spending = spendingData.statewide;
  const limits = levyData.assumptions;
  return {
    schoolYear: SPENDING_YEAR,
    spending: spending
      ? {
          sped: Math.round(spending.sped),
          spedPerStudent: Math.round(spending.spedPerStudent),
          transportation: Math.round(spending.transportation),
          transportationPerStudent: Math.round(spending.transportationPerStudent),
          msoc: Math.round(spending.msoc),
          msocPerStudent: Math.round(spending.msocPerStudent),
        }
      : null,
    levyLimits: limits
      ? {
          levySchoolYear: LEVY_SCHOOL_YEAR,
          leaThresholdPerPupil: limits.leaThresholdPerPupil,
          leaMaxRate: limits.leaMaxRate,
          maxLevyPerPupil: limits.maxLevyPerPupil,
          maxLevyPerPupilLarge: limits.maxLevyPerPupilLarge,
          maxLevyRate: limits.maxLevyRate,
        }
      : null,
  };
}

/**
 * A district's allocation, spending and levy position.
 *
 * Returns null for any year those datasets do not describe, rather than
 * quietly attaching the latest year's figures to an older one.
 */
export function districtFinanceContext(
  code: string,
  schoolYear: string
): ContextDistrictFinance | null {
  const allocation = schoolYear === ALLOCATION_YEAR ? ALLOCATION_ROWS[code] : undefined;
  const spending = schoolYear === SPENDING_YEAR ? SPENDING_ROWS[code] : undefined;
  /*
    The levy row is keyed to its own school year, so it travels with any year
    the visitor is viewing - it is the district's levy position, labelled with
    the year it belongs to, not a figure for the year on screen. `actualLea` is
    the exception: it is an F-196 actual for the revenue year, and is labelled
    as such.
  */
  const levy = LEVY_ROWS[code];
  if (!allocation && !spending && !levy) return null;

  return {
    schoolYear,
    allocation: allocation
      ? {
          salaries: Math.round(allocation.salaries),
          benefits: Math.round(allocation.benefits),
          msoc: Math.round(allocation.msoc),
          basicEducation: Math.round(allocation.basicEducation),
          specialEd: Math.round(allocation.specialEd),
          transportation: Math.round(allocation.transportation),
          bilingual: Math.round(allocation.bilingual),
          learningAssistance: Math.round(allocation.learningAssistance),
          highlyCapable: Math.round(allocation.highlyCapable),
          levyEqualization: Math.round(allocation.levyEqualization),
          total: Math.round(allocation.total),
        }
      : null,
    spending: spending
      ? {
          sped: Math.round(spending.sped),
          spedPerStudent: Math.round(spending.spedPerStudent),
          transportation: Math.round(spending.transportation),
          transportationPerStudent: Math.round(spending.transportationPerStudent),
          msoc: Math.round(spending.msoc),
          msocPerStudent: Math.round(spending.msocPerStudent),
        }
      : null,
    levy: levy
      ? {
          levySchoolYear: LEVY_SCHOOL_YEAR,
          voterApproved: Math.round(levy.levy),
          levyRate: levy.levyRate,
          maxLea: Math.round(levy.maxLea),
          payableLea: Math.round(levy.payableLea),
          eligible: levy.eligible,
          actualLea: Math.round(levy.actualLea),
          actualLeaSchoolYear: LATEST,
        }
      : null,
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
    finance: districtFinanceContext(code, year),
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
    /*
      History follows whichever district is in the comparison slot too. It used
      to be built for the primary district alone, so asking about an earlier
      year for a district the visitor merely named - while another was selected
      - was refused as "no record", and the same question answered correctly
      once that district's own page was open. The site held the year either way.
    */
    comparisonDistrictHistory: comparison ? districtHistoryContext(comparison.code) : null,
    statewide: statewideContext(schoolYear),
    statewideHistory: statewideHistoryContext(),
    statewideFinance: statewideFinanceContext(),
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
