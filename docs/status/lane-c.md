# Lane C status

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
