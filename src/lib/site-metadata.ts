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
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · ${SITE_NAME}`,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
