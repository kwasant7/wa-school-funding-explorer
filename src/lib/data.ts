import historyJson from '@/data/history.json';

export type District = {
  code: string;
  name: string;
  county: string;
  esd: string;
  enrollment: number;
  fundingEnrollment: number;
  fundingFte: {
    elementary: number;
    k3: number;
    grades46: number;
    middle: number;
    high: number;
    runningStart: number;
    openDoors: number;
  };
  demo: {
    lowIncome: number;
    ell: number;
    sped: number;
    homeless: number;
    migrant: number;
    highlyCapable: number;
  };
  rev: {
    local: number;
    state: number;
    federal: number;
    other: number;
    total: number;
  };
  /** Total general fund expenditures */
  exp: number;
  /** Revenues − expenditures: the year's change in fund balance (+/−) */
  surplus: number;
  /** Ending total fund balance (savings carried forward); null if unavailable */
  fundBalance: number | null;
  /** Fund balance as a % of expenditures (reserve ratio); null if unavailable */
  reserveRatio: number | null;
  perPupil: number;
};

export type Statewide = {
  districts: number;
  enrollment: number;
  fundingEnrollment: number;
  revenues: {
    enrollment?: number;
    fundingEnrollment?: number;
    local: number;
    state: number;
    federal: number;
    other: number;
    total: number;
    expenditures?: number;
  };
  expenditures: number;
  surplus: number;
  avgPerPupil: number;
  medianPerPupil: number;
  minPerPupil: number;
  maxPerPupil: number;
};

export type YearData = {
  schoolYear: string;
  statewide: Statewide;
  districts: District[];
};

const byYear = historyJson.byYear as unknown as Record<string, YearData>;

/*
  Re-exported from lib/years so callers that need both the year list and the
  data can keep importing from one place, while callers that need only the list
  can import lib/years directly and avoid pulling history.json into their chunk.
*/
export { YEARS, LATEST } from '@/lib/years';
import { LATEST as LATEST_YEAR, YEARS as YEAR_LABELS } from '@/lib/years';

export function yearData(year: string): YearData {
  return byYear[year] ?? byYear[LATEST_YEAR];
}

/** A district's value in each year (null where it has no data that year). */
/*
  Charter schools stand their authorizer in place of an ESD, which is how the
  rest of the site tells them apart too (the scatter's "exclude charters"
  filter). Identified by data rather than a hand-kept list, so the next charter
  to open is classified without anyone remembering to add it.
*/
export function isCharter(entity: { esd: string }): boolean {
  return entity.esd.includes('Charter');
}

/**
 * School districts in a year, charters excluded. statewide.districts counts
 * every reporting entity, charters included - 315 rather than 298 in 2024-25.
 */
export function districtCount(year: string): number {
  return yearData(year).districts.filter((d) => !isCharter(d)).length;
}

export function districtSeries<T>(
  code: string,
  pick: (d: District) => T
): { label: string; value: T | null }[] {
  return YEAR_LABELS.map((label) => {
    const d = byYear[label]?.districts.find((x) => x.code === code);
    return { label, value: d ? pick(d) : null };
  });
}

export function statewideSeries<T>(
  pick: (s: Statewide) => T
): { label: string; value: T }[] {
  /*
    Optional-chained like districtSeries above. YEARS and byYear are produced by
    separate steps of fetch-data.mjs, so a year label with no matching entry is
    possible; unguarded this threw and, with no error boundary, blanked the page.
  */
  return YEAR_LABELS.filter((label) => byYear[label]).map((label) => ({
    label,
    value: pick(byYear[label].statewide),
  }));
}
