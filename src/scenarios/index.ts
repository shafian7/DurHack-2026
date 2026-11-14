/**
 * Demo and experiment scenarios (lane D, B60).
 *
 * A scenario is data plus a pure `configure` function. Nothing here runs the
 * simulation; the UI and the experiment script do that. This module imports
 * only from ../contracts.
 */
import { TICKS_PER_DAY, TICKS_PER_HOUR, START_HOUR } from '../contracts';
import type { Scenario, ScriptedCommand, SimConfig } from '../contracts';

/**
 * The tick at a given clock time. `day` counts simulated days from tick 0
 * (12:00 noon). Hours before noon belong to the morning at the end of that
 * day, so tickAt(0, 23) is the first evening and tickAt(0, 2) the night after.
 */
export function tickAt(day: number, hour: number, minute = 0): number {
  const sinceNoon = (((hour - START_HOUR) % 24) + 24) % 24;
  return day * TICKS_PER_DAY + sinceNoon * TICKS_PER_HOUR + minute;
}

/** Three simulated days: the length of the standard experiment (VALIDATION §2). */
export const EXPERIMENT_TICKS = 3 * TICKS_PER_DAY;

/** Household demand multiplier used by the heatwave scenario and the B24 resilience run. */
export const HEATWAVE_SCALE = 1.3;

/** Fleet size of the growth scenario: half as many chargers again on the same transformer. */
export const GROWTH_FLEET = 300;

const identity = (base: SimConfig): SimConfig => base;

export const standard: Scenario = {
  id: 'standard',
  title: 'A normal night',
  description: 'Two hundred rickshaws come home in the evening and plug in on one transformer.',
  configure: identity,
  script: [],
  durationTicks: EXPERIMENT_TICKS,
};

export const heatwave: Scenario = {
  id: 'heatwave',
  title: 'Heatwave',
  description: 'Fans and air coolers push household demand up by 30% all day and all night.',
  configure: (base) => ({
    ...base,
    baseLoad: { ...base.baseLoad, hourlyKw: base.baseLoad.hourlyKw.map((kw) => kw * HEATWAVE_SCALE) },
  }),
  script: [],
  durationTicks: EXPERIMENT_TICKS,
};

export const loadShedding: Scenario = {
  id: 'load-shedding',
  title: 'Load-shedding',
  description: 'The grid cuts this neighbourhood off for an hour at 23:00 on the second night.',
  configure: identity,
  script: [{ atTick: tickAt(1, 23), command: { kind: 'powerCut', ticks: 60 } }],
  durationTicks: EXPERIMENT_TICKS,
};

export const growth: Scenario = {
  id: 'growth',
  title: 'Growth',
  description: 'Three hundred rickshaws now charge on the same transformer.',
  configure: (base) => ({ ...base, fleetSize: GROWTH_FLEET }),
  script: [],
  durationTicks: EXPERIMENT_TICKS,
};

/**
 * The scripted demo of VALIDATION §4, steps 2 to 5, for the backup video.
 * Night one: the evening spike, a heatwave, then an hour's power cut at 23:00
 * that ends at midnight with the heatwave still on (it ends at 01:00).
 * Day two: the scheduler is killed before the evening, and night two shows
 * the scheduled neighbourhood turning into the naive one.
 */
const demoScript: readonly ScriptedCommand[] = [
  // Step 3: make it harder while the naive evening spike is at its height.
  { atTick: tickAt(0, 22, 30), command: { kind: 'setBaseLoadScale', scale: HEATWAVE_SCALE } },
  // Step 4: an hour of load-shedding at the height of the evening. Power returns
  // at midnight with the heatwave still on, and naive slams back on together.
  { atTick: tickAt(0, 23), command: { kind: 'powerCut', ticks: 60 } },
  { atTick: tickAt(0, 1), command: { kind: 'setBaseLoadScale', scale: 1 } },
  // Step 5: kill the server before the next evening.
  { atTick: tickAt(1, 18), command: { kind: 'killScheduler' } },
];

export const demo3min: Scenario = {
  id: 'demo-3min',
  title: 'Scripted demo',
  description: 'Evening spike, a heatwave, an hour of load-shedding at 23:00, then the scheduler is killed before night two.',
  configure: identity,
  script: demoScript,
  durationTicks: tickAt(1, 1),
};

export const scenarios: readonly Scenario[] = [standard, heatwave, loadShedding, growth, demo3min];
