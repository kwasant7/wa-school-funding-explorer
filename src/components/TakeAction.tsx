'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DistrictCombobox from '@/components/DistrictCombobox';
import DistrictBrief from '@/components/DistrictBrief';
import data from '@/data/districts.json';
import representation from '@/data/legislators.json';
import { useAssistantDistrict } from '@/lib/assistant/store';
import { readSelectedDistrict, writeSelectedDistrict } from '@/lib/selected-district';
// Portraits live in public/legislators; prefix with the deploy base path so
// they resolve under the GitHub Pages project subpath.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const PASSED_BILLS = [
  {
    bill: 'ESSB 5998',
    name: '2026 supplemental operating budget',
    status: 'Signed April 1, 2026 (partial veto)',
    summary:
      'Revised the budget for school operations. This is where funding ideas actually gain or lose dollars, even when their own bills fail.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5998&Year=2025',
  },
  {
    bill: 'ESSB 6260',
    name: 'Public education funding changes',
    status: 'Signed April 1, 2026',
    summary:
      'Mostly savings: slower school bus reimbursement, rationed Transition to Kindergarten funding, and a lower Running Start cap (1.4 to 1.3 FTE). Some districts will get less.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=6260&Year=2025',
  },
] as const;

const DID_NOT_PASS_BILLS = [
  {
    bill: 'SB 5858',
    name: 'Transportation safety net',
    status: 'Stopped in Senate Ways & Means',
    summary:
      'Would have made permanent the help for costly routes serving students with disabilities, experiencing homelessness, or in foster care.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5858&Year=2025',
  },
  {
    bill: 'SSB 5918',
    name: 'MSOC increase',
    status: 'Stopped in Senate Ways & Means',
    summary:
      'Would have added $100 per student (at least $100,000 per district) for supplies, utilities, insurance, and technology.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=5918&Year=2025',
  },
  {
    bill: 'SB 6125',
    name: 'Enrollment stabilization',
    status: 'Stopped in Senate Early Learning & K-12 Education',
    summary:
      'Would have cushioned districts from sudden funding drops when enrollment falls, giving them time to adjust.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=6125&Year=2025',
  },
  {
    bill: 'SB 6310',
    name: 'Utilities and insurance costs',
    status: 'Stopped in Senate Early Learning & K-12 Education',
    summary:
      'Would have funded utilities and insurance based on local costs, which vary widely, instead of a flat per-student amount.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=6310&Year=2025',
  },
  {
    bill: 'E2SHB 2636',
    name: 'Public education system review',
    status: 'Passed the House; stopped in the Senate',
    summary:
      'Would have ordered an independent review of school performance and funding, a possible first step toward redesigning the formula.',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=2636&Year=2025',
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
        Find the lawmakers connected to your school district, see what your
        district needs, and check what happened to major funding bills in 2026.
      </p>

      <section data-assistant-section="delegation" className="mt-8 card p-5 md:p-6 bg-accent-wash border-accent-soft">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">
              Your Olympia delegation
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
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
                onClear={clearDistrict}
                /* The panel around this one is already washed blue, so the
                   field stays white to remain the thing that stands out. */
                tone="plain"
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
                          <p className="text-xs text-ink-muted">
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
                            className="mt-1 -mx-1 inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-accent hover:underline"
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

      <section data-assistant-section="bills" className="mt-12">
        <p className="text-sm font-semibold text-accent uppercase tracking-wide">
          2026 regular session
        </p>
        <h2 className="mt-1 text-2xl md:text-3xl font-bold">
          What passed and what did not
        </h2>
        <p className="mt-2 text-ink-secondary">
          The session ended March 12, 2026. Failed ideas can come back in a
          future bill or budget. Click a bill number for its official history.
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
    </div>
  );
}
