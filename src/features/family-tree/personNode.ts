import type { Attestation, FieldBranch } from 'tapit-attest';
import { credentialAttestation } from 'tapit-attest';

// Family-tree CUT 1 — the witnessed PERSON NODE.
//
// A person-node is how someone gets a place in the family tree WITHOUT
// holding a wallet. Most ancestors (a great-grandfather, a deceased
// grandmother like Pam) will never have a key, so they cannot sign for
// themselves; the living witness them in. A node is a credential-kind
// attestation (credential_type = 'person_node') signed by the author
// and, later, family-co-signable so the canonical node accretes weight
// (the merge cut binds duplicates onto one id). The node's stable id is
// envelopeId(signedAnchor) — the same content-address every other
// feature uses.
//
// Honesty boundary (same as the Moments cut): born/died are the author's
// CLAIMS about a person, recorded now; the signing date is never forged.
// keyed_pubkey is present ONLY when the person has their own wallet — a
// keyless node can later become keyed when a child gets their own wallet
// (the custody-handoff pattern), but we never invent a key.

/**
 * A person's sex, recorded ONLY so the tree can name kin in the words a
 * family actually uses — mother / father, grandmother / grandfather,
 * sister / brother, daughter / son, aunt / uncle. Optional and never
 * invented: left unset, every derived label stays in its neutral form
 * ("parent", "grandparent") exactly as before.
 */
export type Sex = 'female' | 'male';

export interface PersonNodeInput {
  /** The person's display name, e.g. "Pam Winchester". Required. */
  displayName: string;
  /** Optional birth date claim (YYYY-MM-DD or any Date-parseable). */
  born?: string;
  /** Optional death date claim. Present marks the person as deceased. */
  died?: string;
  /** Optional sex, for gendered kin naming (mother/father, …). */
  sex?: Sex;
  /**
   * The 64-char hex pubkey of this person's own wallet, IF they have
   * one. Absent for keyless witnessed people (most ancestors). Never
   * invented.
   */
  keyedPubkey?: string;
}

export interface PersonNodeView {
  displayName: string;
  born?: string;
  died?: string;
  sex?: Sex;
  keyedPubkey?: string;
  /** True when this person holds their own wallet (keyed_pubkey set). */
  keyed: boolean;
}

function leafValue(att: Attestation, name: string): string {
  const claim = att.claim as FieldBranch;
  const node = claim.children.find((c) => c.name === name);
  if (node && node.node === 'leaf' && typeof node.value === 'string') {
    return node.value;
  }
  return '';
}

/**
 * Build the unsigned credential-kind draft for a person-node. Pure —
 * the caller signs + holds + anchors (and may collect family co-signs)
 * through the existing pipeline. Throws on an empty display name so a
 * node always has something to render.
 *
 * The node's subject is set to the keyed pubkey when the person has a
 * wallet, otherwise to the author's identity (the witness) — the
 * author is attesting "this person exists, as I know them." The node's
 * identity for graph purposes is envelopeId(signed), not the subject.
 */
export function buildPersonNodeDraft(
  authorIdentity: string,
  input: PersonNodeInput,
): Attestation {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    throw new Error('buildPersonNodeDraft: displayName is required');
  }
  const fields: Record<string, string> = {
    credential_type: 'person_node',
    display_name: displayName,
  };
  if (input.born && input.born.trim().length > 0) {
    fields.born = input.born.trim();
  }
  if (input.died && input.died.trim().length > 0) {
    fields.died = input.died.trim();
  }
  if (input.sex === 'female' || input.sex === 'male') {
    fields.sex = input.sex;
  }
  if (input.keyedPubkey && input.keyedPubkey.trim().length > 0) {
    fields.keyed_pubkey = input.keyedPubkey.trim().toLowerCase();
  }
  return credentialAttestation({
    subject:
      input.keyedPubkey && input.keyedPubkey.trim().length > 0
        ? input.keyedPubkey.trim().toLowerCase()
        : authorIdentity,
    tier: 'notable',
    fields,
  });
}

/** True when an attestation is a person-node. */
export function isPersonNode(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'person_node'
  );
}

/** Read a person-node's fields into a plain view. */
export function readPersonNode(att: Attestation): PersonNodeView {
  const keyedPubkey = leafValue(att, 'keyed_pubkey') || undefined;
  const sexRaw = leafValue(att, 'sex');
  const sex: Sex | undefined =
    sexRaw === 'female' || sexRaw === 'male' ? sexRaw : undefined;
  return {
    displayName: leafValue(att, 'display_name') || 'Someone',
    born: leafValue(att, 'born') || undefined,
    died: leafValue(att, 'died') || undefined,
    sex,
    keyedPubkey,
    keyed: Boolean(keyedPubkey),
  };
}
