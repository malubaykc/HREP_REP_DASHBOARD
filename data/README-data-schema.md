# Data schema

## congress_overview.json
Array of Congress periods from `source-congress-overview.csv`.

## districts.json
Each row has:
- `region`
- `district`
- `history`: object where each key is a Congress period and each value is an array of representative names.

## representatives.json
Derived automatically from the district sheet. Each row has:
- `id`
- `name`
- `aliases`
- `congresses`
- `terms`
- `regions`
- `districts`
- `term_count`
- `first_congress`
- `last_congress`

Note: The uploaded CSVs do not include verified sex or clan/dynasty columns. The app does not infer political dynasties from surnames because that would be unreliable.
