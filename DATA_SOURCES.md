# Data sources & methodology

Every number on this site comes from public data published by Washington's
Office of Superintendent of Public Instruction (OSPI) or from state law. This
document lists the exact sources so anything can be cross-verified. The full
pipeline is [`scripts/fetch-data.mjs`](scripts/fetch-data.mjs); run
`npm run fetch-data` to rebuild the bundled JSON from the originals.

## 1. Enrollment & student demographics

**Source:** OSPI "Report Card Enrollment" datasets on the Washington open data
portal (data.wa.gov), one dataset per school year. We use the
**district-level, "All Grades"** rows (`organizationlevel=District`,
`gradelevel=All Grades`), which contain October headcount plus student-group
counts (low income, English language learners, students with disabilities,
homeless, migrant, highly capable).

| School year | Dataset ID | Landing page | API endpoint used |
|---|---|---|---|
| 2019-20 | `gtd3-scga` | https://data.wa.gov/d/gtd3-scga | https://data.wa.gov/resource/gtd3-scga.json?organizationlevel=District&gradelevel=All%20Grades |
| 2020-21 | `nvpc-yr7b` | https://data.wa.gov/d/nvpc-yr7b | https://data.wa.gov/resource/nvpc-yr7b.json?organizationlevel=District&gradelevel=All%20Grades |
| 2021-22 | `ymi4-syjv` | https://data.wa.gov/d/ymi4-syjv | https://data.wa.gov/resource/ymi4-syjv.json?organizationlevel=District&gradelevel=All%20Grades |
| 2022-23 | `dij7-mbxg` | https://data.wa.gov/d/dij7-mbxg | https://data.wa.gov/resource/dij7-mbxg.json?organizationlevel=District&gradelevel=All%20Grades |
| 2023-24 | `q4ba-s3jc` | https://data.wa.gov/d/q4ba-s3jc | https://data.wa.gov/resource/q4ba-s3jc.json?organizationlevel=District&gradelevel=All%20Grades |
| 2024-25 | `2rwv-gs2e` | https://data.wa.gov/d/2rwv-gs2e | https://data.wa.gov/resource/2rwv-gs2e.json?organizationlevel=District&gradelevel=All%20Grades |

Fields used: `all_students`, `low_income`, `english_language_learners`,
`students_with_disabilities`, `homeless`, `migrant`, `highly_capable`,
`districtcode`, `districtname`, `county`, `esdname`.

OSPI's own Report Card viewer (same underlying data, browsable):
https://washingtonstatereportcard.ospi.k12.wa.us

### Funding enrollment used for per-student calculations

The student total displayed on the site stays the Report Card's October
headcount. The denominator for every per-student funding figure is different:
OSPI's final **annual-average funding FTE** from the P-223/P-223RS enrollment
system. This handles part-time participation - including Running Start - at its
reported FTE instead of counting every student as one.

**Source:** OSPI's “Final Enrollment Summary - School Years 2001-02 through
2024-25,” published on the SAFS Data Files page:

https://ospi.k12.wa.us/sites/default/files/2024-11/historical-enrollment-summary-2001-02.xlsx

For each district and year, funding enrollment equals the workbook's
`K-12 FTE - Includes ALE` grade columns plus the separately reported Running
Start-at-college and Open Doors non-vocational and vocational FTE columns. This
matches the **OSPI Apportionment AAFTE** reported by
[fiscal.wa.gov](https://fiscal.wa.gov/K12/K12FinanceDistrict) ("Enrollment from
OSPI Apportionment, excluding Summer Skills Centers, Institutions, and pre-K
Special Ed") — e.g. Bellevue 2024-25 = 18,911.68 K-12 + 571.04 Running Start +
25.80 Open Doors = **19,508.52 ≈ 19,509 FTE**, the exact fiscal.wa.gov figure.
OSPI's enrollment handbook explains that September–June annual-average FTE
reported through the P-223 system is used to calculate state basic-education
funding:

The K–3, grades 4–6, grades 7–8, and grades 9–12 FTE subtotals are also
retained so the prototypical-school explainer can scale the state formula to
the district selected by the user. Running Start and Open Doors college FTE is
shown separately and is not treated as an on-campus prototypical school.

https://ospi.k12.wa.us/policy-funding/school-apportionment/guidance-and-tools/enrollment-reporting

## 2. District finances (revenues, expenditures & fund balance)

**Source:** F-196 - the year-end financial report every school district,
charter school, and tribal-compact school files with OSPI. Raw CSVs are
published on the **SAFS Data Files** page:
https://ospi.k12.wa.us/safs-data-files

### Revenues

We use the "Actuals - General Fund Revenues" files:

| School year(s) | Direct CSV download |
|---|---|
| 2019-20, 2020-21, 2021-22 (one combined file) | https://ospi.k12.wa.us/sites/default/files/2023-08/actualsgeneralfundrevenues.csv |
| 2022-23 | https://ospi.k12.wa.us/sites/default/files/2023-12/actualsgeneralfundrevenues-safs3dw_actualsgeneralfundrevenues.csv |
| 2023-24 | https://ospi.k12.wa.us/sites/default/files/2024-12/actualsgeneralfundrevenues2023-24.csv |
| 2024-25 | https://ospi.k12.wa.us/sites/default/files/2025-12/24-25-actuals-general-fund-revenues.csv |

Each row is one district × one revenue account code × amount. What the codes
mean is defined in OSPI's F-196 item map and dictionary:
https://ospi.k12.wa.us/sites/default/files/2025-03/f-196_item_map_and_dictionary.pdf

**How we categorize:** we read only the thousand-level rollup codes and group
them as follows (fund 1 = general fund):

| F-196 rollup code | Meaning | Our category |
|---|---|---|
| 1000 | Local taxes (levies) | Local |
| 2000 | Local support, non-tax | Local |
| 3000 | State, general purpose (apportionment) | State |
| 4000 | State, special purpose (categoricals) | State |
| 5000 | Federal, general purpose | Federal |
| 6000 | Federal, special purpose (Title, IDEA…) | Federal |
| 7000 | Revenues from other school districts | Other |
| 8000 | Revenues from other agencies | Other |
| 9000 | Other financing sources (transfers and other inflows) | Other |

Total funding = codes 1000–9000. Code 9000 is included in “Other” so the
dashboard reconciles to OSPI's complete general-fund revenue and other
financing-source presentation.

Cross-check totals against OSPI's own Financial Reporting Summary
(district-by-district revenue tables):
https://ospi.k12.wa.us/policy-funding/school-apportionment/school-publications/financial-reporting-summary

### Expenditures & the change in fund balance

Total general-fund **expenditures** = the sum of every amount in the "Actuals -
General Fund Expenditures" files (fund 1), one file per year on the same SAFS
page (e.g. 2024-25:
`.../2025-12/24-25-actuals-general-fund-expenditures.csv`; the 2019-20 through
2021-22 combined file is mirrored in `scripts/raw` because OSPI rotates its
exact URL).

**Surplus / (deficit)** shown on each district profile = revenues − expenditures
for the year. This is the annual *change* in the general fund's balance: a
negative value means the district spent more than it took in and drew down its
reserves ("dipped into savings").

**On fund balance itself:** OSPI's public bulk CSVs report revenue and
expenditure *flows* but not the general fund's ending balance-sheet total
(item 442 "Total Fund Balance" / item 431 "Unassigned Fund Balance" appear only
in the smaller-funds extract, not the general fund). So the site reports the
yearly change and its cumulative running total since 2019-20 — not the current
savings on hand. The ending fund balance for a single district is available in
that district's F-196 report on the Financial Reporting Summary.

**Join:** finances, Report Card headcount, and funding FTE are matched on the
5-digit county-district code (`County District Code` ↔ `districtcode` ↔
`CCDDD`, zero-padded).
Each year, roughly 10–14 enrollment rows (mostly tribal-compact schools) have
no F-196 match and are dropped for that year.

## 3. District boundaries (the map)

**Source:** OSPI's official "Washington School Districts" boundary layer on the
Washington State Geospatial Open Data Portal:

- Dataset page: https://geo.wa.gov/datasets/72ad21c67ecf4f21bc794d4d21485d86_0
- Public ArcGIS FeatureServer (what our script queries):
  https://services9.arcgis.com/fWunDXKkvCx1CM4b/arcgis/rest/services/Washington_School_Districts/FeatureServer/0

The script [`scripts/fetch-boundaries.mjs`](scripts/fetch-boundaries.mjs)
requests the layer as GeoJSON with ~200 m simplification
(`maxAllowableOffset=0.002`), projects it to Web Mercator, and writes
`public/wa-districts-map.json` as SVG paths keyed by the layer's `LEACode_1`
field - the same 5-digit OSPI district code used by the enrollment and F-196
data, so the map joins to funding data exactly. Per OSPI, boundaries are their
best interpretation of legal descriptions; confirm edge cases with the
district.

## 4. The prototypical school model (explainer & School Builder)

- **RCW 28A.150.260** - the statute containing prototypical school sizes
  (400 / 432 / 600), funded class sizes (K-3 ≈ 17, grade 4 ≈ 27, 5-6 ≈ 27,
  7-8 ≈ 28.53, 9-12 ≈ 28.74, CTE ≈ 23), and per-school staffing allocations
  (e.g. 0.076 nurse per prototypical elementary):
  https://app.leg.wa.gov/rcw/default.aspx?cite=28A.150.260
- **Washington Constitution, Article IX, Section 1** ("paramount duty"):
  https://leg.wa.gov/CodeReviser/Pages/WAConstitution.aspx
- **McCleary v. State of Washington** - the Supreme Court's case page with
  all orders, including the 2012 decision, 2014 contempt order, 2015 $100k/day
  sanction, and 2018 termination:
  https://www.courts.wa.gov/appellate_trial_courts/supremecourt/?fa=supremecourt.mccleary_education
- **EHB 2242 (2017)** - the McCleary funding fix:
  https://app.leg.wa.gov/billsummary?BillNumber=2242&Year=2017
- **HB 1664 (2022)** - increased counselor/nurse/social-worker allocations:
  https://app.leg.wa.gov/billsummary?BillNumber=1664&Year=2021

## 5. Recent legislation (Take Action tab)

- **SB 5263 (2025)** - special education funding:
  https://app.leg.wa.gov/billsummary?BillNumber=5263&Year=2025
- **SB 5192 (2025)** - MSOC, set at $1,614/student + ~$215 per high schooler:
  https://app.leg.wa.gov/billsummary?BillNumber=5192&Year=2025
- **HB 2049 (2025)** - local levy authority:
  https://app.leg.wa.gov/billsummary?BillNumber=2049&Year=2025

## 6. Known caveats

- **Two enrollment measures are intentional.** “Students” is October
  headcount; per-student funding divides general-fund revenues by final
  annual-average K-12 plus Running Start funding FTE.
- **General fund only.** Capital projects, debt service, transportation
  vehicle, and ASB funds are excluded everywhere.
- **Nominal dollars.** Trend charts are not inflation-adjusted (and say so).
- **The Policy Simulator is illustrative**: statewide averages, a 4/13 K-3
  enrollment share, $100k average teacher compensation, ~450 students per
  school. It is labeled as an educational estimate, not a fiscal note.
- **Staffing values** in the explainer are the base statutory values; the
  Legislature has enriched some allocations since (e.g., HB 1664).
