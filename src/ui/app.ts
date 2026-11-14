/**
 * The interface: builds the page, runs every neighbourhood in lockstep and
 * draws them. It reads only the Simulation contract; it never imports the sim
 * core, the policies or the scenarios (VALIDATION V08).
 */
import type { AppDeps, Command, FleetMode, Scenario, SimConfig, Simulation, Tick } from '../contracts';
import { fitCanvas } from './canvas';
import { drawChart, type ChartEvent } from './chart';
import { commandLabel, createCommandPanel } from './controls';
import { el, setText } from './dom';
import { createChartLegend, createStreetLegend } from './legend';
import { createScoreboard, type Scoreboard } from './scoreboard';
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
  readonly paused: boolean;
  readonly speed: number;
  readonly scenario: Scenario | null;
  /** Steps every neighbourhood the same number of ticks, replaying the script if one is playing. */
  advance(ticks: number): void;
  render(): void;
  /** One animation frame at the given time in milliseconds. */
  frame(nowMs: number): void;
  /** Sends one command to every neighbourhood, on the same tick. */
  send(command: Command): void;
  setSpeed(multiplier: number): void;
  setPaused(paused: boolean): void;
  /** Rebuilds every neighbourhood from the current scenario's config at tick 0. */
  reset(): void;
  selectScenario(id: string): void;
  /** Resets, then replays the current scenario's script until its duration. */
  playScript(): void;
  destroy(): void;
}

/** Simulated minutes per real second at 1× speed: a day in 24 seconds. */
export const BASE_TICKS_PER_SECOND = 60;
export const SPEEDS: readonly number[] = [0.25, 0.5, 1, 2, 4, 8];
/** The screen size the layout is drawn for; other screens scale to it. */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;
/** Upper bound on ticks per frame, so a slow frame never stalls the page. */
const MAX_TICKS_PER_FRAME = 240;

interface HoodView {
  readonly mode: FleetMode;
  readonly card: HTMLElement;
  readonly street: HTMLCanvasElement;
  readonly score: Scoreboard;
  readonly powerBadge: HTMLElement;
  readonly schedulerBadge: HTMLElement;
}

interface ScriptRun {
  readonly scenario: Scenario;
  cursor: number;
}

const SCALE_KINDS = new Set(['setBaseLoadScale', 'setRatingScale', 'setSupplyVoltage']);

export function createApp(root: HTMLElement, deps: AppDeps, options: AppOptions = {}): AppHandle {
  const doc = root.ownerDocument;
  const modes = options.modes ?? DISPLAY_MODES;
  injectStyles(doc);
  root.classList.add('rk-root');
  root.replaceChildren();

  let scenario: Scenario | null = deps.scenarios[0] ?? null;
  let sims: Simulation[] = [];
  const events: ChartEvent[] = [];
  let script: ScriptRun | null = null;
  let speed = 1;
  let paused = false;
  let carry = 0;
  let lastFrame: number | null = null;
  let raf: number | null = null;
  let destroyed = false;
  let failed = false;

  const configFor = (sc: Scenario | null): SimConfig => (sc ? sc.configure(deps.defaultConfig) : deps.defaultConfig);

  // ------------------------------------------------------------------ layout
  const clock = el(doc, 'div', { class: 'rk-clock', 'aria-label': 'Simulated time' });

  const pauseBtn = el(doc, 'button', { type: 'button', class: 'rk-btn rk-run-btn', 'data-run': 'pause' });
  const speedBtns = SPEEDS.map((s) =>
    el(doc, 'button', {
      type: 'button',
      class: 'rk-btn rk-speed',
      'data-speed': s,
      title: `${s}× speed`,
      text: s === 0.25 ? '¼×' : s === 0.5 ? '½×' : `${s}×`,
    }),
  );
  const resetBtn = el(doc, 'button', { type: 'button', class: 'rk-btn rk-run-btn', 'data-run': 'reset', text: '↺ Reset' });
  const scenarioSelect = el(
    doc,
    'select',
    { class: 'rk-select', 'data-run': 'scenario', 'aria-label': 'Scenario' },
    deps.scenarios.map((s) => el(doc, 'option', { value: s.id, text: s.title })),
  );
  const scriptBtn = el(doc, 'button', { type: 'button', class: 'rk-btn rk-run-btn', 'data-run': 'script', text: '▶ Play script' });
  const fullBtn = el(doc, 'button', {
    type: 'button',
    class: 'rk-btn rk-run-btn',
    'data-run': 'fullscreen',
    title: 'Full screen (F)',
    text: '⛶ Full screen',
  });
  const scriptStatus = el(doc, 'span', { class: 'rk-script-status', role: 'status' });
  const scenarioDesc = el(doc, 'p', { class: 'rk-scenario-desc' });

  const runBar = el(doc, 'div', { class: 'rk-run', role: 'toolbar', 'aria-label': 'Run controls' }, [
    pauseBtn,
    el(doc, 'div', { class: 'rk-speeds', role: 'group', 'aria-label': 'Speed' }, speedBtns),
    resetBtn,
    scenarioSelect,
    scriptBtn,
    fullBtn,
    scriptStatus,
  ]);

  const header = el(doc, 'header', { class: 'rk-top' }, [
    el(doc, 'div', { class: 'rk-brand' }, [
      el(doc, 'h1', { text: 'RICKSHAWS' }),
      el(doc, 'p', { text: 'Chargers that spread their own load' }),
    ]),
    clock,
    runBar,
  ]);

  const chart = el(doc, 'canvas', {
    class: 'rk-chart',
    role: 'img',
    'aria-label': 'Load on the transformer over time for each neighbourhood, against its rating',
  });
  const judge = createCommandPanel(doc, (cmd) => send(cmd));
  const main = el(doc, 'div', { class: 'rk-main' }, [
    el(doc, 'section', { class: 'rk-chart-wrap' }, [
      el(doc, 'div', { class: 'rk-chart-head' }, [scenarioDesc, createChartLegend(doc, modes)]),
      chart,
    ]),
    judge,
  ]);

  const hoods: HoodView[] = modes.map((mode) => {
    const style = MODE_STYLE[mode];
    const street = el(doc, 'canvas', {
      class: 'rk-street',
      role: 'img',
      'aria-label': `${style.label}: one mark per charger along the street`,
    });
    const score = createScoreboard(doc);
    const powerBadge = el(doc, 'div', { class: 'rk-badge rk-badge-out', role: 'status', hidden: true }, [
      el(doc, 'span', { class: 'rk-badge-icon', 'aria-hidden': 'true', text: '✕' }),
      'POWER OUT',
    ]);
    const schedulerBadge = el(doc, 'div', { class: 'rk-badge rk-badge-dead', role: 'status', hidden: true }, [
      el(doc, 'span', { class: 'rk-badge-icon', 'aria-hidden': 'true', text: '⊘' }),
      'SCHEDULER OFFLINE: chargers fall back to plain charging',
    ]);
    const card = el(doc, 'section', { class: 'rk-hood', 'data-mode': mode, 'data-power': 'on' }, [
      el(doc, 'h2', {}, [el(doc, 'span', { class: 'rk-swatch', 'data-marker': style.marker }), style.label]),
      el(doc, 'p', { class: 'rk-blurb', text: style.blurb }),
      powerBadge,
      schedulerBadge,
      street,
      score.node,
    ]);
    card.style.setProperty('--accent', style.colour);
    card.querySelector<HTMLElement>('.rk-swatch')!.style.background = style.colour;
    return { mode, card, street, score, powerBadge, schedulerBadge };
  });
  const hoodRow = el(doc, 'section', { class: 'rk-hoods' }, hoods.map((h) => h.card));

  root.append(header, main, createStreetLegend(doc), hoodRow);

  // ---------------------------------------------------------------- controls
  function syncRunControls(): void {
    setText(pauseBtn, paused ? '▶ Play' : '❚❚ Pause');
    pauseBtn.setAttribute('aria-pressed', String(paused));
    for (const b of speedBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === speed));
    if (scenario) scenarioSelect.value = scenario.id;
    setText(scenarioDesc, scenario ? scenario.description : '');
    scriptBtn.disabled = !scenario || scenario.script.length === 0;
  }

  /** Marks which level of each scale command is in force. */
  function syncPressed(cmd: Command | null): void {
    for (const b of judge.querySelectorAll<HTMLButtonElement>('button[data-cmd]')) {
      const kind = b.dataset.cmd!;
      if (!SCALE_KINDS.has(kind)) continue;
      if (cmd === null) b.setAttribute('aria-pressed', String(Number(b.dataset.value) === 1));
      else if (cmd.kind === kind) {
        const v = 'scale' in cmd ? cmd.scale : 'perUnit' in cmd ? cmd.perUnit : NaN;
        b.setAttribute('aria-pressed', String(Number(b.dataset.value) === v));
      }
    }
  }

  function send(command: Command): void {
    const tick = sims[0]?.tick ?? 0;
    for (const sim of sims) sim.apply(command);
    events.push({ tick, label: commandLabel(command) });
    syncPressed(command);
  }

  function rebuild(): void {
    const config = configFor(scenario);
    sims = modes.map((mode) => deps.makeSimulation(mode, config));
    events.length = 0;
    carry = 0;
    syncPressed(null);
  }

  function reset(): void {
    script = null;
    setText(scriptStatus, '');
    rebuild();
    render();
  }

  function setSpeed(multiplier: number): void {
    if (SPEEDS.includes(multiplier)) speed = multiplier;
    syncRunControls();
  }

  function setPaused(p: boolean): void {
    paused = p;
    lastFrame = null;
    syncRunControls();
  }

  function selectScenario(id: string): void {
    const next = deps.scenarios.find((s) => s.id === id);
    if (!next) return;
    scenario = next;
    syncRunControls();
    reset();
  }

  function playScript(): void {
    if (!scenario) return;
    reset();
    script = { scenario, cursor: 0 };
    setText(scriptStatus, `Script playing: ${scenario.title}`);
    setPaused(false);
  }

  pauseBtn.addEventListener('click', () => setPaused(!paused));
  for (const b of speedBtns) b.addEventListener('click', () => setSpeed(Number(b.dataset.speed)));
  resetBtn.addEventListener('click', () => reset());
  scenarioSelect.addEventListener('change', () => selectScenario(scenarioSelect.value));
  scriptBtn.addEventListener('click', () => playScript());

  function toggleFullscreen(): void {
    try {
      if (doc.fullscreenElement) void doc.exitFullscreen?.();
      else void doc.documentElement.requestFullscreen?.();
    } catch {
      // Full screen is a nicety; the browser's own F11 still works.
    }
  }
  fullBtn.addEventListener('click', toggleFullscreen);
  const onFullscreen = () => setText(fullBtn, doc.fullscreenElement ? '⛶ Exit full screen' : '⛶ Full screen');
  doc.addEventListener('fullscreenchange', onFullscreen);

  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t.tagName)) return;
    if (e.key === ' ') {
      e.preventDefault();
      setPaused(!paused);
    } else if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    }
  };
  doc.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- running
  function advance(ticks: number): void {
    for (let i = 0; i < ticks; i++) {
      if (script) {
        const t = sims[0]?.tick ?? 0;
        const lines = script.scenario.script;
        while (script.cursor < lines.length && lines[script.cursor]!.atTick <= t) {
          send(lines[script.cursor]!.command);
          script.cursor++;
        }
        if (t >= script.scenario.durationTicks) {
          setText(scriptStatus, `Script finished: ${script.scenario.title}`);
          script = null;
          setPaused(true);
          return;
        }
      }
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
      const out = snap.transformer.tripped;
      const offline = sim.mode === 'central' && !snap.schedulerAlive;
      h.card.dataset.power = out ? 'out' : 'on';
      h.card.dataset.scheduler = offline ? 'offline' : 'online';
      h.powerBadge.hidden = !out;
      h.schedulerBadge.hidden = !offline;
      h.score.update(sim.metrics());
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
        carry += (dt / 1000) * BASE_TICKS_PER_SECOND * speed;
        const n = Math.min(MAX_TICKS_PER_FRAME, Math.floor(carry));
        carry = Math.min(carry - n, MAX_TICKS_PER_FRAME);
        advance(n);
      }
      render();
    } catch (err) {
      // Nothing may throw in a running demo: stop the loop and say so on screen.
      failed = true;
      console.error(err);
      root.append(el(doc, 'p', { role: 'alert', class: 'rk-error', text: 'The simulation stopped with an error. Reload the page.' }));
    }
  }

  // The layout is designed for a 1920×1080 screen. On any screen at least
  // 900 px wide, scale the whole page so it fits exactly, the same way on a
  // laptop, a 720p projector or a 4K display. Narrower screens stack instead.
  const view = doc.defaultView;
  function fitToScreen(): void {
    if (!view) return;
    const w = view.innerWidth;
    const h = view.innerHeight;
    const z = w >= 900 && h > 0 ? Math.max(0.5, Math.min(2, w / DESIGN_WIDTH, h / DESIGN_HEIGHT)) : 1;
    root.style.setProperty('zoom', String(Math.round(z * 1000) / 1000));
  }
  fitToScreen();
  view?.addEventListener('resize', fitToScreen);

  const raf_ = globalThis.requestAnimationFrame?.bind(globalThis);
  const caf_ = globalThis.cancelAnimationFrame?.bind(globalThis);
  function loop(now: number): void {
    if (destroyed) return;
    frame(now);
    raf = raf_ ? raf_(loop) : null;
  }

  rebuild();
  syncRunControls();
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
    get paused() {
      return paused;
    },
    get speed() {
      return speed;
    },
    get scenario() {
      return scenario;
    },
    advance,
    render,
    frame,
    send,
    setSpeed,
    setPaused,
    reset,
    selectScenario,
    playScript,
    destroy() {
      destroyed = true;
      if (raf !== null && caf_) caf_(raf);
      doc.removeEventListener('keydown', onKey);
      doc.removeEventListener('fullscreenchange', onFullscreen);
      view?.removeEventListener('resize', fitToScreen);
      root.replaceChildren();
    },
  };
}
