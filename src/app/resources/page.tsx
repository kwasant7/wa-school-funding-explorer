import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import {
  breadcrumbJsonLd,
  pageMetadata,
  webPageJsonLd,
} from '@/lib/site-metadata';

const TITLE = 'Resources';
const DESCRIPTION =
  'Official sources, legislative tools, and advocacy groups for researching and taking part in Washington school-funding decisions.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/resources/',
});

const RESOURCE_GROUPS = [
  {
    title: 'Understand the money',
    description:
      'Start with official explanations and the budget documents that control actual appropriations.',
    links: [
      {
        label: "Citizen's Guide to K-12 Finance",
        detail: 'A plain-language guide from Washington legislative staff.',
        url: 'https://leg.wa.gov/media/jyxir1tw/citizens-guide-to-k-12-financing-2024.pdf',
      },
      {
        label: 'OSPI: Understanding Public School Funding',
        detail: 'State, local, and federal funding explained by OSPI.',
        url: 'https://ospi.k12.wa.us/policy-funding/legislative-priorities/understanding-public-school-funding',
      },
      {
        label: 'Washington state budget',
        detail: 'Enacted budgets, proposals, comparisons, and fiscal reports.',
        url: 'https://fiscal.wa.gov/statebudgets/operatingbudgetmain',
      },
    ],
  },
  {
    title: 'Follow a bill',
    description:
      'Read the actual bill, check its history, watch hearings, and see upcoming committee meetings.',
    links: [
      {
        label: 'Bill Information',
        detail: 'Search official bill pages, documents, amendments, and votes.',
        url: 'https://app.leg.wa.gov/billinfo/',
      },
      {
        label: 'Committee meeting schedules',
        detail: 'Find hearings before the testimony sign-in deadline.',
        url: 'https://leg.wa.gov/bills-meetings-and-session/meetings/',
      },
      {
        label: 'How to testify',
        detail: 'Official instructions for remote, in-person, and written testimony.',
        url: 'https://leg.wa.gov/bills-meetings-and-session/session/how-to-testify-at-a-committee-meeting/',
      },
    ],
  },
  {
    title: 'Check the underlying data',
    description:
      'Use the same primary sources behind this site and inspect district-level details.',
    links: [
      {
        label: 'OSPI School Apportionment guidance',
        detail: 'Enrollment reporting, allocation tools, and district guidance.',
        url: 'https://ospi.k12.wa.us/policy-funding/school-apportionment/guidance-and-tools',
      },
      {
        label: 'OSPI SAFS data files',
        detail: 'Download district financial and enrollment files.',
        url: 'https://ospi.k12.wa.us/safs-data-files',
      },
      {
        label: 'Washington Report Card',
        detail: 'Enrollment, demographics, assessment, and school information.',
        url: 'https://washingtonstatereportcard.ospi.k12.wa.us/',
      },
    ],
  },
  {
    title: 'Compare advocacy perspectives',
    description:
      'These organizations advocate for particular priorities. Compare their claims with primary sources.',
    links: [
      {
        label: 'League of Education Voters',
        detail: '2026 priorities and a statewide education bill tracker.',
        url: 'https://educationvoters.org/2026-legislative-platform/',
      },
      {
        label: 'Washington State PTA advocacy',
        detail: 'Family-led priorities, positions, and advocacy tools.',
        url: 'https://www.wastatepta.org/focus-areas/advocacy/',
      },
      {
        label: 'State Board of Education priorities',
        detail: 'The appointed state board’s current policy platform.',
        url: 'https://sbe.wa.gov/our-work/legislative-priorities',
      },
      {
        label: 'Association of Washington School Principals',
        detail: 'Funding and policy priorities from school leaders.',
        url: 'https://awsp.org/advocate/the-awsp-legislative-platform/',
      },
    ],
  },
  {
    title: 'Youth participation',
    description:
      'Young people can testify, organize, and advise state government before they are old enough to vote.',
    links: [
      {
        label: 'Legislative Youth Advisory Council',
        detail: 'Washington’s official student-led youth advisory body.',
        url: 'https://www.ltgov.wa.gov/legislative-youth-advisory-council',
      },
      {
        label: 'Youth in Action',
        detail:
          'League of Education Voters hub for students organizing on education policy.',
        url: 'https://hub.educationvoters.org/youth-in-action/',
      },
      {
        label: 'Legislature civic education programs',
        detail: 'Pages, internships, classroom materials, and other ways to participate.',
        url: 'https://leg.wa.gov/learn-and-participate/civic-education-programs/',
      },
    ],
  },
] as const;

export default function ResourcesPage() {
  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
      <JsonLd
        data={[
          webPageJsonLd({ title: TITLE, description: DESCRIPTION, path: '/resources/' }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: TITLE, path: '/resources/' },
          ]),
        ]}
      />
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        Keep researching and participating
      </h1>
      <p className="mt-3 text-ink-secondary">
        Use official sources to verify facts, then compare the priorities of
        groups participating in the debate. Advocacy organizations are labeled
        separately because they argue for particular outcomes.
      </p>

      <section data-assistant-section="resources" className="mt-8">
        <div className="space-y-8">
          {RESOURCE_GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-xl font-bold">{group.title}</h2>
              <p className="mt-1 text-sm text-ink-secondary">
                {group.description}
              </p>
              <div className="mt-3 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card p-4 hover:border-accent transition-colors group"
                  >
                    <span className="font-semibold text-accent group-hover:underline">
                      {link.label} ↗
                    </span>
                    <span className="mt-1 block text-sm text-ink-secondary">
                      {link.detail}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
