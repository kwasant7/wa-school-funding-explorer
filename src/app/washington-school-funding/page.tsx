import type { Metadata } from 'next';
import Link from 'next/link';
import { TopicPage, TopicSection } from '@/components/topic/TopicPage';
import { pageMetadata } from '@/lib/site-metadata';
import { ALLOCATION_TOTALS, STATEWIDE } from '@/lib/topic-stats';
import { largestDistricts } from '@/lib/district-profile';
import { districtPath, DISTRICT_REFS } from '@/lib/district-slug';
import { fmtInt, fmtMoney, fmtMoneyFull, pct } from '@/lib/format';
import { LATEST } from '@/lib/years';

const TITLE = 'How Washington Funds K-12 Schools | K12Funding.org';
const H1 = 'How Washington funds K-12 schools';
const DESCRIPTION =
  'Where Washington’s $21 billion in K-12 general-fund revenue comes from and where it goes: the state formula, local levies, federal money, and the gaps districts cover themselves.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  titleIsComplete: true,
  description: DESCRIPTION,
  path: '/washington-school-funding/',
});

const REVENUE_CODES: [string, string][] = [
  ['1000', 'Local taxes - voter-approved enrichment levies'],
  ['2000', 'Local support non-tax - fees, rentals, interest'],
  ['3000', 'State, general purpose - the apportionment formula and Local Effort Assistance'],
  ['4000', 'State, special purpose - special education, transportation, learning assistance'],
  ['5000', 'Federal, general purpose - forest fees, impact aid'],
  ['6000', 'Federal, special purpose - Title I, IDEA, child nutrition'],
  ['7000', 'Revenue from other school districts'],
  ['8000', 'Revenue from other entities - cities, counties, tribes'],
  ['9000', 'Other financing sources'],
];

export default function WashingtonSchoolFundingPage() {
  const rev = STATEWIDE.revenues;
  const a = ALLOCATION_TOTALS;
  const largest = largestDistricts(8);

  return (
    <TopicPage
      title={TITLE}
      h1={H1}
      description={DESCRIPTION}
      path="/washington-school-funding/"
      lede={
        <>
          Washington&apos;s {DISTRICT_REFS.length} school districts and charter
          schools reported{' '}
          <strong className="text-ink">{fmtMoney(rev.total)}</strong> in
          general-fund revenue in {LATEST}, for{' '}
          <strong className="text-ink">
            {fmtInt(Math.round(STATEWIDE.fundingEnrollment))}
          </strong>{' '}
          funded students. Most of that is state money distributed by a single
          statutory formula; the rest is local levy and federal funding raised
          and targeted separately.
        </>
      }
      related={[
        {
          href: '/prototypical-school-funding-model',
          title: 'The prototypical school model',
          blurb: 'The formula that turns enrollment into a state allocation.',
        },
        {
          href: '/school-levies-and-lea',
          title: 'Levies and Local Effort Assistance',
          blurb: 'The per-student cap and the state match for property-poor districts.',
        },
        {
          href: '/special-education-funding',
          title: 'Special education funding',
          blurb: 'The multiplier, and the gap districts report.',
        },
        {
          href: '/districts',
          title: 'District Explorer',
          blurb: `Funding data for all ${DISTRICT_REFS.length} districts and charters.`,
        },
        {
          href: '/simulator',
          title: 'Policy Simulator',
          blurb: 'Change a lever and see the statewide cost.',
        },
        {
          href: '/sources',
          title: 'Sources & methodology',
          blurb: 'Every dataset and statute behind these numbers.',
        },
      ]}
    >
      <TopicSection id="three-streams" title="Three streams of money">
        <p>
          Every district&apos;s general fund is built from three main sources.
          The shares below are statewide; an individual district can look very
          different depending on its property wealth and its students.
        </p>
        <div className="not-prose grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-4">
            <div className="stat-label">State</div>
            <div className="text-2xl font-semibold">{fmtMoney(rev.state)}</div>
            <p className="mt-1 text-xs text-ink-muted">
              {pct(rev.state, rev.total)} of all revenue
            </p>
          </div>
          <div className="card p-4">
            <div className="stat-label">Local levy</div>
            <div className="text-2xl font-semibold">{fmtMoney(rev.local)}</div>
            <p className="mt-1 text-xs text-ink-muted">
              {pct(rev.local, rev.total)} of all revenue
            </p>
          </div>
          <div className="card p-4">
            <div className="stat-label">Federal</div>
            <div className="text-2xl font-semibold">{fmtMoney(rev.federal)}</div>
            <p className="mt-1 text-xs text-ink-muted">
              {pct(rev.federal, rev.total)} of all revenue
            </p>
          </div>
          <div className="card p-4">
            <div className="stat-label">Other</div>
            <div className="text-2xl font-semibold">{fmtMoney(rev.other)}</div>
            <p className="mt-1 text-xs text-ink-muted">
              {pct(rev.other, rev.total)} of all revenue
            </p>
          </div>
        </div>
        <p>
          The state share pays for what the constitution calls basic education.
          Article IX, section 1 of the Washington Constitution makes amply
          funding education the state&apos;s &ldquo;paramount duty&rdquo; - the
          provision at the centre of the <em>McCleary</em> litigation that drove
          the 2017 and 2018 funding changes.
        </p>
      </TopicSection>

      <TopicSection id="where-state-money-goes" title="What the state allocation pays for">
        <p>
          The state&apos;s {fmtMoney(a.total)} allocation is not a single grant.
          It is a stack of formula components, each with its own driver -
          enrollment, staff counts, student need, or route miles.
        </p>
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Washington state K-12 allocation by component, {LATEST}
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">Component</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">Statewide</th>
                <th scope="col" className="py-2 font-semibold text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Salaries', a.salaries],
                  ['Benefits', a.benefits],
                  ['Materials, supplies & operating costs (MSOC)', a.msoc],
                  ['Other basic education', a.otherBasicEducation],
                  ['Special education', a.specialEd],
                  ['Student transportation', a.transportation],
                  ['Learning assistance (LAP)', a.learningAssistance],
                  ['Multilingual / bilingual education', a.bilingual],
                  ['Local Effort Assistance', a.levyEqualization],
                  ['Highly capable', a.highlyCapable],
                  ['Food service', a.food],
                  ['Other state programs', a.otherState],
                ] as [string, number][]
              ).map(([label, value]) => (
                <tr key={label} className="border-b border-line/60">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">
                    {label}
                  </th>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {fmtMoneyFull(value)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {pct(value, a.total)}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <th scope="row" className="py-2 pr-4 text-left">Total state allocation</th>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {fmtMoneyFull(a.total)}
                </td>
                <td className="py-2 text-right tabular-nums">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Salaries and benefits together are the great majority of it, which is
          why the model that generates staff counts -{' '}
          <Link href="/prototypical-school-funding-model" className="text-accent hover:underline">
            the prototypical school model
          </Link>{' '}
          - determines so much of a district&apos;s budget.
        </p>
      </TopicSection>

      <TopicSection id="gaps" title="Where districts cover the difference">
        <p>
          For three programs the state publishes both an allocation and what
          districts actually spent, which makes a direct comparison possible.
          In all three, statewide spending runs above the statewide allocation,
          and the difference is covered from local levy, federal or other money.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <Link href="/special-education-funding" className="text-accent hover:underline">
              Special education
            </Link>{' '}
            - funded as a multiplier on top of basic education.
          </li>
          <li>
            <Link href="/msoc-funding" className="text-accent hover:underline">
              Materials, supplies and operating costs
            </Link>{' '}
            - a flat per-student amount covering everything that is not staff pay.
          </li>
          <li>
            <Link href="/school-transportation-funding" className="text-accent hover:underline">
              Student transportation
            </Link>{' '}
            - funded by its own formula, separate from basic education.
          </li>
        </ul>
        <p>
          Each district&apos;s own figures are on its page. The largest districts
          by enrollment:
        </p>
        <ul className="not-prose flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {largest.map((d) => (
            <li key={d.code}>
              <Link href={districtPath(d.code)} className="text-accent hover:underline">
                {d.name}
              </Link>
            </li>
          ))}
        </ul>
      </TopicSection>

      <TopicSection id="revenue-codes" title="How the revenue is classified">
        <p>
          District financial reports (the F-196) group revenue into nine code
          ranges. These are the categories behind every revenue figure on this
          site.
        </p>
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">F-196 revenue code ranges</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">Code</th>
                <th scope="col" className="py-2 font-semibold">What it covers</th>
              </tr>
            </thead>
            <tbody>
              {REVENUE_CODES.map(([code, label]) => (
                <tr key={code} className="border-b border-line/60">
                  <th scope="row" className="py-2 pr-4 text-left font-medium tabular-nums">
                    {code}
                  </th>
                  <td className="py-2">{label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-ink-muted">
          Full details, including every source file and the exact processing
          rules, are on{' '}
          <Link href="/sources" className="text-accent hover:underline">
            Sources &amp; Methodology
          </Link>
          .
        </p>
      </TopicSection>
    </TopicPage>
  );
}
