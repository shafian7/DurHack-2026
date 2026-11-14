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
