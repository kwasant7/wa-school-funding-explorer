# WA School Funding Explorer

An interactive explainer and dashboard for how Washington State funds its K-12
public schools: the prototypical school model, funding data for every district,
an illustrative policy simulator, and tools for contacting legislators.

## Stack

- Next.js 14 (app router) + Tailwind CSS, static export (`output: 'export'`)
- No backend - all data is bundled JSON built from public OSPI sources

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

- **Enrollment & demographics** - OSPI Report Card Enrollment 2024-25,
  [data.wa.gov resource `2rwv-gs2e`](https://data.wa.gov/resource/2rwv-gs2e)
  (district-level October headcount, all grades)
- **Funding enrollment** - OSPI Final Enrollment Summary,
  [SAFS data files](https://ospi.k12.wa.us/safs-data-files)
  (annual-average K-12 plus Running Start FTE)
- **Finances** - OSPI F-196 General Fund revenue actuals 2024-25,
  [SAFS data files](https://ospi.k12.wa.us/safs-data-files)

To add a newer school year, add its enrollment dataset ID and F-196 CSV URL to
the `YEARS`/`REVENUE_FILES` tables at the top of `scripts/fetch-data.mjs`.

Full source list with direct, cross-verifiable links (every dataset ID, CSV
URL, statute, and court record): [DATA_SOURCES.md](DATA_SOURCES.md), also
published on the site at `/sources`.

## Deploy to GitHub Pages

The site builds to static files in `out/`. For a project page at
`https://<user>.github.io/<repo>`, build with `BASE_PATH=/<repo> npm run build`
and publish `out/` (add a `.nojekyll` file) - or wire up the standard
`actions/deploy-pages` workflow.

## Caveats

- Displayed student totals are October headcount; per-student figures divide
  general fund revenues by OSPI's final annual-average funding FTE.
- The policy simulator is an educational approximation, not a fiscal model.
