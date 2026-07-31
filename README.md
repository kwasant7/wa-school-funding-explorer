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

## Site guide (AI assistant)

A page-aware assistant that explains the site and Washington school funding,
grounded in this repository's own data and sources. It is two pieces:

- **Frontend** (`src/components/assistant/`, `src/lib/assistant/`) - UI, page
  context, local retrieval, and action execution. Holds no credentials.
- **Cloudflare Worker** (`assistant-worker/`) - the OpenAI call, using the
  Responses API with `gpt-5-nano` and strict Structured Outputs. This is the
  only place the API key exists.

The browser never contacts OpenAI. The site builds and deploys without the
assistant configured; it simply reports itself unavailable.

```sh
npm test                 # assistant unit tests
npm run worker:dev       # run the Worker locally
npm run worker:test      # Worker unit tests
```

Set `NEXT_PUBLIC_ASSISTANT_API_URL` (a GitHub Actions repository *variable*
named `ASSISTANT_API_URL`) to the deployed Worker URL. Full setup:
[docs/ASSISTANT_DEPLOYMENT.md](docs/ASSISTANT_DEPLOYMENT.md).

## Deploy

The site builds to static files in `out/` and is published to
**<https://k12funding.org>** by `.github/workflows/deploy.yml` on every push to
`main`.

`public/CNAME` holds the custom domain, so it is republished with every deploy
rather than living only in the repository settings.

The build sets no `BASE_PATH`, because the site is served from the root of its
own domain. A `BASE_PATH` is only needed to serve from a GitHub Pages *project*
subpath (`https://<user>.github.io/<repo>`), where it must be `/<repo>`;
setting it while on a custom domain prefixes every asset and renders a blank
page.

## Caveats

- Displayed student totals are October headcount; per-student figures divide
  general fund revenues by OSPI's final annual-average funding FTE.
- The policy simulator is an educational approximation, not a fiscal model.
- The site guide explains this site's content and data. It is not an official
  fiscal or legal source, and it has no internet access - it answers only from
  the data and sources bundled here.
