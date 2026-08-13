import type { Metadata } from 'next';
import { Suspense } from 'react';
import DistrictsExplorer from '@/components/DistrictsExplorer';
import JsonLd from '@/components/JsonLd';
import { DISTRICT_REFS } from '@/lib/district-slug';
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

export default function DistrictsPage() {
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
    </>
  );
}
