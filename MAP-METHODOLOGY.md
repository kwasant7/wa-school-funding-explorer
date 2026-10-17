# How the Washington district map is built

The map is built in two layers: a one-time build script that turns government
GIS data into SVG path strings, and a React component that draws and colors
them. No map library (Leaflet, Mapbox, D3) is used anywhere. The only geometry
dependency is `polygon-clipping`.

## Part 1: geometry pipeline

File: `scripts/fetch-boundaries.mjs`
Run: `node scripts/fetch-boundaries.mjs`
Output: `public/wa-districts-map.json` (about 400 KB)

1. **Fetch district polygons** from OSPI's ArcGIS FeatureServer
   (`Washington_School_Districts`, layer 0).
   - Service: `https://services9.arcgis.com/fWunDXKkvCx1CM4b/arcgis/rest/services/Washington_School_Districts/FeatureServer/0/query`
   - Params: `where=1=1`, `outFields=LEACode_1,LEAName_1`, `f=geojson`,
     `outSR=4326`, `maxAllowableOffset=0.002` (roughly 200 m server-side
     simplification), `geometryPrecision=4`, paginated with `resultOffset` /
     `resultRecordCount=2000` until `exceededTransferLimit` is false.
2. **Fetch major lakes** from the WDFW NHD MapServer.
   - Service: `https://geodataservices.wdfw.wa.gov/arcgis/rest/services/FP_Projects/NHDwithLLID/MapServer/0/query`
   - Filter: `FTypeText IN ('Lake or Pond','Reservoir') AND Shape_Area > 50000000`
3. **Fetch the state land polygon** from Census TIGERweb "States 500K"
   (layer 7, `GEOID='53'`). Chosen over Natural Earth 10m because it keeps the
   small San Juan islands (NE drops Shaw Island entirely).
   - Service: `https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2023/State_County/MapServer/7/query`
4. **Build a land clip mask**: `landClip = difference(stateLand, ...lakes)`.
   Lake islands like Mercer Island come back out of the difference as land.
5. **Clip every district**: `intersection(district, landClip)`. OSPI
   boundaries are jurisdictional and run miles into Puget Sound and Lake
   Washington. Clipping in the data is what makes Vashon render as an island
   outline rather than a loop of open water. A render-time SVG `clipPath`
   cannot do this because clipping a stroke deletes it wherever the boundary
   crosses water instead of bending it along the shore. If a district clips to
   nothing, the raw jurisdictional shape is kept as a fallback.
6. **Project to Web Mercator** by hand:
   - `x = lon * PI / 180`
   - `y = ln(tan(PI/4 + lat/2))` where `lat` is in radians
   - Bounds are computed from the clipped shapes so the viewBox hugs the
     coastline. Scale so width is 980; height follows (636.96). Y is flipped
     so north is up: `py = (maxY - mercY(lat)) * scale`.
7. **Drop slivers**: any outer ring under 0.5 square pixels (about 0.15 km² at
   this scale) is coastline-mismatch noise between the two datasets and is
   discarded. Judged on the outer ring only; holes never disqualify a polygon.
8. **Serialize as SVG path strings**: each ring becomes `M x y L x y ... Z`
   with one decimal place. Holes are appended as extra subpaths in the same
   `d` string. Lakes are clipped to the state too (so Idaho and BC lakes are
   dropped) and stored the same way.

Output shape:

```json
{
  "source": "OSPI school districts clipped to Census state shoreline minus WDFW waterbodies",
  "w": 980,
  "h": 636.96,
  "districts": [
    { "code": "01109", "name": "Washtucna School District", "d": "M781.5 421.9L802.3 421.8L...Z" }
  ],
  "water": [
    { "name": "Lake Washington", "d": "M...Z" }
  ]
}
```

The 5-digit `code` is the OSPI LEA code, zero-padded, and is the join key to
all enrollment and F-196 data on the site.

## Part 2: rendering

File: `src/components/charts/WaMap.tsx`
Used from: `src/components/DistrictsExplorer.tsx`

A plain inline `<svg>` with `viewBox` driven by React state.

### Loading

- Fetches `${NEXT_PUBLIC_BASE_PATH}/wa-districts-map.json` once into a
  module-level cache (`mapCache`).
- Has an explicit failed state with a "Try again" button (retry counter
  re-runs the effect).
- While loading, a placeholder box holds `aspectRatio: 980 / 630` so the
  district profile below doesn't jump when the JSON lands.

### Pan and zoom via viewBox

- View state is `{ x, y, w, h }` written straight into
  `viewBox="${x} ${y} ${w} ${h}"`.
- Home view is the map extent padded by 8% (`w = map.w * 1.08`, centered).
- `zoomAt(clientX, clientY, factor)` keeps the point under the cursor fixed:
  convert client pixels to viewBox units through `getBoundingClientRect`,
  shrink `w` and `h` by `factor`, then re-anchor `x` and `y` so the world
  point stays at the same screen fraction.
- `clampView` limits `w` to between `map.w / 40` and `map.w * 1.45`. When the
  view is wider or taller than the map it centers the state; otherwise it
  clamps so you can't pan the map fully off-screen (35% / 65% margins).
- `atHome` is a tolerant comparison (within 1% of home width) because pinch
  rounding never lands exactly on the home value.

### Input handling

- Pointer events with a `Map<pointerId, {x, y}>` of active pointers.
  - One pointer: drag. `dx, dy` in client pixels converted to viewBox units
    by `dx / rect.width * v.w`.
  - Two pointers: pinch. Zoom factor is `distanceAfter / distanceBefore`,
    centered on the midpoint.
- A `dragged` ref is set once movement exceeds slop (2 px mouse, 8 px touch)
  and suppresses the click that fires on pointer-up.
- Native non-passive `wheel` listener that only `preventDefault`s and zooms
  on Ctrl/Cmd+scroll (`factor = 1.01 ** -deltaY`), so normal scrolling still
  moves the page.
- Double-click zooms 2.5x at the cursor.
- `touchAction` is `pan-y` at the home view (so a swipe scrolls the page) and
  `none` when zoomed in (so the map takes the gesture).
- Zoom buttons: `+` (2x), `−` (0.5x), `⟲` (reset to home), zooming at the
  SVG's center.

### Paint order (bottom to top)

1. SVG background color is the water color (`#e2f3f8`), so anything outside
   land reads as water.
2. District fills, stroke `#fcfcfb` at 0.7. While a district is selected,
   every other district's fill is mixed 55% toward `#fcfcfb` so the selected
   one stands out; the hovered district always shows its true color.
3. Lakes on top with `pointerEvents="none"`, filled the same water color.
4. Selected district outline: white casing (6) under a black line (2.8),
   round joins. Two strokes because the fills range from near-white to
   near-black and no single color reads over all of them.
5. Hover outline (`#104281`, 1.6), skipped if the hovered district is the
   selected one.

All strokes use `vectorEffect="non-scaling-stroke"` so line weight stays
constant across zoom.

Above the SVG, an HTML name tag (short place name, e.g. "Walla Walla") points
at the top-center of the selected district's bounding box, computed from its
path string. It flips below the district when the top edge is within 12% of
the top of the view, and is shifted by its anchor's share of the map width so
it never runs off either side. It is hidden when the district is panned out of
view.

### Coloring

Chosen by a three-button toggle (`aria-pressed`). Missing data is a flat
grey (`#e1e0d9`). Colors interpolate per RGB channel with a small hex
`lerpColor(a, b, t)`.

| Metric | Scale | Stops |
|---|---|---|
| Reserve ratio (default) | Absolute, piecewise linear at -5, 0, 4.1, 8.2 (one month), 16.4 (the State Auditor's 60-day benchmark), 24.7 (90 days) percent; constants in `src/lib/reserves.ts` | `#7f1d1d`, `#d03b3b`, `#eb6834`, `#eda100`, `#5faa4a`, `#0b7a28` |
| Funding per student | Rank-normalized: position in sorted list, 0 to 1 | `#e3d3f5`, `#b98ee0`, `#8a7fd6`, `#4a7fd0`, `#10429b` |
| Regionalization | Absolute: `(factor - 1) / (max - 1)`, pinned to the site's model year from `regionalization.json` | `#3b0764`, `#7e03a8`, `#cc4778`, `#f89441`, `#f5e626` (plasma) |

Every ramp rises in lightness as well as hue so the ordering survives
greyscale and color blindness.

The fills are computed once per `(map, year, metric)` in a `useMemo` that
also builds an `info` map (name, county, per-pupil, enrollment, reserve ratio,
regionalization) keyed by district code for the tooltip and aria labels.

### Tooltip

An absolutely positioned `div` in the wrapper, not SVG. It sits below-right
of the cursor by default (so it doesn't cover the district to the north) and
flips left or up when within its own footprint (190 x 46 px, plus 16 px)
of an edge. The active metric's number is listed first.

### Legend

A CSS `linear-gradient` of the same ramp stops. End labels use darker colors
than the ramp ends so they remain readable as text on a white background.
The reserve-ratio legend also marks the State Auditor's 60-day benchmark
(16.4% of a year's spending) with a tick.

## Reusing this for another map

The cheapest reuse is the JSON file itself. Any renderer that can draw SVG
path strings into a 980 x 636.96 coordinate box gets the same clipped
geometry, and `code` joins to everything else on the site. If you need a
different projection, extent, or simplification, change `fetch-boundaries.mjs`
(the `WIDTH` constant, `maxAllowableOffset`, or the `mercX`/`mercY`
functions) and regenerate.
