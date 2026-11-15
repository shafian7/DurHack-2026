# Interface: the Dhanmondi map

**Status:** built on the `shafian` branch, Sunday 15 November 2026. It replaces the first interface (B40 to B43) and the street-diagram proposal. The full plan is in [plan.md](../plan.md) §1 and §3.6.

## Layout (demo version, 15 November)

The two maps fill the screen. The top bar holds the name, a large clock, play/pause, speed (2×, 10×, 30×, 60× simulated minutes per second), Restart, **Load graph** and **Controls**. On each map, small floating labels show: the title and one-line explanation (top left), a single status (top right: "All lights on", "Transformer overloaded", "Power cut", or "T2 burst · N buildings dark" in red), and three figures (bottom left: charging now, hottest transformer, left fully charged). A burst also gives a centred red announcement and a red outline on that map. A "Same night" badge sits between the maps. **Load graph** opens the chart as a row below the maps, which shrink to make room, so nothing is covered. **Controls** opens a popover with the actions, the colour key and the data note. Keys: space play/pause, 1 to 4 speed, G graph, C controls, R restart, Esc close.

The first version (dashboard layout, with the chart and controls always visible) is tagged `dhanmondi-v1`.

## What is on screen

- **Header:** name, place, clock (night and time), play/pause, and a speed of 2, 10, 30 or 60 simulated minutes per second.
- **Two maps side by side**, the same night on each: *Ordinary chargers* (`naive`) and *Smart chargers* (`local`). Each map shows:
  - **Roads** as plain lines, from the real Dhanmondi street network (OpenStreetMap), thicker for main roads.
  - **Buildings** as simple boxes lining the roads. They are schematic, placed by `scripts/build-map.ts`, not real footprints. They glow softly at night while their transformer has power and turn dark grey when it does not.
  - **Two transformers**, T1 west and T2 east. Each has a load ring, a label card with the load as a share of its rating, and its hot-spot temperature. The label goes amber and then red as the transformer nears the burst point, with a pulsing halo. A **burst** shows a flash, a scorched casing, smoke and a red card.
  - **Feeder lines** from each transformer to its five garages, along the roads, coloured by sag. They turn grey and dashed when the transformer has no power.
  - **Ten garages**, each a card of 20 bays: empty, waiting (outline), charging (green, with the battery level shown), full (blue). Stubborn chargers get a red outline.
  - **Rickshaws** away from their garage drive round the roads on their own deterministic routes. This is cosmetic and is never fed back into the simulation.
  - **Four figures** under each map: rickshaws charging now, hottest transformer, buildings dark, and the share of rickshaws that left charged.
  - A red **banner** when a transformer bursts, saying when, and how many buildings and rickshaws lost power.
- **Chart:** load on each transformer as a share of its rating from 17:00 to 08:00, ordinary in red and smart in blue (T2 dashed), with the limit line.
- **Actions**, each sent to both sides on the same tick: heatwave (toggle, 1.3 times household load), power cut (one hour), stubborn chargers (20%), and new night (next seed).

## Rules it keeps

- `src/ui/` imports only `../contracts`, `../map`, the district *types* and its own files (`tests/ui/boundary.test.ts`).
- Every number shown is read from the simulation's snapshots, metrics and history.
- The page carries the OpenStreetMap attribution and a note that the heating and burst values are illustrative.
