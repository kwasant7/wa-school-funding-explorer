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
import { MSOC } from '@/lib/prototypical-model';

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
  The per-student formula rate, read from the statutory parameter file rather
  than restated as a literal here - this page and the prototypical model page
  previously carried the figure independently and disagreed about which school
  year it described.

  Note the vintage mismatch this page has to live with: the rate below is the
  statutory floor set by 2025 c 334 for 2025-26, while the spending it is
  compared against is 2024-25 actuals, the most recent year OSPI has published.
*/
const MSOC_FORMULA_RATE = MSOC.perStudent;

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
          per student under current law, with a further{' '}
          {fmtMoneyFull(MSOC.highSchoolAddOn)} per student in grades 9-12.
          Unlike staffing allocations, it does not vary with a district&apos;s
          size, its regional labour costs, or the mix of students it serves.
          Both figures are statutory floors that the Legislature indexed to
          inflation beginning in {MSOC.inflationIndexedFrom}, so from that year
          the operative rate is set in the budget rather than the statute. The
          spending they are compared against below is {LATEST} actuals, the most
          recent year OSPI has published.
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
            {fmtMoneyFull(SPENDING_TOTALS.msocBig3PerStudent)}
          </strong>{' '}
          per funded student, against a formula built on the{' '}
          {fmtMoneyFull(MSOC_FORMULA_RATE)} general-education rate. This is the
          most widely shared gap on the site:{' '}
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
          Both sides follow the MSOC definition in the Superintendent of Public
          Instruction&apos;s 2026 budget request - the same scope behind{' '}
          <a
            href="https://www.waschoolfunding.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            AESD&apos;s Big 3 dashboard
          </a>
          : the funding side counts general-education, career-and-technical and
          alternative-learning MSOC, and the spending side takes non-staff
          objects across those programs while excluding items that are not
          operating costs (contracted student transportation, tuition, debt,
          land and building improvements). Counting every non-salary object
          across every program instead would pull in capital outlay and the
          non-salary share of special education, transportation and food
          service - double-counting money already compared on those pages.
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
