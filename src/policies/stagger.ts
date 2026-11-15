/**
 * The random-stagger baseline (lane B, B20): after plugging in, wait a random
 * time, then draw without stopping. It senses nothing, so it isolates what the
 * voltage feedback in local.ts adds over plain randomness (SPEC §5).
 * Imports only from ../contracts (AGENTS E1). All state lives in the memory
 * object (E2). The delay is a device constant, not a clock time (E3).
 */
import type { ChargerPolicy } from '../contracts';

/** The delay after plugging in is uniform over [0, MAX_DELAY_TICKS). Three hours. */
export const MAX_DELAY_TICKS = 180;

export interface StaggerMemory {
  /** Ticks to wait after this plug-in before drawing. */
  delayTicks: number;
}

export const staggerPolicy: ChargerPolicy<StaggerMemory> = {
  name: 'stagger',
  createMemory: (rng) => ({ delayTicks: rng.int(MAX_DELAY_TICKS) }),
  decide: (obs, memory) => (obs.pluggedTicks >= memory.delayTicks ? 'on' : 'off'),
  onEvent: (event, memory, rng) => {
    if (event.kind === 'pluggedIn') memory.delayTicks = rng.int(MAX_DELAY_TICKS);
  },
};
