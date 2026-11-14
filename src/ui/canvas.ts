import type { MarkerShape, StateStyle } from './theme';

export interface Surface {
  readonly ctx: CanvasRenderingContext2D;
  /** Size in CSS pixels. */
  readonly width: number;
  readonly height: number;
}

/**
 * Sizes the canvas backing store to its on-screen size and the device pixel
 * ratio, and returns a context scaled to CSS pixels. Returns null where no 2D
 * context exists (jsdom in tests) or the canvas is not laid out yet.
 */
export function fitCanvas(canvas: HTMLCanvasElement): Surface | null {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return null;
  }
  if (!ctx) return null;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width <= 0 || height <= 0) return null;
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

/** Marker shapes for the curves, so each neighbourhood differs by shape as well as colour. */
export function drawMarker(
  ctx: CanvasRenderingContext2D,
  shape: MarkerShape,
  x: number,
  y: number,
  r: number,
  fill: string,
  stroke = '#0b0f17',
): void {
  ctx.beginPath();
  switch (shape) {
    case 'square':
      ctx.rect(x - r, y - r, 2 * r, 2 * r);
      break;
    case 'circle':
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.15, y + r * 0.85);
      ctx.lineTo(x - r * 1.15, y + r * 0.85);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(x, y - r * 1.3);
      ctx.lineTo(x + r * 1.1, y);
      ctx.lineTo(x, y + r * 1.3);
      ctx.lineTo(x - r * 1.1, y);
      ctx.closePath();
      break;
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.setLineDash([]);
  ctx.stroke();
}

/** One charger's mark on the street view. */
export function drawStateMark(ctx: CanvasRenderingContext2D, style: StateStyle, x: number, y: number, r: number): void {
  ctx.setLineDash([]);
  ctx.beginPath();
  switch (style.shape) {
    case 'dot':
      ctx.arc(x, y, Math.max(1.5, r * 0.35), 0, Math.PI * 2);
      ctx.fillStyle = style.colour;
      ctx.fill();
      return;
    case 'hollowSquare':
      ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
      ctx.lineWidth = Math.max(1.5, r * 0.35);
      ctx.strokeStyle = style.colour;
      ctx.stroke();
      return;
    case 'triangle':
      ctx.moveTo(x, y - r * 1.1);
      ctx.lineTo(x + r, y + r * 0.8);
      ctx.lineTo(x - r, y + r * 0.8);
      ctx.closePath();
      ctx.fillStyle = style.colour;
      ctx.fill();
      return;
    case 'disc':
      ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = style.colour;
      ctx.fill();
      return;
    case 'cross':
      ctx.moveTo(x - r * 0.75, y - r * 0.75);
      ctx.lineTo(x + r * 0.75, y + r * 0.75);
      ctx.moveTo(x + r * 0.75, y - r * 0.75);
      ctx.lineTo(x - r * 0.75, y + r * 0.75);
      ctx.lineWidth = Math.max(1.5, r * 0.35);
      ctx.strokeStyle = style.colour;
      ctx.stroke();
      return;
  }
}
