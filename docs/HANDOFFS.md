# Handoffs — the prompt each teammate runs

**Status:** prepared about 23:00 on Saturday 14 November 2026 for unattended runs. Nothing has been run. These prompts start work; they are not a record of it.

## Before anyone starts (humans, about five minutes)

1. Everyone confirms they can push to `shafian7/DurHack-2026`. Work lands on the `build` branch, which has no review rule. `main` needs one approving review and gets a single release PR at the end.
2. Everyone agrees the lane table in [BUILD §2](BUILD.md), or swaps lanes now.
3. Someone checks the real submission deadline and tells the team.
4. Each person opens their Claude where it can clone the repository, run Node and push, turns on whatever auto-approve setting their app has, and pastes their prompt. Alex starts first, because lane A lands the scaffold.

Each prompt runs the whole lane from start to finish without asking anything. If a session stops early for any reason, paste the same prompt again: it tells Claude to find where the lane got to and carry on from there.

## A. Alex — core and integration (Ultra)

```text
You are running lane A of RICKSHAWS in the GitHub repository shafian7/DurHack-2026, unattended, during a hackathon that ends about midday on Sunday 15 November 2026. Nobody is watching this session. Do not ask questions or wait for approval: when something is unclear, take the most reasonable reading, note it in the PR description, and keep going.

The project is a browser simulation of one neighbourhood transformer with 200 rickshaw chargers that spread their own load by watching only their own socket voltage. It is software only.

Setup: clone the repository if it is not already here, fetch origin and check out a fresh origin/build. The working branch is build, not main: every branch starts from origin/build and every PR targets build. Never push to main.

Read, in this order: AGENTS.md, docs/README.md, docs/BUILD.md (sections 1, 2, 4, 5 and the lane A items) and src/contracts.ts in full. Read the docs/CONTRACTS.md and docs/VALIDATION.md sections each item names when you reach it.

Resume check: read docs/status/lane-a.md if it exists, plus git log and the open PRs, and start at the first lane A item that is not finished.

Work through every lane A item in order without stopping: B00, B01, B02, B03, B04, B05. B00 is urgent because three other Claude sessions need the scaffold, so land it first and keep it small. For each item: branch lane-a/<item>-<slug> from fresh origin/build, build it with its tests, run npm run typecheck, npm test and npm run build, open a PR against build, squash-merge it yourself once CI is green (for B00, before CI exists, merge on a clean local run), add an entry to docs/status/lane-a.md (files changed, commands run and their real output, checks not run, what depends on it), then go straight to the next item. If GitHub refuses a merge for a reason you cannot fix, do not work around it: write BLOCKED and the exact error in the status file, branch the next item from the unmerged branch, and keep going.

You own: package.json and config files, .github/, src/contracts.ts, src/sim/**, src/main.ts, tests/sim/**, the docs listed for lane A in BUILD section 2, and docs/status/lane-a.md. Do not edit files under other lanes' paths. index.html is lane C's: do not create it, and make npm run build pass without it.

You also own integration. Each time you finish an item, fetch origin/build and wire any newly landed modules from other lanes into src/main.ts. If two lanes disagree about a contract, fix it with one PR that changes src/contracts.ts, docs/CONTRACTS.md and both sides. If build is red, fix that before anything else.

Rules that matter most: all randomness through the seeded Rng, with the separate streams of CONTRACTS section 1 so every mode sees the same night; policies only ever receive an Observation with exactly its five fields; no LLM calls anywhere in the product; no numbers that did not come from a run. In B03, calibrate the default config against the naive mode only, never to make the local rule look better. If an item is truly blocked, open an issue whose title starts with BLOCKED:, then move to the next item and come back later.

B05 ends by opening one PR from build to main and leaving it for a human to approve. Do not try to merge it.

Stop only when every lane A item is merged, or at the gate G5 feature freeze (09:00 Sunday). Finish by writing a short summary at the top of docs/status/lane-a.md: what is merged, what is not, and what a human must do next.
```

## B. Shafian — charger rules and experiments (Pro)

```text
You are running lane B of RICKSHAWS in the GitHub repository shafian7/DurHack-2026, unattended, during a hackathon that ends about midday on Sunday 15 November 2026. Nobody is watching this session. Do not ask questions or wait for approval: when something is unclear, take the most reasonable reading, note it in the PR description, and keep going. This lane holds the charger rule that the project's whole claim rests on.

The project is a browser simulation of one neighbourhood transformer with 200 rickshaw chargers that spread their own load by watching only their own socket voltage. It is software only.

Setup: clone the repository if it is not already here, fetch origin and check out a fresh origin/build. The working branch is build, not main: every branch starts from origin/build and every PR targets build. Never push to main.

Read, in this order: AGENTS.md, the lane B items in docs/BUILD.md section 3 plus sections 4 and 5, src/contracts.ts in full, docs/SPEC.md sections 2 and 5, docs/CONTRACTS.md sections 1, 2 and 5, and docs/VALIDATION.md sections 1 and 2. Do not read other lanes' code; keep your context small.

Resume check: read docs/status/lane-b.md if it exists, plus git log and the open PRs, and start at the first lane B item that is not finished.

Work through every lane B item in order without stopping: B20, B21, B22, B23, B24. For each item: branch lane-b/<item>-<slug> from fresh origin/build, build it with its tests, run npm run typecheck and npm test, open a PR against build, squash-merge it yourself once CI is green, add an entry to docs/status/lane-b.md (files changed, commands run and their real output, checks not run, what depends on it), then go straight to the next item. If GitHub refuses a merge for a reason you cannot fix, do not work around it: write BLOCKED and the exact error in the status file, branch the next item from the unmerged branch, and keep going.

You own: src/policies/naive.ts, stagger.ts and local.ts, scripts/**, tests/policies/**, docs/RESULTS.md and docs/status/lane-b.md. Do not edit anything else. src/policies/scheduler.ts belongs to lane D.

Never wait for another lane. Your policies are pure functions of an Observation, a private memory object and an Rng, so test them against observations you build by hand. For B21, also write a small closed-loop bench under tests/policies/ that puts 200 copies of a policy on the voltage formula in docs/CONTRACTS.md section 2, and tune the rule on that until the simulation core lands. If the scaffold (package.json, Vitest) is not on build yet, write code and tests on your branch, then fetch and rebase every few minutes until it lands and run them. If an item needs the simulation core (B22, B23, B24) and the core is not on build, finish everything that does not need it and come back.

Hard rules: a policy imports only from ../contracts; it keeps no state outside the memory object it is given; it contains no clock time, schedule, load forecast, charger count or transformer rating; no Math.random. The Observation has five fields and you may not ask for more without a contract change.

For B23, run the experiment exactly as docs/VALIDATION.md section 2 describes and report the result as it is, pass or fail, clause by clause. Do not adjust thresholds, seeds, the warm-up or the simulation's config to get a pass. Tune only the constants in local.ts, for at most one hour. If the local rule still does not flatten the peak, open an issue titled "BLOCKED: G2 failed" containing the table, then continue with B24. Always report the near and far ready shares.

Stop only when every lane B item is merged, or at the gate G5 feature freeze (09:00 Sunday). Finish by writing a short summary at the top of docs/status/lane-b.md: what is merged, what is not, the G2 verdict for each clause, and what a human must do next.
```

## C. Aryan — interface (Pro)

```text
You are running lane C of RICKSHAWS in the GitHub repository shafian7/DurHack-2026, unattended, during a hackathon that ends about midday on Sunday 15 November 2026. Nobody is watching this session. Do not ask questions or wait for approval: when something is unclear, take the most reasonable reading, note it in the PR description, and keep going. This lane is everything a judge sees and touches, and the interactive demo is the product.

The project is a browser simulation of one neighbourhood transformer with 200 rickshaw chargers that spread their own load by watching only their own socket voltage. The picture to land is the naive evening spike beside the self-spread curve. It is software only.

Setup: clone the repository if it is not already here, fetch origin and check out a fresh origin/build. The working branch is build, not main: every branch starts from origin/build and every PR targets build. Never push to main.

Read, in this order: AGENTS.md, the lane C items in docs/BUILD.md section 3 plus sections 4 and 5, src/contracts.ts in full, docs/SPEC.md sections 1, 3 and 7, docs/CONTRACTS.md sections 1, 7, 8 and 9, and docs/VALIDATION.md rows V08 and V09 plus sections 3 and 4. Do not read other lanes' code; keep your context small.

Resume check: read docs/status/lane-c.md if it exists, plus git log and the open PRs, and start at the first lane C item that is not finished.

Work through every lane C item in order without stopping: B40, B41, B42, B43. For each item: branch lane-c/<item>-<slug> from fresh origin/build, build it with its tests, run npm run typecheck, npm test and npm run build, open a PR against build, squash-merge it yourself once CI is green, add an entry to docs/status/lane-c.md (files changed, commands run and their real output, checks not run, what depends on it), then go straight to the next item. If GitHub refuses a merge for a reason you cannot fix, do not work around it: write BLOCKED and the exact error in the status file, branch the next item from the unmerged branch, and keep going.

You own: index.html, src/ui/**, public/**, tests/ui/** and docs/status/lane-c.md. Do not edit anything else. src/main.ts belongs to lane A: you export mountApp from src/ui/index.ts and lane A calls it. index.html loads /src/main.ts as a module and contains an element with id "app".

Never wait for another lane. Build against the Simulation, WorldSnapshot, TickSample, Metrics and Command types only. In B40, write src/ui/dev/fakeSimulation.ts, a stand-in that implements Simulation with a plausible evening (chargers arriving, a load curve that rises past the rating, an outage now and then), and develop every item against it. Nothing under src/ui/ may import from src/sim/, src/policies/ or src/scenarios/. If the scaffold (package.json, Vite, Vitest) is not on build yet, write code and tests on your branch, then fetch and rebase every few minutes until it lands and run them. A UI test that needs a DOM starts with the line // @vitest-environment jsdom.

Stack: TypeScript, Canvas 2D and plain DOM controls. No UI framework and no chart library. The centrepiece is one large chart overlaying each neighbourhood's load curve against the transformer's rating, drawn from history(), with outages marked. It will be shown on a projector, so make labels large, tell states apart by shape as well as colour, show a clock, and include a legend. Every number on screen is read from metrics() or history(); never compute or invent a figure in the UI, and show no real-world statistics. Label each neighbourhood, and show a power cut and a dead scheduler unmistakably. Each command control carries a data-cmd attribute holding the command kind, and sends its command to every neighbourhood.

If an item is truly blocked, open an issue whose title starts with BLOCKED:, then move to the next item and come back later.

Stop only when every lane C item is merged, or at the gate G5 feature freeze (09:00 Sunday). Finish by writing a short summary at the top of docs/status/lane-c.md: what is merged, what is not, and what a human must do next.
```

## D. Aaron — scheduler, scenarios and pitch (Pro)

```text
You are running lane D of RICKSHAWS in the GitHub repository shafian7/DurHack-2026, unattended, during a hackathon that ends about midday on Sunday 15 November 2026. Nobody is watching this session. Do not ask questions or wait for approval: when something is unclear, take the most reasonable reading, note it in the PR description, and keep going. This lane covers the central scheduler baseline, the demo scenarios and the evidence behind the pitch.

The project is a browser simulation of one neighbourhood transformer with 200 rickshaw chargers that spread their own load by watching only their own socket voltage. It is software only.

Setup: clone the repository if it is not already here, fetch origin and check out a fresh origin/build. The working branch is build, not main: every branch starts from origin/build and every PR targets build. Never push to main.

Read, in this order: AGENTS.md, the lane D items in docs/BUILD.md section 3 plus sections 4 and 5, src/contracts.ts in full, docs/SPEC.md sections 1 to 5 and 7 to 8, docs/CONTRACTS.md sections 1, 2, 7 and 10, and docs/VALIDATION.md sections 2 and 4 to 6. Do not read other lanes' code; keep your context small.

Resume check: read docs/status/lane-d.md if it exists, plus git log and the open PRs, and start at the first lane D item that is not finished.

Work through every lane D item in order without stopping: B60, B61, B62, B63, B64. For each item: branch lane-d/<item>-<slug> from fresh origin/build, build it with its tests, run npm run typecheck and npm test, open a PR against build, squash-merge it yourself once CI is green, add an entry to docs/status/lane-d.md (files changed, commands run and their real output, checks not run, what depends on it), then go straight to the next item. If GitHub refuses a merge for a reason you cannot fix, do not work around it: write BLOCKED and the exact error in the status file, branch the next item from the unmerged branch, and keep going.

You own: src/policies/scheduler.ts, src/scenarios/**, tests/scheduler/**, tests/scenarios/**, docs/PITCH.md, docs/CLAIMS.md, docs/SOURCES.md and docs/status/lane-d.md. Do not edit anything else.

Never wait for another lane. The scheduler is a pure function of a WorldSnapshot and an Rng, so test it against snapshots you build by hand. Scenarios are data plus a pure configure function, so test them against a default config you write in your own tests if the real one has not landed. If the scaffold (package.json, Vitest) is not on build yet, write code and tests on your branch, then fetch and rebase every few minutes until it lands and run them. If B63 needs results that do not exist yet, leave clearly marked gaps and do B64, then come back.

For the sources and pitch work (B62, B63): docs/SPEC.md section 1 lists figures from the idea brief that nobody has checked. For each one, search for and open a source, and record in docs/SOURCES.md the link, its date, the exact wording and whether it supports the figure. If you cannot find a source, say so and mark the figure as not usable. Every number in the pitch comes from a results file written by the experiment script or from an entry in docs/SOURCES.md. Until results exist, leave clearly marked gaps; never fill one with a guess. Keep docs/CLAIMS.md in the three-way form of docs/VALIDATION.md section 5: may say, only with evidence, must not say. Verify any research paper before the pitch cites it. Search Devpost and the literature for similar projects and for voltage- or frequency-responsive charging, and report what you find, even if it is unwelcome. You draft only: do not submit to Devpost, publish a video or contact anyone.

If an item is truly blocked, open an issue whose title starts with BLOCKED:, then move to the next item and come back later.

Stop only when every lane D item is merged, or at the gate G5 feature freeze (09:00 Sunday). Finish by writing a short summary at the top of docs/status/lane-d.md: what is merged, what is not, which figures have a source and which do not, and what a human must do next.
```

## If a session stops early

Paste the same prompt again. The resume check finds the first unfinished item from the lane's status file, the git log and the open PRs.
