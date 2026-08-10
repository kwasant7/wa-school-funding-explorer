import type { Metadata } from 'next';
import Link from 'next/link';
import {
  GapSummary,
  GapTable,
  TopicPage,
  TopicSection,
} from '@/components/topic/TopicPage';
import { pageMetadata } from '@/lib/site-metadata';
import { programGap, rankedByGap, SPENDING_TOTALS } from '@/lib/topic-stats';
import { fmtMoney, fmtMoneyFull } from '@/lib/format';
import { LATEST } from '@/lib/years';

const TITLE = 'School Transportation Funding in Washington | K12Funding.org';
const H1 = 'Student transportation funding';
const DESCRIPTION =
  'How Washington funds student transportation separately from basic education, what districts actually spend from the general fund, and which districts fall furthest behind.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  titleIsComplete: true,
  description: DESCRIPTION,
  path: '/school-transportation-funding/',
});

export default function TransportationFundingPage() {
  const gap = programGap('transportation');
  const topSmall = rankedByGap('transportation', { limit: 8 });
  const topLarge = rankedByGap('transportation', { limit: 8, minFte: 10000 });

  return (
    <TopicPage
      title={TITLE}
      h1={H1}
      description={DESCRIPTION}
      path="/school-transportation-funding/"
      lede={
        <>
          Getting students to school is funded by its own formula under RCW
          28A.160.192, separate from basic education. It is based on the students
          a district actually carries and how far they travel - so rural
          districts with long routes, and districts running required special
          education routes, feel changes here most.
        </>
      }
      related={[
        {
          href: '/washington-school-funding',
          title: 'How Washington funds K-12 schools',
          blurb: 'Where transportation sits in the whole allocation.',
        },
        {
          href: '/special-education-funding',
          title: 'Special education funding',
          blurb: 'Required special education routes drive transportation cost.',
        },
        {
          href: '/simulator',
          title: 'Policy Simulator',
          blurb: 'Change the transportation allocation and see the cost.',
        },
        {
          href: '/districts',
          title: 'District Explorer',
          blurb: 'Your district’s own transportation figures.',
        },
        {
          href: '/msoc-funding',
          title: 'MSOC funding',
          blurb: 'The other flat-rate operating allocation.',
        },
        {
          href: '/sources',
          title: 'Sources & methodology',
          blurb: 'Which F-196 program the spending figure comes from.',
        },
      ]}
    >
      <TopicSection id="how-it-works" title="How transportation is funded">
        <p>
          Transportation has its own allocation rather than being folded into
          the per-student basic education amount. The state&apos;s formula
          responds to ridership and distance, which is why two districts with
          identical enrollment can receive very different amounts.
        </p>
        <p>
          Two exclusions matter for reading any transportation figure. Bus
          <em> purchases</em> are not in the general fund at all - they run
          through the separate Transportation Vehicle Fund. And the per-student
          figures below are per <em>enrolled</em> student, not per bus rider:
          most students never board a bus, so the real cost of carrying one
          student is far higher than these averages suggest.
        </p>
      </TopicSection>

      <TopicSection id="the-gap" title="Allocation versus actual spending">
        <div className="not-prose">
          <GapSummary
            program="student transportation"
            allocated={gap.allocated}
            spent={gap.spent}
            gap={gap.gap}
            districtsAbove={gap.districtsAbove}
            districtsCompared={gap.districtsCompared}
          />
        </div>
        <p>
          Statewide that is{' '}
          <strong className="text-ink">
            {fmtMoneyFull(SPENDING_TOTALS.transportationPerStudent)}
          </strong>{' '}
          of general-fund transportation spending per enrolled student in{' '}
          {LATEST}, against {fmtMoney(gap.allocated)} allocated.
        </p>
        <p>
          Transportation is the least uniform of the three published gaps:{' '}
          {gap.districtsAbove} of {gap.districtsCompared} districts spent above
          their allocation, meaning a substantial minority spent less than the
          formula provided. Geography, not policy, explains most of that split.
        </p>
      </TopicSection>

      <TopicSection id="by-district" title="Where the gap is largest">
        <p>
          Ranked by per-student difference. Small rural districts dominate:
          long routes over sparse territory cost roughly the same to run whether
          twenty students or two hundred ride them.
        </p>
        <div className="not-prose">
          <GapTable
            rows={topSmall}
            caption="Washington districts with the largest per-student transportation gap"
          />
        </div>
        <p className="pt-4">
          Among districts with more than 10,000 funded students:
        </p>
        <div className="not-prose">
          <GapTable
            rows={topLarge}
            caption="Large Washington districts with the largest per-student transportation gap"
          />
        </div>
      </TopicSection>

      <TopicSection id="caveats" title="How to read these numbers">
        <p>
          The spending side is F-196 program 99, general fund only. Because bus
          purchases sit outside the general fund, this figure understates the
          full cost of running student transportation - it describes operations,
          not fleet replacement.
        </p>
        <p>
          This site does not attempt to reproduce the state&apos;s STARS
          allocation model, which computes an expected cost from ridership and
          distance. The comparison here is between what a district received and
          what it spent, which is a narrower question than whether the formula
          is correctly calibrated.
        </p>
        <p className="text-sm text-ink-muted">
          Relevant bills: ESSB 5009 (vehicle types), SB 5858 (a safety net for
          transporting students with disabilities and students experiencing
          homelessness or in foster care), and ESSB 6260 (bus depreciation). See{' '}
          <Link href="/take-action" className="text-accent hover:underline">
            Take Action
          </Link>{' '}
          and{' '}
          <Link href="/sources" className="text-accent hover:underline">
            Sources &amp; Methodology
          </Link>
          .
        </p>
      </TopicSection>
    </TopicPage>
  );
}
