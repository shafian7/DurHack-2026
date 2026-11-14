// @vitest-environment jsdom
// The interface on the fake simulation, in one jsdom file so CI starts one DOM environment.
// V08 run-time half (mountApp on the fake), B41 scoreboard and status states.
import { beforeEach, describe, expect, it } from 'vitest';
import type { Metrics } from '../../src/contracts';
import { createApp } from '../../src/ui/app';
import { mountApp } from '../../src/ui/index';
import { TILES, kw, pct } from '../../src/ui/scoreboard';
import { MODE_STYLE } from '../../src/ui/theme';
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

const tileText = (card: Element, key: string) =>
  card.querySelector(`[data-metric="${key}"] .rk-value`)!.textContent;

describe('scoreboard', () => {
  it('formats without inventing: rounding only, and a dash when there is no value', () => {
    expect(kw(219.6)).toBe('220 kW');
    expect(pct(0.874)).toBe('87%');
    expect(pct(null)).toBe('—');
  });

  it('labels each neighbourhood and shows exactly the figures metrics() returns', () => {
    const root = document.createElement('div');
    const app = createApp(root, fakeDeps());
    app.advance(1440 + 9 * 60);
    app.render();
    const cards = [...root.querySelectorAll('.rk-hood')];
    expect(cards).toHaveLength(3);
    cards.forEach((card, i) => {
      const sim = app.sims[i]!;
      expect(card.querySelector('h2')!.textContent).toBe(MODE_STYLE[sim.mode].label);
      const m: Metrics = sim.metrics();
      for (const tile of TILES) {
        expect(tileText(card, tile.key)).toBe(tile.value(m));
        expect(card.querySelector(`[data-metric="${tile.key}"] .rk-detail`)!.textContent).toBe(tile.detail(m));
      }
    });
    // A full night has passed, so departures exist and the ready share is a number from metrics.
    expect(tileText(cards[0]!, 'ready')).toMatch(/^\d+%$/);
    app.destroy();
  });

  it('shows POWER OUT on every neighbourhood during a power cut and clears it after', () => {
    const root = document.createElement('div');
    const app = createApp(root, fakeDeps());
    app.advance(5);
    for (const sim of app.sims) sim.apply({ kind: 'powerCut', ticks: 10 });
    app.advance(2);
    app.render();
    for (const card of root.querySelectorAll<HTMLElement>('.rk-hood')) {
      expect(card.dataset.power).toBe('out');
      expect(card.querySelector<HTMLElement>('.rk-badge-out')!.hidden).toBe(false);
    }
    app.advance(20);
    app.render();
    for (const card of root.querySelectorAll<HTMLElement>('.rk-hood')) {
      expect(card.dataset.power).toBe('on');
      expect(card.querySelector<HTMLElement>('.rk-badge-out')!.hidden).toBe(true);
    }
    app.destroy();
  });

  it('shows SCHEDULER OFFLINE on the scheduled neighbourhood only, until revived', () => {
    const root = document.createElement('div');
    const app = createApp(root, fakeDeps());
    for (const sim of app.sims) sim.apply({ kind: 'killScheduler' });
    app.advance(1);
    app.render();
    const offline = () =>
      [...root.querySelectorAll<HTMLElement>('.rk-hood')]
        .filter((c) => !c.querySelector<HTMLElement>('.rk-badge-dead')!.hidden)
        .map((c) => c.dataset.mode);
    expect(offline()).toEqual(['central']);
    for (const sim of app.sims) sim.apply({ kind: 'reviveScheduler' });
    app.advance(1);
    app.render();
    expect(offline()).toEqual([]);
    app.destroy();
  });
});
