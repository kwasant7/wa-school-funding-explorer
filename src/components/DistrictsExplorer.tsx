'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  District,
  LATEST,
  YEARS,
  districtSeries,
  statewideSeries,
  yearData,
} from '@/lib/data';
import StatTile from '@/components/StatTile';
import SourceShareBar from '@/components/charts/SourceShareBar';
import CompareBar from '@/components/charts/CompareBar';
import TrendChart from '@/components/charts/TrendChart';
import WaMap from '@/components/charts/WaMap';
import { fmtInt, fmtMoney, fmtMoneyFull, pct } from '@/lib/format';

type SortKey = 'name' | 'county' | 'enrollment' | 'total' | 'perPupil' | 'statePct' | 'localPct';

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'District' },
  { key: 'county', label: 'County' },
  { key: 'enrollment', label: 'Students', numeric: true },
  { key: 'total', label: 'Total funding', numeric: true },
  { key: 'perPupil', label: '$ / student', numeric: true },
  { key: 'statePct', label: 'State %', numeric: true },
  { key: 'localPct', label: 'Local %', numeric: true },
];

function sortValue(d: District, key: SortKey): string | number {
  switch (key) {
    case 'name':
      return d.name;
    case 'county':
      return d.county;
    case 'enrollment':
      return d.enrollment;
    case 'total':
      return d.rev.total;
    case 'perPupil':
      return d.perPupil;
    case 'statePct':
      return d.rev.state / d.rev.total;
    case 'localPct':
      return d.rev.local / d.rev.total;
  }
}

function YearSelect({ year, onChange }: { year: string; onChange: (y: string) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink-secondary">
      School year
      <select
        value={year}
        onChange={(e) => onChange(e.target.value)}
        className="card px-3 py-2 text-base font-medium text-ink cursor-pointer"
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function DistrictsExplorer() {
  const router = useRouter();
  const params = useSearchParams();
  const [year, setYear] = useState(LATEST);
  const selectedCode = params.get('d');
  const selected = useMemo(
    () => yearData(year).districts.find((d) => d.code === selectedCode) ?? null,
    [selectedCode, year]
  );

  if (selectedCode && selected) {
    return <DistrictDetail district={selected} year={year} onYearChange={setYear} />;
  }
  if (selectedCode) {
    // District exists in another year but not this one
    return (
      <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
        <Link href="/districts" className="text-sm text-accent hover:underline">
          ← All districts
        </Link>
        <p className="mt-6 text-ink-secondary">
          No data for this district in {year}.{' '}
          <button className="text-accent hover:underline" onClick={() => setYear(LATEST)}>
            Switch to {LATEST}
          </button>
        </p>
      </div>
    );
  }
  return (
    <DistrictTable
      year={year}
      onYearChange={setYear}
      onSelect={(code) => router.push(`/districts?d=${code}`)}
    />
  );
}

function DistrictTable({
  year,
  onYearChange,
  onSelect,
}: {
  year: string;
  onYearChange: (y: string) => void;
  onSelect: (code: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('enrollment');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const data = yearData(year);

  const byCounty = useMemo(() => {
    const groups = new Map<string, District[]>();
    for (const d of data.districts) {
      if (!groups.has(d.county)) groups.set(d.county, []);
      groups.get(d.county)!.push(d);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([county, ds]) => [county, [...ds].sort((a, b) => a.name.localeCompare(b.name))] as const);
  }, [data]);

  const rows = useMemo(() => {
    return [...data.districts].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp =
        typeof av === 'string'
          ? av.localeCompare(bv as string)
          : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const s = data.statewide;

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'county' ? 'asc' : 'desc');
    }
  }

  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        District Explorer
      </h1>
      <p className="mt-3 max-w-2xl text-ink-secondary">
        Every school district and charter school in Washington, with general
        fund revenues from the F-196 financial reports for any year since
        2019–20. Click a district for its full profile and trends.
      </p>

      <div className="mt-6 grid lg:grid-cols-[1fr,22rem] gap-4 items-stretch">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label={`Districts & charters (${year})`} value={String(s.districts)} />
          <StatTile label="Students statewide" value={fmtInt(s.enrollment)} />
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

      <div className="mt-6 card p-5">
        <h2 className="font-semibold">Find your district on the map</h2>
        <p className="mt-0.5 mb-4 text-sm text-ink-secondary">
          Colored by total funding. Search to highlight your district, then open
          its profile from the card. Pinch (or Ctrl+scroll) to zoom.
        </p>
        <WaMap year={year} onSelect={onSelect} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-ink-secondary">
          Jump to a district
          <select
            value=""
            onChange={(e) => e.target.value && onSelect(e.target.value)}
            className="card px-3 py-2 text-base font-medium text-ink cursor-pointer max-w-[16rem] md:max-w-xs"
          >
            <option value="">Choose from {data.districts.length} districts…</option>
            {byCounty.map(([county, ds]) => (
              <optgroup key={county} label={`${county} County`}>
                {ds.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <YearSelect year={year} onChange={onYearChange} />
      </div>

      <div className="mt-4 card overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="text-left text-ink-secondary border-b border-line">
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th key={col.key} className={col.numeric ? 'text-right' : 'text-left'}>
                    <button
                      onClick={() => toggleSort(col.key)}
                      className={`w-full px-3 md:px-4 py-3 font-medium hover:text-ink ${
                        col.numeric ? 'text-right' : 'text-left'
                      } ${active ? 'text-ink' : ''}`}
                      aria-sort={
                        active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                      }
                    >
                      {col.label}
                      <span className="inline-block w-3 text-accent">
                        {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr
                key={d.code}
                onClick={() => onSelect(d.code)}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(d.code)}
                tabIndex={0}
                className="border-t border-line cursor-pointer hover:bg-accent-wash transition-colors"
              >
                <td className="px-3 md:px-4 py-2.5 font-medium text-accent">{d.name}</td>
                <td className="px-3 md:px-4 py-2.5 text-ink-secondary">{d.county}</td>
                <td className="px-3 md:px-4 py-2.5 text-right tabular-nums">{fmtInt(d.enrollment)}</td>
                <td className="px-3 md:px-4 py-2.5 text-right tabular-nums">{fmtMoney(d.rev.total)}</td>
                <td className="px-3 md:px-4 py-2.5 text-right tabular-nums">{fmtMoneyFull(d.perPupil)}</td>
                <td className="px-3 md:px-4 py-2.5 text-right tabular-nums">{pct(d.rev.state, d.rev.total)}</td>
                <td className="px-3 md:px-4 py-2.5 text-right tabular-nums">{pct(d.rev.local, d.rev.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Per-student figures divide general fund revenues by October headcount
        enrollment; official OSPI per-pupil statistics use annual average FTE and
        will differ slightly.
      </p>
    </div>
  );
}

function DistrictDetail({
  district: d,
  year,
  onYearChange,
}: {
  district: District;
  year: string;
  onYearChange: (y: string) => void;
}) {
  const data = yearData(year);
  const s = data.statewide;
  const rank =
    [...data.districts].sort((a, b) => b.perPupil - a.perPupil).findIndex((x) => x.code === d.code) + 1;
  const vsAvg = d.perPupil - s.avgPerPupil;

  const demoPct = (n: number) => (100 * n) / d.enrollment;
  const statePct = (key: keyof District['demo']) =>
    (100 * data.districts.reduce((sum, x) => sum + x.demo[key], 0)) / s.enrollment;

  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href="/districts" className="text-sm text-accent hover:underline">
          ← All districts
        </Link>
        <YearSelect year={year} onChange={onYearChange} />
      </div>
      <div className="mt-3 flex items-baseline gap-3 flex-wrap">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{d.name}</h1>
      </div>
      <p className="mt-1 text-ink-secondary">
        {d.county} County · {d.esd}
      </p>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label={`Students (${year})`} value={fmtInt(d.enrollment)} />
        <StatTile label="Total funding" value={fmtMoney(d.rev.total)} note="general fund revenues" />
        <StatTile
          label="Per student"
          value={fmtMoneyFull(d.perPupil)}
          note={`${vsAvg >= 0 ? '+' : '−'}${fmtMoneyFull(Math.abs(vsAvg)).slice(1)} vs state average`}
        />
        <StatTile label="Per-student rank" value={`#${rank}`} note={`of ${s.districts} districts`} />
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-4 items-start">
        <div className="card p-5">
          <h2 className="font-semibold mb-1">Funding per student since 2019–20</h2>
          <p className="text-xs text-ink-muted mb-3">Nominal dollars · hover for values</p>
          <TrendChart
            points={districtSeries(d.code, (x) => x.perPupil)}
            format={(v) => `$${fmtInt(Math.round(v))}`}
            ariaLabel={`${d.name} funding per student by year`}
          />
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-1">Enrollment since 2019–20</h2>
          <p className="text-xs text-ink-muted mb-3">October headcount · hover for values</p>
          <TrendChart
            points={districtSeries(d.code, (x) => x.enrollment)}
            format={(v) => fmtInt(Math.round(v))}
            ariaLabel={`${d.name} enrollment by year`}
          />
        </div>
      </div>

      <div className="mt-4 grid lg:grid-cols-2 gap-4 items-start">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">
            Where {d.name.replace(/ School District.*$/, '')}&apos;s money comes from ({year})
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
        Higher-need districts generally receive more per student — categorical
        programs (special education, LAP, bilingual education) and federal Title
        dollars follow need. Small rural districts also cost more per student to
        run. That&apos;s why per-student funding ranges from{' '}
        {fmtMoneyFull(s.minPerPupil)} to {fmtMoneyFull(s.maxPerPupil)} across the
        state in {year}.
      </p>
    </div>
  );
}
