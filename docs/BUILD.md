# Build plan, lanes and gates

**Status:** plan written about 22:00 on Saturday 14 November 2026. No item below has been started. Times are targets, not progress.
**Related:** [Spec](SPEC.md) · [Contracts](CONTRACTS.md) · [Validation](VALIDATION.md) · [Handoffs](HANDOFFS.md)

## 1. Delivery policy

- Build the thinnest thing that proves each clause of the claim (SPEC §8), in the order the gates give.
- Four lanes work in parallel from the start. No lane waits for another: policies are tested against hand-built observations, the UI against a fake simulation, and the core against trivial inline policies.
- There are no sign-off gates. PRs merge on green CI (AGENTS.md).
- Each lane records evidence in its own file, `docs/status/lane-<a|b|c|d>.md`, so four writers never touch one file. This document defines the items; the status files say what happened.

## 2. Lanes and file ownership

| Lane | Human | Plan | Owns | Why this person |
| --- | --- | --- | --- | --- |
| A — core and integration | Alex | Ultra | `package.json`, config files, `.github/`, `src/contracts.ts`, `src/sim/**`, `src/main.ts`, `tests/sim/**`, `AGENTS.md`, `docs/{README,SPEC,CONTRACTS,BUILD,VALIDATION,HANDOFFS}.md`, `docs/status/lane-a.md` | Largest lane and all integration, so it gets the largest plan |
| B — policies and experiments | Shafian | Pro | `src/policies/{random,sight,local,dispatcher}.ts`, `scripts/**`, `tests/policies/**`, `docs/RESULTS.md`, `docs/status/lane-b.md` | Public work shows algorithms from scratch and benchmarking |
| C — interface | Aryan | Pro | `index.html`, `src/ui/**`, `public/**`, `tests/ui/**`, `docs/status/lane-c.md` | Public work is JavaScript front end |
| D — charging, scenarios and pitch | Aaron | Pro | `src/policies/charging.ts`, `src/scenarios/**`, `tests/charging/**`, `tests/scenarios/**`, `docs/{PITCH,CLAIMS,RESULTS_CHARGING}.md`, `docs/status/lane-d.md` | Public work shows shipped projects end to end |

The assignments are a proposal from public GitHub profiles and can be swapped before work starts. Once work starts they stay fixed.

## 3. Work items

Each item lists what to read, what to build and how it is accepted. V numbers refer to VALIDATION §1.

### Lane A — core and integration (Alex, Ultra)

**B00 — foundation.** Read: AGENTS, CONTRACTS §11.
Scaffold Vite, strict TypeScript and Vitest with scripts `dev`, `build`, `typecheck`, `test` and `experiment`. Add a CI workflow that runs typecheck, test and build on every PR. Add `createRng`, `defaultConfig` and `noChargePolicy`. Create the four empty status files.
*Accepted when:* a fresh clone passes `npm ci`, `npm run typecheck`, `npm test` and `npm run build`, and CI is green on `main`. Record the tested Node and package versions.

**B01 — world, movement, demand, pickup, observations, metrics.** Read: CONTRACTS §1 to §6 and §10.
Implement `createSimulation` for the `random`, `sight` and `local` modes with charging off. Depends on B00.
*Accepted when:* V01, V03 and V04 pass, and a 3,600-tick headless run with an inline random policy delivers passengers.

**B02 — commands and dispatcher mechanics.** Read: CONTRACTS §8 and §9.
All commands, dispatcher mode, kill and revive. Depends on B01.
*Accepted when:* V05 passes.

**B03 — charging mechanics.** Read: CONTRACTS §7.
Batteries, chargers, queues, charge-policy calls, charger fields in the observation, running flat. Depends on B01.
*Accepted when:* V06 passes.

**B04 — integration.** Wire `src/main.ts` to the real modules as they land. Check three fleets run smoothly at demo speed and record the measured frame rate. Fix mismatches between lanes through contract PRs.
*Accepted when:* gate G3 is met in a browser.

**B05 — release.** Freeze, tag, build the static site, confirm it runs with the network off, and rehearse the demo script (VALIDATION §4) once from a clean checkout.

### Lane B — policies and experiments (Shafian, Pro)

**B20 — baseline policies.** Read: SPEC §5, CONTRACTS §5 and §6.
`randomPolicy` and `sightPolicy`, tested against hand-built observations. No dependency on the core.
*Accepted when:* V02 passes for both and unit tests cover empty exits, one exit and visible passengers.

**B21 — the local policy.** Read: SPEC §2 and §5.
`localPolicy` with private fading memory and crowd avoidance. Weights are named constants at the top of the file.
*Accepted when:* V02 passes, and unit tests show it prefers a remembered direction, avoids a crowded exit, and forgets over time.

**B22 — experiment runner.** Read: VALIDATION §2.
`scripts/experiment.ts`: run every mode over a list of seeds for a scenario and write a table to a file, with commit, seeds and config. Depends on B01.
*Accepted when:* V07 passes and `npm run experiment` writes `docs/RESULTS.md`.

**B23 — gate G2: does it work?** Run the standard experiment. If the thresholds in VALIDATION §2 are not met, tune for at most one hour in this order: memory decay, avoidance weight, random term. Report the result as it is.
*Accepted when:* `docs/RESULTS.md` holds a real table and `docs/status/lane-b.md` states pass or fail for each clause.

**B24 — dispatcher baseline.** Read: SPEC §5, CONTRACTS §8.
`createDispatcher()`: nearest idle rickshaw to the longest-waiting passenger, and low batteries to free plugs. Tested against hand-built snapshots.
*Accepted when:* unit tests pass and, once B02 lands, the dispatcher fleet out-delivers the random fleet.

**B25 — resilience experiments.** Read: VALIDATION §2.
Extend the runner: throughput against fraction removed, against fraction blind, and before and after the dispatcher is killed. Depends on B02 and B24.
*Accepted when:* the tables are in `docs/RESULTS.md`.

### Lane C — interface (Aryan, Pro)

**B40 — canvas shell on a fake simulation.** Read: CONTRACTS §11, the `WorldSnapshot`, `Simulation` and `MountApp` types.
`mountApp`, a renderer for map, rickshaws, passengers and chargers, and `src/ui/dev/fakeSimulation.ts`, a stand-in that implements `Simulation` with random motion so the UI never waits for the core.
*Accepted when:* `npm run dev` shows a moving city from the fake simulation, and V08 passes.

**B41 — three fleets and the scoreboard.** Read: SPEC §7, R07, R11.
Random, ours and dispatched side by side from one config, each labelled, with live metrics and a clear "dispatcher offline" state.
*Accepted when:* every number shown is read from `metrics()`, and the labels are readable from three metres.

**B42 — judge controls.** Read: CONTRACTS §9.
Tap a junction for a crowd, tap a street to close or reopen it, buttons for remove half, blind 20%, kill and revive the dispatcher, and charger on and off. Speed control, pause, reset, scenario picker and "play script". Every command goes to all fleets.
*Accepted when:* V09 passes.

**B43 — projector pass.** States are told apart by shape as well as colour, there is a legend, full-screen works, and the page holds a steady frame rate at demo speed on a laptop. Record the measured rate.

### Lane D — charging, scenarios and pitch (Aaron, Pro)

**B60 — scenarios.** Read: the `Scenario` and `Command` types, SPEC §7.
`standard`, `train-arrival`, `market-close` and `demo-3min`, the last one a scripted run of the demo in SPEC §7.
*Accepted when:* V10 passes.

**B61 — charge policies.** Read: SPEC §5, CONTRACTS §5 to §7.
`chargePolicy` (own threshold, balking at long queues, early top-up) and `naiveChargePolicy` (fixed threshold, always queues), tested against hand-built observations. No dependency on the core.
*Accepted when:* V02 passes and unit tests cover each rule.

**B62 — charging experiment.** Add a `charging-peak` scenario and compare the two charge policies with lane B's runner. Depends on B03 and B22.
*Accepted when:* `docs/RESULTS_CHARGING.md` holds the table and the status file says plainly whether staggering appeared.

**B63 — pitch pack.** Read: VALIDATION §4 to §6.
`docs/PITCH.md` (a three-minute script), `docs/CLAIMS.md` (the ledger filled from real results) and Devpost text. Search Devpost for similar projects and report what exists. Look up one or two real figures on rickshaws and charging, with sources.
*Accepted when:* every number in the pitch traces to a results file or a cited source.

**B64 — backup video support.** A shot list for the scripted scenario and a checklist for the human who records and uploads it.

## 4. Gates

| Gate | Target | Met when | If missed |
| --- | --- | --- | --- |
| G0 | 22:45 Sat | B00 merged, CI green, four lanes on their own branches | Lanes B to D keep working from `src/contracts.ts` and rebase later |
| G1 | 00:30 Sun | B01 merged; headless run delivers passengers; UI shows a city (fake or real) | Lane A drops everything else until it is met |
| G2 | 01:30 Sun | Experiment table exists and the claim's first clause is judged (VALIDATION §2) | One hour of tuning (B23), then §5 |
| G3 | 03:30 Sun | In a browser: three real fleets, crowd, road closure, removal, dispatcher kill | Cut per §5 until it is met |
| G4 | 05:30 Sun | Charging on, with the charging experiment run | Cut charging if G3 slipped past 04:30 |
| G5 | 09:00 Sun | Feature freeze. Scripted demo plays end to end from a clean checkout | Freeze anyway; ship what works |
| G6 | 10:30 Sun | Results regenerated on the frozen commit, backup video recorded, Devpost draft ready | Humans submit with what exists |

Submission is a human job and should happen at least 30 minutes before the deadline. The deadline is assumed to be about 12:00 on Sunday and has not been checked.

## 5. Cut order and what happens if G2 fails

Cut from the top when a gate slips:

1. The `blindRickshaws` command and its experiment.
2. Scenarios other than `standard` and `demo-3min`.
3. Charging altogether (R08, B03, B61, B62). The pitch becomes throughput only.
4. Side-by-side fleets, replaced by a toggle.

Never cut: determinism, the random baseline, the dispatcher kill, the experiment table and the backup video.

If G2 fails after tuning:

- **Ours beats random but not sight-only.** Memory and crowd avoidance add nothing measurable. The claim narrows to what the table shows. Keep building.
- **Ours does not beat random.** Lane B opens an issue titled `BLOCKED: G2 failed` containing the table. The humans decide what to pitch. The other lanes keep building, because the dispatcher-death demonstration does not depend on G2.

## 6. Decisions

| # | Decision | Status |
| --- | --- | --- |
| D01 | Browser-only TypeScript, no backend, no framework | Default; change only with a working alternative |
| D02 | No communication between rickshaws, and private memory instead of shared street marks | Fixed; it is the claim |
| D03 | Throughput first, charging second | Fixed |
| D04 | Three baselines: random, sight-only, dispatcher | Default |
| D05 | Pass thresholds in VALIDATION §2 | Team decision, open to change before G2 only |
| D06 | A plain grid, not a real city map | Default |
| D07 | Lane assignments in §2 | Proposed; confirm before starting |
| D08 | Self-merge on green CI, no reviews | Default |

Open for humans: the real submission deadline, which other tracks to enter, who presents, and who records the video.
