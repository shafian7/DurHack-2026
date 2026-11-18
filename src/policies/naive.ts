/**
 * The naive baseline (lane B, B20): draw whenever a rickshaw is plugged in.
 * This is how chargers behave today and it makes the evening spike.
 * Imports only from ../contracts (AGENTS E1).
 */
import type { ChargerPolicy } from '../contracts';

export const naivePolicy: ChargerPolicy<null> = {
  name: 'naive',
  createMemory: () => null,
  decide: () => 'on',
};
