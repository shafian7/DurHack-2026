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
    hold: 0.8,
    card: `<div class="eyebrow">DurHack 2026 · Neptune North</div><h1>Chargers that read the wire</h1><h2>Keeping Dhaka's battery rickshaws charging, even when the network goes down</h2>`,
  },
  {
    id: 'cold-open',
    say:
      "Every night in Dhaka, millions of battery rickshaws plug in at almost the same time.",
    hold: 1.4,
    card: null,
    scene: 'today',
    endTick: 615,
  },
  {
    id: 'problem',
    say:
      "Bangladesh has more than six million of them, using about five percent of the country's electricity, and night-time demand no longer falls after midnight.",
    hold: 1.5,
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
      "On a real block of Dhanmondi, ordinary chargers all draw full power at once. In our model, the transformer overheats, and fails.",
    hold: 3.5,
    card: null,
    scene: 'today',
    endTick: 712,
  },
  {
    id: 'usual',
    say:
      "The usual fix: a utility server schedules every charger over the mobile network. And it works.",
    hold: 1.0,
    scene: 'usual',
    endTick: 569,
  },
  {
    id: 'outage',
    say:
      "Until the network drops, as it did across Bangladesh for ten days in July 2024. Without instructions, chargers charge flat out, and the transformer fails again.",
    hold: 3.0,
    endTick: 720,
  },
  {
    id: 'idea',
    say:
      "Our chargers don't need the network. Each one senses the voltage at its own socket. When the neighbourhood draws too much, the voltage sags, and each charger backs off for a random time. No server. No messages.",
    hold: 1.5,
    scene: 'ours',
    endTick: 640,
  },
  {
    id: 'socket',
    say:
      "Click any bay to see what one charger feels: its voltage, and the line where it backs off.",
    hold: 2.0,
    endTick: 668,
    at: [{ t: 0, js: 'rickshawsFilm.select(1, 87)' }],
  },
  {
    id: 'outcome',
    say:
      "Same outage. Theirs fails. Ours has nothing to lose.",
    hold: 3.5,
    endTick: 720,
    at: [{ t: 0, js: 'rickshawsFilm.unselect()' }],
  },
  {
    id: 'results',
    say:
      "Across sixty simulated nights, ordinary chargers always burst a transformer, and app-controlled ones did whenever the network failed. Ours never did, and still sent ninety-five percent of rickshaws out charged on the worst night.",
    hold: 1.5,
    card:
      `<div class="eyebrow">The results</div><h1>Sixty simulated nights in Dhanmondi</h1><div class="stats">` +
      stat('60 / 60', 'runs with a transformer burst, ordinary chargers', 'Across all six scenarios') +
      stat('10 / 10', 'runs with a burst for app-controlled chargers when the network failed', 'Fine while the network held') +
      stat('0 / 60', 'runs with a burst for our chargers', '95% fully charged even on the worst night') +
      `</div><div class="note">Our simulation, 10 runs per scenario. Transformer heating and the burst point are illustrative model values.</div>`,
  },
  {
    id: 'hardware',
    say:
      "In practice, it's a small box between the wall and the charger: a voltage sensor, a relay and a microcontroller. No radio. No SIM.",
    hold: 0.8,
    card: `<div class="eyebrow">What we would build</div><h1>A small box between the wall and the charger</h1><h2>Voltage sensor · relay · microcontroller<br>No radio · no SIM · no server</h2><div class="note">Concept design. Not yet built or tested.</div>`,
  },
  {
    id: 'close',
    say:
      "Rickshaws. Nothing to connect, so nothing to cut.",
    hold: 3.0,
    card: `<div class="eyebrow">RICKSHAWS</div><h1>Nothing to connect,<br>so nothing to cut</h1><h2>Alex · Shafian · Aryan · Aaron<br>DurHack 2026 · Neptune North</h2><div class="note">Map data © OpenStreetMap contributors, ODbL</div>`,
  },
];
