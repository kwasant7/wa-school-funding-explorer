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

export const YEARS: string[] = historyJson.years;
export const LATEST: string = historyJson.latest;

export function yearData(year: string): YearData {
  return byYear[year] ?? byYear[LATEST];
}

/** A district's value in each year (null where it has no data that year). */
export function districtSeries<T>(
  code: string,
  pick: (d: District) => T
): { label: string; value: T | null }[] {
  return YEARS.map((label) => {
    const d = byYear[label]?.districts.find((x) => x.code === code);
    return { label, value: d ? pick(d) : null };
  });
}

export function statewideSeries<T>(
  pick: (s: Statewide) => T
): { label: string; value: T }[] {
  return YEARS.map((label) => ({ label, value: pick(byYear[label].statewide) }));
}
