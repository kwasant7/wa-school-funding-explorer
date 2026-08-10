import type { Metadata } from 'next';
import Link from 'next/link';
import { TopicPage, TopicSection } from '@/components/topic/TopicPage';
import { pageMetadata } from '@/lib/site-metadata';
import {
  ALLOCATION_TOTALS,
  LEA_ASSUMPTIONS,
  leaEligibility,
  levyCapBlocked,
  LEVY_CALENDAR_YEAR,
  STATEWIDE,
} from '@/lib/topic-stats';
import { fmtMoney, pct } from '@/lib/format';
import { LATEST } from '@/lib/years';

const TITLE = 'School Levies & Local Effort Assistance in Washington | K12Funding.org';
const H1 = 'School levies and Local Effort Assistance';
const DESCRIPTION =
  'How Washington’s enrichment levy cap works, how Local Effort Assistance equalizes property-poor districts, and how much voter-approved levy the cap currently blocks.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  titleIsComplete: true,
  description: DESCRIPTION,
  path: '/school-levies-and-lea/',
});

const money2 = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function LeviesAndLeaPage() {
  const blocked = levyCapBlocked();
  const eligibility = leaEligibility();
  const rev = STATEWIDE.revenues;

  return (
    <TopicPage
      title={TITLE}
      h1={H1}
      description={DESCRIPTION}
      path="/school-levies-and-lea/"
      lede={
        <>
          Local enrichment levies raised{' '}
          <strong className="text-ink">{fmtMoney(rev.local)}</strong> in {LATEST}
          , {pct(rev.local, rev.total)} of all school revenue. State law caps how
          much a district may collect per student, and Local Effort Assistance
          sends state money to districts whose property base cannot raise the
          statewide goal.
        </>
      }
      related={[
        {
          href: '/lea',
          title: 'The LEA formula, step by step',
          blurb: 'All four steps with a worked example using real district numbers.',
        },
        {
          href: '/washington-school-funding',
          title: 'How Washington funds K-12 schools',
          blurb: 'Where levies sit alongside state and federal money.',
        },
        {
          href: '/simulator',
          title: 'Policy Simulator',
          blurb: 'Raise the levy cap or the LEA goal and see the effect.',
        },
        {
          href: '/districts',
          title: 'District Explorer',
          blurb: 'Your district’s levy, rate and LEA received.',
        },
        {
          href: '/prototypical-school-funding-model',
          title: 'The prototypical school model',
          blurb: 'What the state formula funds before any levy.',
        },
        {
          href: '/sources',
          title: 'Sources & methodology',
          blurb: 'The statutes and worksheets behind these figures.',
        },
      ]}
    >
      <TopicSection id="what-a-levy-is" title="What an enrichment levy is - and is not">
        <p>
          An enrichment levy is a local property tax a district&apos;s voters
          approve to pay for things beyond basic education. After the{' '}
          <em>McCleary</em> decision, the Legislature narrowed what levy money
          may be spent on and capped how much may be collected, precisely so
          levies could not be used to fund the basic education the state is
          constitutionally required to pay for itself.
        </p>
        <p>
          A levy is therefore an <em>enrichment</em> tool, and its size is
          limited twice over: by a rate limit of{' '}
          {money2(LEA_ASSUMPTIONS.maxLevyRate)} per $1,000 of assessed value, and
          by a per-student cap.
        </p>
      </TopicSection>

      <TopicSection id="the-cap" title="The per-student levy cap">
        <p>
          A district&apos;s levy authority is the <em>lesser</em> of those two
          limits. The per-student cap is set by RCW 84.52.0531, as amended by
          ESHB 2049 (2025).
        </p>
        <div className="not-prose grid sm:grid-cols-3 gap-3">
          <div className="card p-4">
            <div className="stat-label">Per-student cap</div>
            <div className="text-2xl font-semibold">
              {money2(LEA_ASSUMPTIONS.maxLevyPerPupil)}
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Most districts, calendar year {LEVY_CALENDAR_YEAR}
            </p>
          </div>
          <div className="card p-4">
            <div className="stat-label">Large-district cap</div>
            <div className="text-2xl font-semibold">
              {money2(LEA_ASSUMPTIONS.maxLevyPerPupilLarge)}
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Districts of 40,000+ students - Seattle only
            </p>
          </div>
          <div className="card p-4">
            <div className="stat-label">Rate limit</div>
            <div className="text-2xl font-semibold">
              {money2(LEA_ASSUMPTIONS.maxLevyRate)}
            </div>
            <p className="mt-1 text-xs text-ink-muted">Per $1,000 of assessed value</p>
          </div>
        </div>
        <p>
          The two-tier split is temporary. Under the current schedule the cap
          becomes a flat $5,035 for every district in 2031, when the
          district-size distinction disappears.
        </p>
        <p className="rounded-lg border border-line bg-surface p-4 text-ink">
          <strong>
            {blocked.count} districts have passed a levy larger than the cap
            allows them to collect
          </strong>
          , totalling about {fmtMoney(blocked.blockedTotal)}. That is money
          voters have already approved. Releasing it would take a change to the
          cap, not a new election - past that point, collecting more would
          require a fresh vote.
        </p>
      </TopicSection>

      <TopicSection id="lea" title="Local Effort Assistance: the equalizer">
        <p>
          The same tax rate raises far more money in a property-rich district
          than a property-poor one. Local Effort Assistance - often called levy
          equalization - measures that gap and pays the difference.
        </p>
        <p>
          The state sets a per-student goal, then asks what each district&apos;s
          property <em>could</em> raise at a common rate of{' '}
          {money2(LEA_ASSUMPTIONS.leaMaxRate)} per $1,000. Where that falls short
          of the goal, the state makes up the difference. This is a wealth test,
          not a measure of the district&apos;s actual levy.
        </p>
        <div className="not-prose grid sm:grid-cols-3 gap-3">
          <div className="card p-4">
            <div className="stat-label">Per-student goal</div>
            <div className="text-2xl font-semibold">
              {money2(LEA_ASSUMPTIONS.leaThresholdPerPupil)}
            </div>
            <p className="mt-1 text-xs text-ink-muted">Calendar year {LEVY_CALENDAR_YEAR}</p>
          </div>
          <div className="card p-4">
            <div className="stat-label">Districts qualifying</div>
            <div className="text-2xl font-semibold">
              {eligibility.eligible} of {eligibility.total}
            </div>
            <p className="mt-1 text-xs text-ink-muted">Based on assessed value per student</p>
          </div>
          <div className="card p-4">
            <div className="stat-label">Allocated statewide</div>
            <div className="text-2xl font-semibold">
              {fmtMoney(ALLOCATION_TOTALS.levyEqualization)}
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {pct(ALLOCATION_TOTALS.levyEqualization, ALLOCATION_TOTALS.total)} of
              the state allocation
            </p>
          </div>
        </div>
        <p>
          LEA is prorated by local effort: a district levying below{' '}
          {money2(LEA_ASSUMPTIONS.leaMaxRate)} receives only that fraction of
          what it qualifies for. That is what makes LEA a <em>match</em> rather
          than a grant.
        </p>
        <p>
          <Link href="/lea" className="text-accent hover:underline font-semibold">
            See all four steps worked through with real district numbers →
          </Link>
        </p>
      </TopicSection>

      <TopicSection id="why-it-matters" title="Why the two interact">
        <p>
          The cap and LEA pull in opposite directions. The cap limits how far a
          wealthy district can outspend the state formula; LEA lifts districts
          that cannot reach it. Raising the cap without raising LEA widens the
          gap between property-rich and property-poor districts; raising LEA
          without raising the cap narrows it.
        </p>
        <p>
          Both levers are in the{' '}
          <Link href="/simulator" className="text-accent hover:underline">
            Policy Simulator
          </Link>
          , where the statewide cost of each is calculated from the same levy
          data used on this page.
        </p>
        <p className="text-sm text-ink-muted">
          Statutes: RCW 84.52.0531 (levy cap) and RCW 28A.500.015 (LEA
          threshold and proration). Levy figures are OSPI&apos;s calendar-year{' '}
          {LEVY_CALENDAR_YEAR} pre-ballot worksheet; see{' '}
          <Link href="/sources" className="text-accent hover:underline">
            Sources &amp; Methodology
          </Link>
          .
        </p>
      </TopicSection>
    </TopicPage>
  );
}
