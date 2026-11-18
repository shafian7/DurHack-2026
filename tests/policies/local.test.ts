// B21: the local rule's behaviours, against hand-built observations.
import { describe, expect, it } from 'vitest';
import type { ChargerAction, Rng } from '../../src/contracts';
import { createRng } from '../../src/sim';
import { LOCAL_PARAMS, localPolicy, sagLimit, waitShare, type LocalMemory } from '../../src/policies/local';
import { obs, sagged } from './helpers';

function plugged(soc: number, rng: Rng): LocalMemory {
  const m = localPolicy.createMemory(rng);
  localPolicy.onEvent!({ kind: 'pluggedIn', soc }, m, rng);
  return m;
}

/** Drives one charger with a voltage chosen per tick; returns its actions. */
function drive(m: LocalMemory, rng: Rng, ticks: number, voltageAt: (t: number) => number, soc = 0.3): ChargerAction[] {
  const out: ChargerAction[] = [];
  let drawing = false;
  for (let t = 0; t < ticks; t++) {
    const a = localPolicy.decide(obs({ voltage: voltageAt(t), soc, drawing, pluggedTicks: t }), m, rng);
    drawing = a === 'on';
    out.push(a);
  }
  return out;
}

describe('localPolicy', () => {
  it('starts after a short random delay when the voltage is healthy, and keeps drawing', () => {
    const rng = createRng(1);
    const m = plugged(0.3, rng);
    const actions = drive(m, rng, 200, () => 229);
    const first = actions.indexOf('on');
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(LOCAL_PARAMS.startDelayMaxTicks);
    expect(actions.slice(first).every((a) => a === 'on')).toBe(true);
  });

  it('backs off when the voltage sags past its limit', () => {
    const rng = createRng(2);
    const m = plugged(0.5, rng);
    drive(m, rng, 50, () => 229);
    const deep = sagged(sagLimit(0.5) + 0.02);
    const a = localPolicy.decide(obs({ voltage: deep, soc: 0.5, drawing: true, pluggedTicks: 50 }), m, rng);
    expect(a).toBe('off');
    expect(m.waitUntil).toBeGreaterThan(m.ticks);
  });

  it('does not start while the voltage leaves no room for one more charger', () => {
    // Inside the restart margin: a drawing charger stays on, a waiting one does not start.
    const tight = sagged(sagLimit(0.5) - LOCAL_PARAMS.restartMargin / 2);
    const setUp = (): LocalMemory => {
      const m = localPolicy.createMemory(createRng(1));
      m.reference = 230;
      m.drawn = 1e6; // a full duty, so no deprivation boost
      return m;
    };
    const rng = createRng(3);
    const drawingM = setUp();
    expect(localPolicy.decide(obs({ voltage: tight, soc: 0.5, drawing: true, pluggedTicks: 900 }), drawingM, rng)).toBe('on');
    const waitingM = setUp();
    for (let t = 0; t < 200; t++) {
      expect(localPolicy.decide(obs({ voltage: tight, soc: 0.5, drawing: false, pluggedTicks: 900 + t }), waitingM, rng)).toBe('off');
    }
    // With room to spare it starts once its wait is over.
    let started = false;
    for (let t = 0; t < 400 && !started; t++) {
      started = localPolicy.decide(obs({ voltage: 229, soc: 0.5, drawing: false, pluggedTicks: 1100 + t }), waitingM, rng) === 'on';
    }
    expect(started).toBe(true);
  });

  it('an emptier battery tolerates more sag and waits less', () => {
    expect(sagLimit(0.1)).toBeGreaterThan(sagLimit(0.9));
    expect(waitShare(0.1)).toBeLessThan(waitShare(0.9));
  });

  it('an emptier battery backs off less often under the same sag', () => {
    const backoffs = (soc: number): number => {
      const rng = createRng(11);
      const m = plugged(soc, rng);
      // Sag that sits between the two batteries' limits, with noise.
      const mid = (sagLimit(0.15) + sagLimit(0.85)) / 2;
      const noise = createRng(99);
      const acts = drive(m, rng, 600, (t) => (t < 30 ? 229 : sagged(mid) + (noise.next() - 0.5) * 2), soc);
      let count = 0;
      for (let i = 1; i < acts.length; i++) if (acts[i - 1] === 'on' && acts[i] === 'off') count++;
      return count;
    };
    expect(backoffs(0.15)).toBeLessThan(backoffs(0.85));
  });

  it('waits longer after repeated back-offs, up to a cap', () => {
    const rng = createRng(4);
    const m = plugged(0.9, rng);
    drive(m, rng, 30, () => 229, 0.9);
    const waits: number[] = [];
    for (let i = 0; i < 8; i++) {
      const before = m.ticks + 1;
      localPolicy.decide(obs({ voltage: sagged(0.2), soc: 0.9, drawing: true, pluggedTicks: 100 }), m, rng);
      waits.push(m.waitUntil - before);
      m.waitUntil = m.ticks; // let it try again at once
    }
    expect(m.backoffs).toBe(8);
    const cap = LOCAL_PARAMS.backoffBaseTicks * 2 ** LOCAL_PARAMS.backoffMaxDoublings;
    for (const w of waits) expect(w).toBeLessThanOrEqual(cap + 1);
  });

  it('spreads restarts after a power cut over several ticks', () => {
    const rng = createRng(5);
    const restarts: number[] = [];
    for (let c = 0; c < 200; c++) {
      const m = plugged(0.3, rng);
      const acts = drive(m, rng, 300, (t) => (t >= 100 && t < 160 ? 0 : 229));
      expect(acts.slice(100, 160).every((a) => a === 'off')).toBe(true);
      restarts.push(acts.indexOf('on', 160) - 160);
    }
    expect(Math.min(...restarts)).toBeGreaterThanOrEqual(1);
    expect(new Set(restarts).size).toBeGreaterThan(10);
    expect(Math.max(...restarts) - Math.min(...restarts)).toBeGreaterThan(LOCAL_PARAMS.outageRestartMaxTicks / 2);
  });

  it('a charger that has drawn little tolerates more sag than one that has drawn a lot', () => {
    // Same battery level, same sag; only the duty differs.
    const sag = sagLimit(0.6) + LOCAL_PARAMS.deprivationBoost / 2;
    const m1 = localPolicy.createMemory(createRng(1));
    const m2 = localPolicy.createMemory(createRng(1));
    m1.reference = 230;
    m2.reference = 230;
    m1.drawn = 0;
    m2.drawn = 300;
    const o = obs({ voltage: sagged(sag), soc: 0.6, drawing: true, pluggedTicks: 300 });
    expect(localPolicy.decide(o, m1, createRng(2))).toBe('on');
    expect(localPolicy.decide(o, m2, createRng(2))).toBe('off');
  });

  it('a power cut clears the back-off count, so old congestion does not stretch the restart', () => {
    const rng = createRng(6);
    const m = plugged(0.5, rng);
    drive(m, rng, 30, () => 229, 0.5);
    m.backoffs = 4;
    localPolicy.decide(obs({ voltage: 0, soc: 0.5, pluggedTicks: 40 }), m, rng);
    localPolicy.decide(obs({ voltage: 229, soc: 0.5, pluggedTicks: 41 }), m, rng);
    expect(m.backoffs).toBe(0);
    expect(m.waitUntil - m.ticks).toBeLessThanOrEqual(LOCAL_PARAMS.outageRestartMaxTicks);
  });
});

