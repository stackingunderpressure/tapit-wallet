import {
  generationOf,
  relationshipLabel,
  type KinGraph,
  type KinNode,
} from './kinGraph.ts';

// Family-tree — the pure CONNECTED-TREE layout engine.
//
// treeGenerations groups the graph into flat generation rows; this goes the
// next step and assigns each node a (row, column) so the editor can draw a
// real branching node-link diagram with connector lines, you in the middle.
//
// Layering: row = genealogical generation relative to you (oldest at the top,
// you in the middle, descendants below); untraceable relatives land in one
// extra row at the bottom so nothing is hidden. Column ordering within each
// row is a barycenter sweep -- each node drifts toward the average column of
// its parents and children over a few passes -- so children sit under their
// parents and the lineage lines read cleanly instead of crossing at random.
//
// Pure and deterministic: same graph + selfId always yields the same layout
// (ties break by display name then id), so it is fully unit-testable and the
// canvas component stays a dumb renderer.

export interface PlacedNode {
  id: string;
  node: KinNode;
  /** 0 = top row (oldest generation present). */
  row: number;
  /** Integer slot within the row, 0-based, left to right. */
  col: number;
  /** How many nodes share this row (for centering the row). */
  rowSize: number;
  isSelf: boolean;
  /** Neutral relationship label to you ("you", "parent", …); for the canvas
   *  to gender + show on tap. "relative" when none can be traced. */
  relationship: string;
  /** Genealogical generation relative to you; null when untraceable. */
  generation: number | null;
}

export interface LayoutEdge {
  /** parent_of: the parent. spouse: one partner (order is arbitrary). */
  fromId: string;
  toId: string;
  relation: 'parent' | 'spouse';
}

export interface TreeLayout {
  nodes: PlacedNode[];
  edges: LayoutEdge[];
  rowCount: number;
  /** Widest row's node count — the canvas sizes its grid from this. */
  maxRowSize: number;
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/**
 * Lay the kin graph out as a layered node-link tree relative to `selfId`.
 * When `selfId` is null (no self node yet) every node lands in a single
 * row ordered by name — still a valid, if flat, layout.
 */
export function layoutTree(graph: KinGraph, selfId: string | null): TreeLayout {
  const ids = [...graph.nodes.keys()];

  // 1. Generation per node, and the set of generation values present.
  const genOf = new Map<string, number | null>();
  for (const id of ids) {
    genOf.set(id, selfId ? generationOf(graph, selfId, id) : null);
  }
  const numericGens = [...new Set(
    ids.map((id) => genOf.get(id)).filter((g): g is number => g !== null),
  )].sort((a, b) => b - a); // oldest (highest +) first => top rows

  // Map each generation value to a row index; untraceable (null) gets one
  // extra row at the very bottom.
  const rowOfGen = new Map<number, number>();
  numericGens.forEach((g, i) => rowOfGen.set(g, i));
  const hasUntraceable = ids.some((id) => genOf.get(id) === null);
  const untraceableRow = numericGens.length;
  const rowCount = numericGens.length + (hasUntraceable ? 1 : 0);

  const rowOf = (id: string): number => {
    const g = genOf.get(id) ?? null;
    return g === null ? untraceableRow : (rowOfGen.get(g) as number);
  };

  // 2. Bucket node ids per row, seeded in a stable name/id order.
  const nameOf = (id: string) => graph.nodes.get(id)?.displayName ?? '';
  const stableCmp = (a: string, b: string) =>
    nameOf(a).localeCompare(nameOf(b)) || a.localeCompare(b);
  const rows: string[][] = Array.from({ length: rowCount }, () => []);
  for (const id of ids) rows[rowOf(id)]?.push(id);
  for (const row of rows) row.sort(stableCmp);

  // 3. Barycenter column ordering. col is the integer slot within a row.
  const col = new Map<string, number>();
  rows.forEach((row) => row.forEach((id, i) => col.set(id, i)));

  const reorderRow = (row: string[], desired: (id: string) => number | null) => {
    const keyed = row.map((id) => ({ id, d: desired(id) ?? col.get(id) ?? 0 }));
    keyed.sort((a, b) => a.d - b.d || stableCmp(a.id, b.id));
    keyed.forEach((k, i) => col.set(k.id, i));
    // Keep the row array itself in the new visual order for later sweeps.
    row.splice(0, row.length, ...keyed.map((k) => k.id));
  };

  const parentsCols = (id: string) =>
    [...(graph.parents.get(id) ?? [])]
      .map((p) => col.get(p))
      .filter((c): c is number => c !== undefined);
  const childrenCols = (id: string) =>
    [...(graph.children.get(id) ?? [])]
      .map((c) => col.get(c))
      .filter((c): c is number => c !== undefined);

  for (let pass = 0; pass < 4; pass++) {
    // Down sweep: pull each node toward its parents (the row above).
    for (let r = 1; r < rowCount; r++) {
      const row = rows[r];
      if (row) reorderRow(row, (id) => mean(parentsCols(id)));
    }
    // Up sweep: pull each node toward its children (the row below).
    for (let r = rowCount - 2; r >= 0; r--) {
      const row = rows[r];
      if (row) reorderRow(row, (id) => mean(childrenCols(id)));
    }
  }

  // 4. Emit placed nodes.
  const placed: PlacedNode[] = [];
  rows.forEach((row, r) => {
    row.forEach((id) => {
      const node = graph.nodes.get(id);
      if (!node) return;
      const generation = genOf.get(id) ?? null;
      const relationship =
        id === selfId
          ? 'you'
          : selfId
            ? relationshipLabel(graph, selfId, id) ?? 'relative'
            : 'relative';
      placed.push({
        id,
        node,
        row: r,
        col: col.get(id) ?? 0,
        rowSize: row.length,
        isSelf: id === selfId,
        relationship,
        generation,
      });
    });
  });

  // 5. Edges: parent_of (directed parent->child) + spouse (one per pair).
  const edges: LayoutEdge[] = [];
  for (const [child, parents] of graph.parents) {
    for (const parent of parents) {
      if (graph.nodes.has(parent) && graph.nodes.has(child)) {
        edges.push({ fromId: parent, toId: child, relation: 'parent' });
      }
    }
  }
  const seenSpouse = new Set<string>();
  for (const [a, partners] of graph.spouses) {
    for (const b of partners) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seenSpouse.has(key)) continue;
      seenSpouse.add(key);
      if (graph.nodes.has(a) && graph.nodes.has(b)) {
        edges.push({ fromId: a, toId: b, relation: 'spouse' });
      }
    }
  }

  const maxRowSize = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return { nodes: placed, edges, rowCount, maxRowSize };
}
