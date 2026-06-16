import { relationshipLabel, type KinGraph, type KinNode } from './kinGraph.ts';

// Family-tree EXPLORER slice — the pure walk engine for the focus-and-walk
// navigator. The explorer re-roots on ONE person and shows the three
// directions you can step: UP to that person's parents (the line converges
// toward an apex as you climb), ACROSS to their spouse, and DOWN to their
// children (the legs fan WIDER as you descend). focusNeighbors turns the raw
// parents/spouses/children edge Maps into ordered, named neighbor lists so the
// component can stay a dumb renderer over this. Pure + total: no I/O, no time
// dependence, deterministic ordering, so it is fully unit-testable.

export interface FocusNeighbor {
  node: KinNode;
  /**
   * The neighbor's relationship as seen FROM the focused person (so the card
   * can read "father", "daughter", …). Falls back to a structural word when
   * the graph cannot name it ("parent"/"child"/"spouse").
   */
  relationToFocus: string;
}

export interface FocusNeighbors {
  /** The focused person's parents (the step UP). */
  parents: FocusNeighbor[];
  /** The focused person's spouse(s) (the step ACROSS). */
  spouses: FocusNeighbor[];
  /** The focused person's children (the step DOWN, one per leg). */
  children: FocusNeighbor[];
}

function sortNodes(a: KinNode, b: KinNode): number {
  // Deterministic: by name, then by id, so the same tree always lays out the
  // same way regardless of Set iteration order.
  const an = a.displayName ?? '';
  const bn = b.displayName ?? '';
  if (an !== bn) return an < bn ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function resolve(
  graph: KinGraph,
  focusId: string,
  ids: Iterable<string>,
  structural: 'parent' | 'child' | 'spouse',
): FocusNeighbor[] {
  const out: FocusNeighbor[] = [];
  for (const id of ids) {
    const node = graph.nodes.get(id);
    if (!node) continue; // an edge into a node we don't have detail for
    out.push({
      node,
      relationToFocus: relationshipLabel(graph, focusId, id) ?? structural,
    });
  }
  out.sort((x, y) => sortNodes(x.node, y.node));
  return out;
}

/**
 * The walk-able neighbors of `focusId` — its parents (up), spouses (across),
 * and children (down). Returns empty lists for a missing or edge-only focus
 * node so the component degrades gracefully.
 */
export function focusNeighbors(
  graph: KinGraph,
  focusId: string,
): FocusNeighbors {
  return {
    parents: resolve(graph, focusId, graph.parents.get(focusId) ?? [], 'parent'),
    spouses: resolve(graph, focusId, graph.spouses.get(focusId) ?? [], 'spouse'),
    children: resolve(
      graph,
      focusId,
      graph.children.get(focusId) ?? [],
      'child',
    ),
  };
}
