// @vitest-environment jsdom
// The interface on the fake simulation, in one jsdom file so CI starts one DOM environment.
// V08 run-time half (mountApp on the fake), B41 scoreboard and status states, V09 and the run controls (B42).
import { beforeEach, describe, expect, it } from 'vitest';
import type { Command, Metrics, Scenario } from '../../src/contracts';
import { createApp } from '../../src/ui/app';
import { CONTROL_GROUPS, commandFor, commandLabel } from '../../src/ui/controls';
import { mountApp } from '../../src/ui/index';
import { TILES, kw, pct } from '../../src/ui/scoreboard';
import { MODE_STYLE } from '../../src/ui/theme';
import { fakeDeps, silenceCanvas, spyDeps, type SpyCall } from './helpers';

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

const ALL_KINDS: Command['kind'][] = [
  'setBaseLoadScale',
  'setRatingScale',
  'setSupplyVoltage',
  'powerCut',
  'plugInBurst',
  'removeChargers',
  'stubbornChargers',
  'killScheduler',
  'reviveScheduler',
];

describe('V09: judge controls reach every neighbourhood', () => {
  it('has a data-cmd control for every command kind', () => {
    const root = document.createElement('div');
    const app = createApp(root, fakeDeps());
    const kinds = new Set([...root.querySelectorAll<HTMLElement>('[data-cmd]')].map((b) => b.dataset.cmd));
    expect([...kinds].sort()).toEqual([...ALL_KINDS].sort());
    app.destroy();
  });

  it('sends each control’s command to all three neighbourhoods on the same tick', () => {
    const calls: SpyCall[] = [];
    const root = document.createElement('div');
    const app = createApp(root, spyDeps(calls));
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('button[data-cmd]')];
    expect(buttons.length).toBeGreaterThanOrEqual(ALL_KINDS.length);
    let t = 0;
    for (const btn of buttons) {
      app.advance(7);
      t += 7;
      calls.length = 0;
      btn.click();
      expect(calls.map((c) => c.mode)).toEqual(['naive', 'local', 'central']);
      const expected = commandFor(btn.dataset.cmd!, btn.dataset.value === undefined ? undefined : Number(btn.dataset.value));
      expect(expected).not.toBeNull();
      expect(expected!.kind).toBe(btn.dataset.cmd);
      for (const c of calls) {
        expect(c.command).toEqual(expected);
        expect(c.tick).toBe(t);
      }
    }
    app.destroy();
  });

  it('builds valid commands and refuses bad input', () => {
    for (const g of CONTROL_GROUPS) for (const c of g.controls) expect(commandFor(c.kind, c.value)).not.toBeNull();
    expect(commandFor('powerCut')).toBeNull();
    expect(commandFor('launchMissiles', 1)).toBeNull();
    expect(commandLabel({ kind: 'powerCut', ticks: 60 })).toBe('Power cut 1 h 00 min');
    expect(commandLabel({ kind: 'stubbornChargers', fraction: 0.2 })).toBe('20% stubborn');
  });
});

describe('run controls', () => {
  it('pauses, changes speed and resets every neighbourhood to tick 0', () => {
    const root = document.createElement('div');
    const app = createApp(root, fakeDeps());
    const q = (sel: string) => root.querySelector<HTMLButtonElement>(sel)!;

    q('[data-speed="4"]').click();
    expect(app.speed).toBe(4);
    app.frame(0);
    app.frame(100);
    expect(app.tick).toBe(24);

    q('[data-run="pause"]').click();
    expect(app.paused).toBe(true);
    app.frame(200);
    app.frame(300);
    expect(app.tick).toBe(24);

    q('[data-run="reset"]').click();
    expect(app.sims.map((s) => s.tick)).toEqual([0, 0, 0]);
    expect(app.sims.map((s) => s.metrics().peakLoadKw)).toEqual([0, 0, 0]);
    app.destroy();
  });

  it('switches scenario through the picker, building every neighbourhood from its config', () => {
    const seen: number[] = [];
    const scenarios: Scenario[] = [
      { id: 'a', title: 'A', description: 'first', configure: (b) => b, script: [], durationTicks: 100 },
      { id: 'b', title: 'B', description: 'second', configure: (b) => ({ ...b, fleetSize: 30 }), script: [], durationTicks: 100 },
    ];
    const base = fakeDeps();
    const root = document.createElement('div');
    const app = createApp(root, {
      ...base,
      scenarios,
      makeSimulation: (mode, cfg) => {
        seen.push(cfg.fleetSize);
        return base.makeSimulation(mode, cfg);
      },
    });
    const select = root.querySelector<HTMLSelectElement>('select[data-run="scenario"]')!;
    select.value = 'b';
    select.dispatchEvent(new Event('change'));
    expect(app.scenario?.id).toBe('b');
    expect(seen.slice(-3)).toEqual([30, 30, 30]);
    expect(root.querySelector('.rk-scenario-desc')!.textContent).toBe('second');
    app.destroy();
  });

  it('plays a script: each command reaches every neighbourhood at its tick, then stops at the duration', () => {
    const calls: SpyCall[] = [];
    const scripted: Scenario = {
      id: 's',
      title: 'Scripted',
      description: 'script',
      configure: (b) => b,
      script: [
        { atTick: 10, command: { kind: 'setBaseLoadScale', scale: 1.3 } },
        { atTick: 25, command: { kind: 'killScheduler' } },
      ],
      durationTicks: 40,
    };
    const root = document.createElement('div');
    const app = createApp(root, { ...spyDeps(calls), scenarios: [scripted] });
    root.querySelector<HTMLButtonElement>('[data-run="script"]')!.click();
    expect(app.tick).toBe(0);
    app.advance(100);
    expect(app.tick).toBe(40);
    expect(app.paused).toBe(true);
    expect(calls.map((c) => [c.mode, c.tick, c.command.kind])).toEqual([
      ['naive', 10, 'setBaseLoadScale'],
      ['local', 10, 'setBaseLoadScale'],
      ['central', 10, 'setBaseLoadScale'],
      ['naive', 25, 'killScheduler'],
      ['local', 25, 'killScheduler'],
      ['central', 25, 'killScheduler'],
    ]);
    // It plays again from the start without a reload.
    calls.length = 0;
    root.querySelector<HTMLButtonElement>('[data-run="script"]')!.click();
    app.advance(100);
    expect(app.tick).toBe(40);
    expect(calls).toHaveLength(6);
    app.destroy();
  });
});

describe('projector pass (B43)', () => {
  it('has a legend for every curve, the rating, household demand, outages and every street state', () => {
    const root = document.createElement('div');
    const app = createApp(root, fakeDeps());
    const keys = [...root.querySelectorAll<HTMLElement>('.rk-key')].map((k) => k.dataset.key);
    expect(keys).toEqual(
      expect.arrayContaining(['naive', 'local', 'central', 'rating', 'household', 'outage', 'away', 'waiting', 'charging', 'full', 'removed', 'stubborn']),
    );
    app.destroy();
  });

  it('offers full screen and scales the 1920×1080 layout to the window', () => {
    const root = document.createElement('div');
    const app = createApp(root, fakeDeps());
    expect(root.querySelector('[data-run="fullscreen"]')).not.toBeNull();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const expected = w >= 900 ? Math.max(0.5, Math.min(2, w / 1920, h / 1080)) : 1;
    expect(Number(root.style.getPropertyValue('zoom'))).toBeCloseTo(expected, 2);
    app.destroy();
  });
});
