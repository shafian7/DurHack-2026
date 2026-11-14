import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY, type ChargerId, type Command, type Scheduler, type Simulation, type WorldSnapshot } from '../../src/contracts';
import { createSimulation, defaultConfig } from '../../src/sim';
import { alwaysOff, alwaysOn, configWith, flatLoad, run } from './helpers';

/** Household load alone decides the load: no rickshaw draws. */
const householdOnly = (kw: number, tripAfterTicks = 10) =>
  createSimulation(
    configWith({ baseLoad: flatLoad(kw), transformer: { ratingKw: 100, tripLoadShare: 1.15, tripAfterTicks, outageTicks: 30 } }),
    'local',
    { policy: alwaysOff },
  );

describe('V05 protection and outages', () => {
  it('does not trip below the trip level, however long', () => {
    const sim = householdOnly(114);
    run(sim, 500);
    expect(sim.metrics().trips).toBe(0);
    expect(sim.metrics().overloadTicks).toBe(500);
  });

  it('trips after tripAfterTicks ticks above the trip level, and not one tick sooner', () => {
    const sim = householdOnly(120);
    run(sim, 9);
    expect(sim.snapshot().transformer.tripped).toBe(false);
    run(sim, 1);
    expect(sim.metrics().trips).toBe(1);
    expect(sim.snapshot().transformer.tripped).toBe(true);
    expect(sim.snapshot().transformer.recloseTick).toBe(40);
  });

  it('resets the count when the load dips below the trip level', () => {
    const sim = householdOnly(120);
    run(sim, 8);
    sim.apply({ kind: 'setBaseLoadScale', scale: 0.5 });
    run(sim, 1);
    sim.apply({ kind: 'setBaseLoadScale', scale: 1 });
    run(sim, 9);
    expect(sim.metrics().trips).toBe(0);
    run(sim, 1);
    expect(sim.metrics().trips).toBe(1);
  });

  it('powers nothing during an outage and restores power after outageTicks', () => {
    const sim = householdOnly(120);
    run(sim, 10);
    for (let i = 0; i < 30; i += 1) {
      sim.step();
      const t = sim.snapshot().transformer;
      expect(t.tripped).toBe(true);
      expect(t.loadKw).toBe(0);
      expect(t.busVolts).toBe(0);
      expect(t.baseLoadKw).toBe(120);
    }
    expect(sim.metrics().outageTicks).toBe(30);
    sim.step();
    const after = sim.snapshot().transformer;
    expect(after.tripped).toBe(false);
    expect(after.recloseTick).toBeNull();
    expect(after.loadKw).toBe(120);
    expect(sim.history().filter((s) => s.tripped)).toHaveLength(30);
  });

  it('gives chargers a voltage of 0 and no charge during an outage, but still asks them', () => {
    let asked = 0;
    const zeroVolts: number[] = [];
    const sim = createSimulation(configWith({ transformer: { ratingKw: 10_000 } }), 'local', {
      policy: {
        name: 'probe',
        createMemory: () => null,
        decide: (obs) => {
          asked += 1;
          if (obs.voltage === 0) zeroVolts.push(obs.soc);
          return 'on';
        },
      },
    });
    run(sim, 660);
    const before = sim.metrics().energyDeliveredKwh;
    sim.apply({ kind: 'powerCut', ticks: 20 });
    asked = 0;
    run(sim, 20);
    expect(asked).toBeGreaterThan(0);
    expect(zeroVolts.length).toBe(asked);
    expect(sim.metrics().energyDeliveredKwh).toBe(before);
    expect(sim.metrics().drawingNow).toBe(0);
    expect(sim.metrics().outageTicks).toBe(20);
    expect(sim.metrics().trips).toBe(0);
    run(sim, 2);
    expect(sim.metrics().drawingNow).toBeGreaterThan(0);
  });
});

const allModes = (config = defaultConfig()): Simulation[] => [
  createSimulation(config, 'naive', { policy: alwaysOn }),
  createSimulation(config, 'local', { policy: alwaysOff }),
  createSimulation(config, 'central', { scheduler: { name: 'none', plan: () => [] } }),
];

const idsWhere = (sim: Simulation, test: (c: WorldSnapshot['chargers'][number]) => boolean): ChargerId[] =>
  sim.snapshot().chargers.filter(test).map((c) => c.id);

describe('V06 commands', () => {
  it('takes effect at the start of the next tick', () => {
    const sim = householdOnly(50);
    run(sim, 5);
    sim.apply({ kind: 'setBaseLoadScale', scale: 2 });
    expect(sim.snapshot().transformer.baseLoadKw).toBe(50);
    sim.step();
    expect(sim.snapshot().transformer.baseLoadKw).toBe(100);
  });

  it('setRatingScale moves the rating, the overload level and the trip level', () => {
    const sim = householdOnly(100);
    run(sim, 20);
    expect(sim.metrics().overloadTicks).toBe(0);
    sim.apply({ kind: 'setRatingScale', scale: 0.8 });
    run(sim, 10);
    expect(sim.snapshot().transformer.ratingKw).toBe(80);
    expect(sim.metrics().loadShare).toBeCloseTo(1.25);
    expect(sim.metrics().trips).toBe(1);
  });

  it('setSupplyVoltage scales every voltage', () => {
    const sim = householdOnly(50);
    run(sim, 2);
    const normal = sim.snapshot().transformer.busVolts;
    sim.apply({ kind: 'setSupplyVoltage', perUnit: 0.9 });
    run(sim, 1);
    expect(sim.snapshot().transformer.supplyPu).toBe(0.9);
    expect(sim.snapshot().transformer.busVolts).toBeCloseTo(normal * 0.9);
  });

  it('ignores values that make no sense', () => {
    const sim = householdOnly(50);
    const bad: Command[] = [
      { kind: 'setBaseLoadScale', scale: -1 },
      { kind: 'setBaseLoadScale', scale: Number.NaN },
      { kind: 'setRatingScale', scale: 0 },
      { kind: 'setSupplyVoltage', perUnit: -0.5 },
      { kind: 'powerCut', ticks: 0 },
      { kind: 'powerCut', ticks: Number.POSITIVE_INFINITY },
      { kind: 'plugInBurst', count: -3 },
      { kind: 'removeChargers', fraction: -0.2 },
      { kind: 'stubbornChargers', fraction: Number.NaN },
    ];
    for (const command of bad) sim.apply(command);
    run(sim, 5);
    const t = sim.snapshot().transformer;
    expect(t.baseLoadKw).toBe(50);
    expect(t.ratingKw).toBe(100);
    expect(t.supplyPu).toBe(1);
    expect(t.tripped).toBe(false);
    expect(idsWhere(sim, (c) => c.state === 'removed' || c.stubborn)).toEqual([]);
  });

  it('removeChargers removes the same ids in every mode, for good', () => {
    const sims = allModes();
    for (const sim of sims) run(sim, 700);
    for (const sim of sims) sim.apply({ kind: 'removeChargers', fraction: 0.25 });
    for (const sim of sims) run(sim, 1);
    const removed = sims.map((sim) => idsWhere(sim, (c) => c.state === 'removed'));
    expect(removed[0]).toHaveLength(50);
    expect(removed[1]).toEqual(removed[0]);
    expect(removed[2]).toEqual(removed[0]);
    for (const sim of sims) run(sim, 2 * TICKS_PER_DAY);
    expect(idsWhere(sims[0]!, (c) => c.state === 'removed')).toEqual(removed[0]);
    // A second command takes a quarter of those left.
    for (const sim of sims) sim.apply({ kind: 'removeChargers', fraction: 0.5 });
    for (const sim of sims) run(sim, 1);
    expect(idsWhere(sims[1]!, (c) => c.state === 'removed')).toHaveLength(125);
    expect(idsWhere(sims[1]!, (c) => c.state === 'removed')).toEqual(idsWhere(sims[2]!, (c) => c.state === 'removed'));
  });

  it('records a removed rickshaw that was plugged in as a departure', () => {
    const sim = createSimulation(defaultConfig(), 'local', { policy: alwaysOff });
    run(sim, 780);
    const plugged = sim.metrics().pluggedNow;
    expect(plugged).toBeGreaterThan(150);
    sim.apply({ kind: 'removeChargers', fraction: 1 });
    run(sim, 1);
    expect(sim.metrics().departures).toBe(plugged);
    expect(sim.metrics().pluggedNow).toBe(0);
    run(sim, TICKS_PER_DAY);
    expect(sim.metrics().departures).toBe(plugged);
  });

  it('stubbornChargers picks the same ids in every mode and makes them draw regardless', () => {
    const sims = allModes(configWith({ transformer: { ratingKw: 10_000 } }));
    for (const sim of sims) sim.apply({ kind: 'stubbornChargers', fraction: 0.2 });
    for (const sim of sims) run(sim, 700);
    const stubborn = sims.map((sim) => idsWhere(sim, (c) => c.stubborn));
    expect(stubborn[0]).toHaveLength(40);
    expect(stubborn[1]).toEqual(stubborn[0]);
    expect(stubborn[2]).toEqual(stubborn[0]);
    // In the always-off and empty-plan neighbourhoods only stubborn chargers charge.
    for (const sim of [sims[1]!, sims[2]!]) {
      const charging = idsWhere(sim, (c) => c.state === 'charging');
      expect(charging.length).toBeGreaterThan(0);
      for (const id of charging) expect(stubborn[0]).toContain(id);
      const waiting = idsWhere(sim, (c) => c.state === 'waiting');
      for (const id of waiting) expect(stubborn[0]).not.toContain(id);
    }
  });

  it('plugInBurst brings the same away rickshaws home early in every mode', () => {
    const sims = allModes();
    for (const sim of sims) run(sim, 300);
    const before = sims[0]!.metrics().pluggedNow;
    for (const sim of sims) sim.apply({ kind: 'plugInBurst', count: 30 });
    for (const sim of sims) run(sim, 1);
    const home = sims.map((sim) => idsWhere(sim, (c) => c.state !== 'away'));
    expect(home[0]!.length).toBeGreaterThanOrEqual(before + 30);
    expect(home[1]).toEqual(home[0]);
    expect(home[2]).toEqual(home[0]);
    // They arrive once: the day still ends with one departure each.
    for (const sim of sims) run(sim, TICKS_PER_DAY - 301);
    expect(sims[0]!.metrics().departures).toBe(200);
    expect(sims[1]!.metrics().departures).toBe(200);
  });

  it('plugInBurst does nothing for rickshaws already home', () => {
    const sim = createSimulation(defaultConfig(), 'local', { policy: alwaysOff });
    run(sim, 900);
    expect(sim.metrics().pluggedNow).toBe(200);
    sim.apply({ kind: 'plugInBurst', count: 50 });
    run(sim, 1);
    expect(sim.metrics().pluggedNow).toBe(200);
  });
});

describe('V06 central mode and the scheduler', () => {
  const evenOnly: Scheduler = {
    name: 'even',
    plan: (world) => world.chargers.filter((c) => c.id % 2 === 0).map((c) => c.id),
  };
  const config = configWith({ transformer: { ratingKw: 10_000 } });

  it('lets only the planned chargers draw and plans every scheduleIntervalTicks', () => {
    const ticks: number[] = [];
    const sim = createSimulation(config, 'central', {
      scheduler: {
        name: 'spy',
        plan: (world) => {
          ticks.push(world.tick);
          return evenOnly.plan(world, { next: () => 0, int: () => 0, pick: (items) => items[0]! });
        },
      },
    });
    run(sim, 700);
    expect(ticks.slice(0, 4)).toEqual([0, 5, 10, 15]);
    const charging = idsWhere(sim, (c) => c.state === 'charging');
    expect(charging.length).toBeGreaterThan(0);
    expect(charging.every((id) => id % 2 === 0)).toBe(true);
    expect(idsWhere(sim, (c) => c.state === 'waiting').every((id) => id % 2 === 1)).toBe(true);
  });

  it('shows the scheduler each rickshaw departure time', () => {
    let seen = false;
    const sim = createSimulation(config, 'central', {
      scheduler: {
        name: 'look',
        plan: (world) => {
          for (const c of world.chargers) {
            if (c.state === 'away') expect(c.departTick).toBeNull();
            else {
              expect(c.departTick).toBeGreaterThan(world.tick);
              seen = true;
            }
          }
          return [];
        },
      },
    });
    run(sim, 700);
    expect(seen).toBe(true);
  });

  it('after killScheduler every plugged-in charger draws, and revive resumes planning', () => {
    let plans = 0;
    const sim = createSimulation(config, 'central', {
      scheduler: {
        name: 'counting',
        plan: () => {
          plans += 1;
          return [];
        },
      },
    });
    run(sim, 700);
    expect(sim.metrics().drawingNow).toBe(0);
    expect(sim.snapshot().schedulerAlive).toBe(true);

    sim.apply({ kind: 'killScheduler' });
    const plansAtKill = plans;
    run(sim, 20);
    expect(sim.snapshot().schedulerAlive).toBe(false);
    expect(plans).toBe(plansAtKill);
    const m = sim.metrics();
    expect(m.drawingNow).toBeGreaterThan(0);
    expect(idsWhere(sim, (c) => c.state === 'waiting')).toEqual([]);

    sim.apply({ kind: 'reviveScheduler' });
    run(sim, 10);
    expect(plans).toBeGreaterThan(plansAtKill);
    expect(sim.metrics().drawingNow).toBe(0);
  });

  it('kill and revive do nothing outside central mode', () => {
    const a = createSimulation(defaultConfig(), 'naive', { policy: alwaysOn });
    const b = createSimulation(defaultConfig(), 'naive', { policy: alwaysOn });
    b.apply({ kind: 'killScheduler' });
    run(a, 900);
    run(b, 900);
    expect({ ...b.metrics() }).toEqual({ ...a.metrics() });
  });

  it('ignores invalid ids in a plan and survives a scheduler that throws', () => {
    const odd = createSimulation(config, 'central', {
      scheduler: { name: 'odd', plan: () => [-1, 1.5, 9999, Number.NaN, 0] },
    });
    expect(() => run(odd, 700)).not.toThrow();
    expect(idsWhere(odd, (c) => c.state === 'charging').every((id) => id === 0)).toBe(true);

    const broken = createSimulation(config, 'central', {
      scheduler: {
        name: 'broken',
        plan: () => {
          throw new Error('boom');
        },
      },
    });
    expect(() => run(broken, 700)).not.toThrow();
    expect(broken.metrics().energyDeliveredKwh).toBe(0);
  });
});
