# Lane A status

## B00 — foundation

**State:** built and checked locally on 14 November 2026, about 22:10. PR open, not merged: `main` requires one approving review (see "Blocked on a human").

**Files changed**

- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.gitattributes`
- `.github/workflows/ci.yml`
- `src/sim/index.ts`, `src/sim/rng.ts`, `src/sim/config.ts`, `src/sim/noCharge.ts`, `src/main.ts`
- `tests/sim/rng.test.ts`, `tests/sim/config.test.ts`
- `docs/status/lane-a.md`, `lane-b.md`, `lane-c.md`, `lane-d.md`

**Tested versions**

Node 24.13.1 and npm 11.8.0 on Windows 11. Vite 8.3.8, Vitest 5.1.0, TypeScript 7.0.2, tsx 4.23.15, jsdom 29.1.1, @types/node 24.19.2. CI uses Node 24 on `ubuntu-latest`.

**Commands run, from a deleted `node_modules` and `dist`**

| Command | Result |
| --- | --- |
| `npm ci` | exit 0, 0 vulnerabilities |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0. 2 test files, 13 tests passed |
| `npm run build` | exit 0. Wrote `dist/assets/main-C1OFJ1-N.js`, 0.72 kB |

**Checks not run**

- `npm run dev` was not opened in a browser. There is no `index.html` yet (lane C, B40), so there is no page to load.
- `npm run experiment` was not run. It points at `scripts/experiment.ts`, which lane B writes in B22.
- CI on `main`: not possible until the PR merges.

**Decisions**

- `index.html` is lane C's file, so B00 does not create one. `vite.config.ts` builds `src/main.ts` on its own while `index.html` is missing, and uses `index.html` as the entry as soon as it exists.
- Tests run in Node by default. A test that needs a DOM starts with `// @vitest-environment jsdom`; jsdom is already installed so lane C does not need a `package.json` change.
- `createRng` is mulberry32 over a scrambled seed. `int` and `pick` throw a `RangeError` on a non-positive bound or an empty list. The core will catch policy errors and treat them as `wait` (CONTRACTS §1).
- `src/sim/rng.ts` also exports `deriveSeed(seed, stream)` for the three random streams. It is internal to `src/sim/` and not part of the contract.
- Default hotspots are junctions (3,3) and (8,8). Default chargers are (2,2), (9,2), (2,9) and (9,9).
- `createSimulation` is not exported yet. It arrives with B01.

**What depends on it**

Every other lane needs this on `main` to run `npm test`. B01 builds on it.

## Blocked on a human

`main` has a repository ruleset that requires a pull request with one approving review, and an author cannot approve their own PR. No lane can merge its own work until a teammate approves each PR or Shafian sets the required approvals to 0 in the ruleset. `AGENTS.md` and `docs/HANDOFFS.md` assume self-merge on green CI.
