/**
 * The page: two copies of Dhanmondi on the same night, ordinary chargers on
 * the left and smart chargers on the right, with the load chart and the
 * actions below (plan.md §1). Every command goes to both sides on the same tick.
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

type SideMode = 'naive' | 'local';

interface Side {
  readonly mode: SideMode;
  readonly title: string;
  readonly subtitle: string;
  readonly color: string;
  district: District;
  readonly view: MapView;
  readonly stage: HTMLElement;
  readonly stats: HTMLElement;
  readonly banner: HTMLElement;
  bannerUntil: number;
  announced: Set<number>;
}

/** Simulated minutes per real second. */
const SPEEDS = [2, 10, 30, 60] as const;
/** Each run starts at 17:00 on day one, just before rickshaws start coming home. */
const START_TICK = 5 * 60;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function clockText(tick: number): { night: string; time: string } {
  const minutes = ((((12 * 60 + tick) % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY);
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

  const app = el('div', 'app');
  root.replaceChildren(app);

  // -------------------------------------------------------------- header
  const top = el('div', 'top');
  const brand = el('div', 'brand');
  brand.append(el('h1', undefined, 'RICKSHAWS'), el('span', undefined, `Battery-rickshaw charging in ${deps.map.name}`));
  const play = el('button', 'btn primary', 'Pause');
  play.dataset.action = 'play';
  const seg = el('div', 'seg');
  const speedButtons = SPEEDS.map((s) => {
    const b = el('button', s === speed ? 'on' : '', `${s} min/s`);
    b.addEventListener('click', () => {
      speed = s;
      speedButtons.forEach((x) => x.classList.toggle('on', x === b));
    });
    return b;
  });
  seg.append(...speedButtons);
  const clock = el('div', 'clock');
  top.append(brand, clock, play, seg);

  // -------------------------------------------------------------- maps
  const maps = el('div', 'maps');
  const makeSide = (mode: SideMode, title: string, subtitle: string, color: string): Side => {
    const panel = el('section', 'panel');
    panel.dataset.mode = mode;
    const header = el('header');
    const dot = el('span', 'dot');
    dot.style.background = color;
    const titles = el('div', 'titles');
    titles.append(el('h2', undefined, title), el('p', undefined, subtitle));
    header.append(dot, titles);
    const stage = el('div', 'stage');
    const view = new MapView(deps.map, motion);
    stage.append(view.canvas);
    const banner = el('div', 'banner');
    const stats = el('div', 'stats');
    const key = el('div', 'keyrow');
    key.innerHTML = `
      <span><i class="sw" style="background:${colors.charging}"></i>charging</span>
      <span><i class="sw" style="border:1.4px solid ${colors.waiting}"></i>waiting</span>
      <span><i class="sw" style="background:${colors.full}"></i>full</span>
      <span><i class="sw" style="background:${colors.rickshaw};border-radius:50%"></i>rickshaw on the road</span>`;
    const footer = el('div');
    footer.append(key, stats);
    panel.append(header, stage, footer, banner);
    maps.append(panel);
    return {
      mode,
      title,
      subtitle,
      color,
      district: deps.makeDistrict(mode, seed),
      view,
      stage,
      stats,
      banner,
      bannerUntil: 0,
      announced: new Set(),
    };
  };
  const sides: Side[] = [
    makeSide('naive', 'Ordinary chargers', 'Every charger draws full power the moment a rickshaw plugs in.', colors.naive),
    makeSide(
      'local',
      'Smart chargers',
      'Each charger senses only its own socket voltage and backs off when it sags. No server, no messages.',
      colors.local,
    ),
  ];

  // -------------------------------------------------------------- bottom
  const bottom = el('div', 'bottom');
  const chartCard = el('div', 'card');
  const chartTitle = el('h3');
  chartTitle.append('Load on each transformer tonight');
  const legend = el('span', 'legend');
  legend.innerHTML = `
    <span><i style="border-color:${colors.naive}"></i>Ordinary T1</span>
    <span><i class="d" style="border-color:${colors.naive}"></i>Ordinary T2</span>
    <span><i style="border-color:${colors.local}"></i>Smart T1</span>
    <span><i class="d" style="border-color:${colors.local}"></i>Smart T2</span>`;
  chartTitle.append(legend);
  const chartBox = el('div', 'chartbox');
  const chart = el('canvas');
  chartBox.append(chart);
  chartCard.append(chartTitle, chartBox);

  const actionsCard = el('div', 'card');
  actionsCard.append(el('h3', undefined, 'Change the night (both sides)'));
  const actions = el('div', 'actions');
  const action = (title: string, sub: string, cmd: string, onClick: (b: HTMLButtonElement) => void): HTMLButtonElement => {
    const b = el('button', 'btn');
    b.dataset.cmd = cmd;
    b.append(el('b', undefined, title), el('span', undefined, sub));
    b.addEventListener('click', () => onClick(b));
    actions.append(b);
    return b;
  };
  const send = (command: Command): void => {
    for (const s of sides) s.district.apply(command);
  };
  action('Heatwave', 'Homes use 30% more', 'setBaseLoadScale', (b) => {
    heatwave = !heatwave;
    b.classList.toggle('on', heatwave);
    send({ kind: 'setBaseLoadScale', scale: heatwave ? 1.3 : 1 });
  });
  action('Power cut', 'Grid off for one hour', 'powerCut', () => send({ kind: 'powerCut', ticks: 60 }));
  action('Stubborn chargers', '20% ignore the rule', 'stubbornChargers', () =>
    send({ kind: 'stubbornChargers', fraction: 0.2 }),
  );
  action('New night', 'Different arrivals', 'reset', () => {
    seed += 1;
    reset();
  });
  const note = el(
    'div',
    'note',
    `Map: ${deps.map.attribution}. The transformer heating and burst point are illustrative model values, not measurements.`,
  );
  actions.append(note);
  actionsCard.append(actions);
  bottom.append(chartCard, actionsCard);

  app.append(top, maps, bottom);

  // -------------------------------------------------------------- behaviour
  function warmUp(): void {
    for (const s of sides) {
      while (s.district.tick < START_TICK) s.district.step();
    }
  }

  function reset(): void {
    heatwave = false;
    actions.querySelector('[data-cmd="setBaseLoadScale"]')?.classList.remove('on');
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

  play.addEventListener('click', () => {
    playing = !playing;
    play.textContent = playing ? 'Pause' : 'Play';
  });

  const layout = (): void => {
    for (const s of sides) {
      const r = s.stage.getBoundingClientRect();
      s.view.resize(Math.floor(r.width), Math.floor(r.height));
    }
  };
  const observer = new ResizeObserver(layout);
  for (const s of sides) observer.observe(s.stage);
  observer.observe(chartBox);

  const statHtml = (k: string, v: string, small = ''): string =>
    `<div class="stat"><div class="k">${k}</div><div class="v">${v}${small ? `<small>${small}</small>` : ''}</div></div>`;

  function updateStats(s: Side, zones: readonly WorldSnapshot[]): void {
    const metrics = s.district.zones.map((z) => z.metrics());
    const dark = zones.reduce(
      (n, z, i) => n + (z.transformer.tripped || z.transformer.burst ? deps.map.transformers[i]!.buildings : 0),
      0,
    );
    const departures = metrics.reduce((n, m) => n + m.departures, 0);
    const ready = metrics.reduce((n, m) => n + m.readyDepartures, 0);
    const charging = metrics.reduce((n, m) => n + m.drawingNow, 0);
    const hottest = Math.max(...zones.map((z) => z.transformer.hotSpotC));
    const bursts = metrics.reduce((n, m) => n + m.bursts, 0);
    s.stats.innerHTML =
      statHtml('Charging now', `${charging}`, 'rickshaws') +
      statHtml('Hottest', `${Math.round(hottest)}°C`, bursts > 0 ? `${bursts} burst` : `bursts at ${deps.burstC}°C`) +
      statHtml('Buildings dark', `${dark.toLocaleString()}`, `of ${deps.map.buildings.length.toLocaleString()}`) +
      statHtml('Left charged', departures > 0 ? `${Math.round((100 * ready) / departures)}%` : '–', departures > 0 ? `of ${departures}` : 'none left yet');
  }

  function announce(s: Side, zones: readonly WorldSnapshot[], now: number): void {
    zones.forEach((z, i) => {
      if (z.transformer.burst && !s.announced.has(i)) {
        s.announced.add(i);
        const m = s.district.zones[i]!.metrics();
        const at = m.burstTick !== null ? clockText(m.burstTick).time : '';
        const t = deps.map.transformers[i]!;
        const rickshaws = z.chargers.filter((c) => c.state !== 'away' && c.state !== 'removed').length;
        s.banner.textContent = `${t.id} burst at ${at}: ${t.buildings.toLocaleString()} buildings and ${rickshaws} rickshaws without power`;
        s.banner.classList.remove('ok');
        s.banner.classList.add('show');
        s.bannerUntil = now + 6000;
      }
    });
    if (s.bannerUntil && now > s.bannerUntil) {
      s.banner.classList.remove('show');
      s.bannerUntil = 0;
    }
  }

  let last = performance.now();
  let raf = 0;
  let statsAt = 0;
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
    const tick = sides[0]!.district.tick;
    const time = tick + (playing ? carry : 0);
    const c = clockText(tick);
    clock.innerHTML = `<small>${c.night}</small>${c.time}`;

    const series: Series[] = [];
    for (const s of sides) {
      const zones = s.district.zones.map((z) => z.snapshot());
      s.view.draw({ zones, time, now, burstC: deps.burstC });
      announce(s, zones, now);
      if (now - statsAt > 200) updateStats(s, zones);
      s.district.zones.forEach((z, i) =>
        series.push({ label: `${s.title} T${i + 1}`, color: s.color, dashed: i === 1, samples: z.history() }),
      );
    }
    if (now - statsAt > 200) statsAt = now;
    const box = chartBox.getBoundingClientRect();
    drawChart(chart, Math.floor(box.width), Math.floor(box.height), time, series);
    raf = requestAnimationFrame(frame);
  };

  warmUp();
  layout();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      style.remove();
    },
  };
}
