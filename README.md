# PH Congress Dynasty Tracker

Static GitHub Pages dashboard for Philippine congressional representatives from the 8th to 20th Congress.

## What is included

- `index.html` — the full dashboard app.
- `data/representatives.json` — representative-level data generated from the district CSV.
- `data/districts.json` — district-by-congress representative history.
- `data/congress_overview.json` — general congress overview table.
- `tools/convert-csv-to-json.js` — optional converter if you update the CSV files later.

## New dynasty features

The dashboard now infers political dynasty signals from the uploaded data using:

- Same-surname groupings.
- Shared districts.
- Consecutive congress terms in the same district.
- Overlapping service in the same congress.
- Dynasty-held seat share per congress.
- Most dynasty-dense regions.
- Largest political families.
- Interactive dynasty relationship network cards.

Important: the relationship network shows **signals**, not verified family trees. The current data does not include an explicit relationship/genealogy column, so the app does not claim exact parent/child/sibling relationships.

## GitHub Pages upload

Upload the unzipped contents to your repository root:

```txt
index.html
README.md
data/
  representatives.json
  districts.json
  congress_overview.json
  source-district-representatives.csv
  source-congress-overview.csv
tools/
  convert-csv-to-json.js
```

Then go to:

```txt
Settings → Pages → Deploy from branch → main → /root
```

## Updating the data

1. Edit your source in Google Sheets.
2. Download the sheets as CSV.
3. Replace the CSV files in `data/`.
4. Run:

```bash
node tools/convert-csv-to-json.js
```

5. Commit the updated JSON files.
