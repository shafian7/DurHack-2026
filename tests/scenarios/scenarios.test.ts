// V10: scenarios are valid (R12).
import { describe, expect, it } from 'vitest';
import type { Command, SimConfig } from '../../src/contracts';
import { scenarios, tickAt } from '../../src/scenarios';

/**
 * Our own copy of the CONTRACTS §10 defaults, so these tests do not depend on
 * lane A's config module.
 */
function testConfig(): SimConfig {
  return {
    seed: 1,
    fleetSize: 200,
    transformer: {
      ratingKw: 220,
      nominalVolts: 230,
      sagAtRating: 0.08,
      feederExtraSag: 0.5,
      sensorNoiseVolts: 1,
      tripLoadShare: 1.15,
      tripAfterTicks: 10,
      outageTicks: 30,
    },
    baseLoad: {
      hourlyKw: [55, 50, 48, 46, 46, 50, 62, 75, 80, 78, 76, 78, 82, 80, 78, 78, 82, 92, 104, 112, 114, 110, 96, 72],
      noiseShare: 0.04,
    },
    charger: { powerKw: 1, batteryKwh: 7, efficiency: 0.85, readyAtSoc: 0.9 },
    arrivals: {
      arriveMeanHour: 21.5,
      arriveSdMinutes: 60,
      departMeanHour: 7,
      departSdMinutes: 40,
      socMin: 0.1,
      socMax: 0.5,
    },
    scheduleIntervalTicks: 5,
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

const positive = (x: number) => Number.isFinite(x) && x > 0;
const positiveInt = (x: number) => Number.isInteger(x) && x > 0;
const share = (x: number) => Number.isFinite(x) && x >= 0 && x <= 1;

function sensible(command: Command): boolean {
  switch (command.kind) {
    case 'setBaseLoadScale':
      return positive(command.scale) && command.scale <= 3;
    case 'setRatingScale':
      return positive(command.scale) && command.scale <= 2;
    case 'setSupplyVoltage':
      return positive(command.perUnit) && command.perUnit >= 0.8 && command.perUnit <= 1.1;
    case 'powerCut':
      return positiveInt(command.ticks);
    case 'plugInBurst':
      return positiveInt(command.count);
    case 'removeChargers':
    case 'stubbornChargers':
      return share(command.fraction);
    case 'killScheduler':
    case 'reviveScheduler':
      return true;
    default:
      return false;
  }
}

/** Every leaf a complete SimConfig must have, as dotted paths. */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [prefix];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe('scenario list', () => {
  it('has the five scenarios BUILD B60 names', () => {
    expect(scenarios.map((s) => s.id)).toEqual(['standard', 'heatwave', 'load-shedding', 'growth', 'demo-3min']);
  });

  it('has unique ids', () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every scenario a title and a one-line description', () => {
    for (const s of scenarios) {
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(s.description.trim().length).toBeGreaterThan(0);
      expect(s.description).not.toContain('\n');
    }
  });
});

describe.each(scenarios.map((s) => [s.id, s] as const))('scenario %s', (_id, scenario) => {
  it('configure returns a complete config without changing its input', () => {
    const base = deepFreeze(testConfig());
    const before = JSON.stringify(base);
    const out = scenario.configure(base);
    expect(JSON.stringify(base)).toBe(before);
    expect(leafPaths(out).sort()).toEqual(leafPaths(base).sort());
    for (const path of leafPaths(out)) {
      const leaf = path.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown>)[k], out);
      if (Array.isArray(leaf)) {
        expect(leaf).toHaveLength(24);
        for (const kw of leaf) expect(positive(kw as number)).toBe(true);
      } else {
        expect(Number.isFinite(leaf as number), path).toBe(true);
      }
    }
  });

  it('configure is pure: the same input gives the same output', () => {
    const a = scenario.configure(deepFreeze(testConfig()));
    const b = scenario.configure(deepFreeze(testConfig()));
    expect(a).toEqual(b);
  });

  it('has a positive whole-tick duration', () => {
    expect(positiveInt(scenario.durationTicks)).toBe(true);
  });

  it('script ticks do not go backwards and stay within durationTicks', () => {
    let last = 0;
    for (const { atTick } of scenario.script) {
      expect(Number.isInteger(atTick)).toBe(true);
      expect(atTick).toBeGreaterThanOrEqual(last);
      expect(atTick).toBeLessThan(scenario.durationTicks);
      last = atTick;
    }
  });

  it('every scripted command value is sensible', () => {
    for (const { command } of scenario.script) expect(sensible(command), JSON.stringify(command)).toBe(true);
  });
});

describe('scenario details', () => {
  const byId = (id: string) => scenarios.find((s) => s.id === id)!;

  it('standard leaves the config alone and runs the three-day experiment', () => {
    const base = testConfig();
    expect(byId('standard').configure(base)).toEqual(base);
    expect(byId('standard').durationTicks).toBe(4320);
  });

  it('heatwave raises every hour of household demand by 30%', () => {
    const base = testConfig();
    const out = byId('heatwave').configure(base);
    out.baseLoad.hourlyKw.forEach((kw, h) => expect(kw).toBeCloseTo(base.baseLoad.hourlyKw[h]! * 1.3, 9));
    expect({ ...out, baseLoad: base.baseLoad }).toEqual(base);
  });

  it('load-shedding cuts the power for an hour in the evening', () => {
    const script = byId('load-shedding').script;
    expect(script).toHaveLength(1);
    expect(script[0]!.command).toEqual({ kind: 'powerCut', ticks: 60 });
    const hour = (12 + script[0]!.atTick / 60) % 24;
    expect(hour).toBe(23);
  });

  it('growth puts 300 chargers on the same transformer', () => {
    const base = testConfig();
    const out = byId('growth').configure(base);
    expect(out.fleetSize).toBe(300);
    expect(out.transformer).toEqual(base.transformer);
  });

  it('demo-3min plays heatwave, power cut and scheduler kill in that order', () => {
    const kinds = byId('demo-3min').script.map((c) => c.command.kind);
    expect(kinds).toEqual(['setBaseLoadScale', 'setBaseLoadScale', 'powerCut', 'killScheduler']);
    // The heatwave is switched off again before the power cut.
    expect(byId('demo-3min').script[1]!.command).toEqual({ kind: 'setBaseLoadScale', scale: 1 });
  });

  it('tickAt follows the noon-to-noon clock of CONTRACTS §1', () => {
    expect(tickAt(0, 12)).toBe(0);
    expect(tickAt(0, 18)).toBe(360);
    expect(tickAt(0, 0)).toBe(720);
    expect(tickAt(0, 7)).toBe(1140);
    expect(tickAt(1, 18)).toBe(1800);
    expect(tickAt(1, 23)).toBe(2100);
    expect(tickAt(0, 22, 45)).toBe(645);
  });
});
