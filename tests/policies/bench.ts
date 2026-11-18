/**
 * A small closed-loop bench (B21): N copies of a policy on one transformer,
 * with the voltage formula from CONTRACTS §2 copied here so the rule can be
 * tuned without the simulation core. Household load is held flat, every
 * rickshaw plugs in within the first hour, and none leaves: the worst case.
 */
import type { ChargerPolicy } from '../../src/contracts';
import { createRng } from '../../src/sim';

export interface BenchOptions {
  readonly chargers?: number;
  readonly ticks?: number;
  readonly baseLoadKw?: number;
  readonly ratingKw?: number;
  readonly seed?: number;
}

export interface BenchResult {
  readonly peakDrawing: number;
  readonly peakLoadKw: number;
  readonly overloadTicks: number;
  readonly meanFinalSoc: number;
  readonly ratingKw: number;
}

const NOMINAL = 230;
const SAG_AT_RATING = 0.08;
const FEEDER_EXTRA_SAG = 0.5;
const NOISE_V = 1;
const POWER_KW = 1;
const SOC_PER_TICK = (POWER_KW * 0.85) / (60 * 7);

export function runBench(policy: ChargerPolicy, opts: BenchOptions = {}): BenchResult {
  const n = opts.chargers ?? 200;
  const ticks = opts.ticks ?? 600;
  const base = opts.baseLoadKw ?? 105;
  const rating = opts.ratingKw ?? 220;
  const setup = createRng(opts.seed ?? 1);
  const noise = createRng((opts.seed ?? 1) + 1000);
  const behaviour = createRng((opts.seed ?? 1) + 2000);

  const chargers = Array.from({ length: n }, () => ({
    feeder: setup.next(),
    arrive: setup.int(60),
    soc: 0.1 + 0.4 * setup.next(),
    plugged: false,
    drawing: false,
    pluggedAt: 0,
    memory: policy.createMemory(behaviour),
  }));

  let lastLoad = base;
  let peakDrawing = 0;
  let peakLoad = 0;
  let overload = 0;
  for (let t = 0; t < ticks; t++) {
    let drawingNow = 0;
    for (const c of chargers) {
      if (!c.plugged && t >= c.arrive) {
        c.plugged = true;
        c.pluggedAt = t;
        policy.onEvent?.({ kind: 'pluggedIn', soc: c.soc }, c.memory, behaviour);
      }
      if (!c.plugged || c.soc >= 1) {
        c.drawing = false;
        continue;
      }
      // One-tick lag: the reading comes from last tick's load.
      const sag = SAG_AT_RATING * (1 + FEEDER_EXTRA_SAG * c.feeder) * (lastLoad / rating);
      const g = noise.next() + noise.next() + noise.next() - 1.5; // rough normal, sd 0.5
      const voltage = Math.max(0, NOMINAL * (1 - sag) + 2 * NOISE_V * g);
      const on =
        policy.decide(
          { voltage, nominalVolts: NOMINAL, soc: c.soc, drawing: c.drawing, pluggedTicks: t - c.pluggedAt },
          c.memory,
          behaviour,
        ) === 'on';
      c.drawing = on;
      if (on) {
        drawingNow++;
        c.soc = Math.min(1, c.soc + SOC_PER_TICK);
      }
    }
    lastLoad = base + drawingNow * POWER_KW;
    if (t >= 60) {
      peakDrawing = Math.max(peakDrawing, drawingNow);
      peakLoad = Math.max(peakLoad, lastLoad);
      if (lastLoad > rating) overload++;
    }
  }
  return {
    peakDrawing,
    peakLoadKw: peakLoad,
    overloadTicks: overload,
    meanFinalSoc: chargers.reduce((s, c) => s + c.soc, 0) / n,
    ratingKw: rating,
  };
}
