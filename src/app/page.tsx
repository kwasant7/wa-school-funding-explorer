'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { District, LATEST, YEARS, yearData } from '@/lib/data';
import StatTile from '@/components/StatTile';
import SourceShareBar from '@/components/charts/SourceShareBar';
import CountUp from '@/components/interactive/CountUp';
import DistrictQuickFind from '@/components/interactive/DistrictQuickFind';
import SchoolBuilder from '@/components/interactive/SchoolBuilder';
import ClassSizeViz from '@/components/interactive/ClassSizeViz';
import FundingJourney from '@/components/interactive/FundingJourney';
import { useAssistantDistrict, useAssistantYear } from '@/lib/assistant/store';
import { yearData as yearDataFor } from '@/lib/data';

export default function HomePage() {
  const [year, setYear] = useState(LATEST);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const s = yearData(year).statewide;

  /*
    Publish this page's state to the assistant. Selection here is a District
    object held in local state rather than a code in the URL, so the setter
    resolves the code back to the record the page already renders from.
  */
  const selectDistrict = useCallback(
    (code: string) => {
      const record =
        yearDataFor(year).districts.find((d) => d.code === code) ?? null;
      if (record) setSelectedDistrict(record);
    },
    [year]
  );
  const clearDistrict = useCallback(() => setSelectedDistrict(null), []);
  useAssistantYear(year, setYear);
  useAssistantDistrict(selectedDistrict?.code ?? null, {
    select: selectDistrict,
    clear: clearDistrict,
  });

  return (
    <div className="max-w-site mx-auto px-4 md:px-6">
      {/* Hero */}
      <section data-assistant-section="hero" className="pt-10 md:pt-14 pb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-accent uppercase tracking-wide">
              How it works · play with everything on this page
            </p>
            <h1 className="mt-2 text-3xl md:text-5xl font-bold tracking-tight max-w-3xl">
              How K-12 schools are funded
            </h1>
          </div>
          {/* Same placement as the District Explorer: ahead of the figures it
              governs, so the year is read before the numbers. */}
          <label className="shrink-0 inline-flex items-center gap-2 text-sm text-ink-secondary md:pt-2">
            School year
            <select
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="card px-3 py-2 text-base font-medium text-ink cursor-pointer"
            >
              {YEARS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
          The state doesn&apos;t fund the schools that exist - it funds a
          make-believe &ldquo;prototypical school&rdquo; and uses it as a recipe
          for real money. A lot of it:
        </p>
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="Funding this year"
            value={<CountUp value={s.revenues.total} kind="money" />}
            note={`entire Washington state general-fund total, ${year}`}
          />
          <StatTile
            label="Students"
            value={<CountUp value={Math.round(s.fundingEnrollment)} kind="int" />}
            note="Funding FTE, not October headcount"
          />
          <StatTile
            label="Districts & charters"
            value={<CountUp value={s.districts} kind="plain" />}
          />
          <StatTile
            label="Average per student"
            value={<CountUp value={s.avgPerPupil} kind="moneyFull" />}
            note="Same funding FTE as above"
          />
        </div>
      </section>

      {/* Personalize */}
      <section data-assistant-section="district-picker" className="pb-8">
        <DistrictQuickFind onPick={setSelectedDistrict} year={year} />
      </section>

      {selectedDistrict ? (
        <>
      {/* Money sources */}
      <section data-assistant-section="funding-sources" className="pb-8">
        <div className="card p-5 md:p-6">
          <h2 className="text-lg md:text-xl font-bold">
            How <span data-no-translate>{selectedDistrict.name}</span>&apos;s funding is split
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Actual {year} general-fund revenue by source. Hover the bar for
            exact amounts and shares.
          </p>
          <div className="mt-4">
            <SourceShareBar slices={selectedDistrict.rev} />
          </div>
        </div>
      </section>

      {/* Model explainer -> builder */}
      <section data-assistant-section="prototypical-model" className="py-6">
        <h2 className="text-2xl md:text-3xl font-bold max-w-2xl">
          How the formula funds <span data-no-translate>{selectedDistrict.name}</span>
        </h2>
        <p className="mt-2 max-w-2xl text-ink-secondary">
          Washington does not start with each school&apos;s actual payroll. Instead,
          it uses one statewide recipe - the prototypical school model - to
          estimate the staff and operating dollars a district should receive.
        </p>
        <div className="mt-5 grid gap-5">
          <div className="card p-5 md:p-6 bg-accent-wash border-accent-soft">
            <h3 className="text-lg font-bold">How the model actually works</h3>
            <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm text-ink-secondary">
              <div>
                <p className="font-semibold text-ink">1. Start with enrollment</p>
                <p className="mt-1">
                  The state counts students in{' '}
                  <strong className="text-ink">FTE (full-time equivalent)</strong>{' '}
                  - a measure of enrollment by how much school a student
                  actually attends, not just how many bodies are counted. A
                  student enrolled half-time counts as 0.5 FTE, not 1. The state
                  uses this funding FTE by grade span, then converts it into
                  shares of model elementary, middle, and high schools.
                </p>
              </div>
              <div>
                <p className="font-semibold text-ink">2. Generate a staffing allocation</p>
                <p className="mt-1">Each model school is assigned teacher ratios and fractional positions for principals, counselors, librarians, office staff, custodians, and nurses.</p>
              </div>
              <div>
                <p className="font-semibold text-ink">3. Turn positions into dollars</p>
                <p className="mt-1">The state applies salary and benefit assumptions, regionalization, materials and operating costs, then adds funding for students with additional needs.</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-secondary">
              These are funding allocations, not a required staffing plan. Districts can organize schools differently, but must cover anything beyond the formula with other available revenue.
            </p>
          </div>
          <SchoolBuilder district={selectedDistrict} year={year} />
          <ClassSizeViz />
        </div>
      </section>

      {/* Steps */}
      <section data-assistant-section="funding-journey" className="py-8">
        <h2 className="text-2xl md:text-3xl font-bold">
          How state money reaches <span data-no-translate>{selectedDistrict.name}</span>, in 7 steps
        </h2>
        <p className="mt-2 max-w-2xl text-ink-secondary">
          The prototypical model is a state formula, so this path ends at the
          state allocation - not the district&apos;s whole budget, which also
          includes local levy and federal money.
        </p>
        <FundingJourney district={selectedDistrict} year={year} />
      </section>


      {/* CTA */}
      <section className="py-8">
        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/districts" className="card p-5 hover:border-accent transition-colors group">
            <p className="text-xs text-ink-muted">Next up</p>
            <h3 className="mt-1 font-bold group-hover:text-accent">
              Explore your district&apos;s numbers →
            </h3>
          </Link>
          <Link href="/simulator" className="card p-5 hover:border-accent transition-colors group">
            <p className="text-xs text-ink-muted">Experiment</p>
            <h3 className="mt-1 font-bold group-hover:text-accent">
              Rewrite the formula yourself →
            </h3>
          </Link>
          <Link href="/take-action" className="card p-5 hover:border-accent transition-colors group">
            <p className="text-xs text-ink-muted">Get involved</p>
            <h3 className="mt-1 font-bold group-hover:text-accent">
              Tell your legislators what you think →
            </h3>
          </Link>
        </div>
      </section>
        </>
      ) : (
        <section className="pb-10">
          <div className="card p-5 md:p-6 text-center border-dashed">
            <p className="font-semibold">Choose a school district above</p>
            <p className="mt-1 text-sm text-ink-secondary">
              Its funding sources and personalized prototypical-school model
              will appear here after you select it.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
