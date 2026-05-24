import type { Attestation, FieldBranch, Wallet } from 'tapit-attest';
import { relationshipAttestation, envelopeId } from 'tapit-attest';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';

// Phase 5a — the in-person handshake. A handshake is one
// relationship-kind attestation, co-signed by both wallets, carrying
// a verification=in-person leaf (Tier P, per MYCELIUM_NETWORK_SPEC.md
// section 4). Both wallets hold the co-signed record; the home People
// tab reads it. Built locally — no networking.

export function leafValue(att: Attestation, name: string): string {
  const claim = att.claim as FieldBranch;
  const node = claim.children.find((c) => c.name === name);
  if (node && node.node === 'leaf' && typeof node.value === 'string') {
    return node.value;
  }
  return '';
}

/** The display name a wallet wrote into its own identity attestation. */
export function displayNameOf(identity: Attestation): string {
  return leafValue(identity, 'display_name') || 'Someone';
}

/** True when an attestation is an in-person handshake record. */
export function isHandshake(att: Attestation): boolean {
  return att.kind === 'relationship' && leafValue(att, 'verification').length > 0;
}

export interface HandshakeView {
  initiatorId: string;
  initiatorName: string;
  responderId: string;
  responderName: string;
  verification: string;
  handshakeAt: string;
}

/** Read a handshake attestation's fields into a plain view. */
export function readHandshake(att: Attestation): HandshakeView {
  return {
    initiatorId: leafValue(att, 'initiator_id'),
    initiatorName: leafValue(att, 'initiator_name'),
    responderId: leafValue(att, 'responder_id'),
    responderName: leafValue(att, 'responder_name'),
    verification: leafValue(att, 'verification'),
    handshakeAt: leafValue(att, 'handshake_at'),
  };
}

// Build the unsigned relationship attestation for a handshake. The
// responder calls this — they have scanned the initiator's identity
// and hold their own. The responder signs it, the initiator co-signs
// it, and both hold the co-signed result. The subject is the
// initiator's canonical identity; both parties' ids and names are
// signed leaves so the People tab can name either side.
export function buildHandshakeDraft(
  initiatorIdentity: Attestation,
  responderIdentity: Attestation,
): Attestation {
  return relationshipAttestation({
    subject: initiatorIdentity.subject,
    tier: 'notable',
    fields: {
      verification: 'in-person',
      handshake_at: new Date().toISOString(),
      initiator_id: initiatorIdentity.subject,
      initiator_name: displayNameOf(initiatorIdentity),
      responder_id: responderIdentity.subject,
      responder_name: displayNameOf(responderIdentity),
    },
  });
}

// Build the unsigned relationship attestation for a Tier R remote
// handshake (5c-ii). The initiator drives — they know the responder's
// pubkey and name (typically from a prior connection via PeerPicker,
// or by manual paste) but the responder is not in the room to scan.
// verification='remote' labels the link honestly per D-09; a verifier
// always sees this is the weaker tier.
export function buildRemoteHandshakeDraft(
  initiatorIdentity: Attestation,
  responder: { pubkey: string; name: string },
): Attestation {
  return relationshipAttestation({
    subject: initiatorIdentity.subject,
    tier: 'notable',
    fields: {
      verification: 'remote',
      handshake_at: new Date().toISOString(),
      initiator_id: initiatorIdentity.subject,
      initiator_name: displayNameOf(initiatorIdentity),
      responder_id: responder.pubkey,
      responder_name: responder.name,
    },
  });
}

// Build a pubkey → display-name lookup from the operator's holdings.
// Pulls from every handshake (initiator/responder pair) and every
// held identity attestation. The operator's own identity is included
// keyed by their identity pubkey so any UI displaying "from
// <senderPubkey>" can resolve to "You" for self-CC envelopes. Most-
// recent name wins on pubkey collisions so a peer who later updated
// their identity attestation's display name shows the current value.
//
// Used by InboxPanel + EnvelopePreview + anywhere else a raw pubkey
// would otherwise leak into user-facing copy. Nobody recognizes a
// hex string; everyone recognizes a name.
export function peerNamesByPubkey(
  holdings: readonly Attestation[],
  myIdentity: string,
  myDisplayName?: string,
): Map<string, string> {
  const out = new Map<string, string>();
  // Sort by issuedAt so newer attestations overwrite older entries.
  const sorted = [...holdings].sort((a, b) => {
    const ta = new Date(a.issuedAt).getTime();
    const tb = new Date(b.issuedAt).getTime();
    return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
  });
  for (const att of sorted) {
    if (att.kind === 'identity') {
      const name = leafValue(att, 'display_name');
      if (name && att.subject) out.set(att.subject.toLowerCase(), name);
    } else if (isHandshake(att)) {
      const v = readHandshake(att);
      if (v.initiatorId && v.initiatorName) {
        out.set(v.initiatorId.toLowerCase(), v.initiatorName);
      }
      if (v.responderId && v.responderName) {
        out.set(v.responderId.toLowerCase(), v.responderName);
      }
    }
  }
  if (myIdentity) {
    out.set(myIdentity.toLowerCase(), myDisplayName || 'You');
  }
  return out;
}

// Hold a handshake attestation and queue it for OpenTimestamps
// anchoring — the same pipeline journal entries use. envelopeId is
// stable across signature additions, so anchoring is idempotent
// whether called on the single-signed or the co-signed envelope.
export async function holdAndAnchor(
  wallet: Wallet,
  ownerId: string,
  worker: WorkerHandle | null,
  att: Attestation,
): Promise<void> {
  await wallet.hold(att);
  const digestHex = envelopeId(att);
  await anchorQueue.upsert(ownerId, {
    digestHex,
    state: 'queued',
    anchor: null,
    attempts: 0,
    last_attempt: null,
    last_error: null,
  });
  if (worker) void worker.kick();
}
