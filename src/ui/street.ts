/**
 * One neighbourhood's street: the transformer at the left, the feeder running
 * right, and one mark per charger at its feeder position. A charger's state
 * shows as a shape and a colour (theme STATE_STYLE).
 */
import type { WorldSnapshot } from '../contracts';
import { drawStateMark, type Surface } from './canvas';
import { COLOURS, FONT, STATE_STYLE } from './theme';

const ROWS = 4;

export function drawStreet(surface: Surface, snapshot: WorldSnapshot, accent: string): void {
  const { ctx, width, height } = surface;
  ctx.setLineDash([]);
  ctx.fillStyle = COLOURS.panel;
  ctx.fillRect(0, 0, width, height);

  const tfW = Math.min(46, width * 0.12);
  const left = tfW + 18;
  const right = 12;
  const mid = height / 2;
  const r = Math.max(3, Math.min(7, height / 16));
  const rowGap = Math.min((height - 8) / (ROWS + 1), r * 3);
  const tripped = snapshot.transformer.tripped;

  // Feeder.
  ctx.strokeStyle = tripped ? '#3a4352' : accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tfW, mid);
  ctx.lineTo(width - right, mid);
  ctx.stroke();

  // Transformer.
  const tfH = Math.min(height - 12, 40);
  ctx.fillStyle = tripped ? '#3a4352' : accent;
  ctx.fillRect(4, mid - tfH / 2, tfW - 6, tfH);
  ctx.fillStyle = COLOURS.bg;
  ctx.font = `800 ${Math.round(tfH * 0.45)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TX', 4 + (tfW - 6) / 2, mid + 1);

  // Chargers, in four rows around the feeder so marks overlap less.
  const span = width - left - right;
  for (const c of snapshot.chargers) {
    const row = c.id % ROWS;
    const offset = (row < ROWS / 2 ? -(row + 1) : row - ROWS / 2 + 1) * rowGap;
    const cx = left + c.feeder * span;
    drawStateMark(ctx, STATE_STYLE[c.state], cx, mid + offset, r);
    if (c.stubborn && c.state !== 'removed') {
      ctx.strokeStyle = '#ff4d6d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, mid + offset, r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (tripped) {
    ctx.fillStyle = 'rgba(5, 7, 12, 0.72)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = COLOURS.outage;
    ctx.font = `900 ${Math.round(Math.min(height * 0.4, 34))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('POWER OUT', width / 2, mid);
  }
}
