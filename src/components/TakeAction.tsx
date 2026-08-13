'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import CopyBlock from '@/components/CopyBlock';
import DistrictCombobox from '@/components/DistrictCombobox';
import DistrictBrief from '@/components/DistrictBrief';
import data from '@/data/districts.json';
import representation from '@/data/legislators.json';
import { briefFor } from '@/lib/diagnosis';
import { useAssistantDistrict } from '@/lib/assistant/store';
import { readSelectedDistrict, writeSelectedDistrict } from '@/lib/selected-district';
// Portraits live in public/legislators; prefix with the deploy base path so
// they resolve under the GitHub Pages project subpath.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const EMAIL_TEMPLATE = `Subject: A constituent's perspective on K-12 school funding

Dear [Senator/Representative Last Name],

My name is [YOUR NAME], and I'm a [student/parent/community member] in [YOUR SCHOOL DISTRICT].

I'm writing about K-12 school funding. [TALK ABOUT WHAT YOU HAVE SEEN FIRSTHAND - class sizes climbing, no mental health support when someone needed it, a program cut. Write the one you would tell a neighbor about.]

Washington's funding formula currently [PICK YOUR ISSUE: does not fully cover special education costs / leaves transportation gaps / has not kept operating-cost funding level with district expenses].

I'm asking you to [YOUR ASK: name a policy change or bill you want supported].

Thank you for your time and your service.

[YOUR NAME]
[YOUR CITY], WA
[YOUR SCHOOL OR DISTRICT]`;

const TESTIMONY_TEMPLATE = `Good [morning/afternoon], Chair [NAME], members of the [COMMITTEE NAME] Committee.

Thank you for giving me the opportunity to testify today. My name is [YOUR NAME], and I am [a short bio - who you are, and anything that makes you worth hearing on this bill].

I am testifying [in support of / against] [BILL NUMBER].

[NOW TELL THEM WHY. Summarize the position you are taking, then back it up - a statistic, a case study, or what you have watched happen at your own school. A paragraph or two is plenty. The personal anecdote is the part they will remember.]

I ask you to consider my testimony and vote [YES/NO] on this bill.

Thank you again for the opportunity to testify.`;

const PASSED_BILLS = [
  {
    bill: 'ESSB 5998',
    name: '2026 supplemental operating budget',
    status: 'Signed April 1, 2026 (partial veto) - Chapter 268, Laws of 2026',
    summary:
      'Revised the state budget that pays for public-school operations, including general apportionment, transportation, special education, food service, and statewide programs.',
    significance:
      'This is where policy becomes actual dollars. Even when a separate funding bill fails, an idea can still receive, lose, or change funding through the operating budget.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5998&Year=2025',
  },
  {
    bill: 'ESSB 6260',
    name: 'Public education funding changes',
    status:
      'Signed April 1, 2026 - Chapter 267, Laws of 2026 (effective June 11, 2026)',
    summary:
      'Stretched the assumed lifetime of school buses so the state reimburses their cost more slowly, directed OSPI to prioritize limited Transition to Kindergarten funding, and cut the combined maximum funded Running Start enrollment from 1.4 FTE to 1.3 FTE beginning in 2026-27 - it would have dropped to 1.2 FTE had the companion revenue bill not been enacted by June 30, 2026.',
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
    /*
      A `?d=` in the URL - as on the link from a district's profile page -
      means a specific link was followed and should win even on a first visit
      with nothing in storage yet. Read it from `location.search` directly
      rather than `useSearchParams()`, which would force this whole page
      behind a Suspense boundary with no build-time content, the same
      empty-shell problem the District Explorer had before it was split into
      static per-district routes.
    */
    const fromUrl = new URLSearchParams(window.location.search).get('d');
    const saved = fromUrl ?? readSelectedDistrict();
    if (saved && data.districts.some((district) => district.code === saved)) {
      setSelectedCode(saved);
      if (fromUrl) writeSelectedDistrict(fromUrl);
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
  /*
    A school district usually sits in several legislative districts - Bellevue
    spans the 41st and the 48th - and every one of those delegations votes on
    school funding. Listing only the largest would send a family to the wrong
    legislators about half the time.
  */
  const delegations = (match?.legislativeDistricts ?? [])
    .map((entry) => ({
      district: entry.district,
      share: entry.share,
      members:
        representation.legislators[
          String(entry.district) as keyof typeof representation.legislators
        ] ?? [],
    }))
    .filter((entry) => entry.members.length > 0);
  /*
    Once a district is chosen, the template stops asking the writer to pick an
    issue out of a generic list and fills in the one the data actually points
    at, with the district's own number attached. The placeholders that only the
    writer can fill - their name, what they have seen firsthand - stay
    untouched, because that first-hand detail is the part a legislator reads.
  */
  const brief = selectedDistrict ? briefFor(selectedDistrict.code) : null;
  const personalizedEmail = (() => {
    if (!selectedDistrict) return EMAIL_TEMPLATE;
    let text = EMAIL_TEMPLATE.replaceAll(
      '[YOUR SCHOOL DISTRICT]',
      selectedDistrict.name
    );
    if (!brief) return text;
    // Consume the template's own trailing period: the district fact is a
    // complete sentence and brings one of its own.
    text = text.replace(
      /\[PICK YOUR ISSUE:[^\]]*\]\./,
      `${brief.emailIssue}.${brief.emailFact ? ` ${brief.emailFact}` : ''}`
    );
    text = text.replace(/\[YOUR ASK:[^\]]*\]/, brief.emailAsk);
    return text;
  })();

  const chooseDistrict = useCallback((code: string) => {
    setSelectedCode(code);
    writeSelectedDistrict(code || null);
  }, []);

  const clearDistrict = useCallback(() => chooseDistrict(''), [chooseDistrict]);
  useAssistantDistrict(selectedCode, {
    select: chooseDistrict,
    clear: clearDistrict,
  });

  return (
    <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        Take Action
      </h1>
      <p className="mt-3 text-ink-secondary">
        Start with the lawmakers connected to your school district, understand
        what happened to major funding bills in 2026, and turn your own school
        experience into a specific request.
      </p>

      <section data-assistant-section="delegation" className="mt-8 card p-5 md:p-6 bg-accent-wash border-accent-soft">
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
          <div className="w-full md:w-80">
            <span className="text-sm font-medium text-ink-secondary">
              School district
            </span>
            <div className="mt-1">
              <DistrictCombobox
                districts={districts}
                onPick={chooseDistrict}
                selectedName={selectedDistrict?.name}
                placeholder="Choose or search for a district"
              />
            </div>
          </div>
        </div>

        {selectedDistrict && delegations.length > 0 ? (
          <div className="mt-5">
            <p className="text-sm text-ink-secondary">
              <strong className="text-ink" data-no-translate>{selectedDistrict.name}</strong>{' '}
              {delegations.length > 1 ? (
                <>
                  spans{' '}
                  <strong className="text-ink">
                    {delegations.length} legislative districts
                  </strong>{' '}
                  ({delegations.map((entry) => entry.district).join(', ')}), so
                  every delegation below votes on its funding.
                </>
              ) : (
                <>
                  sits in Washington Legislative District{' '}
                  <strong className="text-ink">{delegations[0].district}</strong>.
                </>
              )}
            </p>

            <div className="mt-4 space-y-5">
              {delegations.map((entry) => (
                <div key={entry.district}>
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-bold">
                      Legislative District {entry.district}
                    </h3>
                    {delegations.length > 1 && (
                      <span className="text-xs text-ink-muted">
                        about {Math.round(entry.share * 100)}% of the school
                        district&apos;s area
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid md:grid-cols-3 gap-3">
                    {entry.members.map((legislator) => (
                      <article
                        key={`${entry.district}-${legislator.name}`}
                        className="card p-4 bg-surface flex gap-3"
                      >
                        {legislator.photo && (
                          <img
                            src={`${BASE_PATH}/legislators/${legislator.photo}`}
                            alt={`Official portrait of ${legislator.chamber} ${legislator.name}`}
                            width={240}
                            height={320}
                            loading="lazy"
                            className="w-16 h-[5.33rem] shrink-0 rounded-md border border-line object-cover object-top bg-paper"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-wide text-ink-muted">
                            {legislator.chamber}
                          </p>
                          <h4 className="mt-0.5 font-bold text-lg leading-tight" data-no-translate>
                            {legislator.name}
                          </h4>
                          <p className="text-sm text-ink-secondary" data-no-translate>
                            {legislator.party} · District {entry.district}
                          </p>
                          <a
                            href={legislator.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
                          >
                            Contact ↗
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-ink-muted">
              Official member portraits: Washington State Legislature
              (Legislative Support Services).
            </p>
            <div className="mt-4 pt-4 border-t border-accent-soft text-sm text-ink-secondary">
              Shares are the portion of the school district&apos;s{' '}
              <strong className="text-ink">area</strong> in each legislative
              district, not its population, and the two boundary sets do not
              line up exactly.{' '}
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

      {selectedDistrict && <DistrictBrief code={selectedDistrict.code} />}

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

      <section data-assistant-section="templates" className="mt-10 grid lg:grid-cols-2 gap-4 items-start">
        <CopyBlock title="Email template" text={personalizedEmail} />
        <CopyBlock
          title="Public testimony template (about 1 minute)"
          text={TESTIMONY_TEMPLATE}
        />
      </section>

      <section data-assistant-section="bills" className="mt-12">
        <p className="text-sm font-semibold text-accent uppercase tracking-wide">
          2026 regular session
        </p>
        <h2 className="mt-1 text-2xl md:text-3xl font-bold">
          What passed and what did not
        </h2>
        <p className="mt-2 text-ink-secondary">
          The session ended March 12, 2026. A bill that did not pass is no
          longer active, but its idea can return in a future bill or budget.
          Every title below links to the Legislature&apos;s official history.
        </p>

        {/* Two columns side by side: what survived against what did not is the
            comparison worth making, and it keeps the section from running long. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2 items-start">
          <div>
            <h3 className="text-xl font-bold">
              Passed{' '}
              <span className="text-sm font-normal text-ink-muted">
                ({PASSED_BILLS.length})
              </span>
            </h3>
            <div className="mt-3 space-y-4">
              {PASSED_BILLS.map((bill) => (
                <BillCard key={bill.bill} bill={bill} passed />
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold">
              Did not pass{' '}
              <span className="text-sm font-normal text-ink-muted">
                ({DID_NOT_PASS_BILLS.length})
              </span>
            </h3>
            <div className="mt-3 space-y-4">
              {DID_NOT_PASS_BILLS.map((bill) => (
                <BillCard key={bill.bill} bill={bill} passed={false} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section data-assistant-section="resources" className="mt-14">
        <p className="text-sm font-semibold text-accent uppercase tracking-wide">
          Resource library
        </p>
        <h2 className="mt-1 text-2xl md:text-3xl font-bold">
          Keep researching and participating
        </h2>
        <p className="mt-2 text-ink-secondary">
          Use official sources to verify facts, then compare the priorities of
          groups participating in the debate. Advocacy organizations are labeled
          separately because they argue for particular outcomes.
        </p>

        <div className="mt-6 space-y-8">
          {RESOURCE_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xl font-bold">{group.title}</h3>
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
