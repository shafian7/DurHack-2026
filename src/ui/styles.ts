import { colors, font } from './theme';

/**
 * A demo, not a dashboard: the two maps fill the screen, the facts float on
 * them as small labels, and the chart and controls open on demand.
 */
export const css = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: ${colors.bg}; color: ${colors.ink}; font-family: ${font}; -webkit-font-smoothing: antialiased; overflow: hidden; }
button { font: inherit; color: inherit; }
.app { display: grid; grid-template-rows: auto 1fr auto auto; gap: 10px; height: 100vh; padding: 12px 14px 14px; }

/* ---------------------------------------------------------------- top bar */
.top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; }
.brand { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.brand h1 { margin: 0; font-size: 17px; letter-spacing: 0.14em; font-weight: 800; }
.brand span { color: ${colors.muted}; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.clock { text-align: center; line-height: 1.05; }
.clock .t { font-size: 30px; font-weight: 750; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.clock .n { font-size: 11.5px; color: ${colors.muted}; text-transform: uppercase; letter-spacing: .14em; font-weight: 600; }
.tools { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
.icon-btn { display: inline-flex; align-items: center; gap: 7px; border: 1px solid ${colors.line}; background: ${colors.panel}; border-radius: 999px; height: 36px; padding: 0 14px; cursor: pointer; font-size: 13px; font-weight: 600; transition: background .15s, border-color .15s, color .15s; white-space: nowrap; }
.icon-btn:hover { border-color: #cfc9be; }
.icon-btn.active { background: ${colors.ink}; color: #fff; border-color: ${colors.ink}; }
.icon-btn svg { width: 15px; height: 15px; }
.play { width: 36px; padding: 0; justify-content: center; background: ${colors.ink}; color: #fff; border-color: ${colors.ink}; }
.seg { display: flex; background: ${colors.panel}; border: 1px solid ${colors.line}; border-radius: 999px; padding: 3px; height: 36px; }
.seg button { white-space: nowrap; border: 0; background: transparent; padding: 0 10px; border-radius: 999px; cursor: pointer; font-size: 12.5px; font-weight: 650; color: ${colors.muted}; }
.seg button.on { background: #ece8e0; color: ${colors.ink}; }

/* ---------------------------------------------------------------- maps */
.maps { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; min-height: 0; }
.panel { position: relative; border-radius: 22px; overflow: hidden; min-height: 0; background: ${colors.land}; box-shadow: 0 1px 2px rgba(20,30,45,.05), 0 10px 30px rgba(20,30,45,.07); transition: box-shadow .4s; }
.panel.alert { box-shadow: 0 0 0 2px rgba(180,35,24,.55), 0 10px 30px rgba(180,35,24,.18); }
.stage { position: absolute; inset: 0; }
.stage canvas { position: absolute; inset: 0; }
.glass { background: rgba(255,255,255,.86); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.7); box-shadow: 0 4px 18px rgba(20,30,45,.10); }
.tag { position: absolute; left: 14px; top: 14px; border-radius: 16px; padding: 10px 14px; max-width: min(66%, 420px); }
.tag h2 { margin: 0; font-size: 19px; font-weight: 750; display: flex; align-items: center; gap: 9px; }
.tag h2 i { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
.tag p { margin: 3px 0 0; color: ${colors.muted}; font-size: 12.5px; line-height: 1.35; }
.state { position: absolute; right: 14px; top: 14px; border-radius: 999px; padding: 8px 14px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.state i { width: 8px; height: 8px; border-radius: 50%; background: ${colors.ok}; box-shadow: 0 0 0 4px rgba(47,158,110,.18); }
.state.bad { background: ${colors.burst}; color: #fff; border-color: ${colors.burst}; }
.state.bad i { background: #fff; box-shadow: 0 0 0 4px rgba(255,255,255,.25); animation: blink 1s infinite; }
.state.warn i { background: ${colors.warn}; box-shadow: 0 0 0 4px rgba(227,160,8,.2); }
@keyframes blink { 50% { opacity: .3; } }
.chips { position: absolute; left: 14px; bottom: 14px; right: 14px; display: flex; gap: 8px; flex-wrap: wrap; pointer-events: none; }
.chip { border-radius: 14px; padding: 7px 12px 8px; min-width: 112px; }
.chip .k { font-size: 10.5px; color: ${colors.muted}; text-transform: uppercase; letter-spacing: .08em; font-weight: 650; white-space: nowrap; }
.chip .v { font-size: 20px; font-weight: 750; font-variant-numeric: tabular-nums; margin-top: 1px; white-space: nowrap; }
.chip .v small { font-size: 12px; color: ${colors.muted}; font-weight: 550; margin-left: 4px; }
.banner { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(.96); background: ${colors.burst}; color: #fff; padding: 14px 20px; border-radius: 16px; font-size: 14px; font-weight: 600; text-align: center; box-shadow: 0 16px 40px rgba(180,35,24,.35); opacity: 0; transition: opacity .35s, transform .35s; pointer-events: none; max-width: 80%; line-height: 1.4; }
.banner b { display: block; font-size: 20px; margin-bottom: 2px; }
.banner.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.banner.ok { background: ${colors.ok}; box-shadow: 0 16px 40px rgba(47,158,110,.3); }
.banner.dark { background: #2b2f38; box-shadow: 0 16px 40px rgba(20,30,45,.35); }
.icon-btn.cut { border-color: #f0b6ab; color: ${colors.burst}; background: #fff6f4; }
.icon-btn.cut:hover { border-color: ${colors.hot}; }
.icon-btn.cut.done { background: ${colors.central}; border-color: ${colors.central}; color: #fff; }
.vs { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3; border-radius: 999px; padding: 7px 12px; font-size: 11px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; color: ${colors.muted}; white-space: nowrap; }

/* ---------------------------------------------------------------- story caption */
.maps.single { grid-template-columns: 1fr; }
.story { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 18px; background: ${colors.panel}; border-radius: 18px; padding: 12px 16px; box-shadow: 0 1px 2px rgba(20,30,45,.05), 0 6px 20px rgba(20,30,45,.06); }
.dots { display: flex; gap: 6px; }
.dot { border: 1px solid ${colors.line}; background: #fff; height: 30px; min-width: 30px; padding: 0 10px; border-radius: 999px; cursor: pointer; font-size: 12.5px; font-weight: 700; color: ${colors.muted}; }
.dot.on { background: ${colors.ink}; color: #fff; border-color: ${colors.ink}; }
.caption { min-width: 0; }
.caption .kicker { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: ${colors.muted}; font-weight: 700; }
.caption .title { font-size: 18px; font-weight: 750; margin-top: 1px; }
.caption .body { font-size: 13px; color: ${colors.muted}; margin-top: 2px; line-height: 1.4; }
.reasons { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; max-width: 380px; }
.reasons span { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: ${colors.muted}; font-weight: 700; margin-right: 2px; }
.reason { border: 1px solid ${colors.line}; background: #fff; border-radius: 999px; padding: 5px 11px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.reason.on { background: #efeafc; border-color: ${colors.central}; color: #4b2fa8; }
.nav { display: flex; gap: 8px; }
.primary-btn { background: ${colors.ink}; color: #fff; border-color: ${colors.ink}; min-width: 84px; justify-content: center; }
.nav .icon-btn { justify-content: center; min-width: 70px; }

/* ---------------------------------------------------------------- sheets */
.sheet { height: 0; margin-top: -10px; padding: 0 18px; border-width: 0; overflow: hidden; border-radius: 22px; display: grid; grid-template-rows: auto 1fr; opacity: 0; pointer-events: none; transition: height .28s ease, margin-top .28s ease, padding .28s ease, opacity .2s; background: ${colors.panel}; box-shadow: 0 1px 2px rgba(20,30,45,.05), 0 10px 30px rgba(20,30,45,.07); }
.sheet.open { height: clamp(170px, 26vh, 250px); margin-top: 0; padding: 14px 18px 12px; opacity: 1; pointer-events: auto; }
.sheet header { display: flex; align-items: center; gap: 16px; margin-bottom: 6px; }
.sheet h3 { margin: 0; font-size: 14px; font-weight: 750; }
.legend { display: flex; gap: 14px; color: ${colors.muted}; font-weight: 550; font-size: 12px; flex-wrap: wrap; }
.legend i { display: inline-block; width: 16px; height: 0; border-top: 2px solid; vertical-align: middle; margin-right: 5px; }
.legend i.d { border-top-style: dashed; }
.close { margin-left: auto; border: 0; background: #f1eee8; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 15px; line-height: 1; color: ${colors.muted}; flex: none; }
.chartbox { position: relative; min-height: 0; }
.chartbox canvas { position: absolute; inset: 0; }

.pop { position: fixed; right: 14px; top: 62px; width: 330px; border-radius: 20px; padding: 14px; opacity: 0; transform: translateY(-8px); pointer-events: none; transition: opacity .2s, transform .2s; z-index: 10; background: rgba(255,255,255,.96); }
.pop.open { opacity: 1; transform: translateY(0); pointer-events: auto; }
.pop header { display: flex; align-items: center; margin-bottom: 10px; }
.pop h3 { margin: 0; font-size: 14px; font-weight: 750; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.act { border: 1px solid ${colors.line}; background: #fff; border-radius: 14px; padding: 10px 11px; text-align: left; cursor: pointer; transition: border-color .15s, background .15s; }
.act:hover { border-color: #cfc9be; background: #fbfaf7; }
.act.on { background: #fff3e0; border-color: #f2c48a; }
.act b { display: block; font-size: 13px; }
.act span { display: block; font-size: 11.5px; color: ${colors.muted}; margin-top: 2px; }
.key { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid ${colors.line}; font-size: 12px; color: ${colors.muted}; }
.key span { display: flex; align-items: center; gap: 7px; }
.sw { width: 10px; height: 10px; display: inline-block; border-radius: 3px; flex: none; }
.note { margin-top: 12px; font-size: 11px; color: ${colors.faint}; line-height: 1.45; }
.socket { position: absolute; right: 14px; top: 62px; width: min(320px, calc(100% - 28px)); border-radius: 16px; padding: 10px 12px 11px; opacity: 0; transform: translateY(-6px); pointer-events: none; transition: opacity .2s, transform .2s; z-index: 2; }
.socket.open { opacity: 1; transform: translateY(0); pointer-events: auto; }
.socket-head { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
.socket-head div { display: grid; gap: 1px; }
.socket-head b { font-size: 14px; font-weight: 750; }
.socket-head span { font-size: 11.5px; color: ${colors.muted}; }
.socket canvas { display: block; }
.socket-facts { display: grid; grid-template-columns: 1.4fr 0.8fr 1fr; gap: 8px; margin-top: 6px; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.socket-facts span { display: grid; gap: 1px; }
.socket-facts small { font-size: 10px; font-weight: 650; color: ${colors.muted}; text-transform: uppercase; letter-spacing: .07em; }
.socket-facts em { font-style: normal; font-weight: 550; font-size: 11px; color: ${colors.muted}; }
.socket-facts i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: 1px; }
.socket-why { margin-top: 7px; font-size: 12.5px; line-height: 1.4; color: ${colors.ink}; }
.film .tools { visibility: hidden; }
.film .story { display: none; }
.film-card { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: ${colors.bg}; opacity: 0; transition: none; padding: 0 12vw; }
.film-card.show { opacity: 1; }
.film-card .eyebrow { font-size: 20px; letter-spacing: .22em; text-transform: uppercase; color: ${colors.muted}; font-weight: 700; }
.film-card h1 { font-size: 76px; line-height: 1.05; margin: 18px 0 0; font-weight: 800; letter-spacing: -0.02em; }
.film-card h2 { font-size: 30px; margin: 22px 0 0; font-weight: 500; color: ${colors.muted}; line-height: 1.35; }
.film-card .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 54px; width: 100%; max-width: 1400px; }
.film-card .stat { background: #fff; border-radius: 26px; padding: 30px 28px; text-align: left; box-shadow: 0 10px 30px rgba(20,30,45,.07); }
.film-card .stat b { display: block; font-size: 54px; font-weight: 800; letter-spacing: -0.02em; }
.film-card .stat span { display: block; font-size: 21px; color: ${colors.ink}; margin-top: 8px; line-height: 1.35; }
.film-card .stat small { display: block; font-size: 15px; color: ${colors.muted}; margin-top: 12px; }
.film-card .note { font-size: 17px; color: ${colors.faint}; margin-top: 36px; }
.film-sub { position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%); z-index: 60; max-width: 1500px; background: rgba(20,24,32,.86); color: #fff; font-size: 27px; line-height: 1.35; font-weight: 550; padding: 12px 24px; border-radius: 14px; text-align: center; opacity: 0; }
.film-sub.show { opacity: 1; }
kbd { font: inherit; font-weight: 650; background: #fff; border: 1px solid ${colors.line}; border-radius: 5px; padding: 0 5px; }

@media (max-width: 1100px) {
  .story { grid-template-columns: 1fr; gap: 10px; }
  .reasons { justify-content: flex-start; max-width: none; }
  html, body { overflow: auto; }
  .app { height: auto; }
  .top { grid-template-columns: 1fr auto; }
  .tools { grid-column: 1 / -1; justify-content: flex-start; flex-wrap: wrap; }
  .maps { grid-template-columns: 1fr; }
  .panel { height: 72vw; min-height: 340px; }
  .vs { display: none; }
  .chip { min-width: 0; }
  .chip .v { font-size: 16px; }
}
`;
