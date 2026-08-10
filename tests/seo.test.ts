/**
 * Tests for the SEO surface: the district URL scheme, the derived metadata,
 * and the route list the sitemap is built from.
 *
 * These guard the properties a crawler depends on and a human would not
 * notice breaking - a duplicate slug silently drops a district's page, a
 * missing trailing slash makes every canonical point at a URL the static
 * export does not serve, and a description that stops varying between
 * districts turns 315 pages into 315 near-duplicates.
 *
 * Run with `npm test`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DISTRICT_REFS,
  districtByCode,
  districtBySlug,
  districtPath,
  slugify,
} from '@/lib/district-slug';
import { districtMetaDescription, districtProfile } from '@/lib/district-profile';
import { indexableRoutes, STATIC_ROUTES } from '@/lib/routes';
import { SITE_URL } from '@/lib/site-metadata';
import districtsJson from '@/data/districts.json';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    assert.equal(slugify('Bellevue School District'), 'bellevue-school-district');
  });

  it('drops punctuation rather than encoding it', () => {
    assert.equal(
      slugify('Seattle School District No. 1'),
      'seattle-school-district-no-1'
    );
  });

  it('strips accents instead of emitting non-ascii URLs', () => {
    assert.equal(slugify('Cañon City'), 'canon-city');
  });

  it('does not leave leading or trailing hyphens', () => {
    assert.equal(slugify('  (Special) District!  '), 'special-district');
  });
});

describe('district slug registry', () => {
  it('covers every district in the dataset', () => {
    assert.equal(DISTRICT_REFS.length, districtsJson.districts.length);
  });

  it('assigns a unique slug to every district', () => {
    const slugs = new Set(DISTRICT_REFS.map((d) => d.slug));
    assert.equal(slugs.size, DISTRICT_REFS.length);
  });

  it('never produces an empty slug', () => {
    for (const ref of DISTRICT_REFS) {
      assert.ok(ref.slug.length > 0, `${ref.name} has an empty slug`);
    }
  });

  it('produces URL-safe slugs only', () => {
    for (const ref of DISTRICT_REFS) {
      assert.match(ref.slug, /^[a-z0-9-]+$/, `${ref.name} -> ${ref.slug}`);
    }
  });

  it('round-trips slug -> code -> slug', () => {
    for (const ref of DISTRICT_REFS) {
      assert.equal(districtBySlug(ref.slug)?.code, ref.code);
      assert.equal(districtByCode(ref.code)?.slug, ref.slug);
    }
  });

  it('returns null for an unknown slug rather than throwing', () => {
    assert.equal(districtBySlug('not-a-district'), null);
    assert.equal(districtByCode('99999'), null);
  });

  it('builds paths with the trailing slash the export serves', () => {
    assert.equal(
      districtPath('17001'),
      `/districts/${districtByCode('17001')!.slug}/`
    );
  });

  it('falls back to the index for an unknown code', () => {
    assert.equal(districtPath('99999'), '/districts/');
  });
});

describe('districtProfile', () => {
  it('resolves every district in the registry', () => {
    for (const ref of DISTRICT_REFS) {
      assert.ok(districtProfile(ref.code), `no profile for ${ref.name}`);
    }
  });

  it('returns null for an unknown code', () => {
    assert.equal(districtProfile('99999'), null);
  });

  it('reports revenue components that sum to the total', () => {
    const p = districtProfile(DISTRICT_REFS[0].code)!;
    const { local, state, federal, other, total } = p.revenue;
    // Cent-level rounding in the source data, not a recomputation.
    assert.ok(Math.abs(local + state + federal + other - total) < 1);
  });

  it('only counts positive gaps as locally covered', () => {
    for (const ref of DISTRICT_REFS) {
      const p = districtProfile(ref.code)!;
      assert.ok(p.coveredLocally >= 0, `${ref.name} has a negative covered sum`);
    }
  });

  it('omits gap rows entirely when a district lacks either side', () => {
    for (const ref of DISTRICT_REFS) {
      const p = districtProfile(ref.code)!;
      assert.ok(p.gaps.length === 0 || p.gaps.length === 3);
    }
  });
});

describe('districtMetaDescription', () => {
  it('is unique across every district', () => {
    const seen = new Set<string>();
    for (const ref of DISTRICT_REFS) {
      const text = districtMetaDescription(districtProfile(ref.code)!);
      assert.ok(!seen.has(text), `duplicate description for ${ref.name}`);
      seen.add(text);
    }
  });

  it('names the district it describes', () => {
    for (const ref of DISTRICT_REFS) {
      const text = districtMetaDescription(districtProfile(ref.code)!);
      assert.ok(text.includes(ref.name), `${ref.name} missing from its description`);
    }
  });

  it('stays within a length search engines will display in full', () => {
    for (const ref of DISTRICT_REFS) {
      const text = districtMetaDescription(districtProfile(ref.code)!);
      assert.ok(text.length <= 320, `${ref.name} description is ${text.length} chars`);
    }
  });
});

describe('indexableRoutes', () => {
  const routes = indexableRoutes();

  it('includes one entry per district plus the static routes', () => {
    assert.equal(routes.length, STATIC_ROUTES.length + DISTRICT_REFS.length);
  });

  it('has no duplicate paths', () => {
    const paths = new Set(routes.map((r) => r.path));
    assert.equal(paths.size, routes.length);
  });

  it('ends every path with a slash, matching trailingSlash: true', () => {
    for (const r of routes) {
      assert.ok(r.path.endsWith('/'), `${r.path} has no trailing slash`);
    }
  });

  it('builds absolute https canonical URLs', () => {
    for (const r of routes) {
      assert.ok(`${SITE_URL}${r.path}`.startsWith('https://k12funding.org/'));
    }
  });

  it('gives the home page top priority', () => {
    assert.equal(routes.find((r) => r.path === '/')?.priority, 1.0);
  });
});
