import type { ChargePolicy } from '../contracts';

/** Never charges. The default when no charge policy is supplied. */
export const noChargePolicy: ChargePolicy<null> = {
  name: 'none',
  createMemory: () => null,
  decide: () => ({ kind: 'continue' }),
};
