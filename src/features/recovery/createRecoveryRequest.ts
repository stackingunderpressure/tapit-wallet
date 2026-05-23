import type { Attestation, Wallet } from 'tapit-attest';
import { credentialAttestation } from 'tapit-attest';
import { leafValue } from '../connections/createHandshake.ts';
import { decryptHeldShare, isRecoveryShare, readRecoveryShare } from './createShares.ts';

// Phase 5e-v / 5e-vi envelope helpers — the recovery ceremony's
// two transport-bound message shapes. Both ride the existing
// Mycelium transport (NIP-44 envelope-in-event); neither requires
// a new attestation kind in tapit-attest.
//
// 1. Recovery request — sent from the NEW device's ceremony
//    keypair to each cohort member. Names the OLD operator
//    identity being recovered plus the ceremony's fresh pubkey,
//    asking peers to verify out-of-band and return their share.
//    Credential-kind, subject = old identity, signed by the
//    ceremony keypair (which is NOT the operator's identity yet —
//    that's the whole point of recovery).
//
// 2. Share response — sent from a cohort peer back to the
//    ceremony pubkey after the peer has verified out-of-band and
//    decrypted their held recovery-share. The raw share bytes are
//    re-encrypted from the peer's wallet to the ceremony pubkey
//    using NIP-44, so only the ceremony keypair can read them.
//    Credential-kind, subject = old identity, signed by the
//    peer's wallet.
//
// Model (a) per the Phase 5e roadmap brief: the peer is holding
// an encrypted-to-them share blob distributed at cohort-creation
// time, and re-encrypts it to the ceremony pubkey on demand. No
// per-operator state on the peer beyond the held envelope.

const HEX_64 = /^[0-9a-f]{64}$/i;

// ---------- recovery request (initiator → responder) ----------

/** True when an attestation is a recovery-request from a ceremony keypair. */
export function isRecoveryRequest(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'recovery-request'
  );
}

export interface RecoveryRequestView {
  /** The old operator identity being recovered. */
  oldIdentity: string;
  /** The fresh ceremony keypair the responder should encrypt their share to. */
  newPubkey: string;
  /** Operator-supplied name to help the responder identify the request. */
  operatorName: string;
  /** Operator-supplied free-text note. Optional. */
  message: string;
  /** ISO timestamp the request was built. */
  requestedAt: string;
}

export function readRecoveryRequest(att: Attestation): RecoveryRequestView {
  return {
    oldIdentity: att.subject,
    newPubkey: leafValue(att, 'new_pubkey'),
    operatorName: leafValue(att, 'operator_name'),
    message: leafValue(att, 'message'),
    requestedAt: leafValue(att, 'requested_at'),
  };
}

/**
 * Build + sign a recovery-request envelope. The ceremony wallet is
 * a fresh Wallet generated on the new device; it is NOT the
 * operator's actual identity yet — that's what recovery
 * reconstitutes. The subject of this envelope is the OLD identity,
 * which the operator typed in from memory or out-of-band.
 *
 * The responder verifies the signature is from new_pubkey (which
 * matches the signer of this envelope), then runs strict
 * out-of-band identity verification before releasing their share.
 */
export function buildRecoveryRequestEnvelope(
  ceremonyWallet: Wallet,
  oldIdentity: string,
  operatorName: string,
  message: string,
): Attestation {
  if (!HEX_64.test(oldIdentity)) {
    throw new Error('oldIdentity must be 64-character hex');
  }
  const draft = credentialAttestation({
    subject: oldIdentity,
    tier: 'notable',
    fields: {
      credential_type: 'recovery-request',
      new_pubkey: ceremonyWallet.publicKey,
      operator_name: operatorName.trim(),
      message: message.trim(),
      requested_at: new Date().toISOString(),
    },
  });
  return ceremonyWallet.sign(draft);
}

// ---------- share response (responder → initiator) ----------

/** True when an attestation is a share response back to the ceremony. */
export function isShareResponse(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'recovery-share-response'
  );
}

export interface ShareResponseView {
  /** The old operator identity being recovered (matches the request subject). */
  oldIdentity: string;
  /** The ceremony pubkey the share was re-encrypted to. */
  ceremonyPubkey: string;
  /** The peer pubkey that signed this response. */
  responderPubkey: string;
  /** This share's index in the Shamir scheme (Shamir x-coordinate). */
  shareIndex: number;
  /** Threshold (M of N) for context — the initiator already knows but it's signed too. */
  threshold: number;
  /** Total cohort size. */
  totalShares: number;
  /** NIP-44 ciphertext: the raw Shamir share bytes re-encrypted from responder to ceremony. */
  shareCiphertext: string;
  /** ISO timestamp. */
  respondedAt: string;
}

export function readShareResponse(att: Attestation): ShareResponseView {
  return {
    oldIdentity: att.subject,
    ceremonyPubkey: leafValue(att, 'ceremony_pubkey'),
    responderPubkey: leafValue(att, 'responder_pubkey'),
    shareIndex: Number(leafValue(att, 'share_index')) || 0,
    threshold: Number(leafValue(att, 'share_M')) || 0,
    totalShares: Number(leafValue(att, 'share_N')) || 0,
    shareCiphertext: leafValue(att, 'share_ciphertext'),
    respondedAt: leafValue(att, 'responded_at'),
  };
}

/**
 * Build a share response from a held recovery-share envelope. The
 * peer's wallet decrypts its own share via decryptHeldShare (NIP-44
 * unwrap), then re-encrypts the raw share bytes to the ceremony
 * pubkey. Signed by the peer so the initiator can verify the
 * response came from the cohort member they sent a request to.
 *
 * Throws if the held envelope is not a recovery-share, if it is
 * addressed to a different peer, or if the NIP-44 MAC fails (which
 * catches a tampered or mis-routed envelope).
 */
export function buildShareResponseEnvelope(
  peerWallet: Wallet,
  heldShare: Attestation,
  ceremonyPubkey: string,
): Attestation {
  if (!HEX_64.test(ceremonyPubkey)) {
    throw new Error('ceremonyPubkey must be 64-character hex');
  }
  if (!isRecoveryShare(heldShare)) {
    throw new Error('not a recovery-share envelope');
  }
  const shareView = readRecoveryShare(heldShare);
  const rawShare = decryptHeldShare(peerWallet, heldShare);
  // Hex-encode the raw share bytes for NIP-44 (which takes a string).
  let hex = '';
  for (const b of rawShare.bytes) hex += b.toString(16).padStart(2, '0');
  const reEncrypted = peerWallet.nip44EncryptTo(hex, ceremonyPubkey);
  const draft = credentialAttestation({
    subject: shareView.ownerId,
    tier: 'notable',
    fields: {
      credential_type: 'recovery-share-response',
      ceremony_pubkey: ceremonyPubkey,
      responder_pubkey: peerWallet.publicKey,
      share_index: String(rawShare.index),
      share_M: String(shareView.threshold),
      share_N: String(shareView.totalShares),
      share_ciphertext: reEncrypted,
      responded_at: new Date().toISOString(),
    },
  });
  return peerWallet.sign(draft);
}

/**
 * Decrypt an incoming share-response on the ceremony side. Returns
 * the raw share bytes the ceremony wallet can hand to combineShares
 * along with the other responses. Throws on a MAC failure (which
 * catches a tampered response, wrong-recipient claim, or a
 * mis-routed envelope).
 */
export function decryptShareResponse(
  ceremonyWallet: Wallet,
  response: Attestation,
): { index: number; bytes: Uint8Array } {
  if (!isShareResponse(response)) {
    throw new Error('not a share-response envelope');
  }
  const view = readShareResponse(response);
  if (view.ceremonyPubkey !== ceremonyWallet.publicKey) {
    throw new Error('this share-response is addressed to a different ceremony');
  }
  const hex = ceremonyWallet.nip44DecryptFrom(view.shareCiphertext, view.responderPubkey);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return { index: view.shareIndex, bytes };
}
