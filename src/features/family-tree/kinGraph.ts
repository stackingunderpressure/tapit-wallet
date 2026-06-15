import type { Attestation } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { isPersonNode, readPersonNode, type PersonNodeView } from './personNode.ts';
import { isKinEdge, readKinEdge } from './kinEdge.ts';

// Family-tree CUT 1 — the pure KIN GRAPH + relationship namer.
//
// buildKinGraph reads person-node + kin-edge attestations out of the
// wallet's holdings into a plain in-memory graph (node id = the
// person-node's envelopeId). relationshipLabel walks that graph to NAME
// the tie between any two nodes — direct line (parent / grandparent /
// great^N), collateral blood (sibling, aunt/uncle, cousin Nth-removed),
// and one-hop affinity (spouse, in-law / by-marriage). This is the
// engine behind "it would be able to name that it's third cousins."
//
// Everything here is pure: no I/O, no wallet calls, no time dependence,
// so it is fully unit-testable. Only ONE primitive blood edge is stored
// (parent_of) plus spouse; every label is derived, which is what keeps
// the stored vocabulary tiny and the future merge tractable.

export interface KinNode extends PersonNodeView {
  id: string;
}

export interface KinGraph {
  nodes: Map<string, KinNode>;
  /** child id -> set of parent ids */
  parents: Map<string, Set<string>>;
  /** parent id -> set of child ids */
  children: Map<string, Set<string>>;
  /** id -> set of spouse ids (symmetric) */
  spouses: Map<string, Set<string>>;
}

function addToSet(map: Map<string, Set<string>>, key: string, value: string) {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}

/**
 * Build a kin graph from the wallet's holdings. Person-nodes become
 * nodes keyed by their envelopeId; parent_of and spouse edges become
 * directed / symmetric links. Edges referencing an unknown node id are
 * still recorded structurally (the namer tolerates missing node detail)
 * so a partially-synced tree still walks.
 */
export function buildKinGraph(holdings: readonly Attestation[]): KinGraph {
  const graph: KinGraph = {
    nodes: new Map(),
    parents: new Map(),
    children: new Map(),
    spouses: new Map(),
  };
  for (const att of holdings) {
    if (isPersonNode(att)) {
      const id = envelopeId(att);
      graph.nodes.set(id, { id, ...readPersonNode(att) });
    }
  }
  for (const att of holdings) {
    if (!isKinEdge(att)) continue;
    const edge = readKinEdge(att);
    if (!edge) continue;
    if (edge.relation === 'parent_of') {
      addToSet(graph.parents, edge.to, edge.from);
      addToSet(graph.children, edge.from, edge.to);
    } else {
      addToSet(graph.spouses, edge.from, edge.to);
      addToSet(graph.spouses, edge.to, edge.from);
    }
  }
  return graph;
}

/** Ancestors of `start` (including start at distance 0) by minimal
 *  generation distance, via BFS over parent edges. Cycle-safe. */
function ancestorsOf(graph: KinGraph, start: string): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]]);
  const queue: string[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    const d = dist.get(cur) as number;
    for (const parent of graph.parents.get(cur) ?? []) {
      if (!dist.has(parent)) {
        dist.set(parent, d + 1);
        queue.push(parent);
      }
    }
  }
  return dist;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function greatPrefix(k: number): string {
  return k > 0 ? 'great-'.repeat(k) : '';
}

function ancestorLabel(d: number): string {
  if (d === 1) return 'parent';
  return `${greatPrefix(d - 2)}grandparent`;
}

function descendantLabel(d: number): string {
  if (d === 1) return 'child';
  return `${greatPrefix(d - 2)}grandchild`;
}

function auntUncleLabel(dAncestor: number): string {
  // to is a sibling of from's ancestor at depth dAncestor.
  if (dAncestor === 2) return 'aunt/uncle';
  if (dAncestor === 3) return 'grand-aunt/uncle';
  return `${greatPrefix(dAncestor - 3)}grand-aunt/uncle`;
}

function nieceNephewLabel(dDescendant: number): string {
  if (dDescendant === 2) return 'niece/nephew';
  if (dDescendant === 3) return 'grand-niece/nephew';
  return `${greatPrefix(dDescendant - 3)}grand-niece/nephew`;
}

function cousinLabel(cousinNumber: number, removed: number): string {
  const base = `${ordinal(cousinNumber)} cousin`;
  return removed > 0 ? `${base} ${removed}x removed` : base;
}

/**
 * Pure blood / direct-line relationship of `to` as seen from `from`,
 * or null when they share no traced ancestor. Does NOT consider
 * marriage (see relationshipLabel for affinity).
 */
function bloodLabel(graph: KinGraph, from: string, to: string): string | null {
  if (from === to) return null;
  const ancFrom = ancestorsOf(graph, from);
  const ancTo = ancestorsOf(graph, to);

  // Direct line: to is an ancestor of from, or a descendant of from.
  if (ancFrom.has(to)) return ancestorLabel(ancFrom.get(to) as number);
  if (ancTo.has(from)) return descendantLabel(ancTo.get(from) as number);

  // Collateral: a most-recent common ancestor.
  let best: { dF: number; dT: number } | null = null;
  for (const [anc, dF] of ancFrom) {
    const dT = ancTo.get(anc);
    if (dT === undefined) continue;
    if (dF === 0 || dT === 0) continue; // handled by direct-line above
    if (
      !best ||
      Math.max(dF, dT) < Math.max(best.dF, best.dT) ||
      (Math.max(dF, dT) === Math.max(best.dF, best.dT) &&
        dF + dT < best.dF + best.dT)
    ) {
      best = { dF, dT };
    }
  }
  if (!best) return null;

  const { dF, dT } = best;
  if (dF === 1 && dT === 1) return 'sibling';
  if (dT === 1 && dF >= 2) return auntUncleLabel(dF);
  if (dF === 1 && dT >= 2) return nieceNephewLabel(dT);
  return cousinLabel(Math.min(dF, dT) - 1, Math.abs(dF - dT));
}

function inLawOf(label: string): string {
  if (label === 'sibling' || label === 'parent' || label === 'child') {
    return `${label}-in-law`;
  }
  return `${label} by marriage`;
}

/**
 * Name the relationship of `toId` as seen from `fromId`, or null when
 * no relationship can be traced. Tries: self, spouse, blood/direct
 * line, then one-hop affinity (toId is the spouse of a blood relative,
 * or a blood relative of fromId's spouse). Deeper affinity chains are
 * a follow-on cut.
 */
export function relationshipLabel(
  graph: KinGraph,
  fromId: string,
  toId: string,
): string | null {
  if (fromId === toId) return 'you';
  if (graph.spouses.get(fromId)?.has(toId)) return 'spouse';

  const blood = bloodLabel(graph, fromId, toId);
  if (blood) return blood;

  // Affinity: toId married to a blood relative of mine.
  for (const spouseOfTo of graph.spouses.get(toId) ?? []) {
    const rel = bloodLabel(graph, fromId, spouseOfTo);
    if (rel) return inLawOf(rel);
  }
  // Affinity: toId is a blood relative of my spouse.
  for (const mySpouse of graph.spouses.get(fromId) ?? []) {
    const rel = bloodLabel(graph, mySpouse, toId);
    if (rel) return inLawOf(rel);
  }
  return null;
}

/**
 * Genealogical GENERATION of `to` relative to `from`: positive = older
 * (ancestors / their generation — parent +1, grandparent +2), 0 = same
 * generation (sibling, cousin, spouse), negative = younger (child -1,
 * niece/nephew -1, grandchild -2). Blood only; null when untraceable.
 */
function bloodGeneration(
  graph: KinGraph,
  from: string,
  to: string,
): number | null {
  if (from === to) return 0;
  const ancFrom = ancestorsOf(graph, from);
  const ancTo = ancestorsOf(graph, to);
  if (ancFrom.has(to)) return ancFrom.get(to) as number; // ancestor → +d
  if (ancTo.has(from)) return -(ancTo.get(from) as number); // descendant → -d

  let best: { dF: number; dT: number } | null = null;
  for (const [anc, dF] of ancFrom) {
    const dT = ancTo.get(anc);
    if (dT === undefined) continue;
    if (dF === 0 || dT === 0) continue;
    if (
      !best ||
      Math.max(dF, dT) < Math.max(best.dF, best.dT) ||
      (Math.max(dF, dT) === Math.max(best.dF, best.dT) &&
        dF + dT < best.dF + best.dT)
    ) {
      best = { dF, dT };
    }
  }
  if (!best) return null;
  return best.dF - best.dT;
}

/**
 * Generation of `toId` relative to `fromId`, including affinity: a
 * spouse is the same generation (0); an in-law takes the generation of
 * the blood relative they attach to. Null when no relationship traces.
 */
export function generationOf(
  graph: KinGraph,
  fromId: string,
  toId: string,
): number | null {
  if (fromId === toId) return 0;
  if (graph.spouses.get(fromId)?.has(toId)) return 0;
  const g = bloodGeneration(graph, fromId, toId);
  if (g !== null) return g;
  for (const spouseOfTo of graph.spouses.get(toId) ?? []) {
    const gg = bloodGeneration(graph, fromId, spouseOfTo);
    if (gg !== null) return gg;
  }
  for (const mySpouse of graph.spouses.get(fromId) ?? []) {
    const gg = bloodGeneration(graph, mySpouse, toId);
    if (gg !== null) return gg;
  }
  return null;
}
