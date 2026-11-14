import type { Rng } from '../contracts';

/** Scrambles a 32-bit integer so that nearby seeds give unrelated streams. */
function mix(value: number): number {
  let h = value >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * A seed for an independent stream of the same simulation.
 * The core uses this to split config.seed into the demand, command and
 * behaviour streams (CONTRACTS §1).
 */
export function deriveSeed(seed: number, stream: number): number {
  return mix(mix(seed) + Math.imul(stream + 1, 0x9e3779b9));
}

/** Seeded, deterministic generator (mulberry32 over a scrambled seed). */
export function createRng(seed: number): Rng {
  let state = mix(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (n: number): number => {
    if (!Number.isInteger(n) || n <= 0) {
      throw new RangeError(`Rng.int needs a positive integer, got ${n}`);
    }
    return Math.floor(next() * n);
  };

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new RangeError('Rng.pick needs at least one item');
    }
    return items[int(items.length)] as T;
  };

  return { next, int, pick };
}
