import {
  relationshipLabel,
  type KinGraph,
  type KinNode,
} from './kinGraph.ts';

// Family-tree CUT 3 — the merge PROPOSAL brain (pure).
//
// When you handshake a relative you each hold your own tree. This finds
// the candidate OVERLAPS — keyless people who look like the same person
// on both sides — so the wallet can PROPOSE them to a human to confirm.
// It never decides a merge on its own: name collisions are real ("two
// John Smiths aren't one person"), so this only surfaces candidates,
// gated on (a) both nodes connect to the SHARED keyed relative in their
// own tree, (b) names match after normalization, and (c) birth dates are
// compatible (equal, or at least one missing). The human confirms via a
// same_as edge (see kinEdge.buildSameAsEdgeDraft).

export interface MergeCandidate {
  /** The matching node in YOUR tree. */
  mine: KinNode;
  /** The matching node in THEIR tree. */
  theirs: KinNode;
  /** Plain-language why-we-think-so, for the confirm prompt. */
  reason: string;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function datesCompatible(a: KinNode, b: KinNode): boolean {
  if (a.born && b.born && a.born !== b.born) return false;
  if (a.died && b.died && a.died !== b.died) return false;
  return true;
}

function sharedNodeId(graph: KinGraph, sharedPubkey: string): string | null {
  const lc = sharedPubkey.toLowerCase();
  for (const node of graph.nodes.values()) {
    if (node.keyedPubkey?.toLowerCase() === lc) return node.id;
  }
  return null;
}

/** Keyless nodes connected to `anchorId` somewhere in the tree. */
function connectedKeyless(graph: KinGraph, anchorId: string): KinNode[] {
  const out: KinNode[] = [];
  for (const node of graph.nodes.values()) {
    if (node.id === anchorId) continue;
    if (node.keyed) continue; // living/keyed people aren't merge candidates here
    if (relationshipLabel(graph, anchorId, node.id) !== null) out.push(node);
  }
  return out;
}

/**
 * Propose merge candidates between your graph and a relative's graph,
 * anchored on the keyed person you both connect through (`sharedPubkey`).
 * Returns one candidate per plausible (mine, theirs) pair; empty when
 * the shared person isn't found in both trees or nothing lines up.
 * Pure — no I/O. The caller presents these for human confirmation.
 */
export function mergeCandidates(
  mine: KinGraph,
  theirs: KinGraph,
  sharedPubkey: string,
): MergeCandidate[] {
  const myAnchor = sharedNodeId(mine, sharedPubkey);
  const theirAnchor = sharedNodeId(theirs, sharedPubkey);
  if (!myAnchor || !theirAnchor) return [];

  const myCandidates = connectedKeyless(mine, myAnchor);
  const theirCandidates = connectedKeyless(theirs, theirAnchor);

  const out: MergeCandidate[] = [];
  for (const m of myCandidates) {
    const mName = normalizeName(m.displayName);
    if (mName.length === 0) continue;
    for (const t of theirCandidates) {
      if (normalizeName(t.displayName) !== mName) continue;
      if (!datesCompatible(m, t)) continue;
      out.push({
        mine: m,
        theirs: t,
        reason: `You both have "${m.displayName}"${
          m.born ? ` (b. ${m.born})` : ''
        } connected through your shared relative.`,
      });
    }
  }
  return out;
}
