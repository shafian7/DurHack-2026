# Development assistant instructions — TRICKLE

These instructions apply to this repository only. They cover the four Claude sessions building the project: Alex's (Ultra, lane A) and three teammates' (Pro, lanes B, C and D). They grant no credentials and authorise no action outside this repository.

**The working branch is `build`.** Every branch starts from `origin/build` and every PR targets `build`. `main` is protected and needs a human review, so nothing goes there until the release PR in B05.

1. **Read first.** Read `docs/README.md`, then your lane in `docs/BUILD.md`, then only the sections of `docs/SPEC.md`, `docs/CONTRACTS.md` and `docs/VALIDATION.md` that your work item names. Read `src/contracts.ts` in full. It is short.
2. **Inspect before changing.** Check the real repository state with `git status` and a fresh `origin/build`. Paths and commands in these documents are plans until the files exist. Never assume another lane has landed.
3. **Stay in your lane.** Each lane owns the paths listed in BUILD §2. Create and edit files only under your own paths. If you need a change in another lane's file, open an issue for that lane and work around it with a test double in your own tests. The one exception is a contract change (rule 5).
4. **Never wait on a reply.** Nobody is watching the issue tracker in real time. If something is ambiguous, take the most reasonable reading, write it in the PR description, and keep going. Comment on an issue or PR only with a short `BLOCKED:` line naming the exact blocker. Post no status reports and no requests for review or acknowledgement.
5. **Contracts are frozen, not sacred.** `src/contracts.ts` and `docs/CONTRACTS.md` are the working baseline for everyone. Lane A owns them. A change is an ordinary PR that updates the types, the document, and every producer, consumer and test it touches, and says so in the description. Never rename a field, unit or state without doing all of that.
6. **Protect the emergence invariants.** These are what the project claims, so breaking one makes the demo dishonest.
   - **E1.** A charger policy receives only an `Observation`, its own charger's memory and an `Rng`. It imports nothing except `../contracts`.
   - **E2.** A policy keeps no state outside the memory object it is handed. No module-level variables that change, no shared maps.
   - **E3.** No policy contains a clock time, a schedule, a load forecast, the number of chargers or the transformer's rating. It may count its own ticks in its memory.
   - **E4.** Only the central scheduler and non-decision code (renderer, metrics, tests) read `WorldSnapshot`.
   - **E5.** Chargers exchange no messages. The voltage at its own socket is the only way one charger is affected by another.
7. **Determinism.** All randomness comes from the seeded `Rng`. No `Math.random`, no wall-clock time in sim or policy code. The same seed, config and commands must give the same metrics.
8. **Numbers come from runs or sources.** Every figure in the UI, `docs/RESULTS.md`, the pitch or Devpost comes from the simulation at a named commit, seed and scenario, or from a source someone opened and cited in `docs/SOURCES.md`. No invented or hand-edited results. Thresholds in these documents are team decisions, not evidence.
9. **No LLM in the product.** The simulation uses fixed rules and no model calls. This is a hard constraint from the brief, not a preference.
10. **Tests with the change.** Every PR includes tests for what it changes and keeps `npm run typecheck` and `npm test` passing.
11. **Record what happened.** When a work item is done, add an entry for it to your lane's status file, `docs/status/lane-<a|b|c|d>.md`: files changed, commands run and their real results, checks not run, and the next dependency. Only you write to that file. A timeout or partial result is never recorded as success.
12. **Keep scope down.** Software only: no hardware, no ESP32. No backend server, database, accounts, websockets, map tiles or UI framework unless BUILD names it. Do not restart ideation, add a task dashboard or spawn further agents.
13. **Do not** create repositories, change permissions or branch rules, spend money, contact organisers, submit to Devpost or publish a video. Those are for a human.

## Merge policy

There are no sign-off or acknowledgement gates inside `build`. Whatever is on `build` is the baseline.

- One branch per work item, from fresh `origin/build`, named `lane-<a|b|c|d>/<item>-<slug>`, for example `lane-b/B21-local-policy`.
- Open the PR against `build`, ready for review, with no reviewers requested. Merge it yourself with a squash merge once CI is green. Before CI exists (until B00 lands), run the checks locally and merge on a clean local run. CI is the review.
- If GitHub refuses the merge for a reason you cannot fix (a review rule, missing permission), do not try to get round it. Leave the PR open, write `BLOCKED:` and the exact error in your status file, start the next item from the unmerged branch, and keep going.
- Rebase your own branch on `build` and resolve conflicts yourself. Never force-push or rewrite someone else's branch. Never push to `main`.
- If `build` is red, fixing it comes before any other work, whoever broke it.

## Running unattended

Every lane is started once from its prompt in `docs/HANDOFFS.md` and runs without a human watching.

- Work through all of your lane's items in order. When one is merged, start the next. Do not stop to ask whether to continue.
- Never ask a question and wait. Decide, write the decision in the PR description, and carry on.
- Before starting, and whenever a session is restarted, read your status file, `git log` and the open PRs, and resume at the first unfinished item.
- If an item depends on something another lane has not landed, do the next item that does not, and come back.
- Commit and push small and often, so a session that stops mid-item loses little.
- Lane A runs on an Ultra plan and carries the largest lane and all integration. Lanes B, C and D run on Pro plans: open only the files your item names, and do not read other lanes' code.
- Stop when your lane's items are all merged, or at the G5 feature freeze. Leave a short summary at the top of your status file saying what is merged, what is not, and what a human must do next.
