/**
 * The Dhanmondi map and the district built on it. Imports only contracts,
 * the sim's district types and the map data, so the UI can use it.
 */
import type { DistrictConfig, ZoneSpec } from '../sim/district';
import data from './dhanmondi.json';
import type { MapData, Point } from './types';

export type { MapData, Point } from './types';
export const dhanmondi = data as unknown as MapData;

/**
 * Transformer ratings and household shares (plan.md §3.1). Household demand
 * is split by the buildings each transformer feeds. Ratings were calibrated
 * against naive charging only, so that a normal night overloads them, while
 * the fleet's nightly energy still fits under each rating spread over the night. See docs/status/lane-b.md.
 */
export const RATINGS_KW: readonly number[] = [115, 92];

export function districtZones(map: MapData = dhanmondi): ZoneSpec[] {
  const total = map.transformers.reduce((s, t) => s + t.buildings, 0);
  return map.transformers.map((t, ti) => {
    const feeders: number[] = [];
    for (const g of map.garages.filter((g) => g.transformer === ti)) {
      for (let b = 0; b < g.bays; b++) feeders.push(g.feeder);
    }
    return { id: t.id, feeders, baseLoadShare: t.buildings / total, ratingKw: RATINGS_KW[ti]! };
  });
}

export function dhanmondiDistrict(seed: number, configure?: DistrictConfig['configure']): DistrictConfig {
  return { seed, zones: districtZones(), ...(configure ? { configure } : {}) };
}

/** Which garage and bay a charger of a zone sits in. */
export function bayOf(map: MapData, zone: number, chargerId: number): { garage: number; bay: number } {
  let left = chargerId;
  for (let g = 0; g < map.garages.length; g++) {
    const garage = map.garages[g]!;
    if (garage.transformer !== zone) continue;
    if (left < garage.bays) return { garage: g, bay: left };
    left -= garage.bays;
  }
  return { garage: -1, bay: -1 };
}

export const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
