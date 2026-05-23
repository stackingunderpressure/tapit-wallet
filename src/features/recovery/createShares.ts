import type { Attestation, Wallet } from 'tapit-attest';
import { credentialAttestation, splitSecret, type Share } from 'tapit-attest';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import { envelopeId } from 'tapit-attest';
import { leafValue } from '../connections/createHandshake.ts';
import type { CohortMember } from './createCohort.ts';

// Phase 5e-iii-b-2 (share distribution) — pure helpers that turn
// the operator's K_data into N Shamir shares wrapped as
// credential-kind attestations, one per cohort member. Each share
// is NIP-44 encrypted to the recipient's pubkey, so only that peer
// can decrypt it at recovery time. The envelope itself is signed by
// the operator, so the peer has cryptographic proof the operator
// authorized them as a share-holder.
//
// The peer holds the envelope long-term. At recovery time the peer
// decrypts the share ciphertext using nip44DecryptFrom (their
// privkey + the operator's pubkey as sender), then re-encrypts the
// raw share bytes to the operator's freshly-generated new device
// pubkey using nip44EncryptTo. That's the model-(a) flow from the
// Phase 5e roadmap brief — peer holds an encrypted share blob
// distributed at cohort-creation time and re-encrypts at recovery.

const HEX_64 = /^[0-9a-f]{64}$/i;

/** True when an attestation is a recovery-share credential. */
export function isRecoveryShare(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'recovery-share'
  );
}

export interface RecoveryShareView {
  ownerId: string;
  shareFor: string;
  shareIndex: number;
  shareCiphertext: string;
  threshold: number;
  totalShares: number;
  declaredAt: string;
}

/** Parse a recovery-share envelope's leaves into a plain view. */
export function readRecoveryShare(att: Attestation): RecoveryShareView {
  return {
    ownerId: att.subject,
    shareFor: leafValue(att, 'share_for'),
    shareIndex: Number(leafValue(att, 'share_index')) || 0,
    shareCiphertext: leafValue(att, 'share_ciphertext'),
    threshold: Number(leafValue(att, 'share_M')) || 0,
    totalShares: Number(leafValue(att, 'share_N')) || 0,
    declaredAt: leafValue(att, 'declared_at'),
  };
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Build one signed recovery-share envelope for one peer. The raw
 * share bytes are hex-encoded then NIP-44 encrypted to the peer's
 * pubkey before being placed as a leaf — only the peer can decrypt
 * the share at recovery time. The envelope is signed by the
 * operator so the peer can verify it actually came from the
 * operator they handshaked with.
 */
export function buildRecoveryShareEnvelope(
  wallet: Wallet,
  share: Share,
  peer: CohortMember,
  threshold: number,
  totalShares: number,
): Attestation {
  if (!HEX_64.test(peer.pubkey)) {
    throw new Error(`peer pubkey is not 64-character hex: ${peer.pubkey}`);
  }
  const shareHex = toHex(share.bytes);
  const ciphertext = wallet.nip44EncryptTo(shareHex, peer.pubkey);
  // Numbers are stored as strings so the leafValue helper (which
  // returns strings only) can read them back — matches the existing
  // pattern in other credentials and keeps round-trip-clean.
  const draft = credentialAttestation({
    subject: wallet.identity,
    tier: 'notable',
    fields: {
      credential_type: 'recovery-share',
      share_index: String(share.index),
      share_M: String(threshold),
      share_N: String(totalShares),
      share_for: peer.pubkey,
      share_ciphertext: ciphertext,
      declared_at: new Date().toISOString(),
    },
  });
  return wallet.sign(draft);
}

/**
 * Split K_data into N Shamir shares and build N signed
 * recovery-share envelopes — one per cohort member. Each envelope's
 * share is NIP-44 encrypted to its named recipient. Returns the
 * envelopes plus the peer pubkeys they're addressed to so the
 * caller can distribute them via Mycelium transport in lock-step
 * with the recipient pubkey for the wrapping NIP-44 layer.
 *
 * D-03 stays loud: kData is the symmetric data-encryption key for
 * the v2 backup blob. The signing keypair is NEVER split — only
 * this 32-byte symmetric secret.
 */
export interface SharePackage {
  envelope: Attestation;
  recipient: CohortMember;
}

export function buildRecoveryShares(
  wallet: Wallet,
  kData: Uint8Array,
  cohort: readonly CohortMember[],
  threshold: number,
): SharePackage[] {
  if (kData.length !== 32) {
    throw new Error('kData must be 32 bytes');
  }
  if (cohort.length < 2) {
    throw new Error('cohort must have at least 2 members');
  }
  if (threshold < 2 || threshold > cohort.length) {
    throw new Error('threshold out of range');
  }
  const shares = splitSecret(kData, threshold, cohort.length);
  if (shares.length !== cohort.length) {
    throw new Error('share count did not match cohort size');
  }
  const out: SharePackage[] = [];
  for (let i = 0; i < shares.length; i++) {
    const recipient = cohort[i];
    const share = shares[i];
    if (!recipient || !share) throw new Error('cohort/share index out of range');
    out.push({
      envelope: buildRecoveryShareEnvelope(wallet, share, recipient, threshold, cohort.length),
      recipient,
    });
  }
  return out;
}

/**
 * Decrypt a held recovery-share envelope back to raw share bytes.
 * Used by the responder side of the recovery ceremony: the peer
 * receives a recovery-request, finds the matching held share for
 * the requesting operator, and runs this helper to get the raw
 * Share back. The peer then re-encrypts those bytes to the new
 * device's pubkey and sends it via Mycelium.
 *
 * Throws if the envelope is not a recovery-share, if the wallet
 * isn't the named recipient, or if the NIP-44 MAC fails (catches
 * a tampered ciphertext or a mis-routed envelope).
 */
export function decryptHeldShare(wallet: Wallet, envelope: Attestation): Share {
  if (!isRecoveryShare(envelope)) {
    throw new Error('not a recovery-share envelope');
  }
  const view = readRecoveryShare(envelope);
  if (view.shareFor !== wallet.identity) {
    throw new Error('this share is addressed to someone else');
  }
  // The envelope was signed by the operator (subject == operator id);
  // the NIP-44 sender for decryption is also the operator's pubkey.
  const senderPubkey = view.ownerId;
  const hex = wallet.nip44DecryptFrom(view.shareCiphertext, senderPubkey);
  return { index: view.shareIndex, bytes: fromHex(hex) };
}

/**
 * Hold + anchor a recovery-share envelope received from an
 * operator. Wallet.hold verifies the signature internally; the
 * OpenTimestamps queue picks up the digest the same way it does
 * for memberships and handshakes.
 */
export async function holdRecoveryShare(
  wallet: Wallet,
  ownerId: string,
  anchorWorker: WorkerHandle | null,
  envelope: Attestation,
  myIdentity: string,
): Promise<void> {
  if (!isRecoveryShare(envelope)) {
    throw new Error('not a recovery-share envelope');
  }
  const view = readRecoveryShare(envelope);
  if (view.shareFor !== myIdentity) {
    throw new Error('this recovery-share is addressed to someone else');
  }
  await wallet.hold(envelope);
  const digestHex = envelopeId(envelope);
  await anchorQueue.upsert(ownerId, {
    digestHex,
    state: 'queued',
    anchor: null,
    attempts: 0,
    last_attempt: null,
    last_error: null,
  });
  if (anchorWorker) void anchorWorker.kick();
}
