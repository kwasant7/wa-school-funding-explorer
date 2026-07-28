import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(
  __dirname,
  '..',
  'src',
  'data',
  'legislators.json'
);

const SCHOOL_DISTRICTS =
  'https://services9.arcgis.com/fWunDXKkvCx1CM4b/arcgis/rest/services/Washington_School_Districts/FeatureServer/0/query';
const LEGISLATIVE_DISTRICTS =
  'https://services.arcgis.com/bCYnGqM4FMTBSjd1/arcgis/rest/services/Washington_State_Legislative_Districts_2024/FeatureServer/0/query';
const ROSTER =
  'https://leg.wa.gov/legislators/?activeView=DistrictsAndCounties';

async function fetchJson(url, params) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${url}?${query}`);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }
  return response.json();
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  if (!pointInRing(point, polygon[0])) return false;
  return !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

function containsPoint(geometry, point) {
  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) =>
      pointInPolygon(point, polygon)
    );
  }
  return false;
}

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"');
}

async function fetchRoster() {
  const response = await fetch(ROSTER);
  if (!response.ok) {
    throw new Error(`Roster request failed (${response.status})`);
  }
  const html = await response.text();
  const legislators = {};
  const rows = html.match(/<tr id="member-[\s\S]*?<\/tr>/g) ?? [];

  for (const row of rows) {
    const name = row.match(/data-name="([^"]+)"/)?.[1];
    const chamber = row.match(/data-chamber="([^"]+)"/)?.[1];
    const district = row.match(/data-district="(\d+)"/)?.[1];
    const party = row.match(/data-party="([^"]+)"/)?.[1];
    const href = row.match(
      /class="member-column"><a href="([^"]+)"/
    )?.[1];
    const position = row
      .match(/class="position-column">([\s\S]*?)<\/td>/)?.[1]
      ?.replace(/<[^>]+>/g, '')
      .trim();

    if (!name || !chamber || !district || !party || !href) continue;
    const entry = {
      name: decodeHtml(name),
      chamber: chamber === 'Senate' ? 'Senator' : 'Representative',
      position: position || null,
      party,
      url: new URL(href, ROSTER).toString(),
    };
    (legislators[district] ??= []).push(entry);
  }

  for (const members of Object.values(legislators)) {
    members.sort((a, b) => {
      if (a.chamber !== b.chamber) {
        return a.chamber === 'Senator' ? -1 : 1;
      }
      return (a.position ?? '').localeCompare(b.position ?? '');
    });
  }

  return legislators;
}

function bbox(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const rings =
    geometry.type === 'Polygon'
      ? geometry.coordinates
      : geometry.coordinates.flat();
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

/**
 * How a school district's area splits across legislative districts.
 *
 * A school district rarely sits inside one legislative district - Bellevue
 * spans the 41st and the 48th - so picking the LD containing the centroid
 * hides half of a family's representation. Instead this lays a grid over the
 * school district's bounding box, keeps the points that fall inside the
 * district, and asks which legislative district each one lands in. The share
 * of points is a good approximation of the share of area, and it naturally
 * discards the slivers you get where two agencies digitised the same boundary
 * slightly differently.
 */
function districtShares(schoolGeometry, legislativeFeatures, steps = 46) {
  const [minX, minY, maxX, maxY] = bbox(schoolGeometry);
  const counts = new Map();
  let inside = 0;

  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < steps; j += 1) {
      // Offset by half a cell so points never sit exactly on a shared edge.
      const x = minX + ((i + 0.5) / steps) * (maxX - minX);
      const y = minY + ((j + 0.5) / steps) * (maxY - minY);
      if (!containsPoint(schoolGeometry, [x, y])) continue;
      inside += 1;
      const match = legislativeFeatures.find((f) => containsPoint(f.geometry, [x, y]));
      const ld = Number(match?.properties?.District);
      if (Number.isFinite(ld)) counts.set(ld, (counts.get(ld) ?? 0) + 1);
    }
  }

  if (!inside) return [];
  return [...counts.entries()]
    .map(([district, n]) => ({ district, share: n / inside }))
    // Below 2% is almost always a boundary sliver rather than real overlap.
    .filter((d) => d.share >= 0.02)
    .sort((a, b) => b.share - a.share);
}

async function main() {
  console.log('Fetching OSPI school-district boundaries...');
  const schoolData = await fetchJson(SCHOOL_DISTRICTS, {
    where: '1=1',
    outFields: 'LEACode_1,LEAName_1',
    returnGeometry: 'true',
    outSR: '4326',
    maxAllowableOffset: '0.002',
    geometryPrecision: '5',
    resultRecordCount: '2000',
    f: 'geojson',
  });

  console.log('Fetching Washington 2024 legislative districts...');
  const legislativeData = await fetchJson(LEGISLATIVE_DISTRICTS, {
    where: '1=1',
    outFields: 'District',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: '2000',
    f: 'geojson',
  });

  console.log('Fetching the current Legislature roster...');
  const legislators = await fetchRoster();
  const legislativeFeatures = legislativeData.features ?? [];
  const schoolDistricts = {};

  console.log('Overlaying school districts on legislative districts...');
  for (const feature of schoolData.features ?? []) {
    const codeRaw = feature.properties?.LEACode_1;
    if (codeRaw == null || !feature.geometry) continue;

    const shares = districtShares(feature.geometry, legislativeFeatures);
    if (!shares.length) continue;

    const code = String(codeRaw).padStart(5, '0');
    schoolDistricts[code] = {
      name: feature.properties?.LEAName_1 ?? '',
      // Kept for anything still reading a single district: the largest share.
      legislativeDistrict: shares[0].district,
      legislativeDistricts: shares.map((s) => ({
        district: s.district,
        share: Number(s.share.toFixed(3)),
      })),
    };
  }

  const spans = Object.values(schoolDistricts).filter(
    (d) => d.legislativeDistricts.length > 1
  ).length;

  const out = {
    generated: new Date().toISOString().slice(0, 10),
    methodology:
      'Every legislative district overlapping each OSPI school district polygon, found by sampling a grid of points inside the school district and recording which legislative district each falls in. The share is the fraction of sampled points, an approximation of area - not population. Overlaps under 2% are treated as boundary slivers and dropped. School and legislative boundaries do not match, so users should still verify representation with a home address.',
    sources: {
      schoolDistricts: SCHOOL_DISTRICTS.replace(/\/query$/, ''),
      legislativeDistricts: LEGISLATIVE_DISTRICTS.replace(/\/query$/, ''),
      roster: ROSTER,
    },
    schoolDistricts,
    legislators,
  };
  console.log(`  ${spans} school districts span more than one legislative district.`);

  await writeFile(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    `Wrote ${Object.keys(schoolDistricts).length} school-district matches and ${Object.values(legislators).flat().length} legislators to ${path.relative(process.cwd(), OUT_FILE)}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
