import type { Attestation, FieldBranch, Wallet } from 'tapit-attest';
import { credentialAttestation, envelopeId } from 'tapit-attest';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import { leafValue } from '../connections/createHandshake.ts';

// Numeric-leaf reader. leafValue (in createHandshake.ts) returns only
// string-typed leaves; a leaf stored as the number 3 reads as the
// empty string, and Number('') || 0 → 0, which masks as the cohort
// threshold silently resetting to the default-fallback on every read.
// This helper handles both string and number leaves so the cohort
// editor survives a reopen regardless of which convention the writer
// used. publishCohort now writes strings (matching the pattern in
// createShares.ts) but the reader accepts both for backwards-
// compatibility with any pre-fix cohort credential already anchored.
function readNumberLeaf(att: Attestation, name: string): number {
  const claim = att.claim as FieldBranch;
  const node = claim.children.find((c) => c.name === name);
  if (!node || node.node !== 'leaf') return 0;
  if (typeof node.value === 'number') return node.value;
  if (typeof node.value === 'string') {
    const n = Number(node.value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// 5e-iii-a — recovery-cohort declaration. The operator names which
// peers they would trust to help them recover from a lost device,
// and the (M, N) threshold the recovery ceremony will require.
//
// This cut records the cohort as a self-signed credential. Share
// distribution + backup-format-v2 (the cryptographic plumbing that
// actually makes recovery work) is the NEXT cut, 5e-iii-b. Reasoning:
// the operator decision of WHO to trust is its own act and benefits
// from being declared up front before any shares are computed. The
// cryptographic distribution can run on top of that declaration
// once the operator has reviewed and approved the cohort.
//
// Per spec §12 the cohort is "the same web that proves who you are"
// — peers from handshakes and (in a follow-on) organizations from
// memberships. The cohort credential keeps a list of {pubkey, name}
// pairs as canonical JSON so the same shape that PeerPicker
// surfaces is the shape that lands in the signed envelope.

export interface CohortMember {
  pubkey: string;
  name: string;
}

const HEX_64 = /^[0-9a-f]{64}$/i;

/** True when an attestation is a recovery-cohort declaration. */
export function isRecoveryCohort(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'recovery-cohort'
  );
}

function sortMembers(members: readonly CohortMember[]): CohortMember[] {
  return [...members]
    .map((m) => ({ pubkey: m.pubkey.trim().toLowerCase(), name: m.name.trim() }))
    .sort((a, b) => a.pubkey.localeCompare(b.pubkey));
}

function uniqueByPubkey(members: readonly CohortMember[]): CohortMember[] {
  const seen = new Set<string>();
  const out: CohortMember[] = [];
  for (const m of members) {
    if (seen.has(m.pubkey)) continue;
    seen.add(m.pubkey);
    out.push(m);
  }
  return out;
}

export interface CohortView {
  members: CohortMember[];
  threshold: number;
  totalShares: number;
  declaredAt: string;
}

/**
 * Parse the cohort attestation's leaves into a view. Tolerant of
 * malformed JSON — returns an empty cohort rather than throwing so
 * a corrupt envelope cannot brick the recovery UI.
 */
export function readCohort(att: Attestation): CohortView {
  const raw = leafValue(att, 'members');
  const members: CohortMember[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (!entry || typeof entry !== 'object') continue;
          const e = entry as Record<string, unknown>;
          const pubkey = typeof e.pubkey === 'string' ? e.pubkey : '';
          const name = typeof e.name === 'string' ? e.name : '';
          if (!HEX_64.test(pubkey)) continue;
          members.push({ pubkey: pubkey.toLowerCase(), name });
        }
      }
    } catch {
      // malformed leaf — treat as empty cohort
    }
  }
  const threshold = readNumberLeaf(att, 'threshold');
  const totalShares = readNumberLeaf(att, 'total_shares');
  return {
    members,
    threshold,
    totalShares,
    declaredAt: leafValue(att, 'declared_at'),
  };
}

/**
 * Find the operator's most-recent recovery-cohort declaration in
 * holdings. The latest-by-issuedAt wins; older cohorts are
 * superseded (the history stays held + anchored for audit).
 */
export function findLatestCohort(
  holdings: readonly Attestation[],
  walletIdentity: string,
): Attestation | null {
  let latest: Attestation | null = null;
  let latestMs = -Infinity;
  for (const a of holdings) {
    if (!isRecoveryCohort(a)) continue;
    if (a.subject !== walletIdentity) continue;
    if (!a.signatures.some((s) => s.signer === walletIdentity)) continue;
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
 * Build, sign, hold, and anchor a recovery-cohort declaration.
 * Members are sorted + de-duplicated so the canonical leaf is
 * stable regardless of the operator's pick order. Threshold +
 * totalShares are validated against each other and against the
 * Shamir GF(256) ceiling (255 shares max).
 */
export async function publishCohort(
  wallet: Wallet,
  ownerId: string,
  anchorWorker: WorkerHandle | null,
  members: readonly CohortMember[],
  threshold: number,
  totalShares: number,
): Promise<Attestation> {
  if (!Number.isInteger(threshold) || threshold < 2) {
    throw new Error('threshold must be an integer >= 2');
  }
  if (!Number.isInteger(totalShares) || totalShares < threshold) {
    throw new Error('totalShares must be an integer >= threshold');
  }
  if (totalShares > 255) {
    throw new Error('totalShares must be <= 255');
  }
  if (members.length !== totalShares) {
    throw new Error(
      `cohort must have exactly ${totalShares} members (got ${members.length})`,
    );
  }
  for (const m of members) {
    if (!HEX_64.test(m.pubkey.trim())) {
      throw new Error(`cohort member pubkey is not 64-character hex: ${m.pubkey}`);
    }
  }
  const normalized = uniqueByPubkey(sortMembers(members));
  if (normalized.length !== totalShares) {
    throw new Error('cohort members contained duplicate pubkeys');
  }
  const draft = credentialAttestation({
    subject: wallet.identity,
    tier: 'notable',
    fields: {
      credential_type: 'recovery-cohort',
      members: normalized,
      // Store numbers as strings so leafValue + readNumberLeaf round-
      // trip cleanly. Matches the pattern in createShares.ts.
      threshold: String(threshold),
      total_shares: String(totalShares),
      declared_at: new Date().toISOString(),
    },
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
