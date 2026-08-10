import type { Metadata } from 'next';
import Link from 'next/link';
import {
  GapSummary,
  GapTable,
  TopicPage,
  TopicSection,
} from '@/components/topic/TopicPage';
import { pageMetadata } from '@/lib/site-metadata';
import { programGap, rankedByGap, SPENDING_TOTALS, STATEWIDE } from '@/lib/topic-stats';
import { fmtInt, fmtMoney, fmtMoneyFull } from '@/lib/format';
import { LATEST } from '@/lib/years';
import districtsJson from '@/data/districts.json';

const TITLE = 'Special Education Funding in Washington | K12Funding.org';
const H1 = 'Special education funding in Washington';
const DESCRIPTION =
  'How Washington funds special education as a multiplier on basic education, what districts actually spend, and the gap they cover from local and federal money.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  titleIsComplete: true,
  description: DESCRIPTION,
  path: '/special-education-funding/',
});

export default function SpecialEducationFundingPage() {
  const gap = programGap('sped');
  const topSmall = rankedByGap('sped', { limit: 8 });
  const topLarge = rankedByGap('sped', { limit: 8, minFte: 10000 });
  const spedStudents = districtsJson.districts.reduce(
    (n, d) => n + d.demo.sped,
    0
  );

  return (
    <TopicPage
      title={TITLE}
      h1={H1}
      description={DESCRIPTION}
      path="/special-education-funding/"
      lede={
        <>
          Washington funds special education as a multiplier on top of basic
          education, under RCW 28A.150.390. In {LATEST} the state allocated{' '}
          <strong className="text-ink">{fmtMoney(gap.allocated)}</strong> while
          districts reported spending{' '}
          <strong className="text-ink">{fmtMoney(gap.spent)}</strong> from their
          general funds on the same programs.
        </>
      }
      related={[
        {
          href: '/washington-school-funding',
          title: 'How Washington funds K-12 schools',
          blurb: 'Where special education sits in the whole allocation.',
        },
        {
          href: '/prototypical-school-funding-model',
          title: 'The prototypical school model',
          blurb: 'The basic education allocation the multiplier applies to.',
        },
        {
          href: '/simulator',
          title: 'Policy Simulator',
          blurb: 'Move the special education multiplier and see the cost.',
        },
        {
          href: '/districts',
          title: 'District Explorer',
          blurb: 'Your district’s own allocation-versus-spending figures.',
        },
        {
          href: '/msoc-funding',
          title: 'MSOC funding',
          blurb: 'The other program with a published statewide gap.',
        },
        {
          href: '/sources',
          title: 'Sources & methodology',
          blurb: 'Exactly which F-196 programs are counted on each side.',
        },
      ]}
    >
      <TopicSection id="how-it-works" title="How the funding works">
        <p>
          Special education is not funded by a separate per-student amount. The
          state calculates a district&apos;s basic education allocation first,
          then applies an excess-cost multiplier for students eligible for
          special education services - the allocation sits{' '}
          <em>on top of</em> basic education rather than replacing it.
        </p>
        <p>
          In 2025, E2SSB 5263 raised the multiplier and removed the enrollment
          cap that had previously limited how many students a district could
          claim it for. Whether the current rate covers actual costs remains
          actively debated in the Legislature.
        </p>
        <p>
          Washington districts served{' '}
          <strong className="text-ink">{fmtInt(spedStudents)}</strong> students
          with disabilities in {LATEST}, about{' '}
          {((100 * spedStudents) / STATEWIDE.enrollment).toFixed(1)}% of total
          enrollment.
        </p>
      </TopicSection>

      <TopicSection id="the-gap" title="Allocation versus actual spending">
        <p>
          Both figures below cover the same thing: state special education
          programs 21, 22 and 26. Federally funded IDEA money (program 24) is
          excluded from both sides, so the comparison is like-for-like.
        </p>
        <div className="not-prose">
          <GapSummary
            program="special education"
            allocated={gap.allocated}
            spent={gap.spent}
            gap={gap.gap}
            districtsAbove={gap.districtsAbove}
            districtsCompared={gap.districtsCompared}
          />
        </div>
        <p>
          Statewide that works out to{' '}
          <strong className="text-ink">
            {fmtMoneyFull(SPENDING_TOTALS.spedPerStudent)}
          </strong>{' '}
          of general-fund spending per student with disabilities.{' '}
          {gap.districtsAbove} of the {gap.districtsCompared} districts with both
          figures published spent more than the formula allocated; the
          difference comes from local levy, federal or other revenue.
        </p>
      </TopicSection>

      <TopicSection id="by-district" title="Where the gap is largest">
        <p>
          Ranked by the per-student difference between spending and allocation.
          The extremes are mostly very small districts and charter schools, where
          a single student&apos;s placement can move the per-student figure by
          thousands of dollars.
        </p>
        <div className="not-prose">
          <GapTable
            rows={topSmall}
            caption="Washington districts with the largest per-student special education gap"
          />
        </div>
        <p className="pt-4">
          Among districts with more than 10,000 funded students, where a single
          placement cannot skew the average:
        </p>
        <div className="not-prose">
          <GapTable
            rows={topLarge}
            caption="Large Washington districts with the largest per-student special education gap"
          />
        </div>
      </TopicSection>

      <TopicSection id="caveats" title="How to read these numbers">
        <p>
          The spending side is general-fund only. It deliberately excludes
          federal IDEA money, because including federally funded spending on the
          cost side while comparing it against a state-only allocation
          overstates the state&apos;s shortfall - by roughly $254 million
          statewide.
        </p>
        <p>
          These are reported actuals, not a needs assessment. A district
          spending above its allocation is evidence that the formula did not
          cover its costs that year, not a measure of what adequate services
          would cost.
        </p>
        <p className="text-sm text-ink-muted">
          Sources: OSPI Apportionment final extract for the allocation, F-196
          actuals for spending, {LATEST}. Full detail on{' '}
          <Link href="/sources" className="text-accent hover:underline">
            Sources &amp; Methodology
          </Link>
          .
        </p>
      </TopicSection>
    </TopicPage>
  );
}
