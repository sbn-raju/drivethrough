# Bundled reference data

## `india-state-boundaries.json`

India state and union-territory boundaries. The backend uses them to work out which states a trip touches
(Feature 05 MAP-005 and Feature 06 route coverage) without making extra calls to the maps provider.

- **Source:** geoBoundaries gbOpen `IND` ADM1, simplified geometry (build of Dec 12, 2023). It is derived from
  the DataMeet India community maps (https://github.com/datameet/maps) and is distributed through
  https://www.geoboundaries.org.
- **License:** Creative Commons Attribution 2.5 India (CC BY 2.5 IN). Attribution is required if you redistribute it.
- **Processing:** coordinates are rounded to 4 decimal places (about 11 m) and stored as flat
  `[lng, lat, …]` rings with a bounding box per state. Codes are the ISO 3166-2:IN suffixes that
  `src/common/constants.ts` uses (36 states and UTs).
- **Accuracy:** borders are simplified. Points within 2 km of a border snap to the nearest state, and a
  disagreement with the maps provider's state marks the route as `uncertain`. Do not use this file to
  settle legal or jurisdictional questions.
