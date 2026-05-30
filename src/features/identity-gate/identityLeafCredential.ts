import type { Attestation, Wallet } from 'tapit-attest';
import { credentialAttestation, envelopeId } from 'tapit-attest';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';

// Identity-leaf credential primitive (PLAN.md Founding Vision +
// Tier 1 item 11 sub-cut C.1, 2026-05-29). The structured shape
// for typed claims the operator commits to AS PART OF THEIR
// IDENTITY — vouching circle, Bitcoin spending key commitments,
// custody-handoff authorities, Lightning node pubkeys, etc.
//
// Each leaf is a self-signed credential by the operator with a
// closed-vocabulary `leaf_type` discriminator. The SIGNED
// CREDENTIAL'S envelopeId IS the leaf's cryptographic commitment
// — any envelope (e.g. the attest-release-authority envelopes
// from sub-cut B) that wants to bind to this leaf references the
// envelopeId, so a leaf rotation (operator signs a new credential
// for the same leaf_type) produces a new envelopeId and prior
// bindings no longer authorize the rotated leaf. This closes
// gap 2 (envelope-to-leaf cryptographic binding) once the
// release-authority envelope schema is extended in sub-cut C.3.
//
// Latest-by-issuedAt wins per leaf_type — operators can supersede
// a prior leaf by signing a new credential with the same
// leaf_type plus a `supersedes` field referencing the prior
// envelopeId for the audit-chain trail. Older leaves stay held
// + anchored as historical record.
//
// This file ships:
//   - the generic identity-leaf credential schema
//   - the vouching_circle leaf type (first concrete instance)
//   - builders, readers, typeguards
//   - findLatestVouchingCircle helper following the same pattern
//     as findLatestCohort in recovery
//
// Subsequent cuts add more leaf types (release_gate_policy,
// bitcoin_spending_key, etc.) and wire the envelope-binding
// (gap 2) plus UI integration (sub-cut C.2 promotes the
// vouching-circle picker from prefs-only to sign-on-save).

const IDENTITY_LEAF_TYPE = 'identity_leaf';

/**
 * Closed-vocabulary discriminator for typed leaves the operator
 * commits to as part of their identity. New types added here as
 * the substrate grows; the verifier wrapper (sub-cut E) reads
 * leaves by type to compose against gate policies.
 */
export type IdentityLeafType =
  | 'vouching_circle'
  | 'release_gate_policy'
  | 'bitcoin_spending_key'
  | 'lightning_node'
  | 'custody_spend_authority';

const HEX_64 = /^[0-9a-f]{64}$/i;

function leafValue(att: Attestation, name: string): string {
  const claim = att.claim;
  const child = claim.children.find((c) => c.name === name);
  if (!child || child.node !== 'leaf') return '';
  return typeof child.value === 'string' ? child.value : '';
}

// ---------------------------------------------------------------
// Generic identity-leaf credential shape
// ---------------------------------------------------------------

export interface IdentityLeafView {
  leafType: IdentityLeafType | string;
  /** JSON-encoded payload — interpretation depends on leafType. */
  payloadJson: string;
  designatedAt: string;
  /** envelopeId of the prior leaf this supersedes; '' when this is the first. */
  supersedes: string;
}

export function isIdentityLeaf(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === IDENTITY_LEAF_TYPE
  );
}

export function isIdentityLeafOfType(
  att: Attestation,
  leafType: IdentityLeafType,
): boolean {
  return isIdentityLeaf(att) && leafValue(att, 'leaf_type') === leafType;
}

export function readIdentityLeaf(att: Attestation): IdentityLeafView {
  return {
    leafType: leafValue(att, 'leaf_type'),
    payloadJson: leafValue(att, 'payload'),
    designatedAt: leafValue(att, 'designated_at'),
    supersedes: leafValue(att, 'supersedes'),
  };
}

// ---------------------------------------------------------------
// vouching_circle leaf — first concrete identity-leaf type
// ---------------------------------------------------------------

export interface VouchingCirclePayload {
  /**
   * Lowercase-hex pubkeys of peers the operator has designated as
   * their vouching circle. Sorted for canonical encoding so the
   * SAME logical selection always produces the SAME credential
   * envelopeId (the cryptographic commitment).
   */
  pubkeys: readonly string[];
}

export interface VouchingCircleView {
  pubkeys: readonly string[];
  designatedAt: string;
  supersedes: string;
}

export interface BuildVouchingCircleLeafInput {
  /** Operator's identity attestation subject pubkey. */
  identityPubkey: string;
  /** Selected vouching-circle peer pubkeys (any order — sorted internally). */
  pubkeys: readonly string[];
  /** envelopeId of the prior vouching_circle leaf, when superseding. */
  supersedes?: string;
}

export function buildVouchingCircleLeafDraft(
  input: BuildVouchingCircleLeafInput,
): Attestation {
  if (!HEX_64.test(input.identityPubkey)) {
    throw new Error('identityPubkey must be 64-char hex');
  }
  for (const p of input.pubkeys) {
    if (!HEX_64.test(p)) {
      throw new Error(`vouching circle pubkey is not 64-char hex: ${p}`);
    }
  }
  // Canonicalize: lowercase, deduplicate, sort.
  const canonical = Array.from(
    new Set(input.pubkeys.map((p) => p.toLowerCase())),
  ).sort();
  const payload: VouchingCirclePayload = { pubkeys: canonical };
  return credentialAttestation({
    subject: input.identityPubkey.toLowerCase(),
    tier: 'notable',
    fields: {
      credential_type: IDENTITY_LEAF_TYPE,
      leaf_type: 'vouching_circle' as IdentityLeafType,
      payload: JSON.stringify(payload),
      designated_at: new Date().toISOString(),
      supersedes: input.supersedes?.trim() ?? '',
    },
  });
}

export function isVouchingCircleLeaf(att: Attestation): boolean {
  return isIdentityLeafOfType(att, 'vouching_circle');
}

export function readVouchingCircleLeaf(att: Attestation): VouchingCircleView {
  const view = readIdentityLeaf(att);
  let pubkeys: readonly string[] = [];
  try {
    const parsed = JSON.parse(view.payloadJson) as VouchingCirclePayload;
    if (Array.isArray(parsed.pubkeys)) {
      pubkeys = parsed.pubkeys.filter(
        (p): p is string => typeof p === 'string' && HEX_64.test(p),
      );
    }
  } catch {
    // payload corrupt — return empty pubkeys; the operator can
    // re-sign a fresh leaf to recover.
  }
  return {
    pubkeys,
    designatedAt: view.designatedAt,
    supersedes: view.supersedes,
  };
}

/**
 * Find the operator's currently-effective vouching-circle leaf
 * across holdings. Latest-by-issuedAt wins; older vouching-circle
 * declarations stay held + anchored for audit. Matches the
 * findLatestCohort pattern in src/features/recovery/createCohort.ts.
 */
export function findLatestVouchingCircleLeaf(
  holdings: readonly Attestation[],
  walletIdentity: string,
): Attestation | null {
  let latest: Attestation | null = null;
  let latestMs = -Infinity;
  for (const a of holdings) {
    if (!isVouchingCircleLeaf(a)) continue;
    if (a.subject.toLowerCase() !== walletIdentity.toLowerCase()) continue;
    if (
      !a.signatures.some(
        (s) => s.signer.toLowerCase() === walletIdentity.toLowerCase(),
      )
    ) {
      continue;
    }
    const ms = new Date(a.issuedAt).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms > latestMs) {
      latestMs = ms;
      latest = a;
    }
  }
  return latest;
}

/**
 * Build, sign, hold, and queue-for-anchor a vouching_circle leaf
 * credential. Used by the VouchingCircleSection sign-on-save path
 * (sub-cut C.2, 2026-05-29). Auto-detects the latest existing
 * vouching_circle leaf in holdings and sets `supersedes` on the
 * new leaf to its envelopeId so the rotation chain is auditable.
 * Caller is responsible for calling refresh() to pick up the
 * newly-held attestation, and save() to push the encrypted
 * snapshot to storage. Matches the publishCohort pattern in
 * src/features/recovery/createCohort.ts.
 */
export async function publishVouchingCircleLeaf(
  wallet: Wallet,
  ownerId: string,
  anchorWorker: WorkerHandle | null,
  pubkeys: readonly string[],
  holdings: readonly Attestation[],
): Promise<Attestation> {
  const prior = findLatestVouchingCircleLeaf(holdings, wallet.identity);
  const draft = buildVouchingCircleLeafDraft({
    identityPubkey: wallet.identity,
    pubkeys,
    ...(prior ? { supersedes: envelopeId(prior) } : {}),
  });
  const signed = wallet.sign(draft);
  await wallet.hold(signed);
  const digestHex = envelopeId(signed);
  await anchorQueue.upsert(ownerId, {
    digestHex,
    state: 'queued',
    anchor: null,
    attempts: 0,
    last_attempt: null,
    last_error: null,
  });
  if (anchorWorker) void anchorWorker.kick();
  return signed;
}
