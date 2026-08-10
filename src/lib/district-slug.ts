import districtsJson from '@/data/districts.json';

/**
 * Stable, human-readable URLs for the 315 districts and charters, derived from
 * the official OSPI name so a slug never has to be maintained by hand.
 *
 * The name is the only durable public identifier we have - district codes are
 * correct but meaningless in a URL, and any hand-written alias list would drift
 * the first time OSPI publishes a renamed district. Deriving the slug means a
 * new district gets a working URL the moment it appears in districts.json.
 *
 * Collisions are resolved by appending the district code rather than by
 * silently dropping one of the pair, which would leave a real district with no
 * page at all. As of 2024-25 all 315 names slugify uniquely, so the suffix
 * branch is unused - it exists so that a future duplicate is a slightly uglier
 * URL instead of a missing page. Ordering by code first keeps the assignment
 * deterministic: whichever district wins the bare slug is the same across
 * builds regardless of the order districts.json happens to list them in.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    // Drop combining marks left behind by NFKD so "Cañon" and "Canon" agree.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type DistrictRef = { code: string; name: string; slug: string };

const REFS: DistrictRef[] = (() => {
  const rows = [...districtsJson.districts]
    .map((d) => ({ code: d.code, name: d.name }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const taken = new Set<string>();
  return rows.map(({ code, name }) => {
    const base = slugify(name) || `district-${code}`;
    const slug = taken.has(base) ? `${base}-${code}` : base;
    taken.add(slug);
    return { code, name, slug };
  });
})();

const BY_SLUG = new Map(REFS.map((r) => [r.slug, r]));
const BY_CODE = new Map(REFS.map((r) => [r.code, r]));

/** Every district, sorted by name - the order the directory renders in. */
export const DISTRICT_REFS: DistrictRef[] = [...REFS].sort((a, b) =>
  a.name.localeCompare(b.name)
);

export function districtBySlug(slug: string): DistrictRef | null {
  return BY_SLUG.get(slug) ?? null;
}

export function districtByCode(code: string): DistrictRef | null {
  return BY_CODE.get(code) ?? null;
}

/** Canonical site path for a district, with the trailing slash the export emits. */
export function districtPath(codeOrRef: string | DistrictRef): string {
  const ref = typeof codeOrRef === 'string' ? BY_CODE.get(codeOrRef) : codeOrRef;
  return ref ? `/districts/${ref.slug}/` : '/districts/';
}
