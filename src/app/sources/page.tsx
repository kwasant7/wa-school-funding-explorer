import type { Metadata } from 'next';
import { OVERSIGHT_CHECKED_ON } from '@/data/oversight';
import JsonLd from '@/components/JsonLd';
import {
  breadcrumbJsonLd,
  pageMetadata,
  webPageJsonLd,
} from '@/lib/site-metadata';
import levyData from '@/data/levy.json';

const LEA = levyData.assumptions;
// This page states precise dollars-and-cents figures rather than the rounded
// whole-dollar amounts shown elsewhere on the site - it's the methodology
// page, where the exact statutory figure is the point.
const money2 = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TITLE = 'Sources & Methodology';
const DESCRIPTION =
  'Every dataset, statute, and court record behind this site, with direct links so all numbers can be cross-verified.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/sources/',
});

const ENROLLMENT_YEARS = [
  ['2019-20', 'gtd3-scga'],
  ['2020-21', 'nvpc-yr7b'],
  ['2021-22', 'ymi4-syjv'],
  ['2022-23', 'dij7-mbxg'],
  ['2023-24', 'q4ba-s3jc'],
  ['2024-25', '2rwv-gs2e'],
];

const F196_FILES: [string, string][] = [
  [
    '2019-20 · 2020-21 · 2021-22 (combined)',
    'https://ospi.k12.wa.us/sites/default/files/2023-08/actualsgeneralfundrevenues.csv',
  ],
  [
    '2022-23',
    'https://ospi.k12.wa.us/sites/default/files/2023-12/actualsgeneralfundrevenues-safs3dw_actualsgeneralfundrevenues.csv',
  ],
  [
    '2023-24',
    'https://ospi.k12.wa.us/sites/default/files/2024-12/actualsgeneralfundrevenues2023-24.csv',
  ],
  [
    '2024-25',
    'https://ospi.k12.wa.us/sites/default/files/2025-12/24-25-actuals-general-fund-revenues.csv',
  ],
];

const REVENUE_CODES: [string, string, string][] = [
  ['1000', 'Local taxes (levies)', 'Local'],
  ['2000', 'Local support, non-tax', 'Local'],
  ['3000', 'State, general purpose (apportionment)', 'State'],
  ['4000', 'State, special purpose (categorical programs)', 'State'],
  ['5000', 'Federal, general purpose', 'Federal'],
  ['6000', 'Federal, special purpose (Title I, IDEA…)', 'Federal'],
  ['7000', 'Revenues from other school districts', 'Other'],
  ['8000', 'Revenues from other agencies', 'Other'],
  ['9000', 'Other financing sources (transfers and other inflows)', 'Other'],
];

const LAW_LINKS: [string, string, string][] = [
  [
    'RCW 28A.150.260',
    'Prototypical school sizes, funded class sizes, and staffing allocations used in the explainer and School Builder',
    'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.150.260',
  ],
  [
    'WA Constitution, Art. IX §1',
    'The “paramount duty” clause',
    'https://leg.wa.gov/CodeReviser/Pages/WAConstitution.aspx',
  ],
  [
    'McCleary v. State - court records',
    'All orders in the case: 2012 decision, 2014 contempt, 2015 sanctions, 2018 termination',
    'https://www.courts.wa.gov/appellate_trial_courts/supremecourt/?fa=supremecourt.mccleary_education',
  ],
  [
    'EHB 2242 (2017)',
    'The McCleary funding fix: state salary allocations, state property tax, levy caps',
    'https://app.leg.wa.gov/billsummary?BillNumber=2242&Year=2017',
  ],
  [
    '2SHB 1664 (2022)',
    'Increased counselor, nurse, social worker and psychologist allocations',
    'https://app.leg.wa.gov/billsummary?BillNumber=1664&Year=2022',
  ],
  [
    '2SSB 5882 (2024)',
    'Increased paraeducator and office support staffing allocations',
    'https://app.leg.wa.gov/billsummary?BillNumber=5882&Year=2024',
  ],
  [
    'SB 5263 (2025)',
    'Special education funding increase; removed enrollment cap',
    'https://app.leg.wa.gov/billsummary?BillNumber=5263&Year=2025',
  ],
  [
    'SB 5192 (2025)',
    'MSOC set at $1,614 per student (+~$215 per high schooler)',
    'https://app.leg.wa.gov/billsummary?BillNumber=5192&Year=2025',
  ],
  [
    'HB 2049 (2025)',
    'Raised local enrichment levy caps',
    'https://app.leg.wa.gov/billsummary?BillNumber=2049&Year=2025',
  ],
];

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline break-all"
    >
      {children}
    </a>
  );
}

export default function SourcesPage() {
  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
      <JsonLd
        data={[
          webPageJsonLd({ title: TITLE, description: DESCRIPTION, path: '/sources/' }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: TITLE, path: '/sources/' },
          ]),
        ]}
      />
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        Sources & Methodology
      </h1>
      <p className="mt-3 text-ink-secondary">
        Every number on this site comes from public data published by
        Washington&apos;s Office of Superintendent of Public Instruction (OSPI)
        or from state law. This page lists the exact sources so you can verify
        anything yourself. Three things on this site are not pulled directly
        from a dataset, and are labeled everywhere they appear:
      </p>
      <ul className="mt-2 list-disc pl-5 text-sm text-ink-secondary space-y-1">
        <li>
          The list of districts under state financial oversight is
          hand-transcribed from an OSPI web page that has no downloadable
          dataset, and dated when it was last checked.
        </li>
        <li>
          The policy simulator prices two sliders (special education,
          multilingual learners) using flat statewide dollar constants
          instead of each district&apos;s own cost ratio - disclosed under
          &ldquo;Estimate details and assumptions&rdquo; on that page.
        </li>
        <li>
          The reserve-fund &ldquo;danger line&rdquo; (5% of annual spending)
          is this site&apos;s own judgment call, not a state or GFOA
          standard - GFOA&apos;s published benchmark is about 17%, shown for
          comparison on the District Explorer.
        </li>
      </ul>

      <div className="mt-6 card p-5 md:p-6 bg-accent-wash border-accent-soft">
        <h2 className="text-xl font-bold">See the actual data behind this site</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Every district's enrollment, demographics, and revenue by source, as
          joined from the OSPI files below - the same file this site itself
          reads from.
        </p>
        <a
          href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/data/districts.json`}
          className="mt-2 inline-block font-semibold text-accent hover:underline break-all"
        >
          /data/districts.json →
        </a>
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">1 · Enrollment & demographics</h2>
        <p className="mt-2 text-ink-secondary">
          OSPI &ldquo;Report Card Enrollment&rdquo; datasets on{' '}
          <Ext href="https://data.wa.gov">data.wa.gov</Ext>, one per school
          year. We use district-level, all-grades rows: October headcount plus
          student groups (low income, English language learners, students with
          disabilities, homeless, migrant, highly capable). The same data is
          browsable on OSPI&apos;s{' '}
          <Ext href="https://washingtonstatereportcard.ospi.k12.wa.us">
            Report Card
          </Ext>
          .
        </p>
        <div className="mt-4 card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-secondary border-b border-line">
                <th className="px-4 py-3 font-medium">School year</th>
                <th className="px-4 py-3 font-medium">Browse the dataset</th>
                <th className="px-4 py-3 font-medium">Check our numbers</th>
              </tr>
            </thead>
            <tbody>
              {ENROLLMENT_YEARS.map(([year, id]) => (
                <tr key={id} className="border-t border-line">
                  <td className="px-4 py-2.5 whitespace-nowrap">{year}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Ext href={`https://data.wa.gov/d/${id}`}>
                      Report Card Enrollment {year} ↗
                    </Ext>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Ext
                      href={`https://data.wa.gov/resource/${id}.csv?organizationlevel=District&gradelevel=All%20Grades&%24limit=2000`}
                    >
                      download the exact rows we use (CSV) ↓
                    </Ext>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink-muted">
          &ldquo;The exact rows we use&rdquo; = each district&apos;s one
          district-total row (all grades combined) - the same filter our data
          script applies. Open it in any spreadsheet app and compare against
          this site&apos;s numbers directly.
        </p>
        <div className="mt-5 card p-5 md:p-6 grid gap-x-8 gap-y-3 md:grid-cols-3">
          <h3 className="font-semibold md:col-span-3">
            Why two enrollment numbers?
          </h3>
          <p className="text-sm text-ink-secondary">
            Student counts across the site are OSPI&apos;s final annual-average
            funding FTE from the P-223/P-223RS system - the same measure the
            per-student dollar figures divide by, so the two always agree.
            Part-time participation, including Running Start, is counted at its
            reported FTE instead of automatically as one full student.
          </p>
          <p className="text-sm text-ink-secondary">
            The Report Card&apos;s October headcount is still used where a
            headcount is the right unit: the enrollment trend chart on each
            district page, and the demographic shares (low income, multilingual,
            special education) which are reported as counts of students, not
            FTE. Those will not match the FTE totals exactly.
          </p>
          <p className="text-sm text-ink-secondary">
            The denominator is the workbook&apos;s K-12 FTE (including ALE) plus
            separately reported Running Start-at-college FTE. See the{' '}
            <Ext href="https://ospi.k12.wa.us/sites/default/files/2024-11/historical-enrollment-summary-2001-02.xlsx">
              Final Enrollment Summary workbook
            </Ext>{' '}
            and OSPI&apos;s{' '}
            <Ext href="https://ospi.k12.wa.us/policy-funding/school-apportionment/guidance-and-tools/enrollment-reporting">
              enrollment reporting guidance
            </Ext>
            . We also retain the K-3, grades 4-6, grades 7-8, and grades 9-12
            subtotals to personalize the prototypical-school explainer, and show
            Running Start college FTE separately rather than as an on-campus
            model school.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">2 · District finances (F-196)</h2>
        <p className="mt-2 text-ink-secondary">
          The F-196 is the year-end financial report every district, charter,
          and tribal-compact school files with OSPI. Raw CSVs come from the{' '}
          <Ext href="https://ospi.k12.wa.us/safs-data-files">
            SAFS Data Files page
          </Ext>{' '}
          (&ldquo;Actuals - General Fund Revenues&rdquo;). Revenue account codes
          are defined in the official{' '}
          <Ext href="https://ospi.k12.wa.us/sites/default/files/2025-03/f-196_item_map_and_dictionary.pdf">
            F-196 item map & dictionary (PDF)
          </Ext>
          ; district totals can be cross-checked against OSPI&apos;s{' '}
          <Ext href="https://ospi.k12.wa.us/policy-funding/school-apportionment/school-publications/financial-reporting-summary">
            Financial Reporting Summary
          </Ext>
          .
        </p>
        <div className="mt-4 card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-secondary border-b border-line">
                <th className="px-4 py-3 font-medium">School year(s)</th>
                <th className="px-4 py-3 font-medium">Direct CSV download</th>
              </tr>
            </thead>
            <tbody>
              {F196_FILES.map(([label, url]) => (
                <tr key={url} className="border-t border-line">
                  <td className="px-4 py-2.5">{label}</td>
                  <td className="px-4 py-2.5">
                    <Ext href={url}>{url.split('/').pop()}</Ext>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid md:grid-cols-2 gap-4 items-start">
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="text-left px-4 pt-3 pb-1 text-sm font-semibold">
                How we categorize revenue codes
              </caption>
              <thead>
                <tr className="text-left text-ink-secondary border-b border-line">
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-4 py-2 font-medium">F-196 meaning</th>
                  <th className="px-4 py-2 font-medium">Shown as</th>
                </tr>
              </thead>
              <tbody>
                {REVENUE_CODES.map(([code, meaning, cat]) => (
                  <tr key={code} className="border-t border-line">
                    <td className="px-4 py-2 tabular-nums">{code}</td>
                    <td className="px-4 py-2 text-ink-secondary">{meaning}</td>
                    <td className="px-4 py-2">{cat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card p-5 text-sm text-ink-secondary space-y-2">
            <h3 className="text-base font-bold text-ink">Processing rules</h3>
            <p>
              Total funding = codes 1000-9000, general fund only. Code 9000
              is included in “Other” so totals reconcile to OSPI&apos;s full
              general-fund revenue and other-financing-source presentation.
            </p>
            <p>
              Finances, October headcount, and funding FTE join on the 5-digit
              county-district code. Each year ~10-14 enrollment rows (mostly
              tribal-compact schools) have no F-196 filing and are omitted.
            </p>
            <p>
              The whole pipeline is one open-source script -{' '}
              <code className="text-ink">scripts/fetch-data.mjs</code> in the
              site&apos;s repository - that downloads the files above and
              re-derives everything.
            </p>
          </div>
        </div>

        <div className="mt-4 card p-5 text-sm text-ink-secondary space-y-2">
          <h3 className="text-base font-bold text-ink">
            Levies & Local Effort Assistance (the policy simulator)
          </h3>
          <p>
            The simulator&apos;s levy and LEA sliders run Washington&apos;s
            actual formula on real district data. Assessed valuation,
            voter-approved levy amounts, LEA enrollment, and the statutory
            assumptions (the per-student guarantee, the $1.50 LEA rate, and the
            $2.50 / per-student levy caps) come from OSPI&apos;s{' '}
            <Ext href="https://ospi.k12.wa.us/policy-funding/school-apportionment/budget-preparations">
              Enrichment Levy Pre-Ballot Approval worksheet
            </Ext>{' '}
            on the School Apportionment budget-preparations page. Our
            calculation reproduces that workbook&apos;s LevyCalc sheet
            (capacity per pupil, maximum LEA per pupil, levy rate, and payable
            LEA), and the LEA a district actually received is F-196 revenue code
            3300. The per-student levy cap has two tiers:{' '}
            {money2(LEA.maxLevyPerPupil)} for {levyData.calendarYear}, and{' '}
            {money2(LEA.maxLevyPerPupilLarge)} for districts of 40,000 or more
            FTE students, which under RCW 84.52.0531 means Seattle and no one
            else. The voter-approved levy amounts are OSPI&apos;s{' '}
            {levyData.calendarYear} column, final as of June 26, 2026, so they
            include the results of the February 10 and April 28, 2026 levy
            elections. Script:{' '}
            <code className="text-ink">scripts/build-levy-lea.py</code>.
          </p>
        </div>

        <div className="mt-4 card p-5 text-sm text-ink-secondary space-y-2">
          <h3 className="text-base font-bold text-ink">
            What districts actually spend (the simulator&apos;s comparison lines)
          </h3>
          <p>
            The &ldquo;what they actually spend&rdquo; markers on the special
            education, MSOC, and transportation sliders come from the{' '}
            <Ext href="https://ospi.k12.wa.us/safs-data-files">
              Actuals - General Fund Expenditures
            </Ext>{' '}
            CSV for 2024-25, broken out by the F-196 Program and Object
            dimensions. Special education is the{' '}
            <strong className="text-ink">state</strong> programs 21, 22 and 26
            divided by the October headcount of students with disabilities -
            program 24 is the federally funded IDEA supplemental program and is
            left out, because this figure is compared against the state
            allocation and counting federal spending on the cost side would
            report federal grant money as money the district paid;
            transportation is
            program 99 divided by headcount enrollment; MSOC follows the
            definition in the Superintendent of Public Instruction&apos;s 2026
            budget request - the same scope behind{' '}
            <Ext href="https://www.waschoolfunding.org/">
              AESD&apos;s Big 3 dashboard
            </Ext>
            : non-staff objects across basic education, career and technical
            education, and the categorical programs, excluding items that are
            not operating costs (contracted student transportation, tuition,
            debt, judgments, land and building improvements) and netting out
            non-high payments - divided by funding FTE. This site&apos;s MSOC
            figures reproduce that dashboard&apos;s 2024-25 expenditures to the
            cent for 284 of 315 districts (the rest differ only in a non-high
            payment form OSPI does not publish). All three
            are <strong className="text-ink">general fund only</strong>, so
            transportation excludes buses bought through the Transportation
            Vehicle Fund. Script:{' '}
            <code className="text-ink">scripts/build-program-spending.mjs</code>.
          </p>
        </div>

        <div className="mt-4 card p-5 text-sm text-ink-secondary space-y-2">
          <h3 className="text-base font-bold text-ink">
            What the state allocation pays for (the 7-step walkthrough)
          </h3>
          <p>
            The breakdown of a district&apos;s state allocation into salaries,
            benefits, materials and operating costs, special education,
            transportation and the categorical programs comes from OSPI&apos;s{' '}
            <Ext href="https://ospi.k12.wa.us/safs-data-files">
              Apportionment Final Extract
            </Ext>{' '}
            for 2024-25 - the data behind the 1191 Apportionment Summary each
            district receives. Salaries, benefits and MSOC come from the
            workbook&apos;s Basic Ed sheet; special education, transportation,
            multilingual, learning assistance, highly capable, food and levy
            equalization come from an explicit allowlist of revenue codes,
            deliberately not every 3xxx/4xxx code - some, like 4100, can also
            carry multi-year school-construction capital grants that do not
            belong in a general-fund figure. &ldquo;Other state
            programs&rdquo; is defined as whatever remains after subtracting
            every named category from the district&apos;s actual F-196 state
            general-fund revenue, so the total always ties out to that figure
            exactly. The MSOC <em>funding</em> figure used in the gap
            comparisons additionally counts career-and-technical and
            alternative-learning MSOC, per the budget-request definition above;
            the walkthrough&apos;s split keeps the general-education line so it
            still sums to the 3100 apportionment. Script:{' '}
            <code className="text-ink">scripts/build-state-allocation.py</code>.
          </p>
        </div>

        <div className="mt-4 card p-5 text-sm text-ink-secondary space-y-2">
          <h3 className="text-base font-bold text-ink">
            Binding conditions &amp; financial oversight
          </h3>
          <p>
            Districts flagged as being on binding conditions or under enhanced
            state oversight are transcribed by hand from OSPI&apos;s{' '}
            <Ext href="https://ospi.k12.wa.us/policy-funding/school-apportionment/guidance-and-tools/school-district-budget-challenges-and-financial-insolvency">
              School District Budget Challenges and Financial Insolvency
            </Ext>{' '}
            page, which publishes a letter per district rather than a
            machine-readable list. The status shown here was checked on{' '}
            <strong className="text-ink">{OVERSIGHT_CHECKED_ON}</strong>; check
            that page for anything more recent.
          </p>
        </div>

        <div className="mt-4 card p-5 text-sm text-ink-secondary space-y-2">
          <h3 className="text-base font-bold text-ink">
            Expenditures, fund balance & reserve ratio
          </h3>
          <p>
            Total spending comes from the parallel &ldquo;Actuals - General Fund
            Expenditures&rdquo; CSVs on the same{' '}
            <Ext href="https://ospi.k12.wa.us/safs-data-files">SAFS page</Ext>.
            The yearly surplus / (deficit) shown on each district is simply
            revenue minus spending - the change in the fund balance.
          </p>
          <p>
            The <strong className="text-ink">ending fund balance</strong> (a
            district&apos;s savings on hand) and the{' '}
            <strong className="text-ink">reserve ratio</strong> (fund balance ÷
            spending) are not in OSPI&apos;s bulk revenue/expenditure CSVs, so
            they come from the state&apos;s own statewide school-finance workbook,{' '}
            <Ext href="https://fiscal.wa.gov/K12/WSFCurrent.xlsm">
              WSFCurrent.xlsm
            </Ext>{' '}
            (the download behind{' '}
            <Ext href="https://fiscal.wa.gov/K12/K12FinanceDistrict">
              fiscal.wa.gov&apos;s K-12 finance page
            </Ext>
            ), joined by district code. Reserve ratios below{' '}
            <strong className="text-ink">5%</strong> are flagged on each district
            profile. That threshold is this site&apos;s own editorial choice, not
            a statutory or professional standard: it reflects Washington
            school-finance practice and OSPI&apos;s budget-challenge process, and
            it is deliberately conservative next to the Government Finance
            Officers Association&apos;s general guideline of two months of
            operating spending, about 17%. Almost every Washington district
            clears 5%; almost none clears 17%.
            Script: <code className="text-ink">scripts/build-fund-balance.py</code>.
          </p>
        </div>

        <div className="mt-4 card p-5 text-sm text-ink-secondary space-y-2">
          <h3 className="text-base font-bold text-ink">Translations</h3>
          <p>
            The non-English versions of this site&apos;s interface text are
            machine translations, generated once at build time via Google
            Translate and checked into the repository (script:{' '}
            <code className="text-ink">scripts/build-translations.mjs</code>).
            No data values are translated - only labels and explanatory copy -
            and no text is sent anywhere while you browse. Machine translation
            makes mistakes, so the English wording is the authoritative version
            of any claim on this site.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">3 · District boundaries (the map)</h2>
        {/*
          Full-bleed card with the prose in columns: the section fills the page
          like the table sections above it, without stretching a single line of
          text to 180 characters.
        */}
        <div className="mt-4 card p-5 md:p-6 grid gap-x-8 gap-y-3 md:grid-cols-2 text-ink-secondary">
          <p>
            The map on the District Explorer uses OSPI&apos;s official{' '}
            <Ext href="https://geo.wa.gov/datasets/72ad21c67ecf4f21bc794d4d21485d86_0">
              Washington School Districts boundary layer
            </Ext>{' '}
            from the state geoportal (geo.wa.gov), fetched from its public{' '}
            <Ext href="https://services9.arcgis.com/fWunDXKkvCx1CM4b/arcgis/rest/services/Washington_School_Districts/FeatureServer/0">
              ArcGIS FeatureServer
            </Ext>
            . Shapes are simplified to ~200&nbsp;m tolerance for fast loading and
            joined to funding data by each district&apos;s 5-digit OSPI code
            (script:{' '}
            <code className="text-ink">scripts/fetch-boundaries.mjs</code>).
            Boundaries are OSPI&apos;s best interpretation of legal descriptions
            - confirm edge cases with the district itself.
          </p>
          <p>
            District boundaries are legal descriptions that run miles into
            Puget Sound and the large lakes, so the script clips every
            district to land before drawing - the shapes you see follow the
            shoreline, not the underwater legal boundary. The shoreline comes
            from the{' '}
            <Ext href="https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2023/State_County/MapServer">
              Census Bureau&apos;s cartographic state boundary
            </Ext>{' '}
            and the lakes from{' '}
            <Ext href="https://geodataservices.wdfw.wa.gov/arcgis/rest/services/FP_Projects/NHDwithLLID/MapServer/0">
              WDFW&apos;s NHD hydrography service
            </Ext>
            ; no funding data is joined to either.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">4 · Legislators (Take Action)</h2>
        <div className="mt-4 card p-5 md:p-6 grid gap-x-8 gap-y-3 md:grid-cols-2 text-ink-secondary">
          <p>
            The delegation shown for a school district is every legislative
            district that overlaps it, found by overlaying OSPI&apos;s school
            district boundaries on the{' '}
            <Ext href="https://services.arcgis.com/bCYnGqM4FMTBSjd1/arcgis/rest/services/Washington_State_Legislative_Districts_2024/FeatureServer/0">
              2024 Washington State Legislative Districts
            </Ext>{' '}
            layer and sampling a grid of points inside each school district. The
            percentage shown is the share of sampled points - an approximation
            of <strong className="text-ink">area, not population</strong> - and
            overlaps under 2% are dropped as boundary slivers.
          </p>
          <p>
            Member names, parties, chambers, and links come from the
            Legislature&apos;s{' '}
            <Ext href="https://leg.wa.gov/legislators/">official roster</Ext>,
            and portraits from{' '}
            <Ext href="https://leg.wa.gov/legislators/">
              leg.wa.gov/memberphoto
            </Ext>{' '}
            (Legislative Support Services). Scripts:{' '}
            <code className="text-ink">scripts/fetch-legislators.mjs</code> and{' '}
            <code className="text-ink">scripts/fetch-legislator-photos.py</code>.
            Because school and legislative boundaries do not line up, always
            confirm your own representation with{' '}
            <Ext href="https://app.leg.wa.gov/DistrictFinder/">
              the Legislature&apos;s District Finder
            </Ext>
            .
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">5 · Law, court records & bills</h2>
        <div className="mt-4 card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-secondary border-b border-line">
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Used for</th>
              </tr>
            </thead>
            <tbody>
              {LAW_LINKS.map(([name, use, url]) => (
                <tr key={name} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <Ext href={url}>{name}</Ext>
                  </td>
                  <td className="px-4 py-2.5 text-ink-secondary">{use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 mb-4">
        <h2 className="text-2xl font-bold">6 · Known caveats</h2>
        <div className="mt-4 card p-5 md:p-6">
          {/* CSS columns rather than a grid: the caveats vary a lot in length,
              so letting them flow balances the two columns automatically. */}
          <ul className="space-y-3 text-ink-secondary text-sm md:text-base list-disc pl-5 md:columns-2 md:gap-10">
            <li className="break-inside-avoid">
              Two enrollment measures are in play. Student counts and
              per-student funding both use final annual-average K-12 plus
              Running Start funding FTE. The Report Card&apos;s October
              headcount is used only where a headcount is the right unit: the
              enrollment trend chart and the demographic shares.
            </li>
            <li className="break-inside-avoid">
              General fund only - capital projects, debt service, transportation
              vehicle, and ASB funds are excluded everywhere.
            </li>
            <li className="break-inside-avoid">
              Trend charts show nominal dollars, not inflation-adjusted.
            </li>
            <li className="break-inside-avoid">
              The Policy Simulator is an educational estimate built on statewide
              averages (labeled as such on the page), not a fiscal model.
            </li>
            <li className="break-inside-avoid">
              Staffing values in the explainer are the allocations currently in
              RCW 28A.150.260, including the counselor, nurse, social worker and
              psychologist increases from 2SHB 1664 (2022) that finished phasing
              in for 2024-25, and the paraeducator and office support increases
              from 2SSB 5882 (2024). Teacher counts apply the planning-time
              factor OSPI adds on top of the funded class size - 15.5% in K-6
              and 20% in grades 7-12 - so students per funded teacher is lower
              than the class size. The School Builder shows all eleven staff
              roles the statute funds at the school level, but not the
              district-wide tier, and excludes regionalization, benefits, and
              every categorical program.
            </li>
            <li className="break-inside-avoid">
              Translations of the interface are machine-generated. Data values
              and proper nouns - district names, county names, legislator names
              - are never translated, and the English wording is the
              authoritative version of any claim here.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
