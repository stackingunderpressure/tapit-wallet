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

/**
 * Relationship leaves that classify as family for downstream
 * affordances — journal-category pre-pick, future recovery-cohort
 * sensible-default ordering, and family-tab grouping. Operator
 * surfaced immediate family as the granularity that matters:
 * spouse + child + parent + sibling are the immediate set, plus
 * 'family' as the catch-all for extended relatives.
 */
export const FAMILY_RELATIONSHIPS: readonly string[] = [
  'spouse',
  'child',
  'parent',
  'sibling',
  'family',
];

/** True when a relationship leaf value classifies as family. */
export function isFamilyRelationship(relationship: string): boolean {
  return FAMILY_RELATIONSHIPS.includes(relationship);
}

export interface HandshakeView {
  initiatorId: string;
  initiatorName: string;
  responderId: string;
  responderName: string;
  verification: string;
  handshakeAt: string;
  /**
   * Optional relationship label both parties agreed to at signing
   * time — 'family', 'friend', 'coworker', 'acquaintance', 'other',
   * or empty when the handshake predates this leaf or the operator
   * chose not to label it. Older handshakes that never carried the
   * leaf read as empty string here.
   */
  relationship: string;
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
    relationship: leafValue(att, 'relationship'),
    familyHint: leafValue(att, 'family_hint'),
  };
}

// Build the unsigned relationship attestation for a handshake. The
// responder calls this — they have scanned the initiator's identity
// and hold their own. The responder signs it, the initiator co-signs
// it, and both hold the co-signed result. The subject is the
// initiator's canonical identity; both parties' ids and names are
// signed leaves so the People tab can name either side. An optional
// relationship leaf records the kind of bond ('family' / 'friend' /
// 'coworker' / 'acquaintance' / 'other') if the operator chose one.
// The leaf is set by the builder and agreed-to by the co-signer
// when they sign the same envelope — both signatures cover the
// relationship value, so it cannot be silently altered later.
export function buildHandshakeDraft(
  initiatorIdentity: Attestation,
  responderIdentity: Attestation,
  relationship?: string,
): Attestation {
  const fields: Record<string, string> = {
    verification: 'in-person',
    handshake_at: new Date().toISOString(),
    initiator_id: initiatorIdentity.subject,
    initiator_name: displayNameOf(initiatorIdentity),
    responder_id: responderIdentity.subject,
    responder_name: displayNameOf(responderIdentity),
  };
  if (relationship && relationship.length > 0) {
    fields.relationship = relationship;
  }
  return relationshipAttestation({
    subject: initiatorIdentity.subject,
    tier: 'notable',
    fields,
  });
}

// Build the unsigned relationship attestation for a Tier R remote
// handshake (5c-ii). The initiator drives — they know the responder's
// pubkey and name (typically from a prior connection via PeerPicker,
// or by manual paste) but the responder is not in the room to scan.
// verification='remote' labels the link honestly per D-09; a verifier
// always sees this is the weaker tier. Optional relationship leaf
// matches the in-person path semantics.
export function buildRemoteHandshakeDraft(
  initiatorIdentity: Attestation,
  responder: { pubkey: string; name: string },
  relationship?: string,
  familyHint?: string,
): Attestation {
  const fields: Record<string, string> = {
    verification: 'remote',
    handshake_at: new Date().toISOString(),
    initiator_id: initiatorIdentity.subject,
    initiator_name: displayNameOf(initiatorIdentity),
    responder_id: responder.pubkey,
    responder_name: responder.name,
  };
  if (relationship && relationship.length > 0) {
    fields.relationship = relationship;
  }
  // Optional family_hint leaf (2026-06-01): when a remote handshake is
  // born from a family-named invite link, the invitee carries the
  // family name they were invited to. Both parties' signatures cover
  // it (same envelope), so the founder receiving the handshake can
  // honestly read "this person accepted your invite to [family]" and
  // pre-target the Add-to-family flow at that family rather than
  // guessing. Display-only hint — the family-unit envelope itself is
  // still built + signed founder-side; this leaf does not add anyone
  // to anything by itself.
  if (familyHint && familyHint.length > 0) {
    fields.family_hint = familyHint;
  }
  return relationshipAttestation({
    subject: initiatorIdentity.subject,
    tier: 'notable',
    fields,
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

// Dedupe handshake envelopes by peer pubkey, keeping the "best" copy
// per peer. Best means: most signatures wins (a cosigned 2-sig
// handshake supersedes a stale 1-sig draft from an earlier attempt
// the peer never reciprocated); on signature-count ties, the newer
// issuedAt wins. Used by HomeScreen.connectionEntries so the People
// tab renders ONE card per peer even when the operator's holdings
// contain multiple handshake envelopes with the same person — which
// happens when an initial handshake attempt stalled with no co-
// signature, the operator tried again later, the second attempt
// succeeded, and now both envelopes sit in holdings (the 1-sig draft
// AND the 2-sig completed). Without this dedup the People tab
// double-renders the peer, which is the operator-reported "showing up
// twice, one connected one pending" bug. Hiding the stale 1-sig
// envelope from the list view does not delete it from holdings — it
// stays as honest history that the operator once offered a handshake
// that never reciprocated.
export function dedupeHandshakesByPeer(
  handshakes: readonly Attestation[],
  myIdentity: string,
): Attestation[] {
  const me = myIdentity.trim().toLowerCase();
  const byPeer = new Map<string, Attestation>();
  for (const a of handshakes) {
    if (!isHandshake(a)) continue;
    const v = readHandshake(a);
    const init = v.initiatorId.trim().toLowerCase();
    const resp = v.responderId.trim().toLowerCase();
    let peer: string;
    if (init === me) peer = resp;
    else if (resp === me) peer = init;
    else continue;
    if (!peer) continue;
    const existing = byPeer.get(peer);
    if (!existing) {
      byPeer.set(peer, a);
      continue;
    }
    if (a.signatures.length > existing.signatures.length) {
      byPeer.set(peer, a);
      continue;
    }
    if (a.signatures.length === existing.signatures.length) {
      const at = new Date(a.issuedAt).getTime();
      const et = new Date(existing.issuedAt).getTime();
      if (Number.isFinite(at) && at > et) byPeer.set(peer, a);
    }
  }
  return [...byPeer.values()];
}

// Find a completed handshake in holdings between the operator and a
// given peer pubkey. "Completed" means a relationship-kind attestation
// carrying a verification leaf (isHandshake true) where both the
// operator and the peer appear as initiator/responder AND both have
// signed the envelope. Used to silence duplicate-handshake replays
// that the Nostr relay re-delivers every wallet unlock — once we
// already have a completed handshake with this peer, any subsequent
// 1-sig handshake envelope from the same peer is a relay replay (or
// a fresh-from-them re-initiation, which the operator does not need
// to re-handle) and should not clutter the inbox as a still-pending
// row. Case-insensitive on both pubkey comparisons; party-order-
// independent so it does not matter who initiated.
export function findCompletedHandshakeWith(
  holdings: readonly Attestation[],
  ownerKeys: string | readonly string[],
  peerPubkey: string,
): Attestation | null {
  // Accept the operator's whole key set, not just one key. A completed
  // handshake records the operator (as a named party AND as a signer)
  // under whichever key was active at handshake time; after a key
  // rotation that is no longer wallet.identity. Comparing a single key
  // let a relay re-delivery of an already-completed connection keep
  // surfacing as an "Absorb signature" row that Dismiss could not
  // silence — it returned every session (operator bug 2026-05-31).
  // Passing wallet.keyHistory makes the guard recognize the connection
  // regardless of which of the operator's keys signed it. The string
  // overload is retained so single-identity callers still work.
  const owners = new Set(
    (typeof ownerKeys === 'string' ? [ownerKeys] : ownerKeys)
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0),
  );
  const peer = peerPubkey.trim().toLowerCase();
  if (owners.size === 0 || !peer || owners.has(peer)) return null;
  for (const a of holdings) {
    if (!isHandshake(a)) continue;
    const v = readHandshake(a);
    const init = v.initiatorId.trim().toLowerCase();
    const resp = v.responderId.trim().toLowerCase();
    // One side must be the peer; the other side must be one of the
    // operator's keys. Capture which owner key it was so the signer
    // check below matches the same key.
    let ownerSide: string | undefined;
    if (init === peer && owners.has(resp)) ownerSide = resp;
    else if (resp === peer && owners.has(init)) ownerSide = init;
    if (ownerSide === undefined) continue;
    const signers = new Set(
      a.signatures.map((s) => s.signer.trim().toLowerCase()),
    );
    if (signers.has(ownerSide) && signers.has(peer)) return a;
  }
  return null;
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
