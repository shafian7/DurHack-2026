/**
 * Draws one side of the comparison: the Dhanmondi map with its two
 * transformers, ten garages and 200 rickshaws (plan.md §1 and §3.6). The base
 * map is drawn once per size into an offscreen canvas; everything that moves
 * is drawn over it each frame from the zones' snapshots.
 */
import type { WorldSnapshot } from '../contracts';
import { bayOf, type MapData, type Point } from '../map';
import { Motion } from './motion';
import { colors, font, heatColor, loadColor } from './theme';

export interface Frame {
  /** One snapshot per transformer, in map order. */
  readonly zones: readonly WorldSnapshot[];
  /** Simulated minutes since tick 0, with the fraction between ticks. */
  readonly time: number;
  /** Wall-clock milliseconds, for effects only. */
  readonly now: number;
  readonly burstC: number;
}

const GRID_COLS = 5;
const CELL = 6;
const GAP = 2;

export class MapView {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement | null = null;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private readonly buildingPaths: Path2D[];
  private readonly wires: Point[][][];
  private readonly awaySince = new Map<number, number>();
  private readonly wasAway = new Map<number, boolean>();
  private readonly burstSeenAt = new Map<number, number>();

  constructor(
    private readonly map: MapData,
    private readonly motion: Motion,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'map-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.buildingPaths = map.transformers.map(() => new Path2D());
    for (const b of map.buildings) addRing(this.buildingPaths[b.transformer]!, b.points);
    this.wires = map.transformers.map((t, ti) =>
      map.garages.filter((g) => g.transformer === ti).map((g) => shortestPath(map, t.node, g.node)),
    );
  }

  /** Clears per-run memory, for a reset. */
  reset(): void {
    this.awaySince.clear();
    this.wasAway.clear();
    this.burstSeenAt.clear();
  }

  resize(width: number, height: number): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (width === this.cssW && height === this.cssH && dpr === this.dpr && this.base) return;
    this.cssW = width;
    this.cssH = height;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.scale = Math.min(width / this.map.width, height / this.map.height);
    this.ox = (width - this.map.width * this.scale) / 2;
    this.oy = (height - this.map.height * this.scale) / 2;
    this.base = this.drawBase();
  }

  private toScreen(p: Point): Point {
    return [this.ox + p[0] * this.scale, this.oy + p[1] * this.scale];
  }

  private mapTransform(ctx: CanvasRenderingContext2D): void {
    const k = this.dpr * this.scale;
    ctx.setTransform(k, 0, 0, k, this.dpr * this.ox, this.dpr * this.oy);
  }

  private screenTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // ------------------------------------------------------------- base map

  private drawBase(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const ctx = c.getContext('2d')!;
    const map = this.map;
    const px = 1 / this.scale; // one CSS pixel in metres

    this.screenTransform(ctx);
    ctx.fillStyle = colors.land;
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    this.mapTransform(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, map.width, map.height);
    ctx.clip();
    ctx.fillStyle = colors.land;
    ctx.fillRect(0, 0, map.width, map.height);

    // Roads: plain lines, thicker for main roads.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const cls of ['lane', 'minor', 'major'] as const) {
      ctx.strokeStyle = cls === 'major' ? colors.road : colors.roadMinor;
      ctx.lineWidth = (cls === 'major' ? 3.2 : cls === 'minor' ? 2 : 1.4) * px;
      for (const r of map.roads) {
        if (r.cls !== cls) continue;
        ctx.beginPath();
        r.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
        ctx.stroke();
      }
    }

    // Buildings: simple boxes along the roads.
    for (const path of this.buildingPaths) {
      ctx.fillStyle = colors.building;
      ctx.fill(path);
      ctx.strokeStyle = colors.buildingEdge;
      ctx.lineWidth = 0.7 * px;
      ctx.stroke(path);
    }
    ctx.restore();
    return c;
  }

  // ------------------------------------------------------------- per frame

  draw(frame: Frame): void {
    const ctx = this.ctx;
    if (!this.base) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.base, 0, 0);

    const hour = (((12 + frame.time / 60) % 24) + 24) % 24;
    const night = nightness(hour);

    // Lights and darkness per transformer area.
    this.mapTransform(ctx);
    frame.zones.forEach((z, ti) => {
      const out = z.transformer.tripped || z.transformer.burst;
      const path = this.buildingPaths[ti]!;
      if (out) {
        ctx.fillStyle = colors.dark;
        ctx.fill(path);
      }
    });
    // Night falls over the whole map; lit homes glow through it.
    this.screenTransform(ctx);
    if (night > 0) {
      ctx.fillStyle = colors.night;
      ctx.globalAlpha = night;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.globalAlpha = 1;
    }
    this.mapTransform(ctx);
    if (night > 0.05) {
      frame.zones.forEach((z, ti) => {
        if (z.transformer.tripped || z.transformer.burst) return;
        ctx.globalAlpha = night * 0.85;
        ctx.fillStyle = colors.lit;
        ctx.fill(this.buildingPaths[ti]!);
        ctx.globalAlpha = 1;
      });
    }

    this.drawWires(frame);
    this.screenTransform(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.ox, this.oy, this.map.width * this.scale, this.map.height * this.scale);
    ctx.clip();
    this.drawRickshawsOnRoads(frame);
    ctx.restore();
    this.drawGarages(frame);
    this.drawTransformers(frame);
  }

  private drawWires(frame: Frame): void {
    const ctx = this.ctx;
    const px = 1 / this.scale;
    frame.zones.forEach((z, ti) => {
      const out = z.transformer.tripped || z.transformer.burst;
      const share = z.transformer.loadKw / z.transformer.ratingKw;
      const garages = this.map.garages.filter((g) => g.transformer === ti);
      this.wires[ti]!.forEach((path, gi) => {
        if (path.length < 2) return;
        const feeder = garages[gi]!.feeder;
        ctx.beginPath();
        path.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (out) {
          ctx.setLineDash([4 * px, 4 * px]);
          ctx.strokeStyle = 'rgba(90,96,108,0.55)';
          ctx.lineWidth = 2 * px;
        } else {
          ctx.setLineDash([]);
          // Colour follows the sag at that garage.
          ctx.strokeStyle = loadColor(share * (0.85 + 0.3 * feeder));
          ctx.globalAlpha = 0.75;
          ctx.lineWidth = 2.6 * px;
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      });
    });
  }

  private drawRickshawsOnRoads(frame: Frame): void {
    const ctx = this.ctx;
    const tick = Math.floor(frame.time);
    frame.zones.forEach((z, ti) => {
      for (const c of z.chargers) {
        const key = ti * 1000 + c.id;
        const away = c.state === 'away';
        if (away && !this.wasAway.get(key)) this.awaySince.set(key, this.wasAway.has(key) ? tick : -((key * 37) % 240));
        this.wasAway.set(key, away);
        if (!away) continue;
        const { garage } = bayOf(this.map, ti, c.id);
        const start = this.map.garages[garage]?.node ?? 0;
        const minutes = frame.time - (this.awaySince.get(key) ?? 0);
        const { at, heading } = this.motion.position(key, start, minutes);
        const [x, y] = this.toScreen(at);
        drawRickshaw(ctx, x, y, heading, (key & 1) === 0 ? colors.rickshaw : colors.rickshawAlt);
      }
    });
  }

  private garageBox(at: Point): { x: number; y: number; w: number; h: number } {
    const rows = 4;
    const w = GRID_COLS * CELL + (GRID_COLS - 1) * GAP + 8;
    const h = rows * CELL + (rows - 1) * GAP + 8;
    const [sx, sy] = this.toScreen(at);
    return { x: sx - w / 2, y: sy - h / 2, w, h };
  }

  private drawGarages(frame: Frame): void {
    const ctx = this.ctx;
    const tick = Math.floor(frame.time);
    this.map.garages.forEach((g, gi) => {
      const z = frame.zones[g.transformer];
      if (!z) return;
      const out = z.transformer.tripped || z.transformer.burst;
      const box = this.garageBox(g.at);
      ctx.save();
      ctx.shadowColor = 'rgba(20,30,45,0.18)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 1.5;
      roundRect(ctx, box.x, box.y, box.w, box.h, 5);
      ctx.fillStyle = out ? '#5b616b' : '#ffffff';
      ctx.fill();
      ctx.restore();
      roundRect(ctx, box.x, box.y, box.w, box.h, 5);
      ctx.strokeStyle = out ? '#3f444c' : '#d5d0c6';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `600 9.5px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(box.x + box.w / 2 - 9, box.y - 11, 18, 10);
      ctx.fillStyle = colors.ink;
      ctx.fillText(g.id, box.x + box.w / 2, box.y - 1);

      for (const c of z.chargers) {
        const { garage, bay } = bayOf(this.map, g.transformer, c.id);
        if (garage !== gi) continue;
        const col = bay % GRID_COLS;
        const row = Math.floor(bay / GRID_COLS);
        const x = box.x + 4 + col * (CELL + GAP);
        const y = box.y + 4 + row * (CELL + GAP);
        if (c.state === 'away' || c.state === 'removed') {
          ctx.fillStyle = out ? '#6b717b' : '#efece6';
          ctx.fillRect(x, y, CELL, CELL);
          continue;
        }
        const arriving = c.arrivedTick !== null && tick - c.arrivedTick < 3;
        if (out) {
          ctx.fillStyle = '#8a9099';
          ctx.fillRect(x, y, CELL, CELL);
        } else if (c.state === 'charging') {
          ctx.fillStyle = colors.charging;
          ctx.fillRect(x, y, CELL, CELL);
          // Battery level as a light bar from the bottom.
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          const h = Math.round(CELL * (1 - c.soc));
          ctx.fillRect(x, y, CELL, h);
        } else if (c.state === 'full') {
          ctx.fillStyle = colors.full;
          ctx.fillRect(x, y, CELL, CELL);
        } else {
          ctx.strokeStyle = colors.waiting;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(x + 0.6, y + 0.6, CELL - 1.2, CELL - 1.2);
        }
        if (c.stubborn) {
          ctx.strokeStyle = colors.hot;
          ctx.lineWidth = 1;
          ctx.strokeRect(x - 0.5, y - 0.5, CELL + 1, CELL + 1);
        }
        if (arriving) {
          ctx.fillStyle = 'rgba(31,122,98,0.35)';
          ctx.fillRect(x - 1, y - 1, CELL + 2, CELL + 2);
        }
      }
    });
  }

  private drawTransformers(frame: Frame): void {
    const ctx = this.ctx;
    this.map.transformers.forEach((t, ti) => {
      const z = frame.zones[ti];
      if (!z) return;
      const tv = z.transformer;
      const [x, y] = this.toScreen(t.at);
      const share = tv.loadKw / tv.ratingKw;
      const r = 15;

      if (tv.burst) {
        if (!this.burstSeenAt.has(ti)) this.burstSeenAt.set(ti, frame.now);
        drawBurst(ctx, x, y, frame.now - this.burstSeenAt.get(ti)!, frame.now);
      } else {
        // Heat shimmer when close to bursting.
        const nearBurst = tv.hotSpotC >= frame.burstC - 15;
        if (nearBurst) {
          const pulse = 0.5 + 0.5 * Math.sin(frame.now / 160);
          ctx.beginPath();
          ctx.arc(x, y, r + 7 + 3 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(226,85,63,${0.12 + 0.12 * pulse})`;
          ctx.fill();
        }
        ctx.save();
        ctx.shadowColor = 'rgba(20,30,45,0.25)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
        // Load ring.
        ctx.beginPath();
        ctx.arc(x, y, r - 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#ece8e0';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, share / 1.3));
        ctx.strokeStyle = tv.tripped ? '#8a9099' : loadColor(share);
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.lineCap = 'butt';
        // Bolt.
        ctx.fillStyle = colors.ink;
        bolt(ctx, x, y, 7);
      }

      // Label card: id, load, temperature.
      const label = tv.burst ? `${t.id} · BURST` : tv.tripped ? `${t.id} · no power` : `${t.id} · ${Math.round(share * 100)}%`;
      const temp = `${Math.round(tv.hotSpotC)}°C`;
      ctx.font = `600 11px ${font}`;
      const w1 = ctx.measureText(label).width;
      ctx.font = `500 11px ${font}`;
      const w2 = ctx.measureText(temp).width;
      const w = w1 + w2 + 26;
      const lx = x - w / 2;
      const ly = y + r + 6;
      ctx.save();
      ctx.shadowColor = 'rgba(20,30,45,0.18)';
      ctx.shadowBlur = 6;
      roundRect(ctx, lx, ly, w, 20, 10);
      ctx.fillStyle = tv.burst ? colors.burst : '#ffffff';
      ctx.fill();
      ctx.restore();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `600 11px ${font}`;
      ctx.fillStyle = tv.burst ? '#ffffff' : colors.ink;
      ctx.fillText(label, lx + 9, ly + 10.5);
      ctx.font = `500 11px ${font}`;
      ctx.fillStyle = tv.burst ? '#ffd9d3' : heatColor(tv.hotSpotC, frame.burstC);
      ctx.fillText(temp, lx + 17 + w1, ly + 10.5);
    });
  }
}

// ------------------------------------------------------------------ helpers

function addRing(path: Path2D, ring: readonly Point[]): void {
  ring.forEach((p, i) => (i === 0 ? path.moveTo(p[0], p[1]) : path.lineTo(p[0], p[1])));
  path.closePath();
}

/** 0 by day, 1 at night, with dusk and dawn ramps. */
export function nightness(hour: number): number {
  if (hour >= 19.5 || hour < 5) return 1;
  if (hour >= 17.5) return (hour - 17.5) / 2;
  if (hour < 6.5) return 1 - (hour - 5) / 1.5;
  return 0;
}

function shortestPath(map: MapData, from: number, to: number): Point[] {
  const n = map.graph.nodes.length;
  const adj: { to: number; w: number }[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of map.graph.edges) {
    const pa = map.graph.nodes[a]!;
    const pb = map.graph.nodes[b]!;
    const w = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
    adj[a]!.push({ to: b, w });
    adj[b]!.push({ to: a, w });
  }
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[from] = 0;
  for (;;) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!done[i] && dist[i]! < best) {
        best = dist[i]!;
        u = i;
      }
    }
    if (u < 0 || u === to) break;
    done[u] = 1;
    for (const { to: v, w } of adj[u]!) {
      if (dist[u]! + w < dist[v]!) {
        dist[v] = dist[u]! + w;
        prev[v] = u;
      }
    }
  }
  const path: Point[] = [];
  for (let v = to; v >= 0; v = prev[v]!) path.push(map.graph.nodes[v]!);
  return path.reverse();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawRickshaw(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, fill: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  roundRect(ctx, -4.5, -2.6, 9, 5.2, 1.8);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
  // Canopy.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillRect(-3.2, -1.6, 3, 3.2);
  ctx.restore();
}

function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x + 0.15 * s, y - s);
  ctx.lineTo(x - 0.55 * s, y + 0.15 * s);
  ctx.lineTo(x - 0.05 * s, y + 0.15 * s);
  ctx.lineTo(x - 0.2 * s, y + s);
  ctx.lineTo(x + 0.55 * s, y - 0.2 * s);
  ctx.lineTo(x + 0.05 * s, y - 0.2 * s);
  ctx.closePath();
  ctx.fill();
}

/** A flash on the moment of failure, then a scorched casing and rising smoke. */
function drawBurst(ctx: CanvasRenderingContext2D, x: number, y: number, since: number, now: number): void {
  if (since < 900) {
    const t = since / 900;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 30 + 90 * t);
    g.addColorStop(0, `rgba(255,236,170,${0.95 * (1 - t)})`);
    g.addColorStop(0.4, `rgba(255,140,60,${0.7 * (1 - t)})`);
    g.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 30 + 90 * t, 0, Math.PI * 2);
    ctx.fill();
  }
  // Smoke puffs drifting up and right.
  for (let i = 0; i < 9; i++) {
    const life = ((now / 2600 + i / 9) % 1 + 1) % 1;
    const px = x + 6 * Math.sin(i * 2.1) + life * 14;
    const py = y - 6 - life * 46;
    const r = 5 + life * 13;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(70,72,78,${0.32 * (1 - life)})`;
    ctx.fill();
  }
  // Ember glow.
  const flicker = 0.6 + 0.4 * Math.sin(now / 90) * Math.sin(now / 37);
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,110,50,${0.18 + 0.12 * flicker})`;
  ctx.fill();
  // Scorched casing.
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#2b2d31';
  ctx.fill();
  ctx.strokeStyle = colors.burst;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = '#ffb59f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 5);
  ctx.lineTo(x + 5, y + 5);
  ctx.moveTo(x + 5, y - 5);
  ctx.lineTo(x - 5, y + 5);
  ctx.stroke();
}
