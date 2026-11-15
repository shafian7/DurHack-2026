# RICKSHAWS · Dhanmondi

**Battery-rickshaw chargers that spread their own load.** DurHack 2026, Neptune North track.

Two copies of the same part of Dhanmondi, Dhaka, run side by side on the same night: 200 battery rickshaws, ten garages and two transformers, on real streets and building outlines from OpenStreetMap.

- **Ordinary chargers** draw full power the moment a rickshaw plugs in. At around ten in the evening the transformers overload, heat up and burst, and the buildings they feed go dark.
- **Smart chargers** each sense only the voltage at their own socket. When it sags they back off for a random time, and a nearly empty battery backs off less. There is no server, no clock and no messages, yet the neighbourhood flattens its own peak, and no transformer bursts.

```bash
npm ci
npm run dev          # the map, at http://localhost:5173
npm test             # all tests
npm run experiment   # writes docs/RESULTS.md
npx tsx scripts/build-map.ts   # rebuilds src/map/dhanmondi.json from the OSM extract
```

The plan is [plan.md](plan.md). The baseline specification is in [docs/](docs/README.md), and the results are in [docs/RESULTS.md](docs/RESULTS.md).

Map data © OpenStreetMap contributors, ODbL. The transformer heating and burst point are illustrative model values, not measurements.
