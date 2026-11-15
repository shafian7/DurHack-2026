/**
 * The Devpost video, segment by segment: what is said, what is on screen,
 * and how fast the night runs. Every figure here is either from our own runs
 * (docs/RESULTS.md, seeds 1 to 10) or from a source in docs/SOURCES.md, and
 * model results are labelled as such.
 */

export interface Segment {
  readonly id: string;
  /** The voiceover. Also shown as subtitles. */
  readonly say: string;
  /** Seconds of silence added after the voiceover. */
  readonly hold?: number;
  /** A full-screen card instead of the map, or null. */
  readonly card?: string | null;
  /** Scene to open at the start of the segment. */
  readonly scene?: 'today' | 'usual' | 'ours' | 'free';
  /**
   * The simulated tick the night should reach when the segment ends; the
   * recorder sets the speed to get there. Absent: the night is paused.
   * Seed 1 bursts at tick 691 (23:31) in both failure cases.
   */
  readonly endTick?: number;
  /** Things to do at a time (seconds) into the segment. */
  readonly at?: readonly { readonly t: number; readonly js: string }[];
}

const stat = (big: string, text: string, src: string): string =>
  `<div class="stat"><b>${big}</b><span>${text}</span><small>${src}</small></div>`;

export const SEGMENTS: readonly Segment[] = [
  {
    id: 'title',
    say: 'Rickshaws. Chargers that read the wire.',
    hold: 1.2,
    card: `<div class="eyebrow">DurHack 2026 · Neptune North</div><h1>Chargers that read the wire</h1><h2>Keeping Dhaka's battery rickshaws charging, even when the network goes down</h2>`,
  },
  {
    id: 'cold-open',
    say: 'Every night in Dhaka, battery rickshaws come home and plug in, at almost the same time.',
    hold: 0.6,
    card: null,
    scene: 'today',
    endTick: 615,
  },
  {
    id: 'problem',
    say:
      "Bangladesh's road transport authority estimates more than six million of them. The Home Minister told Parliament they use about five percent of the country's electricity. And the power board says night-time demand no longer falls after midnight.",
    hold: 0.8,
    card:
      `<div class="eyebrow">The problem</div><h1>Millions of chargers, one evening peak</h1><div class="stats">` +
      stat('6 million+', 'battery rickshaws in Bangladesh', 'BRTA estimate, reported by UNB, August 2025') +
      stat('~5%', 'of national electricity generation', 'Home Minister in Parliament, September 2026') +
      stat('1,000 MW', 'is all demand now falls after midnight, down from about 3,000 MW', 'BPDB, reported by Prothom Alo, June 2026') +
      `</div>`,
  },
  {
    id: 'today',
    say:
      'This is a real block of Dhanmondi, built from OpenStreetMap: two neighbourhood transformers, ten rickshaw garages and two hundred rickshaws. With ordinary chargers, every rickshaw draws full power the moment it plugs in. In our model, the east transformer overheats, and at half past eleven, it fails. Three hundred buildings go dark.',
    hold: 1.5,
    card: null,
    scene: 'today',
    endTick: 712,
  },
  {
    id: 'usual',
    say:
      'The usual fix is to connect every charger to a utility server over the mobile network, and schedule them centrally. And it works. The load stays under the limit.',
    hold: 0.4,
    scene: 'usual',
    endTick: 569,
  },
  {
    id: 'outage',
    say:
      'Until the network drops. In July 2024, mobile internet across Bangladesh was shut down for ten days. A charger without instructions can strand its driver, or charge flat out. So the overload comes straight back, and the transformer fails again.',
    hold: 1.5,
    endTick: 720,
  },
  {
    id: 'idea',
    say:
      "So we asked: what if the chargers didn't need the network at all? Ours share just one signal: the voltage on the wire they are already plugged into. When the neighbourhood draws too much, the voltage sags. Each charger backs off for a random time, and a nearly empty battery backs off less. No server. No messages. No clock.",
    hold: 0.5,
    scene: 'ours',
    endTick: 640,
  },
  {
    id: 'socket',
    say:
      'Click any bay to see what one charger feels: the voltage at its socket, and the line where it backs off. On the left, a charger with no instructions just charges flat out.',
    hold: 0.6,
    endTick: 668,
    at: [{ t: 0, js: 'rickshawsFilm.select(1, 87)' }],
  },
  {
    id: 'outcome',
    say: 'Same night. Same outage. The app-controlled side fails. Ours has nothing to lose, and the lights stay on.',
    hold: 2,
    endTick: 720,
    at: [{ t: 0, js: 'rickshawsFilm.unselect()' }],
  },
  {
    id: 'results',
    say:
      'Across ten simulated nights, ordinary chargers burst a transformer every night. App-controlled chargers burst one every night the network went down. Ours never did, and still sent ninety-six percent of rickshaws out fully charged.',
    hold: 1,
    card:
      `<div class="eyebrow">The results</div><h1>Ten nights in our model of Dhanmondi</h1><div class="stats">` +
      stat('10 / 10', 'nights a transformer burst with ordinary chargers', 'Peak load up to 134% of the rating') +
      stat('10 / 10', 'nights it burst with app-controlled chargers once the network went down', 'Up to 99.9% charged while the network held') +
      stat('0 / 10', 'nights it burst with our chargers', '96% of rickshaws left fully charged') +
      `</div><div class="note">Simulation, seeds 1 to 10. Transformer heating and the burst point are illustrative model values.</div>`,
  },
  {
    id: 'hardware',
    say:
      "In practice, it's a small plug-in box between the wall and the charger a garage already owns: a voltage sensor, a relay and a microcontroller. No radio and no SIM. It builds on known research into voltage-responsive charging, applied to a fleet nobody can network. Power cuts are still our weakest case, and that's what we're improving next.",
    hold: 0.8,
    card: `<div class="eyebrow">What we would build</div><h1>A small box between the wall and the charger</h1><h2>Voltage sensor · relay · microcontroller<br>No radio · no SIM · no server</h2><div class="note">Concept design. Not yet built or tested.</div>`,
  },
  {
    id: 'close',
    say: 'Rickshaws. Nothing to connect, so nothing to cut.',
    hold: 2.5,
    card: `<div class="eyebrow">RICKSHAWS</div><h1>Nothing to connect,<br>so nothing to cut</h1><h2>Alex · Shafian · Aryan · Aaron<br>DurHack 2026 · Neptune North</h2><div class="note">Map data © OpenStreetMap contributors, ODbL</div>`,
  },
];
