import { DISTRICT_REFS, districtPath } from '@/lib/district-slug';

/**
 * Every canonical, indexable path on the site, in one list.
 *
 * The sitemap is generated from this, so a new route is announced to crawlers
 * by adding it here rather than by remembering to edit sitemap.ts separately -
 * which is how the six hard-coded routes fell out of date the moment district
 * pages existed.
 *
 * Paths carry the trailing slash `next.config.js` exports (`/sources/index.html`,
 * not `/sources.html`). A canonical without it would name a URL the site never
 * serves.
 */

/** Hand-maintained routes: the tools and the explainers. */
export const STATIC_ROUTES = [
  { path: '/', priority: 1.0 },
  { path: '/districts/', priority: 0.9 },
  { path: '/washington-school-funding/', priority: 0.9 },
  { path: '/prototypical-school-funding-model/', priority: 0.8 },
  { path: '/special-education-funding/', priority: 0.8 },
  { path: '/school-levies-and-lea/', priority: 0.8 },
  { path: '/msoc-funding/', priority: 0.7 },
  { path: '/school-transportation-funding/', priority: 0.7 },
  { path: '/lea/', priority: 0.7 },
  { path: '/simulator/', priority: 0.7 },
  { path: '/take-action/', priority: 0.7 },
  { path: '/sources/', priority: 0.6 },
] as const;

export type IndexableRoute = { path: string; priority: number };

/** Static routes plus one entry per district, derived rather than listed. */
export function indexableRoutes(): IndexableRoute[] {
  return [
    ...STATIC_ROUTES.map((r) => ({ path: r.path, priority: r.priority })),
    ...DISTRICT_REFS.map((ref) => ({ path: districtPath(ref), priority: 0.6 })),
  ];
}
