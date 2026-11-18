# TRICKLE: the Dhanmondi plan

**Written:** Sunday 15 November 2026, about 01:00, on the `shafian` branch. It builds on baseline 0.2 (the documents in `docs/`), which stay the reference for anything this plan does not change.
**Why:** the team rejected the first interface, which looked like a terminal and was a diagram of one street. The new direction is a clean top-down map of a real part of Dhanmondi, Dhaka. On it, two copies of the same neighbourhood run side by side on the same night, one with ordinary chargers and one with our smart chargers. Without the smart chargers a transformer overheats and bursts.

## 1. What the judge sees

One screen, light and calm, readable from three metres:

```text
+--------------------------------------------------------------------------------+
|  TRICKLE · Dhanmondi, Dhaka           Night 1 · 22:40     ▶  ×1 ×4 ×16  ↺   |
+---------------------------------------+----------------------------------------+
|  Ordinary chargers                    |  Smart chargers (no server, no messages)|
|                                       |                                        |
|   [ top-down map of Dhanmondi:        |   [ the same map, the same night ]     |
|     lake, roads, buildings as boxes,  |                                        |
|     2 transformers, 10 garages,       |                                        |
|     200 rickshaws moving on roads ]   |                                        |
|                                       |                                        |
|   T1 ▮▮▮▮▮▮▯ 118% 131°C  T2 BURST     |   T1 ▮▮▮▮▯ 99% 104°C   T2 ▮▮▮▯ 96%     |
+---------------------------------------+----------------------------------------+
|  load on each transformer through the night, both sides, with the limit line   |
+--------------------------------------------------------------------------------+
|  Heatwave   Power cut   Stubborn chargers            seed · scenario · reset   |
+--------------------------------------------------------------------------------+
```

- **The map** is a real block of Dhanmondi, roughly Road 3 to Road 12A between Satmasjid Road and the lake's east bank, from OpenStreetMap. Buildings are flat boxes, the lake is water, roads are drawn by class. It shows place names for the main roads only.
- **Two transformers**, T1 in the west and T2 in the east. Each feeds the buildings and garages nearest to it by road. Buildings are tinted faintly by which transformer feeds them, and lit (warm windows) while it has power.
- **Ten rickshaw garages**, five per transformer, sited on real buildings beside residential roads, with 20 charging bays each. This is how Dhaka's battery rickshaws charge: many to a garage, overnight.
- **200 rickshaws.** By day they drive around the roads. In the evening each one drives home to its garage, parks in its bay and plugs in. Bays show the state: waiting (outline), charging (lit, with a fill bar for the battery) and full (a tick).
- **Each transformer** has a ring that fills with its load, a thermometer for its hot-spot temperature, and a figure in kW. Above the limit it turns amber, and near burst it turns red and shimmers.
- **The burst.** On the ordinary side, a transformer that stays overloaded heats up until it fails. It flashes, smoke rises from it, and everything it feeds goes dark for the rest of the night: buildings, street segments and garages. The banner reads "T2 burst at 23:12, 1,240 homes and 100 rickshaws without power". The smart side, on the same night, stays lit.
- **The chart** under the maps shows the load on each transformer through the night for both sides, with the limit as one line. A burst shows as the curve dropping to zero.

**Update, 15 November:** the left map now shows **connected chargers run by a central server**, rather than ordinary chargers. The judge sees the data link cut at 21:00, the chargers fall back to charging flat out, and a transformer burst, while the smart chargers have nothing to cut. This puts the brief's "communications interrupted" on screen. See `docs/UI.md`.

## 2. What stays the same

- **The claim and the rule.** The smart chargers are lane B's `localPolicy`, unchanged. A charger senses only its own socket voltage and battery. There is no server, no clock and no messages (AGENTS E1 to E5).
- **The central scheduler** (lane D) is *not* part of the solution. It is the comparison that needs a server. It stays in the engine and the headless experiments, where it supports claim clause 6 ("nothing to fail"), and is not shown on the map.
- **No server.** "Backend" here means the simulation engine, a pure TypeScript module with no DOM. The map UI only reads its snapshots and sends it commands. The whole thing builds to a static site that runs offline (BUILD D01, AGENTS rule 12).
- **Determinism, the identical night on both sides, and numbers only from runs** (AGENTS rules 7 and 8).

## 3. What changes

### 3.1 Two transformers: the district

The two transformers are separate low-voltage networks, so a charger on T1 is affected only by T1's load. The engine therefore runs **one simulation per transformer** (the existing core, one "zone" each), wrapped in a `District` that steps them together, sends every command to both, and merges their snapshots for the map.

| | T1 (west) | T2 (east) |
| --- | --- | --- |
| Rickshaws | 100 (garages G1 to G5) | 100 (garages G6 to G10) |
| Household load | half the old profile, scaled by buildings served | the same |
| Rating | calibrated (§3.3) | calibrated |
| Seed | `deriveSeed(seed, 10)` | `deriveSeed(seed, 11)` |

Each zone's seed is derived from the district seed, so the two transformers have different nights while both sides of the screen have the same night.

### 3.2 Feeder position from the real map

`SimConfig` gains an optional `feeders` array. When it is present, charger `i` gets `feeders[i]` instead of a random draw. The map build computes it as the road-network distance from the transformer to the charger's garage, scaled so that the farthest garage on that transformer is 1. Far garages really are further down the wire, and sag more.

### 3.3 Transformer heating and burst

Each transformer gains a hot-spot temperature, a single first-order thermal model in the style of IEC 60076-7, deliberately simplified:

- steady-state hot-spot `θ_ss = ambient + ratedRise × K²`, where `K` is the load as a share of the rating;
- `θ` moves towards `θ_ss` with time constant `τ`, `θ += (θ_ss − θ) / τ` per tick;
- if `θ ≥ burstC`, the transformer **bursts**: no power for the rest of the run, and no reclose.

Starting values: ambient 32 °C (a Dhaka night), rated rise 78 °C, so 110 °C at full rating, `τ` 75 minutes, burst at 140 °C. These are illustrative and not measured, and the UI and pitch say so. They are calibrated **against the ordinary chargers only** (BUILD D07). The calibration has to show that naive charging reliably bursts at least one transformer on a normal night, while the energy the fleet needs still fits under the ratings over the whole night.

Protection: Dhaka transformers often have fuses that are oversized or bypassed. The district config sets the overload trip at 1.6 times rating, so trips are rare, and heat is what fails the transformer. The old trip-and-reclose behaviour is still in the core and still tested.

### 3.4 Contracts (`src/contracts.ts`)

All changes are additive:

- `TransformerConfig`: `ambientC`, `ratedHotSpotRiseC`, `thermalTauTicks`, `burstHotSpotC` (optional; no burst if absent).
- `TransformerView`: `hotSpotC`, `burst`.
- `TickSample`: `hotSpotC`, `burst`.
- `Metrics`: `bursts`, `maxHotSpotC`.
- `SimConfig`: `feeders?`.
- New: `DistrictConfig`, `District`, `MapData` and its parts (§3.5).

`Observation` does not change. That is the claim's boundary.

### 3.5 The map data

- `scripts/map/dhanmondi.osm.json`: the raw OpenStreetMap extract (Overpass, `out geom`), bbox 23.7395 N to 23.7480 N, 90.3700 E to 90.3820 E. © OpenStreetMap contributors, ODbL. Attribution is shown in the UI.
- `scripts/build-map.ts` converts it to `src/map/dhanmondi.json`. It projects to metres, keeps roads by class with names, building footprints, the lake (with its islands) and parks, and builds the road graph. It sites T1, T2 and the ten garages deterministically and computes the feeder values. The build is deterministic, and its output is committed so the app needs no network.
- `src/map/` loads that file and gives the UI the map and a `bayPosition(chargerId)`.

### 3.6 The interface (`src/ui/`, rewritten)

- Plain TypeScript and Canvas 2D, no framework. Two canvases share one cached base layer (buildings, lake, roads), redrawn only on resize. A light pastel style with soft shadows, one accent per state, and a system font stack. It must look calm, not like a dashboard.
- Rickshaw motion is cosmetic, drawn only by the renderer from `id`, the tick and the road graph: each away rickshaw follows its own deterministic loop. A rickshaw that has just plugged in is drawn driving from the road to its bay for the first few minutes. Motion never feeds back into the simulation.
- Controls: play or pause, speed (1, 4, 16 and 60 minutes per second), reset, seed, heatwave, power cut, stubborn chargers. Every command goes to both sides on the same tick.
- Fits 1920 × 1080 and 1366 × 768 without scrolling. Below 1100 px the maps stack.

### 3.7 Experiments

The runner gains a district experiment: seeds 1 to 10, three days, warm-up excluded, naive against local (and stagger and central headless). It reports bursts, nights with a burst, homes left in the dark, overloaded minutes, peak hot-spot, and ready shares near and far. The single-transformer standard experiment and its six clauses are kept.

## 4. Work items, in order

| # | Item | Accepted when |
| --- | --- | --- |
| P1 | This plan | Committed |
| P2 | Contracts and core: `feeders`, thermal model, burst | Old tests pass; new tests: temperature follows load, burst ends power for good, no burst without config |
| P3 | Map pipeline: raw OSM, `build-map.ts`, `dhanmondi.json`, `src/map/` | JSON is under 400 kB; garages and transformers are on the road graph; feeders are in 0 to 1 |
| P4 | District: two zones, commands to both, merged snapshot; district config and calibration | A naive night bursts a transformer in at least 8 of 10 seeds; local has no burst in 10 of 10; calibration recorded |
| P5 | UI rewrite on the district | Both maps play a night; burst visible; V08 (UI imports only contracts, map and its own files); controls reach both sides |
| P6 | Experiment: district table in `docs/RESULTS.md` | Written by the script |
| P7 | Docs: README, status, UI.md updated | Match what is built |

## 5. Risks and decisions

- **Realism of the burst.** Transformer overheating and fires are a real failure in Dhaka, but our model's numbers are illustrative. The pitch says "in our model" and shows the temperature, never a claimed failure rate.
- **Fairness on the far garages.** Local's far ready share is reported in every table, as before.
- **Ownership.** This rewrites lanes A, C and D's files on `shafian` at Shafian's request. Nothing goes to `build` until the team agrees.
- **Performance.** 2 maps × 200 rickshaws × 60 fps is easily within Canvas 2D. The base map is cached as a bitmap.
