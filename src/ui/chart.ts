/**
 * The centrepiece: every neighbourhood's load curve overlaid against the
 * transformer's rating, drawn from history() alone (CONTRACTS §8). The UI
 * keeps no copy of the numbers; each frame re-reads history().
 */
import type { FleetMode, Tick, TickSample } from '../contracts';
import { TICKS_PER_DAY } from '../contracts';
import { drawMarker, type Surface } from './canvas';
import { COLOURS, FONT, MODE_STYLE } from './theme';
import { clockText, hourOfDay } from './time';

export interface ChartSeries {
  readonly mode: FleetMode;
  readonly samples: readonly TickSample[];
}

/** Ticks [from, to) during which a neighbourhood had no power. */
export interface Span {
  readonly from: Tick;
  readonly to: Tick;
}

/** A judge action, marked on the time axis. */
export interface ChartEvent {
  readonly tick: Tick;
  readonly label: string;
}

/** The chart shows one simulated day, noon to noon, then scrolls. */
export const WINDOW_TICKS = TICKS_PER_DAY;

/** The visible range of ticks: it fills from the left during the first day, then scrolls. */
export function chartWindow(series: readonly ChartSeries[], windowTicks = WINDOW_TICKS): { t0: Tick; t1: Tick } {
  let last = -1;
  for (const s of series) {
    const tail = s.samples[s.samples.length - 1];
    if (tail && tail.tick > last) last = tail.tick;
  }
  const t1 = Math.max(windowTicks, last + 1);
  return { t0: t1 - windowTicks, t1 };
}

/** Runs of tripped samples within [t0, t1). */
export function outageSpans(samples: readonly TickSample[], t0: Tick, t1: Tick): Span[] {
  const spans: Span[] = [];
  let start: Tick | null = null;
  let prev: Tick | null = null;
  for (const s of samples) {
    if (s.tick < t0 || s.tick >= t1) continue;
    if (s.tripped) {
      if (start === null || (prev !== null && s.tick !== prev + 1)) {
        if (start !== null && prev !== null) spans.push({ from: start, to: prev + 1 });
        start = s.tick;
      }
      prev = s.tick;
    } else if (start !== null && prev !== null) {
      spans.push({ from: start, to: prev + 1 });
      start = null;
      prev = null;
    }
  }
  if (start !== null && prev !== null) spans.push({ from: start, to: prev + 1 });
  return spans;
}

/** Smallest of 1, 2, 2.5, 5 times a power of ten that is at least v. */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v - 1e-9) return m * p;
  return 10 * p;
}

/**
 * The y-axis top. It leaves room well above the rating so the scale does not
 * jump while a night plays, and grows if a curve goes higher.
 */
export function yMaxFor(series: readonly ChartSeries[], t0: Tick): number {
  let top = 0;
  for (const s of series) {
    for (const p of s.samples) {
      if (p.tick < t0) continue;
      top = Math.max(top, p.loadKw * 1.08, p.baseLoadKw * 1.08, p.ratingKw * 1.6);
    }
  }
  return niceCeil(top);
}

const stepFor = (yMax: number) => {
  const raw = yMax / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw - 1e-9) return m * p;
  return raw;
};

export interface ChartDrawOptions {
  readonly windowTicks?: number;
  readonly events?: readonly ChartEvent[];
}

const STRIP_H = 18;

export function drawChart(surface: Surface, series: readonly ChartSeries[], options: ChartDrawOptions = {}): void {
  const { ctx, width, height } = surface;
  const { t0, t1 } = chartWindow(series, options.windowTicks);
  const yMax = yMaxFor(series, t0);
  const big = width > 900;
  const fs = big ? 18 : 14;

  const left = big ? 92 : 64;
  const right = big ? 128 : 84;
  const top = 18;
  const stripsH = series.length * STRIP_H + 44;
  const bottom = (big ? 36 : 30) + stripsH;
  const pw = Math.max(10, width - left - right);
  const ph = Math.max(10, height - top - bottom);
  const x = (t: number) => left + ((t - t0) / (t1 - t0)) * pw;
  const y = (kw: number) => top + ph - (Math.min(kw, yMax) / yMax) * ph;

  ctx.setLineDash([]);
  ctx.fillStyle = COLOURS.panel;
  ctx.fillRect(0, 0, width, height);

  const ref = series[0]?.samples.filter((s) => s.tick >= t0 && s.tick < t1) ?? [];

  // Overload zone: everything above the rating.
  if (ref.length > 0) {
    ctx.beginPath();
    // Before the first sample and after the latest, the zone uses the nearest known rating.
    ctx.moveTo(x(t0), top);
    ctx.lineTo(x(t0), y(ref[0]!.ratingKw));
    for (const s of ref) ctx.lineTo(x(s.tick), y(s.ratingKw));
    ctx.lineTo(x(t1), y(ref[ref.length - 1]!.ratingKw));
    ctx.lineTo(x(t1), top);
    ctx.closePath();
    ctx.fillStyle = COLOURS.overloadZone;
    ctx.fill();
  }

  // Horizontal grid and kW labels.
  ctx.font = `600 ${fs}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  const step = stepFor(yMax);
  for (let v = 0; v <= yMax + 1e-9; v += step) {
    ctx.strokeStyle = COLOURS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y(v));
    ctx.lineTo(left + pw, y(v));
    ctx.stroke();
    ctx.fillStyle = COLOURS.axis;
    ctx.fillText(`${Math.round(v)} kW`, left - 10, y(v));
  }

  // Vertical grid every two hours (four on a narrow screen), labelled with the clock.
  const every = big ? 2 : 4;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let t = Math.ceil(t0 / 60) * 60; t <= t1; t += 60) {
    if (Math.round(hourOfDay(t)) % every !== 0) continue;
    ctx.strokeStyle = COLOURS.grid;
    ctx.beginPath();
    ctx.moveTo(x(t), top);
    ctx.lineTo(x(t), top + ph);
    ctx.stroke();
    ctx.fillStyle = COLOURS.axis;
    ctx.fillText(clockText(t), x(t), top + ph + 8);
  }

  // Household demand, the same night in every neighbourhood.
  if (ref.length > 1) {
    ctx.beginPath();
    ctx.moveTo(x(ref[0]!.tick), y(0));
    for (const s of ref) ctx.lineTo(x(s.tick), y(s.baseLoadKw));
    ctx.lineTo(x(ref[ref.length - 1]!.tick), y(0));
    ctx.closePath();
    ctx.fillStyle = COLOURS.household;
    ctx.fill();
  }

  // Judge actions.
  ctx.font = `600 ${fs - 2}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const ev of options.events ?? []) {
    if (ev.tick < t0 || ev.tick > t1) continue;
    ctx.strokeStyle = COLOURS.axis;
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x(ev.tick), top);
    ctx.lineTo(x(ev.tick), top + ph);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLOURS.text;
    ctx.fillText(ev.label, x(ev.tick) + 5, top + 4);
  }

  // Rating line, labelled with the rating read from history.
  if (ref.length > 0) {
    ctx.strokeStyle = COLOURS.rating;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ref.forEach((s, i) => (i === 0 ? ctx.moveTo(x(s.tick), y(s.ratingKw)) : ctx.lineTo(x(s.tick), y(s.ratingKw))));
    ctx.stroke();
    const lastRef = ref[ref.length - 1]!;
    ctx.font = `700 ${fs}px ${FONT}`;
    ctx.fillStyle = COLOURS.rating;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`Transformer rating ${Math.round(lastRef.ratingKw)} kW`, left + 8, y(lastRef.ratingKw) - 6);
  }

  // Load curves.
  for (const s of series) {
    const style = MODE_STYLE[s.mode];
    const pts = s.samples.filter((p) => p.tick >= t0 && p.tick < t1);
    if (pts.length === 0) continue;
    ctx.strokeStyle = style.colour;
    ctx.lineWidth = style.width;
    ctx.lineJoin = 'round';
    ctx.setLineDash(style.dash as number[]);
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(x(p.tick), y(p.loadKw)) : ctx.lineTo(x(p.tick), y(p.loadKw))));
    ctx.stroke();
    ctx.setLineDash([]);
    // Shape markers along the curve every two hours, offset per mode so they do not stack.
    const offset = (series.indexOf(s) * 40) % 120;
    for (const p of pts) {
      if ((p.tick + offset) % 120 === 0) drawMarker(ctx, style.marker, x(p.tick), y(p.loadKw), big ? 6 : 4.5, style.colour);
    }
  }

  // End labels, nudged apart so they never overlap.
  const ends = series
    .map((s) => ({ s, p: s.samples[s.samples.length - 1] }))
    .filter((e): e is { s: ChartSeries; p: TickSample } => e.p !== undefined && e.p.tick >= t0)
    .map((e) => ({ ...e, ly: y(e.p.loadKw) }))
    .sort((a, b) => a.ly - b.ly);
  const gap = fs + 6;
  for (let i = 1; i < ends.length; i++) ends[i]!.ly = Math.max(ends[i]!.ly, ends[i - 1]!.ly + gap);
  ctx.font = `800 ${fs}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const e of ends) {
    const style = MODE_STYLE[e.s.mode];
    const ex = x(e.p.tick);
    drawMarker(ctx, style.marker, ex, y(e.p.loadKw), big ? 8 : 6, style.colour, COLOURS.text);
    ctx.fillStyle = style.colour;
    ctx.fillText(style.short, Math.min(ex + 14, left + pw + 10), Math.min(Math.max(e.ly, top + 8), top + ph));
  }

  // Power-out strips, one row per neighbourhood, under the time axis.
  const stripTop = top + ph + (big ? 36 : 30) + 22;
  ctx.font = `700 ${fs - 2}px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLOURS.axis;
  ctx.fillText('Power out', left - 10, stripTop - 11);
  series.forEach((s, i) => {
    const style = MODE_STYLE[s.mode];
    const ry = stripTop + i * STRIP_H;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(left, ry, pw, STRIP_H - 4);
    ctx.fillStyle = style.colour;
    ctx.textAlign = 'right';
    ctx.fillText(style.short, left - 10, ry + (STRIP_H - 4) / 2);
    for (const span of outageSpans(s.samples, t0, t1)) {
      const sx = x(span.from);
      const sw = Math.max(3, x(span.to) - sx);
      ctx.fillStyle = COLOURS.outage;
      ctx.fillRect(sx, ry, sw, STRIP_H - 4);
      // Hatching, so an outage reads without colour.
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, ry, sw, STRIP_H - 4);
      ctx.clip();
      ctx.strokeStyle = '#0b0f17';
      ctx.lineWidth = 2;
      for (let hx = sx - STRIP_H; hx < sx + sw; hx += 7) {
        ctx.beginPath();
        ctx.moveTo(hx, ry + STRIP_H);
        ctx.lineTo(hx + STRIP_H, ry - 4);
        ctx.stroke();
      }
      ctx.restore();
    }
  });
}
