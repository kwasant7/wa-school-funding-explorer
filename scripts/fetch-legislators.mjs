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

async function main() {
  console.log('Fetching OSPI school-district centroids...');
  const schoolData = await fetchJson(SCHOOL_DISTRICTS, {
    where: '1=1',
    outFields: 'LEACode_1,LEAName_1',
    returnGeometry: 'false',
    returnCentroid: 'true',
    outSR: '4326',
    resultRecordCount: '2000',
    f: 'json',
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
  const schoolDistricts = {};

  for (const feature of schoolData.features ?? []) {
    const codeRaw = feature.attributes?.LEACode_1;
    const centroid = feature.centroid;
    if (codeRaw == null || !centroid) continue;

    const match = legislativeData.features?.find((legislativeFeature) =>
      containsPoint(legislativeFeature.geometry, [centroid.x, centroid.y])
    );
    const legislativeDistrict = Number(match?.properties?.District);
    if (!Number.isFinite(legislativeDistrict)) continue;

    const code = String(codeRaw).padStart(5, '0');
    schoolDistricts[code] = {
      name: feature.attributes?.LEAName_1 ?? '',
      legislativeDistrict,
    };
  }

  const out = {
    generated: new Date().toISOString().slice(0, 10),
    methodology:
      "Uses the legislative district containing each OSPI school district polygon's official centroid. School and legislative boundaries do not match, so users should verify representation with a home address.",
    sources: {
      schoolDistricts: SCHOOL_DISTRICTS.replace(/\/query$/, ''),
      legislativeDistricts: LEGISLATIVE_DISTRICTS.replace(/\/query$/, ''),
      roster: ROSTER,
    },
    schoolDistricts,
    legislators,
  };

  await writeFile(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    `Wrote ${Object.keys(schoolDistricts).length} school-district matches and ${Object.values(legislators).flat().length} legislators to ${path.relative(process.cwd(), OUT_FILE)}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
