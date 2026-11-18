import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/sim';
import { baseLoadKw, busVolts, clockLabel, hourOfDay, socGainPerTick, socketVolts, tickOfHour } from '../../src/sim/physics';

const config = defaultConfig();
const tx = config.transformer;

describe('clock', () => {
  it('starts at noon and wraps each day', () => {
    expect(hourOfDay(0)).toBe(12);
    expect(hourOfDay(60)).toBe(13);
    expect(hourOfDay(720)).toBe(0);
    expect(hourOfDay(1440)).toBe(12);
    expect(clockLabel(605)).toBe('22:05');
    expect(tickOfHour(21.5)).toBe(570);
    expect(tickOfHour(7)).toBe(1140);
  });
});

describe('baseLoadKw', () => {
  it('hits the hourly values and interpolates between them', () => {
    expect(baseLoadKw(config.baseLoad, 0)).toBe(config.baseLoad.hourlyKw[12]);
    expect(baseLoadKw(config.baseLoad, 720)).toBe(config.baseLoad.hourlyKw[0]);
    const mid = baseLoadKw(config.baseLoad, 30);
    expect(mid).toBeCloseTo((config.baseLoad.hourlyKw[12]! + config.baseLoad.hourlyKw[13]!) / 2);
    // 23:30 interpolates across midnight.
    expect(baseLoadKw(config.baseLoad, 690)).toBeCloseTo((config.baseLoad.hourlyKw[23]! + config.baseLoad.hourlyKw[0]!) / 2);
  });
});

describe('voltage', () => {
  it('is nominal at no load and sags by sagAtRating at the rating', () => {
    expect(busVolts(tx, 0, 1)).toBe(tx.nominalVolts);
    expect(busVolts(tx, tx.ratingKw, 1)).toBeCloseTo(tx.nominalVolts * (1 - tx.sagAtRating));
  });

  it('falls further along the feeder and scales with supply', () => {
    const near = socketVolts(tx, tx.ratingKw, 1, 0);
    const far = socketVolts(tx, tx.ratingKw, 1, 1);
    expect(near).toBeCloseTo(busVolts(tx, tx.ratingKw, 1));
    expect(far).toBeCloseTo(tx.nominalVolts * (1 - tx.sagAtRating * (1 + tx.feederExtraSag)));
    expect(far).toBeLessThan(near);
    expect(socketVolts(tx, 100, 0.9, 0.5)).toBeCloseTo(0.9 * socketVolts(tx, 100, 1, 0.5));
    expect(socketVolts(tx, 1e9, 1, 1)).toBe(0);
  });
});

describe('socGainPerTick', () => {
  it('matches power times efficiency over battery size per minute', () => {
    expect(socGainPerTick(config.charger)).toBeCloseTo((1.0 * 0.85) / (60 * 7));
  });
});

describe('defaultConfig', () => {
  it('matches CONTRACTS section 10 and returns a fresh object', () => {
    expect(config.fleetSize).toBe(200);
    expect(tx.ratingKw).toBe(220);
    expect(config.baseLoad.hourlyKw).toHaveLength(24);
    expect(config.arrivals.socMin).toBeLessThan(config.arrivals.socMax);
    expect(defaultConfig()).toEqual(defaultConfig());
    expect(defaultConfig()).not.toBe(defaultConfig());
  });
});
