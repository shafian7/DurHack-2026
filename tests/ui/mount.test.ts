// @vitest-environment jsdom
// V08, run-time half: mountApp runs against the fake simulation.
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/ui/app';
import { mountApp } from '../../src/ui/index';
import { fakeDeps, silenceCanvas } from './helpers';

beforeEach(() => {
  silenceCanvas();
  document.body.replaceChildren();
});

describe('mountApp on the fake simulation', () => {
  it('mounts into the root and builds the chart and one card per neighbourhood', () => {
    const root = document.createElement('div');
    document.body.append(root);
    mountApp(root, fakeDeps());
    expect(root.querySelector('canvas.rk-chart')).not.toBeNull();
    const cards = [...root.querySelectorAll<HTMLElement>('.rk-hood')];
    expect(cards.map((c) => c.dataset.mode)).toEqual(['naive', 'local', 'central']);
    expect(root.querySelector('.rk-clock')?.textContent).toBe('Night 1 · 12:00');
  });

  it('plays a night: every neighbourhood advances in lockstep and the clock follows', () => {
    const root = document.createElement('div');
    const app = createApp(root, fakeDeps());
    app.advance(9 * 60 + 30);
    app.render();
    expect(app.sims.map((s) => s.tick)).toEqual([570, 570, 570]);
    expect(root.querySelector('.rk-clock')?.textContent).toBe('Night 1 · 21:30');
    app.destroy();
  });

  it('turns frame time into ticks at the base speed of one simulated hour per second', () => {
    const root = document.createElement('div');
    const app = createApp(root, fakeDeps());
    app.frame(1000);
    app.frame(1100);
    app.frame(1200);
    expect(app.tick).toBe(12);
    app.destroy();
  });
});
