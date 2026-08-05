import type { Attestation, FieldBranch, SuccessionLink } from 'tapit-attest';
import { credentialAttestation, verifySuccessionChain } from 'tapit-attest';

// Peer key-succession — the substrate that lets messaging follow a peer
// across a key rotation (audit 2026-06-15, attack-list "messaging audit").
//
// THE PROBLEM: when a peer rotates their key, their new messages arrive
// signed by a new pubkey. Nothing today tells the receiver that new key is
// the same person, so the message lands in an invisible new thread. The
// library can already PROVE a new key descends from an old one
// (verifySuccessionChain), and that proof is unforgeable — each link is
// signed by the retiring key, so only the real person can extend their own
// chain. What's missing is (1) delivering that proof to peers and (2)
// resolving an incoming key through it. This module is the pure foundation
// for both: the announcement envelope a rotating peer sends, and the
// verified key-alias resolver the receiver builds from announcements it
// holds. No wiring here — send-on-rotate, inbox ingest, and messaging
// resolution are the follow-on cuts.

const CREDENTIAL_TYPE = 'key-succession';

function leafValue(att: Attestation, name: string): string {
  const claim = att.claim as FieldBranch;
  const node = claim.children.find((c) => c.name === name);
  return node && node.node === 'leaf' && typeof node.value === 'string'
    ? node.value
    : '';
}

/**
 * Build the unsigned announcement a rotating wallet sends to its known
 * peers, carrying its full succession chain so each peer can verify the
 * new key descends from the key they already know. The caller signs it
 * with the CURRENT key and ships it via sendEnvelope. Subject is the
 * genesis (identity) key — the canonical id peers recognize.
 */
export function buildKeySuccessionAnnouncement(
  chain: SuccessionLink[],
): Attestation {
  const first = chain[0];
  if (!first) {
    throw new Error('buildKeySuccessionAnnouncement: empty chain');
  }
  const genesis = first.fromKey;
  return credentialAttestation({
    subject: genesis,
    tier: 'notable',
    fields: {
      credential_type: CREDENTIAL_TYPE,
      chain: JSON.stringify(chain),
    },
  });
}

/** True when an attestation is a key-succession announcement. */
export function isKeySuccessionAnnouncement(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === CREDENTIAL_TYPE
  );
}

/** Read the carried succession chain, or null when absent/malformed. */
export function readSuccessionChain(att: Attestation): SuccessionLink[] | null {
  const raw = leafValue(att, 'chain');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SuccessionLink[]) : null;
  } catch {
    return null;
  }
}

/**
 * True when an announcement is trustworthy: its chain verifies end to end
 * AND the envelope is signed by the chain's current key. The gate used
 * both when ingesting a peer's announcement and when building the alias
 * map, so junk/forged announcements never get held or trusted.
 */
export function isVerifiedAnnouncement(att: Attestation): boolean {
  if (!isKeySuccessionAnnouncement(att)) return false;
  const chain = readSuccessionChain(att);
  if (!chain || chain.length === 0) return false;
  const result = verifySuccessionChain(chain);
  if (!result.valid || !result.currentKey) return false;
  const current = result.currentKey.toLowerCase();
  return (att.signatures ?? []).some((s) => s.signer.toLowerCase() === current);
}

/**
 * Resolver from any key a peer has used → their canonical (genesis) key,
 * plus canonical → current key. Built ONLY from announcements whose chain
 * cryptographically verifies AND that are signed by the chain's current
 * key (so a replayed/forged envelope can't poison the map). Pure.
 */
export interface PeerKeyAlias {
  /** any key (lowercased) → canonical genesis key (lowercased). */
  canonicalOf: Map<string, string>;
  /** canonical genesis key (lowercased) → current active key (lowercased). */
  currentOf: Map<string, string>;
}

export function buildPeerKeyAlias(
  holdings: readonly Attestation[],
): PeerKeyAlias {
  const canonicalOf = new Map<string, string>();
  const currentOf = new Map<string, string>();
  for (const att of holdings) {
    if (!isKeySuccessionAnnouncement(att)) continue;
    const chain = readSuccessionChain(att);
    const first = chain && chain[0];
    if (!first) continue;
    const result = verifySuccessionChain(chain);
    if (!result.valid || !result.currentKey) continue;
    const current = result.currentKey.toLowerCase();
    // Authenticity: the announcement must be signed by the chain's current
    // key — the only key that legitimately speaks for this lineage now.
    const signedByCurrent = (att.signatures ?? []).some(
      (s) => s.signer.toLowerCase() === current,
    );
    if (!signedByCurrent) continue;
    const genesis = first.fromKey.toLowerCase();
    canonicalOf.set(genesis, genesis);
    for (const link of chain) {
      canonicalOf.set(link.fromKey.toLowerCase(), genesis);
      canonicalOf.set(link.toKey.toLowerCase(), genesis);
    }
    // Latest announcement wins for the current key (more links = newer).
    const prior = currentOf.get(genesis);
    if (!prior || chain.length > 0) currentOf.set(genesis, current);
  }
  return { canonicalOf, currentOf };
}

/** The canonical (genesis) key for a pubkey, or the pubkey itself if unknown. */
export function resolveCanonical(pubkey: string, alias: PeerKeyAlias): string {
  const lc = pubkey.toLowerCase();
  return alias.canonicalOf.get(lc) ?? lc;
}

/** The current active key to address for a pubkey (walks rotation forward). */
export function resolveCurrent(pubkey: string, alias: PeerKeyAlias): string {
  const canonical = resolveCanonical(pubkey, alias);
  return alias.currentOf.get(canonical) ?? canonical;
}

/**
 * Convert a PeerKeyAlias into the genesis -> [every known key] shape that
 * familyUnit.ts's memberHasSigned / familySignatureProgress expect (the
 * same shape PeopleTree.tsx already builds for the operator's OWN
 * key history via wallet.keyHistory). Every key that canonicalizes to
 * the same genesis becomes one entry, so a PEER's post-rotation
 * signature is recognized against the genesis pubkey stored in a
 * shared family_unit's members[] list -- the same bridge messaging
 * already gets via resolveCanonical/resolveCurrent, applied to
 * ratification counting instead of thread lookup. Without this, a
 * viewer's own PeopleTree only ever knows its own rotation history,
 * never a remote member's, so that member's family tree silently
 * stops showing as ratified the moment they rotate (the gap named in
 * familyUnit.ts's familySignatureProgress doc comment).
 */
export function peerKeyAliasToKeyHistoryMap(
  alias: PeerKeyAlias,
): Map<string, string[]> {
  const byGenesis = new Map<string, string[]>();
  for (const [key, genesis] of alias.canonicalOf) {
    const list = byGenesis.get(genesis);
    if (list) {
      list.push(key);
    } else {
      byGenesis.set(genesis, [key]);
    }
  }
  return byGenesis;
}
