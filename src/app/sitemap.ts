import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-metadata';
import { indexableRoutes } from '@/lib/routes';

/**
 * Built to a plain sitemap.xml at build time by `output: 'export'` - there is
 * no per-request work to do.
 *
 * The list is derived from lib/routes rather than written out here, so the 315
 * district pages and any future route appear automatically. Every URL is the
 * absolute HTTPS canonical, with the trailing slash the export actually serves,
 * so a crawler is never pointed at a URL that redirects.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return indexableRoutes().map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: 'monthly',
    priority,
  }));
}
