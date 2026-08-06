import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-metadata';

/**
 * The six routes, statically listed. `output: 'export'` builds this to a
 * plain sitemap.xml at build time - there is no per-request work to do, and
 * no per-district routes exist yet to enumerate (see F3 in the audit).
 *
 * Trailing slashes match next.config.js's `trailingSlash: true`, which is
 * what the static export actually emits (`/districts/index.html`, not
 * `/districts.html`) - a mismatched canonical would tell crawlers the
 * "real" URL is one the site never serves.
 */
const ROUTES = ['/', '/districts/', '/simulator/', '/take-action/', '/lea/', '/sources/'];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.8,
  }));
}
