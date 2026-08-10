import type { Metadata } from 'next';

/**
 * The one place the deployed domain is written down, so canonical URLs,
 * OpenGraph tags, and the sitemap can't drift from each other. Points at the
 * production Vercel domain (see README) regardless of BASE_PATH, which only
 * matters for the GitHub Pages fallback build.
 */
export const SITE_URL = 'https://k12funding.org';

const SITE_NAME = 'WA School Funding Explorer';

/*
  One shared card for every route. Next.js does not merge a child page's
  `openGraph`/`twitter` object with the root layout's - specifying either key
  at all replaces the parent's wholesale, so a page that sets its own title
  and description but omits `images` loses the OG image entirely rather than
  inheriting it. Every pageMetadata() call below has to restate this.
*/
const OG_IMAGE = { url: '/og-image.png', width: 1200, height: 630 };

/**
 * Per-page metadata, including the OpenGraph/Twitter fields Next does not
 * fill in from `title`/`description` on its own - each page has to restate
 * them, so this keeps that restatement to one call instead of six near-copies.
 *
 * `titleIsComplete` controls whether the root layout's
 * `'%s · WA School Funding Explorer'` template still applies. The short tool
 * and methodology titles ("Sources & Methodology") want it - the brand is what
 * makes them legible in a result list. The district and topic pages carry their
 * own brand suffix and are already near the ~60 characters Google will show, so
 * appending a second one only guarantees the useful half gets truncated away.
 */
export function pageMetadata({
  title,
  description,
  path,
  titleIsComplete = false,
}: {
  title: string;
  description: string;
  path: string;
  titleIsComplete?: boolean;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  // The social card gets the brand either way; it has room for it, and a card
  // pasted into a chat has no result list around it to supply the context.
  const socialTitle = titleIsComplete ? title : `${title} · ${SITE_NAME}`;
  return {
    title: titleIsComplete ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: socialTitle,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}

/** Absolute canonical URL for a site-relative path, for JSON-LD `@id`/`url`. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

/*
  JSON-LD builders.

  Every value below has to be visible on the page that emits it - structured
  data describing content a visitor cannot see is exactly what Google's
  spam policy calls out. There are deliberately no aggregateRating, review, or
  FAQ types here: the site has no ratings, and inventing them to win a rich
  result would be a fabrication.
*/

export type JsonLdGraph = Record<string, unknown>;

const PUBLISHER = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
} as const;

/** Site-level identity. Emitted once, on the home page. */
export function websiteJsonLd(): JsonLdGraph {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: 'K12Funding.org',
    url: SITE_URL,
    description:
      'Explore how Washington State funds K-12 public schools: district revenue, funding gaps, special education, levies, transportation, and official OSPI data.',
    publisher: PUBLISHER,
    inLanguage: 'en-US',
  };
}

export function webPageJsonLd({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): JsonLdGraph {
  const url = absoluteUrl(path);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    url,
    name: title,
    description,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
    publisher: PUBLISHER,
    inLanguage: 'en-US',
  };
}

export function breadcrumbJsonLd(
  trail: { name: string; path: string }[]
): JsonLdGraph {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * Describes the OSPI-derived figures this site republishes. Truthful about
 * provenance: the distribution points at the JSON the site actually serves,
 * and the creator is OSPI rather than this project, which only reshapes it.
 */
export function datasetJsonLd({
  name,
  description,
  path,
  temporalCoverage,
}: {
  name: string;
  description: string;
  path: string;
  temporalCoverage: string;
}): JsonLdGraph {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name,
    description,
    url: absoluteUrl(path),
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    creator: {
      '@type': 'GovernmentOrganization',
      name: 'Washington Office of Superintendent of Public Instruction',
      alternateName: 'OSPI',
      url: 'https://ospi.k12.wa.us',
    },
    publisher: PUBLISHER,
    spatialCoverage: {
      '@type': 'Place',
      name: 'Washington State, USA',
    },
    temporalCoverage,
    measurementTechnique:
      'OSPI Report Card enrollment, P-223 funding FTE, and F-196 general fund revenue actuals',
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: absoluteUrl('/data/districts.json'),
      },
    ],
  };
}
