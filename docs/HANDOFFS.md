# Handoffs — the prompt each teammate runs

**Status:** prepared about 22:00 on Saturday 14 November 2026 for unattended ("auto") runs. Nothing has been run. These prompts start work; they are not a record of it.

## Before anyone starts (humans, about five minutes)

1. Alex commits this pack to `main` of `shafian7/DurHack-2026` (`AGENTS.md`, `docs/` and `src/contracts.ts`), and Shafian confirms all four teammates can push.
2. Everyone agrees the lane table in [BUILD §2](BUILD.md), or swaps lanes now.
3. Someone checks the real submission deadline and tells the team.
4. Each person opens their Claude where it can clone the repository, run Node and push, turns on whatever auto-approve setting their app has, and pastes their prompt.

Each prompt runs the whole lane from start to finish without asking anything. If a session stops early for any reason, paste the same prompt again: it tells Claude to find where the lane got to and carry on from there.

## A. Alex — core and integration (Ultra)

```text
You are running lane A of RICKSHAWS in the GitHub repository shafian7/DurHack-2026, unattended, during a hackathon that ends about midday on Sunday 15 November 2026. Nobody is watching this session. Do not ask questions or wait for approval: when something is unclear, take the most reasonable reading, note it in the PR description, and keep going.

Setup: clone the repository if it is not already here, fetch origin and start from a fresh origin/main.

Read, in this order: AGENTS.md, docs/README.md, docs/BUILD.md (sections 1, 2, 4, 5 and the lane A items) and src/contracts.ts in full. Read the docs/CONTRACTS.md and docs/VALIDATION.md sections each item names when you reach it.

Resume check: read docs/status/lane-a.md if it exists, plus git log and the open PRs, and start at the first lane A item that is not finished.

Work through every lane A item in order without stopping: B00, B01, B02, B03, B04, B05. B00 is urgent because three other Claude sessions need the scaffold, so land it first and keep it small. For each item: branch lane-a/<item>-<slug> from fresh origin/main, build it with its tests, run npm run typecheck, npm test and npm run build, open a PR, squash-merge it yourself once CI is green, add an entry to docs/status/lane-a.md (files changed, commands run and their real output, checks not run, what depends on it), then go straight to the next item.

You own: package.json and config files, .github/, src/contracts.ts, src/sim/**, src/main.ts, tests/sim/**, the docs listed for lane A in BUILD section 2, and docs/status/lane-a.md. Do not edit files under other lanes' paths.

You also own integration. Each time you finish an item, fetch origin/main and wire any newly landed modules from other lanes into src/main.ts. If two lanes disagree about a contract, fix it with one PR that changes src/contracts.ts, docs/CONTRACTS.md and both sides. If main is red, fix that before anything else.

Rules that matter most: all randomness through the seeded Rng; policies only ever receive an Observation; no LLM calls anywhere in the product; no numbers that did not come from a run. If an item is truly blocked, open an issue whose title starts with BLOCKED:, then move to the next item and come back later.

Stop only when every lane A item is merged, or at the gate G5 feature freeze (09:00 Sunday). Finish by writing a short summary at the top of docs/status/lane-a.md: what is merged, what is not, and what a human must do next.
```

## B. Shafian — policies and experiments (Pro)

```text
You are running lane B of RICKSHAWS in the GitHub repository shafian7/DurHack-2026, unattended, during a hackathon that ends about midday on Sunday 15 November 2026. Nobody is watching this session. Do not ask questions or wait for approval: when something is unclear, take the most reasonable reading, note it in the PR description, and keep going. This lane holds the rules that the project's whole claim rests on.

Setup: clone the repository if it is not already here, fetch origin and start from a fresh origin/main.

Read, in this order: AGENTS.md, the lane B items in docs/BUILD.md section 3 plus sections 4 and 5, src/contracts.ts in full, docs/SPEC.md sections 2 and 5, docs/CONTRACTS.md sections 5, 6 and 8, and docs/VALIDATION.md sections 1 and 2. Do not read other lanes' code; keep your context small.

Resume check: read docs/status/lane-b.md if it exists, plus git log and the open PRs, and start at the first lane B item that is not finished.

Work through every lane B item in order without stopping: B20, B21, B22, B23, B24, B25. For each item: branch lane-b/<item>-<slug> from fresh origin/main, build it with its tests, run npm run typecheck and npm test, open a PR, squash-merge it yourself once CI is green, add an entry to docs/status/lane-b.md (files changed, commands run and their real output, checks not run, what depends on it), then go straight to the next item.

You own: src/policies/random.ts, sight.ts, local.ts and dispatcher.ts, scripts/**, tests/policies/**, docs/RESULTS.md and docs/status/lane-b.md. Do not edit anything else.

Never wait for another lane. Your policies are pure functions of an Observation, a private memory object and an Rng, so test them against observations you build by hand. If the scaffold (package.json, Vitest) is not on main yet, write code and tests on your branch, then fetch and rebase every few minutes until it lands and run them. If an item needs the simulation core (B22, B23, B25) and the core is not on main, do the next item that does not need it (B24) and come back.

Hard rules: a policy imports only from ../contracts; it keeps no state outside the memory object it is given; it contains no demand map, fleet positions or schedule; no Math.random. Only dispatcher.ts may read a WorldSnapshot.

For B23, run the experiment exactly as docs/VALIDATION.md section 2 describes and report the result as it is, pass or fail. Do not adjust thresholds, seeds or the warm-up to get a pass. Tune for at most one hour. If the local rules still do not beat random, open an issue titled "BLOCKED: G2 failed" containing the table, then continue with B24.

Stop only when every lane B item is merged, or at the gate G5 feature freeze (09:00 Sunday). Finish by writing a short summary at the top of docs/status/lane-b.md: what is merged, what is not, the G2 verdict, and what a human must do next.
```

## C. Aryan — interface (Pro)

```text
You are running lane C of RICKSHAWS in the GitHub repository shafian7/DurHack-2026, unattended, during a hackathon that ends about midday on Sunday 15 November 2026. Nobody is watching this session. Do not ask questions or wait for approval: when something is unclear, take the most reasonable reading, note it in the PR description, and keep going. This lane is everything a judge sees and touches.

Setup: clone the repository if it is not already here, fetch origin and start from a fresh origin/main.

Read, in this order: AGENTS.md, the lane C items in docs/BUILD.md section 3 plus sections 4 and 5, src/contracts.ts in full, docs/SPEC.md sections 1, 3 and 7, docs/CONTRACTS.md sections 9, 10 and 11, and docs/VALIDATION.md rows V08 and V09 plus section 3. Do not read other lanes' code; keep your context small.

Resume check: read docs/status/lane-c.md if it exists, plus git log and the open PRs, and start at the first lane C item that is not finished.

Work through every lane C item in order without stopping: B40, B41, B42, B43. For each item: branch lane-c/<item>-<slug> from fresh origin/main, build it with its tests, run npm run typecheck, npm test and npm run build, open a PR, squash-merge it yourself once CI is green, add an entry to docs/status/lane-c.md (files changed, commands run and their real output, checks not run, what depends on it), then go straight to the next item.

You own: index.html, src/ui/**, public/**, tests/ui/** and docs/status/lane-c.md. Do not edit anything else. src/main.ts belongs to lane A: you export mountApp from src/ui/index.ts and lane A calls it.

Never wait for another lane. Build against the Simulation, WorldSnapshot, Metrics and Command types only. In B40, write src/ui/dev/fakeSimulation.ts, a stand-in that implements Simulation with rickshaws moving at random, and develop every item against it. Nothing under src/ui/ may import from src/sim/ or src/policies/. If the scaffold (package.json, Vite, Vitest) is not on main yet, write code and tests on your branch, then fetch and rebase every few minutes until it lands and run them.

Stack: TypeScript, Canvas 2D and plain DOM controls. No UI framework and no map tiles. It will be shown on a projector, so make labels large, tell states apart by shape as well as colour, and include a legend. Every number on screen is read from metrics(); never compute or invent a figure in the UI. Label each fleet, and show a dead dispatcher unmistakably.

If an item is truly blocked, open an issue whose title starts with BLOCKED:, then move to the next item and come back later.

Stop only when every lane C item is merged, or at the gate G5 feature freeze (09:00 Sunday). Finish by writing a short summary at the top of docs/status/lane-c.md: what is merged, what is not, and what a human must do next.
```

## D. Aaron — charging, scenarios and pitch (Pro)

```text
You are running lane D of RICKSHAWS in the GitHub repository shafian7/DurHack-2026, unattended, during a hackathon that ends about midday on Sunday 15 November 2026. Nobody is watching this session. Do not ask questions or wait for approval: when something is unclear, take the most reasonable reading, note it in the PR description, and keep going. This lane covers the charging rules, the demo scenarios and the evidence behind the pitch.

Setup: clone the repository if it is not already here, fetch origin and start from a fresh origin/main.

Read, in this order: AGENTS.md, the lane D items in docs/BUILD.md section 3 plus sections 4 and 5, src/contracts.ts in full, docs/SPEC.md sections 1 to 5 and 7 to 8, docs/CONTRACTS.md sections 5 to 7 and 9, and docs/VALIDATION.md sections 2 and 4 to 6. Do not read other lanes' code; keep your context small.

Resume check: read docs/status/lane-d.md if it exists, plus git log and the open PRs, and start at the first lane D item that is not finished.

Work through every lane D item in order without stopping: B60, B61, B62, B63, B64. For each item: branch lane-d/<item>-<slug> from fresh origin/main, build it with its tests, run npm run typecheck and npm test, open a PR, squash-merge it yourself once CI is green, add an entry to docs/status/lane-d.md (files changed, commands run and their real output, checks not run, what depends on it), then go straight to the next item.

You own: src/policies/charging.ts, src/scenarios/**, tests/charging/**, tests/scenarios/**, docs/PITCH.md, docs/CLAIMS.md, docs/RESULTS_CHARGING.md and docs/status/lane-d.md. Do not edit anything else.

Never wait for another lane. The charge policies are pure functions of an Observation, a private memory object and an Rng, so test them against observations you build by hand. A policy imports only from ../contracts, keeps no state outside its memory object, and contains no schedule or fleet-level target. No Math.random. If the scaffold (package.json, Vitest) is not on main yet, write code and tests on your branch, then fetch and rebase every few minutes until it lands and run them. If B62 needs the simulation core or lane B's experiment runner and they are not on main, do B63 and B64 first and come back.

For the pitch work (B63): every number comes from a results file written by the experiment script, or from a source you opened and cite. Until results exist, leave clearly marked gaps; never fill one with a guess. Keep docs/CLAIMS.md in the three-way form of docs/VALIDATION.md section 5: may say, only with evidence, must not say. Verify any research paper before the pitch cites it. Search Devpost for similar projects and report what you find, even if it is unwelcome. You draft only: do not submit to Devpost, publish a video or contact anyone.

If an item is truly blocked, open an issue whose title starts with BLOCKED:, then move to the next item and come back later.

Stop only when every lane D item is merged, or at the gate G5 feature freeze (09:00 Sunday). Finish by writing a short summary at the top of docs/status/lane-d.md: what is merged, what is not, and what a human must do next.
```

## If a session stops early

Paste the same prompt again. The resume check finds the first unfinished item from the lane's status file, the git log and the open PRs.
