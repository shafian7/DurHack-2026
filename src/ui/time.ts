import type { Tick } from '../contracts';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../contracts';

/** Hour of day at a tick, 0 to 24 (CONTRACTS §1). */
export function hourOfDay(tick: Tick): number {
  return (((START_HOUR + tick / TICKS_PER_HOUR) % 24) + 24) % 24;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "21:05" for the simulated wall clock at a tick. */
export function clockText(tick: Tick): string {
  const minutes = Math.floor(hourOfDay(tick) * 60 + 1e-6);
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
}

/** Each simulated day runs noon to noon, so it holds exactly one night. Night 1 starts at tick 0. */
export function nightNumber(tick: Tick): number {
  return Math.floor(tick / TICKS_PER_DAY) + 1;
}

export function clockLabel(tick: Tick): string {
  return `Night ${nightNumber(tick)} · ${clockText(tick)}`;
}

/** "1 h 05 min" or "45 min" for a number of ticks (one tick is one minute). */
export function durationText(ticks: number): string {
  const total = Math.round(ticks);
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${pad(total % 60)} min`;
}
