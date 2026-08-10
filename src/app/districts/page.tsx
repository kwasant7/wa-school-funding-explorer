import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import DistrictsExplorer from '@/components/DistrictsExplorer';
import JsonLd from '@/components/JsonLd';
import { DISTRICT_REFS, type DistrictRef } from '@/lib/district-slug';
import {
  breadcrumbJsonLd,
  datasetJsonLd,
  pageMetadata,
  webPageJsonLd,
} from '@/lib/site-metadata';
import { LATEST, YEARS } from '@/lib/years';

const TITLE = `Washington School District Funding Data | K12Funding.org`;
const DESCRIPTION = `Funding data for all ${DISTRICT_REFS.length} Washington school districts and charter schools: revenue by source, per-student funding, special education and transportation gaps, levies, and enrollment trends.`;

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  titleIsComplete: true,
  description: DESCRIPTION,
  path: '/districts/',
});

/**
 * Groups the directory by first letter so 315 links read as a browsable index
 * rather than one undifferentiated wall, and so each group can carry a heading
 * that means something to a screen reader jumping by heading.
 */
function groupByLetter(): [string, DistrictRef[]][] {
  const groups = new Map<string, DistrictRef[]>();
  for (const ref of DISTRICT_REFS) {
    const letter = ref.name[0].toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ref);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export default function DistrictsPage() {
  const groups = groupByLetter();

  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({ title: TITLE, description: DESCRIPTION, path: '/districts/' }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'District Explorer', path: '/districts/' },
          ]),
          datasetJsonLd({
            name: 'Washington K-12 school district funding, by district and school year',
            description:
              'General-fund revenue by source (state, local levy, federal, other), funding FTE and October headcount enrollment, per-student revenue, expenditures, fund balance and reserve ratio for every Washington school district and charter school.',
            path: '/districts/',
            temporalCoverage: `${YEARS[0]}/${LATEST}`,
          }),
        ]}
      />

      {/*
        Rendered here rather than inside DistrictsExplorer: that component
        calls useSearchParams(), so under `output: 'export'` its entire
        Suspense subtree is client-only and never reaches the exported HTML.
        Anything static that a crawler needs - starting with the page's single
        <h1> - has to sit on this side of the boundary.
      */}
      <div className="max-w-site mx-auto px-4 md:px-6 pt-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          District Explorer
        </h1>
        <p className="mt-3 max-w-2xl text-ink-secondary">
          Funding for every school district and charter school in Washington,
          from the F-196 financial reports, any year since 2019-20. Pick your
          district on the map - its full profile opens on this page.
        </p>
      </div>

      <Suspense>
        <DistrictsExplorer />
      </Suspense>

      {/*
        The explorer above needs a click before it shows a district, and its
        selection lives in a query string. This directory is the crawlable
        counterpart: 315 real anchors to 315 static pages, so every district is
        reachable without running any JavaScript.
      */}
      <section
        aria-labelledby="district-directory"
        className="max-w-site mx-auto px-4 md:px-6 pb-16 pt-12"
      >
        <h2 id="district-directory" className="text-2xl font-bold tracking-tight">
          All Washington school districts
        </h2>
        <p className="mt-2 max-w-3xl text-ink-secondary">
          Every district and charter school with published {LATEST} funding data.
          Each page shows revenue by source, what the state formula allocated
          against what programs actually cost, levy and Local Effort Assistance
          detail, and enrollment trends.
        </p>

        <div className="mt-8 space-y-8">
          {groups.map(([letter, refs]) => (
            <div key={letter}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {letter}
              </h3>
              <ul className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                {refs.map((ref) => (
                  <li key={ref.code}>
                    <Link
                      href={`/districts/${ref.slug}`}
                      className="text-sm text-accent hover:underline"
                    >
                      {ref.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
