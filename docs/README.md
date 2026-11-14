# RICKSHAWS — development documentation

**Baseline:** 0.1 · written Saturday 14 November 2026, about 22:00, during DurHack 2026
**Team:** Alex (akurkar07), Shafian (shafian7), Aryan (Aryansaha13414), Aaron (AaronMathew026)
**Builders:** four Claude sessions, one per teammate. Alex's runs on an Ultra plan, the other three on Pro.
**State:** nothing is implemented. The repository holds a one-line README. Every path, command and number below is a plan or a starting value until [BUILD](BUILD.md) records evidence for it.

## Start here

Build a browser simulation in which a fleet of electric rickshaws serves a city's passengers and shares its chargers with no dispatcher and no messages between vehicles. Each rickshaw follows a few fixed rules using only what it can see and what it remembers. High throughput and staggered charging are meant to emerge at fleet level. The demo shows that fleet next to a random-wander fleet and a centrally dispatched one, and lets a judge break things.

It is for the Neptune North sponsor track at DurHack 2026, whose brief is many actors, a common goal, independent decisions and resilience when communications fail.

Read only what your task needs:

- [AGENTS.md](../AGENTS.md): the rules every Claude session follows, the emergence invariants and the merge policy. All four read this first.
- [SPEC.md](SPEC.md): the problem, the requirements (R01 to R12), the rickshaw's rules, the architecture and what we claim. All four read §1 to §4.
- [CONTRACTS.md](CONTRACTS.md): what the shared types in [`src/contracts.ts`](../src/contracts.ts) mean, with units, tick order and what each module exports. Read before writing anything that produces or consumes them.
- [BUILD.md](BUILD.md): lanes, file ownership, work items, gates with times, cut order and decisions. Each lane records what it actually did in its own `docs/status/lane-<x>.md`. **Those status files are the only place task state lives.**
- [VALIDATION.md](VALIDATION.md): the tests, the experiment protocol behind the scoreboard, the demo script and the claims ledger.
- [HANDOFFS.md](HANDOFFS.md): the prompt each teammate pastes into their Claude to start.

## How to use this while building

1. Take the next item in your lane in BUILD whose dependencies are met.
2. Read the SPEC, CONTRACTS and VALIDATION sections that item names.
3. Build the smallest complete behaviour with its tests.
4. Merge through a PR when CI is green, and record real commands and results in your lane's status file.
5. If you are blocked on another lane, use a test double and carry on. Nobody waits.

The first integrated gate is **rickshaws moving on a street grid, passengers appearing, pickups and drop-offs counted, visible in a browser**. The gate that decides whether the project's claim stands is **the local rules beating random wandering in a headless experiment** (BUILD G2).

## Authority

Explicit team decisions override the defaults here. `src/contracts.ts` owns the shape of shared data and CONTRACTS.md owns its meaning. BUILD owns the plan and the decisions, and the lane status files own what has actually been done. VALIDATION owns what counts as evidence. Where two documents disagree, fix both in one PR.

## What is not known yet

- **The rules have never been run.** Whether they beat random wandering is an open question, tested at G2.
- **The submission deadline is unverified.** Hacking started at 12:00 on Saturday. The plan assumes about 12:00 on Sunday 15 November. A human must check the schedule.
- **Novelty is unchecked.** Nobody has searched Devpost for similar builds.
- **Lane assignments are a proposal.** They come from public GitHub profiles, which show little for some teammates. Swap lanes freely before work starts, then leave them fixed.
- **The research is mostly unverified.** See VALIDATION §6 for which papers were checked.
- **No real-world figures on rickshaws or charging have been looked up.**
