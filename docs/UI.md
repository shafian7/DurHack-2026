# Interface: the Dhanmondi map

**Status:** built on the `shafian` branch, Sunday 15 November 2026. It replaces the first interface (B40 to B43) and the street-diagram proposal. The full plan is in [plan.md](../plan.md) §1 and §3.6.

## Look and entry (merged from Aryan's branch, 15 November)

The night theme comes from Aryan's intro page: navy grounds, lavender text and #FFD966 yellow for light (homes lit at night, the play button, active controls), and the RICKSHAWS wordmark in Press Start 2P. Blacked-out buildings are near-black with a faint outline. `public/intro.html` is his pixel-art intro animation; its CONTINUE button fades out and opens `index.html`, which lands on story mode. The utility server, network outage button, story bar, socket view and film cards use the same palette, with the server's purple brightened to #A78BFA so it reads on navy.

## Story mode (default landing view, 15 November)

The page opens on a three-act story, with a caption bar under the maps (step dots, kicker, title, one-line body, Back and Next; the arrow keys also work). Each act starts close to its key moment, at the default 10× speed:

1. **Act 1 · Dhanmondi today.** One large map of ordinary chargers (`naive`), opening at 22:00. The transformers overload and the east one bursts at about 23:30. The network button is hidden: there's no network yet.
2. **Act 2 · The usual fix.** One large map of app-controlled chargers (`central`), opening at 20:30. The server keeps the load under the limit, then the network goes down at 21:30 and the transformer bursts at about 23:30. The presenter picks **why the network fails**: an internet shutdown (July 2024, sourced as S11), towers losing power (an assumption), or a server failure.
3. **Act 3 · Our fix.** App-controlled and smart chargers side by side, with the same outage at 21:30. The app side bursts; the smart side shows "Nothing to lose". The caption invites a click on a garage bay for the socket view.
4. **Free play.** The full page as below, with every control. `?at=HH:MM` or `?scene=free` in the address opens straight into free play.

## The story: the network fails, the wire doesn't (15 November)

**Left: App-controlled chargers** (the `central` mode). A utility server tells each charger when to draw, over the mobile network. A purple **Utility server** sits on the map, with dashed data links to the ten garages and data pulses flowing out. While the network is up it keeps both transformers under their limit, so it is a fair rival. **Network outage** (red top-bar button, or X) takes the network down: the links snap, the server goes grey ("No signal"), and every charger falls back to charging flat out (BUILD D06). The east transformer bursts about two hours later. **Restore network** brings the server back, but a burst transformer stays dark. With **Outage at 21:00** on (the default, in Controls), the network drops by itself once per run.

**Power cuts take the network with them.** Press **Power cut** (one hour). After 30 minutes the mobile towers' backup batteries run out, and the network stays down until 20 minutes after the grid returns (`src/map/network.ts`; both durations are model assumptions with no source). When power returns, the app-controlled chargers have no instructions and all start at once. Honest result over 10 seeds: the app side spikes to about 134% of the limit, but does not burst, and still sends 99.8% out charged. The smart side restarts gradually (peak about 111%) but sends only 90.3% out charged. Present it as a realism feature, not a win.

**Right: Smart chargers.** No server, no links. A network outage shows "Nothing to lose".

**Socket view.** Click any garage bay on either map. The same charger opens on both maps, each in its own world: a 90-minute trace of the voltage at its socket, a strip of its state (waiting, charging, full), its battery, and one plain sentence on why it is doing what it is doing. On the smart side, the trace also shows its back-off line for its current battery level (the battery part of the rule; the deprivation boost is not drawn). Esc or ✕ closes it.

**Start time.** `?at=22:30` in the address starts the night at that time, for rehearsals and for opening the demo just before the moment you want.

Earlier versions: `dhanmondi-v1` (dashboard layout), `dhanmondi-v2` (ordinary against smart), `dhanmondi-v3-central` (first central-server version).

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
