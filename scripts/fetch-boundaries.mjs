/**
 * Builds public/wa-districts-map.json from OSPI's official "Washington School
 * Districts" boundary layer on the state geoportal (geo.wa.gov):
 *   https://geo.wa.gov/datasets/72ad21c67ecf4f21bc794d4d21485d86_0
 *   Service: services9.arcgis.com/fWunDXKkvCx1CM4b/.../Washington_School_Districts
 *
 * Geometry is simplified server-side (~200 m tolerance), clipped to land,
 * projected to Web Mercator locally, scaled to a fixed viewBox, and stored as
 * SVG path strings keyed by the 5-digit OSPI district (LEA) code - the same
 * code used across this site's enrollment and F-196 data.
 *
 * Clipping to land happens here, once, in geographic coordinates: each
 * district polygon is intersected with (the Census cartographic state
 * polygon minus the major lakes). OSPI boundaries are jurisdictional and run miles
 * into Puget Sound, Lake Washington, and the Pacific; unclipped, an island
 * district like Vashon renders as a loop of open water rather than the
 * island's coastline, and no render-time clip can fix a stroked outline
 * (clipping a stroke deletes it wherever the boundary crosses water).
 *
 * Run: node scripts/fetch-boundaries.mjs
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'polygon-clipping';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, '..', 'public', 'wa-districts-map.json');

const SERVICE =
  'https://services9.arcgis.com/fWunDXKkvCx1CM4b/arcgis/rest/services/Washington_School_Districts/FeatureServer/0/query';
const WATER_SERVICE =
  'https://geodataservices.wdfw.wa.gov/arcgis/rest/services/FP_Projects/NHDwithLLID/MapServer/0/query';
/*
  Census cartographic boundary for Washington (1:500k, TIGERweb "States 500K",
  layer 7 - its twin, layer 2, never returns geometry). Chosen over Natural
  Earth 10m because it is clipped to the shoreline at a scale that still
  carries the small San Juan islands - NE 10m drops Shaw Island entirely,
  which would leave Shaw Island School District with nothing to clip to.
*/
const LAND_SERVICE =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2023/State_County/MapServer/7/query';

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

async function fetchWaterFeatures() {
  const waterbodyParams = new URLSearchParams({
    where:
      "FTypeText IN ('Lake or Pond','Reservoir') AND Shape_Area > 50000000",
    outFields: 'GNIS_Name,FTypeText',
    f: 'geojson',
    outSR: '4326',
    maxAllowableOffset: '0.002',
    geometryPrecision: '4',
    resultRecordCount: '2000',
  });

  const res = await fetch(`${WATER_SERVICE}?${waterbodyParams}`);
  if (!res.ok) throw new Error(`Hydrography fetch failed: ${res.status}`);
  const geojson = await res.json();
  return geojson.features ?? [];
}

async function fetchLandFeature() {
  const params = new URLSearchParams({
    where: "GEOID='53'",
    outFields: 'GEOID',
    f: 'geojson',
    outSR: '4326',
    returnGeometry: 'true',
    geometryPrecision: '4',
  });
  const res = await fetch(`${LAND_SERVICE}?${params}`);
  if (!res.ok) throw new Error(`Land geometry fetch failed: ${res.status}`);
  const geojson = await res.json();
  const washington = geojson.features?.find((feature) => feature.geometry);
  if (!washington) throw new Error('Washington land geometry was not found');
  return washington;
}

function ringsOf(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates;
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat();
  return [];
}

/** GeoJSON Polygon/MultiPolygon -> polygon-clipping MultiPolygon coords. */
function toMulti(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

/** Signed shoelace area of a ring, in whatever units the coords are in. */
function ringArea(ring, x = (p) => p[0], y = (p) => p[1]) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += x(a) * y(b) - x(b) * y(a);
  }
  return Math.abs(sum / 2);
}

async function main() {
  console.log('Fetching district boundaries from OSPI layer...');
  const features = await fetchFeatures();
  console.log(`  ${features.length} district polygons`);
  console.log('Fetching major lake polygons from the Washington NHD...');
  const waterFeatures = await fetchWaterFeatures();
  console.log(`  ${waterFeatures.length} water polygons`);
  console.log('Fetching Washington coastline and islands from the Census Bureau...');
  const landFeature = await fetchLandFeature();

  /*
    The clip region: Washington's land, i.e. the Census cartographic state
    polygon (whose seaward edge is the coastline - Puget Sound and the
    Pacific are already outside it) minus the major lakes. Lake island holes come back
    out of the difference as land, which is what keeps Mercer Island alive.
  */
  console.log('Clipping district polygons to land...');
  const stateLand = toMulti(landFeature.geometry);
  const landClip = pc.difference(
    stateLand,
    ...waterFeatures.map((f) => toMulti(f.geometry))
  );

  const clipped = [];
  const fallbacks = [];
  for (const f of features) {
    const raw = toMulti(f.geometry);
    let geom;
    try {
      geom = pc.intersection(raw, landClip);
    } catch {
      geom = [];
    }
    // A district that vanishes entirely means the clip failed for it (every
    // district has land); keep the jurisdictional shape rather than a hole.
    if (!geom.length) {
      geom = raw;
      fallbacks.push(f.properties?.LEAName_1 ?? '(unnamed)');
    }
    clipped.push({ properties: f.properties, geom });
  }
  if (fallbacks.length)
    console.log(`  kept unclipped as a fallback: ${fallbacks.join(', ')}`);

  // Overall bounds in Mercator space, from the clipped land shapes so the
  // viewBox hugs the coastline instead of the jurisdictional water extent.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const f of clipped) {
    for (const poly of f.geom) {
      for (const [lon, lat] of poly[0]) {
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

  /*
    Slivers smaller than half a square pixel (~0.15 km² at this scale) are
    coastline-mismatch noise between the two datasets, not islands a reader
    could ever see or click; real small islands comfortably clear this.
    Judged on the outer ring only - a hole never disqualifies its polygon.
  */
  const MIN_AREA_PX = 0.5;
  const pxArea = (ring) => ringArea(ring, (p) => px(p[0]), (p) => py(p[1]));

  const districts = [];
  let dropped = 0;
  for (const f of clipped) {
    const codeRaw = f.properties?.LEACode_1;
    if (codeRaw == null) continue;
    const code = String(codeRaw).padStart(5, '0');
    const name = f.properties?.LEAName_1 ?? '';
    let d = '';
    for (const poly of f.geom) {
      if (poly[0].length < 4) continue;
      if (pxArea(poly[0]) < MIN_AREA_PX) {
        dropped++;
        continue;
      }
      for (const ring of poly) {
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
    }
    if (d) districts.push({ code, name, d });
  }
  districts.sort((a, b) => a.code.localeCompare(b.code));
  if (dropped) console.log(`  dropped ${dropped} sub-pixel sliver polygon(s)`);

  /*
    Lakes are trimmed to the state too. The WDFW layer reaches well past
    Washington - Pend Oreille and Coeur d'Alene in Idaho, the BC lakes north
    of the border - and those used to be hidden by the render-time clipPath
    that the district fills relied on. With the districts clipped in the data
    that clipPath is gone, so out-of-state lakes have to be dropped here or
    they float in the empty space around the state.
  */
  const water = [];
  let waterDropped = 0;
  for (const feature of waterFeatures) {
    let geom;
    try {
      geom = pc.intersection(toMulti(feature.geometry), stateLand);
    } catch {
      geom = [];
    }
    if (!geom.length) {
      waterDropped++;
      continue;
    }
    let d = '';
    for (const poly of geom) {
      if (poly[0].length < 4 || pxArea(poly[0]) < MIN_AREA_PX) continue;
      for (const ring of poly) {
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
    }
    if (d) water.push({ name: feature.properties?.GNIS_Name ?? '', d });
  }
  if (waterDropped)
    console.log(`  dropped ${waterDropped} lake(s) lying outside Washington`);

  const out = {
    source:
      'OSPI school districts clipped to Census state shoreline minus WDFW waterbodies',
    w: WIDTH,
    h: height,
    districts,
    water,
  };
  await writeFile(OUT_FILE, JSON.stringify(out));
  const kb = Math.round(JSON.stringify(out).length / 1024);
  console.log(`Wrote ${districts.length} districts (${kb} KB) -> ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
