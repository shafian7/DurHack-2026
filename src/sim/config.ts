import type { SimConfig } from '../contracts';

/**
 * Starting values from CONTRACTS §12. Untested guesses until the first runs.
 * Returns a fresh object each call, so callers may spread and override it.
 */
export function defaultConfig(): SimConfig {
  const gridWidth = 12;
  const gridHeight = 12;
  const node = (x: number, y: number): number => y * gridWidth + x;

  return {
    seed: 1,
    gridWidth,
    gridHeight,
    fleetSize: 60,
    sightBlocks: 2,
    speedBlocksPerTick: 0.1,
    patienceTicks: 600,
    demand: {
      baseRatePerTick: 0.12,
      hotspots: [
        { node: node(3, 3), ratePerTick: 0.06, fromTick: 0, toTick: null },
        { node: node(8, 8), ratePerTick: 0.06, fromTick: 0, toTick: null },
      ],
    },
    charging: {
      enabled: false,
      // One per quadrant.
      chargerNodes: [node(2, 2), node(9, 2), node(2, 9), node(9, 9)],
      plugsPerCharger: 2,
      drainPerBlock: 0.004,
      chargePerTick: 0.003,
      startBatteryMin: 0.4,
      startBatteryMax: 1.0,
      fullAt: 0.95,
    },
    dispatchIntervalTicks: 5,
    queueRecheckTicks: 30,
  };
}
