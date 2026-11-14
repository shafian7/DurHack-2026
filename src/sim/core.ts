import {
  HISTORY_TICKS,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  type ChargerAction,
  type ChargerId,
  type ChargerState,
  type ChargerView,
  type Command,
  type CreateSimulation,
  type LocalEvent,
  type Metrics,
  type Observation,
  type Rng,
  type TickSample,
  type WorldSnapshot,
} from '../contracts';
import { baseLoadKw, busVolts, socGainPerTick, socketVolts, tickOfHour } from './physics';
import { createRng, deriveSeed } from './rng';

interface Charger {
  readonly id: ChargerId;
  readonly feeder: number;
  memory: unknown;
  present: boolean;
  removed: boolean;
  stubborn: boolean;
  soc: number;
  voltage: number;
  drawing: boolean;
  arrivedTick: number | null;
  departTick: number | null;
  /** Today's trip home, drawn at the start of each simulated day. */
  nextArriveTick: number | null;
  nextDepartTick: number;
  nextSoc: number;
}

function gaussian(rng: Rng): number {
  const u1 = 1 - rng.next();
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/**
 * The simulation core. Tick order and every rule here are specified in
 * docs/CONTRACTS.md §3 to §7. Three commands are not implemented yet and are
 * ignored: plugInBurst, removeChargers and stubbornChargers.
 */
export const createSimulation: CreateSimulation = (config, mode, deps) => {
  if (mode === 'central' && !deps.scheduler) {
    throw new Error('central mode needs deps.scheduler');
  }
  if (mode !== 'central' && !deps.policy) {
    throw new Error(`${mode} mode needs deps.policy`);
  }
  const policy = deps.policy;
  const scheduler = deps.scheduler;

  // Independent streams. Demand, noise, commands and layout never depend on
  // what the chargers do, so every mode sees the same night (CONTRACTS §1).
  const demandRng = createRng(deriveSeed(config.seed, 0));
  const noiseRng = createRng(deriveSeed(config.seed, 1));
  // Reserved for the commands that pick chargers (removeChargers, stubbornChargers, plugInBurst).
  const commandRng = createRng(deriveSeed(config.seed, 2));
  const layoutRng = createRng(deriveSeed(config.seed, 3));
  const behaviourRng = createRng(deriveSeed(config.seed, 4));
  const sensorRng = createRng(deriveSeed(config.seed, 5));
  void commandRng;

  const { transformer: tx, charger: ch, arrivals } = config;
  const gain = socGainPerTick(ch);

  const chargers: Charger[] = [];
  for (let id = 0; id < config.fleetSize; id += 1) {
    chargers.push({
      id,
      feeder: layoutRng.next(),
      memory: policy ? policy.createMemory(behaviourRng) : null,
      present: false,
      removed: false,
      stubborn: false,
      soc: 0,
      voltage: 0,
      drawing: false,
      arrivedTick: null,
      departTick: null,
      nextArriveTick: null,
      nextDepartTick: 0,
      nextSoc: 0,
    });
  }

  let tick = 0;
  const pending: Command[] = [];

  // Runtime state changed by commands.
  let baseLoadScale = 1;
  let ratingScale = 1;
  let supplyPu = 1;
  let schedulerAlive = true;

  // Transformer state.
  let tripped = false;
  let recloseTick: number | null = null;
  let overloadRun = 0;
  let lastLoadKw = 0;
  let noise = 0;
  let allowed = new Set<ChargerId>();

  // Latest tick's figures, for snapshot() and metrics().
  let nowBaseKw = 0;
  let nowChargerKw = 0;
  let nowLoadKw = 0;
  let nowBusVolts = tx.nominalVolts;
  let nowDrawing = 0;
  let nowPlugged = 0;

  // Totals since tick 0.
  let peakLoadKw = 0;
  let peakLoadShare = 0;
  let overloadTicks = 0;
  let trips = 0;
  let outageTicks = 0;
  let minSocketVolts: number | null = null;
  let departures = 0;
  let readyDepartures = 0;
  let departuresNear = 0;
  let readyNear = 0;
  let departuresFar = 0;
  let readyFar = 0;
  let departureSocSum = 0;
  let energyDeliveredKwh = 0;

  let samples: TickSample[] = [];

  const effectiveRating = (): number => tx.ratingKw * ratingScale;

  const sendEvent = (c: Charger, event: LocalEvent): void => {
    if (!policy?.onEvent) return;
    try {
      policy.onEvent(event, c.memory, behaviourRng);
    } catch {
      // A broken policy never stops a running demo (CONTRACTS §1).
    }
  };

  const drawDay = (dayStart: number): void => {
    const arriveBase = dayStart + tickOfHour(arrivals.arriveMeanHour);
    const departBase = dayStart + tickOfHour(arrivals.departMeanHour);
    for (const c of chargers) {
      // Always three draws per charger, removed or not, so the stream stays aligned.
      const arrive = Math.round(arriveBase + gaussian(demandRng) * arrivals.arriveSdMinutes);
      const depart = Math.round(departBase + gaussian(demandRng) * arrivals.departSdMinutes);
      const soc = arrivals.socMin + demandRng.next() * (arrivals.socMax - arrivals.socMin);
      const lastTick = dayStart + TICKS_PER_DAY - 1;
      c.nextArriveTick = clamp(arrive, dayStart + 1, lastTick - 3 * TICKS_PER_HOUR);
      c.nextDepartTick = clamp(depart, c.nextArriveTick + TICKS_PER_HOUR, lastTick);
      c.nextSoc = clamp(soc, 0, 1);
    }
  };

  const depart = (c: Charger): void => {
    const ready = c.soc >= ch.readyAtSoc;
    departures += 1;
    departureSocSum += c.soc;
    if (ready) readyDepartures += 1;
    if (c.feeder < 0.5) {
      departuresNear += 1;
      if (ready) readyNear += 1;
    } else {
      departuresFar += 1;
      if (ready) readyFar += 1;
    }
    sendEvent(c, { kind: 'unplugged', soc: c.soc });
    c.present = false;
    c.drawing = false;
    c.soc = 0;
    c.voltage = 0;
    c.arrivedTick = null;
    c.departTick = null;
    allowed.delete(c.id);
  };

  const arrive = (c: Charger): void => {
    c.present = true;
    c.drawing = false;
    c.soc = c.nextSoc;
    c.arrivedTick = tick;
    c.departTick = c.nextDepartTick;
    c.nextArriveTick = null;
    sendEvent(c, { kind: 'pluggedIn', soc: c.soc });
  };

  const applyCommand = (command: Command): void => {
    switch (command.kind) {
      case 'setBaseLoadScale':
        if (Number.isFinite(command.scale) && command.scale >= 0) baseLoadScale = command.scale;
        break;
      case 'setRatingScale':
        if (Number.isFinite(command.scale) && command.scale > 0) ratingScale = command.scale;
        break;
      case 'setSupplyVoltage':
        if (Number.isFinite(command.perUnit) && command.perUnit >= 0) supplyPu = command.perUnit;
        break;
      case 'powerCut':
        if (Number.isFinite(command.ticks) && command.ticks >= 1) {
          const until = tick + Math.round(command.ticks);
          tripped = true;
          recloseTick = Math.max(recloseTick ?? 0, until);
          overloadRun = 0;
        }
        break;
      case 'killScheduler':
        schedulerAlive = false;
        break;
      case 'reviveScheduler':
        schedulerAlive = true;
        break;
      case 'plugInBurst':
      case 'removeChargers':
      case 'stubbornChargers':
        // Not implemented yet (B02). Ignored, as an invalid command would be.
        break;
    }
  };

  const stateOf = (c: Charger): ChargerState => {
    if (c.removed) return 'removed';
    if (!c.present) return 'away';
    if (c.soc >= 1) return 'full';
    return c.drawing ? 'charging' : 'waiting';
  };

  const snapshot = (): WorldSnapshot => ({
    tick,
    mode,
    chargers: chargers.map(
      (c): ChargerView => ({
        id: c.id,
        feeder: c.feeder,
        state: stateOf(c),
        soc: c.soc,
        voltage: c.voltage,
        stubborn: c.stubborn,
        arrivedTick: c.arrivedTick,
        departTick: c.departTick,
      }),
    ),
    transformer: {
      ratingKw: effectiveRating(),
      baseLoadKw: nowBaseKw,
      chargerLoadKw: nowChargerKw,
      loadKw: nowLoadKw,
      busVolts: nowBusVolts,
      supplyPu,
      tripped,
      recloseTick,
    },
    schedulerAlive,
  });

  const decide = (c: Charger): ChargerAction => {
    if (c.stubborn) return 'on';
    if (mode === 'central') {
      // A charger with no server falls back to plain charging (DECISIONS D06).
      return !schedulerAlive || allowed.has(c.id) ? 'on' : 'off';
    }
    if (!policy) return 'off';
    const obs: Observation = {
      voltage: c.voltage,
      nominalVolts: tx.nominalVolts,
      soc: c.soc,
      drawing: c.drawing,
      pluggedTicks: tick - (c.arrivedTick ?? tick),
    };
    try {
      return policy.decide(obs, c.memory, behaviourRng) === 'on' ? 'on' : 'off';
    } catch {
      return 'off';
    }
  };

  const step = (): void => {
    // 1. Commands queued since the last tick.
    for (const command of pending.splice(0)) applyCommand(command);

    // 2. Departures, the day's schedule, arrivals.
    for (const c of chargers) {
      if (c.present && c.departTick !== null && tick >= c.departTick) depart(c);
    }
    if (tick % TICKS_PER_DAY === 0) drawDay(tick);
    for (const c of chargers) {
      if (!c.present && !c.removed && c.nextArriveTick !== null && tick >= c.nextArriveTick) arrive(c);
    }

    // 3. Household demand this tick. The wobble is drawn every tick so it is the same in every mode.
    noise = clamp(0.98 * noise + 0.2 * (noiseRng.next() - 0.5), -1, 1);
    nowBaseKw = Math.max(0, baseLoadKw(config.baseLoad, tick) * baseLoadScale * (1 + config.baseLoad.noiseShare * noise));

    // 4. Power returns when an outage ends. Chargers then see the voltage under household load alone.
    if (tripped && recloseTick !== null && tick >= recloseTick) {
      tripped = false;
      recloseTick = null;
      overloadRun = 0;
      lastLoadKw = nowBaseKw;
    }

    // 5. Each charger's socket voltage, from the load one tick ago.
    for (const c of chargers) {
      if (!c.present || c.removed) {
        c.voltage = 0;
        continue;
      }
      // Drawn even during an outage, so the sensor stream does not depend on the mode.
      const reading = gaussian(sensorRng) * tx.sensorNoiseVolts;
      if (tripped) {
        c.voltage = 0;
        continue;
      }
      c.voltage = Math.max(0, socketVolts(tx, lastLoadKw, supplyPu, c.feeder) + reading);
      if (minSocketVolts === null || c.voltage < minSocketVolts) minSocketVolts = c.voltage;
    }

    // 6. Central mode: the scheduler replans.
    if (mode === 'central' && scheduler && schedulerAlive && tick % config.scheduleIntervalTicks === 0) {
      try {
        const plan = scheduler.plan(snapshot(), behaviourRng);
        allowed = new Set(plan.filter((id) => Number.isInteger(id) && id >= 0 && id < chargers.length));
      } catch {
        allowed = new Set();
      }
    }

    // 7. Decisions, in id order.
    nowDrawing = 0;
    nowPlugged = 0;
    for (const c of chargers) {
      if (!c.present || c.removed) {
        c.drawing = false;
        continue;
      }
      nowPlugged += 1;
      if (c.soc >= 1) {
        c.drawing = false;
        continue;
      }
      const wantsPower = decide(c) === 'on';
      c.drawing = wantsPower && !tripped;
      if (c.drawing) nowDrawing += 1;
    }

    // 8. Load, voltage and protection.
    nowChargerKw = nowDrawing * ch.powerKw;
    if (tripped) {
      nowLoadKw = 0;
      nowChargerKw = 0;
      nowBusVolts = 0;
      outageTicks += 1;
    } else {
      nowLoadKw = nowBaseKw + nowChargerKw;
      nowBusVolts = busVolts(tx, nowLoadKw, supplyPu);
      const rating = effectiveRating();
      const share = nowLoadKw / rating;
      if (nowLoadKw > peakLoadKw) peakLoadKw = nowLoadKw;
      if (share > peakLoadShare) peakLoadShare = share;
      if (nowLoadKw > rating) overloadTicks += 1;
      overloadRun = nowLoadKw > rating * tx.tripLoadShare ? overloadRun + 1 : 0;

      // 9. Charging.
      for (const c of chargers) {
        if (c.drawing) c.soc = Math.min(1, c.soc + gain);
      }
      energyDeliveredKwh += nowChargerKw / TICKS_PER_HOUR;
    }
    lastLoadKw = nowLoadKw;

    // 10. History, then protection takes effect from the next tick.
    samples.push({
      tick,
      loadKw: nowLoadKw,
      baseLoadKw: nowBaseKw,
      ratingKw: effectiveRating(),
      plugged: nowPlugged,
      drawing: nowDrawing,
      busVolts: nowBusVolts,
      tripped,
    });
    if (samples.length > 2 * HISTORY_TICKS) samples = samples.slice(-HISTORY_TICKS);

    if (!tripped && overloadRun >= tx.tripAfterTicks) {
      tripped = true;
      trips += 1;
      overloadRun = 0;
      recloseTick = tick + 1 + tx.outageTicks;
      for (const c of chargers) c.drawing = false;
    }

    tick += 1;
  };

  const share = (ready: number, total: number): number | null => (total === 0 ? null : ready / total);

  const metrics = (): Metrics => ({
    tick,
    pluggedNow: nowPlugged,
    drawingNow: nowDrawing,
    loadKw: nowLoadKw,
    loadShare: nowLoadKw / effectiveRating(),
    peakLoadKw,
    peakLoadShare,
    overloadTicks,
    trips,
    outageTicks,
    minSocketVolts,
    departures,
    readyDepartures,
    readyShare: share(readyDepartures, departures),
    readyShareNear: share(readyNear, departuresNear),
    readyShareFar: share(readyFar, departuresFar),
    meanDepartureSoc: departures === 0 ? null : departureSocSum / departures,
    energyDeliveredKwh,
  });

  return {
    config,
    mode,
    get tick() {
      return tick;
    },
    step,
    apply: (command) => {
      pending.push(command);
    },
    snapshot,
    metrics,
    history: () => (samples.length > HISTORY_TICKS ? samples.slice(-HISTORY_TICKS) : samples),
  };
};
