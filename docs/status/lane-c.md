# Lane C status

## Summary (written about 23:20, Saturday 14 November 2026)

**Merged on `build`:** B40 (#10), B41 (#13), B42 (#16), B43 (the PR for `lane-c/B43-projector`). Every lane C item is done. `index.html` loads lane A's `src/main.ts`, which calls `mountApp` with the real core.

**Not done or not checked:**

- Nothing has been checked on a real projector or by a person clicking through. Every visual check used headless Chrome screenshots.
- The frame rate was measured in headless Chrome only (see B43).
- Lane B's policies, lane D's scheduler and lane D's scenarios were not on `build` while this lane ran. Until they land, the app runs lane A's stand-ins (plain charging) and shows lane A's red banner. The scenario picker and "Play script" have been tested only with stand-in scenarios.
- Issue #15: lane A's V04 test runs close to Vitest's 5 s timeout on CI and can fail any lane's PR.

**What a human must do next:**

1. Once lanes B and D have landed, open the built site (`npm run build`, then `npx vite preview`) on the demo laptop and projector. Check the labels from three metres, run `demo-3min` with "Play script" twice without reloading, and record the frame rate, the laptop and the commit (VALIDATION §3).
2. Check that the local and scheduled curves look right with the real policies. The UI only draws what `history()` and `metrics()` return.
3. Press F or "Full screen" for the demo. The layout scales to fit any screen 900 px wide or wider.

## B40 — load curve and neighbourhood on a fake simulation

**Branch:** `lane-c/B40-load-curve` · **State:** PR opened against `build` (see git log for the merge).

**Files changed**

- `index.html`: page shell; a `#app` element and `<script type="module" src="/src/main.ts">`.
- `src/ui/index.ts`: `mountApp`, which calls `createApp` with the animation loop on.
- `src/ui/app.ts`: builds the page, steps every neighbourhood in lockstep (60 ticks per second at 1×, at most 240 per frame), draws the chart and one street per neighbourhood. Catches any error in a frame, stops the loop and says so on screen.
- `src/ui/chart.ts`: the overlaid load curves from `history()`, the rating line (rating read from the samples), the overload zone, household demand, a power-out strip per neighbourhood (hatched), clock labels and judge-action markers. Pure helpers `chartWindow`, `outageSpans`, `niceCeil`, `yMaxFor` are unit-tested.
- `src/ui/street.ts`: one mark per charger at its feeder position; away, waiting, charging, full and removed differ by shape and colour; stubborn chargers get a ring; a tripped neighbourhood is dimmed with POWER OUT.
- `src/ui/canvas.ts`, `dom.ts`, `styles.ts`, `theme.ts`, `time.ts`: helpers, projector-scale styling, colours and shapes per neighbourhood and state, clock (`Night N · HH:MM`, tick 0 is 12:00).
- `src/ui/dev/fakeSimulation.ts`: `createFakeSimulation(config, mode)` implementing `Simulation`, with its own seeded streams (same night in every mode), a rough version of every command, trips and history capped at `HISTORY_TICKS`. `fakeConfig()` copies the CONTRACTS §10 starting values so nothing under `src/ui` imports `src/sim`.
- `src/ui/dev/index.html`, `src/ui/dev/main.ts`, `src/ui/dev/scenarios.ts`: a dev page on the fake simulation at `/src/ui/dev/index.html` under `npm run dev`, with a red "fake simulation" banner and `?skip=N`. Not in the production build.
- `tests/ui/boundary.test.ts` (V08 static), `tests/ui/mount.test.ts` (V08 run-time, jsdom), `tests/ui/chart.test.ts`, `tests/ui/fakeSimulation.test.ts`, `tests/ui/helpers.ts`.

**Commands run (Windows 11, Node v26.13.0)**

- `npm ci`: installed.
- `npm run typecheck`: clean, no output from `tsc --noEmit`.
- `npm test`: `Test Files 8 passed (8)`, `Tests 61 passed (61)` (14 of them lane C's).
- `npm run build`: `dist/index.html 0.43 kB`, `dist/assets/index-BovvtbCy.js 22.32 kB │ gzip: 9.03 kB`, `✓ built in 74ms`.
- `npx vite` then headless Chrome screenshots of `/src/ui/dev/index.html?skip=870` (fake night to 02:37: naive curve crosses the 220 kW rating and trips twice, hatched in the power-out strip) and of `/` (the real core via lane A's `main.ts`, with lane A's banner listing the modules not yet landed). Both rendered without console errors visible on the page.

**Checks not run**

- Frame rate was not measured (B43).
- The page was checked only in headless Chrome at 1920×1080 and 1600×900, not on a projector.

**Decisions**

- The chart window is one simulated day (noon to noon). It fills from the left during the first day, then scrolls.
- The y-axis top is at least 1.6 × the rating, so the scale does not jump as the evening builds.
- The fake simulation's numbers are never shown in the product: `main.ts` (lane A) passes the real core, and the dev page carries a banner.

**Depends on it:** B41 to B43; lane A's `main.ts` already calls `mountApp` and picks it up once this is on `build`.

## B41 — three neighbourhoods and the scoreboard

**Branch:** `lane-c/B41-scoreboard` · **State:** PR opened against `build` (see git log for the merge).

**Files changed**

- `src/ui/scoreboard.ts` (new): eight tiles per neighbourhood, each a pure formatter of `metrics()`: load now (kW and share of rating), peak load (kW and share), minutes over rating, trips, minutes without power, share left charged with near and far, plugged in and drawing, lowest socket voltage. Formatting only rounds; `null` shows as a dash.
- `src/ui/app.ts`: each card now holds a POWER OUT badge (red, ✕ icon, dashed red border) shown while `snapshot().transformer.tripped`, a SCHEDULER OFFLINE badge (striped, ⊘ icon, dotted border) shown on the central card while `snapshot().schedulerAlive` is false, and the scoreboard.
- `src/ui/styles.ts`: tile, badge and state styles; the scoreboard drops to two columns in a narrow card (container query).
- `src/ui/chart.ts`: the rating label sits on a backdrop drawn after the curves; an "OVERLOADED above this line" label in the overload zone.
- `src/ui/time.ts`: `shortDuration` ("4h 45m") for tiles.
- `tests/ui/scoreboard.test.ts` (new): every tile's value and detail equal the formatter applied to that neighbourhood's `metrics()` after a night and a half; POWER OUT shows on every card during a power cut and clears after; SCHEDULER OFFLINE shows only on the central card and clears on revive. `tests/ui/chart.test.ts`: `shortDuration`.

**Commands run (Windows 11, Node v26.13.0)**

- `npm run typecheck`: clean.
- `npm test`: `Test Files 9 passed (9)`, `Tests 65 passed (65)`.
- `npm run build`: `dist/assets/index-ClPLoRmL.js 26.18 kB │ gzip: 10.23 kB`, `✓ built`.
- Headless Chrome screenshots of the dev page at 1920×1080 and 1280×720, night 2 at 22:30. At 1920×1080 the whole page fits without scrolling; at 1280×720 the cards run below the fold (to be handled in B43).

**Checks not run**

- "Readable from three metres" was judged from screenshots only (values 26 px, labels 14 px, card titles 24 px at 1920×1080), not on a projector.

**Decisions**

- Near and far ready shares sit under "Left charged" rather than in a tile of their own, to keep the scoreboard to two rows.
- The lowest socket voltage is shown because it is the one thing our chargers sense; it comes from `metrics().minSocketVolts`.

**Depends on it:** B42 (controls), B43.

**B41 addendum (CI).** The first two CI runs of PR #13 failed: lane A's `tests/sim/core.test.ts > V04 … matches energy to charger-ticks` hit `Error: Test timed out in 5000ms.` (it takes about 2.8 to 3.3 s alone locally). Lane C moved its DOM tests into one jsdom file (`tests/ui/app.test.ts`) and used a 40-charger fleet in UI tests; the third run passed and #13 was merged. Issue #15 asks lane A to raise that test's timeout.

## B42 — judge controls

**Branch:** `lane-c/B42-controls` · **State:** PR opened against `build` (see git log for the merge).

**Files changed**

- `src/ui/controls.ts` (new): the judge panel. Buttons for every command kind, each with `data-cmd="<kind>"` and, where it takes one, `data-value`: heatwave ×1.3 and normal, derate to 80% and full rating, grid sag to 95% and normal, cut power 1 h, 50 home early, make 20% stubborn, remove 10%, kill server and revive. `commandFor` builds the `Command` (null for an unknown kind or a missing value); `commandLabel` gives the chart marker text.
- `src/ui/app.ts`: run bar with pause/play (also the space bar), speeds ¼× to 8× (1× is 60 ticks per second, a day in 24 s), reset, scenario picker (from `deps.scenarios`; its description shows above the chart) and "Play script", which resets, replays the scenario's `script` at each `atTick` and pauses at `durationTicks`. `send()` applies a command to every neighbourhood synchronously, so all receive it on the same tick, and marks it on the chart. The level of each scale command in force is shown pressed.
- `src/ui/styles.ts`: run bar, buttons, judge panel beside the chart (stacks under 1100 px).
- `tests/ui/app.test.ts`: V09 (every command kind has a `data-cmd` control; clicking each sends an identical command to naive, local and central on the same tick, through spy simulations); `commandFor` rejects bad input; pause, speed and reset; the scenario picker rebuilds every neighbourhood from the scenario's config; a script reaches every neighbourhood at its ticks, stops at its duration and replays without a reload.

**Commands run (Windows 11, Node v26.13.0)**

- `npm run typecheck`: clean.
- `npm test`: `Test Files 8 passed (8)`, `Tests 71 passed (71)`.
- `npm run build`: `dist/assets/index-gmgZrDWD.js 34.47 kB │ gzip: 12.73 kB`, `✓ built in 71ms`.
- Headless Chrome screenshot of the dev page at 1920×1080: header, chart, judge panel and three cards fit on one screen without scrolling.

**Checks not run**

- The controls were exercised through tests and a screenshot, not clicked by hand in a browser.
- Lane D's real scenarios are not on `build` yet, so the picker and "Play script" were checked only with the dev and test scenarios.

**Decisions**

- Command values (×1.3, 80%, 95%, 1 h, 50, 20%, 10%) are demo settings chosen to match SPEC §7 and the B24 experiments; they are labels of controls, not results.
- A command is applied at the moment it is clicked, between frames, so every neighbourhood receives it at the same `tick` and it takes effect at the next one (CONTRACTS §7).
- "Play script" stays disabled for a scenario with an empty script.

**Depends on it:** B43; lane D's `demo-3min` scenario plays through "Play script" once it lands.

## B43 — projector pass

**Branch:** `lane-c/B43-projector` · **State:** PR opened against `build` (see git log for the merge).

**Files changed**

- `src/ui/legend.ts` (new): a chart legend (each neighbourhood's line with its dash and marker, the rating line, household demand and the hatched power-out strip) and a street legend (away dot, waiting hollow square, charging triangle, full disc, removed cross, stubborn ring). The icons are inline SVG matching the canvas drawing.
- `src/ui/app.ts`: legends; a "Full screen" button (also the F key) that toggles full screen on the page; fit-to-screen, so the layout is drawn for 1920×1080 and the page is scaled by CSS `zoom = min(width/1920, height/1080)` (between 0.5 and 2) on any window at least 900 px wide. Narrower windows keep the stacked layout.
- `src/ui/styles.ts`: legend styles. The chart is a fixed 470 px in the design size, and stays responsive below 900 px.
- `tests/ui/app.test.ts`: every legend key is present; the full-screen control exists; the zoom matches the window.

**How states differ by more than colour:** curves differ by dash (naive solid thin, ours solid thick, scheduled dashed) and marker (square, circle, triangle), and each has a label at its end. Street marks differ by shape. Outages are hatched. POWER OUT has a ✕ icon and a dashed border. SCHEDULER OFFLINE is striped and has a ⊘ icon and a dotted border.

**Frame rate (measured).** Production build of this branch (`npm run build`, `npx vite preview`) with the real core and lane A's stand-in policies. Headless Chrome on Windows 11 at a 1920×1080 window, with `requestAnimationFrame` intervals timed over 10 s through the DevTools protocol (script kept outside the repo):

| Speed | Frames in 10 s | fps | median frame | 95th percentile | worst |
| --- | --- | --- | --- | --- | --- |
| 8× (about 3 nights in 10 s) | 600 | 60.0 | 16.7 ms | 16.9 ms | 17.9 ms |
| 1× (a night in 24 s) | 566 | 56.6 | 16.7 ms | 33.2 ms | 50.1 ms |
| 4× | 537 | 53.6 | 16.7 ms | 33.4 ms | 33.7 ms |
| 1× (repeat) | 569 | 56.9 | 16.7 ms | 33.1 ms | 50.0 ms |

The first run of the session measured 30.1 fps at 1× (a flat 33.3 ms per frame), then 55.3 fps at 8×. The repeats did not reproduce this, so it looks like headless Chrome warming up rather than load. 8× being the smoothest suggests the occasional missed frame is caused by headless scheduling rather than simulation work. This is not a measurement on the demo laptop.

**Commands run (Windows 11, Node v26.13.0)**

- `npm run typecheck`: clean.
- `npm test`: `Test Files 8 passed (8)`, `Tests 73 passed (73)`.
- `npm run build`: `dist/assets/index-BppLLj4e.js 38.35 kB │ gzip: 13.91 kB`, `✓ built in 61ms`.
- Headless Chrome screenshots of the dev page at 1280×720, 1366×768, 1920×1080 and 2560×1440. All showed the full layout with no scrolling and no clipped text.

**Checks not run:** a real projector, a real full-screen toggle (headless Chrome cannot enter full screen), and frame rate on the demo laptop.

**Depends on it:** lane A's B05 release rehearsal.
