'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { District, LATEST, YEARS, districtCount, districtSeries, isCharter, statewideSeries, yearData } from '@/lib/data';
import StatTile from '@/components/StatTile';
import SourceShareBar from '@/components/charts/SourceShareBar';
import CompareBar from '@/components/charts/CompareBar';
import TrendChart from '@/components/charts/TrendChart';
import RevenueTrendChart from '@/components/charts/RevenueTrendChart';
import NeedVsFundingChart, { NeedPoint } from '@/components/charts/NeedVsFundingChart';
import WaMap from '@/components/charts/WaMap';
import ChartErrorBoundary from '@/components/ChartErrorBoundary';
import { oversightFor, OVERSIGHT_SOURCE, OVERSIGHT_CHECKED_ON } from '@/data/oversight';
import big3Json from '@/data/big3.json';
import spendingJson from '@/data/spending.json';
import { isSchoolDistrict } from '@/lib/entity';
import regionalizationJson from '@/data/regionalization.json';
import districtsJson from '@/data/districts.json';
import { alignPair, fmtInt, fmtMoney, fmtMoneyFull, fmtMoneyOnGrid, fmtSignedMoney, pct } from '@/lib/format';
import { useAssistantDistrict, useAssistantYear } from '@/lib/assistant/store';
import { initialDistrictCode, writeSelectedDistrict } from '@/lib/selected-district';
import {
  RESERVE_BENCHMARK_PCT,
  RESERVE_THIN_PCT,
  balanceGapIsMaterial,
  fundBalanceChange,
  reserveDays,
} from '@/lib/reserves';

/*
  Charter schools, identified by their authorizer standing in for an ESD.
  Their tiny enrollments put them at the extremes of any per-student chart,
  so the scatter offers to set them aside - identified by data, not by a
  hand-kept list that would silently miss the next charter to open.
*/
const CHARTER_CODES = new Set(
  districtsJson.districts.filter(isCharter).map((x) => x.code)
);

/**
 * This district's salary regionalization factors for one school year, from
 * LEAP Document 3 (2024 enacted). The document only reaches back to 2023-24,
 * so earlier years on the year switcher return null and the tile stands down
 * rather than showing a factor from the wrong year.
 */
function regionalizationFor(code: string, year: string) {
  const i = regionalizationJson.years.indexOf(year);
  const d = (regionalizationJson.districts as Record<
    string,
    { cis: number[]; cas: number[]; exp: boolean[] }
  >)[code];
  if (i < 0 || !d) return null;
  return { cis: d.cis[i], cas: d.cas[i], exp: d.exp[i] };
}

/*
  The Big 3 card shows AESD's Big 3 dashboard figures for one closed year,
  2024-25 (see scripts/fetch-big3.py), so it reads big3.json directly rather
  than going through the year-switched series, and names that year regardless
  of which year the charts above show.
*/
type Big3Program = { revenue: number; cost: number };
const BIG3_YEAR = big3Json.schoolYear;
const BIG3 = big3Json.districts as Record<
  string,
  { sped: Big3Program; transportation: Big3Program; msoc: Big3Program; students: number }
>;

export default function DistrictsExplorer() {
  const router = useRouter();
  const params = useSearchParams();
  const [year, setYear] = useState(LATEST);
  const selectedCode = params.get('d');
  const selected = useMemo(
    () => yearData(year).districts.find((d) => d.code === selectedCode) ?? null,
    [selectedCode, year]
  );

  useEffect(() => {
    if (selectedCode) {
      writeSelectedDistrict(selectedCode);
    }
  }, [selectedCode]);

  /*
    Hand the assistant this page's state and its own controls. Selection lives
    in the query string here, so the assistant selects a district by pushing
    the same URL the map and the dropdown already push - one code path, and
    the back button keeps working.
  */
  const selectDistrict = useCallback(
    (code: string) => router.push(`/districts?d=${encodeURIComponent(code)}`),
    [router]
  );
  const clearDistrict = useCallback(() => {
    // Also forget the shared selection, so clearing here means "no district"
    // on the next page and the next reload, not just on this render.
    writeSelectedDistrict(null);
    router.push('/districts');
  }, [router]);
  useAssistantYear(year, setYear);
  useAssistantDistrict(selectedCode, {
    select: selectDistrict,
    clear: clearDistrict,
  });

  /*
    The profile opens below the map rather than replacing it. Clicking a shape
    used to swap the whole explorer out for the district's page, which threw
    away the one piece of context the click had just established: where in the
    state that district actually is. Now the map stays put with the district
    outlined, and the profile unfolds underneath it.
  */
  const detailRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(selectedCode);
  useEffect(() => {
    // Only on a selection made here - a visitor arriving on /districts?d=...
    // is left at the top of the page to read down into it themselves, and
    // moving them while the map JSON is still in flight would scroll to a
    // position the map's own arrival immediately invalidates.
    if (!selectedCode || scrolledFor.current === selectedCode) {
      scrolledFor.current = selectedCode;
      return;
    }
    scrolledFor.current = selectedCode;
    const el = detailRef.current;
    if (!el) return;
    /*
      Land the profile's opening rows in the bottom third of the screen rather
      than at the top of it. Scrolling the profile fully into view would push
      the map off the top edge, which is the behaviour this whole change
      exists to get rid of - the reader needs to see the outline and the
      district's name at the same time for one to explain the other. They can
      scroll the rest of the way themselves.
    */
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: Math.max(0, top - window.innerHeight * 0.62),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, [selectedCode]);

  /*
    Arriving at a bare /districts, open on the district the visitor already
    picked elsewhere - the home page's quick-find, or Take Action - instead of
    the empty state. Picking Bellevue on one page and finding nothing selected
    on the next reads as the choice not having registered.

    Only on the first render: clearing the selection pushes the bare URL, and
    restoring from storage on every bare URL would immediately undo that. The
    URL still wins whenever it carries a code, so shared and crawled links are
    unaffected. `replace`, not `push`, so Back leaves the page rather than
    bouncing between the bare URL and the restored one. And scrolledFor is
    marked first: this selection was not made by a click here, so the profile
    should unfold in place rather than scrolling the visitor down to it.
  */
  const restoredSelection = useRef(false);
  useEffect(() => {
    if (restoredSelection.current) return;
    restoredSelection.current = true;
    if (selectedCode) return;
    // Saved choice, else the site-wide default.
    const saved = initialDistrictCode((c) =>
      yearData(LATEST).districts.some((d) => d.code === c)
    );
    if (!saved) return;
    scrolledFor.current = saved;
    router.replace(`/districts?d=${encodeURIComponent(saved)}`);
  }, [router, selectedCode]);

  return (
    <>
      <DistrictOverview
        year={year}
        onSelect={selectDistrict}
        onClear={clearDistrict}
        selectedCode={selectedCode}
      />
      {selectedCode && (
        <div ref={detailRef}>
          {selected ? (
            <DistrictDetail district={selected} year={year} />
          ) : (
            <MissingYearNotice
              code={selectedCode}
              year={year}
              onSwitchYear={setYear}
            />
          )}
        </div>
      )}
    </>
  );
}

/**
 * The selected district exists in another year but not this one. Offers the
 * most recent year it actually has data for - which is not always LATEST: a
 * district that closed, merged, or lost its charter after an earlier year has
 * no record in 2024-25 either, and "Switch to 2024-25" would just land back on
 * the same empty panel.
 */
function MissingYearNotice({
  code,
  year,
  onSwitchYear,
}: {
  code: string;
  year: string;
  onSwitchYear: (year: string) => void;
}) {
  const yearsWithData = YEARS.filter((y) =>
    yearData(y).districts.some((d) => d.code === code)
  );
  const fallbackYear = yearsWithData[yearsWithData.length - 1];
  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-8">
      <ClearSelectionLink />
      <p className="mt-4 text-ink-secondary">
        {fallbackYear ? (
          <>
            No data for this district in {year}.{' '}
            <button
              className="text-accent hover:underline"
              onClick={() => onSwitchYear(fallbackYear)}
            >
              Switch to {fallbackYear}
            </button>
            , the most recent year it&apos;s on record.
          </>
        ) : (
          "This district isn't in any year of this data - it may have moved, closed, or changed codes."
        )}
      </p>
    </div>
  );
}

/**
 * Drops the `?d=` selection. Replaces the old "← District Explorer" link,
 * which now reads as a lie: the explorer is still on screen above this panel,
 * so the only thing left to go back to is the unselected state.
 */
function ClearSelectionLink() {
  return (
    <Link href="/districts" className="text-sm text-accent hover:underline">
      ← Clear selection
    </Link>
  );
}

function DistrictOverview({
  year,
  onSelect,
  onClear,
  selectedCode,
}: {
  year: string;
  onSelect: (code: string) => void;
  onClear: () => void;
  selectedCode: string | null;
}) {
  const data = yearData(year);
  const s = data.statewide;

  return (
    <div className="max-w-site mx-auto px-4 md:px-6">
      {/*
        The <h1> and intro that used to open this component now live in
        app/districts/page.tsx. This component calls useSearchParams(), which
        under `output: 'export'` makes its whole Suspense subtree client-only -
        so nothing rendered here reaches the exported HTML, and the page was
        shipping with no <h1> at all. Static text belongs on the server side of
        that boundary.

        The school-year control lives in the site header, beside the
        language control - see SchoolYearSwitcher.
      */}
      {/*
        Statewide context stays up with a district open too, as the baseline
        the district's own figures are read against.
      */}
      <section data-assistant-section="district-stats" className="mt-6">
      <h2 className="font-semibold">Statewide</h2>
      <div className="mt-2 grid lg:grid-cols-[1fr,22rem] gap-4 items-stretch">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label={`School districts (${year})`} value={String(districtCount(year))} />
          <StatTile
            label="Students statewide"
            value={fmtInt(Math.round(s.fundingEnrollment))}
            note="Funding FTE, not October headcount"
          />
          <StatTile label="Total funding" value={fmtMoney(s.revenues.total)} />
          <StatTile
            label="Median per student"
            value={fmtMoneyFull(s.medianPerPupil)}
            note={`average ${fmtMoneyFull(s.avgPerPupil)}`}
          />
        </div>
        <div className="card p-4">
          <h2 className="text-sm text-ink-secondary">
            Statewide funding per student
          </h2>
          <div className="mt-2">
            <TrendChart
              points={statewideSeries((sw) => sw.avgPerPupil)}
              format={(v) => `$${Math.round(v / 100) / 10}K`}
              ariaLabel="Statewide average funding per student by year"
            />
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Nominal dollars, not adjusted for inflation.
          </p>
        </div>
      </div>
      </section>

      <div data-assistant-section="district-picker" className="mt-6 card p-5">
        <h2 className="font-semibold">
          {selectedCode ? 'Where it is on the map' : 'Find your district on the map'}
        </h2>
        <p className="mt-0.5 mb-4 text-sm text-ink-secondary">
          {selectedCode
            ? 'The outlined district is the one open below. Pick another to switch.'
            : 'Pick from the dropdown or click your district to open its profile.'}
        </p>
        <ChartErrorBoundary label="The map">
          <WaMap
            year={year}
            onSelect={onSelect}
            onClear={onClear}
            selected={selectedCode}
          />
        </ChartErrorBoundary>
      </div>
      {!selectedCode && (
        <p className="mt-3 text-xs text-ink-muted">
          Per-student figures use OSPI&apos;s annual-average funding FTE, not
          the Report Card&apos;s October headcount.
        </p>
      )}
    </div>
  );
}

function FundBalanceCard({ district: d, year }: { district: District; year: string }) {
  const surplus = d.surplus;
  const deficit = surplus < 0;
  /*
    Revenue minus spending is not the change in fund balance. General-fund
    money moved to capital projects or debt service, and prior-year
    adjustments, move the balance without appearing in either total - Bethel
    "added $10.7M" by summing surpluses while its balance fell $16.5M. So the
    balance's own movement comes from the year-end balances, and the long-run
    sentence compares the first and last balances rather than adding surpluses.
  */
  const change = fundBalanceChange(d);
  const gapMaterial = balanceGapIsMaterial(surplus, change, d.exp);
  const netSeries = districtSeries(d.code, (x) => x.surplus);
  const maxAbs = Math.max(1, ...netSeries.map((p) => Math.abs(p.value ?? 0)));
  const balances = districtSeries(d.code, (x) => x.fundBalance).filter(
    (p): p is { label: string; value: number } => p.value != null
  );
  const firstBalance = balances[0];
  const lastBalance = balances[balances.length - 1];

  return (
    <div data-assistant-section="fund-balance" className="mt-6 card p-5">
      <h2 className="font-semibold">Money in vs. money out ({year})</h2>
      <p className="mt-0.5 text-sm text-ink-secondary">
        The general fund is where a district&apos;s day-to-day money flows. If it
        spends more than it takes in, it dips into savings (its fund balance).
      </p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-line p-4">
          <div className="text-sm text-ink-secondary">Total revenue (in)</div>
          <div className="text-2xl font-bold">{fmtMoney(d.rev.total)}</div>
        </div>
        <div className="rounded-lg border border-line p-4">
          <div className="text-sm text-ink-secondary">Total spending (out)</div>
          <div className="text-2xl font-bold">{fmtMoney(d.exp)}</div>
        </div>
        {surplus === 0 ? (
          <div className="rounded-lg border border-line p-4">
            <div className="text-sm text-ink-secondary">Revenue minus spending</div>
            <div className="text-2xl font-bold">$0</div>
            <div className="text-xs text-ink-muted mt-0.5">
              {d.fundBalance == null ? 'revenue reported equal to spending' : 'revenue minus spending'}
            </div>
          </div>
        ) : (
          <div className={`rounded-lg border p-4 ${deficit ? 'border-critical/40 bg-red-50' : 'border-good/40 bg-green-50'}`}>
            <div className="text-sm text-ink-secondary">
              {deficit ? 'Spent more than it took in' : 'Took in more than it spent'}
            </div>
            <div className={`text-2xl font-bold ${deficit ? 'text-critical' : 'text-good'}`}>
              {fmtSignedMoney(surplus)}
            </div>
            <div className="text-xs text-ink-muted mt-0.5">revenue minus spending</div>
          </div>
        )}
      </div>
      {gapMaterial && change != null && (
        <p className="mt-3 text-sm text-ink-secondary">
          The fund balance itself {change < 0 ? 'fell' : 'rose'}{' '}
          <strong className={change < 0 ? 'text-critical' : 'text-good'}>
            {fmtMoney(Math.abs(change))}
          </strong>{' '}
          this year. The {fmtMoney(Math.abs(change - surplus))} difference comes
          from general-fund money moved to other district funds, such as capital
          projects, which the spending total leaves out, or from adjustments to
          earlier years&apos; books.
        </p>
      )}

      {/* Fund balance (savings on hand) + reserve ratio */}
      {d.fundBalance != null && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-line p-4">
            <div className="text-sm text-ink-secondary">Fund balance (savings on hand)</div>
            <div className={`text-2xl font-bold ${d.fundBalance < 0 ? 'text-critical' : ''}`}>
              {fmtSignedMoney(d.fundBalance).replace('+', '')}
            </div>
            {change != null && (
              <div className={`text-xs font-medium mt-0.5 ${change < 0 ? 'text-critical' : 'text-good'}`}>
                {fmtSignedMoney(change)} from last year
              </div>
            )}
            <div className="text-xs text-ink-muted mt-1">
              Year-end savings · emergencies, cash flow, next year&apos;s costs
            </div>
          </div>
          {(() => {
            const rr = d.reserveRatio;
            if (rr == null) return null;
            // Graded against the State Auditor's 60-day benchmark; see
            // src/lib/reserves.ts for where each line comes from.
            const cls =
              rr >= RESERVE_BENCHMARK_PCT
                ? 'border-good/40 bg-green-50'
                : rr >= 0
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-critical/40 bg-red-50';
            const textCls =
              rr >= RESERVE_BENCHMARK_PCT ? 'text-good' : rr >= 0 ? 'text-amber-600' : 'text-critical';
            const status =
              rr >= RESERVE_BENCHMARK_PCT
                ? "Meets the State Auditor's 60-day benchmark"
                : rr >= RESERVE_THIN_PCT
                  ? "Below the State Auditor's 60-day benchmark"
                  : rr >= 0
                    ? 'Thin - less than one month of spending'
                    : 'Negative - no cushion left';
            return (
              <div className={`rounded-lg border p-4 ${cls}`}>
                <div className="text-sm text-ink-secondary">Reserve ratio</div>
                <div className={`text-2xl font-bold ${textCls}`}>
                  {rr.toFixed(1)}%
                  {rr >= 0 && (
                    <span className="text-sm font-medium text-ink-secondary">
                      {' '}about {reserveDays(rr)} days
                    </span>
                  )}
                </div>
                <div className="text-xs mt-0.5 font-medium">
                  <span className={textCls}>{status}</span>
                </div>
                <div className="text-xs text-ink-muted mt-1">
                  Year-end savings ÷ annual spending
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Year-by-year net strip */}
      <div className="mt-5">
        <div className="text-xs font-medium text-ink-secondary mb-2">
          Revenue minus spending by year
        </div>
        <div className="flex items-stretch gap-2" role="img" aria-label={`${d.name} revenue minus spending by year`}>
          {netSeries.map((p) => {
            const v = p.value ?? 0;
            const h = (Math.abs(v) / maxAbs) * 40;
            const neg = v < 0;
            return (
              <div key={p.label} className="flex-1 flex flex-col items-center" title={`${p.label}: ${fmtSignedMoney(v)}`}>
                {/* fixed top zone: surplus bars grow up to the shared baseline */}
                <div className="w-full flex items-end justify-center" style={{ height: 40 }}>
                  {!neg && <div className="w-6 rounded-t bg-good" style={{ height: h }} />}
                </div>
                {/* shared baseline across all years */}
                <div className="w-full h-px bg-baseline" />
                {/* fixed bottom zone: deficit bars grow down from the baseline */}
                <div className="w-full flex items-start justify-center" style={{ height: 40 }}>
                  {neg && <div className="w-6 rounded-b bg-critical" style={{ height: h }} />}
                </div>
                <div className="mt-1 text-[10px] text-ink-muted tabular-nums">{p.label.slice(2)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {firstBalance && lastBalance && firstBalance !== lastBalance && (
        <p className="mt-4 text-sm text-ink-secondary">
          <span data-no-translate>{d.name}</span>&apos;s fund balance went from{' '}
          {fmtSignedMoney(firstBalance.value).replace('+', '')} at the end of{' '}
          {firstBalance.label} to {fmtSignedMoney(lastBalance.value).replace('+', '')}{' '}
          at the end of {lastBalance.label}, a{' '}
          <strong className={lastBalance.value < firstBalance.value ? 'text-critical' : 'text-good'}>
            {lastBalance.value < firstBalance.value ? 'drop' : 'rise'} of{' '}
            {fmtMoney(Math.abs(lastBalance.value - firstBalance.value))}
          </strong>
          .
        </p>
      )}
      <p className="mt-2 text-xs text-ink-muted">
        OSPI F-196 actuals; fund balance and reserve ratio from fiscal.wa.gov.
        Bars show each year&apos;s revenue minus spending. The fund balance also
        moves with money sent to other district funds and prior-year
        adjustments, so the two can differ.
      </p>
    </div>
  );
}

/**
 * The "Big 3" - special education, transportation, and MSOC - as one card:
 * the funding this district received against what it actually spent, as AESD
 * reports it, in the framing Washington's school-leader associations use when they lobby for
 * the same three lines. The name gives a reader language that works outside
 * this site: a school board, a legislator's office, and AESD's own dashboard
 * all call these three gaps the Big 3.
 *
 * Amounts and gaps go through alignPair so each pair of printed bars subtracts
 * to its own printed gap - same convention as the district brief.
 */
function Big3Gap({
  title,
  detail,
  cost,
  funding,
}: {
  title: string;
  detail: string;
  cost: number;
  funding: number;
}) {
  const covered = cost <= funding;
  const pair = alignPair(Math.max(cost, funding), Math.min(cost, funding), 3, 10_000);
  const money = (n: number) => fmtMoneyOnGrid(n, pair.step);
  const rows = covered
    ? [
        { label: 'Funding it receives', amount: pair.a, tone: 'full' as const },
        { label: 'What it really costs', amount: pair.b, tone: 'short' as const },
      ]
    : [
        { label: 'What it really costs', amount: pair.a, tone: 'full' as const },
        { label: 'Funding it receives', amount: pair.b, tone: 'short' as const },
      ];

  return (
    <figure
      role="img"
      aria-label={`${title}. ${rows[0].label}: ${money(rows[0].amount)}. ${rows[1].label}: ${money(rows[1].amount)}. ${
        covered
          ? 'Its funding covered it.'
          : `${money(pair.gap)} short.`
      }`}
    >
      <figcaption>
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-xs text-ink-muted">{detail}</p>
      </figcaption>
      <div className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-3 text-xs text-ink-secondary">
              <span>{row.label}</span>
              <span className="font-bold tabular-nums text-ink">{money(row.amount)}</span>
            </div>
            <div className="mt-1 h-5 w-full rounded-md bg-paper">
              <div
                className={`h-full rounded-md ${row.tone === 'full' ? 'bg-accent' : 'bg-accent-soft'}`}
                style={{ width: `${Math.max(2, (100 * row.amount) / (pair.a || 1))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p
        aria-hidden
        className={`mt-2 text-sm font-bold ${covered ? 'text-good' : 'text-critical'}`}
      >
        {covered ? 'Covered by its funding' : `${money(pair.gap)} short`}
      </p>
    </figure>
  );
}

function Big3Card({ district: d }: { district: District }) {
  const big3 = BIG3[d.code];
  if (!big3) return null;
  // Contracted ALE teaching inside AESD's MSOC cost - see build-program-spending.
  const aleContracts =
    (spendingJson.districts as Record<string, { msocBig3AleContracts?: number }>)[d.code]
      ?.msocBig3AleContracts ?? 0;

  const gaps = [big3.sped, big3.transportation, big3.msoc].map((p) => p.cost - p.revenue);
  // MSOC is the last of the three; only its surplus offsets the others.
  const msocAhead = Math.max(0, -gaps[2]);
  const totalGap = gaps.filter((g) => g > 0).reduce((sum, g) => sum + g, 0);
  const perStudent = big3.students > 0 ? totalGap / big3.students : 0;

  return (
    <div data-assistant-section="big-3" className="mt-4 card p-5">
      <h2 className="font-semibold">The &ldquo;Big 3&rdquo; funding gaps ({BIG3_YEAR})</h2>
      <p className="mt-0.5 text-sm text-ink-secondary">
        Washington&apos;s school leaders call special education, student
        transportation, and everyday operating costs <strong>the Big 3</strong>:
        the three places the state formula falls furthest short of what running
        a district actually costs. Here is each one for{' '}
        <span data-no-translate>{d.name}</span>, using the figures AESD publishes
        from OSPI&apos;s records.
      </p>

      <div className="mt-5 grid gap-6 sm:grid-cols-3 sm:gap-4">
        <Big3Gap
          title="Special education"
          detail="Services for students with disabilities"
          cost={big3.sped.cost}
          funding={big3.sped.revenue}
        />
        <Big3Gap
          title="Transportation"
          detail="Buses, drivers, fuel, and required routes"
          cost={big3.transportation.cost}
          funding={big3.transportation.revenue}
        />
        <Big3Gap
          title="Operating costs (MSOC)"
          detail="Curriculum, technology, utilities, and insurance"
          cost={big3.msoc.cost}
          funding={big3.msoc.revenue}
        />
      </div>

      {totalGap > 0 && (
        <p className="mt-5 rounded-xl border border-accent-soft bg-accent-wash p-3.5 text-sm text-ink-secondary">
          Where funding fell short, the gaps add up to{' '}
          <strong className="text-ink">{fmtMoney(totalGap)}</strong> for{' '}
          <span data-no-translate>{d.name.replace(/ School District.*$/, '')}</span>{' '}
          {isSchoolDistrict(d)
            ? 'to cover out of levies and other local money in'
            : 'to cover from its other money, without a levy, in'}{' '}
          {BIG3_YEAR} - about{' '}
          <strong className="text-ink">
            ${fmtInt(Math.round(perStudent))} per student
          </strong>
          .
          {msocAhead > 0 && (
            <>
              {' '}
              MSOC funding, which is not restricted to its own use, exceeded its cost by{' '}
              <strong className="text-ink">{fmtMoney(msocAhead)}</strong>.{' '}
              {totalGap > msocAhead ? (
                <>
                  After subtracting that, the remaining shortfall is{' '}
                  <strong className="text-ink">{fmtMoney(totalGap - msocAhead)}</strong>.
                </>
              ) : (
                <>That is more than the shortfall.</>
              )}
            </>
          )}
        </p>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        These are the same figures as{' '}
        <a
          href="https://app.powerbi.com/view?r=eyJrIjoiMzNiMGJlMjUtMTcwNC00YWMwLTg0ODktYTU5Zjg3NGJmOWJmIiwidCI6ImE5ZWIyNzExLTg0M2YtNDhjMC04M2NkLWM0M2FjNjAwOTgzMSJ9"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-accent hover:underline"
        >
          AESD&apos;s Big 3 dashboard ↗
        </a>
        , built from F-196 actuals and OSPI apportionment.
      </p>
      {aleContracts > 100_000 && aleContracts > 0.05 * big3.msoc.cost && (
        <p className="mt-2 text-xs text-ink-muted">
          AESD&apos;s operating-cost figure here includes{' '}
          <strong className="text-ink-secondary">{fmtMoney(aleContracts)}</strong>{' '}
          that the district&apos;s alternative learning (online) program paid
          outside providers to teach its students - teaching more than a
          true operating cost.
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-xs text-ink-secondary">
          <caption className="sr-only">
            What each Big 3 figure counts
          </caption>
          <thead>
            <tr className="text-left text-ink">
              <th scope="col" className="w-36 py-1.5 pr-3 font-semibold">
                <span className="sr-only">Program</span>
              </th>
              <th scope="col" className="py-1.5 font-semibold">What AESD counts</th>
            </tr>
          </thead>
          <tbody>
            {BIG3_DEFINITIONS.map(([term, definition]) => (
              <tr key={term} className="border-t border-line align-top">
                <th scope="row" className="py-1.5 pr-3 text-left font-semibold text-ink">
                  {term}
                </th>
                <td className="py-1.5">{definition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Big 3 per-student amounts divide by K-12 students plus alternative
        learning and transitional kindergarten students, leaving out Running
        Start, dropout reengagement, and private school students who take
        some classes in the district.
      </p>
    </div>
  );
}

/*
  What each Big 3 figure counts in AESD's definition - the same definition the
  district pages, topic pages and brief now use.
*/
const BIG3_DEFINITIONS: [string, string][] = [
  [
    'Special education',
    'Cost: state and federal programs together (F-196 programs 21 and 24). Funding: every special education revenue line - state, federal IDEA grants, Medicaid, and payments from other districts.',
  ],
  [
    'Transportation',
    'Cost: student transportation from the general fund (program 99); buses bought through the Transportation Vehicle Fund are not included. Funding: the state transportation allocation plus payments from other agencies and districts.',
  ],
  [
    'MSOC',
    'Cost: non-staff spending such as supplies, technology, utilities, and insurance, leaving out contracted transportation, tuition, debt, and building improvements. Funding: the state allocation for these costs plus the amount AESD counts for alternative learning students.',
  ],
];

/**
 * Data-driven read of a district's trends. Everything here is computed from the
 * district's own series (per-student funding and surplus) so it works for any
 * district - no hand-written per-district claims.
 */
function TrendAnalysis({ district: d, year }: { district: District; year: string }) {
  const ppSeries = districtSeries(d.code, (x) => x.perPupil);
  const pp = ppSeries
    .map((p) => p.value)
    .filter((v): v is number => v != null);
  const surp = districtSeries(d.code, (x) => x.surplus)
    .map((p) => p.value)
    .filter((v): v is number => v != null);
  if (pp.length < 2) return null;
  // Districts that opened mid-series (charters, new compact schools) have no
  // 2019-20 row, so anchor the comparison on their own first year of data.
  const firstYear = ppSeries.find((p) => p.value != null)?.label ?? YEARS[0];

  const ppPct = ((pp[pp.length - 1] - pp[0]) / pp[0]) * 100;
  const deficitYears = surp.filter((v) => v < 0).length;
  // The balance's own movement, not a sum of surpluses - see FundBalanceCard.
  const balances = districtSeries(d.code, (x) => x.fundBalance).filter(
    (p): p is { label: string; value: number } => p.value != null
  );
  const firstBalance = balances[0];
  const lastBalance = balances[balances.length - 1];
  const fundingTrend = ppPct > 2
    ? `Up ${Math.round(ppPct)}% since ${firstYear}`
    : ppPct < -2
      ? `Down ${Math.round(Math.abs(ppPct))}% since ${firstYear}`
      : `Roughly flat since ${firstYear}`;
  const balanceTrend = surp.length > 0
    ? `Spending exceeded revenue in ${deficitYears} of ${surp.length} years.${
        firstBalance && lastBalance && firstBalance !== lastBalance
          ? ` The fund balance went from ${fmtMoney(firstBalance.value)} (end of ${firstBalance.label}) to ${fmtMoney(lastBalance.value)} (end of ${lastBalance.label}).`
          : ''
      }`
    : 'No revenue and spending history is available.';
  const reserveAction = d.reserveRatio == null
    ? 'Check the latest district budget for its fund balance and reserve target.'
    : d.reserveRatio < RESERVE_THIN_PCT
      ? 'Ask the school board how it plans to rebuild reserves.'
      : 'Ask the school board whether reserves meet its target.';

  const oversight = oversightFor(d.code);

  return (
    <div data-assistant-section="trends" className="mt-4 rounded-xl border border-accent-soft bg-accent-wash p-4 md:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-deep">
        What the trends mean
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-secondary leading-relaxed">
        <li>
          <strong className="text-ink">Compare funding with costs.</strong>{' '}
          {fundingTrend}; {fmtMoneyFull(pp[pp.length - 1])} per student in {LATEST}.
          Compare that with changes in staffing and operating costs.
        </li>
        <li>
          <strong className="text-ink">Check the budget balance.</strong>{' '}
          {balanceTrend} Ask how next year&apos;s budget matches spending to revenue.
        </li>
        <li>
          <strong className="text-ink">Review the reserve plan.</strong>{' '}
          {d.reserveRatio != null && `Fund balance was ${d.reserveRatio.toFixed(1)}% of annual spending in ${year}. `}
          {reserveAction}
        </li>
      </ul>
      {/*
        Binding conditions is the one hard, official judgement about a
        district's finances - worth surfacing above our own generated read of
        the numbers.
      */}
      {oversight && (
        <div className="mt-3 rounded-lg border border-critical/40 bg-red-50 p-3">
          <p className="text-sm font-semibold text-critical">
            {oversight.level === 'enhanced'
              ? 'Under enhanced state financial oversight'
              : 'On state binding conditions'}
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            {oversight.detail}{' '}
            <a
              href={OVERSIGHT_SOURCE}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent hover:underline"
            >
              Review OSPI&apos;s recovery requirements ↗
            </a>
          </p>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-muted">
        Based on district financial data; not a formal fiscal assessment.
        {oversight
          ? ` Oversight status transcribed from OSPI on ${OVERSIGHT_CHECKED_ON}.`
          : ''}
      </p>
    </div>
  );
}

function DistrictDetail({
  district: d,
  year,
}: {
  district: District;
  year: string;
}) {
  const data = yearData(year);
  const s = data.statewide;

  const demoPct = (n: number) => (100 * n) / d.enrollment;
  const statePct = (key: keyof District['demo']) =>
    (100 * data.districts.reduce((sum, x) => sum + x.demo[key], 0)) / s.enrollment;

  // Charter and compact schools that opened after 2019-20 have a shorter
  // series, so label the charts with the first year this district reported.
  const perPupilSeries = districtSeries(d.code, (x) => x.perPupil);
  const enrollmentSeries = districtSeries(d.code, (x) => x.enrollment);
  const firstYear =
    perPupilSeries.find((p) => p.value != null)?.label ?? YEARS[0];

  const revenueYears = useMemo(
    () =>
      districtSeries(d.code, (x) => x.rev)
        .filter((p) => p.value != null)
        .map((p) => ({ label: p.label, ...p.value! })),
    [d.code]
  );

  // Every district in the selected year, for the need-vs-funding scatter.
  // State revenue only: local levy capacity is what the formula is supposed to
  // be correcting for, so mixing it in would hide the pattern.
  //
  // Charters and very small districts can be set aside because their tiny
  // enrollments dominate the chart's extremes - the 400-student line is the
  // prototypical model's own reference school, the same cutoff the district
  // brief uses for "too small for the state formula". The district being
  // viewed always keeps its dot, or opening its own profile would show a
  // chart it is missing from.
  /*
    Both filters start on. Charters and sub-400-student districts are the dots
    pinned to the top of the chart - tiny enrollments make their per-student
    figures swing hundreds of percent - so the default view opens on the
    districts the question is actually about, and unchecking either puts the
    outliers back.
  */
  const [hideCharters, setHideCharters] = useState(true);
  const [hideSmall, setHideSmall] = useState(true);
  const needPoints = useMemo<NeedPoint[]>(
    () =>
      data.districts
        .filter((x) => x.fundingEnrollment > 0 && x.enrollment > 0)
        .filter(
          (x) =>
            x.code === d.code ||
            ((!hideCharters || !CHARTER_CODES.has(x.code)) &&
              (!hideSmall || x.fundingEnrollment >= 400))
        )
        .map((x) => ({
          code: x.code,
          name: x.name,
          perStudent: x.rev.state / x.fundingEnrollment,
          lowIncome: x.demo.lowIncome / x.enrollment,
          ell: x.demo.ell / x.enrollment,
          sped: x.demo.sped / x.enrollment,
          enrollment: x.enrollment,
        })),
    [data, hideCharters, hideSmall, d.code]
  );

  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-8">
      <ClearSelectionLink />
      <div className="mt-3 flex items-baseline gap-3 flex-wrap">
        {/*
          An <h2>, not an <h1>: this detail view is swapped in below the
          page's own "District Explorer" heading rather than replacing it, so a
          second <h1> would give the hydrated page two competing top-level
          headings. The district's <h1> lives on its static page at
          /districts/<slug>/. Styling is unchanged.
        */}
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight" data-no-translate>
          {d.name}
        </h2>
      </div>
      <p className="mt-1 text-ink-secondary" data-no-translate>
        {d.county} County · {d.esd}
      </p>

      {(() => {
        const region = regionalizationFor(d.code, year);
        return (
      <div
        className={`mt-6 grid grid-cols-1 gap-3 ${
          region ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'
        }`}
      >
        <StatTile
          label={`Students (${year})`}
          value={fmtInt(Math.round(d.fundingEnrollment))}
          note="Funding FTE, not October headcount"
        />
        <StatTile label="Total funding" value={fmtMoney(d.rev.total)} note="general fund revenues" />
        <StatTile
          label="Per student"
          value={fmtMoneyFull(d.perPupil)}
          note={`Uses ${fmtInt(Math.round(d.fundingEnrollment))} funding FTE - not the ${fmtInt(d.enrollment)} headcount`}
        />
        {region && (
          <StatTile
            label="Regionalization"
            value={`${region.cis.toFixed(2)}×`}
            note={
              region.cis === 1 && region.cas === 1
                ? 'Salaries fund at the statewide base - no regional adjustment'
                : /*
                    The file folds the experience adjustment into the same
                    number, so for a district like Ritzville the whole +4% is
                    experience - claiming "hiring costs" there would be wrong.
                  */
                  `Salary allocations +${Math.round(100 * (region.cis - 1))}%${
                    region.exp
                      ? ', including the experience adjustment'
                      : ' for local hiring costs'
                  }${
                    region.cas === region.cis
                      ? ''
                      : region.cas === 1
                        ? ' · classified at the statewide base'
                        : ` · classified +${Math.round(100 * (region.cas - 1))}%`
                  }`
            }
          />
        )}
      </div>
        );
      })()}

      <FundBalanceCard district={d} year={year} />

      <div className="mt-4 grid lg:grid-cols-2 gap-4 items-start">
        <div className="card p-5">
          <h2 className="font-semibold mb-1">
            Funding per student since {firstYear}
          </h2>
          <p className="text-xs text-ink-muted mb-3">Nominal dollars · hover for values</p>
          <TrendChart
            points={perPupilSeries}
            format={(v) => `$${fmtInt(Math.round(v))}`}
            ariaLabel={`${d.name} funding per student by year`}
          />
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-1">Enrollment since {firstYear}</h2>
          <p className="text-xs text-ink-muted mb-3">October headcount · hover for values</p>
          <TrendChart
            points={enrollmentSeries}
            format={(v) => fmtInt(Math.round(v))}
            ariaLabel={`${d.name} enrollment by year`}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        <strong>Why the numbers differ:</strong> the totals above use
        annual-average funding FTE; this chart uses October headcount.
      </p>

      <TrendAnalysis district={d} year={year} />

      <div className="mt-4 card p-5">
        <h2 className="font-semibold mb-1">
          Where the money came from, {firstYear} to {LATEST}
        </h2>
        <p className="text-xs text-ink-muted mb-4">
          Share of each year&apos;s general-fund revenue · hover a year for
          exact amounts
        </p>
        <RevenueTrendChart years={revenueYears} />
        <p className="mt-3 text-xs text-ink-muted">
          Federal share peaks in the pandemic years and falls back as ESSER
          money expires - a bulge districts had to plan around, not a permanent
          increase.
        </p>
      </div>

      <div className="mt-4 card p-5">
        <h2 className="font-semibold mb-1">
          Does student need change what a district gets?
        </h2>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-xs text-ink-muted">
            Every Washington district in {year} · <span data-no-translate>{d.name}</span> highlighted
          </p>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs text-ink-secondary">
              <input
                type="checkbox"
                checked={hideCharters}
                onChange={(e) => setHideCharters(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Exclude charter schools ({CHARTER_CODES.size})
            </label>
            <label
              className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs text-ink-secondary"
              title="400 students is the prototypical model's reference school - the size the state formula funds as one whole school."
            >
              <input
                type="checkbox"
                checked={hideSmall}
                onChange={(e) => setHideSmall(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Exclude districts under 400 students
            </label>
          </span>
        </div>
        <ChartErrorBoundary label="This chart">
          <NeedVsFundingChart points={needPoints} highlight={d.code} />
        </ChartErrorBoundary>
        <p className="mt-2 text-xs text-ink-muted">
          &ldquo;Low income&rdquo; is OSPI&apos;s Report Card low-income count -
          free or reduced-price meal eligible plus students identified by direct
          certification - which is broader than a raw free/reduced-price-lunch
          (FRPL) figure.
        </p>
      </div>

      <div data-assistant-section="funding-sources" className="mt-4 grid lg:grid-cols-2 gap-4 items-start">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">
            Where{' '}
            <span data-no-translate>{d.name.replace(/ School District.*$/, '')}</span>
            &apos;s money comes from ({year})
          </h2>
          <SourceShareBar slices={d.rev} />
          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">Revenues by source</caption>
            <tbody>
              {(
                [
                  ['State', d.rev.state],
                  ['Local', d.rev.local],
                  ['Federal', d.rev.federal],
                  ['Other', d.rev.other],
                ] as const
              ).map(([label, v]) => (
                <tr key={label} className="border-t border-line">
                  <td className="py-1.5 text-ink-secondary">{label}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoneyFull(v)}</td>
                  <td className="py-1.5 text-right tabular-nums w-16 text-ink-muted">
                    {pct(v, d.rev.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-1">Who the students are ({year})</h2>
          <p className="text-xs text-ink-muted mb-4">
            Share of enrolled students · dark tick = state average
          </p>
          <div className="space-y-4">
            <CompareBar label="Low income" value={demoPct(d.demo.lowIncome)} reference={statePct('lowIncome')} />
            <CompareBar label="English language learners" value={demoPct(d.demo.ell)} reference={statePct('ell')} />
            <CompareBar label="Students with disabilities" value={demoPct(d.demo.sped)} reference={statePct('sped')} />
            <CompareBar label="Highly capable" value={demoPct(d.demo.highlyCapable)} reference={statePct('highlyCapable')} />
            <CompareBar label="Experiencing homelessness" value={demoPct(d.demo.homeless)} reference={statePct('homeless')} />
            <CompareBar label="Migrant" value={demoPct(d.demo.migrant)} reference={statePct('migrant')} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Per-student funding ranges from {fmtMoneyFull(s.minPerPupil)} to{' '}
        {fmtMoneyFull(s.maxPerPupil)} in {year}: targeted programs follow need,
        and small districts cost more per student to run.
      </p>

      <Big3Card district={d} />

      {/*
        The page used to end on two grey caveats. Someone who has just read that
        their district drew down its reserves had nowhere to go: the diagnosis,
        the downloadable brief and their legislators all live on Take Action,
        and nothing here said so.
      */}
      <Link
        href={`/take-action?d=${d.code}`}
        className="card mt-8 flex items-center justify-between gap-4 p-5 no-underline hover:border-accent"
      >
        <span>
          <span className="block font-semibold text-accent">
            What to do about it
          </span>
          <span className="mt-0.5 block text-sm text-ink-secondary">
            {d.name}&apos;s funding brief, a printable one-page PDF, and the
            legislators who represent it.
          </span>
        </span>
        <span aria-hidden className="text-xl leading-none text-accent">
          →
        </span>
      </Link>
    </div>
  );
}
