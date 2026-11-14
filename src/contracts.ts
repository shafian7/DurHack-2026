/**
 * RICKSHAWS shared contracts, baseline 0.2 (14 November 2026).
 * "Chargers that spread their own load."
 *
 * Types and constants only. Meanings, units and tick order live in
 * docs/CONTRACTS.md. Lane A owns this file. Any change is a PR that also
 * updates docs/CONTRACTS.md and every producer and consumer it touches.
 */

// ---------------------------------------------------------------- identities

export type ChargerId = number;
/** One tick is one simulated minute. */
export type Tick = number;

export const TICKS_PER_HOUR = 60;
export const TICKS_PER_DAY = 1440;
/** Tick 0 is 12:00 noon, so each simulated day runs noon to noon and the night sits in the middle. */
export const START_HOUR = 12;
/** history() keeps at most this many of the latest ticks (two days). */
export const HISTORY_TICKS = 2880;

/**
 * Which rule set drives a neighbourhood's chargers.
 * - naive:   charge at full power whenever plugged in. The spike. Lower baseline.
 * - stagger: wait a random time after plugging in, then charge. No sensing. Ablation.
 * - local:   the emergent rule set: back off when the socket voltage sags.
 * - central: a scheduler with full knowledge switches every charger. Needs a server.
 */
export type FleetMode = 'naive' | 'stagger' | 'local' | 'central';

// ----------------------------------------------------------------------- rng

/** Seeded and deterministic. Never call Math.random in sim or policy code. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
}

// ------------------------------------------------- what one charger can sense

/**
 * Everything a local charger policy is allowed to know. Built by the sim core.
 * No clock, no id, no neighbour data, no transformer data: nothing may be
 * added without a contract change, because this type is the boundary that
 * makes the behaviour emergent.
 */
export interface Observation {
  /** Volts at this charger's own socket this tick, with sensor noise. 0 during a power cut. */
  readonly voltage: number;
  /** The voltage printed on the charger. A device constant. */
  readonly nominalVolts: number;
  /** State of charge of the battery plugged in, 0 to 1. */
  readonly soc: number;
  /** Whether this charger drew power on the previous tick. */
  readonly drawing: boolean;
  /** Ticks since this rickshaw was plugged in. */
  readonly pluggedTicks: number;
}

export type ChargerAction = 'on' | 'off';

/** Things that happened at this charger. Delivered through onEvent. */
export type LocalEvent =
  | { readonly kind: 'pluggedIn'; readonly soc: number }
  | { readonly kind: 'unplugged'; readonly soc: number };

/**
 * Decides, once per tick while a rickshaw is plugged in and not full, whether
 * this charger draws power. M is this charger's private memory. A policy holds
 * no state of its own: everything it remembers is in M.
 */
export interface ChargerPolicy<M = unknown> {
  readonly name: string;
  createMemory(rng: Rng): M;
  decide(obs: Observation, memory: M, rng: Rng): ChargerAction;
  onEvent?(event: LocalEvent, memory: M, rng: Rng): void;
}

// ---------------------------------------------------------------- world state

export type ChargerState = 'away' | 'waiting' | 'charging' | 'full' | 'removed';

export interface ChargerView {
  readonly id: ChargerId;
  /** Position along the feeder, 0 (at the transformer) to 1 (far end). Further means more sag. */
  readonly feeder: number;
  readonly state: ChargerState;
  /** Battery level of the rickshaw plugged in. 0 when away. */
  readonly soc: number;
  /** Socket voltage this tick. 0 when away or during a power cut. */
  readonly voltage: number;
  /** Ignores its policy or the scheduler and charges whenever plugged in. */
  readonly stubborn: boolean;
  /** When the rickshaw plugged in. null when away. */
  readonly arrivedTick: Tick | null;
  /** When it will leave. null when away. Only the central scheduler may use this. */
  readonly departTick: Tick | null;
}

export interface TransformerView {
  /** Rating after any setRatingScale command, in kW. */
  readonly ratingKw: number;
  /** Household demand this tick, in kW, whether or not it is being served. */
  readonly baseLoadKw: number;
  readonly chargerLoadKw: number;
  /** Power actually flowing this tick. 0 during a power cut. */
  readonly loadKw: number;
  /** Volts at the transformer's busbar. 0 during a power cut. */
  readonly busVolts: number;
  /** Supply voltage as a fraction of nominal, set by setSupplyVoltage. */
  readonly supplyPu: number;
  /** True while the neighbourhood has no power. */
  readonly tripped: boolean;
  /** When power returns. null when energised. */
  readonly recloseTick: Tick | null;
}

/**
 * The whole neighbourhood. Only the renderer, the metrics, the tests and the
 * central scheduler may read this. Local policies never receive it.
 */
export interface WorldSnapshot {
  readonly tick: Tick;
  readonly mode: FleetMode;
  readonly chargers: readonly ChargerView[];
  readonly transformer: TransformerView;
  readonly schedulerAlive: boolean;
}

/** The central baseline. The only decision code allowed to read WorldSnapshot. */
export interface Scheduler {
  readonly name: string;
  /** Returns the chargers allowed to draw until the next plan. */
  plan(world: WorldSnapshot, rng: Rng): readonly ChargerId[];
}

// ------------------------------------------------------------- configuration

export interface TransformerConfig {
  readonly ratingKw: number;
  readonly nominalVolts: number;
  /** Fractional voltage drop at the busbar when load equals ratingKw. */
  readonly sagAtRating: number;
  /** Extra sag at the far end of the feeder, as a multiple of the busbar sag. */
  readonly feederExtraSag: number;
  /** Standard deviation of each charger's voltage reading, in volts. */
  readonly sensorNoiseVolts: number;
  /** Protection trips when load stays above ratingKw times this. */
  readonly tripLoadShare: number;
  /** ...for this many ticks in a row. */
  readonly tripAfterTicks: number;
  /** How long the neighbourhood is dark after a trip. */
  readonly outageTicks: number;
}

export interface BaseLoadConfig {
  /** Household demand in kW at each hour, 24 values, index 0 is midnight. Linearly interpolated. */
  readonly hourlyKw: readonly number[];
  /** Size of the slow random wobble, as a fraction of the load. */
  readonly noiseShare: number;
}

export interface ChargerConfig {
  readonly powerKw: number;
  readonly batteryKwh: number;
  /** Fraction of drawn energy that reaches the battery. */
  readonly efficiency: number;
  /** A rickshaw leaving at or above this level counts as ready. */
  readonly readyAtSoc: number;
}

export interface ArrivalConfig {
  /** Hour of day (0 to 24) around which rickshaws come home. */
  readonly arriveMeanHour: number;
  readonly arriveSdMinutes: number;
  /** Hour of day the next morning around which they leave. */
  readonly departMeanHour: number;
  readonly departSdMinutes: number;
  /** Battery level on arrival is uniform between these. */
  readonly socMin: number;
  readonly socMax: number;
}

export interface SimConfig {
  readonly seed: number;
  /** Chargers on this transformer. One rickshaw each. */
  readonly fleetSize: number;
  readonly transformer: TransformerConfig;
  readonly baseLoad: BaseLoadConfig;
  readonly charger: ChargerConfig;
  readonly arrivals: ArrivalConfig;
  /** Central mode only: how often plan() is called. */
  readonly scheduleIntervalTicks: number;
}

// ------------------------------------------------------------ judge commands

/** Applied identically to every neighbourhood being compared. */
export type Command =
  /** Heatwave: multiply household demand. 1 is normal. */
  | { readonly kind: 'setBaseLoadScale'; readonly scale: number }
  /** Derate the transformer: multiply its rating and trip level. 1 is normal. */
  | { readonly kind: 'setRatingScale'; readonly scale: number }
  /** Grid-wide sag: supply voltage as a fraction of nominal. 1 is normal. */
  | { readonly kind: 'setSupplyVoltage'; readonly perUnit: number }
  /** Load-shedding from upstream: no power for this many ticks. */
  | { readonly kind: 'powerCut'; readonly ticks: number }
  /** Up to count rickshaws that are away come home now. */
  | { readonly kind: 'plugInBurst'; readonly count: number }
  /** That fraction of chargers disappear for good. */
  | { readonly kind: 'removeChargers'; readonly fraction: number }
  /** That fraction of chargers stop listening and charge whenever plugged in. */
  | { readonly kind: 'stubbornChargers'; readonly fraction: number }
  | { readonly kind: 'killScheduler' }
  | { readonly kind: 'reviveScheduler' };

// -------------------------------------------------------------------- metrics

export interface Metrics {
  readonly tick: Tick;
  readonly pluggedNow: number;
  readonly drawingNow: number;
  readonly loadKw: number;
  /** loadKw divided by the current rating. */
  readonly loadShare: number;
  /** Highest one-tick load since tick 0. */
  readonly peakLoadKw: number;
  /** Highest loadShare since tick 0. */
  readonly peakLoadShare: number;
  /** Ticks with load above the rating, since tick 0. */
  readonly overloadTicks: number;
  /** Times the protection tripped, since tick 0. powerCut commands are not counted. */
  readonly trips: number;
  /** Ticks the neighbourhood had no power, since tick 0, trips and power cuts together. */
  readonly outageTicks: number;
  /** Lowest socket voltage seen by a plugged-in charger while energised. null if none yet. */
  readonly minSocketVolts: number | null;
  /** Rickshaws that have left, since tick 0. */
  readonly departures: number;
  /** Of those, how many left at or above readyAtSoc. */
  readonly readyDepartures: number;
  /** readyDepartures divided by departures. null if nobody has left. */
  readonly readyShare: number | null;
  /** Same, for chargers in the near half of the feeder (feeder < 0.5). */
  readonly readyShareNear: number | null;
  /** Same, for chargers in the far half of the feeder. */
  readonly readyShareFar: number | null;
  readonly meanDepartureSoc: number | null;
  /** Energy drawn by chargers from the grid, since tick 0. */
  readonly energyDeliveredKwh: number;
}

/** One point of the load curve. */
export interface TickSample {
  readonly tick: Tick;
  readonly loadKw: number;
  readonly baseLoadKw: number;
  readonly ratingKw: number;
  readonly plugged: number;
  readonly drawing: number;
  readonly busVolts: number;
  readonly tripped: boolean;
}

// ----------------------------------------------------------------- simulation

export interface SimDeps {
  /** Required for naive, stagger and local modes. */
  readonly policy?: ChargerPolicy;
  /** Required for central mode. */
  readonly scheduler?: Scheduler;
}

export interface Simulation {
  readonly config: SimConfig;
  readonly mode: FleetMode;
  readonly tick: Tick;
  /** Advance one tick. */
  step(): void;
  /** Takes effect at the start of the next tick. */
  apply(command: Command): void;
  snapshot(): WorldSnapshot;
  metrics(): Metrics;
  /** One sample per tick already simulated, oldest first, at most HISTORY_TICKS. */
  history(): readonly TickSample[];
}

/** Exported by src/sim/index.ts as createSimulation. */
export type CreateSimulation = (config: SimConfig, mode: FleetMode, deps: SimDeps) => Simulation;

// ------------------------------------------------------------------ scenarios

export interface ScriptedCommand {
  readonly atTick: Tick;
  readonly command: Command;
}

export interface Scenario {
  readonly id: string;
  readonly title: string;
  /** One line a presenter can read out. */
  readonly description: string;
  /** Turns the default config into this scenario's config. Must be pure. */
  readonly configure: (base: SimConfig) => SimConfig;
  /** Commands replayed at fixed ticks, in non-decreasing tick order. */
  readonly script: readonly ScriptedCommand[];
  /** How long an experiment or scripted demo runs. */
  readonly durationTicks: number;
}

// ------------------------------------------------------------------------- ui

export interface AppDeps {
  /** Builds one neighbourhood. The UI calls it once per mode it shows. */
  readonly makeSimulation: (mode: FleetMode, config: SimConfig) => Simulation;
  readonly defaultConfig: SimConfig;
  readonly scenarios: readonly Scenario[];
}

/** Exported by src/ui/index.ts as mountApp. */
export type MountApp = (root: HTMLElement, deps: AppDeps) => void;
