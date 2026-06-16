import type { Attestation } from 'tapit-attest';
import {
  buildKinGraph,
  type KinGraph,
  type KinNode,
} from '../family-tree/kinGraph.ts';

// Friends' trees — the MINIMAL-SHARE PROJECTION (privacy slice, 2026-06-16).
//
// The default share is MINIMAL. A minimal share transmits ONLY each person's
// FIRST NAME plus the tree STRUCTURE (parent_of / spouse / same_as edges by
// node id), and the single shared-anchor keyedPubkey the receiver's
// "people you both know" matcher needs. It NEVER transmits: the surname
// portion of a display name, a born date, a died date, a sex, or any
// keyedPubkey other than the shared anchor's.
//
// The whole privacy rail is that redaction happens at BUILD TIME on the
// SENDER. The sensitive fields are stripped before the bundle is ever
// signed and shipped, so they never cross the wire at all. There is no
// "trust the recipient to hide it" — the recipient is handed a payload
// that physically does not contain the secrets.
//
// Why project from the FOLDED graph (buildKinGraph) and not from raw
// attestations: running buildKinGraph FIRST means the projection reflects
// the latest corrected names (person-edits already applied), the canonical
// fused nodes (same_as already union-found), and the final edge set. It
// also sidesteps person-edit id-orphaning — we never have to re-derive the
// effective state of a node from a pile of append-only edits, because the
// graph already did that. The projection is a snapshot of the rendered
// truth, minus the sensitive fields.

/** One person in a minimal projection: id + first name only. */
export interface ProjectionNode {
  /** The canonical graph node id (envelopeId of a person-node). */
  id: string;
  /**
   * The FIRST whitespace token of the person's display name, and nothing
   * else. "Pam Winchester" -> "Pam". The surname never leaves the wallet.
   */
  firstName: string;
}

/** One structural tie in a minimal projection: relation + the two node ids. */
export interface ProjectionEdge {
  relation: 'parent_of' | 'spouse' | 'same_as';
  from: string;
  to: string;
}

/**
 * The complete minimal share payload. nodes carry only id + firstName;
 * edges carry only structure; anchorNodeId + anchorPubkey preserve the
 * ONE keyedPubkey the receiver's mergeCandidates needs to find the shared
 * relative both trees connect through. Every other keyedPubkey, every
 * date, every sex, and every surname is gone before this object exists.
 */
export interface MinimalTreeProjection {
  nodes: ProjectionNode[];
  edges: ProjectionEdge[];
  /** The shared-anchor node id (the sender's own self-node), or null. */
  anchorNodeId: string | null;
  /** The single preserved keyedPubkey (the anchor's), or null. */
  anchorPubkey: string | null;
}

/** First whitespace token of a name, trimmed. "" when there is no name. */
function firstNameOf(displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) return '';
  return trimmed.split(/\s+/)[0] ?? '';
}

/**
 * Build the minimal projection from the SENDER's own family-tree
 * attestations. Runs buildKinGraph FIRST (fold edits, fuse same_as,
 * resolve final edges) so the projection mirrors the rendered tree, then
 * strips everything sensitive.
 *
 * `anchorPubkey` is the sender's OWN identity pubkey — the keyedPubkey the
 * receiver matches on to anchor mergeCandidates. We preserve that ONE
 * keyedPubkey (on the node it sits on) and drop every other keyedPubkey,
 * so a minimal share still lets "people you both know" work while leaking
 * no other person's wallet key. When the sender has no keyed self-node the
 * anchor is null and the receiver simply renders an unrooted minimal tree.
 *
 * Pure: no I/O, no wallet calls, no time dependence.
 */
export function buildMinimalProjection(
  trees: readonly Attestation[],
  anchorPubkey: string,
): MinimalTreeProjection {
  const graph = buildKinGraph(trees);
  return projectGraph(graph, anchorPubkey);
}

/**
 * Project an already-built KinGraph down to the minimal shape. Split out
 * from buildMinimalProjection so it is independently testable against a
 * hand-built graph. Strips surname, born, died, sex, and every
 * keyedPubkey except the one matching `anchorPubkey`.
 */
export function projectGraph(
  graph: KinGraph,
  anchorPubkey: string,
): MinimalTreeProjection {
  const lc = anchorPubkey.trim().toLowerCase();

  // Find the anchor node: the node whose keyedPubkey is the sender's
  // identity. That is the ONE keyedPubkey we preserve.
  let anchorNodeId: string | null = null;
  let anchorPub: string | null = null;
  if (lc.length > 0) {
    for (const node of graph.nodes.values()) {
      if (node.keyedPubkey?.toLowerCase() === lc) {
        anchorNodeId = node.id;
        anchorPub = node.keyedPubkey ?? null;
        break;
      }
    }
  }

  const nodes: ProjectionNode[] = [];
  for (const node of graph.nodes.values()) {
    nodes.push({ id: node.id, firstName: firstNameOf(node.displayName) });
  }

  const edges: ProjectionEdge[] = [];
  // parent_of: parents map is child -> set(parent). Emit (parent, child).
  for (const [child, parentSet] of graph.parents) {
    for (const parent of parentSet) {
      edges.push({ relation: 'parent_of', from: parent, to: child });
    }
  }
  // spouse: symmetric map; emit each unordered pair once (from < to).
  const seenSpouse = new Set<string>();
  for (const [a, partners] of graph.spouses) {
    for (const b of partners) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seenSpouse.has(key)) continue;
      seenSpouse.add(key);
      const [from, to] = a < b ? [a, b] : [b, a];
      edges.push({ relation: 'spouse', from, to });
    }
  }
  // same_as ties are already folded into canonical nodes by buildKinGraph,
  // so they are not re-emitted here — the structure the receiver renders is
  // the post-fusion canonical graph. (No same_as edge is needed for the
  // receiver to render; the anchor match drives mergeCandidates.)

  return { nodes, edges, anchorNodeId, anchorPubkey: anchorPub };
}

/**
 * Reconstruct a KinGraph DIRECTLY from a minimal projection — no fake
 * signed-attestation objects. The receiver's FriendTreesView renders this
 * graph exactly like a full one (FamilyTreeCanvas + mergeCandidates both
 * consume a KinGraph, not raw attestations). Only the anchor node carries a
 * keyedPubkey; every other node is keyless by construction, which is the
 * whole point — no other key crossed the wire.
 *
 * Pure: builds the same KinGraph shape buildKinGraph produces.
 */
export function kinGraphFromProjection(
  projection: MinimalTreeProjection,
): KinGraph {
  const graph: KinGraph = {
    nodes: new Map(),
    parents: new Map(),
    children: new Map(),
    spouses: new Map(),
  };

  const anchorLc = projection.anchorNodeId;
  const anchorPub = projection.anchorPubkey ?? undefined;

  for (const pn of projection.nodes) {
    const isAnchor = anchorLc !== null && pn.id === anchorLc;
    const keyedPubkey = isAnchor ? anchorPub : undefined;
    const node: KinNode = {
      id: pn.id,
      aliasIds: [pn.id],
      displayName: pn.firstName.length > 0 ? pn.firstName : 'Someone',
      // born / died / sex deliberately absent — they never crossed the wire.
      keyedPubkey,
      keyed: Boolean(keyedPubkey),
    };
    graph.nodes.set(pn.id, node);
  }

  for (const edge of projection.edges) {
    if (edge.relation === 'parent_of') {
      addToSet(graph.parents, edge.to, edge.from);
      addToSet(graph.children, edge.from, edge.to);
    } else if (edge.relation === 'spouse') {
      addToSet(graph.spouses, edge.from, edge.to);
      addToSet(graph.spouses, edge.to, edge.from);
    }
    // same_as is not carried in a minimal projection (already folded).
  }

  return graph;
}

function addToSet(map: Map<string, Set<string>>, key: string, value: string) {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}
