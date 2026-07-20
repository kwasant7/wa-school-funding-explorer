'use client';

import { useState } from 'react';
import Link from 'next/link';
import data from '@/data/districts.json';
import StatTile from '@/components/StatTile';
import SourceShareBar from '@/components/charts/SourceShareBar';
import CountUp from '@/components/interactive/CountUp';
import DistrictQuickFind from '@/components/interactive/DistrictQuickFind';
import SchoolBuilder from '@/components/interactive/SchoolBuilder';
import ClassSizeViz from '@/components/interactive/ClassSizeViz';
import FundingJourney from '@/components/interactive/FundingJourney';

export default function HomePage() {
  const s = data.statewide;
  const [selectedDistrict, setSelectedDistrict] = useState<
    (typeof data.districts)[number] | null
  >(null);
  return (
    <div className="max-w-site mx-auto px-4 md:px-6">
      {/* Hero */}
      <section className="pt-10 md:pt-14 pb-8">
        <p className="text-sm font-semibold text-accent uppercase tracking-wide">
          How it works · play with everything on this page
        </p>
        <h1 className="mt-2 text-3xl md:text-5xl font-bold tracking-tight max-w-3xl">
          How K-12 schools are funded
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
          The state doesn&apos;t fund the schools that exist - it funds a
          make-believe &ldquo;prototypical school&rdquo; and uses it as a recipe
          for real money. A lot of it:
        </p>
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="This year's funding"
            value={<CountUp value={s.revenues.total} kind="money" />}
            note="entire Washington state general-fund total, 2024-25"
          />
          <StatTile
            label="Students"
            value={<CountUp value={s.enrollment} kind="int" />}
            note="October headcount"
          />
          <StatTile
            label="Districts & charters"
            value={<CountUp value={s.districts} kind="plain" />}
          />
          <StatTile
            label="Average per student"
            value={<CountUp value={s.avgPerPupil} kind="moneyFull" />}
            note="Uses funding FTE - not the student headcount shown here"
          />
        </div>
      </section>

      {/* Personalize */}
      <section className="pb-8">
        <DistrictQuickFind onPick={setSelectedDistrict} />
      </section>

      {selectedDistrict ? (
        <>
      {/* Money sources */}
      <section className="pb-8">
        <div className="card p-5 md:p-6">
          <h2 className="text-lg md:text-xl font-bold">
            How {selectedDistrict.name}&apos;s funding is split
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Actual 2024-25 general-fund revenue by source. Hover the bar for
            exact amounts and shares.
          </p>
          <div className="mt-4">
            <SourceShareBar slices={selectedDistrict.rev} />
          </div>
        </div>
      </section>

      {/* Model explainer -> builder */}
      <section className="py-6">
        <h2 className="text-2xl md:text-3xl font-bold max-w-2xl">
          How the formula funds {selectedDistrict.name}
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
          <SchoolBuilder district={selectedDistrict} />
          <ClassSizeViz />
        </div>
      </section>

      {/* Steps */}
      <section className="py-8">
        <h2 className="text-2xl md:text-3xl font-bold">
          How money reaches {selectedDistrict.name}, in 7 steps
        </h2>
        <p className="mt-2 max-w-2xl text-ink-secondary">
          Follow the path from student enrollment to a real district budget -
          each step shows what happens and why it matters.
        </p>
        <FundingJourney district={selectedDistrict} />
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
