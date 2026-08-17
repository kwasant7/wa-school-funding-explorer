import type { Metadata } from 'next';
import Link from 'next/link';
import { TopicPage, TopicSection } from '@/components/topic/TopicPage';
import { pageMetadata } from '@/lib/site-metadata';
import { ALLOCATION_TOTALS, ALLOCATION_YEAR } from '@/lib/topic-stats';
import { fmtMoney, pct } from '@/lib/format';
import {
  CENTRAL_ADMIN_RATE,
  CLASS_SIZE,
  DISTRICT_WIDE_STAFF,
  PLANNING_TIME,
  PROTOTYPES,
  RCW_URL,
  STAFF_ROLES,
} from '@/lib/prototypical-model';

const TITLE = 'The Prototypical School Funding Model, Explained | K12Funding.org';
const H1 = 'Washington’s prototypical school funding model';
const DESCRIPTION =
  'How Washington turns enrollment into a school district’s state allocation: prototypical school sizes, funded class sizes, staffing ratios, and what the formula does and does not require.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  titleIsComplete: true,
  description: DESCRIPTION,
  path: '/prototypical-school-funding-model/',
});

const CLASS_SIZES: [string, number, string][] = [
  ['K-3', CLASS_SIZE.k3, 'The smallest funded general education class, and the one band where running larger classes costs a district money.'],
  ['Grades 4-6', CLASS_SIZE.grades46, 'A single step up from the K-3 band.'],
  ['Grades 7-8', CLASS_SIZE.grades78, 'The middle school general education rate.'],
  ['Grades 9-12', CLASS_SIZE.grades912, 'The largest funded general education class size.'],
  ['Career and technical education', CLASS_SIZE.cte, 'Applies in middle school and high school alike, for courses OSPI has approved.'],
  ['Laboratory science, grades 9-12', CLASS_SIZE.laboratoryScience, 'An enhancement for two lab science classes per high school student, at a course factor of 0.0833.'],
  ['Skill center programs', CLASS_SIZE.skillCenter, 'The smallest funded class in the formula.'],
];

export default function PrototypicalModelPage() {
  const a = ALLOCATION_TOTALS;
  const staffShare = pct(a.salaries + a.benefits, a.basicEducation);

  return (
    <TopicPage
      title={TITLE}
      h1={H1}
      description={DESCRIPTION}
      path="/prototypical-school-funding-model/"
      lede={
        <>
          Washington does not fund districts by reimbursing their actual
          payroll. It runs one statewide recipe - the prototypical school model
          - that converts a district&apos;s enrollment into a number of funded
          staff positions and operating dollars. In {ALLOCATION_YEAR} it
          produced {fmtMoney(a.basicEducation)} of basic education funding,{' '}
          {pct(a.basicEducation, a.total)} of the {fmtMoney(a.total)} the state
          sent districts, and salaries and benefits are {staffShare} of it.
        </>
      }
      related={[
        {
          href: '/washington-school-funding',
          title: 'How Washington funds K-12 schools',
          blurb: 'The whole picture: state, local levy and federal.',
        },
        {
          href: '/msoc-funding',
          title: 'MSOC funding',
          blurb: 'The non-staff half of the formula.',
        },
        {
          href: '/special-education-funding',
          title: 'Special education funding',
          blurb: 'The multiplier that sits on top of this model.',
        },
        {
          href: '/school-levies-and-lea',
          title: 'Levies and local effort assistance',
          blurb: 'Where the money beyond the formula comes from.',
        },
        {
          href: '/',
          title: 'Run this on your own district',
          blurb: 'The same calculation, on your district’s real enrollment.',
        },
        {
          href: '/take-action',
          title: 'Take action',
          blurb: 'Who sets these numbers, and how to reach them.',
        },
      ]}
    >
      <TopicSection id="how-it-works" title="How the model works, step by step">
        <h3 className="text-base font-bold text-ink">1. Count students in FTE</h3>
        <p>
          The state counts students in <strong className="text-ink">FTE</strong>{' '}
          - full-time equivalent - which measures enrollment by how much school
          a student actually attends, not just how many bodies are counted. A
          student enrolled half-time counts as 0.5 FTE, not 1. It is also an
          annual average rather than a single snapshot: districts report
          enrollment on the first school day of every month, and the year&apos;s
          allocation follows that average.
        </p>

        <h3 className="text-base font-bold text-ink">2. Convert enrollment into model schools</h3>
        <p>
          Each grade span&apos;s funding FTE is divided by the size of its
          prototype. A district with 600 elementary FTE has 600 ÷ 400 ={' '}
          <strong className="text-ink">1.5 prototypical elementary schools</strong>,
          and generates 1.5 times the elementary staffing below. This is
          arithmetic on grade levels, not a count of buildings - the seventh and
          eighth graders in a K-8 school generate middle school prototype
          money.
        </p>

        <h3 className="text-base font-bold text-ink">3. Generate a staffing allocation</h3>
        <p>
          Each model school generates classroom teachers at a funded class size,
          plus fractional positions for eleven other roles. Teachers are not
          simply enrollment divided by class size: the statute also funds the
          teachers needed to cover everyone else&apos;s planning period, which
          OSPI adds as {pct(PLANNING_TIME.elementary, 1, 1)} for K-6 and{' '}
          {pct(PLANNING_TIME.secondary, 1, 0)} for grades 7-12. The formula then
          adds a district-wide tier on top of the school tier.
        </p>

        <h3 className="text-base font-bold text-ink">4. Turn positions into dollars</h3>
        <p>
          Each funded position is priced at a statewide salary allocation - one
          rate for certificated instructional staff, one for administrators, one
          for classified staff - set by RCW 28A.150.410 and updated each year in
          the state budget. That figure is multiplied by the district&apos;s{' '}
          <strong className="text-ink">regionalization factor</strong>, an
          uplift set off local housing values that pays more per position where
          hiring costs more (RCW 28A.150.412). Benefits are added on top.
        </p>

        <h3 className="text-base font-bold text-ink">5. Add the money that is not staff</h3>
        <p>
          Materials, supplies and operating costs are paid per student rather
          than per position, and the programs for particular students - special
          education, learning assistance, bilingual instruction, highly capable
          - are layered on separately. None of those pass through the staffing
          step at all.
        </p>

        <div className="rounded-lg border border-line bg-surface p-4 text-ink">
          <p>
            These are{' '}
            <strong>funding allocations, not a required staffing plan</strong>.
            Districts can organize schools differently, but must cover anything
            beyond the formula with other available revenue.
          </p>
          <p className="mt-3">
            Two exceptions matter, because they are the places the formula does
            check. K-3 class size money is paid only in proportion to the class
            sizes a district can demonstrate it actually runs. And the money for
            nurses, counselors, social workers, psychologists, safety staff and
            family engagement staff is paid only in proportion to the staff a
            district actually employs in those roles.
          </p>
        </div>
      </TopicSection>

      <TopicSection id="prototypes" title="The three prototypical schools">
        <p>
          The model defines three school sizes. They are accounting constructs -
          no district is required to build a school of exactly this size.
        </p>
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left text-sm text-ink-muted pb-2">
              Prototypical school sizes and funded class sizes,{' '}
              <a href={RCW_URL} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
                RCW 28A.150.260
              </a>{' '}
              (3)(b) and (4)
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">Prototype</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Grades</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">Model size</th>
                <th scope="col" className="py-2 font-semibold">Funded class size</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PROTOTYPES) as (keyof typeof PROTOTYPES)[]).map((key) => {
                const p = PROTOTYPES[key];
                return (
                  <tr key={key} className="border-b border-line/60">
                    <th scope="row" className="py-2 pr-4 text-left font-medium">
                      {p.label}
                    </th>
                    <td className="py-2 pr-4">{p.grades}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.proto} students</td>
                    <td className="py-2">
                      {p.classSizes.map((c, i) => (
                        <span key={c.label}>
                          {i > 0 && ', '}
                          <span className="tabular-nums">{c.size}</span> in {c.label}
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </TopicSection>

      <TopicSection id="class-sizes" title="Funded class sizes">
        <p>
          These are the class sizes the state <em>pays for</em>. With the
          exception of K-3, they are not a legal cap on real classes - a
          district can run larger or smaller classes, and many do. They are also
          not the same as students per funded teacher, which is lower, because
          the formula pays for planning-period coverage on top.
        </p>
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left text-sm text-ink-muted pb-2">
              Funded class sizes by grade band and subject, RCW 28A.150.260(4)
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">Grade band or subject</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">Funded class size</th>
                <th scope="col" className="py-2 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {CLASS_SIZES.map(([band, ratio, note]) => (
                <tr key={band} className="border-b border-line/60">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">
                    {band}
                  </th>
                  <td className="py-2 pr-4 text-right tabular-nums">{ratio}</td>
                  <td className="py-2">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TopicSection>

      <TopicSection id="staffing" title="The staff each model school generates">
        <p>
          Beyond classroom teachers, the statute funds eleven roles, stated as
          positions per prototypical school. A district generates its share of
          each in proportion to how many prototypes its enrollment adds up to.
        </p>
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left text-sm text-ink-muted pb-2">
              Staff per prototypical school, RCW 28A.150.260(5)(a)
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">Role</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">Elementary</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">Middle</th>
                <th scope="col" className="py-2 font-semibold text-right">High</th>
              </tr>
            </thead>
            <tbody>
              {STAFF_ROLES.map((row) => (
                <tr key={row.label} className="border-b border-line/60">
                  {/*
                    The short label is a compression - "Principals" is really
                    "Principals, assistant principals, and other certificated
                    building-level administrators", which is a materially
                    bigger line than the name suggests. The full statutory
                    wording rides along as a tooltip so the compression is
                    visible rather than silent.
                  */}
                  <th scope="row" className="py-2 pr-4 text-left font-medium" title={row.statutory}>
                    {row.label}
                    {'conditional' in row && row.conditional ? '*' : ''}
                  </th>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.elementary}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.middle}</td>
                  <td className="py-2 text-right tabular-nums">{row.high}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-ink-muted">
          * Funded only in proportion to the staff a district can demonstrate it
          actually employs, under RCW 28A.150.260(5)(b).
        </p>
      </TopicSection>

      <TopicSection id="district-tier" title="The second tier: district-wide staff">
        <p>
          The prototype tables generate staff for schools. The formula then
          generates a second layer that never passes through a model school at
          all, allocated per 1,000 K-12 students - and on top of that, central
          administration as a flat percentage of everything else. A district
          office is funded as a proportion of its schools.
        </p>
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left text-sm text-ink-muted pb-2">
              District-wide staffing, RCW 28A.150.260(6)
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">District-wide staff</th>
                <th scope="col" className="py-2 font-semibold text-right">Per 1,000 K-12 students</th>
              </tr>
            </thead>
            <tbody>
              {DISTRICT_WIDE_STAFF.map((row) => (
                <tr key={row.label} className="border-b border-line/60">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">{row.label}</th>
                  <td className="py-2 text-right tabular-nums">{row.per1000}</td>
                </tr>
              ))}
              <tr className="border-b border-line/60">
                <th scope="row" className="py-2 pr-4 text-left font-medium">
                  Central administration
                </th>
                <td className="py-2 text-right tabular-nums">
                  {pct(CENTRAL_ADMIN_RATE, 1, 2)} of all other staff units
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </TopicSection>

      <TopicSection id="student-need" title="Money for particular students">
        <p>
          The same statute funds four programs driven by who a district&apos;s
          students are rather than how many there are. Three of them are built
          from the same machinery as everything above: hours per week of extra
          instruction, in classes of fifteen.
        </p>
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left text-sm text-ink-muted pb-2">
              Categorical programs, RCW 28A.150.260(10) and (11)
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">Program</th>
                <th scope="col" className="py-2 pr-4 font-semibold">What drives it</th>
                <th scope="col" className="py-2 font-semibold">What it funds</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/60">
                <th scope="row" className="py-2 pr-4 text-left font-medium">Learning assistance</th>
                <td className="py-2 pr-4">Share of students eligible for free or reduced-price meals</td>
                <td className="py-2">2.3975 hours a week of extra instruction, plus another 1.1 hours in schools above 50% eligibility</td>
              </tr>
              <tr className="border-b border-line/60">
                <th scope="row" className="py-2 pr-4 text-left font-medium">Transitional bilingual</th>
                <td className="py-2 pr-4">Head count of enrolled eligible students - not FTE</td>
                <td className="py-2">4.778 hours a week in K-6 and 6.778 in grades 7-12; students who exit keep 3.0 hours for two years</td>
              </tr>
              <tr className="border-b border-line/60">
                <th scope="row" className="py-2 pr-4 text-left font-medium">Highly capable</th>
                <td className="py-2 pr-4">A flat 5% of each district&apos;s enrollment, however many students it identifies</td>
                <td className="py-2">2.159 hours a week</td>
              </tr>
              <tr className="border-b border-line/60">
                <th scope="row" className="py-2 pr-4 text-left font-medium">Special education</th>
                <td className="py-2 pr-4">Students with disabilities</td>
                <td className="py-2">
                  A multiplier applied to everything above -{' '}
                  <Link href="/special-education-funding" className="text-accent hover:underline">
                    see the special education page
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </TopicSection>

      <TopicSection id="what-it-generates" title={`What the model generated statewide in ${ALLOCATION_YEAR}`}>
        <p>
          Rolled up across every district, the basic education allocation the
          model drives came to {fmtMoney(a.basicEducation)} -{' '}
          {pct(a.basicEducation, a.total)} of the {fmtMoney(a.total)} the state
          sent districts in {ALLOCATION_YEAR}. The rest is special education,
          transportation, the categorical programs and levy equalization. These
          four components are the whole of it.
        </p>
        <div className="not-prose grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-4">
            <div className="stat-label">Salaries</div>
            <div className="text-2xl font-semibold">{fmtMoney(a.salaries)}</div>
            <p className="mt-1 text-xs text-ink-muted">{pct(a.salaries, a.basicEducation)} of basic education</p>
          </div>
          <div className="card p-4">
            <div className="stat-label">Benefits</div>
            <div className="text-2xl font-semibold">{fmtMoney(a.benefits)}</div>
            <p className="mt-1 text-xs text-ink-muted">{pct(a.benefits, a.basicEducation)} of basic education</p>
          </div>
          <div className="card p-4">
            <div className="stat-label">Materials, supplies &amp; operating costs</div>
            <div className="text-2xl font-semibold">{fmtMoney(a.msoc)}</div>
            <p className="mt-1 text-xs text-ink-muted">{pct(a.msoc, a.basicEducation)} of basic education</p>
          </div>
          <div className="card p-4">
            <div className="stat-label">Other basic education</div>
            <div className="text-2xl font-semibold">{fmtMoney(a.otherBasicEducation)}</div>
            <p className="mt-1 text-xs text-ink-muted">{pct(a.otherBasicEducation, a.basicEducation)} of basic education</p>
          </div>
        </div>
        <p>
          The MSOC figure above is the general education line only. See{' '}
          <Link href="/msoc-funding" className="text-accent hover:underline">
            MSOC funding
          </Link>{' '}
          for how the per-student rate is set and for the broader definition
          that also counts career and technical education and alternative
          learning, and see your own district&apos;s numbers in the{' '}
          <Link href="/districts" className="text-accent hover:underline">
            District Explorer
          </Link>
          . The state is separately required to publish every district&apos;s
          per-student allocation, and each district must link to that report
          from its own homepage.
        </p>
      </TopicSection>

      <TopicSection id="caveats" title="What the model leaves out">
        <p>
          The prototypical model generates a state allocation. It is not the
          whole budget:{' '}
          <Link href="/school-levies-and-lea" className="text-accent hover:underline">
            local enrichment levies
          </Link>{' '}
          and federal programs fund positions and services on top of it, and the
          model does not attempt to describe those.{' '}
          <Link href="/school-transportation-funding" className="text-accent hover:underline">
            Pupil transportation
          </Link>{' '}
          runs on its own formula in a different statute.
        </p>
        <p>
          Not every number in the model is in the statute. RCW 28A.150.260 sets
          the prototype sizes, class sizes and staffing units; the salary
          allocations, the regionalization factors, the planning-time
          percentages, small-school minimums and the career and technical
          education amounts are set in the biennial appropriations act and can
          move without amending the statute.
        </p>
        <p>
          The statutory parameters have moved several times. EHB 2242 (2017)
          restructured the salary allocations after <em>McCleary</em>, the 2012
          state supreme court ruling that Washington was not amply funding basic
          education. 2SHB 1664 (2022) raised the counselor, nurse, social worker
          and psychologist allocations, finishing its phase-in for 2024-25, and
          2SSB 5882 (2024) raised paraeducator and office-support staffing.
          Figures here reflect the statute as currently in effect - 2025 c 334,
          effective September 2025.
        </p>
        <p className="text-sm text-ink-muted">
          Statutory parameters:{' '}
          <a href={RCW_URL} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
            RCW 28A.150.260
          </a>
          . Planning-time factors from OSPI&apos;s Organization and Financing of
          Washington&apos;s Public Schools. Every source is listed on{' '}
          <Link href="/sources" className="text-accent hover:underline">
            Sources &amp; Methodology
          </Link>
          .
        </p>
      </TopicSection>
    </TopicPage>
  );
}
