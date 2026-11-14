/**
 * Live scoreboard for one neighbourhood (SPEC R09). Every figure is read from
 * metrics() and only rounded for display; nothing is computed here.
 */
import type { Metrics } from '../contracts';
import { el, setText } from './dom';
import { shortDuration } from './time';

export const kw = (v: number): string => `${Math.round(v)} kW`;
export const pct = (share: number | null): string => (share === null ? '—' : `${Math.round(share * 100)}%`);

export interface Tile {
  /** Stable key, set as data-metric on the tile. */
  readonly key: string;
  readonly label: string;
  readonly value: (m: Metrics) => string;
  readonly detail: (m: Metrics) => string;
}

export const TILES: readonly Tile[] = [
  { key: 'load', label: 'Load now', value: (m) => kw(m.loadKw), detail: (m) => `${pct(m.loadShare)} of rating` },
  { key: 'peak', label: 'Peak load', value: (m) => kw(m.peakLoadKw), detail: (m) => `${pct(m.peakLoadShare)} of rating` },
  { key: 'overload', label: 'Over rating', value: (m) => shortDuration(m.overloadTicks), detail: () => '' },
  { key: 'trips', label: 'Trips', value: (m) => String(m.trips), detail: () => '' },
  { key: 'outage', label: 'No power', value: (m) => shortDuration(m.outageTicks), detail: () => '' },
  {
    key: 'ready',
    label: 'Left charged',
    value: (m) => pct(m.readyShare),
    detail: (m) => `near ${pct(m.readyShareNear)} · far ${pct(m.readyShareFar)}`,
  },
  {
    key: 'plugged',
    label: 'Plugged in',
    value: (m) => String(m.pluggedNow),
    detail: (m) => `${m.drawingNow} drawing`,
  },
  {
    key: 'volts',
    label: 'Lowest socket',
    value: (m) => (m.minSocketVolts === null ? '—' : `${Math.round(m.minSocketVolts)} V`),
    detail: () => '',
  },
];

export interface Scoreboard {
  readonly node: HTMLElement;
  update(m: Metrics): void;
}

export function createScoreboard(doc: Document): Scoreboard {
  const parts = TILES.map((tile) => {
    const value = el(doc, 'div', { class: 'rk-value' });
    const detail = el(doc, 'div', { class: 'rk-detail' });
    const node = el(doc, 'div', { class: 'rk-tile', 'data-metric': tile.key }, [
      el(doc, 'div', { class: 'rk-label', text: tile.label }),
      value,
      detail,
    ]);
    return { tile, node, value, detail };
  });
  const node = el(doc, 'div', { class: 'rk-score' }, parts.map((p) => p.node));
  return {
    node,
    update(m) {
      for (const p of parts) {
        setText(p.value, p.tile.value(m));
        setText(p.detail, p.tile.detail(m));
      }
    },
  };
}
