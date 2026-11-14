import type { Scenario } from '../../contracts';
import { TICKS_PER_DAY } from '../../contracts';

/** Stand-in scenarios for the dev page and tests. Lane D's real ones replace these in the app. */
export const devScenarios: readonly Scenario[] = [
  {
    id: 'dev-standard',
    title: 'An ordinary night (dev)',
    description: 'Two hundred rickshaws come home and plug in on one transformer.',
    configure: (base) => base,
    script: [],
    durationTicks: 3 * TICKS_PER_DAY,
  },
  {
    id: 'dev-script',
    title: 'Scripted demo (dev)',
    description: 'A heatwave, a power cut and a dead scheduler at fixed times.',
    configure: (base) => base,
    script: [
      { atTick: 8 * 60, command: { kind: 'setBaseLoadScale', scale: 1.3 } },
      { atTick: 11 * 60, command: { kind: 'powerCut', ticks: 60 } },
      { atTick: 13 * 60, command: { kind: 'killScheduler' } },
    ],
    durationTicks: TICKS_PER_DAY,
  },
];
