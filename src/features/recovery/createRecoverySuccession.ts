import type { Attestation, FieldBranch, Wallet } from 'tapit-attest';
import { credentialAttestation } from 'tapit-attest';
import { leafValue } from '../connections/createHandshake.ts';

// Phase 5e-vii — peer-witnessed recovery-succession credential.
// The third shape of the succession chain per MYCELIUM_NETWORK_SPEC
// section 12, alongside self-signed rotation (Wallet.rotate) and
// dual-signed transition (CustodyHandoffModal). A wallet that has
// just been restored via the cohort cascade emits this credential
// asserting "I was recovered on date X from cohort Y," and the
// cohort peers add their signatures to witness that the recovery
// actually happened with their cooperation.
//
// The envelope shape is a single credential-kind attestation:
//
//   subject       = the recovered wallet's identity (same as old —
//                   restoreFromKData reconstitutes the original)
//   credential_type = 'recovery-succession'
//   previous_key  = the keypair at the moment of recovery (the
//                   snapshotted active key the restored wallet now
//                   holds)
//   new_key       = previous_key today (the v1 of this credential —
//                   later we may pair recovery with a fresh rotation
//                   and new_key would be the post-rotation pubkey)
//   recovered_at  = ISO timestamp
//   cohort        = canonical-JSON array of cohort pubkeys the
//                   operator declared as their witnesses
//
// Signatures: the restored wallet signs first (self-attestation of
// "the recovery happened"); each cohort peer who agrees adds their
// signature via the existing signEnvelope-is-idempotent path. Once
// M peer signatures are present (plus the restored wallet's self-
// signature), the envelope is the M-of-N peer-witnessed succession
// the spec calls for.
//
// No new envelope wrap shapes for the protocol — the credential
// itself IS both the request (sent unsigned-by-peer for the peer to
// review and sign) and the response (sent back signed-by-peer for
// the initiator to merge). The blended-transport pattern from Cut 4
// of the cohort cascade applies directly: Mycelium publishes via
// sendEnvelopeTo, in-person paths render the envelope as QR. The
// mergeSignatures helper in cosigning/ handles the absorb step.
//
// D-03 stays loud: the signing keypair is not modified by this
// credential. previous_key + new_key are LEAVES naming the existing
// active key — the credential is a witness statement about identity
// continuity, not a key-change operation.

const HEX_64 = /^[0-9a-f]{64}$/i;

/** True when an attestation is a recovery-succession credential. */
export function isRecoverySuccession(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'recovery-succession'
  );
}

export interface RecoverySuccessionView {
  /** The recovered wallet identity (same as old; restoreFromKData reconstitutes). */
  identity: string;
  /** The key at the moment of recovery. */
  previousKey: string;
  /** The key the credential makes authoritative going forward. */
  newKey: string;
  /** ISO timestamp the credential was minted. */
  recoveredAt: string;
  /** The cohort pubkeys the operator declared as their witnesses. */
  cohort: string[];
}

export function readRecoverySuccession(att: Attestation): RecoverySuccessionView {
  let cohort: string[] = [];
  const raw = leafValue(att, 'cohort');
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const accum: string[] = [];
        for (const entry of parsed) {
          if (typeof entry === 'string' && HEX_64.test(entry)) {
            accum.push(entry.toLowerCase());
          }
        }
        cohort = accum;
      }
    } catch {
      // Malformed cohort leaf — treat as empty.
    }
  }
  return {
    identity: att.subject,
    previousKey: leafValue(att, 'previous_key'),
    newKey: leafValue(att, 'new_key'),
    recoveredAt: leafValue(att, 'recovered_at'),
    cohort,
  };
}

/**
 * Build + self-sign a recovery-succession credential. The restored
 * wallet is the initiator: its identity becomes the subject, its
 * current active key fills both previous_key and new_key (the v1
 * shape — pair-with-rotation is a future refinement), and its
 * signature is the first one on the envelope. Peers then add their
 * signatures to witness.
 *
 * The cohort argument is the list of cohort-member pubkeys the
 * operator declared at cohort-creation — NOT the subset of peers
 * who actually responded with shares. The envelope records who was
 * eligible to witness; signature presence records who actually did.
 *
 * Normalizes + deduplicates + sorts the cohort array so the
 * canonical JSON leaf is stable regardless of input ordering.
 */
export function buildRecoverySuccession(
  restoredWallet: Wallet,
  cohort: readonly string[],
): Attestation {
  const normalized = Array.from(
    new Set(
      cohort
        .map((pk) => pk.trim().toLowerCase())
        .filter((pk) => HEX_64.test(pk)),
    ),
  ).sort();
  const draft = credentialAttestation({
    subject: restoredWallet.identity,
    tier: 'notable',
    fields: {
      credential_type: 'recovery-succession',
      previous_key: restoredWallet.publicKey,
      new_key: restoredWallet.publicKey,
      recovered_at: new Date().toISOString(),
      cohort: normalized,
    },
  });
  return restoredWallet.sign(draft);
}

/**
 * Count distinct cohort-member signatures on the succession envelope.
 * Returns the number of signatures from pubkeys that appear in the
 * envelope's cohort leaf. The initiator's own signature does NOT
 * count — peer-witnessed means peers other than the recovered
 * wallet itself.
 *
 * The dedupe-by-signer is what guards against a peer adding two
 * signatures (e.g., via key rotation). One peer, one witness vote.
 */
export function countPeerSignatures(att: Attestation): number {
  if (!isRecoverySuccession(att)) return 0;
  const view = readRecoverySuccession(att);
  const cohortSet = new Set(view.cohort);
  const seenSigners = new Set<string>();
  let count = 0;
  for (const sig of att.signatures) {
    if (sig.signer === view.identity) continue;
    if (!cohortSet.has(sig.signer.toLowerCase())) continue;
    if (seenSigners.has(sig.signer)) continue;
    seenSigners.add(sig.signer);
    count += 1;
  }
  return count;
}

/**
 * Has the envelope reached the M-of-N witness threshold? True when
 * the count of distinct cohort-member signatures is at least
 * threshold. The caller supplies threshold from the operator's
 * declared cohort credential (publishCohort writes it as the
 * threshold leaf).
 */
export function hasReachedThreshold(att: Attestation, threshold: number): boolean {
  return countPeerSignatures(att) >= threshold;
}

// Type-only — re-exported FieldBranch keeps the inline type usable
// without re-importing from tapit-attest at call sites that already
// import from this module.
export type { FieldBranch };
