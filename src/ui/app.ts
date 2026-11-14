/**
 * The interface: builds the page, runs every neighbourhood in lockstep and
 * draws them. It reads only the Simulation contract; it never imports the sim
 * core, the policies or the scenarios (VALIDATION V08).
 */
import type { AppDeps, FleetMode, Scenario, SimConfig, Simulation, Tick } from '../contracts';
import { fitCanvas } from './canvas';
import { drawChart, type ChartEvent } from './chart';
import { el, setText } from './dom';
import { drawStreet } from './street';
import { injectStyles } from './styles';
import { DISPLAY_MODES, MODE_STYLE } from './theme';
import { clockLabel } from './time';

export interface AppOptions {
  /** Start the animation loop at once. mountApp does; tests drive frames by hand. */
  readonly autoStart?: boolean;
  /** The neighbourhoods to show, in order. Defaults to naive, ours, scheduled. */
  readonly modes?: readonly FleetMode[];
}

export interface AppHandle {
  readonly root: HTMLElement;
  readonly sims: readonly Simulation[];
  readonly tick: Tick;
  /** Steps every neighbourhood the same number of ticks. */
  advance(ticks: number): void;
  render(): void;
  /** One animation frame at the given time in milliseconds. */
  frame(nowMs: number): void;
  destroy(): void;
}

/** Simulated minutes per real second at 1× speed: a day in 24 seconds. */
export const BASE_TICKS_PER_SECOND = 60;
/** Upper bound on ticks per frame, so a slow frame never stalls the page. */
const MAX_TICKS_PER_FRAME = 240;

interface HoodView {
  readonly mode: FleetMode;
  readonly card: HTMLElement;
  readonly street: HTMLCanvasElement;
}

export function createApp(root: HTMLElement, deps: AppDeps, options: AppOptions = {}): AppHandle {
  const doc = root.ownerDocument;
  const modes = options.modes ?? DISPLAY_MODES;
  injectStyles(doc);
  root.classList.add('rk-root');
  root.replaceChildren();

  let scenario: Scenario | null = deps.scenarios[0] ?? null;
  let sims: Simulation[] = [];
  const events: ChartEvent[] = [];
  let ticksPerSecond = BASE_TICKS_PER_SECOND;
  let paused = false;
  let carry = 0;
  let lastFrame: number | null = null;
  let raf: number | null = null;
  let destroyed = false;
  let failed = false;

  const configFor = (sc: Scenario | null): SimConfig => (sc ? sc.configure(deps.defaultConfig) : deps.defaultConfig);

  function rebuild(): void {
    const config = configFor(scenario);
    sims = modes.map((mode) => deps.makeSimulation(mode, config));
    events.length = 0;
    carry = 0;
  }

  // ------------------------------------------------------------------ layout
  const clock = el(doc, 'div', { class: 'rk-clock', 'aria-label': 'Simulated time' });
  const header = el(doc, 'header', { class: 'rk-top' }, [
    el(doc, 'div', { class: 'rk-brand' }, [
      el(doc, 'h1', { text: 'RICKSHAWS' }),
      el(doc, 'p', { text: 'One transformer, one street of rickshaw chargers, the same night three ways' }),
    ]),
    clock,
    el(doc, 'div', { class: 'rk-spacer' }),
  ]);

  const chart = el(doc, 'canvas', {
    class: 'rk-chart',
    role: 'img',
    'aria-label': 'Load on the transformer over time for each neighbourhood, against its rating',
  });
  const chartWrap = el(doc, 'section', { class: 'rk-chart-wrap' }, [chart]);

  const hoods: HoodView[] = modes.map((mode) => {
    const style = MODE_STYLE[mode];
    const street = el(doc, 'canvas', {
      class: 'rk-street',
      role: 'img',
      'aria-label': `${style.label}: one mark per charger along the street`,
    });
    const card = el(doc, 'section', { class: 'rk-hood', 'data-mode': mode }, [
      el(doc, 'h2', {}, [el(doc, 'span', { class: 'rk-swatch', 'data-marker': style.marker }), style.label]),
      el(doc, 'p', { class: 'rk-blurb', text: style.blurb }),
      street,
    ]);
    card.style.setProperty('--accent', style.colour);
    card.querySelector<HTMLElement>('.rk-swatch')!.style.background = style.colour;
    return { mode, card, street };
  });
  const hoodRow = el(doc, 'section', { class: 'rk-hoods' }, hoods.map((h) => h.card));

  root.append(header, chartWrap, hoodRow);

  // ---------------------------------------------------------------- running
  function advance(ticks: number): void {
    for (let i = 0; i < ticks; i++) {
      for (const sim of sims) sim.step();
    }
  }

  function render(): void {
    const lead = sims[0];
    if (!lead) return;
    setText(clock, clockLabel(lead.tick));

    const surface = fitCanvas(chart);
    if (surface) {
      drawChart(
        surface,
        sims.map((s) => ({ mode: s.mode, samples: s.history() })),
        { events },
      );
    }
    hoods.forEach((h, i) => {
      const sim = sims[i];
      if (!sim) return;
      const snap = sim.snapshot();
      const st = fitCanvas(h.street);
      if (st) drawStreet(st, snap, MODE_STYLE[h.mode].colour);
    });
  }

  function frame(nowMs: number): void {
    if (failed) return;
    try {
      const dt = lastFrame === null ? 0 : Math.min(250, Math.max(0, nowMs - lastFrame));
      lastFrame = nowMs;
      if (!paused) {
        carry += (dt / 1000) * ticksPerSecond;
        const n = Math.min(MAX_TICKS_PER_FRAME, Math.floor(carry));
        carry = Math.min(carry - n, MAX_TICKS_PER_FRAME);
        advance(n);
      }
      render();
    } catch (err) {
      // Nothing may throw in a running demo: stop the loop and say so on screen.
      failed = true;
      console.error(err);
      root.append(el(doc, 'p', { role: 'alert', class: 'rk-error', text: 'The simulation stopped with an error. Press reset.' }));
    }
  }

  const raf_ = globalThis.requestAnimationFrame?.bind(globalThis);
  const caf_ = globalThis.cancelAnimationFrame?.bind(globalThis);
  function loop(now: number): void {
    if (destroyed) return;
    frame(now);
    raf = raf_ ? raf_(loop) : null;
  }

  rebuild();
  render();
  if (options.autoStart && raf_) raf = raf_(loop);

  return {
    root,
    get sims() {
      return sims;
    },
    get tick() {
      return sims[0]?.tick ?? 0;
    },
    advance,
    render,
    frame,
    destroy() {
      destroyed = true;
      if (raf !== null && caf_) caf_(raf);
      root.replaceChildren();
    },
  };
}
