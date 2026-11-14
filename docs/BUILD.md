# Build plan, lanes and gates

**Status:** plan written about 23:00 on Saturday 14 November 2026. No item below has been started. Times are targets, not progress.
**Related:** [Spec](SPEC.md) · [Contracts](CONTRACTS.md) · [Validation](VALIDATION.md) · [Handoffs](HANDOFFS.md)

## 1. Delivery policy

- Build the thinnest thing that proves each clause of the claim (SPEC §8), in the order the gates give. The interactive demo is the product.
- Four lanes work in parallel from the start. No lane waits for another: policies are tested against hand-built observations and a small bench, the UI against a fake simulation, and the core against trivial inline policies.
- All work lands on the `build` branch. PRs target `build` and merge on green CI with no sign-off (AGENTS.md). `main` needs a human review and receives one release PR at the end.
- Each lane records evidence in its own file, `docs/status/lane-<a|b|c|d>.md`, so four writers never touch one file. This document defines the items; the status files say what happened.

## 2. Lanes and file ownership

| Lane | Human | Plan | Owns |
| --- | --- | --- | --- |
| A — core and integration | Alex | Ultra | `package.json`, config files, `.github/`, `src/contracts.ts`, `src/sim/**`, `src/main.ts`, `tests/sim/**`, `AGENTS.md`, `docs/{README,SPEC,CONTRACTS,BUILD,VALIDATION,HANDOFFS}.md`, `docs/status/lane-a.md` |
| B — charger rules and experiments | Shafian | Pro | `src/policies/{naive,stagger,local}.ts`, `scripts/**`, `tests/policies/**`, `docs/RESULTS.md`, `docs/status/lane-b.md` |
| C — interface (closed) | Aryan | Pro | `docs/status/lane-c.md` only. The interface moved to lane D on 15 November |
| D — scheduler, scenarios, pitch and interface | Aaron | Pro | `index.html`, `src/ui/**`, `public/**`, `tests/ui/**`, `docs/UI.md`, `src/policies/scheduler.ts`, `src/scenarios/**`, `tests/scheduler/**`, `tests/scenarios/**`, `docs/{PITCH,CLAIMS,SOURCES}.md`, `docs/status/lane-d.md` |

The assignments carry over from baseline 0.1 and can be swapped before work starts. Once work starts they stay fixed.

## 3. Work items

Each item lists what to read, what to build and how it is accepted. V numbers refer to VALIDATION §1.

### Lane A — core and integration (Alex, Ultra)

**B00 — foundation.** Read: AGENTS, CONTRACTS §2 and §9.
Scaffold Vite, strict TypeScript and Vitest with scripts `dev`, `build`, `typecheck`, `test` and `experiment` (`tsx scripts/experiment.ts`). Add jsdom as a dev dependency so UI tests can opt in. Add a CI workflow that runs typecheck, test and build on every PR and on pushes to `build`. Add `createRng`, `defaultConfig` and the physics functions. Create the four empty status files. Do not create `index.html`; it is lane C's, so make `npm run build` pass without it.
*Accepted when:* a fresh clone passes `npm ci`, `npm run typecheck`, `npm test` and `npm run build`, and CI is green on `build`. Record the tested Node and package versions.

**B01 — the night.** Read: CONTRACTS §1 to §5 and §8.
Implement `createSimulation` for the `naive`, `stagger` and `local` modes: arrivals and departures, household load, voltage with its one-tick lag, policy calls, charging, metrics and `history()`. Depends on B00.
*Accepted when:* V01, V03 and V04 pass, and a headless three-day run with an inline always-on policy shows an evening load above the rating.

**B02 — protection, commands and central mode.** Read: CONTRACTS §6 and §7.
Transformer trips and outages, every command, central-mode mechanics, kill and revive. Depends on B01.
*Accepted when:* V05 and V06 pass.

**B03 — calibration.** Read: CONTRACTS §10, VALIDATION §2 clause 1.
Run the naive mode over seeds 1 to 10. Adjust `defaultConfig()` only if needed so that a naive night overloads and trips the transformer, while the energy the fleet needs still fits under the rating across the night. Use the naive mode alone for this. Depends on B02.
*Accepted when:* the status file holds the naive table before and after, each value changed, and the arithmetic for "it fits".

**B04 — integration.** Wire `src/main.ts` to the real modules as they land. Check three neighbourhoods run smoothly at demo speed and record the measured frame rate. Fix mismatches between lanes through contract PRs.
*Accepted when:* gate G3 is met in a browser.

**B05 — release.** Freeze, tag, build the static site, confirm it runs with the network off, and rehearse the demo script (VALIDATION §4) once from a clean checkout. Open one PR from `build` to `main` and leave it for a human to approve.

### Lane B — charger rules and experiments (Shafian, Pro)

**B20 — baselines.** Read: SPEC §5, CONTRACTS §5.
`naivePolicy` and `staggerPolicy`, tested against hand-built observations. No dependency on the core.
*Accepted when:* V02 passes for both, and unit tests show naive is always on and stagger stays off for its drawn delay and then stays on.

**B21 — the local rule.** Read: SPEC §2 and §5, CONTRACTS §2 and §5.
`localPolicy`: voltage-sag back-off with a random delay, longer after repeated back-offs, shorter for an emptier battery, and a randomised restart after a power cut. Thresholds and delays are named constants at the top of the file. Alongside it, write a small closed-loop bench under `tests/policies/` that puts 200 copies of a policy on the voltage formula in CONTRACTS §2, so the rule can be tuned before the core lands.
*Accepted when:* V02 passes; unit tests show it backs off on low voltage, that an emptier battery backs off less often, and that restarts after an outage are spread over several ticks; and on the bench the peak number of chargers drawing is lower than with naive.

**B22 — experiment runner.** Read: VALIDATION §2.
`scripts/experiment.ts`: run every mode over a list of seeds for a scenario and write a table to a file, with commit, seeds and config. Depends on B01.
*Accepted when:* V07 passes and `npm run experiment` writes `docs/RESULTS.md`.

**B23 — gate G2: does it work?** Run the standard experiment once B02 and B03 are on `build`. If the thresholds in VALIDATION §2 are not met, tune for at most one hour in this order: voltage threshold, back-off length, battery weighting. Report the result as it is.
*Accepted when:* `docs/RESULTS.md` holds a real table and `docs/status/lane-b.md` states pass or fail for each clause.

**B24 — resilience experiments.** Read: VALIDATION §2.
Extend the runner: the scheduler killed before the second evening; 10%, 20% and 40% stubborn chargers; a one-hour power cut at 23:00; a heatwave at 1.3 times household load. Depends on B02 and lane D's scheduler.
*Accepted when:* the tables are in `docs/RESULTS.md`.

### Lane C — interface (Aryan, Pro)

**Closed on 15 November.** B40 to B43 were built and merged, and the team rejected the result. B44 was not started and is replaced by a map switch in B65. Lane C's Claude should not be restarted. The interface is now lane D's item B65.

**B40 — load curve and neighbourhood on a fake simulation.** Read: CONTRACTS §8 and §9, the `WorldSnapshot`, `TickSample`, `Simulation` and `MountApp` types.
`mountApp`; a chart of load against time drawn from `history()`, with the rating line and outages marked; a neighbourhood view with one mark per charger along a street, showing away, waiting, charging, full and removed; and `src/ui/dev/fakeSimulation.ts`, a stand-in that implements `Simulation` with a plausible evening so the UI never waits for the core.
*Accepted when:* `npm run dev` shows a night playing from the fake simulation, and V08 passes.

**B41 — three neighbourhoods and the scoreboard.** Read: SPEC §7, R09, R12.
Naive, ours and scheduled side by side from one config, each labelled, plus one large chart overlaying the three load curves against the rating. Live metrics per neighbourhood: peak load, minutes overloaded, trips, minutes without power, share left charged, near and far. A clear "power out" state per neighbourhood and a clear "scheduler offline" state.
*Accepted when:* every number shown is read from `metrics()` or `history()`, and the labels are readable from three metres.

**B42 — judge controls.** Read: CONTRACTS §7.
Controls for every command: heatwave, derate, grid sag, power cut, plug-in burst, remove chargers, stubborn chargers, kill and revive the scheduler. Speed control, pause, reset, scenario picker and "play script". Every command goes to all neighbourhoods. Each command control carries a `data-cmd="<kind>"` attribute.
*Accepted when:* V09 passes.

**B43 — projector pass.** States are told apart by shape as well as colour, there is a legend and a clock, full-screen works, and the page holds a steady frame rate while a night plays in under a minute. Record the measured rate.

**B44 — the random-stagger comparison.** Read: SPEC §5 and §7, VALIDATION §2 clause 5 and §4.
A button, off by default, that adds a fourth neighbourhood running the `stagger` mode: its curve on the overlaid chart, labelled "Random delay, no sensing", and its row on the scoreboard. It is built from the same config and receives every command like the others. The default view stays at three neighbourhoods. Added on 15 November after B41 had merged.
*Accepted when:* turning it on mid-run shows the stagger curve for the same night from tick 0, a test shows commands reach the fourth simulation, and the three-neighbourhood view is unchanged when it is off.

### Lane D — scheduler, scenarios and pitch (Aaron, Pro)

**B60 — scenarios.** Read: the `Scenario` and `Command` types, SPEC §7.
`standard`, `heatwave`, `load-shedding` (a power cut in the evening), `growth` (300 chargers on the same transformer) and `demo-3min`, the last one a scripted run of the demo in SPEC §7.
*Accepted when:* V10 passes.

**B61 — the central scheduler.** Read: SPEC §5, CONTRACTS §2 and §7.
`createScheduler()`: at each plan, work out the headroom under the rating from the snapshot, and switch on the chargers with the least slack before departure, up to that headroom. Tested against hand-built snapshots. No dependency on the core.
*Accepted when:* unit tests show it never plans more load than the headroom when a feasible plan exists, and that it prefers the rickshaw that leaves soonest relative to the charge it still needs.

**B62 — sources and pitch.** Read: SPEC §1 and §8, VALIDATION §4 to §6.
`docs/SOURCES.md`: for every figure in SPEC §1, the source opened, its date, the exact wording, and whether it supports the figure. `docs/PITCH.md`: a three-minute script. Search Devpost and the literature for similar projects and for voltage- or frequency-responsive charging, and report what exists.
*Accepted when:* every number in the pitch traces to a results file or an entry in `docs/SOURCES.md`, and unsupported figures are marked as such.

**B63 — claims and Devpost text.** `docs/CLAIMS.md`, the ledger of VALIDATION §5 filled from real results, and a Devpost draft inside `docs/PITCH.md`. Depends on B23 for the numbers; leave marked gaps until they exist.

**B64 — backup video support.** A shot list for the scripted scenario and a checklist for the human who records and uploads it.

**B65 — the map interface.** Read: `docs/UI.md` in full, CONTRACTS §7 to §9, VALIDATION rows V08 and V09.
Rebuild the interface as the top-down map MVP in `docs/UI.md`: two maps by default (ordinary chargers and ours), three numbers under each, one evidence strip, one action bar, with the scheduler and random-delay maps as switches. Reuse the run loop, fake simulation and dev page already in `src/ui/`; replace the street view, styling, scoreboard, legend and controls. Added on 15 November.
*Accepted when:* V08 and V09 pass; the layout function's tests pass; `npm run typecheck`, `npm test` and `npm run build` pass; and the PR carries a screenshot of a real night at 1920 × 1080 that includes a power cut.

**B66 — iterate.** After B65 merges, stop. The team looks at it and gives changes. Do not add anything from UI §8 without being asked.

## 4. Gates

| Gate | Target | Met when | If missed |
| --- | --- | --- | --- |
| G0 | 23:45 Sat | B00 merged, CI green, four lanes on their own branches | Lanes B to D keep working from `src/contracts.ts` and rebase later |
| G1 | 01:15 Sun | B01 merged; a headless naive night shows the evening spike; the UI shows a night (fake or real) | Lane A drops everything else until it is met |
| G2 | 03:00 Sun | Experiment table exists and the claim's clauses are judged (VALIDATION §2) | One hour of tuning (B23), then §5 |
| G3 | 04:30 Sun | In a browser: three real neighbourhoods, the overlaid load curves, heatwave, power cut, scheduler kill | Cut per §5 until it is met |
| G4 | 06:00 Sun | All commands and scenarios in the UI, resilience tables written | Cut per §5 |
| G5 | 09:00 Sun | Feature freeze. Scripted demo plays end to end from a clean checkout | Freeze anyway; ship what works |
| G6 | 10:30 Sun | Results regenerated on the frozen commit, backup video recorded, Devpost draft ready, release PR approved by a human | Humans submit with what exists |

Submission is a human job and should happen at least 30 minutes before the deadline. The deadline is assumed to be about 12:00 on Sunday and has not been checked.

## 5. Cut order and what happens if G2 fails

Cut from the top when a gate slips:

1. The `plugInBurst`, `removeChargers` and `setSupplyVoltage` controls and their experiments.
2. Scenarios other than `standard` and `demo-3min`.
3. The neighbourhood view with one mark per charger. Keep the load curves and scoreboard.
4. Side-by-side neighbourhoods, replaced by one overlaid chart with a legend.

Never cut: determinism, the naive baseline, the overlaid load curve, the scheduler kill, the experiment table and the backup video.

If G2 fails after tuning:

- **Naive does not overload (clause 1).** The model does not show the problem. Lane A recalibrates in B03 against naive only and lane B reruns.
- **Ours flattens the peak but leaves more rickshaws uncharged than naive.** The claim narrows to the transformer. Say so, show the trade, and keep building.
- **Ours is no better than random stagger.** Sensing adds nothing measurable in this model. The claim narrows to "randomised chargers" and the pitch says so.
- **Ours does not flatten the peak.** Lane B opens an issue titled `BLOCKED: G2 failed` containing the table. The humans decide what to pitch. The other lanes keep building, because the scheduler-death demonstration does not depend on G2.

## 6. Decisions

| # | Decision | Status |
| --- | --- | --- |
| D01 | Browser-only TypeScript, no backend, no framework, no hardware | Fixed |
| D02 | A charger senses only its own socket voltage and battery. No messages, no clock | Fixed; it is the claim |
| D03 | Chargers are on or off at full power, like a relay. No dimming | Default |
| D04 | Three baselines: naive, random stagger, central scheduler | Default |
| D05 | Pass thresholds in VALIDATION §2 | Team decision, open to change before G2 only |
| D06 | A scheduled charger with no server charges whenever plugged in | Default; it is the fair fallback |
| D07 | The model is calibrated against the naive mode only | Fixed |
| D08 | Each night's arrivals are independent of how the last night went | Default; keeps every neighbourhood's night identical |
| D09 | Work lands on `build`; self-merge on green CI; one human-approved release PR to `main` | Default, because `main` requires a review |
| D10 | Lane assignments in §2 | Carried over; confirm before starting |

Open for humans: the real submission deadline, which other tracks to enter, who presents, who records the video, and who approves the release PR.
