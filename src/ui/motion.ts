/**
 * Cosmetic rickshaw movement (plan.md §3.6). Each rickshaw that is away from
 * its garage drives its own endless random route over the road graph. The
 * route depends only on the rickshaw's key, so it is the same on both maps
 * and every run. None of this feeds back into the simulation.
 */
import type { MapData, Point } from '../map';

/** Metres per simulated minute: about 9 km/h, a laden rickshaw in traffic. */
export const SPEED_M_PER_TICK = 150;

interface Route {
  nodes: number[];
  /** Cumulative distance at each node. */
  at: number[];
  seed: number;
}

/** A small integer hash, so routes need no shared random state. */
function hash(a: number, b: number): number {
  let h = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b + 0x7f4a7c15, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

export class Motion {
  private readonly adj: number[][];
  private readonly routes = new Map<number, Route>();

  constructor(private readonly map: MapData) {
    this.adj = map.graph.nodes.map(() => []);
    for (const [a, b] of map.graph.edges) {
      this.adj[a]!.push(b);
      this.adj[b]!.push(a);
    }
  }

  private route(key: number, start: number): Route {
    let r = this.routes.get(key);
    if (!r) {
      r = { nodes: [start], at: [0], seed: hash(key, 17) };
      this.routes.set(key, r);
    }
    return r;
  }

  private extend(r: Route, distance: number): void {
    const nodes = this.map.graph.nodes;
    while (r.at[r.at.length - 1]! < distance) {
      const here = r.nodes[r.nodes.length - 1]!;
      const prev = r.nodes.length > 1 ? r.nodes[r.nodes.length - 2]! : -1;
      const options = this.adj[here]!;
      let choices = options.filter((n) => n !== prev);
      if (choices.length === 0) choices = options;
      if (choices.length === 0) {
        r.at.push(Infinity);
        r.nodes.push(here);
        return;
      }
      const next = choices[hash(r.seed, r.nodes.length) % choices.length]!;
      const [a, b] = [nodes[here]!, nodes[next]!];
      r.nodes.push(next);
      r.at.push(r.at[r.at.length - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
  }

  /**
   * Where rickshaw `key` is after driving `minutes` from node `start`, and its
   * heading in radians. Routes are cached; a very long drive restarts.
   */
  position(key: number, start: number, minutes: number): { at: Point; heading: number } {
    const nodes = this.map.graph.nodes;
    let r = this.route(key, start);
    // Stagger each rickshaw along its route so they do not move in step.
    const distance = minutes * SPEED_M_PER_TICK + (hash(key, 3) % 400);
    if (distance > 250_000) {
      this.routes.delete(key);
      r = this.route(key, start);
      return this.position(key, start, minutes % 1500);
    }
    this.extend(r, distance);
    // Binary search for the segment.
    let lo = 0;
    let hi = r.at.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (r.at[mid]! <= distance) lo = mid;
      else hi = mid;
    }
    const a = nodes[r.nodes[lo]!]!;
    const b = nodes[r.nodes[hi]!]!;
    const span = r.at[hi]! - r.at[lo]!;
    const t = span > 0 && Number.isFinite(span) ? (distance - r.at[lo]!) / span : 0;
    return { at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], heading: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
}
