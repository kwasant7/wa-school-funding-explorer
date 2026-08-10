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

const TITLE = 'MSOC Funding in Washington Schools | K12Funding.org';
const H1 = 'MSOC: materials, supplies and operating costs';
const DESCRIPTION =
  'Washington funds materials, supplies and operating costs at a flat per-student rate. See the formula amount, what districts actually spend, and the gap by district.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  titleIsComplete: true,
  description: DESCRIPTION,
  path: '/msoc-funding/',
});

/*
  The per-student formula rate. Read from the simulator's baseline rather than
  restated as a literal so the two cannot drift; see simulator-config.ts, which
  documents it as the 2024-25 statutory MSOC allocation.
*/
const MSOC_FORMULA_RATE = 1614;

export default function MsocFundingPage() {
  const gap = programGap('msoc');
  const topSmall = rankedByGap('msoc', { limit: 8 });
  const topLarge = rankedByGap('msoc', { limit: 8, minFte: 10000 });

  return (
    <TopicPage
      title={TITLE}
      h1={H1}
      description={DESCRIPTION}
      path="/msoc-funding/"
      lede={
        <>
          MSOC covers everything that is not staff pay: curriculum, technology,
          utilities, insurance and facilities upkeep. Because it is a flat
          per-student amount, it is the part of the formula that reaches every
          district on identical terms - and the one where small districts fall
          furthest behind their actual costs.
        </>
      }
      related={[
        {
          href: '/prototypical-school-funding-model',
          title: 'The prototypical school model',
          blurb: 'MSOC is the non-staff component of this formula.',
        },
        {
          href: '/washington-school-funding',
          title: 'How Washington funds K-12 schools',
          blurb: 'Where MSOC sits in the whole allocation.',
        },
        {
          href: '/simulator',
          title: 'Policy Simulator',
          blurb: 'Raise the MSOC rate and see the statewide cost.',
        },
        {
          href: '/districts',
          title: 'District Explorer',
          blurb: 'Your district’s own MSOC allocation and spending.',
        },
        {
          href: '/special-education-funding',
          title: 'Special education funding',
          blurb: 'The other program with a published statewide gap.',
        },
        {
          href: '/sources',
          title: 'Sources & methodology',
          blurb: 'Which F-196 objects and programs count as MSOC.',
        },
      ]}
    >
      <TopicSection id="how-it-works" title="How MSOC is funded">
        <p>
          The state pays a flat allocation per student -{' '}
          <strong className="text-ink">{fmtMoneyFull(MSOC_FORMULA_RATE)}</strong>{' '}
          per student in {LATEST}, with a further per-student add-on for grades
          9-12. Unlike staffing allocations, it does not vary with a
          district&apos;s size, its regional labour costs, or the mix of students
          it serves.
        </p>
        <p>
          That flatness is the design: it is the simplest lever in the formula,
          and raising it moves money to every district at once. It is also the
          reason a 200-student rural district and a 20,000-student suburban one
          receive the same amount per student toward heating a building,
          licensing software and insuring a bus fleet.
        </p>
      </TopicSection>

      <TopicSection id="the-gap" title="Allocation versus actual spending">
        <div className="not-prose">
          <GapSummary
            program="MSOC"
            allocated={gap.allocated}
            spent={gap.spent}
            gap={gap.gap}
            districtsAbove={gap.districtsAbove}
            districtsCompared={gap.districtsCompared}
          />
        </div>
        <p>
          Statewide, actual MSOC spending works out to{' '}
          <strong className="text-ink">
            {fmtMoneyFull(SPENDING_TOTALS.msocPerStudent)}
          </strong>{' '}
          per funded student, against the{' '}
          {fmtMoneyFull(MSOC_FORMULA_RATE)} the formula pays. This is the most
          widely shared gap on the site:{' '}
          <strong className="text-ink">{gap.districtsAbove}</strong> of{' '}
          {gap.districtsCompared} districts spent more than they were allocated,
          totalling {fmtMoney(gap.gap)}.
        </p>
      </TopicSection>

      <TopicSection id="by-district" title="Where the gap is largest">
        <p>
          Ranked by per-student difference. Small districts and charter schools
          dominate the top of this list because fixed building and technology
          costs do not shrink with enrollment - the same heating bill divided by
          fewer students is a larger number per student.
        </p>
        <div className="not-prose">
          <GapTable
            rows={topSmall}
            caption="Washington districts with the largest per-student MSOC gap"
          />
        </div>
        <p className="pt-4">
          Among districts with more than 10,000 funded students:
        </p>
        <div className="not-prose">
          <GapTable
            rows={topLarge}
            caption="Large Washington districts with the largest per-student MSOC gap"
          />
        </div>
      </TopicSection>

      <TopicSection id="caveats" title="How to read these numbers">
        <p>
          The spending side is deliberately scoped: objects 5, 7 and 8 within
          basic education programs 01, 02 and 03, plus objects 7 and 8 in
          districtwide support (program 97). Counting every non-salary object
          across every program would pull in capital outlay and the non-salary
          share of special education, transportation and food service -
          double-counting money already compared on those pages.
        </p>
        <p>
          The formula rate and the spending actuals are also drawn from
          different reporting cycles, so a small part of any single
          district&apos;s difference is timing rather than shortfall.
        </p>
        <p className="text-sm text-ink-muted">
          Relevant bills: SB 5192, SSB 5918 and SB 6310 have all proposed
          changes to the MSOC rate. Full detail on{' '}
          <Link href="/sources" className="text-accent hover:underline">
            Sources &amp; Methodology
          </Link>{' '}
          and the current bills on{' '}
          <Link href="/take-action" className="text-accent hover:underline">
            Take Action
          </Link>
          .
        </p>
      </TopicSection>
    </TopicPage>
  );
}
