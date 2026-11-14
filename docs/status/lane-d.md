# Lane D status

## B60 — scenarios

**Files changed:** `src/scenarios/index.ts`, `tests/scenarios/scenarios.test.ts`, `docs/status/lane-d.md`.

**What it is:** `scenarios: readonly Scenario[]` with `standard`, `heatwave`, `load-shedding`, `growth` and `demo-3min`. Also exports `tickAt(day, hour, minute)` (clock time to tick on the noon-to-noon clock), `EXPERIMENT_TICKS` (4,320), `HEATWAVE_SCALE` (1.3) and `GROWTH_FLEET` (300). Imports only from `../contracts`.

- `standard`: default config, no script, 4,320 ticks (the VALIDATION §2 experiment).
- `heatwave`: every hourly household value times 1.3 from tick 0 (the B24 "1.3 times" run), done in `configure` so it is in force from the first tick.
- `load-shedding`: a 60-tick `powerCut` at 23:00 on the second night (tick 2,100), matching the B24 resilience run.
- `growth`: `fleetSize` 300, everything else unchanged.
- `demo-3min`: 2,220 ticks (noon to 01:00 two days later). Heatwave on at 22:45 night one, off at 00:15; 60-tick power cut at 00:45; `killScheduler` at 18:00 on day two (tick 1,800, the same tick as G2 clause 6).

**Commands run:** `npm run typecheck` exit 0; `npm test` exit 0, 5 files, 81 tests passed (34 new in `tests/scenarios/`); `npm run build` exit 0.

**Checks not run:** whether the demo timings tell the story in a real run (naive trips on night one, central trips after the kill). That check needs the scheduler, so it comes with B61.

**Decisions:** V10's "complete config" is checked against our own copy of the CONTRACTS §10 defaults, deep-frozen, so the test does not depend on lane A's config module. "Sensible" command values: scales above 0 (base load up to 3, rating up to 2), supply 0.8 to 1.1 per unit, whole positive tick and count values, fractions 0 to 1.

**What depends on it:** `src/main.ts` (lane A) already picks up `src/scenarios/index.ts` by glob. The UI's scenario picker (lane C) and the experiment script (lane B) read it.
