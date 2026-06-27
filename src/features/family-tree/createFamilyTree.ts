import type { Attestation, Wallet } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import { buildPersonNodeDraft, type PersonNodeInput } from './personNode.ts';
import {
  buildParentEdgeDraft,
  buildSpouseEdgeDraft,
  buildSameAsEdgeDraft,
} from './kinEdge.ts';
import { buildPersonEditDraft, type PersonEditState } from './personEdit.ts';

// Family-tree CUT 1 — the impure persistence layer.
//
// Wraps the pure draft builders (personNode / kinEdge) with the standard
// sign -> hold -> queue-anchor pipeline the rest of the wallet uses
// (mirrors createJournalEntry / StartFamilyModal). The caller calls
// save() once after a batch of these, then refreshes. No save() inside
// so adding a person + its edge is a single persist from the caller's
// perspective.

async function signHoldAnchor(
  wallet: Wallet,
  ownerId: string,
  worker: WorkerHandle | null,
  draft: Attestation,
): Promise<{ attestation: Attestation; id: string }> {
  const signed = wallet.sign(draft);
  await wallet.hold(signed);
  const id = envelopeId(signed);
  await anchorQueue.upsert(ownerId, {
    digestHex: id,
    state: 'queued',
    anchor: null,
    attempts: 0,
    last_attempt: null,
    last_error: null,
  });
  if (worker) void worker.kick();
  return { attestation: signed, id };
}

/** Sign + hold + anchor a person-node; returns its node id (envelopeId). */
export async function createPersonNode(
  wallet: Wallet,
  ownerId: string,
  worker: WorkerHandle | null,
  input: PersonNodeInput,
): Promise<{ attestation: Attestation; nodeId: string }> {
  const { attestation, id } = await signHoldAnchor(
    wallet,
    ownerId,
    worker,
    buildPersonNodeDraft(wallet.identity, input),
  );
  return { attestation, nodeId: id };
}

/**
 * Sign + hold + anchor a kin edge. For 'parent_of', `from` is the parent
 * node id and `to` is the child; for 'spouse' the two are symmetric. For
 * 'same_as', `from`/`to` are the two person-node ids being declared one
 * person — symmetric, and ALWAYS the result of an explicit human confirm
 * (never auto-created on a name match). The same_as draft carries ONLY the
 * two node ids plus the author's signature: no names, no dates, no foreign
 * personal data ever rides on the edge.
 */
export async function createKinEdge(
  wallet: Wallet,
  ownerId: string,
  worker: WorkerHandle | null,
  relation: 'parent_of' | 'spouse' | 'same_as',
  from: string,
  to: string,
): Promise<{ attestation: Attestation; edgeId: string }> {
  let draft: Attestation;
  if (relation === 'spouse') {
    draft = buildSpouseEdgeDraft(wallet.identity, from, to);
  } else if (relation === 'same_as') {
    draft = buildSameAsEdgeDraft(wallet.identity, from, to);
  } else {
    draft = buildParentEdgeDraft(wallet.identity, from, to);
  }
  const { attestation, id } = await signHoldAnchor(
    wallet,
    ownerId,
    worker,
    draft,
  );
  return { attestation, edgeId: id };
}

/** The four relations the add-a-relative flow understands, relative to a
 *  target person (yourself, or anyone you've tapped into). */
export type AddRelation = 'parent' | 'child' | 'spouse' | 'sibling';

export interface AddRelativeResult {
  /** The new person-node's id. */
  nodeId: string;
  /** The kin edge that connected them. */
  edgeId: string;
  /** Resulting parent_of [parent, child] pairs, for optimistic UI. */
  newParents: [string, string][];
  /** Resulting spouse [a, b] pairs, for optimistic UI. */
  newSpouses: [string, string][];
}

/**
 * Add a new relative CONNECTED to `targetId` by `relation`, in one place so
 * the tree editor and the Household "add to your tree" path are the SINGLE
 * writer of kin edges — the direction logic (which way a parent_of points,
 * when a spouse edge is symmetric, that a sibling is linked through a shared
 * parent) lives here and only here, and both callers get the same resulting
 * graph deltas back for their optimistic render. Creates the person-node,
 * then the one edge; returns the ids + deltas. Throws BEFORE creating any
 * node when a sibling is asked for without a shared parent, so a failed add
 * never orphans a node.
 */
export async function addRelativeNode(
  wallet: Wallet,
  ownerId: string,
  worker: WorkerHandle | null,
  params: {
    relation: AddRelation;
    /** The person the new relative attaches to. */
    targetId: string;
    /** The target's parent node id — REQUIRED for a sibling (they share it),
     *  ignored otherwise. */
    targetParentId?: string | null;
    person: PersonNodeInput;
  },
): Promise<AddRelativeResult> {
  if (params.relation === 'sibling' && !params.targetParentId) {
    throw new Error(
      'Add a parent for this person first — siblings are linked by the parent they share.',
    );
  }
  const { nodeId } = await createPersonNode(wallet, ownerId, worker, params.person);
  const newParents: [string, string][] = [];
  const newSpouses: [string, string][] = [];
  let edgeId: string;
  if (params.relation === 'parent') {
    ({ edgeId } = await createKinEdge(
      wallet,
      ownerId,
      worker,
      'parent_of',
      nodeId,
      params.targetId,
    ));
    newParents.push([nodeId, params.targetId]);
  } else if (params.relation === 'child') {
    ({ edgeId } = await createKinEdge(
      wallet,
      ownerId,
      worker,
      'parent_of',
      params.targetId,
      nodeId,
    ));
    newParents.push([params.targetId, nodeId]);
  } else if (params.relation === 'spouse') {
    ({ edgeId } = await createKinEdge(
      wallet,
      ownerId,
      worker,
      'spouse',
      params.targetId,
      nodeId,
    ));
    newSpouses.push([params.targetId, nodeId]);
  } else {
    ({ edgeId } = await createKinEdge(
      wallet,
      ownerId,
      worker,
      'parent_of',
      params.targetParentId as string,
      nodeId,
    ));
    newParents.push([params.targetParentId as string, nodeId]);
  }
  return { nodeId, edgeId, newParents, newSpouses };
}

/**
 * Sign + hold + anchor an append-only correction to a person-node (rename,
 * fix dates, set mother/father, or remove). The node id never changes; the
 * correction names it and the graph folds it in latest-wins. Returns the
 * correction's own id.
 */
export async function createPersonEdit(
  wallet: Wallet,
  ownerId: string,
  worker: WorkerHandle | null,
  targetNodeId: string,
  state: PersonEditState,
): Promise<{ attestation: Attestation; editId: string }> {
  const { attestation, id } = await signHoldAnchor(
    wallet,
    ownerId,
    worker,
    buildPersonEditDraft(wallet.identity, targetNodeId, state),
  );
  return { attestation, editId: id };
}
