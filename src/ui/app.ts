/**
 * The page: two copies of Dhanmondi on the same night, ordinary chargers on
 * the left and smart chargers on the right (plan.md §1). The maps fill the
 * screen; the load chart and the controls open from buttons. Every command
 * goes to both sides on the same tick.
 */
import { TICKS_PER_DAY, type Command, type FleetMode, type WorldSnapshot } from '../contracts';
import type { District } from '../sim/district';
import type { MapData } from '../map';
import { drawChart, type Series } from './chart';
import { MapView } from './mapView';
import { Motion } from './motion';
import { css } from './styles';
import { colors } from './theme';

export interface UiDeps {
  readonly map: MapData;
  /** Builds one side of the comparison for a seed. */
  readonly makeDistrict: (mode: FleetMode, seed: number) => District;
  /** Hot-spot temperature at which a transformer bursts, for the gauges. */
  readonly burstC: number;
}

type SideMode = 'central' | 'local';

interface Side {
  readonly mode: SideMode;
  readonly title: string;
  readonly color: string;
  district: District;
  readonly view: MapView;
  readonly panel: HTMLElement;
  readonly stage: HTMLElement;
  readonly state: HTMLElement;
  readonly chips: HTMLElement;
  readonly banner: HTMLElement;
  bannerUntil: number;
  announced: Set<number>;
}

/** Simulated minutes per real second. */
const SPEEDS = [2, 10, 30, 60] as const;
/** Each run starts at 17:00 on day one, just before rickshaws start coming home. */
const START_TICK = 5 * 60;
/** The automatic cut, at 21:00 on night one, while rickshaws are still arriving. */
const AUTO_CUT_TICK = 9 * 60;

const ICONS = {
  play: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></svg>',
  chart:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13.5h12"/><path d="M3 10.5l3-3.5 3 2 4-5"/></svg>',
  sliders:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2.5 4.5h11M2.5 11.5h11"/><circle cx="6" cy="4.5" r="1.8" fill="#fff"/><circle cx="10.5" cy="11.5" r="1.8" fill="#fff"/></svg>',
  cut:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9.5l-2 2a2.1 2.1 0 0 1-3-3l2-2"/><path d="M9.5 6.5l2-2a2.1 2.1 0 0 1 3 3l-2 2"/><path d="M6 3V1.5M3 6H1.5M10 13v1.5M13 10h1.5"/></svg>',
  link:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9.5l3-3"/><path d="M5 8l-1.5 1.5a2.1 2.1 0 0 0 3 3L8 11"/><path d="M11 8l1.5-1.5a2.1 2.1 0 0 0-3-3L8 5"/></svg>',
  restart:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 8a5.2 5.2 0 1 0 1.6-3.8"/><path d="M2.5 2.5v3h3"/></svg>',
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function clockText(tick: number): { night: string; time: string } {
  const minutes = (((12 * 60 + tick) % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(Math.floor(minutes % 60)).padStart(2, '0');
  return { night: `Night ${Math.floor(tick / TICKS_PER_DAY) + 1}`, time: `${hh}:${mm}` };
}

export function mountMapApp(root: HTMLElement, deps: UiDeps): { destroy(): void } {
  const style = el('style');
  style.textContent = css;
  document.head.append(style);

  const motion = new Motion(deps.map);
  let seed = 1;
  let speed: number = SPEEDS[1];
  let playing = true;
  let heatwave = false;
  let carry = 0;
  /** Whether the central server's data link is up. */
  let linkUp = true;
  /** Cut the link automatically at 21:00, so the story plays while the presenter talks. */
  let autoCut = true;
  /** The automatic cut happens at most once per run, so a restored link stays up. */
  let autoCutDone = false;

  const app = el('div', 'app');
  root.replaceChildren(app);

  // -------------------------------------------------------------- top bar
  const top = el('div', 'top');
  const brand = el('div', 'brand');
  brand.append(el('h1', undefined, 'RICKSHAWS'), el('span', undefined, `One night of battery-rickshaw charging in ${deps.map.name}`));

  const clock = el('div', 'clock');
  const clockTime = el('div', 't');
  const clockNight = el('div', 'n');
  clock.append(clockTime, clockNight);

  const tools = el('div', 'tools');
  const play = el('button', 'icon-btn play');
  play.title = 'Play or pause (space)';
  play.dataset.action = 'play';
  const seg = el('div', 'seg');
  const speedButtons = SPEEDS.map((s) => {
    const b = el('button', s === speed ? 'on' : '', `${s}×`);
    b.title = `${s} simulated minutes per second`;
    b.addEventListener('click', () => {
      speed = s;
      speedButtons.forEach((x) => x.classList.toggle('on', x === b));
    });
    return b;
  });
  seg.append(...speedButtons);
  const iconButton = (icon: string, label: string, title: string): HTMLButtonElement => {
    const b = el('button', 'icon-btn');
    b.innerHTML = `${icon}<span>${label}</span>`;
    b.title = title;
    return b;
  };
  const cutBtn = iconButton(ICONS.cut, 'Cut the connection', 'Cut the data link to the central server (X)');
  cutBtn.classList.add('cut');
  cutBtn.dataset.cmd = 'killScheduler';
  const restartBtn = iconButton(ICONS.restart, 'Restart', 'Restart tonight from 17:00 (R)');
  const chartBtn = iconButton(ICONS.chart, 'Load graph', 'Show the load graph (G)');
  const controlsBtn = iconButton(ICONS.sliders, 'Controls', 'Change the night (C)');
  tools.append(play, seg, cutBtn, restartBtn, chartBtn, controlsBtn);
  top.append(brand, clock, tools);

  // -------------------------------------------------------------- maps
  const maps = el('div', 'maps');
  const makeSide = (mode: SideMode, title: string, subtitle: string, color: string): Side => {
    const panel = el('section', 'panel');
    panel.dataset.mode = mode;
    const stage = el('div', 'stage');
    const view = new MapView(deps.map, motion);
    stage.append(view.canvas);
    const tag = el('div', 'tag glass');
    tag.innerHTML = `<h2><i style="background:${color}"></i>${title}</h2><p>${subtitle}</p>`;
    const state = el('div', 'state glass');
    const chips = el('div', 'chips');
    const banner = el('div', 'banner');
    panel.append(stage, tag, state, chips, banner);
    maps.append(panel);
    return {
      mode,
      title,
      color,
      district: deps.makeDistrict(mode, seed),
      view,
      panel,
      stage,
      state,
      chips,
      banner,
      bannerUntil: 0,
      announced: new Set(),
    };
  };
  const sides: Side[] = [
    makeSide(
      'central',
      'Connected chargers',
      'A central server switches every charger over a data link. If the link drops, chargers charge flat out.',
      colors.central,
    ),
    makeSide(
      'local',
      'Smart chargers',
      'No server and no link. Each charger senses only its own socket voltage and backs off when it sags.',
      colors.local,
    ),
  ];
  const vs = el('div', 'vs glass', 'Same night');
  maps.append(vs);

  // -------------------------------------------------------------- load graph sheet
  const sheet = el('div', 'sheet');
  const sheetHead = el('header');
  const legend = el('span', 'legend');
  legend.innerHTML = `
    <span><i style="border-color:${colors.central}"></i>Connected · T1</span>
    <span><i class="d" style="border-color:${colors.central}"></i>Connected · T2</span>
    <span><i style="border-color:${colors.local}"></i>Smart · T1</span>
    <span><i class="d" style="border-color:${colors.local}"></i>Smart · T2</span>`;
  const sheetClose = el('button', 'close', '✕');
  sheetClose.title = 'Close';
  sheetHead.append(el('h3', undefined, 'Load on each transformer tonight'), legend, sheetClose);
  const chartBox = el('div', 'chartbox');
  const chart = el('canvas');
  chartBox.append(chart);
  sheet.append(sheetHead, chartBox);

  // -------------------------------------------------------------- controls popover
  const pop = el('div', 'pop glass');
  const popHead = el('header');
  const popClose = el('button', 'close', '✕');
  popClose.title = 'Close';
  popHead.append(el('h3', undefined, 'Change the night, on both sides'), popClose);
  const actions = el('div', 'actions');
  const action = (title: string, sub: string, cmd: string, onClick: (b: HTMLButtonElement) => void): HTMLButtonElement => {
    const b = el('button', 'act');
    b.dataset.cmd = cmd;
    b.append(el('b', undefined, title), el('span', undefined, sub));
    b.addEventListener('click', () => onClick(b));
    actions.append(b);
    return b;
  };
  const send = (command: Command): void => {
    for (const s of sides) s.district.apply(command);
  };
  const heatBtn = action('Heatwave', 'Homes use 30% more power', 'setBaseLoadScale', (b) => {
    heatwave = !heatwave;
    b.classList.toggle('on', heatwave);
    send({ kind: 'setBaseLoadScale', scale: heatwave ? 1.3 : 1 });
  });
  action('Power cut', 'The grid goes off for an hour', 'powerCut', () => send({ kind: 'powerCut', ticks: 60 }));
  action('Stubborn chargers', '20% ignore the rule', 'stubbornChargers', () =>
    send({ kind: 'stubbornChargers', fraction: 0.2 }),
  );
  const autoBtn = action('Auto-cut at 21:00', 'Link drops by itself', 'autoCut', (b) => {
    autoCut = !autoCut;
    b.classList.toggle('on', autoCut);
  });
  autoBtn.classList.add('on');
  action('New night', 'Different arrivals', 'reset', () => {
    seed += 1;
    reset();
  });
  const key = el('div', 'key');
  key.innerHTML = `
    <span><i class="sw" style="background:${colors.charging}"></i>Bay charging</span>
    <span><i class="sw" style="border:1.5px solid ${colors.waiting}"></i>Bay waiting</span>
    <span><i class="sw" style="background:${colors.full}"></i>Battery full</span>
    <span><i class="sw" style="background:${colors.rickshaw};border-radius:50%"></i>Rickshaw driving</span>
    <span><i class="sw" style="background:${colors.ok};border-radius:50%"></i>Transformer OK</span>
    <span><i class="sw" style="background:${colors.hot};border-radius:50%"></i>Overloaded</span>
    <span><i class="sw" style="background:${colors.central}"></i>Control centre</span>
    <span><i class="sw" style="background:${colors.signal};border-radius:50%;width:6px;height:6px"></i>Data link</span>`;
  const note = el(
    'div',
    'note',
    `Roads: ${deps.map.attribution}. Buildings are drawn as simple boxes. Transformer heating and the burst point are illustrative model values, not measurements. Keys: space play/pause · X cut or restore the link · G graph · C controls · R restart.`,
  );
  pop.append(popHead, actions, key, note);

  // The graph is a row of the page, so opening it shrinks the maps instead of covering them.
  app.append(top, maps, sheet);
  document.body.append(pop);

  // -------------------------------------------------------------- open and close
  const setOpen = (panel: HTMLElement, button: HTMLElement, open: boolean): void => {
    panel.classList.toggle('open', open);
    button.classList.toggle('active', open);
  };
  const toggleSheet = (): void => setOpen(sheet, chartBtn, !sheet.classList.contains('open'));
  const togglePop = (): void => setOpen(pop, controlsBtn, !pop.classList.contains('open'));
  chartBtn.addEventListener('click', toggleSheet);
  controlsBtn.addEventListener('click', togglePop);
  sheetClose.addEventListener('click', () => setOpen(sheet, chartBtn, false));
  popClose.addEventListener('click', () => setOpen(pop, controlsBtn, false));

  const setPlaying = (on: boolean): void => {
    playing = on;
    play.innerHTML = playing ? ICONS.pause : ICONS.play;
  };
  play.addEventListener('click', () => setPlaying(!playing));

  const showBanner = (s: Side, html: string, tone: 'bad' | 'ok' | 'dark', ms: number): void => {
    s.banner.innerHTML = html;
    s.banner.className = `banner show ${tone}`;
    s.bannerUntil = performance.now() + ms;
  };
  const setLink = (up: boolean): void => {
    if (up === linkUp) return;
    linkUp = up;
    const command: Command = up ? { kind: 'reviveScheduler' } : { kind: 'killScheduler' };
    send(command);
    cutBtn.classList.toggle('done', !up);
    cutBtn.innerHTML = up ? `${ICONS.cut}<span>Cut the connection</span>` : `${ICONS.link}<span>Restore the connection</span>`;
    cutBtn.dataset.cmd = up ? 'killScheduler' : 'reviveScheduler';
    const at = clockText(sides[0]!.district.tick).time;
    const [connected, smart] = sides as [Side, Side];
    if (!up) {
      showBanner(connected, `<b>Connection lost at ${at}</b>No instructions reach the garages, so every charger falls back to charging flat out`, 'dark', 4500);
      showBanner(smart, '<b>Nothing to cut</b>These chargers never had a server or a link', 'ok', 3500);
    } else {
      showBanner(connected, `<b>Connection restored at ${at}</b>The server is scheduling chargers again`, 'ok', 3000);
    }
  };
  cutBtn.addEventListener('click', () => setLink(!linkUp));
  restartBtn.addEventListener('click', () => reset());

  const onKey = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') {
      e.preventDefault();
      setPlaying(!playing);
    } else if (e.key === 'g' || e.key === 'G') toggleSheet();
    else if (e.key === 'c' || e.key === 'C') togglePop();
    else if (e.key === 'r' || e.key === 'R') reset();
    else if (e.key === 'x' || e.key === 'X') setLink(!linkUp);
    else if (e.key === 'Escape') {
      setOpen(sheet, chartBtn, false);
      setOpen(pop, controlsBtn, false);
    } else if (e.key >= '1' && e.key <= '4') speedButtons[Number(e.key) - 1]?.click();
  };
  window.addEventListener('keydown', onKey);

  // -------------------------------------------------------------- behaviour
  function warmUp(): void {
    for (const s of sides) {
      while (s.district.tick < START_TICK) s.district.step();
    }
  }

  function reset(): void {
    heatwave = false;
    heatBtn.classList.remove('on');
    linkUp = true;
    autoCutDone = false;
    cutBtn.classList.remove('done');
    cutBtn.innerHTML = `${ICONS.cut}<span>Cut the connection</span>`;
    cutBtn.dataset.cmd = 'killScheduler';
    for (const s of sides) {
      s.district = deps.makeDistrict(s.mode, seed);
      s.view.reset();
      s.announced = new Set();
      s.bannerUntil = 0;
      s.banner.classList.remove('show');
    }
    carry = 0;
    warmUp();
  }

  const layout = (): void => {
    for (const s of sides) {
      const r = s.stage.getBoundingClientRect();
      s.view.resize(Math.floor(r.width), Math.floor(r.height));
    }
  };
  const observer = new ResizeObserver(layout);
  for (const s of sides) observer.observe(s.stage);

  const chip = (k: string, v: string, small = ''): string =>
    `<div class="chip glass"><div class="k">${k}</div><div class="v">${v}${small ? `<small>${small}</small>` : ''}</div></div>`;

  function updateOverlays(s: Side, zones: readonly WorldSnapshot[]): void {
    const metrics = s.district.zones.map((z) => z.metrics());
    const departures = metrics.reduce((n, m) => n + m.departures, 0);
    const ready = metrics.reduce((n, m) => n + m.readyDepartures, 0);
    const charging = metrics.reduce((n, m) => n + m.drawingNow, 0);
    const hottest = Math.max(...zones.map((z) => z.transformer.hotSpotC));
    const dark = zones.reduce(
      (n, z, i) => n + (z.transformer.tripped || z.transformer.burst ? deps.map.transformers[i]!.buildings : 0),
      0,
    );
    s.chips.innerHTML =
      chip('Charging now', `${charging}`, 'rickshaws') +
      chip('Hottest transformer', `${Math.round(hottest)}°C`) +
      chip('Left fully charged', departures > 0 ? `${Math.round((100 * ready) / departures)}%` : '–', departures > 0 ? `of ${departures}` : 'at dawn');

    // One plain-language state for the whole map.
    const burst = zones.findIndex((z) => z.transformer.burst);
    const out = zones.some((z) => z.transformer.tripped);
    const overloaded = zones.some((z) => z.transformer.loadKw > z.transformer.ratingKw);
    const lost = s.mode === 'central' && zones.some((z) => !z.schedulerAlive);
    let text: string;
    let cls = '';
    if (burst >= 0) {
      text = `${deps.map.transformers[burst]!.id} burst · ${dark.toLocaleString()} buildings dark`;
      cls = 'bad';
    } else if (out) {
      text = 'Power cut';
      cls = 'bad';
    } else if (lost) {
      text = overloaded ? 'No connection · transformer overloaded' : 'No connection · charging flat out';
      cls = 'bad';
    } else if (overloaded) {
      text = 'Transformer overloaded';
      cls = 'warn';
    } else {
      text = s.mode === 'central' ? 'Connected · server in control' : 'All lights on · no link needed';
    }
    s.state.className = `state glass ${cls}`;
    s.state.innerHTML = `<i></i>${text}`;
    s.panel.classList.toggle('alert', burst >= 0);
  }

  function announce(s: Side, zones: readonly WorldSnapshot[], now: number): void {
    zones.forEach((z, i) => {
      if (z.transformer.burst && !s.announced.has(i)) {
        s.announced.add(i);
        const m = s.district.zones[i]!.metrics();
        const at = m.burstTick !== null ? clockText(m.burstTick).time : '';
        const t = deps.map.transformers[i]!;
        const rickshaws = z.chargers.filter((c) => c.state !== 'away' && c.state !== 'removed').length;
        showBanner(
          s,
          `<b>${t.label} burst at ${at}</b>${t.buildings.toLocaleString()} buildings and ${rickshaws} rickshaws lose power for the rest of the night`,
          'bad',
          5000,
        );
      }
    });
    if (s.bannerUntil && now > s.bannerUntil) {
      s.banner.classList.remove('show');
      s.bannerUntil = 0;
    }
  }

  let last = performance.now();
  let raf = 0;
  let overlaysAt = 0;
  const frame = (now: number): void => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) {
      carry += dt * speed;
      let steps = Math.floor(carry);
      carry -= steps;
      steps = Math.min(steps, 120);
      for (let i = 0; i < steps; i++) for (const s of sides) s.district.step();
    }
    if (autoCut && !autoCutDone && sides[0]!.district.tick >= AUTO_CUT_TICK) {
      autoCutDone = true;
      setLink(false);
    }
    const tick = sides[0]!.district.tick;
    const time = tick + (playing ? carry : 0);
    const c = clockText(tick);
    clockTime.textContent = c.time;
    clockNight.textContent = c.night;

    const refresh = now - overlaysAt > 200;
    const chartOpen = sheet.classList.contains('open');
    const series: Series[] = [];
    for (const s of sides) {
      const zones = s.district.zones.map((z) => z.snapshot());
      const link = s.mode === 'central' ? (zones.every((z) => z.schedulerAlive) ? 'up' : 'cut') : 'none';
      s.view.draw({ zones, time, now, burstC: deps.burstC, link });
      announce(s, zones, now);
      if (refresh) updateOverlays(s, zones);
      if (chartOpen) {
        s.district.zones.forEach((z, i) =>
          series.push({ label: `${s.title} T${i + 1}`, color: s.color, dashed: i === 1, samples: z.history() }),
        );
      }
    }
    if (refresh) overlaysAt = now;
    if (chartOpen) {
      const box = chartBox.getBoundingClientRect();
      drawChart(chart, Math.floor(box.width), Math.floor(box.height), time, series);
    }
    raf = requestAnimationFrame(frame);
  };

  setPlaying(true);
  warmUp();
  layout();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('keydown', onKey);
      sheet.remove();
      pop.remove();
      style.remove();
    },
  };
}
