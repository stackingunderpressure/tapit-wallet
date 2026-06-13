import type { Attestation, Wallet } from 'tapit-attest';
import { credentialAttestation, envelopeId } from 'tapit-attest';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import { leafValue } from '../connections/createHandshake.ts';

// B-1 "held / recognized pieces" (attack-list 2026-06-13). Turns a sent piece
// of a "Your secrets" Shamir split from an opaque chat DM into a RECOGNIZED
// HELD OBJECT: a structured credential the holder's wallet understands, can
// keep or let go, and acknowledges back. Mirrors the recovery-share envelope
// (createShares.ts) — the piece token is NIP-44 encrypted to the holder so
// only they can read it, the envelope is signed by the owner so the holder can
// verify it came from the person they connected with.
//
// Two envelope shapes live here:
//   secret-piece          — owner -> holder; carries the encrypted piece token.
//   secret-piece-receipt  — holder -> owner; "I'm holding piece X of secret Y,
//                           as of <date>" (status 'held') OR "I let it go"
//                           (status 'declined'). The owner records it so the
//                           secret's detail shows the piece as confirmed.
//
// METADATA on the receipt is safe (it names a secret id + piece index + a
// date, never the token or the secret). The piece token itself only ever
// travels encrypted-to-the-holder inside the secret-piece envelope.

const HEX_64 = /^[0-9a-f]{64}$/i;

// ---- secret-piece (owner -> holder) ----

export function isSecretPiece(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'secret-piece'
  );
}

export interface SecretPieceView {
  ownerId: string;
  ownerName: string;
  secretId: string;
  secretName: string;
  pieceIndex: number;
  threshold: number;
  total: number;
  pieceFor: string;
  ciphertext: string;
  hash: string;
  declaredAt: string;
}

export function readSecretPiece(att: Attestation): SecretPieceView {
  return {
    ownerId: att.subject,
    ownerName: leafValue(att, 'owner_name'),
    secretId: leafValue(att, 'secret_id'),
    secretName: leafValue(att, 'secret_name'),
    pieceIndex: Number(leafValue(att, 'piece_index')) || 0,
    threshold: Number(leafValue(att, 'piece_M')) || 0,
    total: Number(leafValue(att, 'piece_N')) || 0,
    pieceFor: leafValue(att, 'piece_for'),
    ciphertext: leafValue(att, 'piece_ciphertext'),
    hash: leafValue(att, 'piece_hash'),
    declaredAt: leafValue(att, 'declared_at'),
  };
}

export interface BuildSecretPieceInput {
  secretId: string;
  secretName: string;
  pieceIndex: number;
  total: number;
  threshold: number;
  /** The Shamir piece token (e.g. "tapit-secret.v1.…"). Encrypted to holder. */
  token: string;
  /** The holder's 64-hex pubkey. */
  holderPubkey: string;
  /** SHA-256 hex of the token (safe metadata; lets the owner verify a return). */
  hashHex: string;
  /** The owner's display name, for the holder's "a piece of <name>'s secret". */
  ownerName?: string;
}

/** Build one signed secret-piece envelope addressed to one holder. The token
 *  is NIP-44 encrypted to the holder's pubkey — only they can read it. */
export function buildSecretPieceEnvelope(
  wallet: Wallet,
  input: BuildSecretPieceInput,
): Attestation {
  if (!HEX_64.test(input.holderPubkey)) {
    throw new Error(`holder pubkey is not 64-character hex: ${input.holderPubkey}`);
  }
  const ciphertext = wallet.nip44EncryptTo(input.token, input.holderPubkey);
  const draft = credentialAttestation({
    subject: wallet.identity,
    tier: 'notable',
    fields: {
      credential_type: 'secret-piece',
      secret_id: input.secretId,
      secret_name: input.secretName,
      piece_index: String(input.pieceIndex),
      piece_M: String(input.threshold),
      piece_N: String(input.total),
      piece_for: input.holderPubkey,
      piece_ciphertext: ciphertext,
      piece_hash: input.hashHex,
      owner_name: input.ownerName ?? '',
      declared_at: new Date().toISOString(),
    },
  });
  return wallet.sign(draft);
}

/** Decrypt a held secret-piece back to its token string. Throws if the
 *  envelope isn't a secret-piece, isn't addressed to this wallet, or the
 *  NIP-44 MAC fails (tampered or mis-routed). */
export function decryptHeldPiece(wallet: Wallet, envelope: Attestation): string {
  if (!isSecretPiece(envelope)) throw new Error('not a secret-piece envelope');
  const view = readSecretPiece(envelope);
  if (view.pieceFor !== wallet.identity) {
    throw new Error('this piece is addressed to someone else');
  }
  return wallet.nip44DecryptFrom(view.ciphertext, view.ownerId);
}

/** Hold + anchor a secret-piece received from an owner. Wallet.hold verifies
 *  the signature internally; the OTS queue anchors the digest as usual. */
export async function holdSecretPiece(
  wallet: Wallet,
  ownerId: string,
  anchorWorker: WorkerHandle | null,
  envelope: Attestation,
  myIdentity: string,
): Promise<void> {
  if (!isSecretPiece(envelope)) throw new Error('not a secret-piece envelope');
  const view = readSecretPiece(envelope);
  if (view.pieceFor !== myIdentity) {
    throw new Error('this secret-piece is addressed to someone else');
  }
  await wallet.hold(envelope);
  await anchorQueue.upsert(ownerId, {
    digestHex: envelopeId(envelope),
    state: 'queued',
    anchor: null,
    attempts: 0,
    last_attempt: null,
    last_error: null,
  });
  if (anchorWorker) void anchorWorker.kick();
}

// ---- secret-piece-receipt (holder -> owner) ----

export type ReceiptStatus = 'held' | 'declined';

export function isSecretPieceReceipt(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'secret-piece-receipt'
  );
}

export interface SecretPieceReceiptView {
  holderId: string;
  secretId: string;
  pieceIndex: number;
  status: ReceiptStatus;
  receiptFor: string;
  confirmedAt: string;
}

export function readSecretPieceReceipt(att: Attestation): SecretPieceReceiptView {
  const raw = leafValue(att, 'status');
  return {
    holderId: att.subject,
    secretId: leafValue(att, 'secret_id'),
    pieceIndex: Number(leafValue(att, 'piece_index')) || 0,
    status: raw === 'declined' ? 'declined' : 'held',
    receiptFor: leafValue(att, 'receipt_for'),
    confirmedAt: leafValue(att, 'confirmed_at'),
  };
}

export interface BuildReceiptInput {
  secretId: string;
  pieceIndex: number;
  ownerPubkey: string;
  status: ReceiptStatus;
}

/** Build the holder's signed receipt back to the owner — "I'm holding piece X
 *  of secret Y as of now" or "I let it go". Carries no token or secret value. */
export function buildSecretPieceReceipt(
  wallet: Wallet,
  input: BuildReceiptInput,
): Attestation {
  const draft = credentialAttestation({
    subject: wallet.identity,
    tier: 'routine',
    fields: {
      credential_type: 'secret-piece-receipt',
      secret_id: input.secretId,
      piece_index: String(input.pieceIndex),
      status: input.status,
      receipt_for: input.ownerPubkey,
      confirmed_at: new Date().toISOString(),
    },
  });
  return wallet.sign(draft);
}
