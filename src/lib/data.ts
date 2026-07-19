import historyJson from '@/data/history.json';

export type District = {
  code: string;
  name: string;
  county: string;
  esd: string;
  enrollment: number;
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
  perPupil: number;
};

export type Statewide = {
  districts: number;
  enrollment: number;
  revenues: { enrollment?: number; local: number; state: number; federal: number; other: number; total: number };
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
