import type { Metadata } from 'next';
import Link from 'next/link';
import levyData from '@/data/levy.json';
import { fmtInt, fmtMoney, fmtMoneyFull } from '@/lib/format';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata({
  title: 'How Local Effort Assistance works',
  description:
    "Washington's Local Effort Assistance formula, step by step: the per-student goal, the $1.50 wealth test, the levy-effort discount, and a worked example using real district numbers.",
  path: '/lea/',
});

const LEA = levyData.assumptions;
const DISTRICTS = levyData.districts as Record<
  string,
  (typeof levyData.districts)[keyof typeof levyData.districts]
>;

/** Yakima: qualifies, and its own levy rate is above $1.50, so effort = 1. */
const EXAMPLE = DISTRICTS['39007'];

const eligibleCount = Object.entries(DISTRICTS).filter(
  ([code, d]) => code !== '00000' && d.eligible
).length;
const totalCount = Object.keys(DISTRICTS).filter((c) => c !== '00000').length;

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="card p-5 md:p-6 border-l-4 border-l-[#8b5cf6]">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3eeff] font-bold text-[#7c3aed]">
          {n}
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{title}</h3>
          <div className="mt-2 space-y-3 text-ink-secondary">{children}</div>
        </div>
      </div>
    </li>
  );
}

export default function LeaPage() {
  const capacity = (EXAMPLE.av * LEA.leaMaxRate) / 1000 / EXAMPLE.enrollment;
  const perPupilGap = Math.max(0, LEA.leaThresholdPerPupil - capacity);
  const maxLea = perPupilGap * EXAMPLE.enrollment;
  const effort = Math.min(EXAMPLE.levyRate / LEA.leaMaxRate, 1);

  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-10 pb-16">
      <p className="text-sm text-ink-secondary">
        <Link href="/simulator" className="text-accent hover:underline">
          ← Back to the Policy Simulator
        </Link>
      </p>
      <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
        How Local Effort Assistance works
      </h1>
      <p className="mt-3 max-w-3xl text-lg text-ink-secondary">
        Local Effort Assistance (LEA), often called levy equalization, is the
        state&apos;s answer to a simple problem: the same school tax rate raises
        far more money in a property-rich district than a property-poor one. LEA
        measures that gap and pays the difference.
      </p>

      <section className="mt-8 card p-5 md:p-6 bg-accent-wash border-accent-soft">
        <h2 className="text-lg font-bold">The short version</h2>
        <p className="mt-2 text-ink-secondary">
          The state picks a per-student dollar goal. It then checks what a
          district&apos;s own property could raise at a standard tax rate. If
          that falls short of the goal, the state pays the gap - scaled down if
          the district taxes itself at less than the standard rate.
        </p>
        <p className="mt-3 text-sm text-ink-secondary">
          In 2026 the goal is{' '}
          <strong className="text-ink">
            {fmtMoneyFull(LEA.leaThresholdPerPupil)} per student
          </strong>{' '}
          and the standard rate is{' '}
          <strong className="text-ink">
            ${LEA.leaMaxRate.toFixed(2)} per $1,000
          </strong>{' '}
          of assessed value.{' '}
          <strong className="text-ink">{fmtInt(eligibleCount)}</strong> of{' '}
          {fmtInt(totalCount)} districts qualify for at least some LEA.
        </p>
      </section>

      <h2 className="mt-10 text-2xl font-bold">The formula, step by step</h2>
      <p className="mt-2 text-ink-secondary">
        These are the same four steps OSPI runs on its{' '}
        <span className="font-medium text-ink">LevyCalc</span> worksheet (rows
        Q, R, V and X).
      </p>

      <ol className="mt-5 space-y-4">
        <Step n={1} title="Measure the district's property wealth">
          <p>
            Multiply the district&apos;s total assessed property value by the
            standard LEA rate of ${LEA.leaMaxRate.toFixed(2)} per $1,000, then
            divide by its LEA enrollment. This is a{' '}
            <strong className="text-ink">wealth test, not a real levy</strong> -
            it asks what the district <em>could</em> raise at a common rate, no
            matter what its voters actually approved.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-baseline/40 p-3 text-xs text-ink">
{`capacity per student = assessed value × $${LEA.leaMaxRate.toFixed(2)} ÷ 1,000 ÷ enrollment`}
          </pre>
        </Step>

        <Step n={2} title="Compare it with the statewide goal">
          <p>
            Subtract that capacity from the per-student goal. A district above
            the goal gets nothing; the shortfall for everyone else is the
            per-student amount the state is willing to cover.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-baseline/40 p-3 text-xs text-ink">
{`LEA per student = max(0, ${fmtMoneyFull(LEA.leaThresholdPerPupil)} − capacity per student)`}
          </pre>
        </Step>

        <Step n={3} title="Scale it up to the whole district">
          <p>
            Multiply by enrollment to get the district&apos;s maximum LEA
            entitlement for the year.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-baseline/40 p-3 text-xs text-ink">
{`maximum LEA = LEA per student × enrollment`}
          </pre>
        </Step>

        <Step n={4} title="Discount for districts that tax themselves less">
          <p>
            LEA matches local effort. A district levying the full $
            {LEA.leaMaxRate.toFixed(2)} rate or more collects all of it; one
            levying half that rate collects half. This is why LEA is a{' '}
            <em>match</em> rather than a grant.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-baseline/40 p-3 text-xs text-ink">
{`payable LEA = maximum LEA × min(district levy rate ÷ $${LEA.leaMaxRate.toFixed(2)}, 1)`}
          </pre>
        </Step>
      </ol>

      <h2 className="mt-10 text-2xl font-bold">
        Worked example: Yakima School District
      </h2>
      <div className="mt-4 card p-5 md:p-6">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-secondary">Assessed value</dt>
            <dd className="text-lg font-bold tabular-nums">
              {fmtMoney(EXAMPLE.av)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-secondary">LEA enrollment</dt>
            <dd className="text-lg font-bold tabular-nums">
              {fmtInt(Math.round(EXAMPLE.enrollment))}
            </dd>
          </div>
        </dl>

        <ol className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
          <li>
            <span className="text-ink-secondary">1. Capacity per student:</span>{' '}
            {fmtMoney(EXAMPLE.av)} × ${LEA.leaMaxRate.toFixed(2)} ÷ 1,000 ÷{' '}
            {fmtInt(Math.round(EXAMPLE.enrollment))} ={' '}
            <strong className="text-ink">
              {fmtMoneyFull(Math.round(capacity))}
            </strong>
          </li>
          <li>
            <span className="text-ink-secondary">2. Gap to the goal:</span>{' '}
            {fmtMoneyFull(LEA.leaThresholdPerPupil)} −{' '}
            {fmtMoneyFull(Math.round(capacity))} ={' '}
            <strong className="text-ink">
              {fmtMoneyFull(Math.round(perPupilGap))}
            </strong>{' '}
            per student
          </li>
          <li>
            <span className="text-ink-secondary">3. Maximum LEA:</span>{' '}
            {fmtMoneyFull(Math.round(perPupilGap))} ×{' '}
            {fmtInt(Math.round(EXAMPLE.enrollment))} ={' '}
            <strong className="text-ink">{fmtMoney(maxLea)}</strong>
          </li>
          <li>
            <span className="text-ink-secondary">4. Effort discount:</span>{' '}
            Yakima levies ${EXAMPLE.levyRate.toFixed(4)} per $1,000, above the $
            {LEA.leaMaxRate.toFixed(2)} standard, so the multiplier is{' '}
            {effort.toFixed(2)} and it keeps the full amount:{' '}
            <strong className="text-ink">{fmtMoney(EXAMPLE.payableLea)}</strong>
          </li>
        </ol>

        <p className="mt-5 border-t border-line pt-4 text-sm text-ink-secondary">
          Yakima actually received{' '}
          <strong className="text-ink">{fmtMoney(EXAMPLE.actualLea)}</strong> in
          LEA in 2024-25 (F-196 revenue code 3300). The formula figure above is
          the 2026 estimate, so the two differ by year, by enrollment counts,
          and by mid-year adjustments.
        </p>
      </div>

      <h2 className="mt-10 text-2xl font-bold">Why the goal moves</h2>
      <p className="mt-2 max-w-3xl text-ink-secondary">
        The per-student goal is set in statute and inflated each year.{' '}
        <strong className="text-ink">HB 2050 (2025)</strong> changed which
        enrollment counts in the calculation, and{' '}
        <strong className="text-ink">RCW 28A.500.015</strong> was updated in the
        2025 session to index LEA to the implicit price deflator (IPD) instead
        of CPI beginning in calendar year 2026. That is why the goal is{' '}
        {fmtMoneyFull(LEA.leaThresholdPerPupil)} in 2026 rather than a round
        number.
      </p>

      <h2 className="mt-10 text-2xl font-bold">Sources</h2>
      <ul className="mt-3 space-y-2 text-sm text-ink-secondary">
        <li>
          <a
            className="text-accent hover:underline"
            href="https://ospi.k12.wa.us/policy-funding/school-apportionment/budget-preparations"
            target="_blank"
            rel="noopener noreferrer"
          >
            OSPI Enrichment Levy Pre-Ballot Approval worksheet
          </a>{' '}
          - the LevyCalc tab supplies every assumption used here: max per pupil{' '}
          {fmtMoneyFull(LEA.maxLevyPerPupil)} (
          {fmtMoneyFull(LEA.maxLevyPerPupilLarge)} for districts of 40,000 or
          more students, which is Seattle alone), LEA max per pupil{' '}
          {fmtMoneyFull(LEA.leaThresholdPerPupil)}, LEA max rate $
          {LEA.leaMaxRate.toFixed(2)}, max levy rate $
          {LEA.maxLevyRate.toFixed(2)}.
        </li>
        <li>
          <a
            className="text-accent hover:underline"
            href="https://app.leg.wa.gov/rcw/default.aspx?cite=28A.500.015"
            target="_blank"
            rel="noopener noreferrer"
          >
            RCW 28A.500.015
          </a>{' '}
          - the statute that defines the LEA allocation and its inflator.
        </li>
        <li>
          <a
            className="text-accent hover:underline"
            href="https://app.leg.wa.gov/billsummary?BillNumber=2050&Year=2025"
            target="_blank"
            rel="noopener noreferrer"
          >
            HB 2050 (2025)
          </a>{' '}
          - most recent change to the enrollment counted in LEA.
        </li>
        <li>
          <Link href="/sources" className="text-accent hover:underline">
            Full source list for this site
          </Link>
        </li>
      </ul>
    </div>
  );
}
