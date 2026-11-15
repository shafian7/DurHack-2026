import { colors, font } from './theme';

export const css = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: ${colors.bg}; color: ${colors.ink}; font-family: ${font}; -webkit-font-smoothing: antialiased; }
button { font: inherit; color: inherit; }
.app { display: grid; grid-template-rows: auto 1fr auto; gap: 14px; height: 100vh; padding: 16px 20px 18px; }

.top { display: flex; align-items: center; gap: 18px; }
.brand { display: flex; align-items: baseline; gap: 10px; }
.brand h1 { margin: 0; font-size: 19px; letter-spacing: 0.06em; font-weight: 750; }
.brand span { color: ${colors.muted}; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.brand { min-width: 0; }
.clock { margin-left: auto; white-space: nowrap; font-variant-numeric: tabular-nums; font-size: 15px; font-weight: 600; background: ${colors.panel}; border: 1px solid ${colors.line}; border-radius: 999px; padding: 7px 14px; }
.clock small { color: ${colors.muted}; font-weight: 500; margin-right: 6px; }
.seg { display: flex; background: ${colors.panel}; border: 1px solid ${colors.line}; border-radius: 999px; padding: 3px; }
.seg button { white-space: nowrap; border: 0; background: transparent; padding: 5px 11px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 600; color: ${colors.muted}; }
.seg button.on { background: ${colors.ink}; color: #fff; }
.btn { border: 1px solid ${colors.line}; background: ${colors.panel}; border-radius: 999px; padding: 7px 14px; cursor: pointer; font-size: 13px; font-weight: 600; transition: background .15s, border-color .15s; }
.btn:hover { border-color: #cfc9be; background: #fbfaf7; }
.btn.on { background: #fff3e0; border-color: #f2c48a; color: #8a4b08; }
.btn.primary { background: ${colors.ink}; color: #fff; border-color: ${colors.ink}; min-width: 86px; }

.maps { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; min-height: 0; }
.panel { position: relative; background: ${colors.panel}; border: 1px solid ${colors.line}; border-radius: 16px; display: grid; grid-template-rows: auto 1fr auto; min-height: 0; overflow: hidden; box-shadow: 0 1px 2px rgba(20,30,45,.04), 0 6px 24px rgba(20,30,45,.05); }
.panel header { display: flex; align-items: center; gap: 10px; padding: 12px 16px 10px; }
.panel header .dot { width: 10px; height: 10px; border-radius: 50%; }
.panel header h2 { margin: 0; font-size: 15.5px; font-weight: 700; }
.panel header p { margin: 0; color: ${colors.muted}; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.panel header .titles { min-width: 0; }
.panel header .titles { display: grid; gap: 1px; }
.stage { position: relative; min-height: 0; }
.stage canvas { position: absolute; inset: 0; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid ${colors.line}; }
.stat { padding: 9px 14px 10px; border-right: 1px solid ${colors.line}; }
.stat:last-child { border-right: 0; }
.stat .k { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px; color: ${colors.muted}; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
.stat .v { font-size: 19px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 2px; }
.stat .v small { font-size: 12px; color: ${colors.muted}; font-weight: 500; margin-left: 4px; }

.banner { position: absolute; left: 50%; top: 58px; transform: translateX(-50%); background: ${colors.burst}; color: #fff; padding: 9px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 600; box-shadow: 0 8px 24px rgba(180,35,24,.3); white-space: nowrap; opacity: 0; transition: opacity .35s; pointer-events: none; z-index: 2; }
.banner.show { opacity: 1; }
.banner.ok { background: ${colors.ok}; box-shadow: 0 8px 24px rgba(47,158,110,.25); }

.bottom { display: grid; grid-template-columns: 1fr 340px; gap: 14px; height: clamp(140px, 18vh, 190px); }
.card { background: ${colors.panel}; border: 1px solid ${colors.line}; border-radius: 16px; padding: 12px 14px; min-height: 0; display: grid; grid-template-rows: auto 1fr; box-shadow: 0 1px 2px rgba(20,30,45,.04); }
.card h3 { margin: 0 0 6px; font-size: 13px; font-weight: 700; display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
.legend { display: flex; gap: 12px; color: ${colors.muted}; font-weight: 500; font-size: 12px; }
.legend i { display: inline-block; width: 16px; height: 0; border-top: 2px solid; vertical-align: middle; margin-right: 5px; }
.legend i.d { border-top-style: dashed; }
.chartbox { position: relative; min-height: 0; }
.chartbox canvas { position: absolute; inset: 0; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-content: start; }
.actions .btn { border-radius: 10px; padding: 7px 10px; text-align: left; }
.actions .btn b { display: block; font-size: 13px; }
.actions .btn span { display: block; font-size: 11.5px; color: ${colors.muted}; font-weight: 500; margin-top: 1px; }
.note { grid-column: 1 / -1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 10.5px; color: ${colors.faint}; line-height: 1.4; margin-top: 2px; }

.keyrow { display: flex; gap: 14px; align-items: center; padding: 0 16px 8px; color: ${colors.muted}; font-size: 11.5px; flex-wrap: wrap; }
.keyrow span { display: inline-flex; align-items: center; gap: 5px; }
.sw { width: 9px; height: 9px; display: inline-block; border-radius: 2px; }

@media (max-width: 1100px) {
  .app { height: auto; }
  .maps { grid-template-columns: 1fr; }
  .stage { height: 62vw; }
  .bottom { grid-template-columns: 1fr; height: auto; }
  .chartbox { height: 160px; }
  .stats { grid-template-columns: repeat(2, 1fr); }
}
`;
