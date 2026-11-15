/**
 * MOCKUP: absolute minimalism. The power grid is the picture; nothing is
 * written on screen until the pointer is over something.
 *
 * Left half: ordinary chargers. Right half: voltage-sensing chargers. Same
 * district, same night, real simulation.
 *
 * Hover   a transformer, a garage, a bay, a wire or the corner dot of a half.
 * Click   the same things to pin the note; click empty space to pause or play.
 * Keys    1 wires and streets · 2 adds house lights · 3 wires only · 4 paper
 *         space pause · left/right slower/faster · R restart
 */
import type { ChargerView, FleetMode } from '../contracts';
import { bayOf, dhanmondi, dhanmondiDistrict } from '../map';
import type { Point } from '../map';
import { localPolicy } from '../policies/local';
import { naivePolicy } from '../policies/naive';
import { createDistrict, DISTRICT_THERMAL, type District } from '../sim/district';

const map = dhanmondi;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const tip = document.getElementById('tip') as HTMLDivElement;
const ctx = canvas.getContext('2d')!;

// ------------------------------------------------------------------ the two sides

interface Side {
  readonly label: string;
  readonly note: string;
  readonly mode: FleetMode;
  district: District;
}

const make = (mode: FleetMode): District =>
  createDistrict(dhanmondiDistrict(1), mode, () => ({ policy: mode === 'naive' ? naivePolicy : localPolicy }));

const sides: Side[] = [
  { label: 'Ordinary chargers', note: 'draw full power the moment a rickshaw plugs in', mode: 'naive', district: make('naive') },
  { label: 'Voltage-sensing chargers', note: 'each backs off when its own socket voltage sags', mode: 'local', district: make('local') },
];

/** Start in the early evening, so the first thing seen is rickshaws coming home. */
const START_TICK = 8 * 60;
const SPEEDS = [0, 2, 5, 10, 20, 40, 80];
let speed = 4;
let paused = false;
let variant = 1;

function restart(): void {
  for (const side of sides) {
    side.district = make(side.mode);
    for (let i = 0; i < START_TICK; i += 1) side.district.step();
  }
}
restart();

// ------------------------------------------------------------------ the wires

/** Shortest road path from each garage back to its transformer, as map points. */
function wirePaths(): Point[][] {
  const n = map.graph.nodes.length;
  const near: { to: number; d: number }[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of map.graph.edges) {
    const pa = map.graph.nodes[a]!;
    const pb = map.graph.nodes[b]!;
    const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
    near[a]!.push({ to: b, d });
    near[b]!.push({ to: a, d });
  }
  const from = map.transformers.map((t) => {
    const dist = new Array<number>(n).fill(Infinity);
    const prev = new Array<number>(n).fill(-1);
    const done = new Array<boolean>(n).fill(false);
    dist[t.node] = 0;
    for (let k = 0; k < n; k += 1) {
      let u = -1;
      for (let i = 0; i < n; i += 1) if (!done[i] && (u < 0 || dist[i]! < dist[u]!)) u = i;
      if (u < 0 || dist[u] === Infinity) break;
      done[u] = true;
      for (const e of near[u]!) {
        if (dist[u]! + e.d < dist[e.to]!) {
          dist[e.to] = dist[u]! + e.d;
          prev[e.to] = u;
        }
      }
    }
    return prev;
  });
  return map.garages.map((g) => {
    const prev = from[g.transformer]!;
    const path: Point[] = [g.at];
    for (let at = g.node; at >= 0; at = prev[at]!) path.push(map.graph.nodes[at]!);
    path.push(map.transformers[g.transformer]!.at);
    return path;
  });
}
const wires = wirePaths();

/** Where each bay of a garage sits: a tight block of points beside the gate. */
const BAY_GAP = 9;
function bayPoint(garage: number, bay: number): Point {
  const g = map.garages[garage]!;
  const cols = 5;
  const rows = Math.ceil(g.bays / cols);
  const cx = (bay % cols) - (cols - 1) / 2;
  const cy = Math.floor(bay / cols) - (rows - 1) / 2;
  return [g.at[0] + cx * BAY_GAP, g.at[1] + cy * BAY_GAP];
}

const houses: { at: Point; zone: number }[] = map.buildings.map((b) => {
  let x = 0;
  let y = 0;
  for (const p of b.points) {
    x += p[0];
    y += p[1];
  }
  return { at: [x / b.points.length, y / b.points.length], zone: b.transformer };
});

// ------------------------------------------------------------------ colour

interface Ink {
  readonly bg: string;
  readonly street: string;
  readonly cold: readonly [number, number, number];
  readonly warm: readonly [number, number, number];
  readonly hot: readonly [number, number, number];
  readonly dead: string;
  readonly text: string;
  readonly house: string;
}
const NIGHT: Ink = {
  bg: '#050505',
  street: '#2c2c2c',
  cold: [80, 80, 80],
  warm: [255, 190, 90],
  hot: [255, 60, 50],
  dead: '#3a3a3a',
  text: '#e8e8e8',
  house: '#8a7a55',
};
const PAPER: Ink = {
  bg: '#f4f1ea',
  street: '#dcd7cc',
  cold: [150, 150, 150],
  warm: [30, 30, 30],
  hot: [215, 40, 30],
  dead: '#cfc9bc',
  text: '#111111',
  house: '#8f897b',
};
const ink = (): Ink => (variant === 4 ? PAPER : NIGHT);

const mix = (a: readonly number[], b: readonly number[], t: number): string => {
  const k = Math.min(1, Math.max(0, t));
  return `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * k)).join(',')})`;
};

/** Idle is faint, working is warm, over the limit turns red. */
function loadColour(share: number): string {
  const c = ink();
  if (share <= 1) return mix(c.cold, c.warm, share);
  return mix(c.warm, c.hot, (share - 1) / 0.25);
}

// ------------------------------------------------------------------ layout

interface View {
  readonly ox: number;
  readonly oy: number;
  readonly scale: number;
  readonly left: number;
  readonly width: number;
}
let views: View[] = [];
let dpr = 1;

function layout(): void {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  const half = window.innerWidth / sides.length;
  const pad = 28;
  views = sides.map((_, i) => {
    const scale = Math.min((half - 2 * pad) / map.width, (window.innerHeight - 2 * pad) / map.height);
    return {
      scale,
      left: i * half,
      width: half,
      ox: i * half + (half - map.width * scale) / 2,
      oy: (window.innerHeight - map.height * scale) / 2,
    };
  });
}
window.addEventListener('resize', layout);
layout();

const sx = (v: View, p: Point): number => v.ox + p[0] * v.scale;
const sy = (v: View, p: Point): number => v.oy + p[1] * v.scale;

// ------------------------------------------------------------------ drawing

function line(v: View, points: readonly Point[]): void {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(v, p), sy(v, p)) : ctx.lineTo(sx(v, p), sy(v, p))));
  ctx.stroke();
}

function drawSide(side: Side, v: View): void {
  const c = ink();
  const zones = side.district.zones.map((z) => z.snapshot());

  ctx.save();
  ctx.beginPath();
  ctx.rect(v.ox, v.oy, map.width * v.scale, map.height * v.scale);
  ctx.clip();

  // Streets: hairlines, barely there. Variant 3 leaves them out.
  if (variant !== 3) {
    ctx.strokeStyle = c.street;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const road of map.roads) {
      ctx.lineWidth = road.cls === 'major' ? 1.4 : road.cls === 'minor' ? 0.9 : 0.5;
      line(v, road.points);
    }
  }

  // House lights: one point per building, out when its transformer is out.
  if (variant === 2) {
    for (const h of houses) {
      const t = zones[h.zone]!.transformer;
      const dark = t.tripped || t.burst;
      ctx.fillStyle = dark ? c.dead : c.house;
      const s = dark ? 1.2 : 2.2;
      ctx.fillRect(sx(v, h.at) - s / 2, sy(v, h.at) - s / 2, s, s);
    }
  }

  // The grid: one wire from each garage back to its transformer.
  map.garages.forEach((g, gi) => {
    const t = zones[g.transformer]!.transformer;
    const dark = t.tripped || t.burst;
    const share = t.ratingKw > 0 ? t.loadKw / t.ratingKw : 0;
    ctx.strokeStyle = dark ? c.dead : loadColour(share);
    ctx.lineWidth = dark ? 1 : 1.2 + Math.min(1.4, share) * 1.6;
    ctx.setLineDash(dark ? [2, 5] : []);
    line(v, wires[gi]!);
  });
  ctx.setLineDash([]);

  // Bays: nothing when away, a ring when waiting, a point of light when charging.
  map.garages.forEach((g, gi) => {
    const snap = zones[g.transformer]!;
    const dark = snap.transformer.tripped || snap.transformer.burst;
    for (const ch of snap.chargers) {
      const where = bayOf(map, g.transformer, ch.id);
      if (where.garage !== gi) continue;
      const p = bayPoint(gi, where.bay);
      const x = sx(v, p);
      const y = sy(v, p);
      const r = Math.max(1.6, 2.6 * v.scale);
      if (ch.state === 'away' || ch.state === 'removed') continue;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (ch.state === 'charging' && !dark) {
        ctx.fillStyle = loadColour(0.95);
        ctx.fill();
      } else if (ch.state === 'full') {
        ctx.fillStyle = mix(c.cold, c.warm, 0.35);
        ctx.fill();
      } else {
        ctx.strokeStyle = dark ? c.dead : mix(c.cold, c.warm, 0.25);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  });

  // Transformers: a ring that closes as load approaches the limit.
  map.transformers.forEach((site, ti) => {
    const t = zones[ti]!.transformer;
    const x = sx(v, site.at);
    const y = sy(v, site.at);
    const r = Math.max(7, 13 * v.scale);
    const share = t.ratingKw > 0 ? t.loadKw / t.ratingKw : 0;
    ctx.fillStyle = c.bg;
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.fill();
    if (t.burst) {
      ctx.strokeStyle = loadColour(1.3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y - r * 0.7);
      ctx.lineTo(x + r * 0.7, y + r * 0.7);
      ctx.moveTo(x + r * 0.7, y - r * 0.7);
      ctx.lineTo(x - r * 0.7, y + r * 0.7);
      ctx.stroke();
      return;
    }
    ctx.strokeStyle = c.dead;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    if (t.tripped) return;
    ctx.strokeStyle = loadColour(share);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, share));
    ctx.stroke();
    if (share > 1) {
      ctx.fillStyle = loadColour(share);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.restore();

  // The only fixed mark: a dot in the corner of each half. Hover it for the name and the time.
  ctx.fillStyle = c.cold.length ? mix(c.cold, c.warm, 0.2) : c.text;
  ctx.beginPath();
  ctx.arc(v.left + 22, 22, 3, 0, Math.PI * 2);
  ctx.fill();
}

// ------------------------------------------------------------------ hover and press

const clock = (tick: number): string => {
  const minutes = (12 * 60 + tick) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};
const pct = (x: number): string => `${Math.round(x * 100)}%`;

interface Hit {
  readonly text: string;
  readonly key: string;
}

function hitAt(px: number, py: number): Hit | null {
  for (let s = 0; s < sides.length; s += 1) {
    const side = sides[s]!;
    const v = views[s]!;
    if (px < v.left || px >= v.left + v.width) continue;
    const zones = side.district.zones.map((z) => z.snapshot());
    const near = (p: Point, r: number): boolean => Math.hypot(px - sx(v, p), py - sy(v, p)) <= r;

    if (Math.hypot(px - (v.left + 22), py - 22) <= 14) {
      const night = Math.floor(side.district.tick / 1440) + 1;
      return { key: `side${s}`, text: `${side.label}\n${side.note}\nnight ${night} · ${clock(side.district.tick)}` };
    }

    for (let ti = 0; ti < map.transformers.length; ti += 1) {
      const site = map.transformers[ti]!;
      if (!near(site.at, Math.max(12, 16 * v.scale))) continue;
      const t = zones[ti]!.transformer;
      const state = t.burst ? 'BURST · out for the night' : t.tripped ? 'no power' : `${Math.round(t.loadKw)} of ${Math.round(t.ratingKw)} kW · ${pct(t.loadKw / t.ratingKw)}`;
      return {
        key: `t${s}-${ti}`,
        text: `${site.label}\n${state}\n${Math.round(t.hotSpotC)} °C · bursts at ${DISTRICT_THERMAL.burstHotSpotC} °C`,
      };
    }

    for (let gi = 0; gi < map.garages.length; gi += 1) {
      const g = map.garages[gi]!;
      const snap = zones[g.transformer]!;
      const mine: ChargerView[] = snap.chargers.filter((ch) => bayOf(map, g.transformer, ch.id).garage === gi);
      for (const ch of mine) {
        const bay = bayOf(map, g.transformer, ch.id).bay;
        if (!near(bayPoint(gi, bay), Math.max(3.5, 4.2 * v.scale))) continue;
        if (ch.state === 'away' || ch.state === 'removed') break;
        return {
          key: `b${s}-${gi}-${bay}`,
          text: `${g.id} · bay ${bay + 1}\n${ch.state} · battery ${pct(ch.soc)}\nsocket ${Math.round(ch.voltage)} V`,
        };
      }
      if (near(g.at, Math.max(16, 30 * v.scale))) {
        const count = (state: string): number => mine.filter((ch) => ch.state === state).length;
        const home = mine.filter((ch) => ch.state !== 'away' && ch.state !== 'removed');
        const volts = home.length ? Math.round(home.reduce((sum, ch) => sum + ch.voltage, 0) / home.length) : null;
        return {
          key: `g${s}-${gi}`,
          text: `${g.id} · ${g.wireMetres} m of wire from ${map.transformers[g.transformer]!.id}\n${count('charging')} charging · ${count('waiting')} waiting · ${count('full')} full · ${count('away')} away${volts === null ? '' : `\nsocket ${volts} V`}`,
        };
      }
    }

    for (let gi = 0; gi < map.garages.length; gi += 1) {
      const path = wires[gi]!;
      for (let i = 1; i < path.length; i += 1) {
        const ax = sx(v, path[i - 1]!);
        const ay = sy(v, path[i - 1]!);
        const bx = sx(v, path[i]!);
        const by = sy(v, path[i]!);
        const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
        const t = Math.min(1, Math.max(0, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2));
        if (Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))) > 5) continue;
        const g = map.garages[gi]!;
        const tr = zones[g.transformer]!.transformer;
        const state = tr.burst || tr.tripped ? 'dead' : `${Math.round(tr.busVolts)} V at the transformer`;
        return { key: `w${s}-${gi}`, text: `wire ${map.transformers[g.transformer]!.id} to ${g.id}\n${state}` };
      }
    }
  }
  return null;
}

let pointer: { x: number; y: number } | null = null;
let pinned: { x: number; y: number } | null = null;

function showTip(): void {
  const at = pinned ?? pointer;
  const hit = at ? hitAt(at.x, at.y) : null;
  if (!at || !hit) {
    tip.style.display = 'none';
    return;
  }
  const c = ink();
  tip.textContent = hit.text;
  tip.style.display = 'block';
  tip.style.color = c.text;
  tip.style.background = c.bg;
  tip.style.borderLeft = `1px solid ${c.text}`;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  tip.style.left = `${Math.min(window.innerWidth - w - 8, at.x + 16)}px`;
  tip.style.top = `${Math.min(window.innerHeight - h - 8, at.y + 16)}px`;
}

canvas.addEventListener('pointermove', (e) => {
  pointer = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerleave', () => {
  pointer = null;
});
canvas.addEventListener('pointerdown', (e) => {
  const here = { x: e.clientX, y: e.clientY };
  if (hitAt(here.x, here.y)) {
    pinned = pinned && hitAt(pinned.x, pinned.y)?.key === hitAt(here.x, here.y)?.key ? null : here;
  } else if (pinned) {
    pinned = null;
  } else {
    paused = !paused;
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '4') variant = Number(e.key);
  else if (e.key === ' ') paused = !paused;
  else if (e.key === 'ArrowRight') speed = Math.min(SPEEDS.length - 1, speed + 1);
  else if (e.key === 'ArrowLeft') speed = Math.max(1, speed - 1);
  else if (e.key === 'r' || e.key === 'R') restart();
  else return;
  e.preventDefault();
});

const asked = Number(new URLSearchParams(location.search).get('v'));
if (asked >= 1 && asked <= 4) variant = asked;
const skip = Number(new URLSearchParams(location.search).get('skip'));
if (skip > 0) for (const side of sides) for (let i = 0; i < Math.min(skip, 6000); i += 1) side.district.step();

// ------------------------------------------------------------------ loop

let last = performance.now();
let owed = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused) {
    owed += dt * SPEEDS[speed]!;
    while (owed >= 1) {
      for (const side of sides) side.district.step();
      owed -= 1;
    }
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = ink().bg;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  document.body.style.background = ink().bg;
  sides.forEach((side, i) => drawSide(side, views[i]!));
  showTip();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
