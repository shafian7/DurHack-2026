import { colors, font, pixelFont } from './theme';

/**
 * A demo, not a dashboard: the two maps fill the screen, the facts float on
 * them as small labels, and the chart and controls open on demand.
 * Night theme to match the intro page.
 */
export const css = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: ${colors.bg}; color: ${colors.ink}; font-family: ${font}; -webkit-font-smoothing: antialiased; overflow: hidden; }
button { font: inherit; color: inherit; }
.app { display: grid; grid-template-rows: auto 1fr auto auto; gap: 10px; height: 100vh; padding: 12px 14px 14px; }

/* ---------------------------------------------------------------- top bar */
.top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; }
.brand { display: flex; align-items: baseline; gap: 14px; min-width: 0; }
.brand h1 { margin: 0; font-family: ${pixelFont}; font-weight: 400; font-size: 16px; letter-spacing: .04em; color: ${colors.yellow}; text-shadow: 0 0 14px rgba(255,217,102,.55); white-space: nowrap; }
.brand span { color: ${colors.muted}; font-size: 14px; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.clock { text-align: center; line-height: 1.05; }
.clock .t { font-size: 35px; font-weight: 400; }
.clock .n { font-size: 13px; color: ${colors.muted}; text-transform: uppercase; letter-spacing: .14em; font-weight: 400; margin-top: 7px; }
.tools { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
.icon-btn { --knob: ${colors.panel}; display: inline-flex; align-items: center; gap: 7px; border: 2px solid ${colors.line}; background: ${colors.panel}; border-radius: 4px; height: 36px; padding: 0 14px; cursor: pointer; font-size: 15px; font-weight: 400; transition: background .15s, border-color .15s, color .15s; white-space: nowrap; }
.icon-btn:hover { border-color: ${colors.road}; }
.icon-btn.active { --knob: ${colors.yellow}; background: ${colors.yellow}; color: ${colors.bg}; border-color: ${colors.yellow}; }
.icon-btn svg { width: 15px; height: 15px; }
.play { width: 36px; padding: 0; justify-content: center; background: ${colors.yellow}; color: ${colors.bg}; border-color: ${colors.yellow}; }
.play:hover { border-color: ${colors.ink}; }
.seg { display: flex; background: ${colors.panel}; border: 2px solid ${colors.line}; border-radius: 4px; padding: 3px; height: 36px; }
.seg button { white-space: nowrap; border: 0; background: transparent; padding: 0 10px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 400; color: ${colors.muted}; }
.seg button.on { background: ${colors.building}; color: ${colors.yellow}; }

/* ---------------------------------------------------------------- maps */
.maps { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; min-height: 0; }
.panel { position: relative; border-radius: 6px; overflow: hidden; min-height: 0; background: ${colors.land}; box-shadow: 0 0 0 2px ${colors.line}; transition: box-shadow .4s; }
.panel.alert { box-shadow: 0 0 0 2px ${colors.hot}; }
.stage { position: absolute; inset: 0; }
.stage canvas { position: absolute; inset: 0; }
.glass { background: ${colors.panel}; border: 2px solid ${colors.line}; }
.tag { position: absolute; left: 14px; top: 14px; border-radius: 6px; padding: 10px 14px; max-width: min(66%, 420px); }
.tag h2 { margin: 0; font-size: 21px; font-weight: 400; line-height: 1.3; display: flex; align-items: center; gap: 9px; }
.tag h2 i { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
.tag p { margin: 8px 0 0; color: ${colors.muted}; font-size: 13px; line-height: 1.4; letter-spacing: .03em; }
.state { position: absolute; right: 14px; top: 14px; border-radius: 4px; padding: 8px 14px; font-size: 15px; font-weight: 400; display: flex; align-items: center; gap: 8px; }
.state i { width: 8px; height: 8px; border-radius: 50%; background: ${colors.ok}; }
.state.bad { background: ${colors.burst}; color: #fff; border-color: ${colors.burst}; }
.state.bad i { background: #fff; animation: blink 1s infinite; }
.state.warn i { background: ${colors.warn}; }
@keyframes blink { 50% { opacity: .3; } }
.chips { position: absolute; left: 14px; bottom: 14px; right: 14px; display: flex; gap: 8px; flex-wrap: wrap; pointer-events: none; }
.chip { border-radius: 6px; padding: 7px 12px 8px; min-width: 112px; }
.chip .k { font-size: 11.5px; color: ${colors.muted}; text-transform: uppercase; letter-spacing: .06em; font-weight: 400; white-space: nowrap; }
.chip .v { font-size: 23px; font-weight: 400; margin-top: 7px; white-space: nowrap; }
.chip .v small { font-size: 13px; color: ${colors.muted}; font-weight: 400; margin-left: 4px; }
.banner { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(.96); background: ${colors.burst}; color: #fff; padding: 16px 22px; border-radius: 6px; font-size: 15.5px; font-weight: 400; text-align: center; opacity: 0; transition: opacity .35s, transform .35s; pointer-events: none; max-width: 80%; line-height: 1.4; }
.banner b { display: block; font-size: 23px; font-weight: 400; margin-bottom: 8px; line-height: 1.3; }
.banner.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.banner.ok { background: #2E7D5B; }
.banner.dark { background: ${colors.bg}; border: 2px solid ${colors.line}; }
.icon-btn.cut { border-color: rgba(229,72,77,.55); color: ${colors.hot}; background: rgba(229,72,77,.1); }
.icon-btn.cut:hover { border-color: ${colors.hot}; }
.icon-btn.cut.done { background: ${colors.central}; border-color: ${colors.central}; color: ${colors.bg}; }
.vs { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3; border-radius: 4px; padding: 7px 12px; font-size: 13px; font-weight: 400; letter-spacing: .1em; text-transform: uppercase; color: ${colors.yellow}; white-space: nowrap; }

/* ---------------------------------------------------------------- story caption */
.maps.single { grid-template-columns: 1fr; }
.story { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 18px; background: ${colors.panel}; border-radius: 6px; padding: 12px 16px; box-shadow: 0 0 0 2px ${colors.line}; font-family: ${font}; }
.dots { display: flex; gap: 6px; }
.dot { border: 2px solid ${colors.line}; background: ${colors.panelHi}; height: 30px; min-width: 30px; padding: 0 10px; border-radius: 4px; cursor: pointer; font-size: 15.5px; font-weight: 400; color: ${colors.muted}; }
.dot.on { background: ${colors.yellow}; color: ${colors.bg}; border-color: ${colors.yellow}; }
.caption { min-width: 0; }
.caption .kicker { font-size: 14px; text-transform: uppercase; letter-spacing: .1em; color: ${colors.yellow}; font-weight: 400; line-height: 1.4; }
.caption .title { font-size: 21px; font-weight: 400; margin-top: 7px; line-height: 1.4; }
.caption .body { font-size: 15px; color: ${colors.muted}; margin-top: 7px; line-height: 1.4; letter-spacing: .03em; }
.reasons { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; max-width: 380px; }
.reasons span { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: ${colors.muted}; font-weight: 400; margin-right: 2px; line-height: 1.5; }
.reason { border: 2px solid ${colors.line}; background: ${colors.panelHi}; border-radius: 4px; padding: 7px 11px; font-size: 15px; font-weight: 400; cursor: pointer; }
.reason.on { background: rgba(167,139,250,.18); border-color: ${colors.central}; color: ${colors.ink}; }
.nav { display: flex; gap: 8px; }
.primary-btn { background: ${colors.yellow}; color: ${colors.bg}; border-color: ${colors.yellow}; min-width: 84px; justify-content: center; }
.nav .icon-btn { justify-content: center; min-width: 70px; font-size: 15.5px; font-weight: 400; }

/* ---------------------------------------------------------------- sheets */
.sheet { height: 0; margin-top: -10px; padding: 0 18px; border-width: 0; overflow: hidden; border-radius: 6px; display: grid; grid-template-rows: auto 1fr; opacity: 0; pointer-events: none; transition: height .28s ease, margin-top .28s ease, padding .28s ease, opacity .2s; background: ${colors.panel}; box-shadow: 0 0 0 2px ${colors.line}; }
.sheet.open { height: clamp(170px, 26vh, 250px); margin-top: 0; padding: 14px 18px 12px; opacity: 1; pointer-events: auto; }
.sheet header { display: flex; align-items: center; gap: 16px; margin-bottom: 6px; }
.sheet h3 { margin: 0; font-size: 17px; font-weight: 400; color: ${colors.yellow}; }
.legend { display: flex; gap: 14px; color: ${colors.muted}; font-weight: 400; font-size: 13px; line-height: 1.4; flex-wrap: wrap; }
.legend i { display: inline-block; width: 16px; height: 0; border-top: 2px solid; vertical-align: middle; margin-right: 5px; }
.legend i.d { border-top-style: dashed; }
.close { margin-left: auto; border: 0; background: ${colors.building}; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; font-size: 26.5px; line-height: 1; color: ${colors.muted}; flex: none; }
.close:hover { color: ${colors.ink}; }
.chartbox { position: relative; min-height: 0; }
.chartbox canvas { position: absolute; inset: 0; }

.pop { position: fixed; right: 14px; top: 62px; width: 330px; border-radius: 6px; padding: 14px; opacity: 0; transform: translateY(-8px); pointer-events: none; transition: opacity .2s, transform .2s; z-index: 10; background: ${colors.panel}; }
.pop.open { opacity: 1; transform: translateY(0); pointer-events: auto; }
.pop header { display: flex; align-items: center; margin-bottom: 10px; }
.pop h3 { margin: 0; font-size: 17px; font-weight: 400; color: ${colors.yellow}; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.act { border: 2px solid ${colors.line}; background: ${colors.panelHi}; border-radius: 6px; padding: 10px 11px; text-align: left; cursor: pointer; transition: border-color .15s, background .15s; }
.act:hover { border-color: ${colors.road}; background: ${colors.building}; }
.act.on { background: rgba(255,217,102,.14); border-color: ${colors.yellow}; }
.act b { display: block; font-size: 15px; font-weight: 400; line-height: 1.4; }
.act span { display: block; font-size: 11.5px; color: ${colors.muted}; margin-top: 6px; line-height: 1.4; }
.key { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid ${colors.line}; font-size: 12px; line-height: 1.5; color: ${colors.muted}; }
.key span { display: flex; align-items: center; gap: 7px; }
.sw { width: 10px; height: 10px; display: inline-block; border-radius: 3px; flex: none; }
.note { margin-top: 12px; font-size: 11.5px; color: ${colors.faint}; line-height: 1.4; }
.socket { position: absolute; right: 14px; top: 62px; width: min(320px, calc(100% - 28px)); border-radius: 6px; padding: 10px 12px 11px; opacity: 0; transform: translateY(-6px); pointer-events: none; transition: opacity .2s, transform .2s; z-index: 2; font-family: ${font}; }
.socket.open { opacity: 1; transform: translateY(0); pointer-events: auto; }
.socket-head { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
.socket-head div { display: grid; gap: 5px; }
.socket-head b { font-size: 17.5px; font-weight: 400; color: ${colors.yellow}; line-height: 1.3; }
.socket-head span { font-size: 12px; color: ${colors.muted}; line-height: 1.5; }
.socket canvas { display: block; }
.socket-facts { display: grid; grid-template-columns: 1.4fr 0.8fr 1fr; gap: 8px; margin-top: 8px; font-size: 15.5px; font-weight: 400; line-height: 1.5; }
.socket-facts span { display: grid; gap: 4px; align-content: start; }
.socket-facts small { font-size: 11.5px; font-weight: 400; color: ${colors.muted}; text-transform: uppercase; letter-spacing: .05em; }
.socket-facts em { font-style: normal; font-weight: 400; font-size: 12px; color: ${colors.muted}; }
.socket-facts i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: 0; }
.socket-why { margin-top: 9px; font-size: 13px; line-height: 1.4; letter-spacing: .03em; color: ${colors.ink}; }
.film .tools { visibility: hidden; }
.film .story { display: none; }
.film-card { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: ${colors.bg}; opacity: 0; transition: none; padding: 0 12vw; font-family: ${font}; }
.film-card.show { opacity: 1; }
.film-card .eyebrow { font-size: 24.5px; letter-spacing: .14em; text-transform: uppercase; color: ${colors.muted}; font-weight: 400; }
.film-card h1 { font-size: 73px; line-height: 1.3; margin: 30px 0 0; font-weight: 400; letter-spacing: .02em; color: ${colors.yellow}; }
.film-card h2 { font-size: 27.5px; margin: 30px 0 0; font-weight: 400; color: ${colors.muted}; line-height: 1.4; letter-spacing: .04em; }
.film-card .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 54px; width: 100%; max-width: 1400px; }
.film-card .stat { background: ${colors.panelHi}; border: 1px solid ${colors.line}; border-radius: 6px; padding: 30px 28px; text-align: left; }
.film-card .stat b { display: block; font-size: 56px; font-weight: 400; color: ${colors.yellow}; line-height: 1.2; }
.film-card .stat span { display: block; font-size: 21px; color: ${colors.ink}; margin-top: 16px; line-height: 1.4; }
.film-card .stat small { display: block; font-size: 15.5px; color: ${colors.muted}; margin-top: 14px; line-height: 1.4; }
.film-card .note { font-size: 17.5px; color: ${colors.faint}; margin-top: 40px; line-height: 1.4; }
.film-sub { position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%); z-index: 60; max-width: 1500px; background: rgba(5,6,15,.9); border: 2px solid ${colors.line}; color: ${colors.yellow}; font-family: ${font}; font-size: 27.5px; line-height: 1.4; font-weight: 400; padding: 14px 24px; border-radius: 6px; text-align: center; opacity: 0; }
.film-sub.show { opacity: 1; }
kbd { font: inherit; font-weight: 400; background: ${colors.building}; border: 1px solid ${colors.line}; border-radius: 5px; padding: 0 5px; }

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
  .chip .v { font-size: 19px; }
}
`;
