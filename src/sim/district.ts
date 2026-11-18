/**
 * The district (plan.md §3.1): two transformers, each its own low-voltage
 * network, so each runs as one simulation zone. A charger on one transformer
 * only ever sees its own transformer's voltage.
 */
import type { Command, FleetMode, SimConfig, SimDeps, Simulation, ThermalConfig } from '../contracts';
import { defaultConfig } from './config';
import { createSimulation } from './core';
import { deriveSeed } from './rng';

export interface ZoneSpec {
  readonly id: string;
  /** Feeder position of each charger on this transformer, in charger-id order. */
  readonly feeders: readonly number[];
  /** Household demand as a share of the default profile. */
  readonly baseLoadShare: number;
  readonly ratingKw: number;
}

export interface DistrictConfig {
  readonly seed: number;
  readonly zones: readonly ZoneSpec[];
  /** Applied to every zone after the defaults; for scenarios and calibration. */
  readonly configure?: (zone: SimConfig) => SimConfig;
}

export interface District {
  readonly mode: FleetMode;
  readonly zones: readonly Simulation[];
  readonly tick: number;
  step(): void;
  apply(command: Command): void;
}

/**
 * Dhaka district transformers: overload protection that rarely acts (oversized
 * or bypassed fuses), and heating that can burst the transformer. These
 * figures are illustrative, not measured (plan.md §3.3), and were calibrated
 * against the naive mode only (docs/status/lane-b.md).
 */
export const DISTRICT_THERMAL: ThermalConfig = Object.freeze({
  ambientC: 32,
  ratedHotSpotRiseC: 78,
  thermalTauTicks: 75,
  burstHotSpotC: 140,
});
export const DISTRICT_TRIP_LOAD_SHARE = 1.6;

/** The simulation config of one zone. */
export function zoneConfig(district: DistrictConfig, index: number): SimConfig {
  const spec = district.zones[index]!;
  const base = defaultConfig();
  const config: SimConfig = {
    ...base,
    seed: deriveSeed(district.seed, 10 + index),
    fleetSize: spec.feeders.length,
    feeders: spec.feeders,
    transformer: {
      ...base.transformer,
      ratingKw: spec.ratingKw,
      tripLoadShare: DISTRICT_TRIP_LOAD_SHARE,
      thermal: DISTRICT_THERMAL,
    },
    baseLoad: { ...base.baseLoad, hourlyKw: base.baseLoad.hourlyKw.map((kw) => kw * spec.baseLoadShare) },
  };
  return district.configure ? district.configure(config) : config;
}

export function createDistrict(
  district: DistrictConfig,
  mode: FleetMode,
  deps: (zone: number) => SimDeps,
): District {
  const zones = district.zones.map((_, i) => createSimulation(zoneConfig(district, i), mode, deps(i)));
  let tick = 0;
  return {
    mode,
    zones,
    get tick() {
      return tick;
    },
    step() {
      for (const z of zones) z.step();
      tick += 1;
    },
    apply(command) {
      for (const z of zones) z.apply(command);
    },
  };
}
