/**
 * Colours and type for the map interface. Night palette: desaturated navy
 * panels that sit apart from the map, warm cream text, and the intro's lamp
 * yellow as the only accent. One red, kept for overload and burst. The map's
 * own colours (land, buildings, roads, lit windows) follow the intro.
 */
export const colors = {
  bg: '#0A0E22',
  panel: '#11162E',
  panelHi: '#182041',
  ink: '#F1ECDD',
  muted: '#A3A8C3',
  faint: '#7F86A8',
  line: '#262E55',

  /** The intro's light: logo, windows, active controls. */
  yellow: '#FFD966',

  land: '#141A44',
  building: '#262C66',
  buildingEdge: '#343C80',
  road: '#4A5196',
  roadMinor: '#323979',

  night: 'rgba(3, 4, 15, 0.38)',
  lit: 'rgba(255, 214, 90, 0.74)',
  dark: 'rgba(4, 5, 14, 0.94)',
  darkEdge: 'rgba(158, 163, 214, 0.28)',

  ok: '#6CCB8F',
  warn: '#F2994A',
  hot: '#E5484D',
  burst: '#E5484D',
  rickshaw: '#F2C94C',
  rickshawAlt: '#FFE39A',
  charging: '#6CCB8F',
  full: '#5AA9FF',
  waiting: '#7E84BE',

  naive: '#C9786B',
  central: '#A78BFA',
  signal: '#A78BFA',
  local: '#5AA9FF',
} as const;

/** Pixel-style text font with normal letter widths, for all text but the wordmark. */
export const font =
  "'Pixelify Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** The intro's pixel font, for the TRICKLE wordmark. */
export const pixelFont = "'Press Start 2P', ui-monospace, 'Courier New', monospace";

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
