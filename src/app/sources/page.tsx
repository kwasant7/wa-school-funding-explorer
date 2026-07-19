import type { Metadata } from 'next';

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
  ['9000', 'Other financing sources (bonds, transfers)', 'Excluded'],
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
    'McCleary v. State — court records',
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
        anything yourself — no number here is hand-entered or estimated except
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
                <th className="px-4 py-3 font-medium">Dataset</th>
                <th className="px-4 py-3 font-medium">API query used</th>
              </tr>
            </thead>
            <tbody>
              {ENROLLMENT_YEARS.map(([year, id]) => (
                <tr key={id} className="border-t border-line">
                  <td className="px-4 py-2.5 whitespace-nowrap">{year}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Ext href={`https://data.wa.gov/d/${id}`}>{id}</Ext>
                  </td>
                  <td className="px-4 py-2.5 text-ink-secondary">
                    <Ext
                      href={`https://data.wa.gov/resource/${id}.json?organizationlevel=District&gradelevel=All%20Grades`}
                    >
                      /resource/{id}.json · District · All Grades
                    </Ext>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          (&ldquo;Actuals — General Fund Revenues&rdquo;). Revenue account codes
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
                    <td className={`px-4 py-2 ${cat === 'Excluded' ? 'text-ink-muted' : ''}`}>
                      {cat}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card p-5 text-sm text-ink-secondary space-y-2">
            <p className="font-semibold text-ink">Processing rules</p>
            <p>
              Total revenues = codes 1000–8000, general fund only. Code 9000
              (bonds, transfers) is excluded because it isn&apos;t operating
              revenue.
            </p>
            <p>
              Finances join to enrollment on the 5-digit county-district code.
              Each year ~10–14 enrollment rows (mostly tribal-compact schools)
              have no F-196 filing and are omitted for that year.
            </p>
            <p>
              The whole pipeline is one open-source script —{' '}
              <code className="text-ink">scripts/fetch-data.mjs</code> in the
              site&apos;s repository — that downloads the files above and
              re-derives everything.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">3 · Law, court records & bills</h2>
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
        <h2 className="text-2xl font-bold">4 · Known caveats</h2>
        <ul className="mt-3 max-w-2xl space-y-2 text-ink-secondary text-sm md:text-base list-disc pl-5">
          <li>
            Per-student figures divide general-fund revenues by October
            headcount; OSPI&apos;s official per-pupil statistics use annual
            average FTE, so ours run slightly lower but are consistent across
            districts.
          </li>
          <li>
            General fund only — capital projects, debt service, transportation
            vehicle, and ASB funds are excluded everywhere.
          </li>
          <li>Trend charts show nominal dollars, not inflation-adjusted.</li>
          <li>
            The Policy Simulator is an educational estimate built on statewide
            averages (labeled as such on the page), not a fiscal model.
          </li>
          <li>
            Staffing values in the explainer are base statutory values from RCW
            28A.150.260; the Legislature has enriched some since (e.g., HB
            1664).
          </li>
        </ul>
      </section>
    </div>
  );
}
