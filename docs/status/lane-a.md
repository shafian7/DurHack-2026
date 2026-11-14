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
