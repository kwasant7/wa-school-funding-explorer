import type { Metadata } from 'next';
import HomeExplainer from '@/components/HomeExplainer';
import JsonLd from '@/components/JsonLd';
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

export default function HomePage() {
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
    </>
  );
}
