'use client';

import { useEffect, useMemo, useState } from 'react';
import CopyBlock from '@/components/CopyBlock';
import data from '@/data/districts.json';
import representation from '@/data/legislators.json';

const SELECTED_DISTRICT_KEY = 'wa-selected-district';

const EMAIL_TEMPLATE = `Subject: A constituent's perspective on K-12 school funding

Dear [Senator/Representative Last Name],

My name is [YOUR NAME], and I'm a [student/parent/community member] in [YOUR SCHOOL DISTRICT].

I'm writing about K-12 school funding. [ONE OR TWO SENTENCES ABOUT WHAT YOU'VE SEEN FIRSTHAND - a counselor shared across three schools, outdated materials, a program cut, or a class of 32.]

Washington's funding formula currently [PICK YOUR ISSUE: does not fully cover special education costs / leaves transportation gaps / has not kept operating-cost funding level with district expenses].

I'm asking you to [YOUR ASK: name a policy change or bill you want supported].

Students notice these gaps every day, and we vote - now or soon.

Thank you for your time and your service.

[YOUR NAME]
[YOUR CITY], WA
[YOUR SCHOOL OR DISTRICT]`;

const TESTIMONY_TEMPLATE = `Good [morning/afternoon], Chair [NAME] and members of the committee.

For the record, my name is [YOUR NAME], and I am a [student at X high school / parent in Y district / resident of Z].

I am testifying [in support of / with concerns about] [BILL NUMBER].

[YOUR STORY - 2 to 3 sentences. What have you personally seen? Specific beats general.]

[YOUR ASK - 1 sentence. What do you want the committee to do?]

Thank you.`;

const PASSED_BILLS = [
  {
    bill: 'ESSB 5998',
    name: '2026 supplemental operating budget',
    status: 'Signed April 1, 2026',
    summary:
      'Revised the state budget that pays for public-school operations, including general apportionment, transportation, special education, food service, and statewide programs.',
    significance:
      'This is where policy becomes actual dollars. Even when a separate funding bill fails, an idea can still receive, lose, or change funding through the operating budget.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5998&Year=2025',
  },
  {
    bill: 'ESSB 6260',
    name: 'Public education funding changes',
    status: 'Signed - Chapter 267, Laws of 2026',
    summary:
      'Changed school-bus depreciation rules, limited Transition to Kindergarten funding, and reduced the combined maximum funded Running Start enrollment from 1.4 FTE under the conditions written into the law.',
    significance:
      'The major standalone funding law of 2026 focused mostly on savings and eligibility rules, so some districts may receive less than they would have under the previous formulas.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=6260&Year=2025',
  },
] as const;

const DID_NOT_PASS_BILLS = [
  {
    bill: 'SB 5858',
    name: 'Transportation safety net',
    status: 'Stopped in Senate Ways & Means',
    summary:
      'Would have put a transportation safety-net program into law for excess costs serving students with disabilities, students experiencing homelessness, and students in foster care.',
    significance:
      'Those students can require expensive individualized routes. Without a permanent statutory safety net, districts remain more dependent on whatever the budget funds.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5858&Year=2025',
  },
  {
    bill: 'SSB 5918',
    name: 'MSOC increase',
    status: 'Stopped in Senate Ways & Means',
    summary:
      'Would have added $100 per student, or at least $100,000 per district, for materials, supplies, utilities, insurance, technology, and other operating costs.',
    significance:
      'The proposal directly targeted the gap between the formula and real operating expenses. Its failure left the scheduled inflation-adjusted MSOC formula in place without this extra increase.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5918&Year=2025',
  },
  {
    bill: 'SB 6125',
    name: 'Enrollment stabilization',
    status: 'Stopped in Senate Early Learning & K-12 Education',
    summary:
      'Would have temporarily protected local education agencies from sharp state-revenue losses when enrollment declined below 2025-26 levels.',
    significance:
      'District costs do not fall as quickly as enrollment. Stabilization funding would have given districts more time to adjust staffing and programs instead of making immediate cuts.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=6125&Year=2025',
  },
  {
    bill: 'SB 6310',
    name: 'Utilities and insurance costs',
    status: 'Stopped in Senate Early Learning & K-12 Education',
    summary:
      'Would have changed district allocations for utilities and insurance, two operating expenses that can vary sharply by location and building portfolio.',
    significance:
      'A statewide per-student amount can miss large local cost differences. The bill raised that problem but did not advance beyond its first committee.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=6310&Year=2025',
  },
  {
    bill: 'E2SHB 2636',
    name: 'Public education system review',
    status: 'Passed the House; stopped before a Senate vote',
    summary:
      'Would have created a steering committee and directed independent reviews of public-education performance, operations, and funding.',
    significance:
      'It would not have immediately added classroom dollars, but it could have shaped a broader redesign of the funding system using independent analysis.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=2636&Year=2025',
  },
] as const;

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
        label: 'Legislature civic education programs',
        detail: 'Pages, internships, classroom materials, and other ways to participate.',
        url: 'https://leg.wa.gov/learn-and-participate/civic-education-programs/',
      },
    ],
  },
] as const;

type DistrictCode = keyof typeof representation.schoolDistricts;

function BillCard({
  bill,
  passed,
}: {
  bill: (typeof PASSED_BILLS)[number] | (typeof DID_NOT_PASS_BILLS)[number];
  passed: boolean;
}) {
  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <a
            href={bill.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-lg text-accent hover:underline"
          >
            {bill.bill}
          </a>
          <p className="text-sm font-medium">{bill.name}</p>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            passed
              ? 'bg-accent-wash text-accent-deep'
              : 'bg-paper text-ink-secondary'
          }`}
        >
          {passed ? 'Passed' : 'Did not pass'}
        </span>
      </div>
      <p className="mt-3 text-sm text-ink-secondary">{bill.summary}</p>
      <div className="mt-3 pt-3 border-t border-line">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Why it matters
        </p>
        <p className="mt-1 text-sm text-ink-secondary">{bill.significance}</p>
      </div>
      <p className="mt-3 text-xs text-ink-muted">{bill.status}</p>
    </article>
  );
}

export default function TakeAction() {
  const [selectedCode, setSelectedCode] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem(SELECTED_DISTRICT_KEY);
    if (saved && data.districts.some((district) => district.code === saved)) {
      setSelectedCode(saved);
    }
  }, []);

  const districts = useMemo(
    () => [...data.districts].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );
  const selectedDistrict = districts.find(
    (district) => district.code === selectedCode
  );
  const match =
    representation.schoolDistricts[selectedCode as DistrictCode] ?? null;
  const legislators = match
    ? representation.legislators[
        String(match.legislativeDistrict) as keyof typeof representation.legislators
      ]
    : null;
  const personalizedEmail = selectedDistrict
    ? EMAIL_TEMPLATE.replace('[YOUR SCHOOL DISTRICT]', selectedDistrict.name)
    : EMAIL_TEMPLATE;

  const chooseDistrict = (code: string) => {
    setSelectedCode(code);
    if (code) {
      window.localStorage.setItem(SELECTED_DISTRICT_KEY, code);
    } else {
      window.localStorage.removeItem(SELECTED_DISTRICT_KEY);
    }
  };

  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        Take Action
      </h1>
      <p className="mt-3 max-w-3xl text-ink-secondary">
        Start with the lawmakers connected to your school district, understand
        what happened to major funding bills in 2026, and turn your own school
        experience into a specific request.
      </p>

      <section className="mt-8 card p-5 md:p-6 bg-accent-wash border-accent-soft">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">
              Your Olympia delegation
            </h2>
            <p className="mt-1 text-sm text-ink-secondary max-w-2xl">
              Choose a school district. If you selected one elsewhere on this
              site, it will already be filled in.
            </p>
          </div>
          <label className="text-sm font-medium text-ink-secondary">
            School district
            <select
              value={selectedCode}
              onChange={(event) => chooseDistrict(event.target.value)}
              className="mt-1 block w-full md:w-80 card px-3 py-2 text-base text-ink"
            >
              <option value="">Choose a district</option>
              {districts.map((district) => (
                <option key={district.code} value={district.code}>
                  {district.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedDistrict && match && legislators ? (
          <div className="mt-5">
            <p className="text-sm text-ink-secondary">
              <strong className="text-ink">{selectedDistrict.name}</strong> is
              centered in Washington Legislative District{' '}
              <strong className="text-ink">{match.legislativeDistrict}</strong>.
            </p>
            <div className="mt-3 grid md:grid-cols-3 gap-3">
              {legislators.map((legislator) => (
                <article key={legislator.name} className="card p-4 bg-surface">
                  <p className="text-xs uppercase tracking-wide text-ink-muted">
                    {legislator.chamber}
                  </p>
                  <h3 className="mt-1 font-bold text-lg">{legislator.name}</h3>
                  <p className="text-sm text-ink-secondary">
                    {legislator.party} · District{' '}
                    {match.legislativeDistrict}
                  </p>
                  <a
                    href={legislator.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
                  >
                    Contact and official profile ↗
                  </a>
                </article>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-accent-soft text-sm text-ink-secondary">
              School and legislative boundaries do not line up exactly. These
              lawmakers represent the legislative district containing the
              school district&apos;s official geographic center.{' '}
              <a
                href="https://app.leg.wa.gov/DistrictFinder/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent hover:underline"
              >
                Verify your exact delegation with your home address ↗
              </a>
            </div>
          </div>
        ) : selectedDistrict ? (
          <div className="mt-5 card p-4 bg-surface">
            <p className="font-semibold">
              This school does not have an OSPI district boundary match.
            </p>
            <p className="mt-1 text-sm text-ink-secondary">
              Charter and state-tribal compact schools may serve students across
              many legislative districts.{' '}
              <a
                href="https://app.leg.wa.gov/DistrictFinder/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent hover:underline"
              >
                Verify your lawmakers with your home address ↗
              </a>
            </p>
          </div>
        ) : (
          <p className="mt-5 text-sm font-medium text-accent-deep">
            Choose a district to see its senator and two representatives.
          </p>
        )}
      </section>

      <ol className="mt-8 grid md:grid-cols-3 gap-4">
        {[
          {
            title: 'Pick one clear ask',
            body: 'Choose one funding issue and say what you want changed. A focused request is easier to answer and remember.',
          },
          {
            title: 'Write from experience',
            body: 'Use a real example from your school. A specific story makes the formula’s effects understandable.',
          },
          {
            title: 'Testify or sign in',
            body: 'When a bill receives a hearing, you can testify remotely, submit written testimony, or simply record support or opposition.',
          },
        ].map((step, index) => (
          <li key={step.title} className="card p-5">
            <span className="w-8 h-8 rounded-full bg-accent text-white font-bold flex items-center justify-center">
              {index + 1}
            </span>
            <h2 className="mt-3 font-bold text-lg">{step.title}</h2>
            <p className="mt-1 text-sm text-ink-secondary">{step.body}</p>
          </li>
        ))}
      </ol>

      <section className="mt-10 grid lg:grid-cols-2 gap-4 items-start">
        <CopyBlock title="Email template" text={personalizedEmail} />
        <CopyBlock
          title="Public testimony template (about 1 minute)"
          text={TESTIMONY_TEMPLATE}
        />
      </section>

      <section className="mt-12">
        <p className="text-sm font-semibold text-accent uppercase tracking-wide">
          2026 regular session
        </p>
        <h2 className="mt-1 text-2xl md:text-3xl font-bold">
          What passed and what did not
        </h2>
        <p className="mt-2 text-ink-secondary max-w-3xl">
          The session ended March 12, 2026. A bill that did not pass is no
          longer active, but its idea can return in a future bill or budget.
          Every title below links to the Legislature&apos;s official history.
        </p>

        <h3 className="mt-7 text-xl font-bold">Passed</h3>
        <div className="mt-3 grid lg:grid-cols-2 gap-4">
          {PASSED_BILLS.map((bill) => (
            <BillCard key={bill.bill} bill={bill} passed />
          ))}
        </div>

        <h3 className="mt-8 text-xl font-bold">Did not pass</h3>
        <div className="mt-3 grid lg:grid-cols-2 gap-4">
          {DID_NOT_PASS_BILLS.map((bill) => (
            <BillCard key={bill.bill} bill={bill} passed={false} />
          ))}
        </div>
      </section>

      <section className="mt-14">
        <p className="text-sm font-semibold text-accent uppercase tracking-wide">
          Resource library
        </p>
        <h2 className="mt-1 text-2xl md:text-3xl font-bold">
          Keep researching and participating
        </h2>
        <p className="mt-2 text-ink-secondary max-w-3xl">
          Use official sources to verify facts, then compare the priorities of
          groups participating in the debate. Advocacy organizations are labeled
          separately because they argue for particular outcomes.
        </p>

        <div className="mt-6 space-y-8">
          {RESOURCE_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xl font-bold">{group.title}</h3>
              <p className="mt-1 text-sm text-ink-secondary max-w-3xl">
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
