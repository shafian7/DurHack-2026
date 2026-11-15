/**
 * Draws one side of the comparison: the Dhanmondi map with its two
 * transformers, ten garages and 200 rickshaws (plan.md §1 and §3.6). The base
 * map is drawn once per size into an offscreen canvas; everything that moves
 * is drawn over it each frame from the zones' snapshots.
 */
import type { WorldSnapshot } from '../contracts';
import { bayOf, chargerOf, type MapData, type Point } from '../map';
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
  /**
   * The data link to the central server, on the map that has one: 'up' while
   * connected, 'cut' once it is lost, 'none' on a map with no server at all.
   */
  readonly link: 'up' | 'cut' | 'none';
}

/** How long the cut animation plays before the lines settle as broken, in ms. */
const CUT_FLASH_MS = 1600;

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
  private linkCutAt: number | null = null;
  /** The charger whose socket view is open, highlighted on the map. */
  selected: { zone: number; id: number } | null = null;
  /** The frame's clock, for effects drawn outside draw()'s arguments. */
  private lastNow = 0;
  /** The control centre's position: the road node nearest the middle of the garages. */
  private readonly hub: Point;

  constructor(
    private readonly map: MapData,
    private readonly motion: Motion,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'map-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.buildingPaths = map.transformers.map(() => new Path2D());
    for (const b of map.buildings) addRing(this.buildingPaths[b.transformer]!, b.points);
    const gx = map.garages.reduce((a, g) => a + g.at[0], 0) / map.garages.length;
    const gy = map.garages.reduce((a, g) => a + g.at[1], 0) / map.garages.length;
    this.hub = map.graph.nodes.reduce((best, p) =>
      Math.hypot(p[0] - gx, p[1] - gy) < Math.hypot(best[0] - gx, best[1] - gy) ? p : best,
    );
    this.wires = map.transformers.map((t, ti) =>
      map.garages.filter((g) => g.transformer === ti).map((g) => shortestPath(map, t.node, g.node)),
    );
  }

  /** Clears per-run memory, for a reset. */
  reset(): void {
    this.awaySince.clear();
    this.wasAway.clear();
    this.burstSeenAt.clear();
    this.linkCutAt = null;
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
    this.lastNow = frame.now;
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
        // A faint outline keeps dark blocks readable against the navy ground.
        ctx.strokeStyle = colors.darkEdge;
        ctx.lineWidth = 0.8 / this.scale;
        ctx.stroke(path);
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
    this.drawLink(frame);
    this.drawTransformers(frame);
  }

  /**
   * The central server's data link: a control centre with a signal line to
   * every garage. Pulses flow while it is up; when it is cut the lines flash
   * red, snap, and stay grey and broken.
   */
  private drawLink(frame: Frame): void {
    if (frame.link === 'none') return;
    const ctx = this.ctx;
    if (frame.link === 'cut' && this.linkCutAt === null) this.linkCutAt = frame.now;
    if (frame.link === 'up') this.linkCutAt = null;
    const since = this.linkCutAt === null ? Infinity : frame.now - this.linkCutAt;
    const [hx, hy] = this.toScreen(this.hub);

    for (const g of this.map.garages) {
      const box = this.garageBox(g.at);
      const tx = box.x + box.w / 2;
      const ty = box.y + box.h / 2;
      const len = Math.hypot(tx - hx, ty - hy);
      if (len < 1) continue;
      const ux = (tx - hx) / len;
      const uy = (ty - hy) / len;
      ctx.save();
      ctx.lineCap = 'round';
      if (frame.link === 'up') {
        ctx.strokeStyle = 'rgba(167,139,250,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        // Data pulses travelling out to the garage.
        ctx.setLineDash([]);
        ctx.fillStyle = colors.signal;
        for (let k = 0; k < 3; k++) {
          const f = ((frame.now / 1400 + k / 3 + g.at[0] * 0.001) % 1 + 1) % 1;
          ctx.globalAlpha = 0.9 * Math.sin(Math.PI * f);
          ctx.beginPath();
          ctx.arc(hx + ux * len * f, hy + uy * len * f, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        // Broken: two stubs with a gap in the middle that opens as it snaps.
        const flash = since < CUT_FLASH_MS ? 1 - since / CUT_FLASH_MS : 0;
        const gap = 8 + 10 * Math.min(1, since / 400);
        const mid = len / 2;
        ctx.strokeStyle = flash > 0 ? `rgba(229,72,77,${0.4 + 0.6 * flash})` : 'rgba(158,163,214,0.4)';
        ctx.lineWidth = 1.5 + 1.5 * flash;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + ux * (mid - gap / 2), hy + uy * (mid - gap / 2));
        ctx.moveTo(hx + ux * (mid + gap / 2), hy + uy * (mid + gap / 2));
        ctx.lineTo(tx, ty);
        ctx.stroke();
        // A small break mark where the line snapped.
        const bx = hx + ux * mid;
        const by = hy + uy * mid;
        ctx.setLineDash([]);
        ctx.strokeStyle = flash > 0 ? colors.hot : 'rgba(180,35,24,0.6)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx - 3.5, by - 3.5);
        ctx.lineTo(bx + 3.5, by + 3.5);
        ctx.moveTo(bx + 3.5, by - 3.5);
        ctx.lineTo(bx - 3.5, by + 3.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // The control centre: a rounded tile with a broadcast mark.
    const up = frame.link === 'up';
    if (up) {
      const pulse = (frame.now / 1600) % 1;
      ctx.beginPath();
      ctx.arc(hx, hy, 14 + 16 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(167,139,250,${0.5 * (1 - pulse)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    roundRect(ctx, hx - 15, hy - 15, 30, 30, 8);
    ctx.fillStyle = up ? colors.central : '#3A3F7E';
    ctx.fill();
    ctx.restore();
    // Antenna and waves.
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx, hy + 8);
    ctx.lineTo(hx, hy - 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, hy - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    for (const r of [5.5, 9]) {
      ctx.globalAlpha = up ? 1 : 0.35;
      ctx.beginPath();
      ctx.arc(hx, hy - 2, r, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (!up) {
      ctx.strokeStyle = colors.hot;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(hx - 9, hy + 9);
      ctx.lineTo(hx + 9, hy - 9);
      ctx.stroke();
    }
    // Label.
    const label = up ? 'Utility server' : 'No signal';
    ctx.font = `400 12px ${font}`;
    const w = ctx.measureText(label).width + 14;
    roundRect(ctx, hx - w / 2, hy - 36, w, 17, 3);
    ctx.fillStyle = up ? 'rgba(17,22,46,0.94)' : colors.burst;
    ctx.fill();
    ctx.fillStyle = up ? colors.central : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, hx, hy - 27.3);
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
          ctx.strokeStyle = 'rgba(158,163,214,0.4)';
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
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 1.5;
      roundRect(ctx, box.x, box.y, box.w, box.h, 5);
      ctx.fillStyle = out ? '#0A0D24' : colors.panelHi;
      ctx.fill();
      ctx.restore();
      roundRect(ctx, box.x, box.y, box.w, box.h, 5);
      ctx.strokeStyle = out ? colors.building : colors.road;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `400 11px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(11,18,48,0.88)';
      const idW = ctx.measureText(g.id).width + 6;
      ctx.fillRect(box.x + box.w / 2 - idW / 2, box.y - 11, idW, 10);
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
          ctx.fillStyle = out ? colors.land : colors.building;
          ctx.fillRect(x, y, CELL, CELL);
          continue;
        }
        const arriving = c.arrivedTick !== null && tick - c.arrivedTick < 3;
        if (out) {
          ctx.fillStyle = '#3A3F7E';
          ctx.fillRect(x, y, CELL, CELL);
        } else if (c.state === 'charging') {
          ctx.fillStyle = colors.charging;
          ctx.fillRect(x, y, CELL, CELL);
          // Battery level: the empty part is shaded dark from the top.
          ctx.fillStyle = 'rgba(11,18,48,0.6)';
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
          ctx.fillStyle = 'rgba(108,203,143,0.35)';
          ctx.fillRect(x - 1, y - 1, CELL + 2, CELL + 2);
        }
      }
    });
    // The bay whose socket view is open.
    if (this.selected) {
      const { garage, bay } = bayOf(this.map, this.selected.zone, this.selected.id);
      const g = this.map.garages[garage];
      if (g) {
        const box = this.garageBox(g.at);
        const x = box.x + 4 + (bay % GRID_COLS) * (CELL + GAP);
        const y = box.y + 4 + Math.floor(bay / GRID_COLS) * (CELL + GAP);
        const pulse = 0.5 + 0.5 * Math.sin(this.lastNow / 220);
        ctx.strokeStyle = colors.yellow;
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x - 2.5, y - 2.5, CELL + 5, CELL + 5);
        ctx.strokeStyle = `rgba(255,217,102,${0.3 + 0.4 * pulse})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 5, y - 5, CELL + 10, CELL + 10);
      }
    }
  }

  /** The bay under a point in CSS pixels, if any. Generous by a pixel so small bays are easy to hit. */
  hitBay(px: number, py: number): { zone: number; id: number } | null {
    for (let gi = 0; gi < this.map.garages.length; gi++) {
      const g = this.map.garages[gi]!;
      const box = this.garageBox(g.at);
      if (px < box.x || py < box.y || px > box.x + box.w || py > box.y + box.h) continue;
      const col = Math.min(GRID_COLS - 1, Math.max(0, Math.floor((px - box.x - 4 + GAP / 2) / (CELL + GAP))));
      const row = Math.max(0, Math.floor((py - box.y - 4 + GAP / 2) / (CELL + GAP)));
      const bay = Math.min(g.bays - 1, row * GRID_COLS + col);
      return chargerOf(this.map, gi, bay);
    }
    return null;
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
          ctx.fillStyle = `rgba(229,72,77,${0.12 + 0.12 * pulse})`;
          ctx.fill();
        }
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = colors.panelHi;
        ctx.fill();
        ctx.restore();
        // Load ring.
        ctx.beginPath();
        ctx.arc(x, y, r - 3, 0, Math.PI * 2);
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, share / 1.3));
        ctx.strokeStyle = tv.tripped ? colors.faint : loadColor(share);
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.lineCap = 'butt';
        // Bolt.
        ctx.fillStyle = colors.yellow;
        bolt(ctx, x, y, 7);
      }

      // Label card: id, load, temperature.
      const label = tv.burst ? `${t.id} · BURST` : tv.tripped ? `${t.id} · no power` : `${t.id} · ${Math.round(share * 100)}%`;
      const temp = `${Math.round(tv.hotSpotC)}°C`;
      ctx.font = `400 13px ${font}`;
      const w1 = ctx.measureText(label).width;
      ctx.font = `400 13px ${font}`;
      const w2 = ctx.measureText(temp).width;
      const w = w1 + w2 + 26;
      const lx = x - w / 2;
      const ly = y + r + 6;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 6;
      roundRect(ctx, lx, ly, w, 20, 3);
      ctx.fillStyle = tv.burst ? colors.burst : colors.panel;
      ctx.fill();
      ctx.restore();
      if (!tv.burst) {
        roundRect(ctx, lx, ly, w, 20, 3);
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `400 13px ${font}`;
      ctx.fillStyle = tv.burst ? '#ffffff' : colors.ink;
      ctx.fillText(label, lx + 9, ly + 10.5);
      ctx.font = `400 13px ${font}`;
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
  ctx.strokeStyle = 'rgba(11,18,48,0.9)';
  ctx.stroke();
  // Canopy.
  ctx.fillStyle = '#2E7D5B';
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
    ctx.fillStyle = `rgba(158,163,214,${0.3 * (1 - life)})`;
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
  ctx.fillStyle = '#05060F';
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
