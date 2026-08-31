#!/usr/bin/env python3
"""Per-district regionalization factors from LEAP Document 3.

The prototypical model prices staff at statewide salary allocations times a
district's regionalization factor - the one number on the site that was
described everywhere and shown nowhere. The factors live in the Legislative
Evaluation and Accountability Program's Document 3, published with each
operating budget; this pulls the enacted 2024 supplemental edition, which
carries school years 2023-24 through 2026-27 for both staff categories.

Two subtleties the sheet encodes typographically, which this parser keeps:

- Certificated instructional staff factors printed in ITALICS include an
  "experience adjustment" - a small add-on (typically +0.04) for districts
  whose staff-mix the formula would otherwise underpay - so a 1.04 there is
  not the same thing as Seattle's 1.18 of pure regionalization. The italic
  flag is preserved per year as `exp`.
- Certificated administrative and classified staff have their own column and
  can differ from CIS (Evergreen: 1.10 CIS vs 1.06 CAS in 2024-25).

Usage:  python3 scripts/build-regionalization.py
Writes: src/data/regionalization.json
"""

import json
import re
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "raw" / "2024C3.xlsx"
OUT = ROOT / "src" / "data" / "regionalization.json"
URL = "https://fiscal.wa.gov/leapdocs/2024C3.xlsx"

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
# Column layout of the sheet: A = district code, C = name, then one column
# per school year for each staff category (header row 8).
YEARS = ["2023-24", "2024-25", "2025-26", "2026-27"]
CIS_COLS = ["E", "F", "G", "H"]
CAS_COLS = ["J", "K", "L", "M"]


def main() -> None:
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading {URL}")
        urllib.request.urlretrieve(URL, RAW)

    z = zipfile.ZipFile(RAW)
    shared = [
        "".join(t.text or "" for t in si.iter(f"{NS}t"))
        for si in ET.parse(z.open("xl/sharedStrings.xml")).getroot()
    ]

    # Style indexes whose font is italic - the experience-adjustment marker.
    styles = ET.parse(z.open("xl/styles.xml")).getroot()
    italic_fonts = {
        i
        for i, font in enumerate(styles.find(f"{NS}fonts"))
        if font.find(f"{NS}i") is not None
    }
    italic_xfs = {
        i
        for i, xf in enumerate(styles.find(f"{NS}cellXfs"))
        if int(xf.get("fontId", "0")) in italic_fonts
    }

    def cell(cells, col):
        c = cells.get(col)
        if c is None:
            return None, False
        v = c.find(f"{NS}v")
        raw = v.text if v is not None else ""
        if c.get("t") == "s" and raw:
            raw = shared[int(raw)]
        return raw, int(c.get("s", "0")) in italic_xfs

    districts = {}
    sheet = ET.parse(z.open("xl/worksheets/sheet1.xml")).getroot()
    for row in sheet.iter(f"{NS}row"):
        cells = {
            re.match(r"[A-Z]+", c.get("r")).group(0): c
            for c in row.iter(f"{NS}c")
        }
        code, _ = cell(cells, "A")
        # District rows carry a 5-digit county+district code; headers do not.
        if not code or not re.fullmatch(r"\d{5}", code):
            continue
        cis, cas, exp = [], [], []
        for cis_col, cas_col in zip(CIS_COLS, CAS_COLS):
            cis_raw, italic = cell(cells, cis_col)
            cas_raw, _ = cell(cells, cas_col)
            cis.append(round(float(cis_raw), 4))
            cas.append(round(float(cas_raw), 4))
            exp.append(italic)
        districts[code] = {"cis": cis, "cas": cas, "exp": exp}

    OUT.write_text(
        json.dumps(
            {
                "source": URL,
                "budget": "Enacted 2024 supplemental operating budget, LEAP Document 3",
                "years": YEARS,
                "districts": districts,
            },
            separators=(",", ":"),
        )
    )
    print(f"Wrote regionalization.json: {len(districts)} districts, {YEARS[0]}..{YEARS[-1]}")


if __name__ == "__main__":
    main()
