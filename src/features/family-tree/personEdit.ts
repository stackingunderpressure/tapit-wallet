import type { Attestation, FieldBranch } from 'tapit-attest';
import { credentialAttestation, envelopeId } from 'tapit-attest';
import { isPersonNode, type PersonNodeView, type Sex } from './personNode.ts';

// Family-tree — the append-only, signed PERSON-NODE EDIT (correction).
//
// A person-node is content-addressed (id = envelopeId of its anchor), so it
// can never be mutated in place -- rewriting it would mint a new id and orphan
// every edge that points at it. Instead a correction is its OWN signed
// attestation that NAMES the node it edits and carries the full new snapshot
// of the editable fields (display name, born, died, sex) -- or a removal flag.
// The graph folds the corrections over the base node, latest-wins, so the tree
// shows the corrected person while the entire chain of who-changed-what-when
// stays on the ledger forever. Nothing is ever destroyed; a fix is just a newer
// signed claim laid on top.
//
// Governance (operator's rule: "after 2 signers, both have to sign to change
// again"): the fold tracks the node's CONTROLLING signer set -- everyone who
// has signed the base node or an applied correction. Once that set reaches two,
// a further correction is only APPLIED if it carries the signatures of all
// controlling signers; otherwise it is held as PENDING co-signature and shown
// in history but not yet reflected on the tree. While a node is solo-controlled
// (the common case today -- you witnessing your own kin), your corrections take
// effect immediately. The model is therefore correct now and lights up the
// moment family co-signing lands; it is never faked.

const CREDENTIAL_TYPE = 'person_node_edit';

/** The editable surface of a person, plus an optional removal. */
export interface PersonEditState {
  /** New display name. Required for a details edit; omitted for a removal. */
  displayName?: string;
  born?: string;
  died?: string;
  sex?: Sex;
  /** When true this correction REMOVES the person from the rendered tree. */
  removed?: boolean;
}

export interface PersonEditView {
  /** envelopeId of this correction attestation. */
  id: string;
  /** The person-node id this correction targets. */
  editsNode: string;
  state: PersonEditState;
  /** Distinct signer pubkeys on this correction (lowercased). */
  signers: string[];
  /** ISO 8601 — when the correction was issued. */
  issuedAt: string;
}

function leafValue(att: Attestation, name: string): string {
  const claim = att.claim as FieldBranch;
  const node = claim.children.find((c) => c.name === name);
  if (node && node.node === 'leaf' && typeof node.value === 'string') {
    return node.value;
  }
  return '';
}

function hasLeaf(att: Attestation, name: string): boolean {
  const claim = att.claim as FieldBranch;
  return claim.children.some((c) => c.name === name && c.node === 'leaf');
}

/**
 * Build the unsigned correction draft. The caller signs + holds + anchors it
 * (and may collect co-signatures) through the standard pipeline. A details
 * edit requires a non-empty display name; a removal sets `removed` and may
 * carry the last-known name purely for the history record.
 */
export function buildPersonEditDraft(
  authorIdentity: string,
  targetNodeId: string,
  state: PersonEditState,
): Attestation {
  const target = targetNodeId.trim();
  if (target.length === 0) {
    throw new Error('buildPersonEditDraft: targetNodeId is required');
  }
  const fields: Record<string, string> = {
    credential_type: CREDENTIAL_TYPE,
    edits_node: target,
  };
  if (state.removed) {
    fields.removed = 'true';
    // Keep the name on a removal only as a human label in history.
    if (state.displayName && state.displayName.trim().length > 0) {
      fields.display_name = state.displayName.trim();
    }
  } else {
    const displayName = (state.displayName ?? '').trim();
    if (displayName.length === 0) {
      throw new Error('buildPersonEditDraft: displayName is required for an edit');
    }
    fields.display_name = displayName;
    if (state.born && state.born.trim().length > 0) fields.born = state.born.trim();
    if (state.died && state.died.trim().length > 0) fields.died = state.died.trim();
    if (state.sex === 'female' || state.sex === 'male') fields.sex = state.sex;
  }
  return credentialAttestation({
    subject: authorIdentity,
    tier: 'notable',
    fields,
  });
}

/** True when an attestation is a person-node correction. */
export function isPersonEdit(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === CREDENTIAL_TYPE
  );
}

/** Read a correction into a plain view, or null when malformed. */
export function readPersonEdit(att: Attestation): PersonEditView | null {
  if (!isPersonEdit(att)) return null;
  const editsNode = leafValue(att, 'edits_node');
  if (editsNode.length === 0) return null;
  const removed = leafValue(att, 'removed') === 'true';
  const sexRaw = leafValue(att, 'sex');
  const sex: Sex | undefined =
    sexRaw === 'female' || sexRaw === 'male' ? sexRaw : undefined;
  const state: PersonEditState = removed
    ? { removed: true, displayName: leafValue(att, 'display_name') || undefined }
    : {
        displayName: leafValue(att, 'display_name') || 'Someone',
        born: hasLeaf(att, 'born') ? leafValue(att, 'born') || undefined : undefined,
        died: hasLeaf(att, 'died') ? leafValue(att, 'died') || undefined : undefined,
        sex,
      };
  const signers = [
    ...new Set(att.signatures.map((s) => s.signer.toLowerCase())),
  ];
  return { id: envelopeId(att), editsNode, state, signers, issuedAt: att.issuedAt };
}

/** A correction as it sits in a person's history, with its governance verdict. */
export interface AppliedEdit extends PersonEditView {
  /** true = reflected on the tree; false = waiting on co-signature. */
  applied: boolean;
}

export interface FoldResult {
  /** The effective person view after applying authoritative corrections. */
  view: PersonNodeView;
  /** True when the latest authoritative state removes the person. */
  removed: boolean;
  /** Everyone who has signed the base node or an applied correction. */
  controllingSigners: string[];
  /** True once two or more signers control the node (co-sign required). */
  requiresCosign: boolean;
  /** Corrections in issued order, each tagged applied vs pending. */
  history: AppliedEdit[];
}

function sortEdits(edits: PersonEditView[]): PersonEditView[] {
  return [...edits].sort(
    (a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.id.localeCompare(b.id),
  );
}

/**
 * Fold a base person view + its corrections into the effective person, honoring
 * the co-signature rule. `baseSigners` is the set of signers on the underlying
 * person-node anchor(s). Pure and deterministic.
 */
export function foldPersonEdits(
  base: PersonNodeView,
  baseSigners: readonly string[],
  edits: readonly PersonEditView[],
): FoldResult {
  const controlling = new Set(baseSigners.map((s) => s.toLowerCase()));
  let view: PersonNodeView = { ...base };
  let removed = false;
  const history: AppliedEdit[] = [];

  for (const edit of sortEdits([...edits])) {
    const requires = controlling.size >= 2;
    const authorized =
      !requires || [...controlling].every((s) => edit.signers.includes(s));
    if (authorized) {
      if (edit.state.removed) {
        removed = true;
      } else {
        removed = false;
        view = {
          ...view,
          displayName: edit.state.displayName ?? view.displayName,
          born: edit.state.born,
          died: edit.state.died,
          sex: edit.state.sex,
        };
      }
      for (const s of edit.signers) controlling.add(s.toLowerCase());
      history.push({ ...edit, applied: true });
    } else {
      history.push({ ...edit, applied: false });
    }
  }

  return {
    view,
    removed,
    controllingSigners: [...controlling],
    requiresCosign: controlling.size >= 2,
    history,
  };
}

/**
 * Read the full change history + governance verdict for one canonical person,
 * straight from holdings. `aliasIds` are every person-node id that resolves to
 * this person (the canonical node carries them); `base` is the person view to
 * fold corrections over. For the UI's edit panel and history list.
 */
export function readPersonChanges(
  holdings: readonly Attestation[],
  aliasIds: readonly string[],
  base: PersonNodeView,
): FoldResult {
  const aliasSet = new Set(aliasIds);
  const baseSigners = new Set<string>();
  const edits: PersonEditView[] = [];
  for (const att of holdings) {
    if (isPersonNode(att) && aliasSet.has(envelopeId(att))) {
      for (const s of att.signatures) baseSigners.add(s.signer.toLowerCase());
    } else if (isPersonEdit(att)) {
      const ev = readPersonEdit(att);
      if (ev && aliasSet.has(ev.editsNode) && !edits.some((e) => e.id === ev.id)) {
        edits.push(ev);
      }
    }
  }
  return foldPersonEdits(base, [...baseSigners], edits);
}
