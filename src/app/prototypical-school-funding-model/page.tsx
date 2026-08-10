import type { Metadata } from 'next';
import Link from 'next/link';
import { TopicPage, TopicSection } from '@/components/topic/TopicPage';
import { pageMetadata } from '@/lib/site-metadata';
import { ALLOCATION_TOTALS } from '@/lib/topic-stats';
import { fmtMoney, pct } from '@/lib/format';

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

/*
  Statutory parameters from RCW 28A.150.260(5)(a) as currently in effect -
  including the counselor, nurse and office-support increases from 2SHB 1664
  (2022), which finished phasing in for 2024-25. These mirror the table the
  interactive School Builder on the home page is built from; both read from the
  same statute, and neither invents a figure.
*/
const PROTOTYPES = [
  { level: 'Elementary', size: 400, ratioLabel: 'K-3 ≈ 17, grades 4-6 ≈ 27' },
  { level: 'Middle', size: 432, ratioLabel: 'Grades 7-8 ≈ 28.53' },
  { level: 'High', size: 600, ratioLabel: 'Grades 9-12 ≈ 28.74, CTE ≈ 23' },
];

const CLASS_SIZES = [
  ['K-3', '17', 'The smallest funded class sizes, phased in after McCleary.'],
  ['Grades 4-6', '27', 'A single step up from the K-3 band.'],
  ['Grades 7-8', '28.53', 'Middle school staffing is generated at this ratio.'],
  ['Grades 9-12', '28.74', 'The largest funded general-education class size.'],
  ['Career & technical education', '23', 'Lower because labs and shops need space.'],
];

export default function PrototypicalModelPage() {
  const a = ALLOCATION_TOTALS;
  const staffShare = pct(a.salaries + a.benefits, a.total);

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
          staff positions and operating dollars. Salaries and benefits generated
          this way are {staffShare} of the entire state allocation.
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
          href: '/',
          title: 'Build a school',
          blurb: 'Interactively generate the staffing for your own district.',
        },
        {
          href: '/simulator',
          title: 'Policy Simulator',
          blurb: 'Change the formula and see the statewide cost.',
        },
        {
          href: '/sources',
          title: 'Sources & methodology',
          blurb: 'RCW 28A.150.260 and the rest of the statutory basis.',
        },
      ]}
    >
      <TopicSection id="how-it-works" title="How the model works, in three steps">
        <h3 className="text-base font-bold text-ink">1. Count students in FTE</h3>
        <p>
          The state counts students in <strong className="text-ink">FTE</strong>{' '}
          - full-time equivalent - which measures enrollment by how much school
          a student actually attends, not just how many bodies are counted. A
          student enrolled half-time counts as 0.5 FTE, not 1. The state uses
          this funding FTE by grade span, then converts it into shares of model
          elementary, middle and high schools.
        </p>

        <h3 className="text-base font-bold text-ink">2. Generate a staffing allocation</h3>
        <p>
          Each model school is assigned teacher ratios and fractional positions
          for principals, counselors, librarians, office staff, custodians and
          nurses. A district with 1.5 elementary schools&apos; worth of students
          generates 1.5 times the elementary staffing.
        </p>

        <h3 className="text-base font-bold text-ink">3. Turn positions into dollars</h3>
        <p>
          The state applies salary and benefit assumptions, regionalization,
          materials and operating costs, then adds funding for students with
          additional needs.
        </p>

        <p className="rounded-lg border border-line bg-surface p-4 text-ink">
          These are <strong>funding allocations, not a required staffing plan</strong>.
          Districts can organize schools differently, but must cover anything
          beyond the formula with other available revenue.
        </p>
      </TopicSection>

      <TopicSection id="prototypes" title="The three prototypical schools">
        <p>
          The model defines three school sizes. They are accounting constructs -
          no district is required to build a school of exactly this size.
        </p>
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Prototypical school sizes under RCW 28A.150.260
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">Prototype</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">Model size</th>
                <th scope="col" className="py-2 font-semibold">Funded class size</th>
              </tr>
            </thead>
            <tbody>
              {PROTOTYPES.map((p) => (
                <tr key={p.level} className="border-b border-line/60">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">
                    {p.level}
                  </th>
                  <td className="py-2 pr-4 text-right tabular-nums">{p.size} students</td>
                  <td className="py-2">{p.ratioLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TopicSection>

      <TopicSection id="class-sizes" title="Funded class sizes">
        <p>
          These are the class sizes the state <em>pays for</em>. They are not a
          legal cap on real classes - a district can run larger or smaller
          classes, and many do.
        </p>
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Funded class sizes by grade band</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">Grade band</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">Students per teacher</th>
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

      <TopicSection id="what-it-generates" title="What the model generates statewide">
        <p>
          Rolled up across every district, the formula components the model
          drives look like this.
        </p>
        <div className="not-prose grid sm:grid-cols-3 gap-3">
          <div className="card p-4">
            <div className="stat-label">Salaries</div>
            <div className="text-2xl font-semibold">{fmtMoney(a.salaries)}</div>
            <p className="mt-1 text-xs text-ink-muted">{pct(a.salaries, a.total)} of the allocation</p>
          </div>
          <div className="card p-4">
            <div className="stat-label">Benefits</div>
            <div className="text-2xl font-semibold">{fmtMoney(a.benefits)}</div>
            <p className="mt-1 text-xs text-ink-muted">{pct(a.benefits, a.total)} of the allocation</p>
          </div>
          <div className="card p-4">
            <div className="stat-label">MSOC</div>
            <div className="text-2xl font-semibold">{fmtMoney(a.msoc)}</div>
            <p className="mt-1 text-xs text-ink-muted">{pct(a.msoc, a.total)} of the allocation</p>
          </div>
        </div>
        <p>
          See{' '}
          <Link href="/msoc-funding" className="text-accent hover:underline">
            MSOC funding
          </Link>{' '}
          for how the non-staff portion is set, and your own district&apos;s
          numbers in the{' '}
          <Link href="/districts" className="text-accent hover:underline">
            District Explorer
          </Link>
          .
        </p>
      </TopicSection>

      <TopicSection id="caveats" title="What the model leaves out">
        <p>
          The prototypical model generates a state allocation. It is not the
          whole budget: local enrichment levies and federal programs fund
          positions and services on top of it, and the model does not attempt to
          describe those.
        </p>
        <p>
          The statutory parameters have moved several times - EHB 2242 (2017)
          restructured the salary allocations after <em>McCleary</em>, and 2SHB
          1664 (2022) increased the counselor, nurse and office-support
          allocations, finishing its phase-in for 2024-25. Figures here reflect
          the statute as currently in effect.
        </p>
        <p className="text-sm text-ink-muted">
          Statutory parameters: RCW 28A.150.260. Every source is listed on{' '}
          <Link href="/sources" className="text-accent hover:underline">
            Sources &amp; Methodology
          </Link>
          .
        </p>
      </TopicSection>
    </TopicPage>
  );
}
