// The scripted demo tells its story on lane A's real simulation core: naive
// trips on night one and again when the power cut ends; the scheduled
// neighbourhood stays on until its scheduler is killed, then trips.
// Uses an inline always-on policy for naive so it does not depend on lane B.
import { describe, expect, it } from 'vitest';
import type { ChargerPolicy, FleetMode, Scenario, Simulation } from '../../src/contracts';
import { createSimulation, defaultConfig } from '../../src/sim';
import { createScheduler } from '../../src/policies/scheduler';
import { scenarios, tickAt } from '../../src/scenarios';

const alwaysOn: ChargerPolicy<null> = { name: 'always-on', createMemory: () => null, decide: () => 'on' };

/** Plays a scenario to the end and returns the ticks at which the transformer tripped. */
function play(scenario: Scenario, mode: FleetMode, seed: number): { sim: Simulation; tripTicks: number[] } {
  const config = scenario.configure({ ...defaultConfig(), seed });
  const sim = createSimulation(config, mode, mode === 'central' ? { scheduler: createScheduler() } : { policy: alwaysOn });
  const tripTicks: number[] = [];
  let next = 0;
  let trips = 0;
  while (sim.tick < scenario.durationTicks) {
    while (next < scenario.script.length && scenario.script[next]!.atTick === sim.tick) sim.apply(scenario.script[next++]!.command);
    sim.step();
    const m = sim.metrics();
    if (m.trips > trips) tripTicks.push(sim.tick);
    trips = m.trips;
  }
  return { sim, tripTicks };
}

const demo = scenarios.find((s) => s.id === 'demo-3min')!;
const cutEnds = tickAt(0, 23) + 60;
const kill = tickAt(1, 18);

describe.each([1, 2, 3])('demo-3min, seed %i', (seed) => {
  it('naive trips on night one before the power cut, and again soon after power returns', () => {
    const { tripTicks } = play(demo, 'naive', seed);
    expect(tripTicks.some((t) => t < tickAt(0, 23))).toBe(true);
    expect(tripTicks.some((t) => t > cutEnds && t <= cutEnds + 30)).toBe(true);
  });

  it('central stays on until the scheduler is killed, then trips', () => {
    const { tripTicks } = play(demo, 'central', seed);
    expect(tripTicks.filter((t) => t < kill)).toEqual([]);
    expect(tripTicks.filter((t) => t >= kill).length).toBeGreaterThan(0);
  });
});
