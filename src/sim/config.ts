import type { SimConfig } from '../contracts';

/**
 * Starting values from CONTRACTS §9. They are rough arithmetic, not data, and
 * have not been calibrated. Returns a fresh object each call.
 */
export function defaultConfig(): SimConfig {
  return {
    seed: 1,
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
      // Index 0 is midnight. Evening peak around 20:00, quiet from 02:00 to 05:00.
      hourlyKw: [55, 50, 48, 46, 46, 50, 62, 75, 80, 78, 76, 78, 82, 80, 78, 78, 82, 92, 104, 112, 114, 110, 96, 72],
      noiseShare: 0.04,
    },
    charger: {
      powerKw: 1.0,
      batteryKwh: 7,
      efficiency: 0.85,
      readyAtSoc: 0.9,
    },
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
