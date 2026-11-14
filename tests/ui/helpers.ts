import type { AppDeps, Command, FleetMode, SimConfig, Simulation, Tick } from '../../src/contracts';
import { createFakeSimulation, fakeConfig } from '../../src/ui/dev/fakeSimulation';
import { devScenarios } from '../../src/ui/dev/scenarios';

/** jsdom has no 2D canvas. Return null quietly so the UI skips drawing. */
export function silenceCanvas(): void {
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
  }
}

export function fakeDeps(over: Partial<AppDeps> = {}): AppDeps {
  return {
    makeSimulation: (mode, config) => createFakeSimulation(config, mode),
    defaultConfig: fakeConfig(),
    scenarios: devScenarios,
    ...over,
  };
}

export interface SpyCall {
  readonly mode: FleetMode;
  readonly tick: Tick;
  readonly command: Command;
}

/** Wraps the fake simulation and records every command applied, with the tick it arrived on. */
export function spyDeps(calls: SpyCall[], config: SimConfig = { ...fakeConfig(), fleetSize: 40 }): AppDeps {
  return fakeDeps({
    defaultConfig: config,
    makeSimulation: (mode, cfg) => {
      const inner = createFakeSimulation(cfg, mode);
      const spy: Simulation = {
        config: inner.config,
        mode: inner.mode,
        get tick() {
          return inner.tick;
        },
        step: () => inner.step(),
        apply: (command) => {
          calls.push({ mode, tick: inner.tick, command });
          inner.apply(command);
        },
        snapshot: () => inner.snapshot(),
        metrics: () => inner.metrics(),
        history: () => inner.history(),
      };
      return spy;
    },
  });
}
