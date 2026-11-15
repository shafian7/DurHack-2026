/**
 * The evidence strip: load on each transformer as a share of its rating
 * through tonight, for both sides, with the limit as one line.
 */
import { TICKS_PER_DAY, type TickSample } from '../contracts';
import { colors, font } from './theme';

export interface Series {
  readonly label: string;
  readonly color: string;
  readonly dashed: boolean;
  readonly samples: readonly TickSample[];
}

/** Tonight runs 17:00 to 08:00: ticks 300 to 1200 of each day. */
export const WINDOW_START = 300;
export const WINDOW_END = 1200;
const Y_MAX = 1.4;

export function drawChart(canvas: HTMLCanvasElement, width: number, height: number, time: number, series: readonly Series[]): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const left = 40;
  const right = 12;
  const top = 10;
  const bottom = 22;
  const w = width - left - right;
  const h = height - top - bottom;
  const day = Math.floor(Math.max(0, time - WINDOW_START + 1) / TICKS_PER_DAY);
  const t0 = day * TICKS_PER_DAY + WINDOW_START;
  const t1 = day * TICKS_PER_DAY + WINDOW_END;
  const x = (t: number): number => left + ((t - t0) / (t1 - t0)) * w;
  const y = (share: number): number => top + h - (Math.min(Y_MAX, share) / Y_MAX) * h;

  // Grid and axis labels.
  ctx.font = `500 10px ${font}`;
  ctx.fillStyle = colors.faint;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1;
  for (const s of [0, 0.5, 1]) {
    ctx.beginPath();
    ctx.moveTo(left, Math.round(y(s)) + 0.5);
    ctx.lineTo(left + w, Math.round(y(s)) + 0.5);
    ctx.stroke();
    ctx.fillText(`${Math.round(s * 100)}%`, left - 6, y(s));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let hr = 18; hr <= 32; hr += 2) {
    const t = day * TICKS_PER_DAY + (hr - 12) * 60;
    ctx.fillText(`${String(hr % 24).padStart(2, '0')}:00`, x(t), top + h + 6);
  }

  // The limit.
  ctx.strokeStyle = colors.hot;
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(left, y(1));
  ctx.lineTo(left + w, y(1));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = colors.hot;
  ctx.fillText('transformer limit', left + 6, y(1) - 3);

  // Curves.
  for (const s of series) {
    ctx.beginPath();
    let pen = false;
    for (const p of s.samples) {
      if (p.tick < t0 || p.tick > t1) continue;
      const py = y(p.loadKw / p.ratingKw);
      if (!pen) {
        ctx.moveTo(x(p.tick), py);
        pen = true;
      } else ctx.lineTo(x(p.tick), py);
    }
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.setLineDash(s.dashed ? [6, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Now.
  if (time >= t0 && time <= t1) {
    ctx.strokeStyle = 'rgba(29,38,51,0.25)';
    ctx.beginPath();
    ctx.moveTo(x(time), top);
    ctx.lineTo(x(time), top + h);
    ctx.stroke();
  }
}
