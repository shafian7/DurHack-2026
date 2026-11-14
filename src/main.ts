// Browser entry and wiring (BUILD B04). It joins whichever modules have landed
// on build. A module that is missing gets a stand-in and is named in a banner,
// so the page never shows a placeholder as if it were the real thing.
import type { ChargerPolicy, FleetMode, MountApp, Scenario, Scheduler, SimConfig, Simulation } from './contracts';
import { TICKS_PER_DAY } from './contracts';
import { createSimulation, defaultConfig } from './sim';

type Loaded = Record<string, Record<string, unknown>>;

const first = (found: Loaded, name: string): unknown => Object.values(found)[0]?.[name];

const naive = first(import.meta.glob('./policies/naive.ts', { eager: true }), 'naivePolicy') as ChargerPolicy | undefined;
const stagger = first(import.meta.glob('./policies/stagger.ts', { eager: true }), 'staggerPolicy') as ChargerPolicy | undefined;
const local = first(import.meta.glob('./policies/local.ts', { eager: true }), 'localPolicy') as ChargerPolicy | undefined;
const makeScheduler = first(import.meta.glob('./policies/scheduler.ts', { eager: true }), 'createScheduler') as
  | (() => Scheduler)
  | undefined;
const scenarioList = first(import.meta.glob('./scenarios/index.ts', { eager: true }), 'scenarios') as
  | readonly Scenario[]
  | undefined;
const mountApp = first(import.meta.glob('./ui/index.ts', { eager: true }), 'mountApp') as MountApp | undefined;

const missing: string[] = [];
const need = <T>(value: T | undefined, label: string, standIn: T): T => {
  if (value !== undefined) return value;
  missing.push(label);
  return standIn;
};

// Stand-ins behave like naive charging: on whenever plugged in.
const alwaysOn: ChargerPolicy<null> = { name: 'stand-in', createMemory: () => null, decide: () => 'on' };
const allowAll: Scheduler = {
  name: 'stand-in',
  plan: (world) => world.chargers.filter((c) => c.state === 'waiting' || c.state === 'charging').map((c) => c.id),
};

const policies: Record<Exclude<FleetMode, 'central'>, ChargerPolicy> = {
  naive: need(naive, 'naive policy', alwaysOn),
  stagger: need(stagger, 'stagger policy', alwaysOn),
  local: need(local, 'local policy', alwaysOn),
};
const scheduler = need(makeScheduler, 'central scheduler', () => allowAll);
const scenarios = need(scenarioList, 'scenarios', [
  {
    id: 'standard',
    title: 'An ordinary night',
    description: 'Two hundred rickshaws come home in the evening and plug in on one transformer.',
    configure: (base: SimConfig) => base,
    script: [],
    durationTicks: 3 * TICKS_PER_DAY,
  },
]);

function makeSimulation(mode: FleetMode, config: SimConfig): Simulation {
  return mode === 'central'
    ? createSimulation(config, mode, { scheduler: scheduler() })
    : createSimulation(config, mode, { policy: policies[mode] });
}

const root = document.getElementById('app');
if (root) {
  if (mountApp) {
    mountApp(root, { makeSimulation, defaultConfig: defaultConfig(), scenarios });
  } else {
    root.textContent = 'RICKSHAWS: the interface has not landed yet.';
  }
  if (mountApp && missing.length > 0) {
    const banner = document.createElement('div');
    banner.setAttribute('role', 'alert');
    banner.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;padding:8px 16px;background:#7a1f1f;color:#fff;font:600 16px system-ui,sans-serif;z-index:9999';
    banner.textContent = `Not built yet, running as plain charging: ${missing.join(', ')}.`;
    document.body.append(banner);
  }
}
