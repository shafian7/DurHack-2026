import { COLOURS, FONT } from './theme';

/**
 * Projector-first styling: large type, high contrast, nothing that depends on
 * colour alone. Injected once per document so the UI needs no CSS pipeline.
 */
export const CSS = `
.rk-root {
  --bg: ${COLOURS.bg};
  --panel: ${COLOURS.panel};
  --line: ${COLOURS.grid};
  --text: ${COLOURS.text};
  --muted: ${COLOURS.axis};
  --alert: ${COLOURS.outage};
  box-sizing: border-box;
  min-height: 100vh;
  margin: 0;
  padding: 14px 18px 18px;
  background: var(--bg);
  color: var(--text);
  font: 500 18px/1.3 ${FONT};
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rk-root *, .rk-root *::before, .rk-root *::after { box-sizing: inherit; }
.rk-top { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; }
.rk-brand h1 { margin: 0; font-size: 30px; font-weight: 900; letter-spacing: 0.06em; }
.rk-brand p { margin: 0; color: var(--muted); font-size: 17px; }
.rk-clock {
  font: 800 40px/1 ui-monospace, "Cascadia Mono", Consolas, monospace;
  padding: 6px 16px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.rk-spacer { flex: 1 1 auto; }
.rk-chart-wrap { background: var(--panel); border: 2px solid var(--line); border-radius: 12px; padding: 6px; }
.rk-chart { display: block; width: 100%; height: clamp(300px, 46vh, 560px); }
.rk-hoods { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.rk-hood {
  background: var(--panel); border: 3px solid var(--accent); border-radius: 12px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 8px; position: relative;
}
.rk-hood h2 { margin: 0; font-size: 24px; font-weight: 900; color: var(--accent); display: flex; align-items: center; gap: 10px; }
.rk-hood .rk-blurb { margin: 0; color: var(--muted); font-size: 16px; }
.rk-swatch { display: inline-block; width: 18px; height: 18px; flex: none; }
.rk-swatch[data-marker="circle"] { border-radius: 50%; }
.rk-swatch[data-marker="triangle"] { clip-path: polygon(50% 0, 100% 100%, 0 100%); }
.rk-swatch[data-marker="diamond"] { clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.rk-street { display: block; width: 100%; height: 96px; border-radius: 8px; }
@media (max-width: 700px) {
  .rk-root { padding: 10px 16px; font-size: 16px; }
  .rk-clock { font-size: 28px; }
  .rk-brand h1 { font-size: 24px; }
}
`;

export function injectStyles(doc: Document): void {
  if (doc.getElementById('rk-styles')) return;
  const style = doc.createElement('style');
  style.id = 'rk-styles';
  style.textContent = CSS;
  doc.head.append(style);
}
