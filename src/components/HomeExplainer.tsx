'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { District, LATEST, yearData } from '@/lib/data';
import StatTile from '@/components/StatTile';
import SourceShareBar from '@/components/charts/SourceShareBar';
import CountUp from '@/components/interactive/CountUp';
import DistrictQuickFind from '@/components/interactive/DistrictQuickFind';
import SchoolBuilder from '@/components/interactive/SchoolBuilder';
import ClassSizeViz from '@/components/interactive/ClassSizeViz';
import FundingJourney from '@/components/interactive/FundingJourney';
import { useAssistantDistrict, useAssistantYear } from '@/lib/assistant/store';
import { yearData as yearDataFor } from '@/lib/data';
import { readSelectedDistrict, writeSelectedDistrict } from '@/lib/selected-district';

export default function HomeExplainer() {
  const [year, setYear] = useState(LATEST);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  /*
    Whatever the visitor picked on this page or any other - the Simulator and
    Take Action already restore it the same way. `restored` flips exactly once
    after that check, and keys DistrictQuickFind so it remounts with the right
    initial district instead of the empty state it opened with.
  */
  /*
    A first-time visitor has nothing saved, and the page used to open with no
    district at all: every per-district panel below sat empty until they
    thought to pick one, which reads as a page that hasn't finished loading
    rather than one waiting for input. It falls back to the first district
    alphabetically so there is always something real on screen to react to.
    A saved choice always wins - this only fills the empty case.
  */
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const districts = yearData(LATEST).districts;
    const saved = readSelectedDistrict();
    const record =
      (saved && districts.find((d) => d.code === saved)) ||
      [...districts].sort((a, b) => a.name.localeCompare(b.name))[0] ||
      null;
    if (record) setSelectedDistrict(record);
    setRestored(true);
  }, []);
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
      if (record) {
        setSelectedDistrict(record);
        writeSelectedDistrict(record.code);
      }
    },
    [year]
  );
  const clearDistrict = useCallback(() => {
    setSelectedDistrict(null);
    writeSelectedDistrict(null);
  }, []);
  useAssistantYear(year, setYear);
  useAssistantDistrict(selectedDistrict?.code ?? null, {
    select: selectDistrict,
    clear: clearDistrict,
  });

  return (
    <div className="max-w-site mx-auto px-4 md:px-6">
      {/* Hero */}
      <section data-assistant-section="hero" className="pt-10 md:pt-14 pb-8">
        {/* The school-year control lives in the site header, beside the
            language control - see SchoolYearSwitcher. */}
        <p className="text-sm font-semibold text-accent uppercase tracking-wide">
          How it works · play with everything on this page
        </p>
        <h1 className="mt-2 text-3xl md:text-5xl font-bold tracking-tight max-w-3xl">
          How K-12 schools are funded
        </h1>
        <p className="mt-4 text-lg text-ink-secondary">
          The state funds a make-believe &ldquo;prototypical school&rdquo; and
          uses a formula to give money to each school
        </p>
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/*
            Not "the state general fund": this is every district's general-fund
            revenue added up, and roughly a quarter of it is local levy and
            federal money. Labelling it as the state's own total invited anyone
            quoting the figure to overstate the state's share by about $4.9B.
          */}
          <StatTile
            label={`All school funding, ${year}`}
            value={<CountUp value={s.revenues.total} kind="money" />}
            note="every district's general fund combined — state, local levy and federal"
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
        <DistrictQuickFind
          key={restored ? 'ready' : 'loading'}
          onPick={setSelectedDistrict}
          year={year}
          initialCode={selectedDistrict?.code}
        />
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
        <h2 className="text-2xl md:text-3xl font-bold">
          How the formula funds <span data-no-translate>{selectedDistrict.name}</span>
        </h2>
        <p className="mt-2 text-ink-secondary">
          Washington does not start with each school&apos;s actual payroll. Instead,
          it uses one statewide recipe - the prototypical school model - to
          estimate the staff and operating dollars a district should receive.{' '}
          <Link
            href="/prototypical-school-funding-model"
            className="text-accent hover:underline"
          >
            Read the full explainer
          </Link>{' '}
          for the statutory class sizes, all eleven staff roles, and where the
          formula stops being optional.
        </p>
        <div className="mt-5 grid gap-5">
          <div className="card p-5 md:p-6 bg-accent-wash border-accent-soft">
            <h3 className="text-lg font-bold">How the model actually works</h3>
            <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-ink-secondary">
              <div>
                <p className="font-semibold text-ink">1. Start with enrollment</p>
                <p className="mt-1">
                  The state counts students in{' '}
                  <strong className="text-ink">FTE (full-time equivalent)</strong>{' '}
                  - a measure of enrollment by how much school a student
                  actually attends, not just how many bodies are counted. A
                  student enrolled half-time counts as 0.5 FTE, not 1, and the
                  count is an average across the year.
                </p>
              </div>
              <div>
                <p className="font-semibold text-ink">2. Divide into model schools</p>
                <p className="mt-1">
                  Each grade span&apos;s funding FTE is divided by its prototype
                  size. 600 elementary FTE ÷ 400 = 1.5 model elementary schools,
                  which generates 1.5 times the elementary staffing.
                </p>
              </div>
              <div>
                <p className="font-semibold text-ink">3. Generate a staffing allocation</p>
                <p className="mt-1">
                  Each model school generates teachers at a funded class size -
                  plus the teachers who cover everyone else&apos;s planning
                  period - and fractional positions for eleven other roles, from
                  principals to nurses.
                </p>
              </div>
              <div>
                <p className="font-semibold text-ink">4. Turn positions into dollars</p>
                <p className="mt-1">
                  Each position is priced at a statewide salary allocation, then
                  multiplied by a{' '}
                  <strong className="text-ink">regionalization factor</strong>{' '}
                  that pays more where hiring costs more. Benefits, operating
                  costs, and money for students with additional needs are added
                  on top.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-secondary">
              These are funding allocations, not a required staffing plan.
              Districts can organize schools differently, but must cover
              anything beyond the formula with other available revenue. Two
              exceptions: K-3 class-size money and the money for nurses,
              counselors, social workers, psychologists, safety and family
              engagement staff are each paid only in proportion to what a
              district can show it actually runs or employs.
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
        <p className="mt-2 text-ink-secondary">
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
          {/*
            The pre-selection empty state. It is the only thing standing where
            the district content will be, so before data-nosnippet it was the
            most likely snippet for the home page - a search result reading
            "Choose a school district above" instead of anything about funding.
          */}
          <div className="card p-5 md:p-6 text-center border-dashed" data-nosnippet>
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
