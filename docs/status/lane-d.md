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

**Merge:** PR #8 opened, CI green (13 s). **BLOCKED:** the squash merge was not done. `gh pr merge 8 --squash` was refused by this session's local Claude Code permission classifier ("Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Destructive or Unwanted Actions]"). This is not a GitHub refusal. A human must merge PR #8, or allow `gh pr merge` in their Claude settings. B61 is branched from `lane-d/B60-scenarios`, as AGENTS.md says to do.

**What depends on it:** `src/main.ts` (lane A) already picks up `src/scenarios/index.ts` by glob. The UI's scenario picker (lane C) and the experiment script (lane B) read it.

## B61 — the central scheduler

**Files changed:** `src/policies/scheduler.ts`, `tests/scheduler/scheduler.test.ts`, `tests/scheduler/central-run.test.ts`, `tests/scenarios/demo-run.test.ts`, `src/scenarios/index.ts` (demo timings), `tests/scenarios/scenarios.test.ts`, `docs/status/lane-d.md`.

**What it is:** `createScheduler(options?)`, a `Scheduler` named `central`. At each plan: headroom = rating × (1 − 0.03) − household demand − one charger's power for every stubborn plugged-in charger. It switches on up to floor(headroom / charger power) chargers. Rickshaws below the ready level come first, ordered by slack (ticks to departure minus ticks of charging still needed to reach the ready level), then those only topping up, then by id. It skips stubborn, away, full and removed chargers. It does not use the rng, so a plan depends only on the snapshot. A broken snapshot gives an empty plan, never an exception. Imports only from `../contracts`.

**Decisions**

- The snapshot has no charger power, battery size, efficiency or ready level, and the contract gives `createScheduler()` no arguments. The scheduler takes optional `SchedulerOptions` that default to the CONTRACTS §10 values, and it reads charger power from the snapshot (`chargerLoadKw` / chargers in state `charging`) whenever any charger is drawing. None of the lane D scenarios change the charger figures. If a later config does, `src/main.ts` can pass them in.
- A 3% margin under the rating, because a plan holds for `scheduleIntervalTicks` while household demand rises and wobbles.
- **The demo-3min script changed after a real run.** With the power cut at 00:45, naive never tripped again when the power came back (household load is too low by then), so step 4 did not show. The cut is now at 23:00 for 60 ticks, with the heatwave on from 22:30 to 01:00. The kill stays at 18:00 on day two.

**Commands run:** `npm run typecheck` exit 0; `npm test` exit 0, 8 files, 106 tests passed; `npm run build` exit 0.

**Development runs (build at ea94e17 plus this branch, inline always-on policy for naive, seeds 1 to 10).** These check the scheduler and the demo timings. They are not results for the pitch: those come from lane B's experiment script.

- `standard`, central: 0 trips and 0 overloaded ticks in all 10 seeds over three days. Peak 0.971 to 0.972 of the rating. Ready share 0.995 to 1.000.
- `demo-3min`, naive: trips on night one in every seed, and a trip at tick 730 (10 ticks after the power comes back at midnight) in every seed.
- `demo-3min`, central: no trip before the kill at tick 1,800 in any seed. 1 to 4 trips after it in every seed (first between ticks 2,062 and 2,114).

The integration tests check seeds 1 to 3 of these on every CI run.

**Checks not run:** the local rule in the demo (lane B has not landed `local.ts`). Nothing in a browser.

**What depends on it:** `src/main.ts` picks up `createScheduler` by glob for the central neighbourhood. Lane B's experiment uses it for the central mode and for G2 clause 6.
