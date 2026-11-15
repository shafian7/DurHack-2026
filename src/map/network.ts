/**
 * The mobile network the app-controlled chargers depend on (plan.md, the
 * utility-app rival). A grid power cut does not take the network down at
 * once: mobile towers run on backup batteries for a while, then go dark, and
 * come back some time after the grid does. While the network is down the
 * utility's server cannot reach its chargers, and they fall back to charging
 * flat out (BUILD D06).
 *
 * Both durations are model assumptions, not measurements. They have no
 * source in docs/SOURCES.md and the UI says so.
 */
import type { ScriptedCommand, Tick } from '../contracts';

/** How long tower backup batteries keep the network up during a grid power cut, in minutes. Assumed. */
export const TOWER_BACKUP_TICKS = 30;
/** How long after the grid returns before the network is back, in minutes. Assumed. */
export const TOWER_RESTART_TICKS = 20;

/**
 * The network outage that follows a grid power cut of `ticks` minutes
 * starting at `atTick`. Empty when the cut is shorter than the tower backup.
 */
export function networkOutageForPowerCut(atTick: Tick, ticks: number): ScriptedCommand[] {
  if (!(ticks > TOWER_BACKUP_TICKS)) return [];
  return [
    { atTick: atTick + TOWER_BACKUP_TICKS, command: { kind: 'killScheduler' } },
    { atTick: atTick + ticks + TOWER_RESTART_TICKS, command: { kind: 'reviveScheduler' } },
  ];
}
