/**
 * Everything the one-page PDF brief prints, gathered in one place.
 *
 * The PDF is the sheet a parent carries to a school board meeting or a
 * legislator's office, so it has to answer four questions on one side of paper:
 * how is this district doing (the District Explorer's headline numbers), where
 * does funding fall short (the Big 3), what else is wrong and what should I ask
 * for, and who do I ask. This builds that data and nothing about how it is
 * drawn - brief-pdf.ts lays it out - so the numbers can be tested on their own
 * and cannot drift from the site, which supplies every one of them.
 */
import districtsJson from '@/data/districts.json';
import levyJson from '@/data/levy.json';
import representation from '@/data/legislators.json';
import trendJson from '@/data/per-pupil-trend.json';
import {
  allIssuesFor,
  briefFor,
  DIAGNOSIS_YEAR,
  ISSUE_ASKS,
  metricsFor,
  plainMoney,
  type Issue,
  type IssueId,
  type IssueVisual,
} from '@/lib/diagnosis';
import { BIG3_KEYS, big3Totals, type Big3Key } from '@/lib/big3';
import { fmtInt, fmtMoney, fmtMoneyFull } from '@/lib/format';
import { balanceGapIsMaterial, fundBalanceChange } from '@/lib/reserves';
import { isSchoolDistrict } from '@/lib/entity';

/** The three problems the Big 3 section already covers on their own. */
const BIG3_ISSUES: ReadonlySet<IssueId> = new Set<IssueId>(['sped', 'msoc', 'transportation']);

/** Rows in the "what else needs to change" list. */
export const MAX_PROBLEMS = 3;
/** Legislative delegations printed; a district can overlap many more. */
export const MAX_DELEGATIONS = 3;

export type Tile = { label: string; value: string; note: string; tone?: 'critical' };

export type RevenuePart = {
  key: 'state' | 'local' | 'federal' | 'other';
  label: string;
  amount: number;
  /** Whole percent of total revenue. */
  percent: number;
};

export type Big3Column = {
  key: Big3Key;
  title: string;
  detail: string;
  cost: number;
  funding: number;
  /** Cost minus funding; negative when funding covers the cost. */
  gap: number;
  /** The sentence under the verdict: an ask when short, a fact when covered. */
  note: string;
  /** True when `note` is an ask, which the page prints with a bold lead-in. */
  isAsk: boolean;
};

export type ProblemRow = {
  id: IssueId;
  title: string;
  fact: string;
  visual: IssueVisual;
  /** What the district itself has already done, when that is on record. */
  response?: string;
  ask: string;
  /** Bills and statutes behind the ask, as one line. */
  cite: string;
};

export type Delegation = {
  district: number;
  /** Whole percent of the school district inside this legislative district. */
  percent: number;
  members: { chamber: string; name: string }[];
};

export type OnePage = {
  code: string;
  name: string;
  /** "Tacoma" for "Tacoma School District". */
  shortName: string;
  county: string;
  esd: string;
  year: string;
  fundedStudents: number;
  summary: string;
  tiles: Tile[];
  revenue: { total: number; parts: RevenuePart[] };
  trend: { years: string[]; values: (number | null)[]; median: number[] };
  big3: {
    year: string;
    columns: Big3Column[];
    total: number;
    perStudent: number;
  } | null;
  problems: ProblemRow[];
  delegations: Delegation[];
  /** Delegations that overlap the district but did not fit on the page. */
  moreDelegations: number;
  message: string;
};

const SHORT_PROGRAM: Record<Big3Key, string> = {
  sped: 'special education',
  transportation: 'buses',
  msoc: 'everyday operating costs',
};

const BIG3_TEXT: Record<Big3Key, { title: string; detail: string }> = {
  sped: { title: 'Special education', detail: 'Services for students with disabilities' },
  transportation: {
    title: 'Transportation',
    detail: 'Buses, drivers, fuel, and required routes',
  },
  msoc: {
    title: 'Operating costs (MSOC)',
    detail: 'Curriculum, technology, utilities, and insurance',
  },
};

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function shortYear(year: string): string {
  // "2019-20" -> "19-20"
  return year.replace(/^\d{2}(\d{2}-)/, '$1');
}

function chamberLabel(chamber: string): string {
  if (/^senator/i.test(chamber)) return 'Sen.';
  if (/^representative/i.test(chamber)) return 'Rep.';
  return chamber;
}

type RepresentationDistrict = {
  legislativeDistricts: { district: number; share: number }[];
};

function delegationsFor(code: string): Delegation[] {
  const match = (representation.schoolDistricts as Record<string, RepresentationDistrict>)[code];
  const legislators = representation.legislators as Record<
    string,
    { name: string; chamber: string }[]
  >;
  return (match?.legislativeDistricts ?? [])
    .map((entry) => ({
      district: entry.district,
      percent: Math.round(entry.share * 100),
      members: (legislators[String(entry.district)] ?? []).map((member) => ({
        chamber: chamberLabel(member.chamber),
        name: member.name,
      })),
    }))
    .filter((entry) => entry.members.length > 0)
    .sort((a, b) => b.percent - a.percent);
}

/**
 * The few sentences someone can say on a phone call or paste into an email.
 * Built from this district's own numbers: the levy the cap blocks and the Big 3
 * programs that fall short are the two things a lawmaker can act on directly.
 */
function messageFor(
  code: string,
  shortName: string,
  shortPrograms: { key: Big3Key; gap: number }[]
): string {
  const metrics = metricsFor(code);
  // A charter or tribal compact school has no residents of its own to speak
  // for. Read from the data, not the name: "Rainier Prep Charter School
  // District" is a charter, and "Quileute Tribal School District" a compact.
  const isDistrict = metrics != null && isSchoolDistrict(metrics.record);
  const sentences = [isDistrict ? `I live in ${shortName}.` : `I am writing about ${shortName}.`];
  const requests: string[] = [];

  if (metrics && metrics.levy && metrics.capBlocked > 0) {
    sentences.push(
      `Our voters approved ${plainMoney(metrics.levy.levy)} in school taxes for ${levyJson.calendarYear}, but state law blocks ${plainMoney(metrics.capBlocked)} of it.`
    );
    requests.push('raise the levy cap');
  }

  if (shortPrograms.length > 0) {
    const names = joinList(shortPrograms.map((p) => SHORT_PROGRAM[p.key]));
    const total = shortPrograms.reduce((sum, p) => sum + p.gap, 0);
    // "Special education runs ... above its funding"; "buses" and "operating
    // costs" are plural, and so is any list.
    const one = shortPrograms.length === 1 && shortPrograms[0].key === 'sped';
    sentences.push(
      `${capitalise(names)} ${one ? 'runs' : 'run'} ${plainMoney(total)} above ${one ? 'its' : 'their'} funding.`
    );
    requests.push(`fund ${names} at what ${one ? 'it really costs' : 'they really cost'}`);
  }

  if (requests.length === 0) {
    sentences.push('Our schools need steady funding at what it really costs to run them.');
    requests.push('fund our schools at what they really cost');
  }

  sentences.push(`Please ${joinList(requests)}.`);
  return sentences.join(' ');
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function citeFor(issue: Issue): string {
  return issue.refs.map((ref) => ref.bill).join('  ·  ');
}

export function onePageFor(code: string): OnePage | null {
  const brief = briefFor(code);
  const metrics = metricsFor(code);
  if (!brief || !metrics) return null;

  const record = metrics.record;
  const shortName = record.name.replace(/ School District.*$/, '');
  const fundedStudents = Math.round(metrics.fte);

  // --- Tiles: the District Explorer's headline numbers -------------------
  const medianNow = trendJson.median[trendJson.median.length - 1];
  const surplus = record.surplus;
  // When money moved to other funds makes the balance move differently from
  // revenue minus spending, the tile's note says what the balance did.
  const balanceChange = fundBalanceChange(record);
  const reserveNote =
    balanceGapIsMaterial(surplus, balanceChange, record.exp) && balanceChange != null
      ? `Savings ${balanceChange < 0 ? 'fell' : 'rose'} ${fmtMoney(Math.abs(balanceChange))}`
      : record.reserveRatio == null
        ? ''
        : record.reserveRatio < 0
          ? 'No savings left'
          : `Savings: ${record.reserveRatio.toFixed(1)}% of spending`;
  const tiles: Tile[] = [
    {
      label: 'Revenue per student',
      value: fmtMoneyFull(Math.round(record.perPupil)),
      note: `Statewide median ${fmtMoneyFull(Math.round(medianNow))}`,
    },
    {
      label: 'Funded students',
      value: fmtInt(fundedStudents),
      note: `${fmtInt(record.enrollment)} enrolled in October`,
    },
    {
      label: 'Low-income students',
      value: `${Math.round(metrics.lowIncomeRate)}%`,
      note: `${fmtInt(record.demo.lowIncome)} students`,
    },
    // Revenue booked to the dollar to match spending, with no fund balance
    // reported, is an accounting convention rather than a balanced budget
    // (Paschal Sherman), so it is not shown as a surplus.
    surplus === 0
      ? {
          label: 'Revenue minus spending',
          value: '$0',
          note: record.fundBalance == null ? 'Revenue reported equal to spending' : reserveNote,
        }
      : surplus < 0
      ? {
          label: 'Spent more than it took in',
          value: `-${fmtMoney(Math.abs(surplus))}`,
          note: reserveNote,
          tone: 'critical',
        }
      : {
          label: 'Took in more than it spent',
          value: `+${fmtMoney(surplus)}`,
          note: reserveNote,
        },
  ];

  // --- Revenue mix --------------------------------------------------------
  const rev = record.rev;
  const parts: RevenuePart[] = (
    [
      ['state', 'State', rev.state],
      ['local', 'Local', rev.local],
      ['federal', 'Federal', rev.federal],
      ['other', 'Other', rev.other],
    ] as const
  ).map(([key, label, amount]) => ({
    key,
    label,
    amount,
    percent: rev.total > 0 ? Math.round((100 * amount) / rev.total) : 0,
  }));

  // --- Trend ---------------------------------------------------------------
  const series =
    (trendJson.districts as Record<string, (number | null)[]>)[code] ??
    trendJson.years.map(() => null);

  // --- Big 3 ---------------------------------------------------------------
  let big3: OnePage['big3'] = null;
  const shortPrograms: { key: Big3Key; gap: number }[] = [];
  if (metrics.big3) {
    const totals = big3Totals(metrics.big3);
    const columns: Big3Column[] = BIG3_KEYS.map((key) => {
      const program = metrics.big3![key];
      const gap = totals.gaps[key];
      if (gap > 0) shortPrograms.push({ key, gap });
      const covered = gap <= 0;
      const note =
        covered && key === 'sped' && record.demo.sped > 0
          ? `Funding covers the cost here. ${fmtInt(record.demo.sped)} students (${Math.round(metrics.spedRate)}% of enrollment) have disabilities.`
          : covered
            ? 'Funding covers the cost here.'
            : ISSUE_ASKS[key];
      return {
        key,
        ...BIG3_TEXT[key],
        cost: program.cost,
        funding: program.revenue,
        gap,
        note,
        isAsk: !covered,
      };
    });
    big3 = {
      year: DIAGNOSIS_YEAR,
      columns,
      total: totals.total,
      perStudent: totals.perStudent,
    };
  }

  // --- The next problems, with what to ask for ---------------------------
  const problems: ProblemRow[] = allIssuesFor(code)
    .filter((issue) => !BIG3_ISSUES.has(issue.id))
    .slice(0, MAX_PROBLEMS)
    .map((issue) => ({
      id: issue.id,
      title: issue.title,
      fact: issue.fact,
      visual: issue.visual,
      response: issue.response,
      ask: issue.ask ?? ISSUE_ASKS[issue.id],
      cite: citeFor(issue),
    }));

  // --- Who to ask ----------------------------------------------------------
  const all = delegationsFor(code);

  return {
    code,
    name: record.name,
    shortName,
    county: record.county,
    esd: record.esd,
    year: DIAGNOSIS_YEAR,
    fundedStudents,
    summary: brief.summary,
    tiles,
    revenue: { total: rev.total, parts },
    trend: {
      years: trendJson.years.map(shortYear),
      values: series,
      median: trendJson.median,
    },
    big3,
    problems,
    delegations: all.slice(0, MAX_DELEGATIONS),
    moreDelegations: Math.max(0, all.length - MAX_DELEGATIONS),
    message: messageFor(code, shortName, shortPrograms),
  };
}
