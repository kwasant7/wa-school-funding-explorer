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

## 2. District finances (revenues)

**Source:** F-196 — the year-end financial report every school district,
charter school, and tribal-compact school files with OSPI. Raw CSVs are
published on the **SAFS Data Files** page:
https://ospi.k12.wa.us/safs-data-files

We use the "Actuals — General Fund Revenues" files:

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
| 9000 | Other financing sources (bonds, transfers) | **Excluded** |

Total revenues = codes 1000–8000. Code 9000 is excluded because it is
borrowing/transfers, not operating revenue.

Cross-check totals against OSPI's own Financial Reporting Summary
(district-by-district revenue tables):
https://ospi.k12.wa.us/policy-funding/school-apportionment/school-publications/financial-reporting-summary

**Join:** finances are matched to enrollment on the 5-digit
county-district code (`County District Code` ↔ `districtcode`, zero-padded).
Each year, roughly 10–14 enrollment rows (mostly tribal-compact schools) have
no F-196 match and are dropped for that year.

## 3. The prototypical school model (explainer & School Builder)

- **RCW 28A.150.260** — the statute containing prototypical school sizes
  (400 / 432 / 600), funded class sizes (K-3 ≈ 17, grade 4 ≈ 27, 5-6 ≈ 27,
  7-8 ≈ 28.53, 9-12 ≈ 28.74, CTE ≈ 23), and per-school staffing allocations
  (e.g. 0.076 nurse per prototypical elementary):
  https://app.leg.wa.gov/rcw/default.aspx?cite=28A.150.260
- **Washington Constitution, Article IX, Section 1** ("paramount duty"):
  https://leg.wa.gov/CodeReviser/Pages/WAConstitution.aspx
- **McCleary v. State of Washington** — the Supreme Court's case page with
  all orders, including the 2012 decision, 2014 contempt order, 2015 $100k/day
  sanction, and 2018 termination:
  https://www.courts.wa.gov/appellate_trial_courts/supremecourt/?fa=supremecourt.mccleary_education
- **EHB 2242 (2017)** — the McCleary funding fix:
  https://app.leg.wa.gov/billsummary?BillNumber=2242&Year=2017
- **HB 1664 (2022)** — increased counselor/nurse/social-worker allocations:
  https://app.leg.wa.gov/billsummary?BillNumber=1664&Year=2021

## 4. Recent legislation (Take Action tab)

- **SB 5263 (2025)** — special education funding:
  https://app.leg.wa.gov/billsummary?BillNumber=5263&Year=2025
- **SB 5192 (2025)** — MSOC, set at $1,614/student + ~$215 per high schooler:
  https://app.leg.wa.gov/billsummary?BillNumber=5192&Year=2025
- **HB 2049 (2025)** — local levy authority:
  https://app.leg.wa.gov/billsummary?BillNumber=2049&Year=2025

## 5. Known caveats

- **Per-student figures** divide general-fund revenues by October headcount.
  OSPI's official per-pupil statistics use annual average FTE (AAFTE), so our
  numbers run slightly lower but are internally consistent across districts.
- **General fund only.** Capital projects, debt service, transportation
  vehicle, and ASB funds are excluded everywhere.
- **Nominal dollars.** Trend charts are not inflation-adjusted (and say so).
- **The Policy Simulator is illustrative**: statewide averages, a 4/13 K-3
  enrollment share, $100k average teacher compensation, ~450 students per
  school. It is labeled as an educational estimate, not a fiscal note.
- **Staffing values** in the explainer are the base statutory values; the
  Legislature has enriched some allocations since (e.g., HB 1664).
