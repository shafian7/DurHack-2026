# RICKSHAWS — chargers that spread their own load

**Baseline:** 0.2 · rewritten Saturday 14 November 2026, about 23:00, during DurHack 2026. It replaces baseline 0.1 (a fleet-dispatch simulation), which was never built.
**Team:** Alex (akurkar07), Shafian (shafian7), Aryan (Aryansaha13414), Aaron (AaronMathew026)
**Builders:** four Claude sessions, one per teammate. Alex's runs on an Ultra plan, the other three on Pro.
**State:** nothing is implemented. The `build` branch holds these documents and `src/contracts.ts`. Every path, command and number below is a plan or a starting value until a lane's status file records evidence for it.

## Start here

Build an interactive browser simulation of one neighbourhood transformer with 200 battery-rickshaw chargers on it. Each charger is a small agent with one input, the voltage at its own socket. When the voltage sags it backs off for a random time, and a nearly empty battery backs off less. There is no server, no app and no registration. Together the chargers are meant to fill the night evenly instead of all spiking around ten in the evening.

The demo shows that neighbourhood next to one with naive chargers and one run by a central scheduler, on the same night, and lets a judge break things. The headline picture is the naive spike beside the self-spread curve.

It is software only. There is no hardware and no ESP32 build.

It is for the Neptune North sponsor track at DurHack 2026, whose brief is many actors, a common goal, independent decisions and resilience when communications fail.

Read only what your task needs:

- [AGENTS.md](../AGENTS.md): the rules every Claude session follows, the emergence invariants and the merge policy. All four read this first.
- [SPEC.md](SPEC.md): the problem, the requirements (R01 to R12), the charger's rules, the architecture and what we claim. All four read §1 to §4.
- [CONTRACTS.md](CONTRACTS.md): what the shared types in [`src/contracts.ts`](../src/contracts.ts) mean, with units, the voltage model, tick order and what each module exports. Read before writing anything that produces or consumes them.
- [BUILD.md](BUILD.md): lanes, file ownership, work items, gates with times, cut order and decisions. Each lane records what it actually did in its own `docs/status/lane-<x>.md`. **Those status files are the only place task state lives.**
- [UI.md](UI.md): what the screen looks like and does. The top-down map MVP. Lane D reads this in full.
- [VALIDATION.md](VALIDATION.md): the tests, the experiment protocol behind the scoreboard, the demo script and the claims ledger.
- [HANDOFFS.md](HANDOFFS.md): the prompt each teammate pastes into their Claude to start.

## How to use this while building

1. Take the next item in your lane in BUILD whose dependencies are met.
2. Read the SPEC, CONTRACTS and VALIDATION sections that item names.
3. Build the smallest complete behaviour with its tests.
4. Merge into `build` through a PR when CI is green, and record real commands and results in your lane's status file.
5. If you are blocked on another lane, use a test double and carry on. Nobody waits.

The first integrated gate is **a naive neighbourhood running headless and in a browser, with its load curve showing the evening spike**. The gate that decides whether the project's claim stands is **the local rule flattening that spike without leaving rickshaws uncharged, in a headless experiment** (BUILD G2).

## Authority

Explicit team decisions override the defaults here. `src/contracts.ts` owns the shape of shared data and CONTRACTS.md owns its meaning. BUILD owns the plan and the decisions, and the lane status files own what has actually been done. VALIDATION owns what counts as evidence. Where two documents disagree, fix both in one PR.

## What is not known yet

- **The rule has never been run.** Whether voltage-sensing chargers flatten the peak in this model is an open question, tested at G2.
- **The model is a sketch.** One transformer, a voltage that falls in proportion to load, identical chargers. The starting numbers in CONTRACTS §10 are rough arithmetic, not data.
- **The real-world figures are unverified.** The idea brief quotes numbers on rickshaw counts, the supply deficit and the cost of illegal charging (SPEC §1). Nobody on the team has opened a source for any of them. Lane D does that before the pitch uses one.
- **The submission deadline is unverified.** Hacking started at 12:00 on Saturday. The plan assumes about 12:00 on Sunday 15 November. A human must check the schedule.
- **Novelty is unchecked.** Nobody has searched Devpost or the literature for similar builds. Voltage- and frequency-responsive charging is an existing research area, so "nobody has done this" is not a claim we can make.
- **`main` cannot be merged without a human.** It requires a pull request with one approving review. All work lands on `build`, and one human approves the release PR at the end.
