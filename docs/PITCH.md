# Pitch

**Status:** draft by lane D (B62), Saturday 14 November 2026. Not rehearsed, not timed aloud. Every number is either a **⟦GAP⟧** waiting for a results file, or carries a tag like **[S1]** pointing to a row of [SOURCES.md](SOURCES.md) marked usable. **Never fill a gap by hand or with a guess.** Fill each one from the results file lane B's experiment script writes (`docs/RESULTS.md`), regenerated on the frozen commit at G6 (VALIDATION §2), and write the commit, scenario and seeds next to it.
**Related:** [Claims](CLAIMS.md) · [Sources](SOURCES.md) · [Validation §4 and §5](VALIDATION.md) · [Spec §7 and §8](SPEC.md)

## Three-minute script

Times are targets. Words in *italics* are what the presenter does on screen. The `demo-3min` scenario plays steps 2 to 5 by itself for the backup video. Live, the presenter drives the same steps with the controls.

### 1. The problem (25 s)

> Bangladesh's road authority estimates there are over sixty lakh battery rickshaws, six million, with ten to twelve lakh in Dhaka alone **[S1]**. They mostly charge at night, from ordinary sockets. In September the Home Minister told Parliament that illegal charging costs the government about four thousand crore taka a year **[S3]**.
>
> Here is one neighbourhood: one transformer, two hundred rickshaws. In this model, every driver comes home around the same time and plugs in.

*Show the three neighbourhoods at dusk, before arrivals.*

Notes:
- Say "estimates". Fleet counts disagree (S1, S3). Do not give a precise national count beyond the attributed one.
- Optional, if time allows: "A Power Development Board official said night-time demand used to fall by about three thousand megawatts after midnight, and now falls by about one thousand" **[S5]**. Do not say transformers are overloading in real life: that is not sourced (S5).
- Do not use the 16,059 MW figure **[S2]** unless it fits. It is about the national shortage, which we do not fix (CLAIMS, must not say).

### 2. Tonight, three ways (35 s)

> Same night, same rickshaws, same households, three ways. Left: today's chargers, which charge the moment they're plugged in. Middle: ours. Each charger watches only the voltage at its own socket. Right: a central scheduler that sees everything.

*Evening arrives. The naive curve climbs through the rating line, the transformer trips, the neighbourhood goes dark.*

> The naive street goes over the transformer's rating and the protection cuts everyone off. Ours bends under the line. Nobody told it to.

Scoreboard figures to read out, from the run on screen only: peak load as a share of the rating, trips.

Experiment figures (standard scenario, seeds 1 to 10, two measured nights):
- Naive peak: **⟦GAP: naive mean peak share, RESULTS.md⟧**. Ours: **⟦GAP: local mean peak share⟧**.
- Naive trips per night: **⟦GAP⟧**. Ours: **⟦GAP⟧**.

### 3. Make it harder (30 s)

*Turn on the heatwave, or derate the transformer.*

> A heatwave: every household runs its fans harder. The chargers can't know that. But the voltage at their sockets drops, so they make room.

Only if G2 clause 2 and 3 pass: "and the transformer stays on". Heatwave figures from B24: **⟦GAP: heatwave resilience table⟧**.

### 4. Cut the power (30 s)

*Cut the power for an hour.*

> Load-shedding: an hour with no power. When it comes back, every naive charger switches on in the same second, and the transformer trips again. Ours comes back in a trickle, because each one waits a random time first, like Ethernet after a collision **[S6]**.

Power-cut figures from B24: **⟦GAP: load-shedding resilience table⟧**.

### 5. Kill the server (30 s)

*Kill the scheduler.*

> The scheduler does well while it's alive. It sees every rickshaw's departure time. Now the server goes down. Its chargers fall back to charging whenever they're plugged in, and that street becomes the naive one. Ours doesn't notice, because there was never a server to lose. That's by construction, not luck.

G2 clause 6: central trips after the kill in **⟦GAP: n of 10 seeds⟧**.

### 6. Why it is emergent (20 s)

*Show `src/policies/local.ts`.*

> This is the whole charger. One input: its own socket voltage. No clock, no schedule, no messages, no idea how many neighbours it has. The flat curve isn't written anywhere in the code. It comes from two hundred of these reacting to the same wire.
>
> Two honest caveats. Chargers at the far end of the street see lower voltage, so they back off more: far-end rickshaws left ready **⟦GAP: readyShareFar⟧** against **⟦GAP: readyShareNear⟧** near. And this idea isn't new: voltage-responsive charging is an existing research field **[P1, P2]**, and grid-friendly appliances do the same with frequency **[S10]**. What's new here is pointing it at a fleet that can't be registered or scheduled, and letting you break it.

Close (if time): "If these vehicles are going to be registered anyway **[S4]**, a cheap grid-friendly charging rule is a standard that fits where policy is heading." Say it as an argument, not a finding.

## Things the presenter must not say

From [CLAIMS.md](CLAIMS.md) "must not say": that the model matches a real feeder, transformer or charger; "optimal", "proven" or "each charger optimises"; that this fixes load-shedding or the national deficit; that nobody has built this before; any Bangladesh figure without its source tag.

## Answers to likely questions

- **"Wouldn't a scheduler with a fallback rule also survive?"** Yes, and that fallback rule is our charger (SPEC §8).
- **"Isn't the far end of the street disadvantaged?"** Yes, it sees more sag. We report near and far separately: **⟦GAP⟧** near, **⟦GAP⟧** far.
- **"Has this been done?"** Yes, for cars: voltage-droop charging in Denmark **[P1]** and AIMD-based charging **[P2]**. We applied the idea to an informal fleet and made it interactive.
- **"Are your numbers real?"** They come from a simple model with stated assumptions (SOURCES §4): a 7 kWh battery, a 1 kW charger, a 220 kW transformer. These are assumptions, not measurements. Every number on screen comes from the running simulation.
- **"Does it use AI?"** No. Fixed rules, a few lines per charger, no model calls.

## Devpost draft

**Status:** draft for a human to paste and submit (AGENTS.md rule 13: Claude does not submit). Gaps fill from `docs/RESULTS.md` on the frozen commit. Remove the source tags before pasting, and keep the sources list at the end.

### Name

RICKSHAWS: chargers that spread their own load

### Tagline

Two hundred battery-rickshaw chargers keep one neighbourhood transformer on, using nothing but the voltage at their own sockets.

### Inspiration

Bangladesh's road authority estimates there are over sixty lakh battery rickshaws, ten to twelve lakh of them in Dhaka **[S1]**. They mostly charge at night from ordinary sockets, much of it informally: the Home Minister told Parliament in September 2026 that illegal charging costs the government about Tk 4,000 crore a year **[S3]**. A central scheduler would need every charger registered, online and obedient. We wanted to know whether chargers could share a transformer with no server at all.

### What it does

A browser simulation of one transformer and the 200 chargers on its street, run the same night three ways:

- **Naive:** charge as soon as you're plugged in. This is today's behaviour, and it makes the evening spike.
- **Ours:** each charger watches only the voltage at its own socket. When the voltage sags it backs off for a random time, and an emptier battery backs off less. When the voltage has room, it comes back. There is no clock, no schedule, no messages and no idea how many neighbours it has.
- **Scheduled:** a central server that sees everything, including when each rickshaw leaves.

You can push it over: a heatwave, a derated transformer, an hour of load-shedding, stubborn chargers that ignore the rule, or killing the scheduler's server. The scoreboard shows peak load, minutes overloaded, trips, minutes without power and the share of rickshaws that left charged, near and far along the street.

### Results

Standard scenario, 10 seeds, two measured nights each, commit **⟦GAP: frozen commit⟧**:

| | Naive | Random stagger | Ours | Scheduled |
| --- | --- | --- | --- | --- |
| Peak load / rating | ⟦GAP⟧ | ⟦GAP⟧ | ⟦GAP⟧ | ⟦GAP⟧ |
| Minutes overloaded per night | ⟦GAP⟧ | ⟦GAP⟧ | ⟦GAP⟧ | ⟦GAP⟧ |
| Trips per night | ⟦GAP⟧ | ⟦GAP⟧ | ⟦GAP⟧ | ⟦GAP⟧ |
| Left charged (near / far) | ⟦GAP⟧ | ⟦GAP⟧ | ⟦GAP⟧ | ⟦GAP⟧ |

Clause verdicts from VALIDATION §2: **⟦GAP: pass/fail for clauses 1 to 6⟧**. If a clause failed, say so here and narrow the claim (BUILD §5).

When the scheduler's server is killed at 18:00 on night two, the scheduled street trips in **⟦GAP⟧** of 10 seeds. Ours is unaffected by construction: it never had a server.

### How we built it

TypeScript, Vite, Canvas 2D and plain DOM. No UI framework, no backend and no AI. A deterministic, seeded simulation runs in one-minute ticks. Voltage falls with transformer load and with distance along the feeder, and that is the only way one charger affects another. The same code runs headless over many seeds to produce the results table. Four people worked in four lanes against one frozen contract file.

### Challenges

Keeping it honest. Every number on screen comes from the running simulation, and every number here comes from a results file or a cited source. Calibrating the model against the naive mode only, so it shows the problem without flattering our rule. And the far end of the street: it sees lower voltage, so its chargers back off more. We report near and far separately (**⟦GAP⟧** vs **⟦GAP⟧**).

### What we learned

The idea isn't new. Voltage-dependent EV charging **[P1]**, AIMD-style decentralised charging **[P2]** and grid-friendly appliances that respond to frequency **[S10]** all exist. What's different here is the setting: an informal fleet that can't be registered or scheduled, where "nothing to fail" matters most.

### What's next

Checking the model's assumptions against real figures (battery size, charger power, transformer rating and household load are assumptions today). And a hardware charger that implements the rule. If these vehicles are registered, as the government says it plans **[S4]**, a grid-friendly charging rule could become part of the standard. That is an argument, not a finding.

### Caveats (keep these in the submission)

- The model is a sketch with stated assumptions, not a model of a real feeder.
- Results are from simulation only.

### Sources

List the usable SOURCES.md entries the text cites, with links: S1, S3, S4, S10, P1, P2.
