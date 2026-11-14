/**
 * The shared physical model, as pure functions. FROZEN during the split run.
 * The sim core, the central scheduler, the UI and any test bench all use these,
 * so every lane works against the same voltage law. Meanings: docs/CONTRACTS.md Â§2.
 */
import {
  START_HOUR,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  type BaseLoadConfig,
  type ChargerConfig,
  type Tick,
  type TransformerConfig,
} from '../contracts';

/** Hour of day, 0 up to 24, at a tick. Tick 0 is START_HOUR. */
export function hourOfDay(tick: Tick): number {
  const hour = (START_HOUR + tick / TICKS_PER_HOUR) % 24;
  return hour < 0 ? hour + 24 : hour;
}

/** Which simulated day (noon to noon) a tick falls in, counting from 0. */
export function dayOf(tick: Tick): number {
  return Math.floor(tick / TICKS_PER_DAY);
}

/** "22:05" for a tick. For labels. */
export function clockLabel(tick: Tick): string {
  const minutes = Math.round(hourOfDay(tick) * 60) % (24 * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** The tick offset within a day (0 to 1439) of an hour of day on the evening-and-morning-after timeline. */
export function tickOfHour(hour: number): number {
  const offset = ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;
  return Math.round(offset);
}

/** Household demand in kW at a tick: the hourly curve, linearly interpolated. No noise, no scaling. */
export function baseLoadKw(config: BaseLoadConfig, tick: Tick): number {
  const hour = hourOfDay(tick);
  const lower = Math.floor(hour) % 24;
  const upper = (lower + 1) % 24;
  const share = hour - Math.floor(hour);
  const a = config.hourlyKw[lower] ?? 0;
  const b = config.hourlyKw[upper] ?? a;
  return a + (b - a) * share;
}

/** Volts at the transformer busbar for a given load. Sag is relative to the configured rating. */
export function busVolts(config: TransformerConfig, loadKw: number, supplyPu: number): number {
  const volts = config.nominalVolts * supplyPu * (1 - (config.sagAtRating * loadKw) / config.ratingKw);
  return Math.max(0, volts);
}

/** Volts at a socket at position feeder (0 near, 1 far) for a given load, before sensor noise. */
export function socketVolts(config: TransformerConfig, loadKw: number, supplyPu: number, feeder: number): number {
  const sag = config.sagAtRating * (1 + config.feederExtraSag * feeder);
  const volts = config.nominalVolts * supplyPu * (1 - (sag * loadKw) / config.ratingKw);
  return Math.max(0, volts);
}

/** Battery fraction gained by one tick of charging. */
export function socGainPerTick(config: ChargerConfig): number {
  return (config.powerKw * config.efficiency) / (TICKS_PER_HOUR * config.batteryKwh);
}
