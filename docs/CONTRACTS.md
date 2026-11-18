# Shared contracts — baseline 0.2

**Status:** working baseline. The types are in [`src/contracts.ts`](../src/contracts.ts). They have been read through but not yet compiled in this repository; B00 does that. This document says what they mean. Lane A owns both files.
**Related:** [Spec](SPEC.md) · [Build](BUILD.md) · [Validation](VALIDATION.md)

## 1. Cross-cutting rules

- **Units.** Time is in ticks, and one tick is one simulated minute. Power is in kW, energy in kWh, voltage in volts. Battery level is a fraction from 0 to 1.
- **The clock.** Tick 0 is 12:00 noon. A simulated day is 1,440 ticks, noon to noon, so each night sits in the middle of a day. The hour of day at a tick is `(12 + tick / 60) mod 24`.
- **Ids** are small integers, stable for the life of a simulation, and identical across neighbourhoods built from the same config.
- **Read-only data.** Everything handed to a policy, a scheduler or the UI is read-only. Only the sim core changes world state.
- **Determinism.** A simulation is a pure function of config, mode, dependencies and the commands applied at each tick.
- **Separate random streams**, all derived from `config.seed`: arrivals, household-load wobble, feeder layout, command targets, sensor noise and behaviour. Only the behaviour stream is passed to policies and the scheduler. The others never depend on what chargers do, so every neighbourhood sees the same night and the same judge actions.
- **No exceptions for bad actions.** A policy or scheduler that throws or returns something invalid is treated as `off` (or as an empty plan). An invalid command is ignored. Nothing throws in a running demo.

## 2. The physical model

It is deliberately simple. Every lane uses these formulas, so lane A exports them as pure functions from `src/sim/physics.ts` and other lanes may copy them into their own tests.

- **Household load.** `baseLoad.hourlyKw` gives 24 values, index 0 at midnight, linearly interpolated between hours. It is multiplied by the current base-load scale and by `1 + noiseShare × n`, where `n` is a slow wobble between −1 and 1.
- **Total load** in a tick is household load plus `charger.powerKw` for every charger drawing. A charger is either on at full power or off.
- **Busbar voltage:** `nominalVolts × supplyPu × (1 − sagAtRating × loadKw / ratingKw)`.
- **Socket voltage** for a charger at feeder position `f` (0 at the transformer, 1 at the far end): `nominalVolts × supplyPu × (1 − sagAtRating × (1 + feederExtraSag × f) × loadKw / ratingKw)`, plus that charger's sensor noise, never below 0.
- Sag always uses the configured `ratingKw`. Derating (`setRatingScale`) moves the overload and trip levels, not the wiring.
- **One-tick lag.** The voltage a charger reads in a tick comes from the load of the tick before. A charger never sees the effect of its own decision in the same tick.
- **Charging.** A charger that is on adds `powerKw × efficiency / (60 × batteryKwh)` to its battery each tick. At level 1 it stops by itself, whatever its policy says.
- **Feeder positions** are drawn once per charger from the layout stream.

## 3. The night

- At the start of each simulated day the arrivals stream draws, for every charger in id order, an arrival tick, a departure tick and an arrival battery level. Arrival times are normal around `arriveMeanHour`, departures normal around `departMeanHour` the next morning, and the level is uniform between `socMin` and `socMax`.
- Arrivals are clamped to at least three hours before the day ends, and departures to at least one hour after arrival and before the day ends.
- Each day's draw is independent. A rickshaw that left undercharged does not come back emptier. This keeps every neighbourhood's night identical.
- On departure the sim records the battery level. At or above `readyAtSoc` counts as ready.

## 4. Tick order

`step()` does these in order:

1. Apply commands queued since the last tick.
2. Departures. At a day boundary, draw the day's schedule. Arrivals.
3. Work out household demand for this tick.
4. If an outage has reached its end, restore power. The first voltages after an outage come from household load alone.
5. Give every plugged-in charger its socket voltage from the previous tick's load. During an outage it is 0.
6. Central mode only: if the scheduler is alive and `tick % scheduleIntervalTicks === 0`, call `plan()` and store the valid ids as the allowed set.
7. For each plugged-in charger that is not full, in id order, get its decision. During an outage nobody draws whatever they decide.
8. Add up the load. Update the peak, the overload count and the protection counter.
9. Add charge to every charger that drew.
10. Record the tick's sample for `history()`. If the protection counter has reached `tripAfterTicks`, the outage begins with the next tick. Increase `tick`.

## 5. Decision points and the Observation

A policy is asked once per tick for every charger that has a rickshaw plugged in, is not full and has not been removed. It is asked during an outage too, with `voltage` 0, so it can notice the power going and coming back.

The `Observation` contains only:

- `voltage`: this charger's socket voltage this tick, with noise;
- `nominalVolts`: the voltage printed on the device;
- `soc`: the battery level of the rickshaw plugged in;
- `drawing`: whether this charger drew on the previous tick;
- `pluggedTicks`: ticks since this rickshaw plugged in.

It has no clock, no id, no feeder position, no count of chargers and nothing about the transformer. Nothing may be added without a contract change, because this type is the boundary that makes the behaviour emergent.

`createMemory` is called once per charger when the simulation is built. The memory lasts for the whole run, across nights. `onEvent` delivers `pluggedIn` and `unplugged`. Memory is changed only inside `decide` and `onEvent`, and only the object passed in.

## 6. Transformer protection

- **Overloaded** means load above the current rating, `ratingKw × rating scale`. Each such tick adds one to `overloadTicks`.
- **Trip.** If load stays above `rating × tripLoadShare` for `tripAfterTicks` ticks in a row, the transformer trips. For the next `outageTicks` ticks nothing is powered: no household load is served, no charger draws and every voltage is 0. Then power returns to everything at once.
- `trips` counts protection trips only. `outageTicks` counts every unpowered tick, including those from `powerCut`.

## 7. Central mode and commands

- In central mode no policy is asked. A charger draws when it is in the allowed set from the latest `plan()`. A rickshaw that plugs in between plans waits for the next one.
- `plan()` receives the full `WorldSnapshot`, including each plugged-in rickshaw's `departTick`.
- After `killScheduler`, `plan()` is not called and every charger draws whenever plugged in. `reviveScheduler` resumes planning at the next interval.

| Command | Meaning |
| --- | --- |
| `setBaseLoadScale` | Multiply household demand by `scale` from now on. 1 is normal |
| `setRatingScale` | Multiply the rating, and so the overload and trip levels, by `scale`. 1 is normal |
| `setSupplyVoltage` | Set the supply voltage to `perUnit` of nominal. 1 is normal. A grid-wide sag that is not this neighbourhood's doing |
| `powerCut` | No power for `ticks` ticks from the next tick. Not counted in `trips` |
| `plugInBurst` | Up to `count` rickshaws that are away and due home today arrive now, with their scheduled battery level. Ids come from the command stream |
| `removeChargers` | That fraction of the chargers still present in the model disappear for good. Ids come from the command stream, so the same ids go in every neighbourhood. A plugged-in rickshaw is recorded as a departure |
| `stubbornChargers` | That fraction, chosen the same way, draw whenever plugged in from now on, ignoring their policy or the scheduler |
| `killScheduler` / `reviveScheduler` | See above. No effect outside central mode |

Commands take effect at the start of the next tick. A command with a value that makes no sense (negative, not a number) is ignored.

## 8. Metrics and history

- `loadShare`, `peakLoadShare`: load divided by the current rating. Above 1 is overloaded.
- `peakLoadKw`, `overloadTicks`, `trips`, `outageTicks`, `energyDeliveredKwh`, `departures`, `readyDepartures`: totals since tick 0.
- `readyShare`: ready departures divided by departures. `readyShareNear` and `readyShareFar` split this by feeder position below and from 0.5, so unfairness along the street is visible.
- `minSocketVolts`: the lowest socket voltage any plugged-in charger has read while the power was on.
- `history()` returns one `TickSample` per simulated tick, oldest first, keeping the latest 2,880. The UI draws the load curve from it and must not keep its own copy of the numbers.

## 9. What each module exports

| File | Lane | Export |
| --- | --- | --- |
| `src/sim/index.ts` | A | `createSimulation: CreateSimulation`, `defaultConfig(): SimConfig`, `createRng(seed: number): Rng` |
| `src/sim/physics.ts` | A | `hourOfDay`, `baseLoadKw`, `busVolts`, `socketVolts`, `socGainPerTick`, as pure functions of config and numbers |
| `src/policies/naive.ts` | B | `naivePolicy: ChargerPolicy` |
| `src/policies/stagger.ts` | B | `staggerPolicy: ChargerPolicy` |
| `src/policies/local.ts` | B | `localPolicy: ChargerPolicy` |
| `src/policies/scheduler.ts` | D | `createScheduler(): Scheduler` |
| `src/scenarios/index.ts` | D | `scenarios: readonly Scenario[]` |
| `src/ui/index.ts` | C | `mountApp: MountApp` |
| `src/main.ts` | A | none; wires the above together |

There is no `src/policies/index.ts`, so lanes B and D never edit the same file. Policy files import only from `../contracts`.

## 10. Default configuration (starting values, untested)

| Field | Value |
| --- | --- |
| `fleetSize` | 200 |
| `transformer.ratingKw` | 220 |
| `transformer.nominalVolts` | 230 |
| `transformer.sagAtRating` | 0.08 |
| `transformer.feederExtraSag` | 0.5 |
| `transformer.sensorNoiseVolts` | 1 |
| `transformer.tripLoadShare` | 1.15 |
| `transformer.tripAfterTicks` | 10 |
| `transformer.outageTicks` | 30 |
| `baseLoad.hourlyKw` (midnight first) | 55, 50, 48, 46, 46, 50, 62, 75, 80, 78, 76, 78, 82, 80, 78, 78, 82, 92, 104, 112, 114, 110, 96, 72 |
| `baseLoad.noiseShare` | 0.04 |
| `charger.powerKw` | 1.0 |
| `charger.batteryKwh` | 7 |
| `charger.efficiency` | 0.85 |
| `charger.readyAtSoc` | 0.9 |
| `arrivals.arriveMeanHour`, `arriveSdMinutes` | 21.5, 60 |
| `arrivals.departMeanHour`, `departSdMinutes` | 7, 40 |
| `arrivals.socMin` to `socMax` | 0.1 to 0.5 |
| `scheduleIntervalTicks` | 5 |

These come from rough arithmetic: with everyone charging at once the load is about 200 kW of chargers on top of about 100 kW of households, well over a 220 kW rating, while the energy the fleet needs fits under the rating if it is spread from evening to morning. None of it is measured. Lane A calibrates in B03 **against the naive mode only**, so that the model shows the problem without being tuned to flatter our rule, and records every change in its status file. Policy thresholds are not here; they live in the policy files.

## 11. Changing a contract

Open one PR that changes `src/contracts.ts`, this document, and every producer, consumer and test affected, and name the change in the description. Lanes that are not the owner may open that PR. Additive optional fields are cheap. Renames and meaning changes are expensive and should be rare after gate G1.
