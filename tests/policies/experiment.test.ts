// V07: the experiment runner is reproducible and names what it ran.
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../../src/contracts';
import type { Scenario } from '../../src/contracts';
import { standard } from '../../src/scenarios';
import { buildReport } from '../../scripts/report';
import { runOne } from '../../scripts/runner';

const short: Scenario = { ...standard, id: 'standard-short', durationTicks: 2 * TICKS_PER_DAY };

describe('V07 experiment reproducibility', () => {
  it('the same arguments write the same table', () => {
    const a = buildReport({ commit: 'abc1234', seeds: [1, 2], scenario: short });
    const b = buildReport({ commit: 'abc1234', seeds: [1, 2], scenario: short });
    expect(a).toBe(b);
  }, 60_000);

  it('names the commit, seeds, scenario and config', () => {
    const text = buildReport({ commit: 'abc1234', seeds: [3], scenario: short });
    expect(text).toContain('`abc1234`');
    expect(text).toContain('**Seeds:** 3');
    expect(text).toContain('`standard-short`');
    expect(text).toContain('"fleetSize": 200');
    expect(text).toContain('"sagLimitFull"');
    for (const mode of ['naive', 'stagger', 'local', 'central']) expect(text).toContain(`| ${mode} |`);
  }, 60_000);

  it('a naive night overloads and a local night does not trip, on a short run', () => {
    const naive = runOne(short, 'naive', 1);
    const local = runOne(short, 'local', 1);
    expect(naive.trips).toBeGreaterThan(0);
    expect(local.trips).toBe(0);
    expect(local.peakLoadShare).toBeLessThan(naive.peakLoadShare);
  }, 60_000);
});
