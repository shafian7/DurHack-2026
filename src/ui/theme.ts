/** Colours and type for the map interface. One light, calm palette. */
export const colors = {
  bg: '#f3f1ec',
  panel: '#ffffff',
  ink: '#1d2633',
  muted: '#6b7280',
  faint: '#9aa3ae',
  line: '#e6e2da',

  land: '#f6f4ef',
  building: '#e4e0d7',
  buildingEdge: '#d3cdc1',
  road: '#c9c3b8',
  roadMinor: '#d6d1c7',

  night: 'rgba(36, 48, 82, 0.16)',
  lit: 'rgba(255, 214, 140, 0.5)',
  dark: 'rgba(58, 62, 72, 0.85)',

  ok: '#2f9e6e',
  warn: '#e3a008',
  hot: '#e2553f',
  burst: '#b42318',
  rickshaw: '#1f7a62',
  rickshawAlt: '#2c9b7d',
  charging: '#34b27b',
  full: '#3b82f6',
  waiting: '#a7b0bb',

  naive: '#e2553f',
  local: '#2f7fd8',
} as const;

export const font =
  "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Status colour for a load share or temperature. */
export function loadColor(share: number): string {
  if (share > 1.05) return colors.hot;
  if (share > 0.95) return colors.warn;
  return colors.ok;
}

export function heatColor(celsius: number, burstC: number): string {
  if (celsius >= burstC - 15) return colors.hot;
  if (celsius >= burstC - 35) return colors.warn;
  return colors.ok;
}
