/**
 * Experiment runner (lane B, B22 and B24). Runs every mode over a list of
 * seeds for a scenario, measures the nights after the warm-up day, and turns
 * the result into a markdown table (VALIDATION §2). No randomness of its own,
 * no wall-clock time: the same arguments give the same table (V07).
 */
import type { ChargerPolicy, Command, FleetMode, Scenario, ScriptedCommand, SimConfig, Simulation } from '../src/contracts';
import { TICKS_PER_DAY } from '../src/contracts';
import { createSimulation, defaultConfig } from '../src/sim';
import { naivePolicy } from '../src/policies/naive';
import { staggerPolicy } from '../src/policies/stagger';
import { localPolicy } from '../src/policies/local';
import { createScheduler } from '../src/policies/scheduler';

export const MODES: readonly FleetMode[] = ['naive', 'stagger', 'local', 'central'];
export const WARMUP_TICKS = TICKS_PER_DAY;

/** `local` replaces the local rule, for tuning runs. */
export function makeSimulation(mode: FleetMode, config: SimConfig, local: ChargerPolicy = localPolicy): Simulation {
  switch (mode) {
    case 'naive':
      return createSimulation(config, mode, { policy: naivePolicy });
    case 'stagger':
      return createSimulation(config, mode, { policy: staggerPolicy });
    case 'local':
      return createSimulation(config, mode, { policy: local });
    case 'central':
      return createSimulation(config, mode, { scheduler: createScheduler() });
  }
}

/** One run's measures, over the ticks after the warm-up. Per-night figures are divided by nights measured. */
export interface RunResult {
  readonly mode: FleetMode;
  readonly seed: number;
  readonly peakLoadShare: number;
  readonly overloadMinutesPerNight: number;
  readonly tripsPerNight: number;
  readonly outageMinutesPerNight: number;
  readonly readyShare: number | null;
  readonly readyShareNear: number | null;
  readonly readyShareFar: number | null;
  readonly minSocketVolts: number | null;
  readonly trips: number;
  readonly overloadTicks: number;
}

export interface Variant {
  /** Short label for the table. */
  readonly id: string;
  readonly title: string;
  /** Extra commands on top of the scenario's own script. */
  readonly commands: readonly ScriptedCommand[];
}

export const NO_VARIANT: Variant = { id: 'baseline', title: 'No extra commands', commands: [] };

const share = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);

export function runOne(
  scenario: Scenario,
  mode: FleetMode,
  seed: number,
  variant: Variant = NO_VARIANT,
  local: ChargerPolicy = localPolicy,
): RunResult {
  const config = scenario.configure({ ...defaultConfig(), seed });
  const sim = makeSimulation(mode, config, local);
  const script = [...scenario.script, ...variant.commands].sort((a, b) => a.atTick - b.atTick);
  const duration = scenario.durationTicks;
  const warmup = Math.min(WARMUP_TICKS, duration);
  let next = 0;
  let peakShare = 0;
  let minVolts: number | null = null;
  let atWarmup = sim.metrics();
  // Departures per half of the feeder, counted from state changes since tick 0,
  // so the cumulative near and far shares in Metrics can be split at the warm-up.
  const plugged = new Map<number, boolean>();
  let nearDepartures = 0;
  let farDepartures = 0;
  let nearAtWarmup = 0;
  let farAtWarmup = 0;

  for (let t = 0; t < duration; t++) {
    while (next < script.length && script[next].atTick <= t) {
      sim.apply(script[next].command as Command);
      next++;
    }
    sim.step();
    for (const c of sim.snapshot().chargers) {
      const isPlugged = c.state === 'waiting' || c.state === 'charging' || c.state === 'full';
      if (plugged.get(c.id) && c.state === 'away') {
        if (c.feeder < 0.5) nearDepartures++;
        else farDepartures++;
      }
      plugged.set(c.id, isPlugged);
    }
    if (sim.tick === warmup) {
      atWarmup = sim.metrics();
      nearAtWarmup = nearDepartures;
      farAtWarmup = farDepartures;
    }
    if (sim.tick > warmup) {
      const m = sim.metrics();
      if (m.loadShare > peakShare) peakShare = m.loadShare;
      const snap = sim.snapshot();
      if (!snap.transformer.tripped) {
        for (const c of snap.chargers) {
          if ((c.state === 'waiting' || c.state === 'charging') && (minVolts === null || c.voltage < minVolts)) {
            minVolts = c.voltage;
          }
        }
      }
    }
  }

  const end = sim.metrics();
  const nights = Math.max(1, (duration - warmup) / TICKS_PER_DAY);
  const departures = end.departures - atWarmup.departures;
  const ready = end.readyDepartures - atWarmup.readyDepartures;
  const near = halfShare(atWarmup.readyShareNear, nearAtWarmup, end.readyShareNear, nearDepartures);
  const far = halfShare(atWarmup.readyShareFar, farAtWarmup, end.readyShareFar, farDepartures);

  return {
    mode,
    seed,
    peakLoadShare: peakShare,
    overloadMinutesPerNight: (end.overloadTicks - atWarmup.overloadTicks) / nights,
    tripsPerNight: (end.trips - atWarmup.trips) / nights,
    outageMinutesPerNight: (end.outageTicks - atWarmup.outageTicks) / nights,
    readyShare: share(ready, departures),
    readyShareNear: near,
    readyShareFar: far,
    minSocketVolts: minVolts,
    trips: end.trips - atWarmup.trips,
    overloadTicks: end.overloadTicks - atWarmup.overloadTicks,
  };
}

/** Ready share of one feeder half over the measured nights, from cumulative shares and departure counts. */
function halfShare(shareBefore: number | null, countBefore: number, shareAfter: number | null, countAfter: number): number | null {
  const readyBefore = (shareBefore ?? 0) * countBefore;
  const readyAfter = (shareAfter ?? 0) * countAfter;
  return share(Math.round(readyAfter - readyBefore), countAfter - countBefore);
}

export interface ModeSummary {
  readonly mode: FleetMode;
  readonly runs: readonly RunResult[];
  readonly meanPeakLoadShare: number;
  readonly meanOverloadMinutesPerNight: number;
  readonly meanTripsPerNight: number;
  readonly meanOutageMinutesPerNight: number;
  readonly meanReadyShare: number | null;
  readonly meanReadyShareNear: number | null;
  readonly meanReadyShareFar: number | null;
  readonly lowestSocketVolts: number | null;
  readonly seedsWithTrip: number;
}

const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);
const meanOrNull = (xs: readonly (number | null)[]): number | null => {
  const vals = xs.filter((x): x is number => x !== null);
  return vals.length === 0 ? null : mean(vals);
};

export function summarise(mode: FleetMode, runs: readonly RunResult[]): ModeSummary {
  const volts = runs.map((r) => r.minSocketVolts).filter((v): v is number => v !== null);
  return {
    mode,
    runs,
    meanPeakLoadShare: mean(runs.map((r) => r.peakLoadShare)),
    meanOverloadMinutesPerNight: mean(runs.map((r) => r.overloadMinutesPerNight)),
    meanTripsPerNight: mean(runs.map((r) => r.tripsPerNight)),
    meanOutageMinutesPerNight: mean(runs.map((r) => r.outageMinutesPerNight)),
    meanReadyShare: meanOrNull(runs.map((r) => r.readyShare)),
    meanReadyShareNear: meanOrNull(runs.map((r) => r.readyShareNear)),
    meanReadyShareFar: meanOrNull(runs.map((r) => r.readyShareFar)),
    lowestSocketVolts: volts.length === 0 ? null : Math.min(...volts),
    seedsWithTrip: runs.filter((r) => r.trips > 0).length,
  };
}

export interface ExperimentResult {
  readonly scenario: Scenario;
  readonly variant: Variant;
  readonly seeds: readonly number[];
  readonly summaries: readonly ModeSummary[];
}

export function runExperiment(
  scenario: Scenario,
  seeds: readonly number[],
  variant: Variant = NO_VARIANT,
  modes: readonly FleetMode[] = MODES,
  local: ChargerPolicy = localPolicy,
): ExperimentResult {
  const summaries = modes.map((mode) =>
    summarise(mode, seeds.map((seed) => runOne(scenario, mode, seed, variant, local))),
  );
  return { scenario, variant, seeds, summaries };
}

// ------------------------------------------------------------- the claim

export interface ClauseVerdict {
  readonly clause: number;
  readonly text: string;
  readonly pass: boolean;
  readonly detail: string;
}

const pct = (x: number | null): string => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
const num = (x: number | null, digits = 1): string => (x === null ? 'n/a' : x.toFixed(digits));

/**
 * Judges clauses 1 to 5 of VALIDATION §2 on a standard experiment, and clause
 * 6 on a run of central mode with the scheduler killed. Thresholds are copied
 * from VALIDATION §2 and are not to be changed here (BUILD D05).
 */
export function judge(standard: ExperimentResult, killed: ExperimentResult | null): ClauseVerdict[] {
  const by = (mode: FleetMode): ModeSummary | undefined => standard.summaries.find((s) => s.mode === mode);
  const naive = by('naive');
  const local = by('local');
  const stagger = by('stagger');
  const central = by('central');
  const out: ClauseVerdict[] = [];
  const n = standard.seeds.length;
  const runFor = (s: ModeSummary, seed: number): RunResult => s.runs.find((r) => r.seed === seed)!;

  if (naive) {
    const k = naive.seedsWithTrip;
    out.push({
      clause: 1,
      text: 'Naive charging overloads the transformer',
      pass: k >= 8,
      detail: `naive tripped in ${k} of ${n} seeds (needs at least 8)`,
    });
  }
  if (naive && local) {
    const ratio = local.meanPeakLoadShare / naive.meanPeakLoadShare;
    const lower = standard.seeds.filter((s) => runFor(local, s).peakLoadShare < runFor(naive, s).peakLoadShare).length;
    const ovRatio =
      naive.meanOverloadMinutesPerNight > 0 ? local.meanOverloadMinutesPerNight / naive.meanOverloadMinutesPerNight : 0;
    out.push({
      clause: 2,
      text: 'Flattens the peak',
      pass: ratio <= 0.85 && lower >= 8 && ovRatio <= 0.1,
      detail: `mean peak local/naive = ${ratio.toFixed(3)} (needs ≤ 0.85); lower in ${lower} of ${n} seeds (needs ≥ 8); overloaded minutes local/naive = ${ovRatio.toFixed(3)} (needs ≤ 0.10)`,
    });
  }
  if (local) {
    const zero = standard.seeds.filter((s) => runFor(local, s).trips === 0).length;
    out.push({
      clause: 3,
      text: 'Keeps the transformer on',
      pass: zero >= 8,
      detail: `local had zero trips in ${zero} of ${n} seeds (needs at least 8)`,
    });
  }
  if (naive && local && central) {
    const l = local.meanReadyShare ?? 0;
    const nv = naive.meanReadyShare ?? 0;
    const c = central.meanReadyShare ?? 0;
    out.push({
      clause: 4,
      text: 'Still sends rickshaws out charged',
      pass: l >= nv && l >= c - 0.1,
      detail: `ready share local ${pct(l)}, naive ${pct(nv)}, central ${pct(c)} (local needs ≥ naive and ≥ central − 10 points)`,
    });
  }
  if (local && stagger) {
    const fewer = standard.seeds.filter(
      (s) => runFor(local, s).overloadTicks < runFor(stagger, s).overloadTicks,
    ).length;
    const l = local.meanReadyShare ?? 0;
    const st = stagger.meanReadyShare ?? 0;
    out.push({
      clause: 5,
      text: 'Sensing matters, not just randomness',
      pass: fewer >= 7 && l >= st,
      detail: `local had fewer overloaded minutes than stagger in ${fewer} of ${n} seeds (needs ≥ 7); ready share local ${pct(l)}, stagger ${pct(st)} (local must not be lower)`,
    });
  }
  if (killed) {
    const c = killed.summaries.find((s) => s.mode === 'central');
    if (c) {
      out.push({
        clause: 6,
        text: 'Nothing to fail',
        pass: c.seedsWithTrip >= 8,
        detail: `with the scheduler killed at tick 1800, central tripped in ${c.seedsWithTrip} of ${killed.seeds.length} seeds (needs at least 8)`,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------- formatting

export function formatTable(result: ExperimentResult): string {
  const lines = [
    '| Mode | Peak / rating | Overloaded min / night | Trips / night | Min without power / night | Ready | Ready near | Ready far | Lowest socket V | Seeds with a trip |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const s of result.summaries) {
    lines.push(
      `| ${s.mode} | ${pct(s.meanPeakLoadShare)} | ${num(s.meanOverloadMinutesPerNight)} | ${num(s.meanTripsPerNight, 2)} | ${num(s.meanOutageMinutesPerNight)} | ${pct(s.meanReadyShare)} | ${pct(s.meanReadyShareNear)} | ${pct(s.meanReadyShareFar)} | ${num(s.lowestSocketVolts)} | ${s.seedsWithTrip} of ${result.seeds.length} |`,
    );
  }
  return lines.join('\n');
}

export function formatPerSeed(result: ExperimentResult): string {
  const lines = ['| Mode | Seed | Peak / rating | Overloaded min | Trips | Ready |', '| --- | --- | --- | --- | --- | --- |'];
  for (const s of result.summaries) {
    for (const r of s.runs) {
      lines.push(`| ${s.mode} | ${r.seed} | ${pct(r.peakLoadShare)} | ${r.overloadTicks} | ${r.trips} | ${pct(r.readyShare)} |`);
    }
  }
  return lines.join('\n');
}
