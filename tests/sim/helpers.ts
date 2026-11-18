import type { ChargerPolicy, Observation, SimConfig, Simulation } from '../../src/contracts';
import { defaultConfig } from '../../src/sim';

export const alwaysOn: ChargerPolicy<null> = { name: 'on', createMemory: () => null, decide: () => 'on' };
export const alwaysOff: ChargerPolicy<null> = { name: 'off', createMemory: () => null, decide: () => 'off' };

/** A policy that records every observation it is given and answers with `answer`. */
export function recorder(answer: 'on' | 'off'): { policy: ChargerPolicy<null>; seen: Observation[] } {
  const seen: Observation[] = [];
  return {
    seen,
    policy: {
      name: 'recorder',
      createMemory: () => null,
      decide: (obs) => {
        seen.push(obs);
        return answer;
      },
    },
  };
}

/** Default config with selected parts overridden. */
export function configWith(change: {
  seed?: number;
  fleetSize?: number;
  transformer?: Partial<SimConfig['transformer']>;
  baseLoad?: Partial<SimConfig['baseLoad']>;
  charger?: Partial<SimConfig['charger']>;
  arrivals?: Partial<SimConfig['arrivals']>;
}): SimConfig {
  const base = defaultConfig();
  return {
    ...base,
    seed: change.seed ?? base.seed,
    fleetSize: change.fleetSize ?? base.fleetSize,
    transformer: { ...base.transformer, ...change.transformer },
    baseLoad: { ...base.baseLoad, ...change.baseLoad },
    charger: { ...base.charger, ...change.charger },
    arrivals: { ...base.arrivals, ...change.arrivals },
  };
}

/** A flat household load with no wobble. */
export const flatLoad = (kw: number): SimConfig['baseLoad'] => ({ hourlyKw: Array.from({ length: 24 }, () => kw), noiseShare: 0 });

export function run(sim: Simulation, ticks: number, each?: (sim: Simulation) => void): void {
  for (let i = 0; i < ticks; i += 1) {
    sim.step();
    each?.(sim);
  }
}
