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

### Levies & Local Effort Assistance (policy simulator)

The simulator's levy and LEA sliders use Washington's real formula and real
district inputs, not statewide averages.

**Source:** OSPI's "Enrichment Levy Pre-Ballot Approval" worksheet, published on
the School Apportionment budget-preparations page:

- Page: https://ospi.k12.wa.us/policy-funding/school-apportionment/budget-preparations
- Workbook (CY2027): https://ospi.k12.wa.us/sites/default/files/2026-03/2027levyprojectiontool.xlsx
- Assessed valuations (standalone): https://ospi.k12.wa.us/sites/default/files/2025-06/assess25rpt.xlsx

Note the filename convention changed: through CY2026 the workbook was
`NNNNmultiyearlacombined.xlsx`; from CY2027 it is `2027levyprojectiontool.xlsx`,
and it is filed under a `2026-03/` path even though OSPI's page labels it
"Updated June 15, 2026". Don't construct the URL from the label.

`scripts/build-levy-lea.py` reads three sheets - `Data` (assessed valuation by
calendar year), `Voter Approved` (levy amounts), and `District AAFTE` (LEA
enrollment net of high/non-high transfers) - plus the statutory assumptions from
`LevyCalc`, and writes `src/data/levy.json`.

**Why the site models CY2027 rather than the current collection year.** The
CY2027 "Voter Approved" column is the first one that reflects the **February 10
and April 28, 2026 levy elections** - OSPI stamps it "updated final as of June
26, 2026". The CY2026 voter-approved amounts are unchanged from the previous
workbook, so staying on CY2026 would mean the site never reflected what
districts just voted on. CY2027 is also the last year OSPI models from real
inputs rather than pure projection: assessed valuation is the **actual** CY2025
AV (the previous workbook carried only a projection of it, which ran about 4.4%
high statewide), and enrollment is March 2025-26 AAFTE. Out-years 2028-2031 are
caseload-forecast projections and are deliberately not published here.

The calculation reproduces LevyCalc rows Q, R, T, V, and X. Enrollment (row K)
is total AAFTE minus high/non-high transfers out plus transfers in; the LEA
denominator adds the ALE adjustment (row I.1), while the levy cap does not:

| Step | Formula |
|---|---|
| Capacity per pupil (Q) | AV × $1.50 ÷ 1,000 ÷ (enrollment + ALE adj) |
| Max LEA per pupil (R) | threshold − capacity per pupil |
| Levy rate (T) | levy ÷ AV × 1,000 |
| Maximum LEA (V) | max LEA per pupil × (enrollment + ALE adj) |
| Payable LEA (X) | maximum LEA × min(levy rate ÷ $1.50, 1) |

OSPI rounds to 2 decimals at each of Q, R, and V, and feeds the rounded value
into the next row; the script does the same, or district totals drift by a few
dollars against OSPI's own output.

CY2027 assumptions: LEA guarantee **$2,431.77** per student, LEA rate **$1.50**,
maximum levy **$4,077.38** per student (**$4,786.63** for districts of 40,000+
FTE, i.e. Seattle alone) or **$2.50** per $1,000 AV, whichever is less. Verified
against the workbook's own output for Aberdeen (capacity $1,367.92, max LEA per
pupil $1,063.85, levy rate $2.27, payable $3,056,164 - an exact match).

The LEA guarantee includes a one-year inflation enhancement that the 2026
session cut from $250 to $150, which is why the guarantee steps back down to
$2,178.78 in CY2028 rather than continuing to rise.

**Districts with no CY2027 authority.** Five districts that collect a levy in
2026 have $0 approved for 2027. Two failed at the ballot on February 10, 2026 -
**Darrington** (43.2% yes) and **Oroville** (49.1% yes). The other three -
**Skykomish**, **Southside**, and **Lopez** - simply had no enrichment measure
on the February or April ballot and may still run one; they are not failures.
Battle Ground and Pasco also failed in February, but Pasco re-ran and passed on
April 28 (49.7% → 59.0%), so it does carry 2027 authority.

Election results by district, including yes-percentages and pass/fail, are
published separately by OSPI and were used to confirm the above:
https://ospi.k12.wa.us/policy-funding/school-apportionment/election-results-school-financing

**LEA actually received** is F-196 revenue code **3300** ("Local Effort
Assistance") for 2024-25. It covers a different period than the CY2027 estimate,
so the two are not directly comparable (statewide: $179.8M actual vs $323.3M
modeled for CY2027 - the gap widens because the CY2027 guarantee is higher and
the actual is two years older).

## 3. District boundaries (the map)

**Source:** OSPI's official "Washington School Districts" boundary layer on the
Washington State Geospatial Open Data Portal:

- Dataset page: https://geo.wa.gov/datasets/72ad21c67ecf4f21bc794d4d21485d86_0
- Public ArcGIS FeatureServer (what our script queries):
  https://services9.arcgis.com/fWunDXKkvCx1CM4b/arcgis/rest/services/Washington_School_Districts/FeatureServer/0

The script [`scripts/fetch-boundaries.mjs`](scripts/fetch-boundaries.mjs)
requests the layer as GeoJSON with ~200 m simplification
(`maxAllowableOffset=0.002`), clips each district to land, projects it to Web
Mercator, and writes `public/wa-districts-map.json` as SVG paths keyed by the
layer's `LEACode_1` field - the same 5-digit OSPI district code used by the
enrollment and F-196 data, so the map joins to funding data exactly. Per OSPI,
boundaries are their best interpretation of legal descriptions; confirm edge
cases with the district.

District legal boundaries extend into adjacent water (an island district's
polygon is mostly Puget Sound), so the script intersects every district with
a land polygon before drawing: the Census Bureau's 1:500k cartographic state
boundary (TIGERweb `Generalized_ACS2023/State_County`, "States 500K") minus
major lakes from WDFW's NHD hydrography service
(https://geodataservices.wdfw.wa.gov/arcgis/rest/services/FP_Projects/NHDwithLLID/MapServer/0).
Rendered outlines therefore follow the shoreline; multi-island districts
become multipolygons with each island traced separately. Sub-pixel slivers
left over from coastline mismatch between the datasets are dropped. The lake
layer is trimmed to the same state polygon before it is drawn, because it
covers a wider area than Washington - without that, Idaho's and British
Columbia's lakes render in the empty space around the state. Neither the
shoreline nor the lake layer is joined to any funding data.

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
