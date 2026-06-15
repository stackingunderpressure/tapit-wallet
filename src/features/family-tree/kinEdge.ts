import type { Attestation, FieldBranch } from 'tapit-attest';
import { relationshipAttestation } from 'tapit-attest';

// Family-tree CUT 1 — KIN EDGES between person-nodes.
//
// The tree is built from ONE primitive blood edge, parent_of, plus a
// spouse edge for affinity. Everything else — grandparent, sibling,
// aunt/uncle, cousin Nth-removed, in-law — is DERIVED by walking these
// edges (see kinGraph.ts). Keeping the stored vocabulary this tiny is
// what makes the graph composable and the merge cut tractable: two
// trees that agree on the same parent_of edges agree on the whole
// derived structure for free.
//
// An edge is a relationship-kind attestation (the same kind a handshake
// uses) referencing the two person-node ids it connects. The author
// asserts the edge; for keyless endpoints it is family-co-signable so
// the edge accretes weight (the spelling-fix / sibling-agreement flow:
// two siblings each sign parent_of(Mom, them) and the shared Mom node
// binds their graphs). Node ids are envelopeId values of person-node
// anchors.

export type KinRelation = 'parent_of' | 'spouse' | 'same_as';

export interface KinEdgeView {
  relation: KinRelation;
  /** For parent_of: the parent node id. For spouse: one partner id. */
  from: string;
  /** For parent_of: the child node id. For spouse: the other partner. */
  to: string;
}

function leafValue(att: Attestation, name: string): string {
  const claim = att.claim as FieldBranch;
  const node = claim.children.find((c) => c.name === name);
  if (node && node.node === 'leaf' && typeof node.value === 'string') {
    return node.value;
  }
  return '';
}

function buildEdgeDraft(
  authorIdentity: string,
  relation: KinRelation,
  from: string,
  to: string,
): Attestation {
  const f = from.trim();
  const t = to.trim();
  if (f.length === 0 || t.length === 0) {
    throw new Error('buildEdgeDraft: both node ids are required');
  }
  if (f === t) {
    throw new Error('buildEdgeDraft: an edge cannot connect a node to itself');
  }
  return relationshipAttestation({
    subject: authorIdentity,
    tier: 'notable',
    fields: {
      kin_relation: relation,
      kin_from: f,
      kin_to: t,
    },
  });
}

/**
 * parent_of edge: `parentNodeId` is the parent of `childNodeId`.
 * Direction matters — it's what lets the walk tell ancestors from
 * descendants.
 */
export function buildParentEdgeDraft(
  authorIdentity: string,
  parentNodeId: string,
  childNodeId: string,
): Attestation {
  return buildEdgeDraft(authorIdentity, 'parent_of', parentNodeId, childNodeId);
}

/**
 * spouse edge: an affinity link between two partner nodes. Undirected
 * in meaning; stored from/to is arbitrary and the walk treats it
 * symmetrically.
 */
export function buildSpouseEdgeDraft(
  authorIdentity: string,
  aNodeId: string,
  bNodeId: string,
): Attestation {
  return buildEdgeDraft(authorIdentity, 'spouse', aNodeId, bNodeId);
}

/**
 * same_as edge: a HUMAN-CONFIRMED binding declaring two person-nodes are
 * the SAME person. This is how the merge cut fuses a duplicate across two
 * relatives' trees onto one canonical node (the graph union-finds these).
 * Never created automatically on a name match — always a person's
 * confirmation, and family-co-signable so the canonical node accretes
 * weight. Symmetric.
 */
export function buildSameAsEdgeDraft(
  authorIdentity: string,
  aNodeId: string,
  bNodeId: string,
): Attestation {
  return buildEdgeDraft(authorIdentity, 'same_as', aNodeId, bNodeId);
}

/** True when an attestation is a kin edge. */
export function isKinEdge(att: Attestation): boolean {
  if (att.kind !== 'relationship') return false;
  const r = leafValue(att, 'kin_relation');
  return r === 'parent_of' || r === 'spouse' || r === 'same_as';
}

/** Read a kin edge into a plain view, or null when malformed. */
export function readKinEdge(att: Attestation): KinEdgeView | null {
  const relation = leafValue(att, 'kin_relation');
  if (relation !== 'parent_of' && relation !== 'spouse' && relation !== 'same_as') {
    return null;
  }
  const from = leafValue(att, 'kin_from');
  const to = leafValue(att, 'kin_to');
  if (from.length === 0 || to.length === 0) return null;
  return { relation, from, to };
}
