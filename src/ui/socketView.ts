/**
 * The socket view: what one charger feels. Click a bay and both maps show the
 * same charger, in its own world: the voltage at its socket over the last
 * hour and a half, what state it was in, its battery, and in plain words why
 * it is doing what it is doing. For the smart charger it also draws the line
 * below which it backs off, so "it only knows its own socket" can be seen.
 */
import type { ChargerState } from '../contracts';
import { colors, font } from './theme';

export interface SocketSample {
  readonly tick: number;
  readonly volts: number;
  readonly state: ChargerState;
  readonly soc: number;
  /** Server reachable, on the app-controlled side. */
  readonly online: boolean;
}

export interface SocketInfo {
  readonly mode: 'central' | 'local' | 'naive';
  readonly garage: string;
  readonly bay: number;
  readonly transformer: string;
  readonly wireMetres: number;
  readonly nominalVolts: number;
  /** The smart rule's sag tolerance for a battery level (battery part only), as a fraction. */
  readonly tolerance?: (soc: number) => number;
  readonly powerOut: boolean;
}

/** Ninety simulated minutes of history. */
export const SOCKET_WINDOW = 90;

const STATE_COLOR: Record<ChargerState, string> = {
  away: colors.building,
  waiting: colors.warn,
  charging: colors.charging,
  full: colors.full,
  removed: colors.building,
};

export class SocketView {
  readonly el: HTMLElement;
  private readonly title: HTMLElement;
  private readonly sub: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly facts: HTMLElement;
  private readonly why: HTMLElement;

  constructor(onClose: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'socket glass';
    const head = document.createElement('div');
    head.className = 'socket-head';
    const titles = document.createElement('div');
    this.title = document.createElement('b');
    this.sub = document.createElement('span');
    titles.append(this.title, this.sub);
    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '✕';
    close.title = 'Close the socket view';
    close.addEventListener('click', onClose);
    head.append(titles, close);
    this.canvas = document.createElement('canvas');
    this.facts = document.createElement('div');
    this.facts.className = 'socket-facts';
    this.why = document.createElement('div');
    this.why.className = 'socket-why';
    this.el.append(head, this.canvas, this.facts, this.why);
  }

  show(on: boolean): void {
    this.el.classList.toggle('open', on);
  }

  update(info: SocketInfo, samples: readonly SocketSample[]): void {
    const last = samples[samples.length - 1];
    this.title.textContent = `${info.garage} · bay ${info.bay + 1}`;
    this.sub.textContent = `${info.transformer} · ${info.wireMetres} m down the wire`;
    this.drawTrace(info, samples);
    if (!last) return;
    const sagPct = last.volts > 0 ? Math.round((1 - last.volts / info.nominalVolts) * 100) : null;
    const empty = last.state === 'away' || last.state === 'removed';
    const reading = empty ? '–' : last.volts > 0 ? `${Math.round(last.volts)} V` : '0 V';
    const sagText = empty ? 'bay empty' : sagPct === null ? 'no power' : sagPct <= 0 ? 'at normal' : `${sagPct}% below normal`;
    const battery = last.state === 'away' ? '–' : `${Math.round(last.soc * 100)}%`;
    this.facts.innerHTML =
      `<span><small>Socket reads</small>${reading} <em>${sagText}</em></span>` +
      `<span><small>Battery</small>${battery}</span>` +
      `<span><small>State</small><i style="background:${STATE_COLOR[last.state]}"></i>${last.state}</span>`;
    this.why.textContent = explain(info, last);
  }

  private drawTrace(info: SocketInfo, samples: readonly SocketSample[]): void {
    const width = Math.max(200, Math.floor(this.canvas.parentElement?.clientWidth ?? 280) - 0);
    const height = 92;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(width * dpr)) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const left = 34;
    const top = 6;
    const bottom = 16;
    const w = width - left - 4;
    const h = height - top - bottom;
    const vMax = info.nominalVolts * 1.02;
    const vMin = info.nominalVolts * 0.84;
    const end = samples.length ? samples[samples.length - 1]!.tick : 0;
    const start = end - SOCKET_WINDOW;
    const x = (t: number): number => left + ((t - start) / SOCKET_WINDOW) * w;
    const y = (v: number): number => top + h - ((Math.max(vMin, Math.min(vMax, v)) - vMin) / (vMax - vMin)) * h;

    ctx.font = `400 11px ${font}`;
    ctx.fillStyle = colors.faint;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of [230, 215, 200]) {
      ctx.strokeStyle = colors.line;
      ctx.beginPath();
      ctx.moveTo(left, Math.round(y(v)) + 0.5);
      ctx.lineTo(left + w, Math.round(y(v)) + 0.5);
      ctx.stroke();
      ctx.fillText(`${v} V`, left - 4, y(v));
    }
    // State strip along the bottom.
    for (const s of samples) {
      ctx.fillStyle = STATE_COLOR[s.state];
      ctx.fillRect(x(s.tick), top + h + 6, Math.max(1, w / SOCKET_WINDOW + 0.5), 5);
    }
    // The smart charger's back-off line for its battery level at each moment.
    if (info.tolerance) {
      ctx.strokeStyle = colors.hot;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let pen = false;
      for (const s of samples) {
        if (s.state === 'away' || s.state === 'full') {
          pen = false;
          continue;
        }
        const v = info.nominalVolts * (1 - info.tolerance(s.soc));
        if (!pen) ctx.moveTo(x(s.tick), y(v));
        else ctx.lineTo(x(s.tick), y(v));
        pen = true;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // The reading.
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let pen = false;
    for (const s of samples) {
      if (s.volts <= 0) {
        pen = false;
        continue;
      }
      if (!pen) ctx.moveTo(x(s.tick), y(s.volts));
      else ctx.lineTo(x(s.tick), y(s.volts));
      pen = true;
    }
    ctx.stroke();
  }
}

/** Why this charger is doing what it is doing, in one plain sentence. */
function explain(info: SocketInfo, s: SocketSample): string {
  if (info.powerOut || (s.volts <= 0 && s.state !== 'away')) return 'No power on the wire. It waits for the voltage to come back.';
  switch (s.state) {
    case 'away':
      return 'The rickshaw is out driving. The bay is empty.';
    case 'full':
      return 'Battery full. It has stopped drawing power.';
    case 'removed':
      return 'This charger has been removed.';
    default:
      break;
  }
  if (info.mode === 'central') {
    if (!s.online) return 'No instructions from the server, so it charges flat out whatever the voltage.';
    return s.state === 'charging'
      ? 'The server told it to charge. It cannot see the voltage; it only follows orders.'
      : 'The server told it to wait its turn.';
  }
  if (info.mode === 'naive') return 'It charges flat out whenever a rickshaw is plugged in.';
  const limit = info.tolerance ? info.nominalVolts * (1 - info.tolerance(s.soc)) : null;
  if (s.state === 'charging') return 'There is room on the wire, so it charges. It will back off if the voltage sags past its line.';
  if (limit !== null && s.volts < limit)
    return `The voltage has sagged below its line (${Math.round(limit)} V for this battery), so it is backing off for a random time.`;
  return 'It is waiting out a random delay before trying again, so it does not restart in step with its neighbours.';
}
