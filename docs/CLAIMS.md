# Claims ledger

**Status:** live ledger kept by lane D (B63), in the three-way form of VALIDATION §5. First written Saturday 14 November 2026, before any experiment results existed. **Nothing in "Only with evidence" may be said until its evidence column names a results file regenerated on the frozen commit at G6.** Update this file whenever `docs/RESULTS.md` changes.
**Related:** [Validation §2 and §5](VALIDATION.md) · [Sources](SOURCES.md) · [Pitch](PITCH.md)

## May say

| Statement | Evidence |
| --- | --- |
| The simulation uses fixed rules and no AI or model calls | AGENTS.md rule 9. Code review of `src/` (no network or model calls) |
| Each neighbourhood in the demo runs the same night: same arrivals, household load and judge actions | V01, lane A, `tests/sim/core.test.ts`, passing on `build` |
| The central scheduler sees every rickshaw's departure time and needs a server, a connection and registration | By design: SPEC §5, `src/policies/scheduler.ts` reads `WorldSnapshot.departTick` |
| When the scheduler is killed, its chargers charge whenever plugged in | V06, lane A, `tests/sim/commands.test.ts`, passing on `build` |
| Bangladesh's road authority (BRTA) estimates over 60 lakh battery rickshaws, 10 to 12 lakh in Dhaka | SOURCES S1. Say "estimates", attributed |
| The Home Minister told Parliament in September 2026 that illegal charging costs the government about Tk 4,000 crore a year | SOURCES S3. Revenue loss, attributed |
| The government says it is bringing these vehicles under registration | SOURCES S4. Not "has registered" |
| A Power Development Board official said night-time demand now falls by about 1,000 MW after midnight, where it used to fall by about 3,000 MW | SOURCES S5, the opened part only |
| Voltage-responsive charging is an existing research field. We apply it to an informal fleet | SOURCES P1, P2, S10 |
| The random wait is the same idea as Ethernet's back-off after a collision | SOURCES S6 |

## Only with evidence

Each row needs the evidence named. The "now" column says where it stands at the time of writing.

| Statement | Evidence needed | Now |
| --- | --- | --- |
| Each charger decides from its own socket voltage and battery level, and nothing else | V02 (lane B) and V03 (lane A) passing | V03 passes on `build`. **V02 not landed** |
| Chargers exchange no messages and there is no server | V02 passing | **V02 not landed** |
| Naive charging overloads this model's transformer | G2 table, clause 1 | **⟦GAP: no RESULTS.md⟧** |
| The local rule cuts the peak by a stated factor and avoids trips | G2 table, clauses 2 and 3, quoting the measured figures | **⟦GAP⟧** |
| Rickshaws still leave charged | G2 table, clause 4, quoting ready shares for all modes, near and far for local | **⟦GAP⟧** |
| Sensing matters, not just randomness | G2 table, clause 5 | **⟦GAP⟧** |
| The scheduled neighbourhood reverts to the spike when its server dies, and ours does not ("by construction" for ours) | V06 passing (done) and G2 clause 6 run by the experiment script | V06 passes. **Clause 6 not yet run by the script.** Lane D's development run (B61 status) saw central trip after the kill in 10 of 10 seeds of `demo-3min`. That is indicative only and must not be quoted |
| Ours keeps working in a heatwave, after a power cut, and with stubborn chargers | B24 resilience tables | **⟦GAP⟧** |
| It runs offline in a browser | VALIDATION §3 manual check | **Not done** |
| The far end of the street does worse or no worse | G2 table near and far shares for local | **⟦GAP⟧** |
| PGCB reported 16,059 MW demand against 12,388 MW supply | SOURCES S2: only as "at 3 pm on Sunday 9 August 2026", never as a monthly figure | Usable in that form. Not needed by the pitch |

## Must not say

| Statement | Why |
| --- | --- |
| That the model matches a real feeder, transformer or charger | It is a sketch with stated assumptions (SOURCES §4). Battery size, charger power, rating, load curve and sag are all unsourced |
| "Optimal", "proven", or "each charger optimises" | Nothing is optimised or proven. The load spreads itself |
| That this would fix load-shedding or the national deficit | It is about one transformer's peak (SOURCES S2 is national supply) |
| That nobody has built this before | SOURCES P1, P2, S10: voltage- and frequency-responsive load control already exists |
| That illegal night charging is overloading real transformers in Bangladesh | Not usable until someone opens a source (SOURCES S5) |
| That rickshaw charging is left out of official load forecasts | Not usable (SOURCES S5) |
| Any precise national fleet count without attribution, or as settled | Official estimates disagree: 60 lakh (BRTA) and 50 to 80 lakh (Home Minister) |
| That registration is in force | No final policy found (SOURCES S4) |
| Any figure from Jacobson 1988, DESYNC or Al Zishan et al. 2021 | Not opened (SOURCES S8, S9, P3) |
| Any experiment number not regenerated on the frozen commit at G6 | VALIDATION §2, rules for results files |
