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
  /**
   * Optional ISO timestamp for the designated_at leaf. Defaults to now.
   * Pinnable so that two leaves with identical logical content produce
   * an identical envelopeId — designated_at is otherwise the one
   * non-content, wall-clock field that would otherwise make two builds
   * a millisecond apart diverge.
   */
  designatedAt?: string;
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
      designated_at: input.designatedAt ?? new Date().toISOString(),
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

// ---------------------------------------------------------------
// release_gate_policy leaf — second concrete identity-leaf type
// (sub-cut C.4, 2026-05-29)
// ---------------------------------------------------------------
//
// Per-LEAF gate policy that names which peers are eligible to
// attest, how many of them must attest (threshold M), and how
// long an attestation stays fresh (freshness horizon in hours).
// The operator-chip-form decision 2026-05-29 was "per-leaf
// operator-configurable" gate scope — each high-value identity
// leaf (dynasty_trust_spend_key, wealth_strategy_auth, etc.)
// gets its own policy with its own threshold and eligible-set.
//
// The eligible_pubkeys list MUST be a subset of the operator's
// vouching_circle leaf — the verifier in sub-cut E.2 (to come)
// will enforce this so a tampered gate policy cannot widen the
// eligible set beyond who the operator has actually designated.
// For this sub-cut C.4, the substrate just ships the schema +
// builder + reader + findLatest helper. The validator that
// enforces vouching-circle-subset lives in E.2 alongside the
// threshold check.
//
// Hybrid liveness (operator chip-form pick) is encoded as two
// horizons: freshness_horizon_hours is the long durability
// window (default 365 days), and ping_horizon_hours is the
// short re-confirmation window where a one-tap ping-ack from
// the same peer freshens the attestation (sub-cut G's hybrid
// liveness mechanism). For sub-cut C.4, both fields are stored;
// the ping-ack envelope kind ships in sub-cut G.

export interface ReleaseGatePolicyPayload {
  /**
   * The identity-leaf name this policy gates (e.g.
   * 'dynasty_trust_spend_key'). Free-form matching the
   * identity_leaf field on attest-release-authority envelopes.
   */
  for_leaf: string;
  /** Lowercase-hex pubkeys eligible to attest. Sorted canonical. */
  eligible_pubkeys: readonly string[];
  /** Number of distinct eligible attestations required (M of N). */
  threshold: number;
  /** Long-horizon freshness in hours. Default 8760 = 365 days. */
  freshness_horizon_hours: number;
  /**
   * Short-horizon ping re-confirmation window in hours. Optional
   * because sub-cut G (hybrid liveness pings) wires the actual
   * ping envelope kind; this field reserves the slot in the
   * policy schema now so the leaf's envelopeId stays stable
   * when G lands without forcing a re-sign for every policy.
   */
  ping_horizon_hours?: number;
}

export interface ReleaseGatePolicyView {
  forLeaf: string;
  eligiblePubkeys: readonly string[];
  threshold: number;
  freshnessHorizonHours: number;
  pingHorizonHours: number | null;
  designatedAt: string;
  supersedes: string;
}

export interface BuildReleaseGatePolicyLeafInput {
  identityPubkey: string;
  forLeaf: string;
  eligiblePubkeys: readonly string[];
  threshold: number;
  freshnessHorizonHours?: number;
  pingHorizonHours?: number;
  supersedes?: string;
  /** Optional ISO timestamp for designated_at. Defaults to now;
   *  pinnable for deterministic content (see vouching-circle note). */
  designatedAt?: string;
}

const DEFAULT_FRESHNESS_HORIZON_HOURS = 365 * 24;

export function buildReleaseGatePolicyLeafDraft(
  input: BuildReleaseGatePolicyLeafInput,
): Attestation {
  if (!HEX_64.test(input.identityPubkey)) {
    throw new Error('identityPubkey must be 64-char hex');
  }
  const forLeaf = input.forLeaf.trim();
  if (forLeaf.length === 0) {
    throw new Error('forLeaf must not be empty');
  }
  for (const p of input.eligiblePubkeys) {
    if (!HEX_64.test(p)) {
      throw new Error(`eligible pubkey is not 64-char hex: ${p}`);
    }
  }
  // Canonicalize: lowercase + dedup + sort. Same shape as the
  // vouching_circle leaf so equal logical policies produce equal
  // envelopeIds.
  const canonicalEligible = Array.from(
    new Set(input.eligiblePubkeys.map((p) => p.toLowerCase())),
  ).sort();
  if (!Number.isInteger(input.threshold) || input.threshold < 1) {
    throw new Error('threshold must be a positive integer');
  }
  if (input.threshold > canonicalEligible.length) {
    throw new Error(
      `threshold ${input.threshold} cannot exceed eligible set size ${canonicalEligible.length}`,
    );
  }
  const freshnessHorizonHours =
    input.freshnessHorizonHours ?? DEFAULT_FRESHNESS_HORIZON_HOURS;
  if (!Number.isFinite(freshnessHorizonHours) || freshnessHorizonHours <= 0) {
    throw new Error('freshnessHorizonHours must be a positive number');
  }
  if (
    input.pingHorizonHours !== undefined &&
    (!Number.isFinite(input.pingHorizonHours) || input.pingHorizonHours <= 0)
  ) {
    throw new Error('pingHorizonHours must be a positive number when provided');
  }
  const payload: ReleaseGatePolicyPayload = {
    for_leaf: forLeaf,
    eligible_pubkeys: canonicalEligible,
    threshold: input.threshold,
    freshness_horizon_hours: freshnessHorizonHours,
    ...(input.pingHorizonHours !== undefined
      ? { ping_horizon_hours: input.pingHorizonHours }
      : {}),
  };
  return credentialAttestation({
    subject: input.identityPubkey.toLowerCase(),
    tier: 'notable',
    fields: {
      credential_type: IDENTITY_LEAF_TYPE,
      leaf_type: 'release_gate_policy' as IdentityLeafType,
      payload: JSON.stringify(payload),
      designated_at: input.designatedAt ?? new Date().toISOString(),
      supersedes: input.supersedes?.trim() ?? '',
      // for_leaf is also lifted to a top-level field so
      // findLatestReleaseGatePolicyLeaf can filter without
      // having to JSON-parse every leaf's payload.
      for_leaf: forLeaf,
    },
  });
}

export function isReleaseGatePolicyLeaf(att: Attestation): boolean {
  return isIdentityLeafOfType(att, 'release_gate_policy');
}

export function readReleaseGatePolicyLeaf(
  att: Attestation,
): ReleaseGatePolicyView {
  const view = readIdentityLeaf(att);
  let forLeaf = '';
  let eligiblePubkeys: readonly string[] = [];
  let threshold = 0;
  let freshnessHorizonHours = 0;
  let pingHorizonHours: number | null = null;
  try {
    const parsed = JSON.parse(view.payloadJson) as ReleaseGatePolicyPayload;
    if (typeof parsed.for_leaf === 'string') forLeaf = parsed.for_leaf;
    if (Array.isArray(parsed.eligible_pubkeys)) {
      eligiblePubkeys = parsed.eligible_pubkeys.filter(
        (p): p is string => typeof p === 'string' && HEX_64.test(p),
      );
    }
    if (Number.isInteger(parsed.threshold)) threshold = parsed.threshold;
    if (
      typeof parsed.freshness_horizon_hours === 'number' &&
      Number.isFinite(parsed.freshness_horizon_hours)
    ) {
      freshnessHorizonHours = parsed.freshness_horizon_hours;
    }
    if (
      typeof parsed.ping_horizon_hours === 'number' &&
      Number.isFinite(parsed.ping_horizon_hours)
    ) {
      pingHorizonHours = parsed.ping_horizon_hours;
    }
  } catch {
    // Corrupt payload — return zeros; the verifier will refuse
    // gracefully when threshold=0 fails the count comparison.
  }
  return {
    forLeaf,
    eligiblePubkeys,
    threshold,
    freshnessHorizonHours,
    pingHorizonHours,
    designatedAt: view.designatedAt,
    supersedes: view.supersedes,
  };
}

/**
 * Find the operator's currently-effective release_gate_policy
 * leaf for a specific identity-leaf name. Latest-by-issuedAt
 * wins per (walletIdentity, forLeaf) pair. Matches the
 * findLatestVouchingCircleLeaf pattern.
 */
export function findLatestReleaseGatePolicyLeaf(
  holdings: readonly Attestation[],
  walletIdentity: string,
  forLeaf: string,
): Attestation | null {
  let latest: Attestation | null = null;
  let latestMs = -Infinity;
  const forLeafTrimmed = forLeaf.trim();
  for (const a of holdings) {
    if (!isReleaseGatePolicyLeaf(a)) continue;
    if (a.subject.toLowerCase() !== walletIdentity.toLowerCase()) continue;
    if (
      !a.signatures.some(
        (s) => s.signer.toLowerCase() === walletIdentity.toLowerCase(),
      )
    ) {
      continue;
    }
    // The top-level for_leaf field is the cheap filter; if it
    // matches, the policy is for the right leaf.
    if (leafValue(a, 'for_leaf') !== forLeafTrimmed) continue;
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
 * Every CURRENTLY-EFFECTIVE release-gate policy the operator has signed,
 * one per distinct `for_leaf` (latest-by-issuedAt wins; superseded
 * policies stay held as audit chain but are not returned). Item 11 D0 —
 * the designation surface lists these so the operator sees which leaves
 * they have already gated. Read-only; pure.
 */
export function listEffectiveReleaseGatePolicies(
  holdings: readonly Attestation[],
  walletIdentity: string,
): readonly Attestation[] {
  const latestByLeaf = new Map<string, { att: Attestation; ms: number }>();
  for (const a of holdings) {
    if (!isReleaseGatePolicyLeaf(a)) continue;
    if (a.subject.toLowerCase() !== walletIdentity.toLowerCase()) continue;
    if (
      !a.signatures.some(
        (s) => s.signer.toLowerCase() === walletIdentity.toLowerCase(),
      )
    ) {
      continue;
    }
    const forLeaf = leafValue(a, 'for_leaf');
    if (forLeaf.length === 0) continue;
    const ms = new Date(a.issuedAt).getTime();
    if (!Number.isFinite(ms)) continue;
    const existing = latestByLeaf.get(forLeaf);
    if (!existing || ms > existing.ms) latestByLeaf.set(forLeaf, { att: a, ms });
  }
  return Array.from(latestByLeaf.values()).map((v) => v.att);
}

/**
 * Sign + hold + anchor a release-gate-policy leaf. Item 11 D0 (the
 * designation step). Mirrors publishVouchingCircleLeaf exactly: supersedes
 * the prior policy for the same leaf so leaf rotation invalidates stale
 * peer attestations (the verifier in E.2 enforces the binding). The
 * eligible set MUST be a subset of the operator's signed vouching circle;
 * the caller sources eligiblePubkeys from there, and the E.2 verifier
 * re-checks the subset so a tampered policy can't widen it.
 */
export async function publishReleaseGatePolicyLeaf(
  wallet: Wallet,
  ownerId: string,
  anchorWorker: WorkerHandle | null,
  input: {
    forLeaf: string;
    eligiblePubkeys: readonly string[];
    threshold: number;
    freshnessHorizonHours?: number;
  },
  holdings: readonly Attestation[],
): Promise<Attestation> {
  const prior = findLatestReleaseGatePolicyLeaf(
    holdings,
    wallet.identity,
    input.forLeaf,
  );
  const draft = buildReleaseGatePolicyLeafDraft({
    identityPubkey: wallet.identity,
    forLeaf: input.forLeaf,
    eligiblePubkeys: input.eligiblePubkeys,
    threshold: input.threshold,
    ...(input.freshnessHorizonHours !== undefined
      ? { freshnessHorizonHours: input.freshnessHorizonHours }
      : {}),
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
