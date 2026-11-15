/**
 * The map of the district (plan.md §3.5). Produced by scripts/build-map.ts
 * from an OpenStreetMap extract and committed as dhanmondi.json, so the app
 * needs no network. Coordinates are metres: x east, y south, from the
 * north-west corner of the extract.
 */

export type Point = readonly [number, number];

export type RoadClass = 'major' | 'minor' | 'lane';

export interface Road {
  readonly cls: RoadClass;
  readonly name: string | null;
  readonly points: readonly Point[];
}

export interface Building {
  readonly points: readonly Point[];
  /** Index of the transformer that feeds it. */
  readonly transformer: number;
}

export interface TransformerSite {
  readonly id: string;
  readonly label: string;
  readonly at: Point;
  /** Graph node the transformer stands on. */
  readonly node: number;
  /** Buildings it feeds. */
  readonly buildings: number;
}

export interface GarageSite {
  readonly id: string;
  readonly at: Point;
  /** Graph node at the garage gate. */
  readonly node: number;
  readonly transformer: number;
  /** Road distance from the transformer, in metres. */
  readonly wireMetres: number;
  /** wireMetres scaled so the farthest garage on its transformer is 1. */
  readonly feeder: number;
  readonly bays: number;
}

export interface RoadGraph {
  readonly nodes: readonly Point[];
  /** Pairs of node indices. Undirected. */
  readonly edges: readonly (readonly [number, number])[];
}

export interface MapData {
  readonly name: string;
  readonly attribution: string;
  readonly width: number;
  readonly height: number;
  readonly roads: readonly Road[];
  readonly buildings: readonly Building[];
  /** Water polygons; each is an outer ring followed by any islands. */
  readonly water: readonly (readonly (readonly Point[])[])[];
  readonly parks: readonly (readonly Point[])[];
  readonly graph: RoadGraph;
  readonly transformers: readonly TransformerSite[];
  readonly garages: readonly GarageSite[];
  /** Labels for the main roads: text, position and angle in radians. */
  readonly labels: readonly { readonly text: string; readonly at: Point; readonly angle: number }[];
}
