import { describe, expect, it } from 'vitest';
import { HISTORY_TICKS, TICKS_PER_DAY, type Metrics } from '../../src/contracts';
import { createSimulation, defaultConfig } from '../../src/sim';
import { socGainPerTick, socketVolts } from '../../src/sim/physics';
import { alwaysOff, alwaysOn, configWith, flatLoad, recorder, run } from './helpers';

describe('V01 determinism and an identical night', () => {
  it('gives identical metrics at every tick for the same seed, mode and commands', () => {
    const trace = (): Metrics[] => {
      const sim = createSimulation(defaultConfig(), 'naive', { policy: alwaysOn });
      const out: Metrics[] = [];
      run(sim, 2 * TICKS_PER_DAY, (s) => {
        if (s.tick === 700) s.apply({ kind: 'setBaseLoadScale', scale: 1.2 });
        out.push(s.metrics());
      });
      return out;
    };
    expect(trace()).toEqual(trace());
  });

  it('gives every mode the same arrivals, departures and household demand', () => {
    const big = configWith({ transformer: { ratingKw: 10_000 } });
    const sims = [
      createSimulation(big, 'naive', { policy: alwaysOn }),
      createSimulation(big, 'local', { policy: alwaysOff }),
      createSimulation(big, 'central', { scheduler: { name: 's', plan: () => [] } }),
    ];
    for (let i = 0; i < 2 * TICKS_PER_DAY; i += 1) {
      for (const sim of sims) sim.step();
      const [a, b, c] = sims.map((sim) => sim.metrics());
      expect(b!.pluggedNow).toBe(a!.pluggedNow);
      expect(c!.pluggedNow).toBe(a!.pluggedNow);
      expect(b!.departures).toBe(a!.departures);
      expect(c!.departures).toBe(a!.departures);
    }
    const [ha, hb, hc] = sims.map((sim) => sim.history().map((s) => s.baseLoadKw));
    expect(hb).toEqual(ha);
    expect(hc).toEqual(ha);
    const feeders = sims.map((sim) => sim.snapshot().chargers.map((c) => c.feeder));
    expect(feeders[1]).toEqual(feeders[0]);
    expect(feeders[2]).toEqual(feeders[0]);
  });

  it('differs between seeds', () => {
    const plugged = (seed: number): number[] => {
      const sim = createSimulation(configWith({ seed }), 'naive', { policy: alwaysOn });
      const out: number[] = [];
      run(sim, TICKS_PER_DAY, (s) => out.push(s.metrics().pluggedNow));
      return out;
    };
    expect(plugged(1)).not.toEqual(plugged(2));
  });
});

describe('V03 observation limits and the voltage law', () => {
  it('hands a policy exactly the five fields', () => {
    const { policy, seen } = recorder('on');
    const sim = createSimulation(configWith({ fleetSize: 5 }), 'local', { policy });
    run(sim, TICKS_PER_DAY);
    expect(seen.length).toBeGreaterThan(0);
    for (const obs of seen) {
      expect(Object.keys(obs).sort()).toEqual(['drawing', 'nominalVolts', 'pluggedTicks', 'soc', 'voltage']);
    }
  });

  it('reads the socket voltage of CONTRACTS section 2 from the previous tick load', () => {
    const { policy, seen } = recorder('on');
    const config = configWith({
      fleetSize: 1,
      baseLoad: flatLoad(150),
      transformer: { sensorNoiseVolts: 0, ratingKw: 220 },
    });
    const sim = createSimulation(config, 'local', { policy });
    const loads: number[] = [];
    let feeder = 0;
    let checked = 0;
    run(sim, TICKS_PER_DAY, (s) => {
      const snap = s.snapshot();
      const charger = snap.chargers[0]!;
      feeder = charger.feeder;
      loads.push(snap.transformer.loadKw);
      if (charger.state === 'charging' && loads.length >= 2) {
        const previous = loads[loads.length - 2]!;
        expect(charger.voltage).toBeCloseTo(socketVolts(config.transformer, previous, 1, feeder), 9);
        expect(seen[seen.length - 1]!.voltage).toBe(charger.voltage);
        checked += 1;
      }
    });
    expect(checked).toBeGreaterThan(100);
    // The first reading after plugging in reflects household load only: the charger has not drawn yet.
    expect(seen[0]!.voltage).toBeCloseTo(socketVolts(config.transformer, 150, 1, feeder), 9);
    expect(seen[0]!.drawing).toBe(false);
    expect(seen[1]!.drawing).toBe(true);
    expect(seen[0]!.pluggedTicks).toBe(0);
    expect(seen[1]!.pluggedTicks).toBe(1);
  });

  it('gives chargers further along the feeder a lower voltage', () => {
    const config = configWith({ baseLoad: flatLoad(200), transformer: { sensorNoiseVolts: 0, ratingKw: 10_000, sagAtRating: 4 } });
    const sim = createSimulation(config, 'naive', { policy: alwaysOff });
    run(sim, 700);
    const present = sim.snapshot().chargers.filter((c) => c.state !== 'away');
    expect(present.length).toBeGreaterThan(50);
    const sorted = [...present].sort((a, b) => a.feeder - b.feeder);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]!.voltage).toBeLessThanOrEqual(sorted[i - 1]!.voltage);
    }
  });
});

describe('V04 rickshaw accounting', () => {
  it('keeps battery level within 0 to 1 and matches energy to charger-ticks', () => {
    const config = configWith({ transformer: { ratingKw: 10_000 } });
    const sim = createSimulation(config, 'naive', { policy: alwaysOn });
    let chargerTicks = 0;
    let lowest = 1;
    let highest = 0;
    run(sim, 2 * TICKS_PER_DAY, (s) => {
      // One comparison per charger, not one expect: half a million expects made this test slow on CI.
      for (const c of s.snapshot().chargers) {
        if (c.soc < lowest) lowest = c.soc;
        if (c.soc > highest) highest = c.soc;
      }
      chargerTicks += s.metrics().drawingNow;
    });
    expect(lowest).toBeGreaterThanOrEqual(0);
    expect(highest).toBeLessThanOrEqual(1);
    const m = sim.metrics();
    expect(m.energyDeliveredKwh).toBeCloseTo((chargerTicks * config.charger.powerKw) / 60, 6);
    expect(m.trips).toBe(0);
  });

  it('sends every rickshaw home once a day and away again', () => {
    const sim = createSimulation(configWith({ transformer: { ratingKw: 10_000 } }), 'naive', { policy: alwaysOn });
    run(sim, 3 * TICKS_PER_DAY);
    const m = sim.metrics();
    expect(m.departures).toBe(3 * 200);
    expect(m.pluggedNow).toBe(0);
  });

  it('counts a departure as ready exactly at readyAtSoc', () => {
    const never = createSimulation(defaultConfig(), 'local', { policy: alwaysOff });
    run(never, TICKS_PER_DAY);
    expect(never.metrics().readyShare).toBe(0);
    expect(never.metrics().meanDepartureSoc).toBeGreaterThanOrEqual(0.1);
    expect(never.metrics().meanDepartureSoc).toBeLessThanOrEqual(0.5);

    const always = createSimulation(configWith({ transformer: { ratingKw: 10_000 } }), 'naive', { policy: alwaysOn });
    run(always, TICKS_PER_DAY);
    const m = always.metrics();
    expect(m.readyDepartures).toBeLessThanOrEqual(m.departures);
    expect(m.readyShare).toBeCloseTo(m.readyDepartures / m.departures);
    expect(m.readyShare!).toBeGreaterThan(0.9);
    expect(m.readyShareNear).not.toBeNull();
    expect(m.readyShareFar).not.toBeNull();
  });

  it('charges at the contract rate and stops by itself when full', () => {
    const config = configWith({ fleetSize: 1, transformer: { ratingKw: 10_000 } });
    const sim = createSimulation(config, 'naive', { policy: alwaysOn });
    let last: number | null = null;
    let sawFull = false;
    run(sim, TICKS_PER_DAY, (s) => {
      const c = s.snapshot().chargers[0]!;
      if (c.state === 'charging' && last !== null && c.soc < 1) {
        expect(c.soc - last).toBeCloseTo(socGainPerTick(config.charger), 9);
      }
      if (c.state === 'full') sawFull = true;
      last = c.state === 'charging' ? c.soc : null;
    });
    expect(sawFull).toBe(true);
  });
});

describe('history', () => {
  it('has one sample per tick, oldest first, capped at HISTORY_TICKS', () => {
    const sim = createSimulation(configWith({ fleetSize: 10 }), 'naive', { policy: alwaysOn });
    run(sim, 100);
    expect(sim.history().map((s) => s.tick)).toEqual(Array.from({ length: 100 }, (_, i) => i));
    run(sim, 3 * TICKS_PER_DAY);
    const h = sim.history();
    expect(h).toHaveLength(HISTORY_TICKS);
    expect(h[h.length - 1]!.tick).toBe(sim.tick - 1);
    expect(h[0]!.tick).toBe(sim.tick - HISTORY_TICKS);
  });
});

describe('a naive night', () => {
  it('pushes the evening load above the rating over three days', () => {
    const sim = createSimulation(defaultConfig(), 'naive', { policy: alwaysOn });
    run(sim, 3 * TICKS_PER_DAY);
    const m = sim.metrics();
    expect(m.peakLoadShare).toBeGreaterThan(1);
    expect(m.overloadTicks).toBeGreaterThan(0);
    console.log(
      `naive, seed 1, 3 days: peak ${(m.peakLoadShare * 100).toFixed(0)}% of rating, overloaded ${m.overloadTicks} min, trips ${m.trips}, outage ${m.outageTicks} min, ready ${((m.readyShare ?? 0) * 100).toFixed(0)}%`,
    );
  });

  it('rejects a missing policy or scheduler and survives a throwing policy', () => {
    expect(() => createSimulation(defaultConfig(), 'local', {})).toThrow();
    expect(() => createSimulation(defaultConfig(), 'central', {})).toThrow();
    const sim = createSimulation(configWith({ fleetSize: 20 }), 'local', {
      policy: {
        name: 'broken',
        createMemory: () => null,
        decide: () => {
          throw new Error('boom');
        },
      },
    });
    expect(() => run(sim, TICKS_PER_DAY)).not.toThrow();
    expect(sim.metrics().energyDeliveredKwh).toBe(0);
  });
});
