// B61: the central scheduler against hand-built snapshots. No dependency on the core.
import { describe, expect, it } from 'vitest';
import type { ChargerState, ChargerView, Rng, WorldSnapshot } from '../../src/contracts';
import { createScheduler, headroomKw, slackTicks, DEFAULT_SCHEDULER_OPTIONS } from '../../src/policies/scheduler';

/** A small seeded generator of our own, so the tests need nothing from lane A. */
function testRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  const next = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 2 ** 32;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (items) => items[Math.floor(next() * items.length)]!,
  };
}

function charger(id: number, part: Partial<ChargerView> = {}): ChargerView {
  return {
    id,
    feeder: 0.5,
    state: 'waiting',
    soc: 0.3,
    voltage: 225,
    stubborn: false,
    arrivedTick: 500,
    departTick: 1140,
    ...part,
  };
}

function world(chargers: ChargerView[], t: Partial<WorldSnapshot['transformer']> = {}, tick = 600): WorldSnapshot {
  const drawing = chargers.filter((c) => c.state === 'charging').length;
  const baseLoadKw = t.baseLoadKw ?? 100;
  return {
    tick,
    mode: 'central',
    schedulerAlive: true,
    chargers,
    transformer: {
      ratingKw: 220,
      baseLoadKw,
      chargerLoadKw: drawing,
      loadKw: baseLoadKw + drawing,
      busVolts: 220,
      supplyPu: 1,
      tripped: false,
      recloseTick: null,
      ...t,
    },
  };
}

const rng = testRng(7);
const scheduler = createScheduler();

describe('central scheduler: headroom', () => {
  it('switches on no more chargers than fit under the rating after the margin', () => {
    const cs = Array.from({ length: 200 }, (_, i) => charger(i));
    const plan = scheduler.plan(world(cs, { baseLoadKw: 100 }), rng);
    // 220 * 0.97 - 100 = 113.4 kW of room at 1 kW each.
    expect(plan).toHaveLength(113);
    expect(100 + plan.length * 1).toBeLessThanOrEqual(220);
  });

  it('plans everyone when there is room for everyone', () => {
    const cs = Array.from({ length: 30 }, (_, i) => charger(i));
    expect(scheduler.plan(world(cs, { baseLoadKw: 50 }), rng)).toHaveLength(30);
  });

  it('plans nothing when household demand alone is over the rating', () => {
    const cs = Array.from({ length: 10 }, (_, i) => charger(i));
    expect(scheduler.plan(world(cs, { baseLoadKw: 230 }), rng)).toEqual([]);
  });

  it('uses the derated rating after setRatingScale', () => {
    const cs = Array.from({ length: 200 }, (_, i) => charger(i));
    const plan = scheduler.plan(world(cs, { ratingKw: 154, baseLoadKw: 100 }), rng);
    expect(100 + plan.length).toBeLessThanOrEqual(154);
    expect(plan.length).toBe(Math.floor(154 * 0.97 - 100));
  });

  it('counts stubborn chargers as load it cannot switch off, and never plans them', () => {
    const cs = [
      ...Array.from({ length: 20 }, (_, i) => charger(i, { stubborn: true, state: 'charging' })),
      ...Array.from({ length: 200 }, (_, i) => charger(100 + i)),
    ];
    const plan = scheduler.plan(world(cs, { baseLoadKw: 100 }), rng);
    expect(plan.every((id) => id >= 100)).toBe(true);
    expect(100 + 20 + plan.length).toBeLessThanOrEqual(220);
    expect(plan).toHaveLength(Math.floor(220 * 0.97 - 100 - 20));
  });

  it('reads charger power from the snapshot when chargers are drawing', () => {
    const cs = Array.from({ length: 200 }, (_, i) => charger(i, { state: i < 10 ? 'charging' : 'waiting' }));
    // Ten chargers drawing 20 kW between them: 2 kW each.
    const plan = scheduler.plan(world(cs, { baseLoadKw: 100, chargerLoadKw: 20 }), rng);
    expect(100 + plan.length * 2).toBeLessThanOrEqual(220);
    expect(plan).toHaveLength(Math.floor((220 * 0.97 - 100) / 2));
  });

  it('never plans more load than the headroom on random feasible snapshots', () => {
    const r = testRng(42);
    const states: ChargerState[] = ['away', 'waiting', 'charging', 'full', 'removed'];
    for (let trial = 0; trial < 500; trial++) {
      const n = 1 + r.int(300);
      const cs = Array.from({ length: n }, (_, i) =>
        charger(i, {
          state: r.pick(states),
          soc: r.next(),
          stubborn: r.next() < 0.1,
          departTick: r.next() < 0.05 ? null : 600 + r.int(900),
          feeder: r.next(),
        }),
      );
      const ratingKw = 100 + r.int(300);
      const baseLoadKw = r.next() * ratingKw * 1.2;
      const snap = world(cs, { ratingKw, baseLoadKw, chargerLoadKw: cs.filter((c) => c.state === 'charging').length });
      const plan = scheduler.plan(snap, r);
      const stubbornKw = cs.filter((c) => c.stubborn && (c.state === 'waiting' || c.state === 'charging')).length;
      const room = headroomKw(snap, 1, DEFAULT_SCHEDULER_OPTIONS.marginShare);
      // Feasible means the load it cannot control already fits under the rating.
      if (baseLoadKw + stubbornKw <= ratingKw) {
        expect(baseLoadKw + stubbornKw + plan.length).toBeLessThanOrEqual(ratingKw);
      }
      expect(plan.length).toBeLessThanOrEqual(Math.max(0, Math.floor(room + 1e-9)));
      // Only plugged-in, unfinished, obedient chargers, each at most once.
      expect(new Set(plan).size).toBe(plan.length);
      for (const id of plan) {
        const c = cs[id]!;
        expect(['waiting', 'charging']).toContain(c.state);
        expect(c.stubborn).toBe(false);
        expect(c.soc).toBeLessThan(1);
      }
    }
  });
});

describe('central scheduler: priority', () => {
  it('prefers the rickshaw that leaves soonest relative to the charge it still needs', () => {
    // a: leaves in 300 ticks needing 0.6 → about 296 ticks of charging: almost no slack.
    // b: leaves in 600 ticks needing 0.6 → about 304 ticks of slack.
    // c: leaves in 300 ticks needing 0.1 → about 251 ticks of slack, so it comes before b.
    const cs = [
      charger(0, { soc: 0.3, departTick: 900 }),
      charger(1, { soc: 0.3, departTick: 1200 }),
      charger(2, { soc: 0.8, departTick: 900 }),
    ];
    const snap = world(cs, { ratingKw: 100, baseLoadKw: 100 * 0.97 - 1 });
    expect(scheduler.plan(snap, rng)).toEqual([0]);
    const two = world(cs, { ratingKw: 100, baseLoadKw: 100 * 0.97 - 2 });
    expect(scheduler.plan(two, rng)).toEqual([0, 2]);
  });

  it('serves the emptier battery first when departures are equal', () => {
    const cs = [charger(0, { soc: 0.6 }), charger(1, { soc: 0.2 }), charger(2, { soc: 0.4 })];
    const snap = world(cs, { ratingKw: 100, baseLoadKw: 100 * 0.97 - 2 });
    expect(scheduler.plan(snap, rng)).toEqual([1, 2]);
  });

  it('tops up rickshaws already at the ready level only after every urgent one', () => {
    const cs = [
      charger(0, { soc: 0.95, departTick: 610 }),
      charger(1, { soc: 0.5, departTick: 1400 }),
      charger(2, { soc: 0.92, departTick: 700 }),
    ];
    const snap = world(cs, { ratingKw: 100, baseLoadKw: 100 * 0.97 - 2 });
    expect(scheduler.plan(snap, rng)).toEqual([1, 0]);
  });

  it('ignores chargers that are away, full or removed', () => {
    const cs = [
      charger(0, { state: 'away', soc: 0, departTick: null, arrivedTick: null }),
      charger(1, { state: 'full', soc: 1 }),
      charger(2, { state: 'removed' }),
      charger(3, { state: 'charging', soc: 0.5 }),
    ];
    expect(scheduler.plan(world(cs, { baseLoadKw: 50 }), rng)).toEqual([3]);
  });

  it('slack is departure time minus the ticks of charging still needed', () => {
    const c = charger(0, { soc: 0.3, departTick: 1000 });
    // 0.6 of 7 kWh at 1 kW and 85%: 0.6 * 7 / 0.85 hours = 296.47 ticks.
    expect(slackTicks(c, 600, 0.9, DEFAULT_SCHEDULER_OPTIONS, 1)).toBeCloseTo(400 - (0.6 * 7 * 60) / 0.85, 6);
  });
});

describe('central scheduler: robustness', () => {
  it('is deterministic and does not depend on the rng', () => {
    const cs = Array.from({ length: 200 }, (_, i) => charger(i, { soc: (i * 37) % 100 / 100, departTick: 1000 + ((i * 53) % 300) }));
    const snap = world(cs);
    expect(scheduler.plan(snap, testRng(1))).toEqual(scheduler.plan(snap, testRng(2)));
  });

  it('works on a frozen snapshot', () => {
    const cs = Array.from({ length: 5 }, (_, i) => Object.freeze(charger(i)));
    const snap = Object.freeze(world(cs));
    expect(scheduler.plan(snap, rng)).toHaveLength(5);
  });

  it('returns an empty plan instead of throwing on a broken snapshot', () => {
    const broken = { tick: 0, mode: 'central', schedulerAlive: true, chargers: null, transformer: null } as unknown as WorldSnapshot;
    expect(scheduler.plan(broken, rng)).toEqual([]);
  });

  it('is named central', () => {
    expect(createScheduler().name).toBe('central');
  });
});
