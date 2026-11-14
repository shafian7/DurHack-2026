# Interface specification — the map MVP

**Status:** written about 01:00 on Sunday 15 November 2026. It replaces the first interface (BUILD B40 to B43), which the team rejected. Nothing here is built. This is a first version to react to: build it plainly, then the team iterates.
**Owner:** lane C (Aryan).
**Who designs it:** lane C. Sections 1, 7 and 8 are requirements. Sections 2 to 6 are a starting proposal, not an instruction: lane C may change the layout, the map's drawing, the colours, the type and the wording, and should use any design skill it has. Lane C edits this document to match what it builds, so the next person reads the real design.
**Related:** [Spec](SPEC.md) · [Contracts](CONTRACTS.md) · [Build](BUILD.md)

## 1. What the screen is for

A judge standing three metres from a projector should understand, without anyone speaking, that the same neighbourhood is shown twice, that one goes dark and the other does not, and that the only difference is the charger.

So the screen is a **top-down map of the neighbourhood**, shown once per charger type, with a thin strip of evidence underneath. Everything else is secondary and stays out of the way.

## 2. Layout

One page, no scrolling at 1920 × 1080 or 1366 × 768.

```text
+----------------------------------------------------------------------------+
| RICKSHAWS   chargers that spread their own load        Night 1  22:14   ▶ 8x|
+----------------------------------+-----------------------------------------+
|  Ordinary chargers               |  Voltage-sensing chargers               |
|                                  |                                         |
|            [ MAP ]               |               [ MAP ]                   |
|                                  |                                         |
|  Peak 121%   Dark 75 min   99%   |  Peak 96%    Dark 0 min    97%          |
+----------------------------------+-----------------------------------------+
|  load through the night, both curves, with the transformer's limit         |
+----------------------------------------------------------------------------+
|  Heatwave   Power cut   Kill the server      + scheduler  + random   More  |
+----------------------------------------------------------------------------+
```

The numbers in this sketch are placeholders to show position. The real page shows only values read from the simulation.

- **Header, one line.** Name, one-line description, the clock, play or pause, and speed.
- **Maps, about 60% of the height.** Two by default: ordinary chargers (the `naive` mode) on the left and ours (`local`) on the right. Equal size, identical layout, so any difference the eye finds is real.
- **Three numbers under each map**, and no others: peak load as a percentage of the limit, minutes without power, and the share of rickshaws that left charged.
- **Evidence strip, about 15% of the height.** One chart with one load curve per map shown and a single horizontal line for the transformer's limit.
- **Action bar, one line.** Three actions that break things, two switches that add a map, and a "More" button for the rest.

When a third or fourth map is switched on, the maps share the row equally. Below 1100 px wide the maps stack two by two.

## 3. The map

A plan view of one street, drawn on a canvas. It is a diagram, not geography: it shows no real place and carries no place names.

- **The street.** One main road runs left to right through the middle of the map. Short side lanes leave it at right angles, alternating up and down. This is the feeder: the wire that carries power from the transformer.
- **The transformer** sits at the left end of the main road. Distance along the road and lanes from the transformer is the charger's `feeder` value, so chargers further right are further down the wire.
- **Plots.** Each charger has a small plot beside a lane. Its position comes only from its `id` and `feeder` in the snapshot, by a fixed rule, so the same charger is in the same place on every map and on every run. Plots must not overlap.
- **Chargers** are drawn on their plots:

| State | Drawn as |
| --- | --- |
| away | an empty plot outline, faint |
| waiting | a rickshaw mark, outline only |
| charging | a rickshaw mark, filled and lit |
| full | a rickshaw mark, filled, with a small tick |
| removed | nothing; the plot is crossed out |
| stubborn | the same as its state, with a ring round it |

  The states differ by shape and fill, not only by colour.
- **The wire.** The road and lanes are drawn as the feeder line. Its brightness follows the voltage along it: full brightness at nominal voltage, dimmer as the voltage sags. This makes the invisible thing, the voltage each charger reads, visible.
- **The transformer mark** shows load: a ring that fills as load rises towards the limit and changes to the alert colour above it. Its figure in kW sits beside it.
- **Houses.** Small plain blocks along the main road, lit while the power is on. They are there so that an outage is seen to hit households, not only chargers.
- **Power out.** Every house and charger goes unlit, the wire disappears, and the words "POWER OUT" with the time it returns appear across the map. This is the moment the demo exists for; it must be unmistakable from the back of a room.
- **Scheduler dead.** On the scheduled map only, a plain label "SERVER OFFLINE" stays on the map until it is revived.

## 4. Evidence strip

- One line per map shown, drawn from `history()`, with household demand as a faint filled area underneath.
- One horizontal line for the limit, labelled "transformer limit".
- Outages marked as gaps in the curve with a short bar on the baseline.
- The x axis is the clock, with a label every three hours. The newest time is at the right edge.
- Each curve is labelled at its right-hand end, not in a separate legend.

## 5. Actions

Every control that sends a command keeps a `data-cmd` attribute holding the command kind, and sends its command to every simulation, including ones whose map is hidden.

- **Always visible:** Heatwave (`setBaseLoadScale` 1.3, press again for 1), Power cut (`powerCut` 60), Kill the server (`killScheduler`, becomes Revive).
- **Map switches:** "+ scheduler" shows the `central` map; "+ random delay" shows the `stagger` map. Their simulations run from tick 0 whether shown or not, so switching one on shows the same night.
- **Under "More":** weaker transformer (`setRatingScale`), grid sag (`setSupplyVoltage`), rush home (`plugInBurst`), remove chargers, rogue chargers (`stubbornChargers`), the scenario list, play the scripted demo, reset, full screen.
- **Speed:** pause, 1×, 8× and 30×. At 8× a night passes in about a minute.
- A button that is switched on looks pressed. Nothing else is animated.

## 6. Visual language

The first interface looked like a generic dashboard. This one should look like a printed diagram of a street at night.

- **Background:** one flat near-black, neutral, not blue. No gradients, no glows, no drop shadows, no cards with rounded borders, no icons from an icon set, no emoji.
- **Colour:** three roles only.
  - Lit: one warm amber, for anything drawing power.
  - Alert: one red, for load over the limit and for power out.
  - Ink: off-white for text and outlines, and two greys below it.
  The two charger types are told apart by position and label, never by hue. Nothing is teal or purple.
- **Type:** the system UI font for labels and a system monospace with tabular figures for every number. Two weights. Labels at least 18 px, the three numbers under each map at least 40 px, the clock at least 32 px.
- **Lines:** one pixel for structure, two for the load curves. Square corners.
- **Words:** plain labels a passer-by understands. "Ordinary chargers", not "naive". "Voltage-sensing chargers", not "local". "Dark 75 min", not "outageTicks".
- **Contrast:** text at least 4.5 to 1 against the background.

## 7. Rules that have not changed

- Nothing under `src/ui/` imports from `src/sim/`, `src/policies/` or `src/scenarios/` (V08).
- Every number on screen comes from `metrics()`, `history()` or `snapshot()`. The interface computes no figure of its own and shows no real-world statistic.
- All simulations are built from one config and stepped together.
- Canvas 2D and plain DOM. No UI framework, no chart or map library, no network requests.
- The page must not throw. An error in a frame stops the loop and says so on screen.

## 8. Not in this version

3D, real map data, street names, a legend panel, tooltips, per-charger inspection, animation of rickshaws driving, sound, and themes. These are candidates for iteration once the team has seen the map working.

## 9. Building it

- Keep what works from the first interface: the run loop in `src/ui/app.ts`, the fake simulation in `src/ui/dev/`, the dev page, and the helpers in `chart.ts` and `time.ts`. Reuse or rewrite the chart drawing to match §4.
- Replace `street.ts` with the map. Replace `styles.ts`, `theme.ts`, `scoreboard.ts`, `legend.ts` and `controls.ts` to match §2, §5 and §6. Delete what is no longer used.
- Keep the layout rule (id and feeder to x and y) as a pure function with its own tests: no overlaps, inside the map, identical for identical input, further along the feeder never nearer the transformer.
- Keep or update the existing tests in `tests/ui/` so V08 and V09 still pass. Do not delete a test to get a pass; change it only where the old interface's structure was what it tested.
- Check the result in a browser at 1920 × 1080 with a real night, including a power cut, and attach a screenshot to the PR.
