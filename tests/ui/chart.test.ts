import { describe, expect, it } from 'vitest';
import type { TickSample } from '../../src/contracts';
import { chartWindow, niceCeil, outageSpans, yMaxFor } from '../../src/ui/chart';
import { clockLabel, clockText, durationText, hourOfDay, nightNumber, shortDuration } from '../../src/ui/time';

const sample = (tick: number, over: Partial<TickSample> = {}): TickSample => ({
  tick,
  loadKw: 100,
  baseLoadKw: 80,
  ratingKw: 220,
  plugged: 0,
  drawing: 0,
  busVolts: 230,
  tripped: false,
  ...over,
});

describe('chart model', () => {
  it('fills from the left during the first day, then scrolls', () => {
    const early = [{ mode: 'naive' as const, samples: [sample(0), sample(1), sample(2)] }];
    expect(chartWindow(early, 1440)).toEqual({ t0: 0, t1: 1440 });
    const late = [{ mode: 'naive' as const, samples: [sample(2000)] }];
    expect(chartWindow(late, 1440)).toEqual({ t0: 561, t1: 2001 });
  });

  it('finds each run of tripped samples', () => {
    const s = [0, 1, 2, 3, 4, 5, 6, 7].map((t) => sample(t, { tripped: t === 2 || t === 3 || t === 6 }));
    expect(outageSpans(s, 0, 100)).toEqual([
      { from: 2, to: 4 },
      { from: 6, to: 7 },
    ]);
    expect(outageSpans(s, 3, 100)).toEqual([
      { from: 3, to: 4 },
      { from: 6, to: 7 },
    ]);
  });

  it('puts the top of the scale well above the rating and above any curve', () => {
    expect(niceCeil(352)).toBe(500);
    expect(niceCeil(240)).toBe(250);
    expect(niceCeil(0)).toBe(1);
    expect(yMaxFor([{ mode: 'naive', samples: [sample(0)] }], 0)).toBe(500);
    expect(yMaxFor([{ mode: 'naive', samples: [sample(0, { loadKw: 600 })] }], 0)).toBe(1000);
  });
});

describe('clock', () => {
  it('starts at noon on night 1 (CONTRACTS §1)', () => {
    expect(hourOfDay(0)).toBe(12);
    expect(clockText(0)).toBe('12:00');
    expect(clockText(9 * 60 + 35)).toBe('21:35');
    expect(clockText(12 * 60)).toBe('00:00');
    expect(nightNumber(1439)).toBe(1);
    expect(clockLabel(1440 + 60)).toBe('Night 2 · 13:00');
    expect(durationText(45)).toBe('45 min');
    expect(durationText(125)).toBe("2 h 05 min");
    expect(shortDuration(125)).toBe("2h 05m");
    expect(shortDuration(45)).toBe("45 min");
  });
});
