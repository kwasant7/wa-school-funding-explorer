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
Start-at-college, Open Doors (non-vocational and vocational), Transitional
Kindergarten, and `NonStandard - Total K-12` FTE columns. The TK column is
present only from 2023-24 on (the year the line became separately reported);
nonstandard K-12 is regular-year enrollment in nonstandard settings, chiefly
students a district sends to a regional skills center. This matches the **OSPI
Apportionment AAFTE** reported by
[fiscal.wa.gov](https://fiscal.wa.gov/K12/K12FinanceDistrict) ("Enrollment from
OSPI Apportionment, excluding **Summer** Skills Centers, Institutions, and
pre-K Special Ed") to the student. Tacoma 2024-25 = 26,272.81 K-12 + 452.54
Running Start + 378.54 Open Doors + 648.13 Transitional Kindergarten + 28.54
nonstandard = **27,780.56 ≈ 27,781**, the exact fiscal.wa.gov figure; its
`$/FTE` of $20,578 against our general-fund total matches too. Aberdeen 2024-25
= 3,085.79 + 18.94 nonstandard = **3,104.73 ≈ 3,105**, and fiscal.wa.gov's
`$20,129` per FTE reproduces to the dollar. A district that hosts no skills
center and has no TK matches on K-12 + Running Start + Open Doors alone:
Bellevue 2024-25 = 18,911.68 + 571.04 + 25.80 = **19,508.52 ≈ 19,509 FTE**.
OSPI's enrollment handbook explains that September–June annual-average FTE
reported through the P-223 system is used to calculate state basic-education
funding:

The K–3, grades 4–6, grades 7–8, and grades 9–12 FTE subtotals are also
retained so the prototypical-school explainer can scale the state formula to
the district selected by the user. Running Start, Open Doors, Transitional
Kindergarten, and nonstandard FTE are shown separately and are not treated as
on-campus prototypical schools.

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
| 2000 | Local support, non-tax (fees, donations, interest) | Other |
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

The four categories copy fiscal.wa.gov's K12FinanceDistrict report
(https://fiscal.wa.gov/K12/K12FinanceDistrict) so each figure matches a row
there: Local = 1000 only ("Local Taxes", footnote 7), Other = 2000 + 7000 +
8000 + 9000 ("Other Revenues", footnote 10). Code 2000 sat in Local until
2026-11; it moved because fiscal.wa.gov counts it as Other. Checked to the
dollar for Aberdeen and Crescent 2024-25.

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

CY2027 assumptions (OSPI workbook version of October 19, 2026): LEA guarantee
**$2,449.54** per student, LEA rate **$1.50**, maximum levy **$4,134.96** per
student (**$4,704.17** for districts of 40,000+ FTE, i.e. Seattle alone - OSPI's
own CY2027 figure for that group, which gets CPI but not the 3.3% small-district
enhancement) or **$2.50** per $1,000 AV, whichever is less. Verified against the
workbook's own output for Aberdeen (capacity $1,358.84, max LEA per pupil
$1,090.70, levy rate $2.27, payable $3,154,217 - an exact match).

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

### The Big 3 (District Explorer card, brief and one-page PDF)

**Source:** the Association of Educational Service Districts' (AESD) Big 3
dashboard, a public Power BI report built from OSPI's F-196 actuals and
apportionment data: https://app.powerbi.com/view?r=eyJrIjoiMzNiMGJlMjUtMTcwNC00YWMwLTg0ODktYTU5Zjg3NGJmOWJmIiwidCI6ImE5ZWIyNzExLTg0M2YtNDhjMC04M2NkLWM0M2FjNjAwOTgzMSJ9. The site prints AESD's
own figures so that the card, the brief and the PDF match the dashboard
exactly. [`scripts/fetch-big3.py`](scripts/fetch-big3.py) asks the report's
public query endpoint for each district's 2024-25 revenue and cost in the three
programs, plus the student count AESD divides by, and writes
`src/data/big3.json`. The arithmetic (cost minus funding; a total that counts
only the programs that fall short) lives in `src/lib/big3.ts`.

What AESD counts, worked out by matching the dashboard to the F-196 files to
the cent for Lake Washington, Bellevue and Tacoma:

- **Special education** - cost is F-196 programs 21 and 24; funding is every
  general-fund revenue code ending in 21 or 24 (state special education 3121 and
  4121, federal IDEA 6124, Medicaid reimbursements 6321, other state agencies
  4321, payments from other districts 7121).
- **Transportation** - cost is program 99; funding is every revenue code ending
  in 99 (state operations 4199, other state agencies 4399, payments from other
  districts 7199).
- **MSOC** (Materials, Supplies, and Operating Costs) - the same expenditure
  scope as `build-program-spending.mjs`'s "MSOC (Big 3)"; AESD sources the
  alternative-learning (ALE) students in its funding side separately.
- **Students** - K-12 basic plus ALE students, without Running Start and
  dropout reengagement.

"Funding" is therefore not "what the state pays": it includes federal and
inter-district money, and a federal dollar counts on both sides. This differs
from the allocation-versus-spending pairs on the district profile page, which
use the state allocation only.

### Revenue per student, six years (one-page PDF)

`src/data/per-pupil-trend.json` holds each district's per-student revenue for
every year on the site and the statewide median for each year, copied out of
`history.json` by [`scripts/build-per-pupil-trend.py`](scripts/build-per-pupil-trend.py)
so the PDF generator does not have to load the megabyte-sized history file.

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
  (400 / 432 / 600), funded class sizes (K-3 17.00, grade 4 27.00, 5-6 27.00,
  7-8 28.53, 9-12 28.74, CTE 23.00, skill centers 19.00, laboratory science
  19.98), and per-school staffing allocations (e.g. 0.585 nurse per
  prototypical elementary):
  https://app.leg.wa.gov/rcw/default.aspx?cite=28A.150.260
  Every one of these figures is read from `src/lib/prototypical-model.ts`,
  which is the single place the site states them.
- **OSPI, Organization and Financing of Washington's Public Schools** - the
  source for the planning-time factor the statute requires but does not
  quantify: teacher units are `(Enrollment / Class Size) * (1 + Planning Time
  Factor)`, with the factor at 15.5% for K-6 and 20% for grades 7-12:
  https://ospi.k12.wa.us/sites/default/files/2024-01/organizationandfinancingofwapublicschools.pdf
- **Washington Constitution, Article IX, Section 1** ("paramount duty"):
  https://leg.wa.gov/CodeReviser/Pages/WAConstitution.aspx
- **McCleary v. State of Washington** - the Supreme Court's case page with
  all orders, including the 2012 decision, 2014 contempt order, 2015 $100k/day
  sanction, and 2018 termination:
  https://www.courts.wa.gov/appellate_trial_courts/supremecourt/?fa=supremecourt.mccleary_education
- **EHB 2242 (2017)** - the McCleary funding fix:
  https://app.leg.wa.gov/billsummary?BillNumber=2242&Year=2017
- **2SHB 1664 (2022)** - increased counselor/nurse/social-worker/psychologist
  allocations; final sections effective September 1, 2024:
  https://app.leg.wa.gov/billsummary?BillNumber=1664&Year=2022
- **2SSB 5882 (2024)** - increased paraeducator and office-support allocations:
  https://app.leg.wa.gov/billsummary?BillNumber=5882&Year=2024

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
- **The Policy Simulator is illustrative**: seven levers - levy cap, Local
  Effort Assistance, English learner support, special education multiplier,
  MSOC, transportation, and a hypothetical high-poverty bonus - run against
  statewide totals. It is labeled as an educational estimate, not a fiscal
  note. None of its levers move the prototypical model's class sizes or
  staffing units.
- **Staffing values** in the explainer are the allocations currently in effect,
  including 2SHB 1664 (2022) and 2SSB 5882 (2024) - not the original 2009
  values.
- **Class size is not students per teacher.** The funded class size is students
  in a room; students per funded teacher is lower, because the formula also
  pays for the teachers covering everyone else's planning period.
- **Not every parameter is in the RCW.** The statute sets prototype sizes,
  class sizes and staffing units. Salary allocations, regionalization factors,
  planning-time percentages, small-school minimums and the CTE amounts are set
  in the biennial appropriations act.
