# PH Congress Representative Database — Local JSON Version

This version is designed for **GitHub Pages** and avoids runtime Google Sheets fetching.

## Files

```txt
index.html
README.md
data/
  representatives.json
  districts.json
  congress_overview.json
  source-district-representatives.csv
  source-congress-overview.csv
  README-data-schema.md
tools/
  convert-csv-to-json.js
```

## Recommended workflow

1. Keep editing your source data in Google Sheets.
2. Download/export the sheets as CSV.
3. Replace these files:
   - `data/source-district-representatives.csv`
   - `data/source-congress-overview.csv`
4. Run:

```bash
node tools/convert-csv-to-json.js
```

5. Upload/push these files to GitHub Pages:

```txt
index.html
data/representatives.json
data/districts.json
data/congress_overview.json
```

## Why JSON instead of live Google Sheets CSV?

Local JSON is faster and more reliable for GitHub Pages. It avoids:

- CORS proxy issues
- Google Sheets publish/cache delays
- fragile sheet URLs
- giant baked-in data inside `index.html`

## Important limitation

The uploaded CSVs do **not** include verified `CLAN`, `SEX`, or dynasty columns. Because of that, this version does **not** label political dynasties or gender counts. It only uses the data that is present in the CSVs.

To restore dynasty tracking later, add a separate roster sheet with fields like:

```txt
FULLNAME, SEX, CLAN, AKA, HOUSE_SPEAKER_START, HOUSE_LEADERSHIP
```

Then the converter/app can be extended to merge that roster with the district records.
