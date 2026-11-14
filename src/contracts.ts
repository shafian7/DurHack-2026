/**
 * RICKSHAWS shared contracts, baseline 0.1 (14 November 2026).
 *
 * Types only. Meanings, units and tick order live in docs/CONTRACTS.md.
 * Lane A owns this file. Any change is a PR that also updates docs/CONTRACTS.md
 * and every producer and consumer it touches.
 */

// ---------------------------------------------------------------- identities

export type NodeId = number;
export type EdgeId = number;
export type RickshawId = number;
export type PassengerId = number;
export type ChargerId = number;
/** One tick is one simulated second. */
export type Tick = number;

/**
 * Which rule set drives a fleet.
 * - random:     cruise picks a random exit. Lower baseline.
 * - sight:      go to a visible passenger, otherwise random. Ablation.
 * - local:      the emergent rule set (sight + private memory + crowd avoidance).
 * - dispatcher: a central planner with full knowledge assigns every job.
 */
export type FleetMode = 'random' | 'sight' | 'local' | 'dispatcher';

export const METRIC_WINDOW_TICKS = 600;
export const TICKS_PER_MINUTE = 60;

// ----------------------------------------------------------------------- rng

/** Seeded and deterministic. Never call Math.random in sim or policy code. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
}

// ----------------------------------------------------------------------- map

export interface StreetNode {
  readonly id: NodeId;
  /** Position in blocks. */
  readonly x: number;
  readonly y: number;
}

export interface StreetEdge {
  readonly id: EdgeId;
  readonly a: NodeId;
  readonly b: NodeId;
  /** Length in blocks. */
  readonly length: number;
  /** A closed street cannot be entered. Vehicles already on it finish it. */
  readonly closed: boolean;
}

export interface StreetMap {
  readonly nodes: readonly StreetNode[];
  readonly edges: readonly StreetEdge[];
  /** exits[node] lists every edge touching that node, closed ones included. */
  readonly exits: readonly (readonly EdgeId[])[];
}

// ---------------------------------------------------------------- world state

export type PassengerState = 'waiting' | 'riding' | 'delivered' | 'abandoned';

export interface Passenger {
  readonly id: PassengerId;
  readonly origin: NodeId;
  readonly destination: NodeId;
  readonly spawnTick: Tick;
  readonly pickupTick: Tick | null;
  readonly dropTick: Tick | null;
  readonly state: PassengerState;
}

export type RickshawState =
  | 'cruising'
  | 'toPassenger'
  | 'carrying'
  | 'toCharger'
  | 'queuing'
  | 'charging'
  | 'idle'
  | 'flat'
  | 'removed';

export interface RickshawView {
  readonly id: RickshawId;
  readonly state: RickshawState;
  /** Interpolated position in blocks, for drawing. */
  readonly x: number;
  readonly y: number;
  /** The junction it last reached. */
  readonly node: NodeId;
  /** 0 to 1. Always 1 when charging is disabled. */
  readonly battery: number;
  readonly passenger: PassengerId | null;
}

export interface ChargerView {
  readonly id: ChargerId;
  readonly node: NodeId;
  readonly plugs: number;
  readonly online: boolean;
  readonly charging: readonly RickshawId[];
  readonly queue: readonly RickshawId[];
}

/**
 * The whole world. Only the renderer, the metrics, the tests and the
 * dispatcher baseline may read this. Local policies never receive it.
 */
export interface WorldSnapshot {
  readonly tick: Tick;
  readonly mode: FleetMode;
  readonly map: StreetMap;
  readonly rickshaws: readonly RickshawView[];
  /** Waiting passengers only. */
  readonly waiting: readonly Passenger[];
  readonly chargers: readonly ChargerView[];
  readonly dispatcherAlive: boolean;
}

// ------------------------------------------------- what one rickshaw can sense

export interface ExitView {
  readonly edge: EdgeId;
  readonly to: NodeId;
  /** Empty rickshaws within sight whose shortest route from here starts with this exit. */
  readonly emptyRickshawsVisible: number;
  /** Waiting passengers within sight whose shortest route from here starts with this exit. */
  readonly waitingPassengersVisible: number;
}

export interface PassengerSight {
  readonly passenger: PassengerId;
  readonly node: NodeId;
  /** Street distance in blocks. */
  readonly distance: number;
}

export interface ChargerSight {
  readonly charger: ChargerId;
  readonly node: NodeId;
  readonly distance: number;
  readonly online: boolean;
  readonly freePlugs: number;
  readonly queueLength: number;
}

/**
 * Everything a local policy is allowed to know at a decision point.
 * Built by the sim core. Contains nothing beyond config.sightBlocks,
 * apart from knownChargerNodes, which is static map knowledge.
 */
export interface Observation {
  readonly tick: Tick;
  readonly self: {
    readonly id: RickshawId;
    readonly node: NodeId;
    readonly battery: number;
    readonly state: RickshawState;
    /** Ticks spent in the current charger queue, 0 if not queuing. */
    readonly queuedTicks: number;
  };
  /** Open exits from this junction. Closed streets are omitted. */
  readonly exits: readonly ExitView[];
  readonly visiblePassengers: readonly PassengerSight[];
  readonly visibleChargers: readonly ChargerSight[];
  /** The charger at this junction, if there is one. */
  readonly chargerHere: ChargerSight | null;
  /** Where chargers are. Drivers know this the way they know the streets. */
  readonly knownChargerNodes: readonly { readonly charger: ChargerId; readonly node: NodeId; readonly distance: number }[];
}

/** Things that happened to this rickshaw. The only way private memory is fed. */
export type LocalEvent =
  | { readonly kind: 'pickedUp'; readonly node: NodeId; readonly tick: Tick }
  | { readonly kind: 'droppedOff'; readonly node: NodeId; readonly tick: Tick }
  | { readonly kind: 'missedPassenger'; readonly node: NodeId; readonly tick: Tick }
  | { readonly kind: 'chargeStarted'; readonly charger: ChargerId; readonly waitedTicks: number; readonly tick: Tick }
  | { readonly kind: 'chargeFinished'; readonly charger: ChargerId; readonly tick: Tick };

// ------------------------------------------------------------------- policies

export type CruiseAction =
  | { readonly kind: 'exit'; readonly edge: EdgeId }
  | { readonly kind: 'toPassenger'; readonly passenger: PassengerId }
  | { readonly kind: 'wait' };

export type ChargeAction =
  | { readonly kind: 'continue' }
  | { readonly kind: 'toCharger'; readonly charger: ChargerId }
  | { readonly kind: 'joinQueue' }
  | { readonly kind: 'leaveQueue' };

/**
 * Decides where an empty rickshaw goes. M is that rickshaw's private memory.
 * A policy holds no state of its own: everything it remembers is in M.
 */
export interface CruisePolicy<M = unknown> {
  readonly name: string;
  createMemory(rng: Rng): M;
  decide(obs: Observation, memory: M, rng: Rng): CruiseAction;
  onEvent?(event: LocalEvent, memory: M, rng: Rng): void;
}

/** Decides when and where one rickshaw charges. Asked before the cruise policy. */
export interface ChargePolicy<M = unknown> {
  readonly name: string;
  createMemory(rng: Rng): M;
  decide(obs: Observation, memory: M, rng: Rng): ChargeAction;
  onEvent?(event: LocalEvent, memory: M, rng: Rng): void;
}

export type DispatchJob =
  | { readonly kind: 'passenger'; readonly passenger: PassengerId }
  | { readonly kind: 'charger'; readonly charger: ChargerId };

export interface Assignment {
  readonly rickshaw: RickshawId;
  readonly job: DispatchJob;
}

/** The central baseline. The only decision code allowed to read WorldSnapshot. */
export interface Dispatcher {
  readonly name: string;
  plan(world: WorldSnapshot, rng: Rng): readonly Assignment[];
}

// ------------------------------------------------------------- configuration

export interface Hotspot {
  readonly node: NodeId;
  /** Extra passengers per tick originating here. */
  readonly ratePerTick: number;
  readonly fromTick: Tick;
  /** null means until the end. */
  readonly toTick: Tick | null;
}

export interface DemandConfig {
  /** Passengers per tick, origins uniform over all nodes. */
  readonly baseRatePerTick: number;
  readonly hotspots: readonly Hotspot[];
}

export interface ChargingConfig {
  readonly enabled: boolean;
  readonly chargerNodes: readonly NodeId[];
  readonly plugsPerCharger: number;
  /** Battery fraction used per block driven. */
  readonly drainPerBlock: number;
  /** Battery fraction gained per tick on a plug. */
  readonly chargePerTick: number;
  readonly startBatteryMin: number;
  readonly startBatteryMax: number;
  /** A rickshaw unplugs at this level. */
  readonly fullAt: number;
}

export interface SimConfig {
  readonly seed: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly fleetSize: number;
  /** How far a rickshaw can see, in blocks along streets. */
  readonly sightBlocks: number;
  readonly speedBlocksPerTick: number;
  /** A passenger gives up after waiting this long. */
  readonly patienceTicks: number;
  readonly demand: DemandConfig;
  readonly charging: ChargingConfig;
  /** Dispatcher mode only: how often plan() is called. */
  readonly dispatchIntervalTicks: number;
  /** How often a queuing rickshaw is asked whether to stay. */
  readonly queueRecheckTicks: number;
}

// ------------------------------------------------------------ judge commands

/** Applied identically to every fleet being compared. */
export type Command =
  | { readonly kind: 'spawnCrowd'; readonly node: NodeId; readonly count: number }
  | { readonly kind: 'closeRoad'; readonly edge: EdgeId }
  | { readonly kind: 'openRoad'; readonly edge: EdgeId }
  | { readonly kind: 'removeRickshaws'; readonly fraction: number }
  | { readonly kind: 'blindRickshaws'; readonly fraction: number }
  | { readonly kind: 'setCharger'; readonly charger: ChargerId; readonly online: boolean }
  | { readonly kind: 'killDispatcher' }
  | { readonly kind: 'reviveDispatcher' };

// -------------------------------------------------------------------- metrics

export interface Metrics {
  readonly tick: Tick;
  /** Rickshaws that are neither removed nor flat. */
  readonly activeRickshaws: number;
  readonly spawned: number;
  readonly delivered: number;
  readonly abandoned: number;
  readonly waitingNow: number;
  /** Deliveries in the last METRIC_WINDOW_TICKS, per simulated minute. */
  readonly deliveredPerMinute: number;
  /** Mean wait before pickup for passengers picked up in the window. null if none. */
  readonly meanWaitTicks: number | null;
  /** Blocks driven without a passenger divided by all blocks driven, since tick 0. */
  readonly emptyDistanceShare: number;
  /** Mean ticks queued before plugging in, within the window. null when charging is off or none. */
  readonly chargerQueueMeanTicks: number | null;
  /** Rickshaws that have run out of battery, since tick 0. */
  readonly flatCount: number;
}

// ----------------------------------------------------------------- simulation

export interface SimDeps {
  /** Required for random, sight and local modes. */
  readonly cruise?: CruisePolicy;
  /** Required for dispatcher mode. */
  readonly dispatcher?: Dispatcher;
  /** Used when config.charging.enabled. Defaults to a policy that never charges. */
  readonly charge?: ChargePolicy;
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
  /** Merged over the default config. */
  readonly config: Partial<SimConfig>;
  /** Commands replayed at fixed ticks, for experiments and the backup video. */
  readonly script: readonly ScriptedCommand[];
}

// ------------------------------------------------------------------------- ui

export interface AppDeps {
  /** Builds one fleet. The UI calls it once per mode it shows. */
  readonly makeSimulation: (mode: FleetMode, config: SimConfig) => Simulation;
  readonly defaultConfig: SimConfig;
  readonly scenarios: readonly Scenario[];
}

/** Exported by src/ui/index.ts as mountApp. */
export type MountApp = (root: HTMLElement, deps: AppDeps) => void;
