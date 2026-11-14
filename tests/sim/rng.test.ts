import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim';
import { deriveSeed } from '../../src/sim/rng';

const take = (seed: number, count: number): number[] => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
};

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    expect(take(42, 200)).toEqual(take(42, 200));
  });

  it('gives different sequences for neighbouring seeds', () => {
    expect(take(1, 20)).not.toEqual(take(2, 20));
  });

  it('next() stays in [0, 1) and is roughly uniform', () => {
    const values = take(7, 20_000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('int(n) returns integers in [0, n) and reaches every value', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i += 1) {
      const value = rng.int(6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
      seen.add(value);
    }
    expect(seen.size).toBe(6);
  });

  it('int rejects a non-positive or fractional bound', () => {
    const rng = createRng(1);
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(-2)).toThrow(RangeError);
    expect(() => rng.int(1.5)).toThrow(RangeError);
  });

  it('pick returns members of the list and rejects an empty one', () => {
    const rng = createRng(9);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i += 1) {
      expect(items).toContain(rng.pick(items));
    }
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('two generators with one seed do not share state', () => {
    const first = createRng(5);
    const second = createRng(5);
    first.next();
    first.next();
    expect(second.next()).toBe(createRng(5).next());
  });
});

describe('deriveSeed', () => {
  it('is deterministic and separates streams', () => {
    expect(deriveSeed(1, 0)).toBe(deriveSeed(1, 0));
    const seeds = new Set([deriveSeed(1, 0), deriveSeed(1, 1), deriveSeed(1, 2), deriveSeed(2, 0)]);
    expect(seeds.size).toBe(4);
  });

  it('gives streams that differ from each other', () => {
    expect(take(deriveSeed(1, 0), 20)).not.toEqual(take(deriveSeed(1, 1), 20));
  });
});
