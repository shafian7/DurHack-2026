# Validation, experiments, demo and claims

**Status:** specification only. No test here has been written or run, and no result exists.
**Related:** [Spec](SPEC.md) · [Contracts](CONTRACTS.md) · [Build](BUILD.md)

## 1. Tests

Each test lives in the owning lane's test directory. "Hand-built" means the test constructs the input itself and does not need another lane's code.

| # | Checks | Lane | How |
| --- | --- | --- | --- |
| V01 | Determinism and an identical night (R04, R10) | A | Two runs with the same seed, mode and commands give identical metrics at every tick. Runs in different modes with the same seed have identical arrivals, departure times and household demand at every tick |
| V02 | The emergence invariants E1 to E3 | B | A static check that each of `naive.ts`, `stagger.ts` and `local.ts` imports only from `../contracts`, and contains no `Math.random`, no `Date` and no module-level `let` or mutable collection. A run-time check that `decide` works on frozen observations, and that two chargers' memories never affect each other |
| V03 | Observation limits and the voltage law (R02, R05) | A | The observation handed to a policy has exactly the five fields. With a hand-set load, socket voltages match CONTRACTS §2, fall with feeder position, and lag the load by one tick |
| V04 | Rickshaw accounting (R01) | A | Battery level stays within 0 to 1. Every arrival is followed by one departure. `readyDepartures` counts exactly those at or above `readyAtSoc`. Energy delivered equals charger-ticks times power |
| V05 | Protection and outages (R06) | A | Load held above the trip level for `tripAfterTicks` trips the transformer; one tick fewer does not. During an outage nothing draws and voltages are 0. Power returns after `outageTicks` |
| V06 | Commands and the scheduler (R07, R08) | A | Each command has its documented effect and bad values are ignored. `removeChargers` and `stubbornChargers` pick the same ids in every mode. After `killScheduler` every plugged-in charger draws; after `reviveScheduler` planning resumes |
| V07 | Experiment reproducibility (R11) | B | The same arguments write the same table. The output names the commit, seeds, scenario and config |
| V08 | UI reads only the contract (R12) | C | `mountApp` runs against the fake simulation. Nothing under `src/ui/` imports from `src/sim/`, `src/policies/` or `src/scenarios/` |
| V09 | Controls reach every neighbourhood (R08) | C | With spy simulations, activating each `data-cmd` control sends the same command to all of them on the same tick |
| V10 | Scenarios are valid (R12) | D | Ids are unique, `configure` returns a complete config without changing its input, script ticks do not go backwards and stay within `durationTicks`, and every command value is sensible |

## 2. The experiment behind the scoreboard

**Standard experiment.** Scenario `standard`, seeds 1 to 10, three simulated days (4,320 ticks) per run, all four modes. The first day is warm-up and is excluded, so two nights are measured. Reported per mode: peak load as a share of the rating, minutes overloaded per night, trips per night, minutes without power per night, share of rickshaws leaving ready, the same for the near and far halves of the feeder, and lowest socket voltage.

Each clause of the claim is judged separately. The thresholds are team decisions (BUILD D05), set before any run so the result cannot move them.

| # | Clause | Passes when |
| --- | --- | --- |
| 1 | "Naive charging overloads the transformer" | `naive` has at least one trip in at least 8 of 10 seeds. This checks the model, not our rule. If it fails, lane A recalibrates (BUILD B03) |
| 2 | "Flattens the peak" | Mean peak load of `local` is at most 0.85 times `naive`, `local` is lower in at least 8 of 10 seeds, and `local` has at most a tenth of `naive`'s overloaded minutes |
| 3 | "Keeps the transformer on" | `local` has zero trips in at least 8 of 10 seeds |
| 4 | "Still sends rickshaws out charged" | Mean ready share of `local` is at least that of `naive`, and no more than 0.10 below `central`. Report all three whatever they are |
| 5 | "Sensing matters, not just randomness" | `local` has fewer overloaded minutes than `stagger` in at least 7 of 10 seeds, without a lower mean ready share |
| 6 | "Nothing to fail" | With `killScheduler` applied at tick 1,800 (18:00 on the second day), `central` trips at least once afterwards in at least 8 of 10 seeds |

On clause 6: our chargers are unaffected by `killScheduler` by construction, because they never had a scheduler. Say that plainly. The evidence is the contrast, not a surprise.

**Fairness.** Report the near and far ready shares for `local` in every table. No threshold is set. If the far half does clearly worse, the pitch says so.

**Resilience experiments (B24).** Each mode with 10%, 20% and 40% stubborn chargers from tick 0; with a 60-tick `powerCut` at 23:00 on the second day; and with household load at 1.3 times from tick 0. Report the same measures. No threshold is set.

**Rules for results files.** They are written by the script, never by hand. Each names the commit, scenario, seeds and config. A result is quoted in the pitch only if it was regenerated on the frozen commit at G6.

## 3. Manual checks before the demo

- The built site runs from a file server with the network off.
- The scripted scenario plays end to end twice without a reload.
- The overlaid load curve and the scoreboard are readable from three metres on the demo screen.
- Reset returns all neighbourhoods to identical starting states.
- Record the measured frame rate at demo speed, the laptop used, and the commit.

## 4. Demo script (about three minutes)

1. **The problem (25 s).** A neighbourhood, one transformer, two hundred rickshaws that all come home and plug in. Only figures with a source in `docs/SOURCES.md`.
2. **Tonight, three ways (35 s).** Naive, ours and scheduled on the same night. Evening arrives. The naive curve goes through the rating and the lights go out. Ours bends under it.
3. **Make it harder (30 s).** The judge turns on a heatwave or derates the transformer. Ours makes room.
4. **Cut the power (30 s).** An hour of load-shedding. When it returns, naive slams back and trips again. Ours comes back in a trickle.
5. **Kill the server (30 s).** The scheduled neighbourhood becomes the naive one. Ours carries on.
6. **Why it is emergent (20 s).** Show the charger's rule file: a few lines, one input, no clock, no messages. Then the two honest caveats from SPEC §8.

The `demo-3min` scenario replays steps 2 to 5 at fixed ticks for the backup video.

## 5. Claims ledger

Lane D keeps the live version in `docs/CLAIMS.md` and fills it from results files. Starting position:

| Statement | Status |
| --- | --- |
| Each charger decides from its own socket voltage and battery level, and nothing else | May say once V02 and V03 pass |
| Chargers exchange no messages and there is no server | May say once V02 passes |
| Naive charging overloads this model's transformer | Only with the G2 table, clause 1 |
| The local rule cuts the peak by some factor and avoids trips | Only with the G2 table, quoting the measured figures |
| Rickshaws still leave charged | Only with the G2 table, quoting the measured shares, near and far |
| The scheduled neighbourhood reverts to the spike when its server dies and ours does not | May say once V06 passes and clause 6 is run; add "by construction" for ours |
| It runs offline in a browser | May say once the §3 check is done |
| Any figure about Bangladesh, rickshaw numbers, the supply deficit or the cost of illegal charging | Only with a source in `docs/SOURCES.md` that lane D opened |
| That the model matches a real feeder, transformer or charger | Must not say. It is a sketch with stated assumptions |
| "Optimal", "proven", or "each charger optimises" | Must not say |
| That this would fix load-shedding or the national deficit | Must not say. It is about one transformer's peak |
| That nobody has built this before | Must not say. Voltage- and frequency-responsive charging is an existing field |

## 6. Research and source status

**Figures from the idea brief, none checked.** Lane D opens a source for each and records it in `docs/SOURCES.md` before it is used:

- Over 60 lakh battery-run rickshaws in Bangladesh, 10 to 12 lakh in Dhaka, attributed to BRTA.
- Night charging overloading local transformers and being left out of load forecasts, attributed to officials.
- August demand of 16,059 MW against 12,388 MW of supply.
- Illegal charging costing around Tk 4,000 crore a year, attributed to the Home Minister in Parliament.
- A government move to register the vehicles.

**Comparisons from memory, none checked.** Lane D verifies any of these before the pitch cites it:

- Jacobson 1988, "Congestion avoidance and control", and Chiu and Jain 1989 on additive increase and multiplicative decrease, as the model for backing off under congestion.
- Ethernet's randomised exponential back-off, as the model for the random delay.
- Firefly-inspired desynchronisation in sensor networks, as the model for spreading out in time.
- Grid-friendly appliances and droop-style demand response that react to local frequency or voltage, as the closest existing work. This is why novelty must not be claimed.

**Model assumptions that need a source or a plain caveat:** battery size, charger power, transformer rating, the household load curve and the voltage sag at full load (CONTRACTS §10). Lane D looks for one or two real figures. Until then the pitch calls them assumptions.
