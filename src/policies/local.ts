/**
 * The local rule (lane B, B21): a charger that spreads its own load by
 * watching only the voltage at its own socket (SPEC §5).
 *
 * What it knows: its socket voltage, the voltage printed on the device, the
 * battery level, whether it drew last tick and how long the rickshaw has been
 * plugged in. Nothing else. It has no clock, no schedule, no forecast, no
 * charger count and no transformer rating (AGENTS E3). It imports only from
 * ../contracts (E1) and keeps everything it remembers in its memory object
 * (E2). It sends nothing (E5).
 *
 * The rules, in SPEC §5 order:
 * 1. After plugging in, wait a short random time before the first attempt.
 * 2. While drawing, if the sag at the socket passes this charger's limit,
 *    stop and wait a random time. Back-offs in a row make the wait longer,
 *    up to a cap.
 * 3. An emptier battery tolerates more sag and waits less. A charger that has
 *    drawn for little of the time it has been plugged in tolerates more sag
 *    too (3b), which is what lets the far end of the feeder catch up.
 * 4. When the wait ends, start only if the sag leaves room for one more
 *    charger (a margin under the limit). Otherwise wait again.
 * 5. After a power cut, wait a random time before starting again.
 * 6. The charger learns what "no sag" looks like at its own socket: the
 *    highest voltage it has seen, which it keeps in memory.
 *
 * Every threshold and delay is a tuning constant in LOCAL_PARAMS (BUILD B21, B23).
 */
import type { ChargerPolicy, Rng } from '../contracts';

// ------------------------------------------------------------ tuning constants

export interface LocalParams {
  /** Sag limit, as a fraction of the reference voltage, for a full battery. */
  readonly sagLimitFull: number;
  /** Sag limit for an empty battery. Limits in between are linear in battery level. */
  readonly sagLimitEmpty: number;
  /** Rule 4: a waiting charger starts only when sag is this far below its limit. */
  readonly restartMargin: number;
  /** Rule 1: the first attempt after plugging in waits uniformly over [0, this). */
  readonly startDelayMaxTicks: number;
  /** Rule 2: the first back-off waits uniformly over [1, this]. */
  readonly backoffBaseTicks: number;
  /** Rule 2: each back-off in a row doubles the window, at most this many times. */
  readonly backoffMaxDoublings: number;
  /** Rule 2: after drawing this many ticks in a row, the back-off count resets. */
  readonly steadyTicks: number;
  /** Rule 3: an empty battery's wait is this share of a full one's. */
  readonly emptyWaitShare: number;
  /** Rule 5: after a power cut, restart uniformly over [1, this]. */
  readonly outageRestartMaxTicks: number;
  /**
   * Rule 3b: extra sag tolerated by a charger that has drawn little since it
   * plugged in, at a duty of 0. A charger far down the feeder sees more sag
   * for the same load, gets turned away more, and so pushes harder. Duty is
   * its own drawn ticks over its own plugged ticks.
   */
  readonly deprivationBoost: number;
  /** Rule 3b: duty is measured over at least this many plugged ticks, so a fresh plug-in is not "deprived". */
  readonly dutyMinTicks: number;
  /** Rule 6: readings below this share of nominal are not trusted as a reference. */
  readonly referenceFloorShare: number;
  /** Rule 6: readings above this share of nominal are not trusted either. */
  readonly referenceCeilingShare: number;
}

export const LOCAL_PARAMS: LocalParams = Object.freeze({
  sagLimitFull: 0.025,
  sagLimitEmpty: 0.085,
  restartMargin: 0.012,
  startDelayMaxTicks: 20,
  backoffBaseTicks: 10,
  backoffMaxDoublings: 4,
  steadyTicks: 30,
  emptyWaitShare: 0.3,
  outageRestartMaxTicks: 40,
  deprivationBoost: 0.075,
  dutyMinTicks: 60,
  referenceFloorShare: 0.9,
  referenceCeilingShare: 1.1,
});

// ------------------------------------------------------------------- memory

export interface LocalMemory {
  /** Ticks this charger has been asked to decide, over the whole run. Its own counter, not a clock. */
  ticks: number;
  /** Do not draw before ticks reaches this. */
  waitUntil: number;
  /** Back-offs in a row since the last steady spell of drawing. */
  backoffs: number;
  /** Ticks drawn in a row. */
  steady: number;
  /** Highest trusted voltage seen at this socket (rule 6). 0 until the first reading. */
  reference: number;
  /** Ticks drawn since this rickshaw plugged in (rule 3b). */
  drawn: number;
  /** Whether the last reading was a power cut (voltage 0). */
  inOutage: boolean;
}

// ---------------------------------------------------------------- helpers

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Rule 3: the sag this charger tolerates at a given battery level. */
export function sagLimit(soc: number, p: LocalParams = LOCAL_PARAMS): number {
  return p.sagLimitFull + (p.sagLimitEmpty - p.sagLimitFull) * (1 - clamp01(soc));
}

/** Rule 3: how much of a full battery's wait this battery waits. */
export function waitShare(soc: number, p: LocalParams = LOCAL_PARAMS): number {
  return p.emptyWaitShare + (1 - p.emptyWaitShare) * clamp01(soc);
}

/** Rule 2: a random wait whose window doubles with each back-off in a row. */
function backoffWait(memory: LocalMemory, soc: number, p: LocalParams, rng: Rng): number {
  const window = p.backoffBaseTicks * 2 ** Math.min(memory.backoffs, p.backoffMaxDoublings);
  return 1 + rng.int(Math.max(1, Math.round(window * waitShare(soc, p))));
}

// ----------------------------------------------------------------- policy

/** Builds the local rule with the given constants. Tuning and tests use this; the product uses localPolicy. */
export function createLocalPolicy(p: LocalParams = LOCAL_PARAMS): ChargerPolicy<LocalMemory> {
  return {
    name: 'local',

    createMemory: () => ({ ticks: 0, waitUntil: 0, backoffs: 0, steady: 0, drawn: 0, reference: 0, inOutage: false }),

    onEvent: (event, memory, rng) => {
      if (event.kind === 'pluggedIn') {
        memory.waitUntil = memory.ticks + rng.int(p.startDelayMaxTicks);
        memory.backoffs = 0;
        memory.steady = 0;
        memory.drawn = 0;
      }
    },

    decide: (obs, memory, rng) => {
      memory.ticks += 1;
      const now = memory.ticks;

      // Rule 5: a power cut. Draw nothing, and on return start at a random tick.
      if (obs.voltage <= 0) {
        memory.inOutage = true;
        memory.steady = 0;
        return 'off';
      }
      if (memory.inOutage) {
        memory.inOutage = false;
        memory.waitUntil = now + 1 + rng.int(p.outageRestartMaxTicks);
        return 'off';
      }

      // Rule 6: learn what no sag looks like at this socket.
      const nominal = obs.nominalVolts;
      const floor = nominal * p.referenceFloorShare;
      if (obs.voltage >= floor && obs.voltage <= nominal * p.referenceCeilingShare && obs.voltage > memory.reference) {
        memory.reference = obs.voltage;
      }
      const reference = memory.reference > 0 ? Math.max(memory.reference, floor) : nominal;
      const sag = 1 - obs.voltage / reference;
      if (obs.drawing) memory.drawn += 1;
      const duty = Math.min(1, memory.drawn / Math.max(obs.pluggedTicks, p.dutyMinTicks));
      const limit = sagLimit(obs.soc, p) + p.deprivationBoost * (1 - duty);

      if (obs.drawing) {
        // Rule 2: back off when the sag passes the limit.
        if (sag > limit) {
          memory.waitUntil = now + backoffWait(memory, obs.soc, p, rng);
          memory.backoffs += 1;
          memory.steady = 0;
          return 'off';
        }
        memory.steady += 1;
        if (memory.steady >= p.steadyTicks) memory.backoffs = 0;
        return 'on';
      }

      // Rules 1 and 4: wait out the delay, then start only with room to spare.
      if (now < memory.waitUntil) return 'off';
      if (sag < limit - p.restartMargin) return 'on';
      memory.waitUntil = now + backoffWait(memory, obs.soc, p, rng);
      return 'off';
    },
  };
}

export const localPolicy: ChargerPolicy<LocalMemory> = createLocalPolicy();
