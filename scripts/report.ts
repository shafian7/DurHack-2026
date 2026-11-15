/**
 * Builds docs/RESULTS.md from experiment runs (lane B, B22 to B24). Pure apart
 * from the runs themselves: the commit is passed in, so the same arguments give
 * the same text (V07).
 */
import type { Scenario, SimConfig } from '../src/contracts';
import { defaultConfig } from '../src/sim';
import { standard, tickAt } from '../src/scenarios';
import { LOCAL_PARAMS } from '../src/policies/local';
import { MAX_DELAY_TICKS } from '../src/policies/stagger';
import { districtSection } from './district';
import {
  formatPerSeed,
  formatTable,
  judge,
  runExperiment,
  type ExperimentResult,
  type Variant,
  WARMUP_TICKS,
} from './runner';

/** Scheduler killed at tick 1,800, 18:00 on the second day (VALIDATION §2 clause 6). */
export const KILL_TICK = 1800;

export const KILLED: Variant = {
  id: 'scheduler-killed',
  title: 'Scheduler killed at tick 1,800 (18:00, second day)',
  commands: [{ atTick: KILL_TICK, command: { kind: 'killScheduler' } }],
};

/** The B24 resilience variants (VALIDATION §2). */
export const RESILIENCE: readonly Variant[] = [
  KILLED,
  ...[0.1, 0.2, 0.4].map(
    (fraction): Variant => ({
      id: `stubborn-${Math.round(fraction * 100)}`,
      title: `${Math.round(fraction * 100)}% stubborn chargers from tick 0`,
      commands: [{ atTick: 0, command: { kind: 'stubbornChargers', fraction } }],
    }),
  ),
  {
    id: 'power-cut',
    title: '60-minute power cut at 23:00 on the second day',
    commands: [{ atTick: tickAt(1, 23), command: { kind: 'powerCut', ticks: 60 } }],
  },
  {
    id: 'heatwave',
    title: 'Household load at 1.3 times from tick 0',
    commands: [{ atTick: 0, command: { kind: 'setBaseLoadScale', scale: 1.3 } }],
  },
];

export interface ReportOptions {
  readonly commit: string;
  readonly seeds: readonly number[];
  readonly scenario?: Scenario;
  /** Include the B24 resilience tables. */
  readonly resilience?: boolean;
  /** Include the two-transformer Dhanmondi district table. */
  readonly district?: boolean;
}

function configBlock(config: SimConfig): string {
  return ['```json', JSON.stringify(config, null, 2), '```'].join('\n');
}

function section(result: ExperimentResult): string {
  return [`### ${result.variant.title}`, '', formatTable(result)].join('\n');
}

export function buildReport(options: ReportOptions): string {
  const scenario = options.scenario ?? standard;
  const seeds = options.seeds;
  const main = runExperiment(scenario, seeds);
  const killed = runExperiment(scenario, seeds, KILLED);
  const verdicts = judge(main, killed);
  const seedText = seeds.length > 1 && seeds.every((s, i) => i === 0 || s === seeds[i - 1] + 1)
    ? `${seeds[0]} to ${seeds[seeds.length - 1]}`
    : seeds.join(', ');

  const out: string[] = [
    '# Results',
    '',
    '_Written by `npm run experiment` (scripts/experiment.ts). Do not edit by hand (VALIDATION §2)._',
    '',
    `- **Commit:** \`${options.commit}\``,
    `- **Scenario:** \`${scenario.id}\` (${scenario.title}), ${scenario.durationTicks} ticks per run`,
    `- **Seeds:** ${seedText}`,
    `- **Warm-up:** the first ${WARMUP_TICKS} ticks (one day) are excluded; ${((scenario.durationTicks - WARMUP_TICKS) / 1440).toFixed(0)} nights are measured`,
    '- **Modes:** naive, stagger, local, central',
    '',
    'Peak is the highest one-tick load over the measured nights as a share of the rating, averaged over seeds. Per-night figures are averaged over the measured nights and then over seeds. Ready shares count rickshaws that left at or above `readyAtSoc` during the measured nights; near and far are the halves of the feeder. Lowest socket V is the lowest reading at any plugged-in charger while energised, over all seeds.',
    '',
    '## Standard experiment',
    '',
    formatTable(main),
    '',
    '## The claim, clause by clause (VALIDATION §2)',
    '',
    '| # | Clause | Verdict | Detail |',
    '| --- | --- | --- | --- |',
    ...verdicts.map((v) => `| ${v.clause} | ${v.text} | ${v.pass ? 'PASS' : 'FAIL'} | ${v.detail} |`),
    '',
    `Clause 6 is judged on central mode with the scheduler killed at tick ${KILL_TICK}. The local chargers are unaffected by \`killScheduler\` by construction, because they never had a scheduler.`,
    '',
  ];

  if (options.district) out.push(districtSection(seeds), '');

  if (options.resilience) {
    out.push('## Resilience experiments (B24)', '', 'No thresholds are set for these (VALIDATION §2). They are reported as they are.', '');
    for (const variant of RESILIENCE) {
      const result = variant.id === KILLED.id ? killed : runExperiment(scenario, seeds, variant);
      out.push(section(result), '');
    }
  }

  out.push(
    '## Per seed, standard experiment',
    '',
    formatPerSeed(main),
    '',
    '## Configuration',
    '',
    `Simulation config for seed ${seeds[0]} (the seed field is replaced per run):`,
    '',
    configBlock(scenario.configure({ ...defaultConfig(), seed: seeds[0] })),
    '',
    'Local rule constants (`src/policies/local.ts`):',
    '',
    configBlock(LOCAL_PARAMS as unknown as SimConfig),
    '',
    `Stagger delay: uniform over [0, ${MAX_DELAY_TICKS}) ticks. Central scheduler: \`createScheduler()\` defaults.`,
    '',
  );
  return out.join('\n');
}
