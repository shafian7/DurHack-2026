# Results

_Written by `npm run experiment` (scripts/experiment.ts). Do not edit by hand (VALIDATION §2)._

- **Commit:** `0f4adbe`
- **Scenario:** `standard` (A normal night), 4320 ticks per run
- **Seeds:** 1 to 10
- **Warm-up:** the first 1440 ticks (one day) are excluded; 2 nights are measured
- **Modes:** naive, stagger, local, central

Peak is the highest one-tick load over the measured nights as a share of the rating, averaged over seeds. Per-night figures are averaged over the measured nights and then over seeds. Ready shares count rickshaws that left at or above `readyAtSoc` during the measured nights; near and far are the halves of the feeder. Lowest socket V is the lowest reading at any plugged-in charger while energised, over all seeds.

## Headline: three systems, six scenarios, one table

The Dhanmondi map: two transformers, 200 rickshaws, three simulated days from tick 0, seeds as above. Each scenario hits all three systems with the same events at the same moment. **Ordinary**: charge flat out. **App-controlled**: a utility server schedules every charger over the mobile network; without it, chargers charge flat out. **Smart (ours)**: each charger senses only its own socket voltage.

| Scenario | System | Runs with a burst | Median first burst | Worst peak load | Hottest | Overloaded min / night | Building-hours dark | Left fully charged | Far end fully charged | Avg battery at departure | Not charged / night |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Normal night** | Ordinary | 10 of 10 | night 1, 23:31 | 136% | 140 °C | 292 | 18,705 | 50.2% | 50.2% | 68.8% | 99.6 of 200 |
|  | App-controlled | 0 of 10 | – | 97% | 105 °C | 0 | 0 | 99.9% | 99.9% | 100.0% | 0.2 of 200 |
|  | Smart (ours) | 0 of 10 | – | 110% | 115 °C | 216 | 0 | 96.4% | 95.6% | 99.1% | 7.1 of 200 |
| **Network down from 21:00** | Ordinary | 10 of 10 | night 1, 23:31 | 136% | 140 °C | 292 | 18,705 | 50.2% | 50.2% | 68.8% | 99.6 of 200 |
|  | App-controlled | 10 of 10 | night 1, 23:31 | 136% | 140 °C | 293 | 18,704 | 50.1% | 50.1% | 68.8% | 99.7 of 200 |
|  | Smart (ours) | 0 of 10 | – | 110% | 115 °C | 216 | 0 | 96.4% | 95.6% | 99.1% | 7.1 of 200 |
| **Heatwave (homes use 30% more)** | Ordinary | 10 of 10 | night 1, 22:44 | 144% | 141 °C | 73 | 48,226 | 0.1% | 0.0% | 35.5% | 199.9 of 200 |
|  | App-controlled | 0 of 10 | – | 98% | 105 °C | 0 | 0 | 99.9% | 99.9% | 99.9% | 0.2 of 200 |
|  | Smart (ours) | 0 of 10 | – | 121% | 130 °C | 574 | 0 | 94.8% | 93.5% | 98.7% | 10.5 of 200 |
| **1-hour power cut at 22:00 (towers fail after 30 min)** | Ordinary | 10 of 10 | night 1, 00:42 | 136% | 140 °C | 296 | 19,101 | 50.3% | 50.2% | 69.7% | 99.5 of 200 |
|  | App-controlled | 0 of 10 | – | 136% | 105 °C | 13 | 789 | 99.8% | 99.8% | 100.0% | 0.3 of 200 |
|  | Smart (ours) | 0 of 10 | – | 113% | 102 °C | 48 | 789 | 90.3% | 89.5% | 97.6% | 19.4 of 200 |
| **20% of chargers ignore the rule** | Ordinary | 10 of 10 | night 1, 23:31 | 136% | 140 °C | 292 | 18,705 | 50.2% | 50.2% | 68.8% | 99.6 of 200 |
|  | App-controlled | 0 of 10 | – | 100% | 104 °C | 0 | 0 | 99.9% | 99.9% | 100.0% | 0.2 of 200 |
|  | Smart (ours) | 0 of 10 | – | 113% | 117 °C | 307 | 0 | 96.9% | 96.1% | 99.2% | 6.2 of 200 |
| **Worst night: heatwave, 20% rule-breakers, network down from 21:00** | Ordinary | 10 of 10 | night 1, 22:44 | 144% | 141 °C | 73 | 48,226 | 0.1% | 0.0% | 35.5% | 199.9 of 200 |
|  | App-controlled | 10 of 10 | night 1, 22:44 | 144% | 140 °C | 70 | 48,219 | 0.1% | 0.0% | 35.4% | 199.9 of 200 |
|  | Smart (ours) | 0 of 10 | – | 123% | 131 °C | 600 | 0 | 95.4% | 94.3% | 98.9% | 9.2 of 200 |

- **Runs with a burst:** runs (of the seeds) in which a transformer overheated past its burst point. A burst transformer stays dark for the rest of the run.
- **Worst peak load:** the highest one-minute load on either transformer, as a share of its rating, over all runs.
- **Overloaded min / night:** minutes per night any transformer spent above its rating (above the rating is not the same as bursting; heating is gradual).
- **Building-hours dark:** buildings without power times hours, over the three days.
- **Left fully charged:** rickshaws that left at 90% or more. **Not charged / night:** those that left below 90%.
- Transformer heating and the burst point are illustrative model values (plan.md §3.3). Tower backup during power cuts is an assumed 30 minutes.

## Standard experiment

| Mode | Peak / rating | Overloaded min / night | Trips / night | Min without power / night | Ready | Ready near | Ready far | Lowest socket V | Seeds with a trip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| naive | 119.2% | 234.6 | 2.50 | 75.0 | 99.0% | 98.9% | 99.2% | 194.4 | 10 of 10 |
| stagger | 110.5% | 154.1 | 0.00 | 0.0 | 95.9% | 95.9% | 95.8% | 195.7 | 0 of 10 |
| local | 100.5% | 3.0 | 0.00 | 0.0 | 99.1% | 99.7% | 98.5% | 199.1 | 0 of 10 |
| central | 97.1% | 0.0 | 0.00 | 0.0 | 99.9% | 99.8% | 100.0% | 199.2 | 0 of 10 |

## The claim, clause by clause (VALIDATION §2)

| # | Clause | Verdict | Detail |
| --- | --- | --- | --- |
| 1 | Naive charging overloads the transformer | PASS | naive tripped in 10 of 10 seeds (needs at least 8) |
| 2 | Flattens the peak | PASS | mean peak local/naive = 0.843 (needs ≤ 0.85); lower in 10 of 10 seeds (needs ≥ 8); overloaded minutes local/naive = 0.013 (needs ≤ 0.10) |
| 3 | Keeps the transformer on | PASS | local had zero trips in 10 of 10 seeds (needs at least 8) |
| 4 | Still sends rickshaws out charged | PASS | ready share local 99.1%, naive 99.0%, central 99.9% (local needs ≥ naive and ≥ central − 10 points) |
| 5 | Sensing matters, not just randomness | PASS | local had fewer overloaded minutes than stagger in 10 of 10 seeds (needs ≥ 7); ready share local 99.1%, stagger 95.9% (local must not be lower) |
| 6 | Nothing to fail | PASS | with the scheduler killed at tick 1800, central tripped in 10 of 10 seeds (needs at least 8) |

Clause 6 is judged on central mode with the scheduler killed at tick 1800. The local chargers are unaffected by `killScheduler` by construction, because they never had a scheduler.

## Dhanmondi district: two transformers, three days from tick 0 (plan.md §3.7)

Both transformers of the map (T1 feeds 480 buildings, T2 feeds 309 buildings), 100 rickshaws each. Heating: ambient 32 °C, rated hot-spot rise 78 °C, time constant 75 min, burst at 140 °C. These are illustrative values, calibrated against naive charging only. Measured from tick 0, because the demo is the first night.

| Mode | Seeds with a burst | Bursts per run | Earliest burst (median) | Peak T1 / T2 | Hottest °C | Building-hours dark | Ready | Ready far |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| naive (ordinary chargers) | 10 of 10 | 1.0 | night 1, 23:31 | 122.8% / 134.2% | 140 | 18,705 | 50.2% | 50.2% |
| stagger | 8 of 10 | 0.8 | night 1, 02:32 | 111.2% / 126.6% | 140 | 12,747 | 62.9% | 62.9% |
| local (smart chargers) | 0 of 10 | 0.0 | none | 105.2% / 108.7% | 115 | 0 | 96.4% | 95.6% |
| central (app-controlled), network up all night | 0 of 10 | 0.0 | none | 97.1% / 97.2% | 105 | 0 | 99.9% | 99.9% |
| central, network down from 21:00 (the demo) | 10 of 10 | 1.0 | night 1, 23:31 | 122.8% / 134.2% | 140 | 18,704 | 50.1% | 50.1% |
| naive, 1-hour power cut at 22:00 | 10 of 10 | 1.0 | night 1, 00:42 | 122.6% / 134.3% | 140 | 19,101 | 50.3% | 50.2% |
| local, 1-hour power cut at 22:00 | 0 of 10 | 0.0 | none | 108.6% / 111.2% | 102 | 789 | 90.3% | 89.5% |
| central, 1-hour power cut at 22:00, towers fail after 30 min | 0 of 10 | 0.0 | none | 119.8% / 133.8% | 105 | 789 | 99.8% | 99.8% |

## Resilience experiments (B24)

No thresholds are set for these (VALIDATION §2). They are reported as they are.

### Scheduler killed at tick 1,800 (18:00, second day)

| Mode | Peak / rating | Overloaded min / night | Trips / night | Min without power / night | Ready | Ready near | Ready far | Lowest socket V | Seeds with a trip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| naive | 119.2% | 234.6 | 2.50 | 75.0 | 99.0% | 98.9% | 99.2% | 194.4 | 10 of 10 |
| stagger | 110.5% | 154.1 | 0.00 | 0.0 | 95.9% | 95.9% | 95.8% | 195.7 | 0 of 10 |
| local | 100.5% | 3.0 | 0.00 | 0.0 | 99.1% | 99.7% | 98.5% | 199.1 | 0 of 10 |
| central | 119.2% | 234.6 | 2.50 | 75.0 | 99.0% | 98.9% | 99.2% | 194.4 | 10 of 10 |

### 10% stubborn chargers from tick 0

| Mode | Peak / rating | Overloaded min / night | Trips / night | Min without power / night | Ready | Ready near | Ready far | Lowest socket V | Seeds with a trip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| naive | 119.2% | 234.6 | 2.50 | 75.0 | 99.0% | 98.9% | 99.2% | 194.4 | 10 of 10 |
| stagger | 110.1% | 148.7 | 0.00 | 0.0 | 96.3% | 96.3% | 96.3% | 195.8 | 0 of 10 |
| local | 101.6% | 11.4 | 0.00 | 0.0 | 99.2% | 99.8% | 98.7% | 199.0 | 0 of 10 |
| central | 97.4% | 0.0 | 0.00 | 0.0 | 99.9% | 99.8% | 100.0% | 199.2 | 0 of 10 |

### 20% stubborn chargers from tick 0

| Mode | Peak / rating | Overloaded min / night | Trips / night | Min without power / night | Ready | Ready near | Ready far | Lowest socket V | Seeds with a trip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| naive | 119.2% | 234.6 | 2.50 | 75.0 | 99.0% | 98.9% | 99.2% | 194.4 | 10 of 10 |
| stagger | 109.4% | 144.7 | 0.00 | 0.0 | 96.5% | 96.5% | 96.5% | 196.0 | 0 of 10 |
| local | 102.8% | 33.0 | 0.00 | 0.0 | 99.2% | 99.6% | 98.8% | 198.1 | 0 of 10 |
| central | 97.7% | 0.0 | 0.00 | 0.0 | 99.9% | 99.8% | 100.0% | 199.2 | 0 of 10 |

### 40% stubborn chargers from tick 0

| Mode | Peak / rating | Overloaded min / night | Trips / night | Min without power / night | Ready | Ready near | Ready far | Lowest socket V | Seeds with a trip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| naive | 119.2% | 234.6 | 2.50 | 75.0 | 99.0% | 98.9% | 99.2% | 194.4 | 10 of 10 |
| stagger | 109.7% | 159.5 | 0.00 | 0.0 | 97.5% | 97.3% | 97.7% | 196.2 | 0 of 10 |
| local | 105.0% | 87.9 | 0.00 | 0.0 | 99.5% | 99.7% | 99.3% | 198.1 | 0 of 10 |
| central | 98.1% | 0.0 | 0.00 | 0.0 | 99.9% | 99.8% | 100.0% | 199.2 | 0 of 10 |

### 60-minute power cut at 23:00 on the second day

| Mode | Peak / rating | Overloaded min / night | Trips / night | Min without power / night | Ready | Ready near | Ready far | Lowest socket V | Seeds with a trip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| naive | 118.5% | 234.4 | 1.95 | 81.1 | 98.7% | 98.7% | 98.7% | 194.4 | 10 of 10 |
| stagger | 112.0% | 183.5 | 0.00 | 30.0 | 95.6% | 95.5% | 95.5% | 195.7 | 0 of 10 |
| local | 100.4% | 1.5 | 0.00 | 30.0 | 90.3% | 95.4% | 85.5% | 199.3 | 0 of 10 |
| central | 97.1% | 0.0 | 0.00 | 30.0 | 99.7% | 99.5% | 99.8% | 199.2 | 0 of 10 |

### Household load at 1.3 times from tick 0

| Mode | Peak / rating | Overloaded min / night | Trips / night | Min without power / night | Ready | Ready near | Ready far | Lowest socket V | Seeds with a trip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| naive | 128.9% | 180.3 | 12.95 | 388.5 | 11.0% | 10.4% | 11.4% | 191.2 | 10 of 10 |
| stagger | 117.5% | 209.3 | 2.40 | 72.0 | 81.4% | 80.9% | 81.7% | 193.7 | 9 of 10 |
| local | 111.3% | 230.8 | 0.00 | 0.0 | 99.3% | 99.8% | 98.8% | 195.8 | 0 of 10 |
| central | 97.2% | 0.0 | 0.00 | 0.0 | 99.9% | 99.8% | 100.0% | 199.2 | 0 of 10 |

## Per seed, standard experiment

| Mode | Seed | Peak / rating | Overloaded min | Trips | Ready |
| --- | --- | --- | --- | --- | --- |
| naive | 1 | 118.7% | 473 | 6 | 99.3% |
| naive | 2 | 119.0% | 465 | 5 | 99.3% |
| naive | 3 | 120.4% | 483 | 5 | 98.3% |
| naive | 4 | 120.3% | 471 | 6 | 98.5% |
| naive | 5 | 118.4% | 483 | 5 | 99.3% |
| naive | 6 | 121.3% | 474 | 6 | 99.0% |
| naive | 7 | 118.8% | 475 | 4 | 99.0% |
| naive | 8 | 118.9% | 452 | 4 | 99.5% |
| naive | 9 | 117.4% | 435 | 3 | 99.5% |
| naive | 10 | 119.1% | 481 | 6 | 98.8% |
| stagger | 1 | 109.8% | 338 | 0 | 96.3% |
| stagger | 2 | 108.8% | 287 | 0 | 96.5% |
| stagger | 3 | 111.7% | 315 | 0 | 93.5% |
| stagger | 4 | 110.4% | 327 | 0 | 97.3% |
| stagger | 5 | 112.0% | 289 | 0 | 94.8% |
| stagger | 6 | 112.7% | 323 | 0 | 97.5% |
| stagger | 7 | 109.8% | 318 | 0 | 95.5% |
| stagger | 8 | 109.7% | 297 | 0 | 97.0% |
| stagger | 9 | 110.0% | 262 | 0 | 94.8% |
| stagger | 10 | 109.7% | 326 | 0 | 95.8% |
| local | 1 | 101.1% | 5 | 0 | 99.3% |
| local | 2 | 100.3% | 1 | 0 | 99.8% |
| local | 3 | 101.4% | 19 | 0 | 99.0% |
| local | 4 | 101.6% | 15 | 0 | 99.0% |
| local | 5 | 99.9% | 0 | 0 | 99.5% |
| local | 6 | 100.2% | 1 | 0 | 99.3% |
| local | 7 | 101.0% | 10 | 0 | 99.0% |
| local | 8 | 100.4% | 1 | 0 | 99.0% |
| local | 9 | 98.6% | 0 | 0 | 98.5% |
| local | 10 | 100.9% | 8 | 0 | 98.8% |
| central | 1 | 97.2% | 0 | 0 | 100.0% |
| central | 2 | 97.1% | 0 | 0 | 100.0% |
| central | 3 | 97.1% | 0 | 0 | 100.0% |
| central | 4 | 97.0% | 0 | 0 | 99.8% |
| central | 5 | 97.2% | 0 | 0 | 100.0% |
| central | 6 | 97.1% | 0 | 0 | 100.0% |
| central | 7 | 97.1% | 0 | 0 | 99.5% |
| central | 8 | 97.1% | 0 | 0 | 99.8% |
| central | 9 | 97.1% | 0 | 0 | 100.0% |
| central | 10 | 97.1% | 0 | 0 | 100.0% |

## Configuration

Simulation config for seed 1 (the seed field is replaced per run):

```json
{
  "seed": 1,
  "fleetSize": 200,
  "transformer": {
    "ratingKw": 220,
    "nominalVolts": 230,
    "sagAtRating": 0.08,
    "feederExtraSag": 0.5,
    "sensorNoiseVolts": 1,
    "tripLoadShare": 1.15,
    "tripAfterTicks": 10,
    "outageTicks": 30
  },
  "baseLoad": {
    "hourlyKw": [
      55,
      50,
      48,
      46,
      46,
      50,
      62,
      75,
      80,
      78,
      76,
      78,
      82,
      80,
      78,
      78,
      82,
      92,
      104,
      112,
      114,
      110,
      96,
      72
    ],
    "noiseShare": 0.04
  },
  "charger": {
    "powerKw": 1,
    "batteryKwh": 7,
    "efficiency": 0.85,
    "readyAtSoc": 0.9
  },
  "arrivals": {
    "arriveMeanHour": 21.5,
    "arriveSdMinutes": 60,
    "departMeanHour": 7,
    "departSdMinutes": 40,
    "socMin": 0.1,
    "socMax": 0.5
  },
  "scheduleIntervalTicks": 5
}
```

Local rule constants (`src/policies/local.ts`):

```json
{
  "sagLimitFull": 0.025,
  "sagLimitEmpty": 0.085,
  "restartMargin": 0.012,
  "startDelayMaxTicks": 20,
  "backoffBaseTicks": 10,
  "backoffMaxDoublings": 4,
  "steadyTicks": 30,
  "emptyWaitShare": 0.3,
  "outageRestartMaxTicks": 15,
  "outageResetsBackoff": true,
  "earlyStartMargin": 0.03,
  "earlyStartChance": 0.05,
  "deprivationBoost": 0.075,
  "dutyMinTicks": 60,
  "referenceFloorShare": 0.9,
  "referenceCeilingShare": 1.1
}
```

Stagger delay: uniform over [0, 180) ticks. Central scheduler: `createScheduler()` defaults.
