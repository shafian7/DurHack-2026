import type { Observation } from '../../src/contracts';

export const NOMINAL = 230;

/** A hand-built, frozen observation. */
export function obs(change: Partial<Observation> = {}): Observation {
  return Object.freeze({
    voltage: NOMINAL,
    nominalVolts: NOMINAL,
    soc: 0.3,
    drawing: false,
    pluggedTicks: 0,
    ...change,
  });
}

/** The voltage at a socket with this fractional sag below nominal. */
export const sagged = (sag: number): number => NOMINAL * (1 - sag);
