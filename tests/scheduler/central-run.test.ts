// The central scheduler on lane A's real core, standard scenario, three days.
import { describe, expect, it } from 'vitest';
import { createSimulation, defaultConfig } from '../../src/sim';
import { createScheduler } from '../../src/policies/scheduler';

describe.each([1, 2, 3])('central mode, standard night, seed %i', (seed) => {
  it('keeps the load under the rating, never trips, and sends rickshaws out ready', () => {
    const sim = createSimulation({ ...defaultConfig(), seed }, 'central', { scheduler: createScheduler() });
    for (let t = 0; t < 4320; t++) sim.step();
    const m = sim.metrics();
    expect(m.trips).toBe(0);
    expect(m.overloadTicks).toBe(0);
    expect(m.peakLoadShare).toBeLessThanOrEqual(1);
    expect(m.departures).toBeGreaterThan(0);
    expect(m.readyShare!).toBeGreaterThanOrEqual(0.95);
  });
});
