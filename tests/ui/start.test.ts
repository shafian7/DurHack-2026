// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { startTickFrom } from '../../src/ui/app';

describe('?at= start time', () => {
  it('defaults to 17:00 and accepts evening and next-morning times', () => {
    expect(startTickFrom('')).toBe(300);
    expect(startTickFrom('?at=22:30')).toBe(630);
    expect(startTickFrom('?at=21')).toBe(540);
    expect(startTickFrom('?x=1&at=02:15')).toBe(14 * 60 + 15);
  });

  it('ignores nonsense and never starts before 17:00', () => {
    expect(startTickFrom('?at=99:00')).toBe(300);
    expect(startTickFrom('?at=13:00')).toBe(300);
  });
});
