import { describe, expect, it } from 'vitest';
import { HISTORY_TICKS, TICKS_PER_DAY } from '../../src/contracts';
import type { FleetMode, Simulation } from '../../src/contracts';
import { createFakeSimulation, fakeConfig } from '../../src/ui/dev/fakeSimulation';

const run = (sim: Simulation, ticks: number) => {
  for (let i = 0; i < ticks; i++) sim.step();
  return sim;
};

describe('fake simulation (dev stand-in)', () => {
  it('plays an evening whose naive load rises past the rating and trips', () => {
    const sim = run(createFakeSimulation(fakeConfig(), 'naive'), TICKS_PER_DAY);
    const m = sim.metrics();
    expect(m.peakLoadShare).toBeGreaterThan(1);
    expect(m.trips).toBeGreaterThan(0);
    expect(m.departures).toBeGreaterThan(0);
    expect(sim.history().some((s) => s.tripped)).toBe(true);
    expect(sim.history().some((s) => s.plugged > 100)).toBe(true);
  });

  it('is deterministic and gives every mode the same household night', () => {
    const a = run(createFakeSimulation(fakeConfig(3), 'local'), 600);
    const b = run(createFakeSimulation(fakeConfig(3), 'local'), 600);
    expect(a.metrics()).toEqual(b.metrics());
    const modes: FleetMode[] = ['naive', 'stagger', 'local', 'central'];
    const bases = modes.map((mode) => run(createFakeSimulation(fakeConfig(3), mode), 300).history().map((s) => s.baseLoadKw));
    for (const b2 of bases) expect(b2).toEqual(bases[0]);
  });

  it('keeps at most HISTORY_TICKS samples, oldest first', () => {
    const sim = run(createFakeSimulation({ ...fakeConfig(), fleetSize: 20 }, 'naive'), HISTORY_TICKS + 50);
    const h = sim.history();
    expect(h.length).toBe(HISTORY_TICKS);
    expect(h[0]!.tick).toBe(50);
    expect(h[h.length - 1]!.tick).toBe(sim.tick - 1);
  });

  it('applies commands at the next tick and stops the scheduler when killed', () => {
    const sim = createFakeSimulation(fakeConfig(), 'central');
    sim.apply({ kind: 'killScheduler' });
    expect(sim.snapshot().schedulerAlive).toBe(true);
    sim.step();
    expect(sim.snapshot().schedulerAlive).toBe(false);
    sim.apply({ kind: 'powerCut', ticks: 5 });
    sim.step();
    expect(sim.history().at(-1)!.tripped).toBe(true);
    expect(sim.snapshot().chargers).toHaveLength(200);
  });
});
