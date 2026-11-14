# Shared contracts — baseline 0.1

**Status:** working baseline. The types are in [`src/contracts.ts`](../src/contracts.ts), which type-checks under strict TypeScript. This document says what they mean. Lane A owns both files.
**Related:** [Spec](SPEC.md) · [Build](BUILD.md) · [Validation](VALIDATION.md)

## 1. Cross-cutting rules

- **Units.** Distance is in blocks. Time is in ticks, and one tick is one simulated second. Battery is a fraction from 0 to 1. Rates are per tick unless the name says otherwise.
- **Ids** are small integers, stable for the life of a simulation, and identical across fleets built from the same config.
- **Read-only data.** Everything handed to a policy, a dispatcher or the UI is read-only. Only the sim core changes world state.
- **Determinism.** A simulation is a pure function of config, mode, dependencies and the commands applied at each tick.
- **Three random streams**, all derived from `config.seed`: demand, commands and behaviour. Demand and command streams never depend on what a fleet does, so every fleet sees identical passengers and identical judge actions.
- **No exceptions for bad actions.** An invalid action from a policy or dispatcher is treated as `wait` (or ignored, for an assignment) and counted. It never throws in a running demo.

## 2. Map and movement

- The map is a rectangular grid: `gridWidth × gridHeight` junctions, each joined to its neighbours by a street one block long. Node `id = y * gridWidth + x`.
- A rickshaw is either at a junction or part-way along a street. It moves `speedBlocksPerTick` each tick and cannot turn round mid-street.
- Routes are shortest paths over open streets. Any tie-break is fine if it is deterministic.
- `closeRoad` on a street that would disconnect the map is ignored. A rickshaw already on a street when it closes finishes it.

## 3. Passengers

- Each tick the demand stream may add passengers: the base rate spreads origins evenly over junctions, and each active hotspot adds its own rate at its junction. Destinations are uniform over the other junctions.
- A passenger who has waited `patienceTicks` becomes `abandoned`.
- **Pickup is mechanical and the same for every fleet.** When an empty rickshaw that is cruising, idle or heading to a passenger arrives at a junction with waiting passengers, it picks up the one who has waited longest. If two rickshaws arrive on the same tick, the lower id wins.
- A carrying rickshaw drives the shortest open route to the destination and drops the passenger on arrival. No policy is consulted during a ride.

## 4. Tick order

`step()` does these in order:

1. Apply commands queued since the last tick.
2. Add new passengers. Mark abandonments.
3. Dispatcher mode only: if the dispatcher is alive and `tick % dispatchIntervalTicks === 0`, call `plan()` and apply the valid assignments.
4. Chargers: add charge to plugged-in rickshaws, unplug any at `fullAt`, move queue heads onto free plugs.
5. For each rickshaw in id order: ask for a decision if it is at a decision point, move it, drain its battery, then handle arrival (drop-off, pickup, queue arrival, running flat).
6. Update metrics. Increase `tick`.

## 5. Decision points and the Observation

A local policy is asked to decide only when its rickshaw is:

- at a junction and `cruising`;
- at a junction heading to a passenger who is no longer waiting (it receives a `missedPassenger` event first and becomes `cruising`);
- arriving at the charger it was heading for;
- `queuing`, once every `queueRecheckTicks`.

When charging is enabled the charge policy is asked first. Any answer other than `continue` is acted on. On `continue` the cruise policy is asked.

The `Observation` contains only:

- the rickshaw's own id, junction, battery, state and time spent queuing;
- the open exits from its junction, each with a count of empty rickshaws and waiting passengers visible in that direction;
- waiting passengers and chargers within `sightBlocks` by street distance;
- the charger at this junction, if any;
- where the chargers are. This is static map knowledge, like the streets, and carries no queue or status information beyond sight.

"Visible in that direction" means within `sightBlocks` and on a shortest route that starts with that exit. An "empty rickshaw" is one that is cruising or idle. The observer is never counted.

Nothing else may be added to `Observation` without a contract change, because this type is the boundary that makes the behaviour emergent.

## 6. Actions

| Action | Valid when | Effect |
| --- | --- | --- |
| `exit` | `edge` is one of `obs.exits` | Drive one block, then decide again |
| `toPassenger` | `passenger` is in `obs.visiblePassengers` | Drive the shortest route to that junction |
| `wait` | always | Stay one tick, then decide again |
| `continue` | always | Charge policy declines; cruise policy decides |
| `toCharger` | `charger` is in `obs.knownChargerNodes` | Drive the shortest route to it |
| `joinQueue` | `obs.chargerHere` is set and online | Take a free plug or join the back of the queue |
| `leaveQueue` | state is `queuing` | Leave the queue and become `cruising` |

Memory is changed only inside `decide` and `onEvent`, and only the object passed in.

## 7. Charging mechanics

- Driving one block uses `drainPerBlock`. A plugged-in rickshaw gains `chargePerTick` per tick and unplugs at `fullAt`.
- A charger has `plugsPerCharger` plugs and a first-come queue. An offline charger charges nobody; rickshaws on its plugs are moved back to the head of its queue and wait there.
- A rickshaw whose battery reaches 0 becomes `flat` at the next junction and stays out of service. A passenger it was carrying is counted as abandoned.
- With `charging.enabled` false, batteries stay at 1 and no charge policy is asked.

## 8. Dispatcher mode

- Rickshaws with no job are `idle` and stand still.
- An assignment is applied only if the rickshaw is `idle` and the passenger is still waiting or the charger exists. Others are ignored.
- A rickshaw sent to a charger joins it on arrival without asking anything.
- After `killDispatcher`, `plan()` is not called. Rickshaws finish the job in hand and become `idle`. `reviveDispatcher` resumes planning.

## 9. Commands

| Command | Meaning |
| --- | --- |
| `spawnCrowd` | Add `count` waiting passengers at `node` with random destinations from the demand stream |
| `closeRoad` / `openRoad` | Close or reopen a street (see §2) |
| `removeRickshaws` | Remove that fraction of the active fleet. The ids are drawn from the command stream, so the same ids go in every fleet. A carried passenger is counted as abandoned |
| `blindRickshaws` | That fraction, chosen the same way, ignore their observations from now on and take random exits. In dispatcher mode they ignore assignments |
| `setCharger` | Take a charger offline or bring it back |
| `killDispatcher` / `reviveDispatcher` | See §8. No effect on other fleets |

Commands take effect at the start of the next tick.

## 10. Metrics

- `deliveredPerMinute`: deliveries in the last 600 ticks divided by 10. This is the headline throughput number.
- `meanWaitTicks`: for passengers picked up in the last 600 ticks, the mean of pickup tick minus spawn tick.
- `emptyDistanceShare`: blocks driven with no passenger divided by all blocks driven, since tick 0.
- `chargerQueueMeanTicks`: mean queue time for charges that started in the last 600 ticks.
- `flatCount`, `abandoned`, `delivered`, `spawned`: totals since tick 0.

## 11. What each module exports

| File | Lane | Export |
| --- | --- | --- |
| `src/sim/index.ts` | A | `createSimulation: CreateSimulation`, `defaultConfig(): SimConfig`, `createRng(seed: number): Rng`, `noChargePolicy: ChargePolicy` |
| `src/policies/random.ts` | B | `randomPolicy: CruisePolicy` |
| `src/policies/sight.ts` | B | `sightPolicy: CruisePolicy` |
| `src/policies/local.ts` | B | `localPolicy: CruisePolicy` |
| `src/policies/dispatcher.ts` | B | `createDispatcher(): Dispatcher` |
| `src/policies/charging.ts` | D | `chargePolicy: ChargePolicy`, `naiveChargePolicy: ChargePolicy` |
| `src/scenarios/index.ts` | D | `scenarios: readonly Scenario[]` |
| `src/ui/index.ts` | C | `mountApp: MountApp` |
| `src/main.ts` | A | none; wires the above together |

There is no `src/policies/index.ts`, so lanes B and D never edit the same file.

## 12. Default configuration (starting values, untested)

| Field | Value |
| --- | --- |
| `gridWidth` × `gridHeight` | 12 × 12 |
| `fleetSize` | 60 |
| `sightBlocks` | 2 |
| `speedBlocksPerTick` | 0.1 |
| `patienceTicks` | 600 |
| `demand.baseRatePerTick` | 0.12 |
| `demand.hotspots` | two junctions at 0.06 each, always on |
| `charging.enabled` | false until gate G4 |
| `charging.chargerNodes` | four junctions, one per quadrant |
| `charging.plugsPerCharger` | 2 |
| `charging.drainPerBlock` | 0.004 |
| `charging.chargePerTick` | 0.003 |
| `charging.startBatteryMin` to `Max` | 0.4 to 1.0 |
| `charging.fullAt` | 0.95 |
| `dispatchIntervalTicks` | 5 |
| `queueRecheckTicks` | 30 |

These were chosen by rough arithmetic so that the fleet is busy but not hopeless. Lane A may change them in `defaultConfig()` after the first runs, and records the change in its status file. Policy weights are not here; they live in the policy files.

## 13. Changing a contract

Open one PR that changes `src/contracts.ts`, this document, and every producer, consumer and test affected, and name the change in the description. Lanes that are not the owner may open that PR. Additive optional fields are cheap. Renames and meaning changes are expensive and should be rare after gate G1.
