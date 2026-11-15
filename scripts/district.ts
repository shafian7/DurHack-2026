/**
 * The district experiment (plan.md §3.7): both Dhanmondi transformers, every
 * mode, over seeds, from tick 0 (the demo is the first night). Reports bursts,
 * how long buildings were dark, temperatures and ready shares.
 */
import type { FleetMode, ScriptedCommand } from '../src/contracts';
import { TICKS_PER_DAY } from '../src/contracts';
import { dhanmondi, dhanmondiDistrict, networkOutageForPowerCut } from '../src/map';
import { createDistrict, DISTRICT_THERMAL } from '../src/sim/district';
import { naivePolicy } from '../src/policies/naive';
import { staggerPolicy } from '../src/policies/stagger';
import { localPolicy } from '../src/policies/local';
import { createScheduler } from '../src/policies/scheduler';

/** The demo's automatic cut of the central server's link: 21:00 on night one. */
export const DEMO_CUT_TICK = 9 * 60;
/** A grid power cut at 22:00 on night one, for the network-linked scenario. */
export const POWER_CUT_TICK = 10 * 60;

export interface DistrictRun {
  readonly mode: FleetMode;
  /** Commands applied during the run, in tick order. */
  readonly script: readonly ScriptedCommand[];
  readonly seed: number;
  readonly bursts: number;
  readonly firstBurstTick: number | null;
  readonly peakShare: readonly number[];
  readonly maxHotSpotC: number;
  /** Building-hours without power, over the whole run. */
  readonly buildingHoursDark: number;
  readonly readyShare: number | null;
  readonly readyShareFar: number | null;
}

export function runDistrict(
  mode: FleetMode,
  seed: number,
  ticks = 3 * TICKS_PER_DAY,
  script: readonly ScriptedCommand[] = [],
): DistrictRun {
  const ordered = [...script].sort((a, b) => a.atTick - b.atTick);
  let next = 0;
  const d = createDistrict(dhanmondiDistrict(seed), mode, () =>
    mode === 'central'
      ? { scheduler: createScheduler() }
      : { policy: mode === 'naive' ? naivePolicy : mode === 'stagger' ? staggerPolicy : localPolicy },
  );
  for (let t = 0; t < ticks; t++) {
    while (next < ordered.length && ordered[next]!.atTick <= t) d.apply(ordered[next++]!.command);
    d.step();
  }
  const ms = d.zones.map((z) => z.metrics());
  const departures = ms.reduce((n, m) => n + m.departures, 0);
  const ready = ms.reduce((n, m) => n + m.readyDepartures, 0);
  const farParts = ms.filter((m) => m.readyShareFar !== null);
  const burstTicks = ms.map((m) => m.burstTick).filter((t): t is number => t !== null);
  return {
    mode,
    script: ordered,
    seed,
    bursts: ms.reduce((n, m) => n + m.bursts, 0),
    firstBurstTick: burstTicks.length ? Math.min(...burstTicks) : null,
    peakShare: ms.map((m) => m.peakLoadShare),
    maxHotSpotC: Math.max(...ms.map((m) => m.maxHotSpotC)),
    buildingHoursDark: ms.reduce((n, m, i) => n + (m.outageTicks / 60) * dhanmondi.transformers[i]!.buildings, 0),
    readyShare: departures ? ready / departures : null,
    readyShareFar: farParts.length ? farParts.reduce((s, m) => s + m.readyShareFar!, 0) / farParts.length : null,
  };
}

const pct = (x: number | null): string => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const clock = (tick: number): string => {
  const m = (12 * 60 + tick) % TICKS_PER_DAY;
  return `night ${Math.floor(tick / TICKS_PER_DAY) + 1}, ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export function districtSection(seeds: readonly number[]): string {
  const kill: ScriptedCommand[] = [{ atTick: DEMO_CUT_TICK, command: { kind: 'killScheduler' } }];
  const cut: ScriptedCommand[] = [
    { atTick: POWER_CUT_TICK, command: { kind: 'powerCut', ticks: 60 } },
    ...networkOutageForPowerCut(POWER_CUT_TICK, 60),
  ];
  const rows: { label: string; mode: FleetMode; script: ScriptedCommand[] }[] = [
    { label: 'naive (ordinary chargers)', mode: 'naive', script: [] },
    { label: 'stagger', mode: 'stagger', script: [] },
    { label: 'local (smart chargers)', mode: 'local', script: [] },
    { label: 'central (app-controlled), network up all night', mode: 'central', script: [] },
    { label: 'central, network down from 21:00 (the demo)', mode: 'central', script: kill },
    { label: 'naive, 1-hour power cut at 22:00', mode: 'naive', script: cut },
    { label: 'local, 1-hour power cut at 22:00', mode: 'local', script: cut },
    { label: 'central, 1-hour power cut at 22:00, towers fail after 30 min', mode: 'central', script: cut },
  ];
  const runs = rows.map((row) => seeds.map((seed) => runDistrict(row.mode, seed, 3 * TICKS_PER_DAY, row.script)));
  const lines = [
    '## Dhanmondi district: two transformers, three days from tick 0 (plan.md §3.7)',
    '',
    `Both transformers of the map (${dhanmondi.transformers.map((t) => `${t.id} feeds ${t.buildings} buildings`).join(', ')}), 100 rickshaws each. Heating: ambient ${DISTRICT_THERMAL.ambientC} °C, rated hot-spot rise ${DISTRICT_THERMAL.ratedHotSpotRiseC} °C, time constant ${DISTRICT_THERMAL.thermalTauTicks} min, burst at ${DISTRICT_THERMAL.burstHotSpotC} °C. These are illustrative values, calibrated against naive charging only. Measured from tick 0, because the demo is the first night.`,
    '',
    '| Mode | Seeds with a burst | Bursts per run | Earliest burst (median) | Peak T1 / T2 | Hottest °C | Building-hours dark | Ready | Ready far |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  runs.forEach((rs, i) => {
    const firsts = rs.map((r) => r.firstBurstTick).filter((t): t is number => t !== null).sort((a, b) => a - b);
    lines.push(
      `| ${rows[i]!.label} | ${rs.filter((r) => r.bursts > 0).length} of ${rs.length} | ${mean(rs.map((r) => r.bursts)).toFixed(1)} | ${firsts.length ? clock(firsts[Math.floor(firsts.length / 2)]!) : 'none'} | ${pct(mean(rs.map((r) => r.peakShare[0]!)))} / ${pct(mean(rs.map((r) => r.peakShare[1]!)))} | ${Math.max(...rs.map((r) => r.maxHotSpotC)).toFixed(0)} | ${Math.round(mean(rs.map((r) => r.buildingHoursDark))).toLocaleString('en-GB')} | ${pct(mean(rs.map((r) => r.readyShare ?? 0)))} | ${pct(mean(rs.map((r) => r.readyShareFar ?? 0)))} |`,
    );
  });
  return lines.join('\n');
}
