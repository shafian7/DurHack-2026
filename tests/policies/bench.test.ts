import { describe, expect, it } from 'vitest';
import { naivePolicy } from '../../src/policies/naive';
import { localPolicy } from '../../src/policies/local';
import { runBench } from './bench';

describe('closed-loop bench, 200 chargers', () => {
  // The bench is a worst case: flat evening household load and nobody leaves for
  // ten hours. Under that sustained shortage the local rule's deprivation term
  // lets the load sit above the rating for longer than naive, which finishes
  // sooner; that is recorded in docs/status/lane-b.md rather than hidden here.
  it('the local rule draws on fewer chargers at its peak than naive', () => {
    const naive = runBench(naivePolicy);
    const local = runBench(localPolicy);
    expect(naive.peakDrawing).toBe(200);
    expect(local.peakDrawing).toBeLessThan(naive.peakDrawing);
    expect(local.peakLoadKw).toBeLessThan(naive.peakLoadKw);
    // It still charges: batteries end well above where they started (0.1 to 0.5).
    expect(local.meanFinalSoc).toBeGreaterThan(0.6);
  });

  it('is deterministic for a seed', () => {
    expect(runBench(localPolicy, { seed: 4 })).toEqual(runBench(localPolicy, { seed: 4 }));
  });
});
