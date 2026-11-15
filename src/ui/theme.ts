/**
 * Colours and type for the map interface. A night palette taken from the
 * intro page (public/intro.html): deep navy grounds, lavender text and the
 * intro's yellow for light. Status colours are brightened so they read on
 * the dark map.
 */
export const colors = {
  bg: '#0B1230',
  panel: '#13194A',
  panelHi: '#1C2259',
  ink: '#EEF0FF',
  muted: '#9EA3D6',
  faint: '#7E84BE',
  line: '#2A3170',

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

  ok: '#4ADE9A',
  warn: '#F2994A',
  hot: '#FF5A4A',
  burst: '#E5383B',
  rickshaw: '#F2C94C',
  rickshawAlt: '#FFE39A',
  charging: '#4ADE9A',
  full: '#5AA9FF',
  waiting: '#7E84BE',

  naive: '#FF5A4A',
  central: '#A78BFA',
  signal: '#A78BFA',
  local: '#5AA9FF',
} as const;

export const font =
  "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** The intro's pixel font, for the RICKSHAWS wordmark. */
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
