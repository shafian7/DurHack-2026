# Validation, experiments, demo and claims

**Status:** specification only. No test here has been written or run, and no result exists.
**Related:** [Spec](SPEC.md) · [Contracts](CONTRACTS.md) · [Build](BUILD.md)

## 1. Tests

Each test lives in the owning lane's test directory. "Hand-built" means the test constructs the input itself and does not need another lane's code.

| # | Checks | Lane | How |
| --- | --- | --- | --- |
| V01 | Determinism and identical demand (R04, R09) | A | Two runs with the same seed, mode and commands give identical metrics at every tick. Runs in different modes with the same seed have identical `spawned` at every tick |
| V02 | The emergence invariants E1 to E3 | B and D | A static check that each policy file imports only from `../contracts`, and contains no `Math.random`, no `Date` and no module-level `let` or mutable collection. A run-time check that `decide` works on deeply frozen observations, and that two rickshaws' memories never affect each other |
| V03 | Observation limits (R02) | A | With hand-placed rickshaws and passengers: nothing beyond `sightBlocks` appears, the observer is not counted, closed streets are not offered as exits |
| V04 | Passenger accounting (R01) | A | At every tick `spawned` equals waiting plus riding plus delivered plus abandoned. The longest-waiting passenger is picked up first. Passengers abandon at `patienceTicks` |
| V05 | Commands and dispatcher (R05, R06) | A | Each command has its documented effect. `removeRickshaws` removes the same ids in every mode. After `killDispatcher`, deliveries stop once jobs in hand finish, and resume after `reviveDispatcher` |
| V06 | Charging mechanics (R08) | A | Battery stays within 0 to 1. Plugs in use never exceed `plugs`. The queue is first come, first served. An offline charger charges nobody. A flat rickshaw stops |
| V07 | Experiment reproducibility (R10) | B | The same arguments write the same table. The output names the commit, seeds, scenario and config |
| V08 | UI reads only the contract (R11) | C | `mountApp` runs against the fake simulation. Nothing under `src/ui/` imports from `src/sim/` or `src/policies/` |
| V09 | Controls reach every fleet (R06) | C | With spy simulations, each control sends the same command to all of them on the same tick |
| V10 | Scenarios are valid (R12) | D | Every node id is within the scenario's grid, script ticks do not go backwards, and ids are unique |

## 2. The experiment behind the scoreboard

**Standard experiment.** Scenario `standard`, charging off, seeds 1 to 10, 3,600 ticks per run, all four modes. The first 600 ticks are warm-up and are excluded. The measure is passengers delivered per simulated minute over ticks 600 to 3,600, with mean wait and empty-distance share reported alongside.

Each clause of the claim is judged separately. The thresholds are team decisions (BUILD D05), set before any run so the result cannot move them.

| Clause | Passes when |
| --- | --- |
| "Clearly beats random wandering" | Mean throughput of `local` is at least 1.25 times `random`, and `local` is ahead in at least 8 of 10 seeds |
| "Memory and crowd avoidance matter" | `local` is ahead of `sight` in at least 7 of 10 seeds |
| "Comes close to a dispatcher" | Mean throughput of `local` is at least 0.75 times `dispatcher`. Report the ratio whatever it is |
| "Keeps working when the dispatcher dies" | With `killDispatcher` at tick 1,800, the dispatched fleet's throughput over the last 600 ticks is under 5% of its earlier level |

On the last clause: our fleet is unaffected by `killDispatcher` by construction, because it never had a dispatcher. Say that plainly. The evidence is the contrast, not a surprise.

**Resilience experiments (B25).** Throughput of each mode after removing 25%, 50% and 75% of the fleet at tick 1,800, and after blinding 20%. Report the curves. No threshold is set.

**Charging experiment (B62).** Scenario `charging-peak`, charging on, `chargePolicy` against `naiveChargePolicy`. Report mean charger queue time, rickshaws run flat, and throughput.

**Rules for results files.** They are written by the script, never by hand. Each names the commit, scenario, seeds and config. A result is quoted in the pitch only if it was regenerated on the frozen commit at G6.

## 3. Manual checks before the demo

- The built site runs from a file server with the network off.
- The scripted scenario plays end to end twice without a reload.
- The scoreboard is readable from three metres on the demo screen.
- Reset returns all fleets to identical starting states.
- Record the measured frame rate at demo speed, the laptop used, and the commit.

## 4. Demo script (about three minutes)

1. **The problem (20 s).** A city of rickshaws, no app, no radio. Each driver sees a couple of blocks.
2. **Three fleets (30 s).** Random, ours, and one with a central dispatcher, on identical passengers. Point at the scoreboard.
3. **A train arrives (30 s).** The judge taps a junction. Ours flows to it without being told.
4. **Break things (40 s).** Close a road and remove half of every fleet. Service thins and continues.
5. **Kill the dispatcher (30 s).** That fleet finishes its jobs and stops. Ours carries on.
6. **Charging, if built (20 s).** Take a charger offline and watch the queues spread.
7. **Why it is emergent (10 s).** Show the rickshaw's rule file: a few lines, no map of demand, no messages.

The `demo-3min` scenario replays steps 3 to 6 at fixed ticks for the backup video.

## 5. Claims ledger

Lane D keeps the live version in `docs/CLAIMS.md` and fills it from results files. Starting position:

| Statement | Status |
| --- | --- |
| Rickshaws exchange no messages and share no map | May say once V02 and V03 pass |
| Each rickshaw decides from what it sees within a couple of blocks and its own memory | May say once V02 and V03 pass |
| The fleet beats random wandering by some factor | Only with the G2 table, quoting the measured factor |
| The fleet reaches some share of a dispatcher's throughput | Only with the G2 table, quoting the measured share |
| The dispatched fleet stops when its dispatcher is killed and ours does not | May say once V05 passes; add "by construction" |
| Charging staggers itself without a schedule | Only with the charging table |
| It runs offline in a browser | May say once the §3 check is done |
| Anything about a real city, real rickshaw numbers or real charging networks | Only with a cited source found by lane D |
| "Optimal", "proven", or "each rickshaw optimises" | Must not say |
| That a real dispatch system has no fallback | Must not say. Ours models robots that rely on instructions |
| That nobody has built this before | Must not say unless the Devpost search supports it |

## 6. Research status

Checked during the research pass on 14 November:

- Winfield and Nembrini 2006, "Safety in numbers: fault-tolerance in robot swarms". Swarm robustness needs measuring, and half-broken agents can be worse than dead ones. This is why `blindRickshaws` exists.
- Gode and Sunder 1993, "Allocative efficiency of markets with zero-intelligence traders". Agents with no intelligence under a simple constraint reach high efficiency because of the system's structure.
- Deneubourg, Aron, Goss and Pasteels 1990, "The self-organizing exploratory pattern of the Argentine ant". Reinforcing what recently worked is enough for a group to settle on good routes.

From memory and not checked. Lane D verifies any of these before the pitch cites it:

- Arthur 1994, the El Farol bar problem, as the classic form of the charger problem.
- Fretwell and Lucas 1969, the ideal free distribution, as the coverage result.
- Bonabeau, Theraulaz and Deneubourg 1996, response thresholds, as the staggered-charging rule.
