import type { Metadata } from 'next';
import { OVERSIGHT_CHECKED_ON } from '@/data/oversight';

export const metadata: Metadata = {
  title: 'Sources & Methodology',
  description:
    'Every dataset, statute, and court record behind this site, with direct links so all numbers can be cross-verified.',
};

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
    'HB 1664 (2022)',
    'Increased counselor, nurse, and social worker allocations',
    'https://app.leg.wa.gov/billsummary?BillNumber=1664&Year=2021',
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
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        Sources & Methodology
      </h1>
      <p className="mt-3 max-w-2xl text-ink-secondary">
        Every number on this site comes from public data published by
        Washington&apos;s Office of Superintendent of Public Instruction (OSPI)
        or from state law. This page lists the exact sources so you can verify
        anything yourself - no number here is hand-entered or estimated except
        where labeled.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">1 · Enrollment & demographics</h2>
        <p className="mt-2 max-w-2xl text-ink-secondary">
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
        <p className="mt-3 text-sm text-ink-muted max-w-2xl">
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
        <p className="mt-2 max-w-2xl text-ink-secondary">
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
                  <td className="px-4 py-2.5 whitespace-nowrap">{label}</td>
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
            <p className="font-semibold text-ink">Processing rules</p>
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
          <p className="font-semibold text-ink">
            Levies & Local Effort Assistance (the policy simulator)
          </p>
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
            3300. The per-student levy cap has two tiers: $3,838.26 for 2026,
            and $4,505.91 for districts of 40,000 or more FTE students, which
            under RCW 84.52.0531 means Seattle and no one else. Script:{' '}
            <code className="text-ink">scripts/build-levy-lea.py</code>.
          </p>
        </div>

        <div className="mt-4 card p-5 text-sm text-ink-secondary space-y-2">
          <p className="font-semibold text-ink">
            What the state allocation pays for (the 7-step walkthrough)
          </p>
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
            exactly. Script:{' '}
            <code className="text-ink">scripts/build-state-allocation.py</code>.
          </p>
        </div>

        <div className="mt-4 card p-5 text-sm text-ink-secondary space-y-2">
          <p className="font-semibold text-ink">
            Binding conditions &amp; financial oversight
          </p>
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
          <p className="font-semibold text-ink">
            Expenditures, fund balance & reserve ratio
          </p>
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
            ), joined by district code. Reserve ratios below the 4-5% experts
            treat as a safe minimum are flagged on each district profile.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">3 · District boundaries (the map)</h2>
        <p className="mt-2 max-w-2xl text-ink-secondary">
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
          (script: <code className="text-ink">scripts/fetch-boundaries.mjs</code>).
          Boundaries are OSPI&apos;s best interpretation of legal descriptions -
          confirm edge cases with the district itself.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">4 · Law, court records & bills</h2>
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
                  <td className="px-4 py-2.5 whitespace-nowrap">
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
        <h2 className="text-2xl font-bold">5 · Known caveats</h2>
        <ul className="mt-3 max-w-2xl space-y-2 text-ink-secondary text-sm md:text-base list-disc pl-5">
          <li>
            Two enrollment measures are intentional: “Students” is October
            headcount, while per-student funding uses final annual-average
            K-12 plus Running Start funding FTE.
          </li>
          <li>
            General fund only - capital projects, debt service, transportation
            vehicle, and ASB funds are excluded everywhere.
          </li>
          <li>Trend charts show nominal dollars, not inflation-adjusted.</li>
          <li>
            The Policy Simulator is an educational estimate built on statewide
            averages (labeled as such on the page), not a fiscal model.
          </li>
          <li>
            Staffing values in the explainer are the base allocations currently
            in RCW 28A.150.260, including the counselor, nurse, and office
            support increases from HB 1664 (2022) that finished phasing in for
            2024-25. The School Builder shows a subset of the roles the statute
            funds - social workers, psychologists, student-safety staff, and
            parent involvement coordinators are omitted - and excludes
            regionalization, benefits, and every categorical program.
          </li>
        </ul>
      </section>
    </div>
  );
}
