// B20: naive is always on; stagger stays off for its drawn delay, then stays on.
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim';
import { naivePolicy } from '../../src/policies/naive';
import { MAX_DELAY_TICKS, staggerPolicy } from '../../src/policies/stagger';
import { obs, sagged } from './helpers';

describe('naivePolicy', () => {
  it('is on whatever it sees', () => {
    const rng = createRng(1);
    const m = naivePolicy.createMemory(rng);
    for (const voltage of [0, sagged(0.3), sagged(0.1), 230, 240]) {
      for (const soc of [0, 0.5, 0.99]) {
        expect(naivePolicy.decide(obs({ voltage, soc }), m, rng)).toBe('on');
      }
    }
  });
});

describe('staggerPolicy', () => {
  it('stays off for its drawn delay and then stays on, ignoring voltage', () => {
    const rng = createRng(3);
    for (let trial = 0; trial < 50; trial++) {
      const m = staggerPolicy.createMemory(rng);
      staggerPolicy.onEvent!({ kind: 'pluggedIn', soc: 0.2 }, m, rng);
      const delay = m.delayTicks;
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(MAX_DELAY_TICKS);
      for (let t = 0; t < MAX_DELAY_TICKS + 60; t++) {
        const voltage = t % 3 === 0 ? sagged(0.2) : 230;
        expect(staggerPolicy.decide(obs({ pluggedTicks: t, voltage }), m, rng)).toBe(t < delay ? 'off' : 'on');
      }
    }
  });

  it('draws a fresh delay at each plug-in, spread over the window', () => {
    const rng = createRng(5);
    const m = staggerPolicy.createMemory(rng);
    const delays = new Set<number>();
    for (let i = 0; i < 200; i++) {
      staggerPolicy.onEvent!({ kind: 'pluggedIn', soc: 0.3 }, m, rng);
      delays.add(m.delayTicks);
    }
    expect(delays.size).toBeGreaterThan(80);
    expect(Math.max(...delays)).toBeGreaterThan(MAX_DELAY_TICKS * 0.8);
    expect(Math.min(...delays)).toBeLessThan(MAX_DELAY_TICKS * 0.2);
  });
});
