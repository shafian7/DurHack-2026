// plan.md §3.1 and P4: the two-transformer district on the Dhanmondi map.
import { describe, expect, it } from 'vitest';
import { createDistrict, zoneConfig } from '../../src/sim/district';
import { dhanmondiDistrict } from '../../src/map';
import { naivePolicy } from '../../src/policies/naive';
import { localPolicy } from '../../src/policies/local';

describe('district', () => {
  it('builds one zone per transformer with 100 rickshaws each, on different seeds', () => {
    const d = dhanmondiDistrict(1);
    expect(d.zones).toHaveLength(2);
    const [a, b] = [zoneConfig(d, 0), zoneConfig(d, 1)];
    expect(a.fleetSize).toBe(100);
    expect(b.fleetSize).toBe(100);
    expect(a.seed).not.toBe(b.seed);
    expect(a.transformer.thermal).toBeDefined();
  });

  it('sends every command to both zones', () => {
    const d = createDistrict(dhanmondiDistrict(1), 'naive', () => ({ policy: naivePolicy }));
    d.apply({ kind: 'powerCut', ticks: 30 });
    d.step();
    expect(d.zones.every((z) => z.snapshot().transformer.tripped)).toBe(true);
    expect(d.tick).toBe(1);
  });

  it('on a normal night naive charging bursts a transformer and the smart chargers do not', () => {
    const naive = createDistrict(dhanmondiDistrict(1), 'naive', () => ({ policy: naivePolicy }));
    const local = createDistrict(dhanmondiDistrict(1), 'local', () => ({ policy: localPolicy }));
    for (let t = 0; t < 1440; t++) {
      naive.step();
      local.step();
    }
    expect(naive.zones.some((z) => z.metrics().bursts > 0)).toBe(true);
    expect(local.zones.every((z) => z.metrics().bursts === 0)).toBe(true);
  });
});
