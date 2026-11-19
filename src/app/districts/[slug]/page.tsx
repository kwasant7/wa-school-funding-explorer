import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import JsonLd from '@/components/JsonLd';
import { isSchoolDistrict } from '@/lib/entity';
import StatTile from '@/components/StatTile';
import { DISTRICT_REFS, districtBySlug, districtPath } from '@/lib/district-slug';
import { districtProfile, districtMetaDescription } from '@/lib/district-profile';
import {
  breadcrumbJsonLd,
  pageMetadata,
  webPageJsonLd,
} from '@/lib/site-metadata';
import { fmtInt, fmtMoney, fmtMoneyFull, fmtSignedMoney, ordinal, pct } from '@/lib/format';
import { aleContractsMaterial } from '@/lib/diagnosis';
import { OVERSIGHT_CHECKED_ON, oversightFor } from '@/data/oversight';
import levyJson from '@/data/levy.json';
import {
  RESERVE_BENCHMARK_PCT,
  RESERVE_THIN_PCT,
  RESERVE_MARGINAL_NEGATIVE_PCT,
  balanceGapIsMaterial,
  fundBalanceChange,
  reserveDays,
} from '@/lib/reserves';

const LEVY_CALENDAR_YEAR = levyJson.calendarYear;
const LEA_SCHOOL_YEAR = levyJson.actualLeaSchoolYear;

/*
  315 static pages, one per district, emitted at build time by `output:
  'export'`. Everything below renders on the server, so the numbers land in the
  HTML a crawler receives on first byte - the interactive explorer at
  /districts/ needs a click and a JavaScript run before it shows any of this.

  Nothing here recomputes a funding figure. Each value is read from the same
  modules the explorer uses, so a correction to the pipeline moves both.
*/

export function generateStaticParams() {
  return DISTRICT_REFS.map((d) => ({ slug: d.slug }));
}

type Params = { params: { slug: string } };

export function generateMetadata({ params }: Params): Metadata {
  const ref = districtBySlug(params.slug);
  const profile = ref ? districtProfile(ref.code) : null;
  if (!ref || !profile) return { title: 'District not found' };

  return pageMetadata({
    title: `${ref.name} Funding: Revenue, Gaps & Trends | K12Funding.org`,
    titleIsComplete: true,
    description: districtMetaDescription(profile),
    path: districtPath(ref),
  });
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="pt-10">
      <h2 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function DistrictPage({ params }: Params) {
  const ref = districtBySlug(params.slug);
  const profile = ref ? districtProfile(ref.code) : null;
  // A slug outside generateStaticParams cannot be reached in an export build,
  // but notFound() keeps the type narrowing honest and gives the dev server the
  // same 404 the static host serves.
  if (!ref || !profile) notFound();

  const p = profile;
  const path = districtPath(ref);
  const rev = p.revenue;
  const oversight = oversightFor(p.code);
  const hasTrend = p.trend.filter((t) => t.total != null).length > 1;
  // Voters can approve more than the law lets a district collect (OSPI's
  // LevyCalc row O, "rollback"). Which of the two limits binds decides how the
  // blocked amount is explained.
  const levyCapped = p.levy != null && p.levy.payableLevy < p.levy.levy;
  const rateCapBinds =
    p.levy != null &&
    p.levy.maxLevy ===
      Math.round((p.levy.av * levyJson.assumptions.maxLevyRate) / 1000);

  const revenueRows = [
    ['State', rev.state, 'The prototypical-school formula allocation, plus other state programs.'],
    [
      'Local',
      rev.local,
      // Charter and tribal compact schools cannot levy a property tax.
      isSchoolDistrict(p.metrics.record)
        ? 'Voter-approved enrichment levies and other local revenue.'
        : 'Local revenue other than a levy, such as fees and donations - this school cannot levy a property tax.',
    ],
    ['Federal', rev.federal, 'Title I, IDEA, child nutrition and other federal programs.'],
    ['Other', rev.other, 'Grants, fees and revenue from other districts and agencies.'],
  ] as const;

  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pb-16">
      <JsonLd
        data={[
          webPageJsonLd({
            title: `${p.name} school funding`,
            description: districtMetaDescription(p),
            path,
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'District Explorer', path: '/districts/' },
            { name: p.name, path },
          ]),
        ]}
      />

      <nav aria-label="Breadcrumb" className="pt-6 text-sm text-ink-secondary">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="text-accent hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/districts" className="text-accent hover:underline">
              District Explorer
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {p.name}
          </li>
        </ol>
      </nav>

      <header className="pt-4">
        <p className="text-sm font-semibold text-accent uppercase tracking-wide">
          {p.county} County · {p.esd}
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
          {p.name} funding
        </h1>
        <p className="mt-4 text-lg text-ink-secondary">
          In {p.schoolYear}, {p.name} reported{' '}
          <strong className="text-ink">{fmtMoneyFull(rev.total)}</strong> in
          general-fund revenue for{' '}
          <strong className="text-ink">{fmtInt(Math.round(p.fundingFte))}</strong>{' '}
          funded students ({fmtInt(p.headcount)} enrolled in the October
          headcount), or{' '}
          <strong className="text-ink">{fmtMoneyFull(p.perPupil)}</strong> per
          student. The statewide median is{' '}
          {fmtMoneyFull(p.statewideMedianPerPupil)}.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Funded students"
          value={fmtInt(Math.round(p.fundingFte))}
          note={`${fmtInt(p.headcount)} enrolled in October`}
        />
        <StatTile
          label="Total revenue"
          value={fmtMoney(rev.total)}
          note={`General fund, ${p.schoolYear}`}
        />
        <StatTile
          label="Per student"
          value={fmtMoneyFull(p.perPupil)}
          note={`${ordinal(Math.round(p.perPupilPercentile))} percentile statewide`}
        />
        <StatTile
          label="Reserves"
          value={p.reserveRatio != null ? `${p.reserveRatio}%` : 'Not reported'}
          note={
            p.reserveRatio != null
              ? 'Fund balance as a share of annual spending'
              : 'No fund-balance figure published'
          }
        />
      </div>

      <Section id="where-the-money-comes-from" title="Where the money comes from">
        <p className="text-ink-secondary">
          Washington districts run on three main streams. The state formula pays
          for basic education; local levies fund enrichment on top of it; federal
          money is mostly targeted at specific student groups.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {p.name} general-fund revenue by source, {p.schoolYear}
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">Source</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">Amount</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">Share</th>
                <th scope="col" className="py-2 font-semibold">What it covers</th>
              </tr>
            </thead>
            <tbody>
              {revenueRows.map(([label, amount, note]) => (
                <tr key={label} className="border-b border-line/60 align-top">
                  <th scope="row" className="py-2 pr-4 font-medium text-left">{label}</th>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {fmtMoneyFull(amount)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {pct(amount, rev.total)}
                  </td>
                  <td className="py-2 text-ink-secondary">{note}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <th scope="row" className="py-2 pr-4 text-left">Total</th>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {fmtMoneyFull(rev.total)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">100%</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink-muted">
          Source: OSPI F-196 general-fund revenue actuals, {p.schoolYear}. See{' '}
          <Link href="/sources" className="text-accent hover:underline">
            Sources &amp; Methodology
          </Link>{' '}
          for the revenue codes behind each row.
        </p>
      </Section>

      {p.gaps.length > 0 && (
        <Section
          id="formula-vs-actual"
          title="The “Big 3”: what these programs cost vs. what funds them"
        >
          <p className="text-ink-secondary">
            {p.gaps[0].aesd ? (
              <>
                Special education, student transportation, and materials,
                supplies &amp; operating costs (MSOC) are the three programs the
                Legislature calls the &ldquo;Big 3.&rdquo; Each line below is a
                program&apos;s full cost against every revenue line that funds
                it. Where cost runs above funding, the difference comes out of
                local levy and other general-fund money.
              </>
            ) : (
              <>
                For three programs the site compares what the district spent with
                what funded it. Where cost runs above funding, the difference
                comes out of local levy and other general-fund money. AESD
                publishes no Big 3 figures for this school, so these are the
                site&apos;s own state-program figures.
              </>
            )}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                {p.name} Big 3 program cost compared with the funding it
                receives, {p.schoolYear}
              </caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="py-2 pr-4 font-semibold">Program</th>
                  <th scope="col" className="py-2 pr-4 font-semibold text-right">Funding it receives</th>
                  <th scope="col" className="py-2 pr-4 font-semibold text-right">What it costs</th>
                  <th scope="col" className="py-2 pr-4 font-semibold text-right">Difference</th>
                  <th scope="col" className="py-2 font-semibold text-right">Per student</th>
                </tr>
              </thead>
              <tbody>
                {p.gaps.map((g) => (
                  <tr key={g.key} className="border-b border-line/60">
                    <th scope="row" className="py-2 pr-4 font-medium text-left">
                      {g.label}
                    </th>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {fmtMoneyFull(g.funding)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {fmtMoneyFull(g.cost)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {fmtSignedMoney(g.gap)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {fmtSignedMoney(Math.round(g.gapPerPupil))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.coveredLocally > 0 && (
            <p className="mt-3">
              Across these three programs, {p.name} covered about{' '}
              <strong>{fmtMoney(p.coveredLocally)}</strong> from its own general
              money beyond what their dedicated funding paid for in{' '}
              {p.schoolYear}.
            </p>
          )}
          {aleContractsMaterial(p.metrics) && (
            <p className="mt-3 text-sm text-ink-muted">
              The MSOC cost above includes{' '}
              <strong className="text-ink-secondary">
                {fmtMoney(p.metrics.spend?.msocBig3AleContracts ?? 0)}
              </strong>{' '}
              that {p.name}&apos;s alternative learning (online) program paid
              outside providers to teach its students - teaching more than a true
              operating cost, which AESD&apos;s figure folds in here. The brief
              sets it apart when it weighs this program.
            </p>
          )}
          {p.gaps.some((g) => g.key === 'sped' && g.gap > 0) && (
            <p className="mt-3 text-sm text-ink-muted">
              The special education figures are {p.schoolYear}, before E2SSB 5263
              took effect September 1, 2025, raising the special-education
              multiplier and removing the enrollment cap. These actuals predate
              that change and do not measure the gap under the current formula.
            </p>
          )}
          <p className="mt-3 text-sm text-ink-muted">
            {p.gaps[0].aesd ? (
              <>
                These are the same figures as{' '}
                <a
                  href="https://app.powerbi.com/view?r=eyJrIjoiMzNiMGJlMjUtMTcwNC00YWMwLTg0ODktYTU5Zjg3NGJmOWJmIiwidCI6ImE5ZWIyNzExLTg0M2YtNDhjMC04M2NkLWM0M2FjNjAwOTgzMSJ9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  AESD&apos;s Big 3 dashboard ↗
                </a>
                , built from OSPI F-196 actuals and apportionment - the same
                definition OSPI and the Legislature use. &ldquo;Funding&rdquo;
                counts every revenue line for a program: state, federal special
                education (IDEA) and Medicaid money, and payments from other
                districts. Per-student amounts divide by AESD&apos;s K-12 plus
                alternative-learning student count. Read more on{' '}
              </>
            ) : (
              <>
                AESD publishes no Big 3 line for this school, so these are the
                site&apos;s own state-program figures - cost and the state
                allocation plus other program revenue. Read more on{' '}
              </>
            )}
            <Link href="/special-education-funding" className="text-accent hover:underline">
              special education funding
            </Link>
            ,{' '}
            <Link href="/msoc-funding" className="text-accent hover:underline">
              MSOC
            </Link>{' '}
            and{' '}
            <Link href="/school-transportation-funding" className="text-accent hover:underline">
              student transportation
            </Link>
            .
          </p>
        </Section>
      )}

      {hasTrend && (
        <Section id="trends" title={`Funding trends since ${p.firstYearWithData}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                {p.name} revenue and enrollment by school year
              </caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="py-2 pr-4 font-semibold">School year</th>
                  <th scope="col" className="py-2 pr-4 font-semibold text-right">Total revenue</th>
                  <th scope="col" className="py-2 pr-4 font-semibold text-right">Per student</th>
                  <th scope="col" className="py-2 font-semibold text-right">Funded students</th>
                </tr>
              </thead>
              <tbody>
                {p.trend.map((t) => (
                  <tr key={t.year} className="border-b border-line/60">
                    <th scope="row" className="py-2 pr-4 font-medium text-left">
                      {t.year}
                    </th>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {t.total != null ? fmtMoneyFull(t.total) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {t.perPupil != null ? fmtMoneyFull(t.perPupil) : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {t.enrollment != null ? fmtInt(Math.round(t.enrollment)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.enrollmentChange != null && (
            <p className="mt-3 text-ink-secondary">
              Funded enrollment has{' '}
              {p.enrollmentChange >= 0 ? 'grown' : 'fallen'} by{' '}
              <strong className="text-ink">
                {Math.abs(p.enrollmentChange).toFixed(1)}%
              </strong>{' '}
              since 2019-20. Because most state funding follows enrollment, that
              change moves the district&apos;s allocation directly.
            </p>
          )}
          <p className="mt-3 text-sm text-ink-muted">
            Dollars are nominal - not adjusted for inflation. Explore these
            trends as charts in the{' '}
            <Link
              href={`/districts?d=${p.code}`}
              className="text-accent hover:underline"
            >
              interactive District Explorer
            </Link>
            .
          </p>
        </Section>
      )}

      <Section id="students" title="Students this district serves">
        <p className="text-ink-secondary">
          Several state programs are funded on these counts, so a district&apos;s
          mix of students shapes its allocation as much as its total enrollment
          does. Shares are of the October headcount.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {p.name} student demographics compared with the statewide share
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">Student group</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">Students</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">District share</th>
                <th scope="col" className="py-2 font-semibold text-right">Statewide share</th>
              </tr>
            </thead>
            <tbody>
              {p.demographics.map((d) => (
                <tr key={d.label} className="border-b border-line/60">
                  <th scope="row" className="py-2 pr-4 font-medium text-left">
                    {d.label}
                  </th>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {d.reported ? fmtInt(d.count) : 'Not reported'}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {d.reported ? `${d.districtRate.toFixed(1)}%` : '-'}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-secondary">
                    {d.statewideRate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {p.levy && (
        <Section id="levy" title="Local levy and Local Effort Assistance">
          <p className="text-ink-secondary">
            State law limits an enrichment levy to the lesser of $2.50 per
            $1,000 of assessed value and a set amount per student, and
            property-poor districts receive Local Effort Assistance to close part
            of the gap between what their property base raises and the statewide
            goal.
          </p>
          {/*
            Levies and LEA are calendar-year money, while everything else on
            this page is a September-August school year - and the two figures
            here are not even the same year as each other. A district business
            office reading "levy rate" with no year attached cannot tell which
            levy it is, so each figure carries its own.
          */}
          <p className="mt-2 text-sm text-ink-muted">
            Levies and Local Effort Assistance are paid by calendar year, not by
            school year, so each figure below is labeled with its year.
          </p>
          <dl className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="card p-4">
              <dt className="stat-label">
                Voter-approved levy, {LEVY_CALENDAR_YEAR}
              </dt>
              <dd className="text-xl font-semibold">{fmtMoneyFull(p.levy.levy)}</dd>
              <dd className="mt-1 text-xs text-ink-muted">
                {p.levy.levy === 0 && p.levy.lastLevy
                  ? `No levy approved for ${LEVY_CALENDAR_YEAR}. The last one, for ${p.levy.lastLevyYear}, was ${fmtMoneyFull(p.levy.lastLevy)}.`
                  : `Calendar year ${LEVY_CALENDAR_YEAR} collections, as approved by voters`}
              </dd>
            </div>
            <div className="card p-4">
              <dt className="stat-label">Levy rate, {LEVY_CALENDAR_YEAR}</dt>
              <dd className="text-xl font-semibold">
                ${p.levy.payableLevyRate.toFixed(2)}
                <span className="text-sm font-normal text-ink-muted">
                  {' '}per $1,000 of value
                </span>
              </dd>
              <dd className="mt-1 text-xs text-ink-muted">
                {levyCapped ? (
                  <>
                    The most state law allows. Voters approved $
                    {p.levy.levyRate.toFixed(2)}.
                  </>
                ) : p.levy.levy === 0 ? (
                  <>No enrichment levy approved for this year</>
                ) : p.levy.maxLevy > 0 && p.levy.levy >= 0.95 * p.levy.maxLevy ? (
                  <>
                    {Math.floor((100 * p.levy.levy) / p.levy.maxLevy)}% of the most
                    state law allows ({fmtMoneyFull(p.levy.maxLevy)})
                  </>
                ) : (
                  <>OSPI estimate, from current property values</>
                )}
              </dd>
            </div>
            <div className="card p-4">
              <dt className="stat-label">
                Local Effort Assistance received, {LEA_SCHOOL_YEAR}
              </dt>
              <dd className="text-xl font-semibold">
                {fmtMoneyFull(p.levy.actualLea)}
              </dd>
              <dd className="mt-1 text-xs text-ink-muted">
                School year {LEA_SCHOOL_YEAR} (September to August), from the
                district&apos;s financial report
              </dd>
            </div>
          </dl>
          {levyCapped && (
            <p className="mt-4">
              State law blocks about{' '}
              <strong>{fmtMoney(p.levy.levy - p.levy.payableLevy)}</strong> of the
              levy voters approved here for {LEVY_CALENDAR_YEAR}: that much is above
              the{' '}
              {rateCapBinds
                ? 'limit of $2.50 per $1,000 of assessed value'
                : 'statutory per-student limit'}
              , so the district cannot collect it without a change to state law
              rather than a new election.
            </p>
          )}
          <p className="mt-3 text-sm text-ink-muted">
            {p.levy.eligible
              ? 'This district qualifies for Local Effort Assistance.'
              : 'This district does not qualify for Local Effort Assistance - its property base raises more than the statewide goal at the standard rate.'}{' '}
            The full formula is walked through step by step on{' '}
            <Link href="/lea" className="text-accent hover:underline">
              how Local Effort Assistance works
            </Link>
            , with more context on{' '}
            <Link href="/school-levies-and-lea" className="text-accent hover:underline">
              school levies and LEA
            </Link>
            .
          </p>
        </Section>
      )}

      <Section id="budget" title="Spending, surplus and reserves">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="Total revenue" value={fmtMoneyFull(rev.total)} />
          <StatTile label="Total spending" value={fmtMoneyFull(p.expenditures)} />
          <StatTile
            label={p.surplus >= 0 ? 'Surplus' : 'Deficit'}
            value={fmtSignedMoney(p.surplus)}
            note={`Revenue minus spending, ${p.schoolYear}`}
          />
          <StatTile
            label="Ending fund balance"
            value={p.fundBalance != null ? fmtMoneyFull(p.fundBalance) : 'Not reported'}
            note={
              p.reserveRatio == null
                ? undefined
                : p.reserveRatio < 0
                  ? `${p.reserveRatio}% of spending`
                  : `${p.reserveRatio}% of spending, about ${reserveDays(p.reserveRatio)} days`
            }
          />
        </div>
        {(() => {
          const change = fundBalanceChange(p.metrics.record);
          if (!balanceGapIsMaterial(p.surplus, change, p.expenditures) || change == null) return null;
          return (
            <p className="mt-4 text-ink-secondary">
              The fund balance itself {change < 0 ? 'fell' : 'rose'}{' '}
              {fmtMoneyFull(Math.abs(change))} in {p.schoolYear}. The{' '}
              {fmtMoneyFull(Math.abs(change - p.surplus))} difference from revenue
              minus spending comes from general-fund money moved to other district
              funds, such as capital projects, which the spending total leaves out,
              or from adjustments to earlier years&apos; books.
            </p>
          );
        })()}
        {p.reserveRatio != null && (
          <>
            <p className="mt-4 text-ink-secondary">
              {p.reserveRatio < 0 ? (
                p.reserveRatio > RESERVE_MARGINAL_NEGATIVE_PCT ? (
                  <>
                    The district&apos;s general-fund balance ended {p.schoolYear}{' '}
                    marginally below zero ({p.reserveRatio}% of spending) - a
                    small year-end balance rather than depleted savings
                    {p.surplus < 0
                      ? `, though the year still ran a ${fmtMoney(Math.abs(p.surplus))} deficit`
                      : ''}
                    .
                  </>
                ) : (
                  <>
                    A negative fund balance means the district has spent all of
                    its savings and is carrying a shortfall into the next year.
                  </>
                )
              ) : p.reserveRatio >= RESERVE_BENCHMARK_PCT ? (
                <>
                  A fund balance of {p.reserveRatio}% of spending would run the
                  district for about {reserveDays(p.reserveRatio)} days. That
                  meets the State Auditor&apos;s benchmark of at least 60 days
                  (about 16% of a year&apos;s spending).
                </>
              ) : p.reserveRatio >= RESERVE_THIN_PCT ? (
                <>
                  A fund balance of {p.reserveRatio}% of spending would run the
                  district for about {reserveDays(p.reserveRatio)} days. That is
                  short of the State Auditor&apos;s benchmark of at least 60 days
                  (about 16% of a year&apos;s spending), and the Auditor rates a
                  general fund below it as concerning.
                </>
              ) : (
                <>
                  A fund balance of {p.reserveRatio}% of spending would run the
                  district for about {reserveDays(p.reserveRatio)} days - less
                  than one month, and well short of the State Auditor&apos;s
                  benchmark of at least 60 days (about 16% of a year&apos;s
                  spending).
                </>
              )}
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              The 60-day benchmark comes from the State Auditor&apos;s Financial
              Intelligence Tool, which adopts the Government Finance Officers
              Association&apos;s two-month guideline. It is not a legal
              requirement, and each school board sets its own minimum fund
              balance in policy.
            </p>
          </>
        )}
        {oversight && (
          <p className="mt-3 rounded-lg border border-line bg-surface p-4 text-sm">
            OSPI lists {p.name} under{' '}
            {oversight.level === 'enhanced' ? 'enhanced financial oversight' : 'binding conditions'}
            {oversight.since ? `; its most recent update was in ${oversight.since}` : ''}.{' '}
            {oversight.detail} Checked {OVERSIGHT_CHECKED_ON}.
          </p>
        )}
      </Section>

      <Section id="learn-more" title="Keep reading">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            href={`/districts?d=${p.code}`}
            className="card p-4 hover:border-accent transition-colors"
          >
            <p className="font-semibold">Charts for {p.name}</p>
            <p className="mt-1 text-sm text-ink-secondary">
              Revenue trends, fund balance and need-vs-funding, interactively.
            </p>
          </Link>
          <Link
            href="/washington-school-funding"
            className="card p-4 hover:border-accent transition-colors"
          >
            <p className="font-semibold">How Washington funds schools</p>
            <p className="mt-1 text-sm text-ink-secondary">
              Where the $21 billion comes from and where it goes.
            </p>
          </Link>
          <Link
            href="/prototypical-school-funding-model"
            className="card p-4 hover:border-accent transition-colors"
          >
            <p className="font-semibold">The prototypical school model</p>
            <p className="mt-1 text-sm text-ink-secondary">
              The formula that turns enrollment into a state allocation.
            </p>
          </Link>
          <Link
            href="/simulator"
            className="card p-4 hover:border-accent transition-colors"
          >
            <p className="font-semibold">Policy Simulator</p>
            <p className="mt-1 text-sm text-ink-secondary">
              Change a funding lever and see what it would cost statewide.
            </p>
          </Link>
          <Link
            href={`/take-action?d=${p.code}`}
            className="card p-4 hover:border-accent transition-colors"
          >
            <p className="font-semibold">Take action</p>
            <p className="mt-1 text-sm text-ink-secondary">
              The legislators for this district and the bills in play.
            </p>
          </Link>
          <Link
            href="/sources"
            className="card p-4 hover:border-accent transition-colors"
          >
            <p className="font-semibold">Sources &amp; methodology</p>
            <p className="mt-1 text-sm text-ink-secondary">
              Every dataset and statute behind these numbers.
            </p>
          </Link>
        </div>
        <p className="mt-6 text-sm text-ink-muted">
          All figures are OSPI actuals for {p.schoolYear}, the most recent school
          year with published F-196 revenue. Browse{' '}
          <Link href="/districts" className="text-accent hover:underline">
            all {DISTRICT_REFS.length} Washington districts and charters
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
