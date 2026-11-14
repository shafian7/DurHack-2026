import { describe, expect, it } from 'vitest';
import type { Observation } from '../../src/contracts';
import { createRng, defaultConfig, noChargePolicy } from '../../src/sim';

describe('defaultConfig', () => {
  it('matches the starting values in CONTRACTS section 12', () => {
    const config = defaultConfig();
    expect(config.gridWidth).toBe(12);
    expect(config.gridHeight).toBe(12);
    expect(config.fleetSize).toBe(60);
    expect(config.sightBlocks).toBe(2);
    expect(config.speedBlocksPerTick).toBe(0.1);
    expect(config.patienceTicks).toBe(600);
    expect(config.demand.baseRatePerTick).toBe(0.12);
    expect(config.demand.hotspots.map((h) => h.ratePerTick)).toEqual([0.06, 0.06]);
    expect(config.demand.hotspots.every((h) => h.fromTick === 0 && h.toTick === null)).toBe(true);
    expect(config.charging.enabled).toBe(false);
    expect(config.charging.plugsPerCharger).toBe(2);
    expect(config.charging.drainPerBlock).toBe(0.004);
    expect(config.charging.chargePerTick).toBe(0.003);
    expect(config.charging.startBatteryMin).toBe(0.4);
    expect(config.charging.startBatteryMax).toBe(1.0);
    expect(config.charging.fullAt).toBe(0.95);
    expect(config.dispatchIntervalTicks).toBe(5);
    expect(config.queueRecheckTicks).toBe(30);
  });

  it('puts every hotspot and charger on the grid, one charger per quadrant', () => {
    const config = defaultConfig();
    const nodeCount = config.gridWidth * config.gridHeight;
    const onGrid = (node: number): boolean => Number.isInteger(node) && node >= 0 && node < nodeCount;
    expect(config.demand.hotspots.every((h) => onGrid(h.node))).toBe(true);
    expect(config.charging.chargerNodes.every(onGrid)).toBe(true);

    const quadrants = config.charging.chargerNodes.map((node) => {
      const x = node % config.gridWidth;
      const y = Math.floor(node / config.gridWidth);
      return `${x < config.gridWidth / 2 ? 'W' : 'E'}${y < config.gridHeight / 2 ? 'N' : 'S'}`;
    });
    expect(new Set(quadrants).size).toBe(4);
  });

  it('returns a fresh object each call', () => {
    expect(defaultConfig()).toEqual(defaultConfig());
    expect(defaultConfig()).not.toBe(defaultConfig());
    expect(defaultConfig().demand.hotspots).not.toBe(defaultConfig().demand.hotspots);
  });
});

describe('noChargePolicy', () => {
  it('always continues and keeps no memory', () => {
    const rng = createRng(1);
    const memory = noChargePolicy.createMemory(rng);
    expect(memory).toBeNull();

    const obs: Observation = {
      tick: 0,
      self: { id: 0, node: 0, battery: 0.01, state: 'cruising', queuedTicks: 0 },
      exits: [],
      visiblePassengers: [],
      visibleChargers: [],
      chargerHere: null,
      knownChargerNodes: [],
    };
    expect(noChargePolicy.decide(Object.freeze(obs), memory, rng)).toEqual({ kind: 'continue' });
  });
});
