import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-metadata';

/**
 * Deliberately permissive.
 *
 * Nothing is disallowed, including `/_next/` - Google renders pages before
 * judging them, and blocking the CSS and JS bundles would make every page look
 * unstyled and half-empty to the renderer.
 *
 * The explorer's `?d=<code>` query URLs are also left crawlable on purpose.
 * They duplicate `/districts/`, but the fix is the self-referencing canonical
 * that page emits, not a Disallow: a blocked URL is one Google cannot fetch,
 * so it never reads the canonical and may index the query URL anyway on the
 * strength of inbound links alone. Letting it crawl and consolidate is what
 * actually removes the duplicate.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
