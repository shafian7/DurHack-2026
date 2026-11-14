# Lane D status

## Summary (about 23:59 Saturday 14 November; session stopped, not finished)

- **Merged into `build`:** nothing. All five items have PRs with green CI, but this session's local Claude Code permission classifier refused `gh pr merge` ("[Destructive or Unwanted Actions]"). That is not a GitHub refusal, and it was not worked around. The PRs are stacked, each branched from the one before: #8 B60 → #9 B61 → #11 B62 → #12 B63 → #14 B64.
- **Done, awaiting merge:** B60 scenarios (V10 tests), B61 central scheduler (unit tests plus real-core runs: 0 trips in `standard`; demo-3min story checked), B62 sources and pitch script, B64 video shot list and checklist.
- **Not finished:** B63's numbers. `docs/CLAIMS.md` and the Devpost draft are written, but every experiment figure is a marked ⟦GAP⟧, because lane B's `docs/RESULTS.md` (B23, B24) is not on `build`.
- **Figures with a usable source:** BRTA over 60 lakh and 10 to 12 lakh in Dhaka (S1); the Home Minister's Tk 4,000 crore a year in revenue (S3); the government moving to register the vehicles (S4); the BPDB official on night-time demand (part of S5); Ethernet back-off (S6); Chiu and Jain AIMD (S7); Grid Friendly appliances (S10); prior art P1 and P2. **Usable only in corrected form:** 16,059 / 12,388 / 3,671 MW is one PGCB reading at 3 pm on 9 August 2026, not a figure for August (S2). **No usable source:** "night charging overloads local transformers" and "left out of load forecasts" (S5), Jacobson 1988, DESYNC, and every model assumption (battery, charger power, rating, load curve, sag).
- **A human must:** (1) merge #8, #9, #11, #12 and #14 in that order (squash), or allow `gh pr merge` for this Claude session and re-paste the lane D prompt; (2) once lane B's results exist, re-paste the lane D prompt so B63's gaps get filled from RESULTS.md; (3) optionally open the pages listed in SOURCES §5, to rescue the transformer-overload claim; (4) record and upload the backup video, and submit to Devpost (Claude does neither).

## B60 — scenarios

**Files changed:** `src/scenarios/index.ts`, `tests/scenarios/scenarios.test.ts`, `docs/status/lane-d.md`.

**What it is:** `scenarios: readonly Scenario[]` with `standard`, `heatwave`, `load-shedding`, `growth` and `demo-3min`. Also exports `tickAt(day, hour, minute)` (clock time to tick on the noon-to-noon clock), `EXPERIMENT_TICKS` (4,320), `HEATWAVE_SCALE` (1.3) and `GROWTH_FLEET` (300). Imports only from `../contracts`.

- `standard`: default config, no script, 4,320 ticks (the VALIDATION §2 experiment).
- `heatwave`: every hourly household value times 1.3 from tick 0 (the B24 "1.3 times" run), done in `configure` so it is in force from the first tick.
- `load-shedding`: a 60-tick `powerCut` at 23:00 on the second night (tick 2,100), matching the B24 resilience run.
- `growth`: `fleetSize` 300, everything else unchanged.
- `demo-3min`: 2,220 ticks (noon to 01:00 two days later). Heatwave on at 22:45 night one, off at 00:15; 60-tick power cut at 00:45; `killScheduler` at 18:00 on day two (tick 1,800, the same tick as G2 clause 6).

**Commands run:** `npm run typecheck` exit 0; `npm test` exit 0, 5 files, 81 tests passed (34 new in `tests/scenarios/`); `npm run build` exit 0.

**Checks not run:** whether the demo timings tell the story in a real run (naive trips on night one, central trips after the kill). That check needs the scheduler, so it comes with B61.

**Decisions:** V10's "complete config" is checked against our own copy of the CONTRACTS §10 defaults, deep-frozen, so the test does not depend on lane A's config module. "Sensible" command values: scales above 0 (base load up to 3, rating up to 2), supply 0.8 to 1.1 per unit, whole positive tick and count values, fractions 0 to 1.

**Merge:** PR #8 opened, CI green (13 s). **BLOCKED:** the squash merge was not done. `gh pr merge 8 --squash` was refused by this session's local Claude Code permission classifier ("Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Destructive or Unwanted Actions]"). This is not a GitHub refusal. A human must merge PR #8, or allow `gh pr merge` in their Claude settings. B61 is branched from `lane-d/B60-scenarios`, as AGENTS.md says to do.

**What depends on it:** `src/main.ts` (lane A) already picks up `src/scenarios/index.ts` by glob. The UI's scenario picker (lane C) and the experiment script (lane B) read it.

## B61 — the central scheduler

**Files changed:** `src/policies/scheduler.ts`, `tests/scheduler/scheduler.test.ts`, `tests/scheduler/central-run.test.ts`, `tests/scenarios/demo-run.test.ts`, `src/scenarios/index.ts` (demo timings), `tests/scenarios/scenarios.test.ts`, `docs/status/lane-d.md`.

**What it is:** `createScheduler(options?)`, a `Scheduler` named `central`. At each plan: headroom = rating × (1 − 0.03) − household demand − one charger's power for every stubborn plugged-in charger. It switches on up to floor(headroom / charger power) chargers. Rickshaws below the ready level come first, ordered by slack (ticks to departure minus ticks of charging still needed to reach the ready level), then those only topping up, then by id. It skips stubborn, away, full and removed chargers. It does not use the rng, so a plan depends only on the snapshot. A broken snapshot gives an empty plan, never an exception. Imports only from `../contracts`.

**Decisions**

- The snapshot has no charger power, battery size, efficiency or ready level, and the contract gives `createScheduler()` no arguments. The scheduler takes optional `SchedulerOptions` that default to the CONTRACTS §10 values, and it reads charger power from the snapshot (`chargerLoadKw` / chargers in state `charging`) whenever any charger is drawing. None of the lane D scenarios change the charger figures. If a later config does, `src/main.ts` can pass them in.
- A 3% margin under the rating, because a plan holds for `scheduleIntervalTicks` while household demand rises and wobbles.
- **The demo-3min script changed after a real run.** With the power cut at 00:45, naive never tripped again when the power came back (household load is too low by then), so step 4 did not show. The cut is now at 23:00 for 60 ticks, with the heatwave on from 22:30 to 01:00. The kill stays at 18:00 on day two.

**Commands run:** `npm run typecheck` exit 0; `npm test` exit 0, 8 files, 106 tests passed; `npm run build` exit 0.

**Development runs (build at ea94e17 plus this branch, inline always-on policy for naive, seeds 1 to 10).** These check the scheduler and the demo timings. They are not results for the pitch: those come from lane B's experiment script.

- `standard`, central: 0 trips and 0 overloaded ticks in all 10 seeds over three days. Peak 0.971 to 0.972 of the rating. Ready share 0.995 to 1.000.
- `demo-3min`, naive: trips on night one in every seed, and a trip at tick 730 (10 ticks after the power comes back at midnight) in every seed.
- `demo-3min`, central: no trip before the kill at tick 1,800 in any seed. 1 to 4 trips after it in every seed (first between ticks 2,062 and 2,114).

The integration tests check seeds 1 to 3 of these on every CI run.

**Checks not run:** the local rule in the demo (lane B has not landed `local.ts`). Nothing in a browser.

**What depends on it:** `src/main.ts` picks up `createScheduler` by glob for the central neighbourhood. Lane B's experiment uses it for the central mode and for G2 clause 6.

## B62 — sources and pitch

**Files changed:** `docs/SOURCES.md`, `docs/PITCH.md`, `docs/status/lane-d.md`.

**What was done:** searched for each SPEC §1 / VALIDATION §6 figure, opened a source where one could be fetched, and recorded the link, date, exact wording and a verdict. Checked the comparisons from memory. Searched the literature and Devpost for voltage- and frequency-responsive charging. Wrote a three-minute script that follows VALIDATION §4, with every experiment figure left as a marked ⟦GAP⟧.

**Figure verdicts**

- S1, BRTA over 60 lakh, 10 to 12 lakh in Dhaka: **usable**, attributed (UNB via TBS, 8 August 2025). Other official counts differ (50 to 80 lakh).
- S2, 16,059 MW against 12,388 MW, 3,671 MW deficit: **usable with change**. It is a PGCB reading at 3 pm on Sunday 9 August 2026 (The New Nation, 11 August 2026), not a figure for the month. The pitch does not need it.
- S3, Tk 4,000 crore a year: **usable**, as the Home Minister in Parliament on 7 September 2026, revenue loss (The Financial Express, 8 September 2026).
- S4, registration: **usable** as "the government says it is bringing them under registration" (UNB via TBS 2025; State Minister in pv magazine, 21 August 2026). No final gazetted policy found.
- S5, night charging overloads transformers and is left out of forecasts: **not usable as worded.** Only a BPDB official on night-time demand falling less after midnight is usable. The transformer and forecast claims were seen only in pages we could not open.
- Comparisons: Ethernet back-off (S6), Chiu and Jain AIMD (S7) and Grid Friendly appliances (S10) are opened and usable. Jacobson 1988 (S8) and DESYNC (S9) were not opened and are not to be cited.
- Prior art: voltage-dependent EV charging (Marinelli et al. 2016) and AIMD-based decentralised charging (Liu and McLoone 2013) do essentially what our local rule does. The pitch says so. No matching Devpost project found in one search. The nearest is a centralised transformer-aware scheduler simulation (Murmuration, October 2026).
- Model assumptions: none sourced. Unopened snippets put rickshaw batteries at about 4.8 to 6 kWh, against our assumed 7 kWh. That is a note for lane A, not a change made here.

**Commands run:** web searches and page fetches only. Several pages refused the fetch (HTTP 403), and PDFs could not be read (no PDF text tool on this machine). They are listed in SOURCES §5 as not opened. `npm run typecheck` exit 0 and `npm test` exit 0 (106 tests, unchanged: docs only).

**Checks not run:** the script has not been read aloud or timed. Nobody but this session has checked the sources.

**What depends on it:** B63 (CLAIMS.md and the Devpost draft) uses these verdicts. Gaps fill from lane B's `docs/RESULTS.md` (B23, B24).

## B63 — claims and Devpost text (draft with gaps)

**Files changed:** `docs/CLAIMS.md`, `docs/PITCH.md` (Devpost draft section), `docs/status/lane-d.md`.

**What was done:** wrote the claims ledger in the three-way form of VALIDATION §5 (may say / only with evidence / must not say), with each row's evidence and where it stands now. Wrote a Devpost draft with every experiment number as a ⟦GAP⟧.

**Not finished:** B63 depends on B23 for the numbers. When this was written, lane B had not landed `docs/RESULTS.md` or the experiment script. The gaps are marked and unfilled, as the prompt requires. Lane D comes back to fill them if results land before G5.

**Commands run:** `npm run typecheck` exit 0; `npm test` exit 0, 106 tests (docs only).

**What depends on it:** the human who submits to Devpost (G6). Lane B's RESULTS.md fills the gaps.

## B64 — backup video support

**Files changed:** `docs/PITCH.md` (Backup video section), `docs/status/lane-d.md`.

**What was done:** the `demo-3min` command timeline in clock times and ticks, a six-shot list keyed to the simulated clock, a playback-speed note (about 17 ticks per second for 2,220 ticks in about 2 min 10 s), and a recording and upload checklist for a human.

**Commands run:** `npm run typecheck` exit 0; `npm test` exit 0, 106 tests (docs only).

**Checks not run:** whether lane C's UI can play a scenario script and has a speed control. Not checked, because lane D does not read other lanes' code. The checklist covers both cases. No dry run in a browser.

**What depends on it:** the human recording at G6.
