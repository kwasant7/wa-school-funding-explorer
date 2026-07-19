/**
 * Builds public/wa-districts-map.json from OSPI's official "Washington School
 * Districts" boundary layer on the state geoportal (geo.wa.gov):
 *   https://geo.wa.gov/datasets/72ad21c67ecf4f21bc794d4d21485d86_0
 *   Service: services9.arcgis.com/fWunDXKkvCx1CM4b/.../Washington_School_Districts
 *
 * Geometry is simplified server-side (~200 m tolerance), projected to Web
 * Mercator locally, scaled to a fixed viewBox, and stored as SVG path strings
 * keyed by the 5-digit OSPI district (LEA) code — the same code used across
 * this site's enrollment and F-196 data.
 *
 * Run: node scripts/fetch-boundaries.mjs
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, '..', 'public', 'wa-districts-map.json');

const SERVICE =
  'https://services9.arcgis.com/fWunDXKkvCx1CM4b/arcgis/rest/services/Washington_School_Districts/FeatureServer/0/query';

const WIDTH = 980;

function mercX(lonDeg) {
  return (lonDeg * Math.PI) / 180;
}

function mercY(latDeg) {
  const lat = (latDeg * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + lat / 2));
}

async function fetchFeatures() {
  const features = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: 'LEACode_1,LEAName_1',
      f: 'geojson',
      outSR: '4326',
      maxAllowableOffset: '0.002', // ~200 m simplification
      geometryPrecision: '4',
      resultOffset: String(offset),
      resultRecordCount: '2000',
    });
    const res = await fetch(`${SERVICE}?${params}`);
    if (!res.ok) throw new Error(`Boundary fetch failed: ${res.status}`);
    const gj = await res.json();
    features.push(...(gj.features ?? []));
    if (!gj.properties?.exceededTransferLimit && !gj.exceededTransferLimit) break;
    offset += gj.features.length;
  }
  return features;
}

function ringsOf(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates;
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat();
  return [];
}

async function main() {
  console.log('Fetching district boundaries from OSPI layer...');
  const features = await fetchFeatures();
  console.log(`  ${features.length} district polygons`);

  // Overall bounds in Mercator space
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const f of features) {
    for (const ring of ringsOf(f.geometry)) {
      for (const [lon, lat] of ring) {
        const x = mercX(lon);
        const y = mercY(lat);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const scale = WIDTH / (maxX - minX);
  const height = Math.round((maxY - minY) * scale * 100) / 100;
  const px = (lon) => (mercX(lon) - minX) * scale;
  const py = (lat) => (maxY - mercY(lat)) * scale;

  const districts = [];
  for (const f of features) {
    const codeRaw = f.properties?.LEACode_1;
    if (codeRaw == null) continue;
    const code = String(codeRaw).padStart(5, '0');
    const name = f.properties?.LEAName_1 ?? '';
    let d = '';
    for (const ring of ringsOf(f.geometry)) {
      if (ring.length < 4) continue;
      d += ring
        .map(([lon, lat], i) => {
          const x = px(lon).toFixed(1);
          const y = py(lat).toFixed(1);
          return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
        })
        .join('');
      d += 'Z';
    }
    if (d) districts.push({ code, name, d });
  }
  districts.sort((a, b) => a.code.localeCompare(b.code));

  const out = {
    source:
      'OSPI Washington School Districts layer, geo.wa.gov (simplified ~200m)',
    w: WIDTH,
    h: height,
    districts,
  };
  await writeFile(OUT_FILE, JSON.stringify(out));
  const kb = Math.round(JSON.stringify(out).length / 1024);
  console.log(`Wrote ${districts.length} districts (${kb} KB) -> ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
