// Sign-in ledger -- the wallet's local history of "I proved control of my
// key at time T". Each entry is a TA-1 sign-in attestation (see tapit-attest
// core/sign-in.ts): a fresh nonce-bearing challenge that the holder
// Schnorr-signed. The ledger keeps those signed proofs so a person can look
// back and show when they signed in, and -- once a record is anchored through
// the existing OpenTimestamps path -- prove the key was live at that moment.
//
// HONEST FRAMING (load-bearing, never blur it):
//   - A SELF-issued record (recordSelfSignIn) is a liveness proof: the wallet
//     mints its own challenge and answers it, so it attests "the holder of this
//     key was present at time T". Its lasting value comes from OTS anchoring
//     (proof-of-when), NOT from any third party having checked it.
//   - A REMOTE login (a relying party's challenge, e.g. DynastyTrust over the
//     Nostr seam later) is real authentication. That check is TA-1 verifySignIn
//     run by the RELYING PARTY against ITS OWN stored challenge -- never this
//     module. verifyRecord below re-checks a STORED record's signature and
//     internal consistency; it is tamper-detection on the ledger, not a remote
//     auth decision. Keeping those two apart is the whole point of TA-1's
//     security note, and it stays apart here.
//
// This module is deliberately storage-agnostic: it operates on plain arrays so
// the persistence layer (the wallet's encrypted store) wires in without
// coupling the logic to localStorage. Pure functions, fully unit-testable.

import {
  answerSignInChallenge,
  buildSignInChallenge,
  verifySignIn,
  type SignInAttestation,
} from 'tapit-attest';

/** A stored sign-in proof plus a stable id (the challenge nonce, unique per sign-in). */
export interface SignInRecord {
  /** Stable id = the challenge nonce. Random per sign-in, so collision-free. */
  id: string;
  attestation: SignInAttestation;
}

/** Wrap a sign-in attestation as a ledger record, keying it by its nonce. */
export function toSignInRecord(attestation: SignInAttestation): SignInRecord {
  return { id: attestation.challenge.nonce, attestation };
}

/**
 * Mint and answer a fresh self-issued sign-in in one step -- the local
 * liveness case. The wallet is both the issuer and the signer, so this records
 * "the holder of `signerPrivateKey` was present at `now`". The private key
 * never leaves this call; only the public key and signature are kept.
 * `audience` names what was signed into (the wallet app, a screen); `now` and
 * `ttlSeconds` exist for deterministic tests.
 */
export function recordSelfSignIn(input: {
  signerPrivateKey: string;
  audience: string;
  now?: Date;
  ttlSeconds?: number;
}): SignInRecord {
  const issuedAt = (input.now ?? new Date()).toISOString();
  const challenge = buildSignInChallenge({
    audience: input.audience,
    ttlSeconds: input.ttlSeconds,
    issuedAt,
  });
  const attestation = answerSignInChallenge({
    challenge,
    signerPrivateKey: input.signerPrivateKey,
    issuedAt,
  });
  return toSignInRecord(attestation);
}

/**
 * Append a record to the ledger, de-duplicating by id. Returns a NEW array
 * (never mutates) so callers can treat the ledger as immutable state. A repeat
 * of an id already present is ignored -- the existing entry wins.
 */
export function appendSignIn(ledger: readonly SignInRecord[], record: SignInRecord): SignInRecord[] {
  if (ledger.some((r) => r.id === record.id)) return [...ledger];
  return [...ledger, record];
}

/**
 * The history view: every record sorted newest sign-in first by the
 * attestation's issuedAt. Records with an unparseable issuedAt sort last.
 */
export function signInHistory(ledger: readonly SignInRecord[]): SignInRecord[] {
  const at = (r: SignInRecord) => {
    const ms = Date.parse(r.attestation.issuedAt);
    return Number.isNaN(ms) ? -Infinity : ms;
  };
  return [...ledger].sort((a, b) => at(b) - at(a));
}

export interface SignInRecordVerifyResult {
  /** True when the stored proof's signature and internal consistency hold. */
  valid: boolean;
  /** The key that proved control, or null when the record fails. */
  signer: string | null;
  errors: string[];
}

/**
 * Re-verify a STORED record: tamper-detection on the ledger, not a remote auth
 * decision. It re-runs TA-1 verifySignIn against the record's own embedded
 * challenge, anchoring `now` to the record's issuedAt so a proof that was fresh
 * when signed still verifies long after the challenge window has closed (a
 * historical record should not "expire"). What this catches: a flipped byte in
 * the stored attestation, a signature that no longer matches its challenge, or
 * an issuedAt that falls outside the challenge it claims to answer.
 */
export function verifySignInRecord(record: SignInRecord): SignInRecordVerifyResult {
  const att = record.attestation;
  const issuedMs = Date.parse(att?.issuedAt ?? '');
  const now = Number.isNaN(issuedMs) ? 0 : issuedMs;
  const result = verifySignIn({
    attestation: att,
    expectedChallenge: att?.challenge,
    now,
  });
  return { valid: result.valid, signer: result.signer, errors: result.errors };
}

export interface SignInLedgerVerifyResult {
  /** Only the records whose stored proof still verifies. */
  records: SignInRecord[];
  /** One message per dropped record, naming the id. */
  errors: string[];
}

/**
 * Verify a whole ledger, keeping the sound records and dropping the rest. Like
 * the recovery-response verifier, a tampered entry is silently excluded from
 * the trusted set rather than poisoning the history.
 */
export function verifySignInLedger(ledger: readonly SignInRecord[]): SignInLedgerVerifyResult {
  const records: SignInRecord[] = [];
  const errors: string[] = [];
  for (const record of ledger) {
    if (verifySignInRecord(record).valid) {
      records.push(record);
    } else {
      errors.push(`dropped tampered sign-in record ${record.id}`);
    }
  }
  return { records, errors };
}
