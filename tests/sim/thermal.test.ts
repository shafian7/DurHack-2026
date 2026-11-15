// plan.md §3.3 and §3.2: heating, burst and feeders from a map.
import { describe, expect, it } from 'vitest';
import type { ThermalConfig } from '../../src/contracts';
import { createSimulation } from '../../src/sim';
import { alwaysOn, configWith } from './helpers';

const thermal: ThermalConfig = { ambientC: 30, ratedHotSpotRiseC: 80, thermalTauTicks: 60, burstHotSpotC: 140 };

describe('transformer heating and burst', () => {
  it('stays at ambient with no thermal model, and never bursts', () => {
    const sim = createSimulation(configWith({ fleetSize: 300 }), 'naive', { policy: alwaysOn });
    for (let t = 0; t < 1440; t++) sim.step();
    expect(sim.snapshot().transformer.hotSpotC).toBe(30);
    expect(sim.metrics().bursts).toBe(0);
  });

  it('the hot-spot rises with load and settles towards ambient plus the rated rise', () => {
    const config = configWith({
      fleetSize: 0,
      transformer: { thermal, tripLoadShare: 9 },
      baseLoad: { hourlyKw: new Array(24).fill(165), noiseShare: 0 },
    });
    const sim = createSimulation(config, 'naive', { policy: alwaysOn });
    for (let t = 0; t < 600; t++) sim.step();
    const s = sim.snapshot().transformer;
    const k = s.loadKw / s.ratingKw;
    // After ten time constants it is close to steady state for this load.
    expect(k).toBeCloseTo(0.75, 5);
    expect(Math.abs(s.hotSpotC - (30 + 80 * k * k))).toBeLessThan(0.1);
    expect(sim.metrics().maxHotSpotC).toBeGreaterThanOrEqual(s.hotSpotC);
  });

  it('sustained overload bursts the transformer, and the power never returns', () => {
    const config = configWith({
      fleetSize: 300,
      transformer: { thermal, tripLoadShare: 9 },
    });
    const sim = createSimulation(config, 'naive', { policy: alwaysOn });
    let burstAt = -1;
    for (let t = 0; t < 2 * 1440; t++) {
      sim.step();
      if (burstAt < 0 && sim.snapshot().transformer.burst) burstAt = sim.tick;
    }
    expect(burstAt).toBeGreaterThan(0);
    const m = sim.metrics();
    expect(m.bursts).toBe(1);
    expect(m.burstTick).toBe(burstAt - 1);
    const s = sim.snapshot();
    expect(s.transformer.tripped).toBe(true);
    expect(s.transformer.recloseTick).toBeNull();
    expect(s.transformer.loadKw).toBe(0);
    expect(s.chargers.every((c) => c.voltage === 0)).toBe(true);
    // Every sample after the burst is dark.
    expect(sim.history().filter((h) => h.tick >= burstAt).every((h) => h.tripped && h.loadKw === 0)).toBe(true);
  });

  it('a power cut does not revive a burst transformer', () => {
    const sim = createSimulation(configWith({ fleetSize: 300, transformer: { thermal, tripLoadShare: 9 } }), 'naive', {
      policy: alwaysOn,
    });
    while (!sim.snapshot().transformer.burst && sim.tick < 2880) sim.step();
    sim.apply({ kind: 'powerCut', ticks: 5 });
    for (let t = 0; t < 20; t++) sim.step();
    expect(sim.snapshot().transformer.recloseTick).toBeNull();
    expect(sim.snapshot().transformer.tripped).toBe(true);
  });
});

describe('feeders from a map', () => {
  it('uses the given feeder positions and draws the rest', () => {
    const feeders = [0.1, 0.5, 0.9];
    const sim = createSimulation({ ...configWith({ fleetSize: 5 }), feeders }, 'naive', { policy: alwaysOn });
    const got = sim.snapshot().chargers.map((c) => c.feeder);
    expect(got.slice(0, 3)).toEqual(feeders);
    for (const f of got.slice(3)) expect(f).toBeGreaterThanOrEqual(0);
  });

  it('leaves the rest of the layout stream unchanged', () => {
    const a = createSimulation(configWith({ fleetSize: 5 }), 'naive', { policy: alwaysOn }).snapshot();
    const b = createSimulation({ ...configWith({ fleetSize: 5 }), feeders: [0.3] }, 'naive', { policy: alwaysOn }).snapshot();
    expect(b.chargers.slice(1).map((c) => c.feeder)).toEqual(a.chargers.slice(1).map((c) => c.feeder));
  });
});
