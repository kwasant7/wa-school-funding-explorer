import type { Metadata } from 'next';
import Link from 'next/link';
import HomeExplainer from '@/components/HomeExplainer';
import JsonLd from '@/components/JsonLd';
import { DISTRICT_REFS } from '@/lib/district-slug';
import { largestDistricts } from '@/lib/district-profile';
import { districtPath } from '@/lib/district-slug';
import { datasetJsonLd, pageMetadata, websiteJsonLd } from '@/lib/site-metadata';
import { LATEST, YEARS } from '@/lib/years';

/*
  A server wrapper around the interactive explainer.

  The explainer is a client component - it holds the selected district in
  React state - and a client component cannot export `metadata`, so before this
  split the home page silently inherited the root layout's generic title and
  had no way to set its own canonical or description. Keeping the interactive
  half untouched in HomeExplainer and wrapping it here gets the page real
  metadata and structured data without changing anything a visitor sees.
*/

export const metadata: Metadata = pageMetadata({
  title: 'Washington K-12 School Funding Explorer | District Data & Funding Gaps',
  description:
    'Explore how Washington funds K-12 schools. Compare district revenue, funding gaps, special education, levies, transportation, and official OSPI data.',
  path: '/',
});

const TOPICS = [
  {
    href: '/washington-school-funding',
    title: 'How Washington funds K-12 schools',
    blurb: 'The $21 billion picture: state formula, local levies and federal money.',
  },
  {
    href: '/prototypical-school-funding-model',
    title: 'The prototypical school model',
    blurb: 'The statutory recipe that turns enrollment into a state allocation.',
  },
  {
    href: '/special-education-funding',
    title: 'Special education funding',
    blurb: 'How the multiplier works, and why districts report spending more.',
  },
  {
    href: '/school-levies-and-lea',
    title: 'School levies and Local Effort Assistance',
    blurb: 'The per-student levy cap and the state match for property-poor districts.',
  },
  {
    href: '/msoc-funding',
    title: 'MSOC funding',
    blurb: 'The flat per-student amount for everything that is not staff pay.',
  },
  {
    href: '/school-transportation-funding',
    title: 'Student transportation funding',
    blurb: 'What the state pays to get students to school, and what it costs.',
  },
];

export default function HomePage() {
  const largest = largestDistricts(12);

  return (
    <>
      <JsonLd
        data={[
          websiteJsonLd(),
          datasetJsonLd({
            name: 'Washington K-12 school funding, by district and school year',
            description:
              'General-fund revenue by source, funding FTE enrollment, per-student revenue, expenditures and fund balance for every Washington school district and charter school, from OSPI F-196 and Report Card data.',
            path: '/districts/',
            temporalCoverage: `${YEARS[0]}/${LATEST}`,
          }),
        ]}
      />

      <HomeExplainer />

      {/*
        Crawlable entry points. The explainer above reaches every one of these
        eventually, but only after a visitor picks a district in React state -
        a path no crawler follows. These are plain anchors in the exported HTML.
      */}
      <section
        aria-labelledby="explore-more"
        className="max-w-site mx-auto px-4 md:px-6 pb-16"
      >
        <h2 id="explore-more" className="text-2xl md:text-3xl font-bold tracking-tight">
          Understand the funding system
        </h2>
        <p className="mt-2 max-w-2xl text-ink-secondary">
          Six explainers built from the same OSPI data behind the district
          numbers, each with its statutes and sources.
        </p>
        <ul className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOPICS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="card block p-5 h-full hover:border-accent transition-colors"
              >
                <h3 className="font-bold">{t.title}</h3>
                <p className="mt-1 text-sm text-ink-secondary">{t.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-12 text-2xl md:text-3xl font-bold tracking-tight">
          Funding data for every district
        </h2>
        <p className="mt-2 max-w-2xl text-ink-secondary">
          Washington&apos;s largest districts by funded enrollment, or browse all{' '}
          {DISTRICT_REFS.length} districts and charter schools.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {largest.map((d) => (
            <li key={d.code}>
              <Link href={districtPath(d.code)} className="text-sm text-accent hover:underline">
                {d.name}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/districts" className="text-accent hover:underline font-semibold">
            All {DISTRICT_REFS.length} districts →
          </Link>
          <Link href="/simulator" className="text-accent hover:underline font-semibold">
            Policy Simulator →
          </Link>
          <Link href="/take-action" className="text-accent hover:underline font-semibold">
            Take Action →
          </Link>
          <Link href="/sources" className="text-accent hover:underline font-semibold">
            Sources &amp; Methodology →
          </Link>
        </p>
      </section>
    </>
  );
}
