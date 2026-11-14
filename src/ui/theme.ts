import type { ChargerState, FleetMode } from '../contracts';

/** The neighbourhoods the demo shows, in screen order (SPEC §7). */
export const DISPLAY_MODES: readonly FleetMode[] = ['naive', 'local', 'central'];

export type MarkerShape = 'square' | 'circle' | 'triangle' | 'diamond';

export interface ModeStyle {
  /** Full name used on cards and in the legend. */
  readonly label: string;
  /** Short name drawn next to the curve. */
  readonly short: string;
  /** What the chargers in this neighbourhood do, in one line. */
  readonly blurb: string;
  readonly colour: string;
  /** Canvas line dash. Each curve differs by dash and marker as well as colour. */
  readonly dash: readonly number[];
  readonly width: number;
  readonly marker: MarkerShape;
}

export const MODE_STYLE: Readonly<Record<FleetMode, ModeStyle>> = {
  naive: {
    label: 'Naive chargers',
    short: 'Naive',
    blurb: 'Charge at full power the moment they are plugged in',
    colour: '#ff7a45',
    dash: [],
    width: 3,
    marker: 'square',
  },
  local: {
    label: 'Ours: voltage-sensing chargers',
    short: 'Ours',
    blurb: 'Each backs off when its own socket voltage sags. No server, no messages',
    colour: '#2fe0c9',
    dash: [],
    width: 5,
    marker: 'circle',
  },
  central: {
    label: 'Central scheduler',
    short: 'Scheduled',
    blurb: 'A server sees every charger and switches each one',
    colour: '#c49bff',
    dash: [16, 9],
    width: 4,
    marker: 'triangle',
  },
  stagger: {
    label: 'Random stagger',
    short: 'Stagger',
    blurb: 'Wait a random time after plugging in, then charge',
    colour: '#f2d14a',
    dash: [4, 7],
    width: 3,
    marker: 'diamond',
  },
};

export interface StateStyle {
  readonly label: string;
  readonly colour: string;
  /** Shape of the charger's mark on the street view. */
  readonly shape: 'dot' | 'hollowSquare' | 'triangle' | 'disc' | 'cross';
}

export const STATE_STYLE: Readonly<Record<ChargerState, StateStyle>> = {
  away: { label: 'Away', colour: '#6b7686', shape: 'dot' },
  waiting: { label: 'Plugged in, waiting', colour: '#ff9f43', shape: 'hollowSquare' },
  charging: { label: 'Charging', colour: '#ffe14d', shape: 'triangle' },
  full: { label: 'Full', colour: '#4aa8ff', shape: 'disc' },
  removed: { label: 'Removed', colour: '#ff4d6d', shape: 'cross' },
};

export const STATE_ORDER: readonly ChargerState[] = ['away', 'waiting', 'charging', 'full', 'removed'];

export const COLOURS = {
  bg: '#0b0f17',
  panel: '#141a26',
  grid: '#253043',
  axis: '#a9b4c6',
  text: '#f1f4f9',
  rating: '#ffffff',
  overloadZone: 'rgba(255, 77, 109, 0.12)',
  household: 'rgba(169, 180, 198, 0.22)',
  outage: '#ff4d6d',
} as const;

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
