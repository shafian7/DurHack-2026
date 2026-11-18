/**
 * The central scheduler baseline (lane D, B61). SPEC §5, CONTRACTS §7.
 *
 * This is the one piece of decision code allowed to read the WorldSnapshot,
 * including each rickshaw's departure time. At every plan it works out the
 * headroom under the transformer's current rating and switches on the
 * chargers with the least slack before departure, up to that headroom.
 *
 * It needs a server, a connection and every charger registered. That is the
 * point of comparing against it. Imports only from ../contracts.
 */
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../contracts';
import type { ChargerId, ChargerView, Rng, Scheduler, WorldSnapshot } from '../contracts';

/**
 * Charger facts the snapshot does not carry. The defaults are the CONTRACTS
 * §10 values, which none of the lane D scenarios change.
 */
export interface SchedulerOptions {
  /** Power of one charger in kW. Inferred from the snapshot when any charger is drawing. */
  readonly powerKw: number;
  readonly batteryKwh: number;
  readonly efficiency: number;
  /** The battery level that counts as ready. Below this a rickshaw is urgent. */
  readonly readyAtSoc: number;
  /**
   * Share of the rating kept free, because household demand can rise during
   * the ticks between two plans and carries a random wobble.
   */
  readonly marginShare: number;
}

export const DEFAULT_SCHEDULER_OPTIONS: SchedulerOptions = {
  powerKw: 1,
  batteryKwh: 7,
  efficiency: 0.85,
  readyAtSoc: 0.9,
  marginShare: 0.03,
};

/** A plugged-in rickshaw that the scheduler can switch. */
interface Candidate {
  readonly id: ChargerId;
  /** 0 if it is below the ready level, 1 if it is only topping up. */
  readonly tier: 0 | 1;
  /** Ticks to spare before departure if it charged without a break from now. */
  readonly slack: number;
}

const isPlugged = (c: ChargerView) => c.state === 'waiting' || c.state === 'charging';

/** Charger power: read from the snapshot when possible, otherwise the configured value. */
export function inferPowerKw(world: WorldSnapshot, fallbackKw: number): number {
  const drawing = world.chargers.filter((c) => c.state === 'charging').length;
  const kw = world.transformer.chargerLoadKw / drawing;
  return drawing > 0 && Number.isFinite(kw) && kw > 0 ? kw : fallbackKw;
}

/** kW that can be planned this interval without going over the rating, after the margin. */
export function headroomKw(world: WorldSnapshot, powerKw: number, marginShare: number): number {
  const { ratingKw, baseLoadKw } = world.transformer;
  // Stubborn chargers draw whenever plugged in whatever the plan says.
  const stubbornKw = world.chargers.filter((c) => c.stubborn && isPlugged(c)).length * powerKw;
  return ratingKw * (1 - marginShare) - baseLoadKw - stubbornKw;
}

/**
 * Ticks to spare before departure if the charger ran flat out from now until
 * it reaches `targetSoc`. Smaller means more urgent; negative means it cannot
 * make it even with no break.
 */
export function slackTicks(c: ChargerView, now: number, targetSoc: number, opts: SchedulerOptions, powerKw: number): number {
  const socPerTick = (powerKw * opts.efficiency) / (TICKS_PER_HOUR * opts.batteryKwh);
  const needTicks = Math.max(0, targetSoc - c.soc) / socPerTick;
  const depart = c.departTick ?? now + TICKS_PER_DAY;
  return depart - now - needTicks;
}

/** The candidates in the order they should be switched on. */
export function rankChargers(world: WorldSnapshot, opts: SchedulerOptions, powerKw: number): Candidate[] {
  const candidates: Candidate[] = [];
  for (const c of world.chargers) {
    if (!isPlugged(c) || c.stubborn || !(c.soc < 1)) continue;
    const urgent = c.soc < opts.readyAtSoc;
    candidates.push({
      id: c.id,
      tier: urgent ? 0 : 1,
      slack: slackTicks(c, world.tick, urgent ? opts.readyAtSoc : 1, opts, powerKw),
    });
  }
  return candidates.sort((a, b) => a.tier - b.tier || a.slack - b.slack || a.id - b.id);
}

export function createScheduler(options: Partial<SchedulerOptions> = {}): Scheduler {
  const opts: SchedulerOptions = { ...DEFAULT_SCHEDULER_OPTIONS, ...options };
  return {
    name: 'central',
    plan(world: WorldSnapshot, _rng: Rng): readonly ChargerId[] {
      try {
        const powerKw = inferPowerKw(world, opts.powerKw);
        const room = headroomKw(world, powerKw, opts.marginShare);
        const slots = Math.max(0, Math.floor(room / powerKw + 1e-9));
        if (slots === 0) return [];
        return rankChargers(world, opts, powerKw)
          .slice(0, slots)
          .map((c) => c.id);
      } catch {
        // CONTRACTS §1: nothing throws in a running demo. An empty plan is the safe answer.
        return [];
      }
    },
  };
}
