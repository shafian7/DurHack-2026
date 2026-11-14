/**
 * A stand-in Simulation for developing and testing the interface without the
 * real core (BUILD B40). It plays a plausible evening: rickshaws come home,
 * the load climbs past the rating, the transformer trips now and then, and
 * every command has a rough effect. Nothing here is evidence: it is never
 * shown as the real thing and nothing outside src/ui/dev or tests uses it.
 *
 * It follows the formulas of CONTRACTS §2 loosely and keeps its own seeded
 * random streams, so the same seed gives the same night in every mode.
 */
import type {
  ChargerView,
  Command,
  FleetMode,
  Metrics,
  SimConfig,
  Simulation,
  TickSample,
  WorldSnapshot,
} from '../../contracts';
import { HISTORY_TICKS, START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../../contracts';

/** The starting values of CONTRACTS §10, copied so the UI never imports src/sim. */
export function fakeConfig(seed = 1): SimConfig {
  return {
    seed,
    fleetSize: 200,
    transformer: {
      ratingKw: 220,
      nominalVolts: 230,
      sagAtRating: 0.08,
      feederExtraSag: 0.5,
      sensorNoiseVolts: 1,
      tripLoadShare: 1.15,
      tripAfterTicks: 10,
      outageTicks: 30,
    },
    baseLoad: {
      hourlyKw: [55, 50, 48, 46, 46, 50, 62, 75, 80, 78, 76, 78, 82, 80, 78, 78, 82, 92, 104, 112, 114, 110, 96, 72],
      noiseShare: 0.04,
    },
    charger: { powerKw: 1, batteryKwh: 7, efficiency: 0.85, readyAtSoc: 0.9 },
    arrivals: {
      arriveMeanHour: 21.5,
      arriveSdMinutes: 60,
      departMeanHour: 7,
      departSdMinutes: 40,
      socMin: 0.1,
      socMax: 0.5,
    },
    scheduleIntervalTicks: 5,
  };
}

type Stream = () => number;

function stream(seed: number): Stream {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(r: Stream): number {
  const u = 1 - r();
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface FakeCharger {
  readonly id: number;
  readonly feeder: number;
  plugged: boolean;
  soc: number;
  drawing: boolean;
  removed: boolean;
  stubborn: boolean;
  arriveTick: number;
  departTick: number;
  arriveSoc: number;
  arrivedTick: number | null;
  waitUntil: number;
  voltage: number;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function createFakeSimulation(config: SimConfig, mode: FleetMode): Simulation {
  const { transformer: tf, charger: ch, arrivals: arr, baseLoad } = config;
  const arrivals = stream(config.seed * 7919 + 1);
  const layout = stream(config.seed * 7919 + 2);
  const targets = stream(config.seed * 7919 + 3);
  const noise = stream(config.seed * 7919 + 4);
  const behaviour = stream(config.seed * 7919 + 5);

  const chargers: FakeCharger[] = [];
  for (let id = 0; id < config.fleetSize; id++) {
    chargers.push({
      id,
      feeder: layout(),
      plugged: false,
      soc: 0,
      drawing: false,
      removed: false,
      stubborn: false,
      arriveTick: -1,
      departTick: -1,
      arriveSoc: 0,
      arrivedTick: null,
      waitUntil: 0,
      voltage: 0,
    });
  }

  let tick = 0;
  let baseScale = 1;
  let ratingScale = 1;
  let supplyPu = 1;
  let outageLeft = 0;
  let overCounter = 0;
  let prevLoad = 0;
  let schedulerAlive = true;
  let allowed = new Set<number>();
  let queue: Command[] = [];
  const history: TickSample[] = [];
  let last: TickSample | null = null;

  const m = {
    peakLoadKw: 0,
    peakLoadShare: 0,
    overloadTicks: 0,
    trips: 0,
    outageTicks: 0,
    minSocketVolts: null as number | null,
    departures: 0,
    readyDepartures: 0,
    nearDepartures: 0,
    nearReady: 0,
    farDepartures: 0,
    farReady: 0,
    socSum: 0,
    energyDeliveredKwh: 0,
  };

  const rating = () => tf.ratingKw * ratingScale;

  function householdKw(t: number): number {
    const hour = (START_HOUR + t / TICKS_PER_HOUR) % 24;
    const i = Math.floor(hour);
    const f = hour - i;
    const kw = baseLoad.hourlyKw[i % 24]! * (1 - f) + baseLoad.hourlyKw[(i + 1) % 24]! * f;
    const wobble = 0.6 * Math.sin(t / 47 + config.seed) + 0.4 * Math.sin(t / 13);
    return kw * baseScale * (1 + baseLoad.noiseShare * wobble);
  }

  function planDay(day: number): void {
    const start = day * TICKS_PER_DAY;
    for (const c of chargers) {
      let a = start + Math.round((arr.arriveMeanHour - START_HOUR) * 60 + normal(arrivals) * arr.arriveSdMinutes);
      a = Math.min(Math.max(a, start + 1), start + TICKS_PER_DAY - 180);
      let d = start + Math.round((24 + arr.departMeanHour - START_HOUR) * 60 + normal(arrivals) * arr.departSdMinutes);
      d = Math.min(Math.max(d, a + 60), start + TICKS_PER_DAY - 1);
      c.arriveTick = a;
      c.departTick = d;
      c.arriveSoc = arr.socMin + arrivals() * (arr.socMax - arr.socMin);
    }
  }

  function depart(c: FakeCharger): void {
    const ready = c.soc >= ch.readyAtSoc;
    m.departures++;
    m.socSum += c.soc;
    if (ready) m.readyDepartures++;
    if (c.feeder < 0.5) {
      m.nearDepartures++;
      if (ready) m.nearReady++;
    } else {
      m.farDepartures++;
      if (ready) m.farReady++;
    }
    c.plugged = false;
    c.drawing = false;
    c.soc = 0;
    c.arrivedTick = null;
  }

  function plugIn(c: FakeCharger, t: number): void {
    c.plugged = true;
    c.soc = c.arriveSoc;
    c.arrivedTick = t;
    c.waitUntil = mode === 'stagger' ? t + Math.floor(behaviour() * 240) : t;
  }

  function pickFraction(fraction: number): FakeCharger[] {
    const present = chargers.filter((c) => !c.removed);
    const n = Math.round(present.length * fraction);
    const out: FakeCharger[] = [];
    while (out.length < n && present.length > 0) {
      out.push(present.splice(Math.floor(targets() * present.length), 1)[0]!);
    }
    return out;
  }

  function applyNow(cmd: Command): void {
    switch (cmd.kind) {
      case 'setBaseLoadScale':
        if (finite(cmd.scale) && cmd.scale >= 0) baseScale = cmd.scale;
        break;
      case 'setRatingScale':
        if (finite(cmd.scale) && cmd.scale > 0) ratingScale = cmd.scale;
        break;
      case 'setSupplyVoltage':
        if (finite(cmd.perUnit) && cmd.perUnit > 0) supplyPu = cmd.perUnit;
        break;
      case 'powerCut':
        if (finite(cmd.ticks) && cmd.ticks > 0) outageLeft = Math.max(outageLeft, Math.round(cmd.ticks));
        break;
      case 'plugInBurst': {
        if (!finite(cmd.count) || cmd.count < 0) break;
        const away = chargers.filter((c) => !c.removed && !c.plugged && c.arriveTick > tick);
        for (const c of away.slice(0, Math.round(cmd.count))) plugIn(c, tick);
        break;
      }
      case 'removeChargers':
        if (!finite(cmd.fraction) || cmd.fraction < 0 || cmd.fraction > 1) break;
        for (const c of pickFraction(cmd.fraction)) {
          if (c.plugged) depart(c);
          c.removed = true;
        }
        break;
      case 'stubbornChargers':
        if (!finite(cmd.fraction) || cmd.fraction < 0 || cmd.fraction > 1) break;
        for (const c of pickFraction(cmd.fraction)) c.stubborn = true;
        break;
      case 'killScheduler':
        schedulerAlive = false;
        break;
      case 'reviveScheduler':
        schedulerAlive = true;
        break;
    }
  }

  function decide(c: FakeCharger, t: number): boolean {
    if (c.stubborn || mode === 'naive') return true;
    if (mode === 'central') return schedulerAlive ? allowed.has(c.id) : true;
    if (t < c.waitUntil) return false;
    if (mode === 'stagger') return true;
    // local: a rough sketch of backing off on a sagging socket.
    const sagging = c.voltage < tf.nominalVolts * supplyPu * 0.95;
    if (sagging && behaviour() < 0.25 * (0.3 + c.soc)) {
      c.waitUntil = t + 5 + Math.floor(behaviour() * 50 * (0.5 + c.soc));
      return false;
    }
    return true;
  }

  function step(): void {
    const t = tick;
    for (const cmd of queue) applyNow(cmd);
    queue = [];

    for (const c of chargers) if (c.plugged && c.departTick === t) depart(c);
    if (t % TICKS_PER_DAY === 0) planDay(t / TICKS_PER_DAY);
    for (const c of chargers) if (!c.removed && !c.plugged && c.arriveTick === t) plugIn(c, t);

    const base = householdKw(t);
    const tripped = outageLeft > 0;

    for (const c of chargers) {
      if (!c.plugged || tripped) {
        c.voltage = 0;
        continue;
      }
      const sag = tf.sagAtRating * (1 + tf.feederExtraSag * c.feeder) * (prevLoad / tf.ratingKw);
      c.voltage = Math.max(0, tf.nominalVolts * supplyPu * (1 - sag) + normal(noise) * tf.sensorNoiseVolts);
      if (m.minSocketVolts === null || c.voltage < m.minSocketVolts) m.minSocketVolts = c.voltage;
    }

    if (mode === 'central' && schedulerAlive && t % config.scheduleIntervalTicks === 0) {
      const headroom = rating() * 0.95 - base;
      const slots = Math.max(0, Math.floor(headroom / ch.powerKw));
      const perTick = (ch.powerKw * ch.efficiency) / (60 * ch.batteryKwh);
      const slack = (c: FakeCharger) => c.departTick - t - (1 - c.soc) / perTick;
      const queueing = chargers.filter((c) => c.plugged && c.soc < 1).sort((a, b) => slack(a) - slack(b));
      allowed = new Set(queueing.slice(0, slots).map((c) => c.id));
    }

    let drawing = 0;
    let plugged = 0;
    for (const c of chargers) {
      c.drawing = false;
      if (!c.plugged) continue;
      plugged++;
      if (c.soc >= 1 || tripped) continue;
      if (decide(c, t)) {
        c.drawing = true;
        drawing++;
      }
    }

    const load = tripped ? 0 : base + drawing * ch.powerKw;
    const share = load / rating();
    m.peakLoadKw = Math.max(m.peakLoadKw, load);
    m.peakLoadShare = Math.max(m.peakLoadShare, share);
    if (share > 1) m.overloadTicks++;
    overCounter = share > tf.tripLoadShare ? overCounter + 1 : 0;

    for (const c of chargers) {
      if (!c.drawing) continue;
      c.soc = Math.min(1, c.soc + (ch.powerKw * ch.efficiency) / (60 * ch.batteryKwh));
      m.energyDeliveredKwh += ch.powerKw / 60;
    }

    const busVolts = tripped ? 0 : tf.nominalVolts * supplyPu * (1 - (tf.sagAtRating * load) / tf.ratingKw);
    last = { tick: t, loadKw: load, baseLoadKw: base, ratingKw: rating(), plugged, drawing, busVolts, tripped };
    history.push(last);
    if (history.length > HISTORY_TICKS) history.shift();

    if (tripped) {
      outageLeft--;
      m.outageTicks++;
    }
    if (overCounter >= tf.tripAfterTicks) {
      m.trips++;
      overCounter = 0;
      outageLeft = Math.max(outageLeft, tf.outageTicks);
    }
    prevLoad = load;
    tick = t + 1;
  }

  const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

  return {
    config,
    mode,
    get tick() {
      return tick;
    },
    step,
    apply(command: Command) {
      queue.push(command);
    },
    snapshot(): WorldSnapshot {
      const chargerViews: ChargerView[] = chargers.map((c) => ({
        id: c.id,
        feeder: c.feeder,
        state: c.removed ? 'removed' : !c.plugged ? 'away' : c.soc >= 1 ? 'full' : c.drawing ? 'charging' : 'waiting',
        soc: c.plugged ? c.soc : 0,
        voltage: c.voltage,
        stubborn: c.stubborn,
        arrivedTick: c.arrivedTick,
        departTick: c.plugged ? c.departTick : null,
      }));
      const tripped = outageLeft > 0;
      return {
        tick,
        mode,
        chargers: chargerViews,
        transformer: {
          ratingKw: rating(),
          baseLoadKw: last?.baseLoadKw ?? 0,
          chargerLoadKw: (last?.drawing ?? 0) * ch.powerKw,
          loadKw: last?.loadKw ?? 0,
          busVolts: last?.busVolts ?? tf.nominalVolts,
          supplyPu,
          tripped,
          recloseTick: tripped ? tick + outageLeft : null,
        },
        schedulerAlive,
      };
    },
    metrics(): Metrics {
      return {
        tick,
        pluggedNow: last?.plugged ?? 0,
        drawingNow: last?.drawing ?? 0,
        loadKw: last?.loadKw ?? 0,
        loadShare: (last?.loadKw ?? 0) / rating(),
        peakLoadKw: m.peakLoadKw,
        peakLoadShare: m.peakLoadShare,
        overloadTicks: m.overloadTicks,
        trips: m.trips,
        outageTicks: m.outageTicks,
        minSocketVolts: m.minSocketVolts,
        departures: m.departures,
        readyDepartures: m.readyDepartures,
        readyShare: ratio(m.readyDepartures, m.departures),
        readyShareNear: ratio(m.nearReady, m.nearDepartures),
        readyShareFar: ratio(m.farReady, m.farDepartures),
        meanDepartureSoc: ratio(m.socSum, m.departures),
        energyDeliveredKwh: m.energyDeliveredKwh,
      };
    },
    history() {
      return history;
    },
  };
}
