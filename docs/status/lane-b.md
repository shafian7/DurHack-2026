# Lane B status

## Dhanmondi map rewrite (15 November, about 01:10, on `shafian`, at Shafian's request)

The plan is in `plan.md`. This crosses lanes A, C and D: core heating and burst, a two-transformer district, a new UI and the map data. It stays on `shafian` until the team agrees.

- **Engine:** `src/contracts.ts` gains additive fields: an optional `thermal` config, `hotSpotC`/`burst` on the transformer view and samples, `bursts`/`burstTick`/`maxHotSpotC` in metrics, and an optional `feeders` array. `src/sim/core.ts` adds first-order heating and a permanent burst. `src/sim/district.ts` runs one zone per transformer. `Observation` is unchanged, so the charger rule is untouched.
- **Map:** `scripts/map/dhanmondi.osm.json` is an Overpass extract (bbox 23.7395 to 23.7480 N, 90.3700 to 90.3820 E, fetched 15 November). `scripts/build-map.ts` turns it into `src/map/dhanmondi.json` (98 kB): the real road network, plus schematic boxes placed along the roads. Shafian asked for roads and boxes rather than real footprints. T1 feeds 480 boxes and T2 309. There are ten garages of 20 bays, at wire distances of 296 to 818 m.
- **Calibration, against naive only:** thermal ambient 32 °C, rated rise 78 °C, τ 75 min, burst at 140 °C; trip at 1.6 times rating. Ratings were tried at 150/110 kW (no naive burst), 115/92 kW, 105/85 kW and 100/80 kW. **Chosen: 115/92 kW.** Seeds 1 to 10, three days: naive bursts T2 in 10 of 10 seeds, around 23:15 to 23:30 on the first night. T1 reaches 132 to 133 °C without bursting. Local never bursts (hottest 113 °C) and leaves 96.1% ready (far half 95.1%).
- **UI:** `src/ui/` was rewritten as described in `docs/UI.md`. It was checked in the browser at 1920 × 1080 and 1366 × 768: both maps play, the T2 burst shows with its banner, and there are no console errors.
- **Tests:** `tests/sim/thermal.test.ts`, `tests/sim/district.test.ts`, `tests/map/map.test.ts` and `tests/ui/boundary.test.ts` were added. The old UI tests went with the old UI.
- **Commands:** `npm run typecheck` exit 0; `npm test` passes; `npm run build` exit 0.
- **Not done:** `docs/SPEC.md`, `CONTRACTS.md` and `BUILD.md` have not been rewritten to match. `plan.md` is the reference for the new direction until the team agrees on it.

## Summary (about 00:40 Sunday 15 November)

- **Done, committed on branch `shafian`** (not yet in `build`): B20 baselines, B21 local rule and bench, B22 experiment runner, B23 the G2 experiment, B24 resilience tables. On Shafian's instruction the work went onto the `shafian` branch as commits, not as one PR per item into `build`.
- **G2 verdict, standard scenario, seeds 1 to 10:** clause 1 PASS, 2 PASS (only just: mean peak ratio 0.845 against a limit of 0.85), 3 PASS, 4 PASS (local 99.1% ready, naive 99.0%, central 99.9%), 5 PASS, 6 PASS. Ready near 99.6%, far 98.6%. The full table is in `docs/RESULTS.md`.
- **Weak spot:** the one-hour power cut at 23:00. Local leaves 86.9% ready (far half 81.0%), against naive's 98.7% and central's 99.7%. The pitch must not claim the local rule handles load-shedding well.
- **A human must:** push `shafian`, open a PR from `shafian` into `build`, and merge it once CI is green. Lane A's B04 then gets the real policies with no other change, because `src/main.ts` already picks up `naivePolicy`, `staggerPolicy` and `localPolicy`. Lane D's B63 can fill its gaps from `docs/RESULTS.md`, after the results are regenerated on the frozen commit at G6.

## B20 — baselines

**Files:** `src/policies/naive.ts`, `src/policies/stagger.ts`, `tests/policies/helpers.ts`, `tests/policies/invariants.test.ts`, `tests/policies/baselines.test.ts`.

- `naivePolicy` is always on.
- `staggerPolicy` draws a delay at each plug-in, uniform over [0, 180) ticks (`MAX_DELAY_TICKS`), then stays on and ignores voltage. Three hours is a judgement call. It spreads arrivals without taking so long that rickshaws leave uncharged.
- V02: a static check that each policy file imports only `../contracts` and has no `Math.random`, `Date` or module-level `let`/`var`/mutable collection. A run-time check on frozen observations, and a check that one charger's memory never affects another's.

## B21 — the local rule

**Files:** `src/policies/local.ts`, `tests/policies/local.test.ts`, `tests/policies/bench.ts`, `tests/policies/bench.test.ts`.

The rule follows SPEC §5, rules 1 to 6, with one addition, **rule 3b, deprivation**. A charger tolerates extra sag (up to `deprivationBoost`) in proportion to how little it has drawn since it plugged in. Duty is its own drawn ticks over its own plugged ticks, with a floor of `dutyMinTicks`. Without this term, chargers at the far end of the feeder see 1.5 times the sag, get turned away more, and leave under-charged: the far ready share was 81.3% with the first constants. The term uses only its own memory and `pluggedTicks`, so E1 to E3 still hold.

Constants live in the frozen `LOCAL_PARAMS`. `createLocalPolicy(params)` exists for tuning and tests; the product uses `localPolicy`.

**Bench result** (200 chargers, flat 105 kW household load, all plugged in within an hour, nobody leaves for 600 ticks): naive peaks at 200 drawing, 305 kW, 313 overloaded ticks. Local peaks at 152 drawing, 257 kW, 342 overloaded ticks, mean final battery 0.96. Under that sustained shortage the deprivation term keeps the load above the rating for longer than naive does, because naive finishes sooner. The bench test asserts only a lower peak, which is what B21 asks for. In the real simulation the night's falling household load removes this effect (B23).

## B22 — experiment runner

**Files:** `scripts/experiment.ts`, `scripts/runner.ts`, `scripts/report.ts`, `tests/policies/experiment.test.ts`.

`npm run experiment [-- --seeds 1-10] [--out docs/RESULTS.md] [--no-resilience]` writes `docs/RESULTS.md`, naming the commit, scenario, seeds and full config. The run measures from tick 1,440 onward, so the warm-up day is excluded. Near and far ready shares are split at the warm-up using departure counts per half, taken from snapshots. V07 checks that the same arguments give the same text and that the output names commit, seeds, scenario and config.

## B23 — gate G2

**Tuning**, about 25 minutes of the hour allowed, on `local.ts` constants only. No threshold, seed, warm-up or simulation config was changed. Each line is the mean over seeds 1 to 10, local only:

| Change | Peak / rating | Overloaded min / night | Ready | Near | Far |
| --- | --- | --- | --- | --- | --- |
| First guess (limits 0.045 to 0.085, no deprivation) | 96.8% | 0.0 | 90.2% | 99.5% | 81.3% |
| Limits 0.04 to 0.12 | 103.3% | 45.6 | 98.3% | 99.7% | 97.0% |
| Deprivation 0.06, limits 0.035 to 0.08 | 101.0% | 4.7 | 99.1% | 99.8% | 98.3% |
| **Chosen:** limits 0.025 to 0.085, deprivation 0.075, restart margin 0.012 | 100.8% | 3.0 | 99.1% | 99.6% | 98.6% |

The trade is between peak and ready share. A higher sag tolerance charges more rickshaws but overloads more. Clause 2's peak ratio (0.845) and clause 4's ready share (99.1% against naive's 99.0%) are both within about a point of failing. Neither has much margin.

**Result, standard experiment, seeds 1 to 10, commit `917f3b9`:**

| Mode | Peak / rating | Overloaded min / night | Trips / night | Ready | Near | Far |
| --- | --- | --- | --- | --- | --- | --- |
| naive | 119.2% | 234.6 | 2.50 | 99.0% | 98.9% | 99.2% |
| stagger | 110.5% | 154.1 | 0.00 | 95.9% | 95.9% | 95.8% |
| local | 100.8% | 3.0 | 0.00 | 99.1% | 99.6% | 98.6% |
| central | 97.1% | 0.0 | 0.00 | 99.9% | 99.8% | 100.0% |

All six clauses pass. The details are in `docs/RESULTS.md`. Fairness: the far half does 1.0 point worse than the near half.

## B24 — resilience

Same runner, written into `docs/RESULTS.md`. No thresholds. Local, at a glance:

- **Scheduler killed at 18:00, day 2:** local unchanged; central becomes naive (trips in 10 of 10 seeds).
- **Stubborn 10% / 20% / 40%:** zero trips each time; overloaded minutes per night 10.9 / 30.9 / 87.0; ready 99.0% / 99.4% / 99.5%.
- **One-hour power cut at 23:00, day 2:** zero trips, but ready drops to 86.9% (near 93.3%, far 81.0%). Naive gets 98.7%, central 99.7%. **This is the weak spot.** A likely cause is the cautious restart after the cut, combined with the rule leaving no spare charging time in the night. It has not been investigated.
- **Heatwave, 1.3 times household load:** local never trips and leaves 99.4% ready. Naive trips 13 times a night and leaves 11.0% ready. Local spends 229.7 minutes a night over the rating but under the trip level.

## Commands run (macOS, Node 24.14.0)

- `npm ci`: 0 vulnerabilities.
- `npm run typecheck`: exit 0.
- `npm test`: 17 files, 163 tests passed.
- `npm run experiment`: wrote `docs/RESULTS.md` in about 14 s.

**Not run:** CI on GitHub (nothing pushed yet), `npm run build`, and a browser check of the three neighbourhoods.
