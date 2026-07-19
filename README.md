# WA School Funding Explorer

An interactive explainer and dashboard for how Washington State funds its K-12
public schools: the prototypical school model, funding data for every district,
an illustrative policy simulator, and tools for contacting legislators.

## Stack

- Next.js 14 (app router) + Tailwind CSS, static export (`output: 'export'`)
- No backend — all data is bundled JSON built from public OSPI sources

## Develop

```sh
npm install
npm run dev
```

## Refresh the data

```sh
npm run fetch-data
```

Rebuilds `src/data/districts.json` from:

- **Enrollment & demographics** — OSPI Report Card Enrollment 2024-25,
  [data.wa.gov resource `2rwv-gs2e`](https://data.wa.gov/resource/2rwv-gs2e)
  (district-level, all grades)
- **Finances** — OSPI F-196 General Fund revenue actuals 2024-25,
  [SAFS data files](https://ospi.k12.wa.us/safs-data-files)

To move to a newer school year, update the two URLs at the top of
`scripts/fetch-data.mjs`.

## Deploy to GitHub Pages

The site builds to static files in `out/`. For a project page at
`https://<user>.github.io/<repo>`, build with `BASE_PATH=/<repo> npm run build`
and publish `out/` (add a `.nojekyll` file) — or wire up the standard
`actions/deploy-pages` workflow.

## Caveats

- Per-student figures divide general fund revenues by October headcount;
  official OSPI per-pupil statistics use annual average FTE.
- The policy simulator is an educational approximation, not a fiscal model.
