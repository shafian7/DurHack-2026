# Lane A status

## B00 — foundation

**Files changed:** `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.gitattributes`, `.github/workflows/ci.yml`, `src/sim/{index,rng,config,physics}.ts`, `src/main.ts`, `tests/sim/{rng,physics}.test.ts`, the four `docs/status/` files.

**Tested versions:** Node 24.13.1, npm 11.8.0, Windows 11. Vite 8.3.8, Vitest 5.1.0, TypeScript 7.0.2, tsx 4.23.15, jsdom 29.1.1, @types/node 24.19.2. CI uses Node 24 on `ubuntu-latest`.

**Commands run after a clean `npm ci`:** `npm run typecheck` exit 0; `npm test` exit 0, 2 files, 15 tests passed; `npm run build` exit 0, wrote `dist/assets/main-*.js` (0.68 kB).

**Checks not run:** `npm run dev` in a browser (no `index.html` yet, lane C). `npm run experiment` (no `scripts/experiment.ts` yet, lane B).

**Decisions**

- No `index.html`: `vite.config.ts` builds `src/main.ts` alone until lane C adds `index.html`, which then becomes the entry automatically.
- Tests run in Node. A DOM test starts with `// @vitest-environment jsdom`; jsdom is installed.
- `createRng` is mulberry32 over a scrambled seed; `int` and `pick` throw `RangeError` on bad input. `src/sim/rng.ts` also exports `deriveSeed(seed, stream)` for the separate streams.
- `src/sim/physics.ts` also exports `clockLabel`, `tickOfHour` and `dayOf`, beyond the list in CONTRACTS §9.
- `createSimulation` arrives with B01.

**What depends on it:** every lane needs this on `build` to run tests. B01 builds on it.

**Merged:** PR #3, CI green.

## B01 — the night

**Files changed:** `src/sim/core.ts`, `src/sim/index.ts`, `tests/sim/core.test.ts`, `tests/sim/helpers.ts`.

**Commands run:** `npm run typecheck` exit 0; `npm test` exit 0, 3 files, 28 tests passed (V01, V03, V04, history, a naive night).

**Headless naive run**, inline always-on policy, default config, three days with the first excluded, seeds 1 to 10: peak 117% to 121% of rating, 218 to 242 overloaded minutes per night, 1.5 to 3.0 trips per night, 45 to 90 minutes without power per night, 98% to 100% leaving ready, lowest socket voltage 194 to 195 V, about 1,150 kWh drawn per night.

**Checks not run:** nothing in a browser.

**Decisions**

- The core already includes transformer protection, `powerCut`, the three scale commands, central-mode mechanics and kill/revive, because they were written together. B02 adds `plugInBurst`, `removeChargers` and `stubbornChargers`, which are ignored for now, and the V05 and V06 tests.
- The household wobble is `n = clamp(0.98 n + 0.2 (u - 0.5), -1, 1)` per tick from its own stream.
- Sensor noise is drawn for every plugged-in charger every tick, outage or not, so the stream does not depend on the mode.
- A policy that throws is treated as `off`; a scheduler that throws gives an empty plan.

**What depends on it:** lane B's runner (B22) and lane C's real wiring (B04).

**Merged:** PR #4, CI green.

## B02 — protection, commands and central mode

**Files changed:** `src/sim/core.ts`, `tests/sim/commands.test.ts`.

**Commands run:** `npm run typecheck` exit 0; `npm test` exit 0, 4 files, 47 tests passed (adds V05 and V06); `npm run build` exit 0.

**Decisions**

- `removeChargers`, `stubbornChargers` and `plugInBurst` pick ids with a partial shuffle on the command stream. The candidates depend only on arrivals and earlier commands, so every mode picks the same ids.
- A fraction above 1 is treated as 1. A removed charger stops being stubborn and never returns.
- `plugInBurst` only moves rickshaws that are away and still due home that day. They keep their scheduled departure and battery level.
- `powerCut` during an outage extends it to the later end time.

**Checks not run:** nothing in a browser.

## B03 — calibration

**Result: no change to `defaultConfig()`.**

- Clause 1 of VALIDATION section 2 already holds for the naive mode: with the default config, seeds 1 to 10, three days with the first excluded, every seed trips (1.5 to 3.0 trips per night, table under B01).
- "It fits": a naive night draws about 1,150 kWh for the chargers. The room under the 220 kW rating between 21:30 and 07:00, using the household curve without wobble, is 1,526 kWh. So the fleet's energy fits under the rating if spread, using about three quarters of the room.
- Only the naive mode was run for this.

**Worth knowing for G2:** naive still sends 98% to 100% of rickshaws out ready, because after its trips the small hours have room. Clause 4 asks the local rule to match that, which is a high bar.

**What depends on it:** lane B's G2 run (B23).

**Merged:** PR #5, CI green.

## B04 — integration (wiring landed; gate G3 not met)

**Files changed:** `src/main.ts`.

`src/main.ts` now finds the other lanes' modules with `import.meta.glob`, so each one is wired the moment it lands on `build`, with no further edit. A missing policy, scheduler or scenario list gets a stand-in that behaves like plain charging, and the page shows a red banner naming what is missing.

**Commands run:** `npm run typecheck` exit 0; `npm test` exit 0, 47 tests passed; `npm run build` exit 0.

**Checks not run:** nothing in a browser. No other lane had landed anything on `build` when this was written (about 23:00 Saturday), so three real neighbourhoods, the frame rate and gate G3 are all unchecked. B04 is not accepted until that is done.
