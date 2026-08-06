'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { District, LATEST, YEARS, districtSeries, statewideSeries, yearData } from '@/lib/data';
import StatTile from '@/components/StatTile';
import SourceShareBar from '@/components/charts/SourceShareBar';
import CompareBar from '@/components/charts/CompareBar';
import TrendChart from '@/components/charts/TrendChart';
import RevenueTrendChart from '@/components/charts/RevenueTrendChart';
import NeedVsFundingChart, { NeedPoint } from '@/components/charts/NeedVsFundingChart';
import WaMap from '@/components/charts/WaMap';
import ChartErrorBoundary from '@/components/ChartErrorBoundary';
import { oversightFor, OVERSIGHT_SOURCE, OVERSIGHT_CHECKED_ON } from '@/data/oversight';
import { fmtInt, fmtMoney, fmtMoneyFull, fmtSignedMoney, pct } from '@/lib/format';
import { useAssistantDistrict, useAssistantYear } from '@/lib/assistant/store';
import { writeSelectedDistrict } from '@/lib/selected-district';

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
  const clearDistrict = useCallback(() => router.push('/districts'), [router]);
  useAssistantYear(year, setYear);
  useAssistantDistrict(selectedCode, {
    select: selectDistrict,
    clear: clearDistrict,
  });

  if (selectedCode && selected) {
    return <DistrictDetail district={selected} year={year} />;
  }
  if (selectedCode) {
    // District exists in another year but not this one. Offer the most
    // recent year it actually has data for - which is not always LATEST: a
    // district that closed, merged, or lost its charter after an earlier year
    // has no record in 2024-25 either, and "Switch to 2024-25" would just
    // land back on the same empty page.
    const yearsWithData = YEARS.filter((y) =>
      yearData(y).districts.some((d) => d.code === selectedCode)
    );
    const fallbackYear = yearsWithData[yearsWithData.length - 1];
    return (
      <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
        <Link href="/districts" className="text-sm text-accent hover:underline">
          ← District Explorer
        </Link>
        <p className="mt-6 text-ink-secondary">
          {fallbackYear ? (
            <>
              No data for this district in {year}.{' '}
              <button
                className="text-accent hover:underline"
                onClick={() => setYear(fallbackYear)}
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
  return (
    <DistrictOverview
      year={year}
      onSelect={(code) => router.push(`/districts?d=${code}`)}
    />
  );
}

function DistrictOverview({
  year,
  onSelect,
}: {
  year: string;
  onSelect: (code: string) => void;
}) {
  const data = yearData(year);
  const s = data.statewide;

  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
      {/* The school-year control lives in the site header, beside the
          language control - see SchoolYearSwitcher. */}
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        District Explorer
      </h1>
      <p className="mt-3 max-w-2xl text-ink-secondary">
        Funding for every school district and charter school in Washington,
        from the F-196 financial reports, any year since 2019-20. Pick your
        district on the map - its full profile opens on this page.
      </p>

      <div data-assistant-section="district-stats" className="mt-6 grid lg:grid-cols-[1fr,22rem] gap-4 items-stretch">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label={`Districts & charters (${year})`} value={String(s.districts)} />
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

      <div data-assistant-section="district-picker" className="mt-6 card p-5">
        <h2 className="font-semibold">Find your district on the map</h2>
        <p className="mt-0.5 mb-4 text-sm text-ink-secondary">
          Pick from the dropdown or click your district to open its profile.
        </p>
        <ChartErrorBoundary label="The map">
          <WaMap year={year} onSelect={onSelect} />
        </ChartErrorBoundary>
      </div>
      <p className="mt-3 text-xs text-ink-muted max-w-2xl">
        Per-student figures divide general fund revenues by OSPI&apos;s final
        annual-average funding FTE, including Running Start college FTE. The
        student total above is that same funding FTE, not the Report
        Card&apos;s October headcount.
      </p>
    </div>
  );
}

function FundBalanceCard({ district: d, year }: { district: District; year: string }) {
  const surplus = d.surplus;
  const deficit = surplus < 0;
  // Running total: net added to / drawn from reserves across every year this
  // district reported. Districts that opened mid-series cover a shorter span,
  // so the sentence below names their own first year rather than assuming
  // 2019-20.
  const netSeries = districtSeries(d.code, (x) => x.surplus);
  const cumulative = netSeries.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const firstYear = netSeries.find((p) => p.value != null)?.label ?? YEARS[0];
  const maxAbs = Math.max(1, ...netSeries.map((p) => Math.abs(p.value ?? 0)));

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
        <div className={`rounded-lg border p-4 ${deficit ? 'border-critical/40 bg-red-50' : 'border-good/40 bg-green-50'}`}>
          <div className="text-sm text-ink-secondary">
            {deficit ? 'Drew down savings' : 'Added to savings'}
          </div>
          <div className={`text-2xl font-bold ${deficit ? 'text-critical' : 'text-good'}`}>
            {fmtSignedMoney(surplus)}
          </div>
          <div className="text-xs text-ink-muted mt-0.5">this year&apos;s change in fund balance</div>
        </div>
      </div>

      {/* Fund balance (savings on hand) + reserve ratio */}
      {d.fundBalance != null && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-line p-4">
            <div className="text-sm text-ink-secondary">Fund balance (savings on hand)</div>
            <div className={`text-2xl font-bold ${d.fundBalance < 0 ? 'text-critical' : ''}`}>
              {fmtSignedMoney(d.fundBalance).replace('+', '')}
            </div>
            <div className="text-xs text-ink-muted mt-1">
              The savings left at year&apos;s end, carried forward for emergencies,
              uneven cash flow, and next year&apos;s start-up costs.
            </div>
          </div>
          {(() => {
            const rr = d.reserveRatio;
            if (rr == null) return null;
            const cls =
              rr >= 5
                ? 'border-good/40 bg-green-50'
                : rr >= 0
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-critical/40 bg-red-50';
            const textCls = rr >= 5 ? 'text-good' : rr >= 0 ? 'text-amber-600' : 'text-critical';
            const status =
              rr >= 5
                ? 'Healthy cushion'
                : rr >= 0
                  ? 'Thin - under the 5% this site flags'
                  : 'Negative - no cushion left';
            return (
              <div className={`rounded-lg border p-4 ${cls}`}>
                <div className="text-sm text-ink-secondary">Reserve ratio</div>
                <div className={`text-2xl font-bold ${textCls}`}>{rr.toFixed(1)}%</div>
                <div className="text-xs mt-0.5 font-medium">
                  <span className={textCls}>{status.replace('—', '-')}</span>
                </div>
                <div className="text-xs text-ink-muted mt-1">
                  Savings as a share of annual spending (fund balance ÷ spending).
                  This site flags anything under 5%, the level Washington
                  school-finance practice treats as a working floor and the point
                  where one bad year can force cuts. It is a low bar: the
                  Government Finance Officers Association&apos;s general guideline
                  is two months of operating spending, about 17%.
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Year-by-year net strip */}
      <div className="mt-5">
        <div className="text-xs font-medium text-ink-secondary mb-2">
          Surplus / (deficit) by year
        </div>
        <div className="flex items-stretch gap-2" role="img" aria-label={`${d.name} surplus or deficit by year`}>
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

      <p className="mt-4 text-sm text-ink-secondary">
        Since {firstYear}, <span data-no-translate>{d.name}</span> has{' '}
        <strong className={cumulative < 0 ? 'text-critical' : 'text-good'}>
          {cumulative < 0 ? 'spent down' : 'added'} {fmtMoney(Math.abs(cumulative))}
        </strong>{' '}
        net {cumulative < 0 ? 'from' : 'to'} its reserves
        {d.fundBalance != null && (
          <>
            , landing at a {fmtSignedMoney(d.fundBalance).replace('+', '')} fund
            balance
            {d.reserveRatio != null && <> ({d.reserveRatio.toFixed(1)}% of spending)</>}
          </>
        )}
        .
      </p>
      <p className="mt-2 text-xs text-ink-muted max-w-2xl">
        Revenues and expenditures are OSPI F-196 actuals; the ending fund balance
        and reserve ratio come from fiscal.wa.gov&apos;s statewide school-finance
        workbook. Bars show each year&apos;s change (money in minus money out).
      </p>
    </div>
  );
}

/**
 * Data-driven read of a district's trends. Everything here is computed from the
 * district's own series (per-student, enrollment, surplus) so it works for any
 * district - no hand-written per-district claims.
 */
function TrendAnalysis({ district: d }: { district: District }) {
  const ppSeries = districtSeries(d.code, (x) => x.perPupil);
  const pp = ppSeries
    .map((p) => p.value)
    .filter((v): v is number => v != null);
  const enr = districtSeries(d.code, (x) => x.enrollment)
    .map((p) => p.value)
    .filter((v): v is number => v != null);
  const surp = districtSeries(d.code, (x) => x.surplus)
    .map((p) => p.value)
    .filter((v): v is number => v != null);
  if (pp.length < 2 || enr.length < 2) return null;
  // Districts that opened mid-series (charters, new compact schools) have no
  // 2019-20 row, so anchor the comparison on their own first year of data.
  const firstYear = ppSeries.find((p) => p.value != null)?.label ?? YEARS[0];

  const ppPct = ((pp[pp.length - 1] - pp[0]) / pp[0]) * 100;
  const enrPct = ((enr[enr.length - 1] - enr[0]) / enr[0]) * 100;
  const deficitYears = surp.filter((v) => v < 0).length;
  const cumNet = surp.reduce((a, b) => a + b, 0);
  const drewDown = cumNet < 0;
  const name = d.name.replace(/ School District.*$/, '').replace(/ Public Schools$/, '');

  const sentences: string[] = [];

  // 1. The headline trend
  if (ppPct > 2) {
    sentences.push(
      `${name}'s funding per student has risen about ${Math.round(ppPct)}% since ${firstYear} (from ${fmtMoneyFull(pp[0])} to ${fmtMoneyFull(pp[pp.length - 1])}).`
    );
  } else if (ppPct < -2) {
    sentences.push(
      `${name}'s funding per student has fallen about ${Math.round(Math.abs(ppPct))}% since ${firstYear}.`
    );
  } else {
    sentences.push(`${name}'s funding per student has held roughly flat since ${firstYear}.`);
  }

  // 2. The context that complicates the headline
  if (ppPct > 2 && drewDown) {
    sentences.push(
      `That upward line looks reassuring, but it doesn't mean the district is flush: it spent more than it took in during ${deficitYears} of the last ${surp.length} years, drawing down about ${fmtMoney(Math.abs(cumNet))} net from reserves. Per-student funding rising while savings shrink usually means the increases aren't keeping pace with real costs.`
    );
  } else if (ppPct > 2 && enrPct < -3) {
    sentences.push(
      `Some of that increase is mechanical: enrollment fell about ${Math.round(Math.abs(enrPct))}% over the same span, so a similar pot of money is split among fewer students rather than reflecting genuinely richer funding.`
    );
  } else if (ppPct > 2) {
    sentences.push(
      `Whether that keeps pace with rising salaries, special-education costs, and inflation is the real question - a higher nominal figure can still be a cut in real terms.`
    );
  } else if (drewDown) {
    sentences.push(
      `Meanwhile the district ran a deficit in ${deficitYears} of the last ${surp.length} years, drawing down about ${fmtMoney(Math.abs(cumNet))} net from reserves - a sign that funding hasn't matched what it costs to run these schools.`
    );
  } else {
    sentences.push(
      `Against rising salaries and inflation, flat funding is effectively a cut, even as the total dollar figure holds steady.`
    );
  }

  // 3. The reserve-ratio reality check (the sharpest signal when available)
  if (d.reserveRatio != null && d.reserveRatio < 0) {
    sentences.push(
      `Its reserves have run dry: the reserve ratio is now ${d.reserveRatio.toFixed(1)}%, meaning the district has essentially no savings cushion left, so any further shortfall means cuts.`
    );
  } else if (d.reserveRatio != null && d.reserveRatio < 5) {
    sentences.push(
      `Its reserve ratio has slipped to ${d.reserveRatio.toFixed(1)}%, under the 5% this site flags as thin - a single bad year could force cuts.`
    );
  } else {
    sentences.push(
      `Read the funding line together with the surplus/deficit bars above: more dollars per student only help if they outpace what the district actually needs to spend.`
    );
  }

  const oversight = oversightFor(d.code);

  return (
    <div data-assistant-section="trends" className="mt-4 rounded-xl border border-accent-soft bg-accent-wash p-4 md:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-deep">
        What the trends mean
      </p>
      <p className="mt-2 text-sm md:text-base text-ink-secondary leading-relaxed">
        {sentences.join(' ')}
      </p>
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
            {oversight.detail} Districts that cannot adopt a balanced budget must
            request binding conditions from OSPI, which then sets fund-balance
            targets and requires more frequent financial reporting.{' '}
            <a
              href={OVERSIGHT_SOURCE}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent hover:underline"
            >
              OSPI status documents ↗
            </a>
          </p>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-muted">
        Auto-generated from this district&apos;s own funding, enrollment, and
        surplus/deficit data - a starting point for interpretation, not a formal
        fiscal assessment.
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
  const needPoints = useMemo<NeedPoint[]>(
    () =>
      data.districts
        .filter((x) => x.fundingEnrollment > 0 && x.enrollment > 0)
        .map((x) => ({
          code: x.code,
          name: x.name,
          perStudent: x.rev.state / x.fundingEnrollment,
          lowIncome: x.demo.lowIncome / x.enrollment,
          ell: x.demo.ell / x.enrollment,
          sped: x.demo.sped / x.enrollment,
          enrollment: x.enrollment,
        })),
    [data]
  );

  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-8">
      <Link href="/districts" className="text-sm text-accent hover:underline">
        ← District Explorer
      </Link>
      <div className="mt-3 flex items-baseline gap-3 flex-wrap">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-no-translate>
          {d.name}
        </h1>
      </div>
      <p className="mt-1 text-ink-secondary" data-no-translate>
        {d.county} County · {d.esd}
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      </div>

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

      <TrendAnalysis district={d} />

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
        <p className="text-xs text-ink-muted mb-4">
          Every Washington district in {year} · <span data-no-translate>{d.name}</span> highlighted
        </p>
        <ChartErrorBoundary label="This chart">
          <NeedVsFundingChart points={needPoints} highlight={d.code} />
        </ChartErrorBoundary>
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

      <p className="mt-4 text-xs text-ink-muted max-w-2xl">
        <strong>Why the numbers differ:</strong> the student total above and
        the per-student figure both use annual-average funding FTE, which
        counts part-time participation such as Running Start proportionally.
        The enrollment chart below instead tracks the Report Card&apos;s
        October headcount, so it will not match the total above exactly.
      </p>

      <p className="mt-3 text-xs text-ink-muted max-w-2xl">
        Higher-need districts generally receive more per student - targeted
        programs (special education, the Learning Assistance Program for students
        who are behind, bilingual education) and federal Title dollars follow
        need. Small rural districts also cost more per student to run.
        That&apos;s why per-student funding ranges from{' '}
        {fmtMoneyFull(s.minPerPupil)} to {fmtMoneyFull(s.maxPerPupil)} across the
        state in {year}.
      </p>

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
            three legislators who represent it.
          </span>
        </span>
        <span aria-hidden className="text-xl leading-none text-accent">
          →
        </span>
      </Link>
    </div>
  );
}
