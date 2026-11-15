/**
 * npx tsx scripts/build-map.ts
 *
 * Turns the OpenStreetMap extract in scripts/map/dhanmondi.osm.json into
 * src/map/dhanmondi.json (plan.md §3.5). Deterministic: the same extract gives
 * the same file. It projects to metres, simplifies shapes, builds the road
 * graph, splits the area between two transformers, sites the ten garages and
 * works out each garage's distance down the wire.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { Building, GarageSite, MapData, Point, Road, RoadClass, TransformerSite } from '../src/map/types';

const SOUTH = 23.7395;
const NORTH = 23.748;
const WEST = 90.37;
const EAST = 90.382;
const LAT0 = (SOUTH + NORTH) / 2;
const M_PER_LAT = 110574;
const M_PER_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const WIDTH = (EAST - WEST) * M_PER_LON;
const HEIGHT = (NORTH - SOUTH) * M_PER_LAT;

const GARAGES_PER_TRANSFORMER = 5;
const BAYS_PER_GARAGE = 20;

interface OsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  geometry: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}
interface OsmRelation {
  type: 'relation';
  id: number;
  members: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[];
  tags?: Record<string, string>;
}
type OsmElement = OsmWay | OsmRelation;

const round = (v: number): number => Math.round(v * 10) / 10;
const project = (g: { lat: number; lon: number }): Point => [round((g.lon - WEST) * M_PER_LON), round((NORTH - g.lat) * M_PER_LAT)];
const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const inside = (p: Point, margin = 0): boolean =>
  p[0] >= -margin && p[0] <= WIDTH + margin && p[1] >= -margin && p[1] <= HEIGHT + margin;

/** Douglas-Peucker simplification. */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;
  const [a, b] = [points[0]!, points[points.length - 1]!];
  let worst = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const len = dist(a, b);
    const d =
      len === 0 ? dist(p, a) : Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
    if (d > worst) {
      worst = d;
      at = i;
    }
  }
  if (worst <= tolerance) return [a, b];
  return [...simplify(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(points.slice(at), tolerance)];
}

function ring(points: Point[], tolerance: number): Point[] {
  const open = dist(points[0]!, points[points.length - 1]!) < 0.01 ? points.slice(0, -1) : points;
  if (open.length <= 4) return open;
  // Simplify as two halves so the ring keeps its shape.
  const half = Math.floor(open.length / 2);
  const s = [...simplify(open.slice(0, half + 1), tolerance).slice(0, -1), ...simplify([...open.slice(half), open[0]!], tolerance).slice(0, -1)];
  return s.length >= 3 ? s : open;
}

function centroid(points: readonly Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
  }
  return [x / points.length, y / points.length];
}

function area(points: readonly Point[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

const ROAD_CLASS: Record<string, RoadClass> = {
  trunk: 'major',
  primary: 'major',
  secondary: 'major',
  secondary_link: 'major',
  tertiary: 'minor',
  tertiary_link: 'minor',
  unclassified: 'minor',
  residential: 'minor',
  living_street: 'lane',
  service: 'lane',
};

// ---------------------------------------------------------------- read

const raw = JSON.parse(readFileSync('scripts/map/dhanmondi.osm.json', 'utf8')) as { elements: OsmElement[] };
const ways = raw.elements.filter((e): e is OsmWay => e.type === 'way');
const relations = raw.elements.filter((e): e is OsmRelation => e.type === 'relation');

// ---------------------------------------------------------------- roads and graph

const roads: Road[] = [];
const nodeIndex = new Map<number, number>();
const nodes: Point[] = [];
const edgeSet = new Set<string>();
const edges: [number, number][] = [];
const adjacency: Map<number, { to: number; w: number }[]> = new Map();

const addNode = (osmId: number, p: Point): number => {
  let i = nodeIndex.get(osmId);
  if (i === undefined) {
    i = nodes.length;
    nodes.push(p);
    nodeIndex.set(osmId, i);
  }
  return i;
};

for (const w of ways) {
  const cls = ROAD_CLASS[w.tags?.highway ?? ''];
  if (!cls) continue;
  const pts = w.geometry.map(project);
  if (!pts.some((p) => inside(p, 60))) continue;
  const name = w.tags?.['name:en'] ?? w.tags?.name ?? null;
  roads.push({ cls, name: name && /[A-Za-z0-9]/.test(name) ? name : name ? 'Satmasjid Road' : null, points: simplify(pts, 0.8) });
  for (let i = 0; i + 1 < w.nodes.length; i++) {
    const a = addNode(w.nodes[i]!, pts[i]!);
    const b = addNode(w.nodes[i + 1]!, pts[i + 1]!);
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || edgeSet.has(key)) continue;
    edgeSet.add(key);
    edges.push([a, b]);
    const d = dist(nodes[a]!, nodes[b]!);
    (adjacency.get(a) ?? adjacency.set(a, []).get(a)!).push({ to: b, w: d });
    (adjacency.get(b) ?? adjacency.set(b, []).get(b)!).push({ to: a, w: d });
  }
}

/** Shortest road distance from one node to every node. */
function dijkstra(source: number): Float64Array {
  const d = new Float64Array(nodes.length).fill(Infinity);
  const done = new Uint8Array(nodes.length);
  d[source] = 0;
  // Simple binary heap.
  const heap: [number, number][] = [[0, source]];
  const push = (item: [number, number]): void => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]![0] <= heap[i]![0]) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };
  while (heap.length > 0) {
    const [du, u] = pop();
    if (done[u]) continue;
    done[u] = 1;
    for (const { to, w } of adjacency.get(u) ?? []) {
      if (du + w < d[to]!) {
        d[to] = du + w;
        push([d[to]!, to]);
      }
    }
  }
  return d;
}

// Keep the largest connected part of the road graph for routing.
const component = new Int32Array(nodes.length).fill(-1);
let biggest = -1;
let biggestSize = 0;
for (let s = 0, c = 0; s < nodes.length; s++) {
  if (component[s] !== -1) continue;
  const stack = [s];
  component[s] = c;
  let size = 0;
  while (stack.length) {
    const u = stack.pop()!;
    size++;
    for (const { to } of adjacency.get(u) ?? []) {
      if (component[to] === -1) {
        component[to] = c;
        stack.push(to);
      }
    }
  }
  if (size > biggestSize) {
    biggestSize = size;
    biggest = c;
  }
  c++;
}
const routable = (i: number): boolean => component[i] === biggest && inside(nodes[i]!, 20);
const nearestNode = (p: Point, filter: (i: number) => boolean = routable): number => {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (!filter(i)) continue;
    const d = dist(p, nodes[i]!);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
};

// ---------------------------------------------------------------- water, parks, buildings

const water: Point[][][] = [];
for (const r of relations) {
  if (r.tags?.natural !== 'water') continue;
  const outers = r.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => ring(m.geometry!.map(project), 1));
  const inners = r.members.filter((m) => m.role === 'inner' && m.geometry).map((m) => ring(m.geometry!.map(project), 1));
  for (const o of outers) water.push([o, ...inners]);
}
for (const w of ways) {
  if (w.tags?.natural !== 'water') continue;
  const pts = w.geometry.map(project);
  if (pts.some((p) => inside(p, 50))) water.push([ring(pts, 1)]);
}

const parks: Point[][] = [];
for (const w of ways) {
  if (w.tags?.leisure !== 'park') continue;
  const pts = w.geometry.map(project);
  if (pts.some((p) => inside(p, 50))) parks.push(ring(pts, 1));
}

// Buildings are drawn as simple boxes lining the real roads, not as the OSM
// footprints: a clean, schematic look (Shafian, 15 November). Boxes sit on
// both sides of every road, set back from it, and never overlap a road, the
// lake or each other. Sizes vary with a hash so the rows do not look stamped.
const HALF_WIDTH: Record<RoadClass, number> = { major: 7.5, minor: 4, lane: 2.5 };
const segments: { a: Point; b: Point; half: number }[] = [];
for (const r of roads) {
  for (let i = 0; i + 1 < r.points.length; i++) segments.push({ a: r.points[i]!, b: r.points[i + 1]!, half: HALF_WIDTH[r.cls] });
}
const segDist = (p: Point, a: Point, b: Point): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const clearOfRoads = (p: Point, margin: number): boolean => segments.every((s) => segDist(p, s.a, s.b) > s.half + margin);
const inRing = (p: Point, r: readonly Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]!;
    const [xj, yj] = r[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inWater = (p: Point): boolean =>
  water.some(([outer, ...islands]) => inRing(p, outer!) && !islands.some((isl) => inRing(p, isl)));
const hash2 = (a: number, b: number): number => {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

const footprints: { points: Point[]; c: Point; area: number; r: number }[] = [];
const cellSize = 40;
const grid = new Map<string, number[]>();
const cellKey = (x: number, y: number): string => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
const overlapsBox = (c: Point, r: number): boolean => {
  const [cx, cy] = [Math.floor(c[0] / cellSize), Math.floor(c[1] / cellSize)];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (const k of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
        const o = footprints[k]!;
        if (dist(o.c, c) < (o.r + r) * 0.82) return true;
      }
  return false;
};
let serial = 0;
for (const s of segments) {
  const len = dist(s.a, s.b);
  if (len < 12) continue;
  const ux = (s.b[0] - s.a[0]) / len;
  const uy = (s.b[1] - s.a[1]) / len;
  for (const side of [-1, 1]) {
    let t = 6;
    while (t < len - 6) {
      serial++;
      const along = 13 + 12 * hash2(serial, 1); // frontage
      const deep = 11 + 9 * hash2(serial, 2); // depth
      const gap = 3.5 + 3 * hash2(serial, 3);
      const mid = t + along / 2;
      if (mid > len - 4) break;
      const off = s.half + 3 + deep / 2;
      const c: Point = [s.a[0] + ux * mid - uy * off * side, s.a[1] + uy * mid + ux * off * side];
      const hx = (ux * along) / 2;
      const hy = (uy * along) / 2;
      const nx = (-uy * deep) / 2;
      const ny = (ux * deep) / 2;
      const corners: Point[] = [
        [round(c[0] - hx - nx), round(c[1] - hy - ny)],
        [round(c[0] + hx - nx), round(c[1] + hy - ny)],
        [round(c[0] + hx + nx), round(c[1] + hy + ny)],
        [round(c[0] - hx + nx), round(c[1] - hy + ny)],
      ];
      const r = Math.hypot(along, deep) / 2;
      const ok =
        inside(c, -4) &&
        corners.every((p) => inside(p, 2) && clearOfRoads(p, 1.5) && !inWater(p)) &&
        clearOfRoads(c, 2) &&
        !inWater(c) &&
        !overlapsBox(c, r);
      if (ok) {
        const k = footprints.length;
        footprints.push({ points: corners, c, area: along * deep, r });
        const key = cellKey(c[0], c[1]);
        (grid.get(key) ?? grid.set(key, []).get(key)!).push(k);
      }
      t += along + gap;
    }
  }
}
footprints.sort((a, b) => a.c[1] - b.c[1] || a.c[0] - b.c[0]);

// ---------------------------------------------------------------- two transformers

// Two-means on building centroids splits the area into a west and an east half.
let centres: Point[] = [
  [WIDTH * 0.25, HEIGHT * 0.5],
  [WIDTH * 0.75, HEIGHT * 0.5],
];
let assign: number[] = [];
for (let iter = 0; iter < 30; iter++) {
  assign = footprints.map((f) => (dist(f.c, centres[0]!) <= dist(f.c, centres[1]!) ? 0 : 1));
  centres = [0, 1].map((k) => {
    const mine = footprints.filter((_, i) => assign[i] === k);
    return centroid(mine.map((f) => f.c));
  });
}
const txNodes = centres.map((c) => nearestNode(c));
const txDist = txNodes.map((n) => dijkstra(n));

// Each building is fed by the transformer nearest by road.
const buildingTx = footprints.map((f) => {
  const n = nearestNode(f.c);
  const [a, b] = [txDist[0]![n]!, txDist[1]![n]!];
  return a <= b ? 0 : 1;
});

// ---------------------------------------------------------------- garages

// Candidates: mid-sized buildings close to a minor road or lane.
const laneNode = (i: number): boolean => routable(i);
const candidates = footprints
  .map((f, i) => ({ f, i, node: nearestNode(f.c, laneNode) }))
  .filter(({ f, node }) => f.area >= 120 && f.area <= 1500 && node >= 0 && dist(f.c, nodes[node]!) <= 30 && inside(f.c, -40));

const garages: GarageSite[] = [];
for (const t of [0, 1]) {
  const mine = candidates.filter((c) => buildingTx[c.i] === t && Number.isFinite(txDist[t]![c.node]!));
  // Farthest-point sampling, starting from the one farthest down the wire,
  // so the garages spread over the area and the feeder values vary.
  const chosen: typeof mine = [];
  const first = mine.reduce((best, c) => (txDist[t]![c.node]! > txDist[t]![best.node]! ? c : best));
  chosen.push(first);
  while (chosen.length < GARAGES_PER_TRANSFORMER) {
    let best = mine[0]!;
    let bd = -1;
    for (const c of mine) {
      const d = Math.min(...chosen.map((x) => dist(x.f.c, c.f.c)));
      if (d > bd) {
        bd = d;
        best = c;
      }
    }
    chosen.push(best);
  }
  const wires = chosen.map((c) => txDist[t]![c.node]!);
  const far = Math.max(...wires);
  chosen
    .map((c, k) => ({ c, wire: wires[k]! }))
    .sort((a, b) => a.wire - b.wire)
    .forEach(({ c, wire }) => {
      garages.push({
        id: `G${garages.length + 1}`,
        at: [round(c.f.c[0]), round(c.f.c[1])],
        node: c.node,
        transformer: t,
        wireMetres: Math.round(wire),
        feeder: Math.round((wire / far) * 1000) / 1000,
        bays: BAYS_PER_GARAGE,
      });
    });
}

// West first.
const order = centres[0]![0] <= centres[1]![0] ? [0, 1] : [1, 0];
const transformers: TransformerSite[] = order.map((t, k) => ({
  id: `T${k + 1}`,
  label: k === 0 ? 'West transformer' : 'East transformer',
  at: nodes[txNodes[t]!]!,
  node: txNodes[t]!,
  buildings: buildingTx.filter((b) => b === t).length,
}));
const remapTx = (t: number): number => order.indexOf(t);

// ---------------------------------------------------------------- compact the graph

// Keep only routable nodes and renumber.
const keep = new Int32Array(nodes.length).fill(-1);
const outNodes: Point[] = [];
for (let i = 0; i < nodes.length; i++) {
  if (component[i] === biggest) {
    keep[i] = outNodes.length;
    outNodes.push(nodes[i]!);
  }
}
const outEdges = edges.filter(([a, b]) => keep[a]! >= 0 && keep[b]! >= 0).map(([a, b]): [number, number] => [keep[a]!, keep[b]!]);

// ---------------------------------------------------------------- labels

const labels: { text: string; at: Point; angle: number }[] = [];
const seen = new Set<string>();
for (const r of [...roads].sort((a, b) => (a.cls === 'major' ? -1 : 0) - (b.cls === 'major' ? -1 : 0))) {
  if (!r.name || seen.has(r.name) || r.points.length < 2) continue;
  // Label at the middle of the longest segment that lies inside the map.
  let best = -1;
  let bl = 0;
  for (let i = 0; i + 1 < r.points.length; i++) {
    const [a, b] = [r.points[i]!, r.points[i + 1]!];
    const l = dist(a, b);
    if (l > bl && inside(a, -30) && inside(b, -30)) {
      bl = l;
      best = i;
    }
  }
  if (best < 0 || bl < 70) continue;
  const [a, b] = [r.points[best]!, r.points[best + 1]!];
  let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  seen.add(r.name);
  labels.push({ text: r.name, at: [round((a[0] + b[0]) / 2), round((a[1] + b[1]) / 2)], angle: Math.round(angle * 1000) / 1000 });
}

// ---------------------------------------------------------------- write

const buildings: Building[] = footprints.map((f, i) => ({ points: f.points, transformer: remapTx(buildingTx[i]!) }));
const map: MapData = {
  name: 'Dhanmondi, Dhaka',
  attribution: '© OpenStreetMap contributors, ODbL',
  width: Math.round(WIDTH),
  height: Math.round(HEIGHT),
  roads,
  buildings,
  water,
  // Parks and road names are left out: the map is roads and boxes only.
  parks: [] as Point[][],
  graph: { nodes: outNodes, edges: outEdges },
  transformers: transformers.map((t) => ({ ...t, node: keep[t.node]! })),
  garages: garages
    .map((g) => ({ ...g, node: keep[g.node]!, transformer: remapTx(g.transformer) }))
    .sort((a, b) => a.transformer - b.transformer || a.wireMetres - b.wireMetres)
    .map((g, k) => ({ ...g, id: `G${k + 1}` })),
  labels: [],
};
const text = JSON.stringify(map);
writeFileSync('src/map/dhanmondi.json', text);
console.log(
  `Wrote src/map/dhanmondi.json: ${(text.length / 1024).toFixed(0)} kB, ${buildings.length} buildings, ${roads.length} roads, ` +
    `${outNodes.length} graph nodes, transformers ${map.transformers.map((t) => `${t.id}@${t.at.map(Math.round)} feeds ${t.buildings}`).join(', ')}`,
);
for (const g of map.garages) console.log(`  ${g.id} T${g.transformer + 1} wire ${g.wireMetres} m feeder ${g.feeder}`);
