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
.rk-root [hidden] { display: none !important; }
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
  display: flex; flex-direction: column; gap: 8px; position: relative; container-type: inline-size; min-width: 0;
}
.rk-hood h2 { margin: 0; font-size: 24px; font-weight: 900; color: var(--accent); display: flex; align-items: center; gap: 10px; }
.rk-hood .rk-blurb { margin: 0; color: var(--muted); font-size: 16px; }
.rk-swatch { display: inline-block; width: 18px; height: 18px; flex: none; }
.rk-swatch[data-marker="circle"] { border-radius: 50%; }
.rk-swatch[data-marker="triangle"] { clip-path: polygon(50% 0, 100% 100%, 0 100%); }
.rk-swatch[data-marker="diamond"] { clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.rk-street { display: block; width: 100%; height: 84px; border-radius: 8px; }
.rk-hood[data-power="out"] { border-style: dashed; border-color: var(--alert); background: #1d1016; }
.rk-hood[data-scheduler="offline"] { border-style: dotted; border-width: 5px; }
.rk-badge {
  display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-radius: 8px;
  font-weight: 900; font-size: 22px; letter-spacing: 0.04em;
}
.rk-badge-icon { font-size: 26px; line-height: 1; }
.rk-badge-out { background: var(--alert); color: #fff; }
.rk-badge-dead {
  color: #fff; font-size: 19px;
  background: repeating-linear-gradient(135deg, #5b2a86 0 14px, #3d1c5c 14px 28px);
  border: 2px solid #c49bff;
}
.rk-score { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 0; }
.rk-tile { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 8px; min-width: 0; }
.rk-label { color: var(--muted); font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rk-value { font-size: 26px; line-height: 1.15; font-weight: 900; font-variant-numeric: tabular-nums; white-space: nowrap; }
.rk-detail { color: var(--muted); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rk-detail:empty { display: none; }
.rk-tile[data-metric="ready"] .rk-detail { white-space: normal; }
@media (max-width: 1500px) { .rk-value { font-size: 22px; } }
@container (max-width: 520px) { .rk-score { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.rk-tile[data-metric="trips"] .rk-value, .rk-tile[data-metric="outage"] .rk-value { color: #ffb3c1; }
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
