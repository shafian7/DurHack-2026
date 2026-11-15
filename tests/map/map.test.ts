import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bayOf, dhanmondi, districtZones } from '../../src/map';

describe('Dhanmondi map data', () => {
  it('is small enough to ship', () => {
    const bytes = readFileSync(fileURLToPath(new URL('../../src/map/dhanmondi.json', import.meta.url))).length;
    expect(bytes).toBeLessThan(400 * 1024);
  });

  it('has two transformers and ten garages on the road graph, with feeders in 0 to 1', () => {
    const n = dhanmondi.graph.nodes.length;
    expect(dhanmondi.transformers).toHaveLength(2);
    expect(dhanmondi.garages).toHaveLength(10);
    for (const t of dhanmondi.transformers) expect(t.node).toBeGreaterThanOrEqual(0);
    for (const g of dhanmondi.garages) {
      expect(g.node).toBeGreaterThanOrEqual(0);
      expect(g.node).toBeLessThan(n);
      expect(g.feeder).toBeGreaterThan(0);
      expect(g.feeder).toBeLessThanOrEqual(1);
    }
    for (const t of [0, 1]) expect(Math.max(...dhanmondi.garages.filter((g) => g.transformer === t).map((g) => g.feeder))).toBe(1);
    expect(dhanmondi.buildings.length).toBeGreaterThan(500);
    expect(dhanmondi.attribution).toMatch(/OpenStreetMap/);
  });

  it('gives every charger a distinct bay in a garage of its own transformer', () => {
    const zones = districtZones();
    zones.forEach((z, zi) => {
      const seen = new Set<string>();
      for (let id = 0; id < z.feeders.length; id++) {
        const { garage, bay } = bayOf(dhanmondi, zi, id);
        expect(dhanmondi.garages[garage]!.transformer).toBe(zi);
        expect(z.feeders[id]).toBe(dhanmondi.garages[garage]!.feeder);
        seen.add(`${garage}:${bay}`);
      }
      expect(seen.size).toBe(z.feeders.length);
    });
  });
});
