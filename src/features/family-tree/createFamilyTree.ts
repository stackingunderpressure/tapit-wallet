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
