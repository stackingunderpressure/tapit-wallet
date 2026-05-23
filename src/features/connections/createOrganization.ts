import type { Attestation, Wallet } from 'tapit-attest';
import { credentialAttestation, envelopeId } from 'tapit-attest';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import { leafValue } from './createHandshake.ts';

// 5b-org-i — org-mode self-declaration. A wallet says "I am an
// organization" by signing one credential-kind attestation about
// itself: subject = own identity, issuer = own identity,
// credential_type = 'organization', org_name = display name. Other
// wallets read this attestation to know the pubkey represents a
// collective rather than a person; the owning wallet reads it to
// flip the UI into org-mode (Identity tab gets an Organization
// header + a Members view of the people this wallet has admitted).
//
// One-way for now. If revocation is ever needed it would be a
// separate meta-kind attestation; out of scope this cut. The
// declaration ships through the same hold-and-anchor pipeline
// every other attestation uses, so the org-self-declaration is
// itself time-anchored to a Bitcoin block once it confirms.

/** True when an attestation is a wallet's self-declaration as an organization. */
export function isOrganizationSelfDeclaration(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'organization' &&
    att.subject === leafValue(att, 'pubkey')
  );
}

/** Read the declared org name out of a self-declaration attestation. */
export function readOrganizationName(att: Attestation): string {
  return leafValue(att, 'org_name');
}

/**
 * True when the holdings include a self-declaration whose subject
 * matches the operator's identity — i.e. THIS wallet has declared
 * itself an organization. Other people's self-declarations do not
 * count.
 */
export function walletIsOrganization(
  holdings: readonly Attestation[],
  myIdentity: string,
): boolean {
  return holdings.some(
    (a) => isOrganizationSelfDeclaration(a) && a.subject === myIdentity,
  );
}

/** Pull the operator's own org-self-declaration out of holdings, if any. */
export function findOwnOrgDeclaration(
  holdings: readonly Attestation[],
  myIdentity: string,
): Attestation | null {
  return (
    holdings.find(
      (a) => isOrganizationSelfDeclaration(a) && a.subject === myIdentity,
    ) ?? null
  );
}

// Build, sign, hold, and anchor the org self-declaration. The
// pubkey leaf must equal the subject so isOrganizationSelfDeclaration
// recognizes it; both are signed into the Merkle tree so a verifier
// can confirm the wallet actually declared itself rather than
// someone else trying to declare it.
export async function selfDeclareOrganization(
  wallet: Wallet,
  ownerId: string,
  anchorWorker: WorkerHandle | null,
  orgName: string,
): Promise<Attestation> {
  const trimmed = orgName.trim();
  if (trimmed.length === 0) {
    throw new Error('org name must not be empty');
  }
  const draft = credentialAttestation({
    subject: wallet.identity,
    tier: 'notable',
    fields: {
      credential_type: 'organization',
      org_name: trimmed,
      pubkey: wallet.identity,
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

// 5b-org-ii — officials roster. A second self-issued credential
// (subject = org's own identity, credential_type = 'officials')
// names the org's current officers by pubkey + optional display
// name. Stored as a single 'officials' leaf carrying the canonical
// JSON of the sorted list so the hash is stable regardless of the
// operator's insertion order. Each edit publishes a NEW envelope —
// the wallet keeps the full series (anchored to Bitcoin one by one)
// so the governance history is auditable; readers use the latest
// roster by issued_at. Other wallets read this roster when
// verifying ratifications on issued memberships.

export interface Official {
  pubkey: string;
  name: string;
}

const HEX_64 = /^[0-9a-f]{64}$/i;

/** True when an attestation is an officials-roster credential. */
export function isOfficialsRoster(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'officials'
  );
}

function sortOfficials(officials: readonly Official[]): Official[] {
  return [...officials]
    .map((o) => ({ pubkey: o.pubkey.trim().toLowerCase(), name: o.name.trim() }))
    .sort((a, b) => a.pubkey.localeCompare(b.pubkey));
}

function uniqueByPubkey(officials: readonly Official[]): Official[] {
  const seen = new Set<string>();
  const out: Official[] = [];
  for (const o of officials) {
    if (seen.has(o.pubkey)) continue;
    seen.add(o.pubkey);
    out.push(o);
  }
  return out;
}

/**
 * Parse the officials list out of a roster attestation. The leaf is
 * canonical JSON of an array of {pubkey, name} objects; we re-parse
 * and re-normalize so a malformed leaf returns an empty list rather
 * than throwing.
 */
export function readOfficials(att: Attestation): Official[] {
  const raw = leafValue(att, 'officials');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const officials: Official[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const pubkey = typeof e.pubkey === 'string' ? e.pubkey : '';
      const name = typeof e.name === 'string' ? e.name : '';
      if (!HEX_64.test(pubkey)) continue;
      officials.push({ pubkey: pubkey.toLowerCase(), name });
    }
    return officials;
  } catch {
    return [];
  }
}

/**
 * Find the most recent officials roster the named organization has
 * published, by issued_at on the envelope. Returns null when the org
 * has never published a roster. "Latest wins" gives the audit-friendly
 * shape: every roster ever published is held and anchored, but only
 * the newest one is currently in effect.
 */
export function findLatestOfficialsRoster(
  holdings: readonly Attestation[],
  orgIdentity: string,
): Attestation | null {
  let latest: Attestation | null = null;
  let latestMs = -Infinity;
  for (const a of holdings) {
    if (!isOfficialsRoster(a)) continue;
    if (a.subject !== orgIdentity) continue;
    if (!a.signatures.some((s) => s.signer === orgIdentity)) continue;
    const ms = new Date(a.issuedAt).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms > latestMs) {
      latestMs = ms;
      latest = a;
    }
  }
  return latest;
}

// 5b-org-iii — ratifications view. The org's key signs each
// issued membership at creation time (the clerk's act). Officials
// then co-sign that membership later from their personal wallets
// using the existing CosignAsWitness + Absorb + Send-back machinery
// — no new flow needed; the multi-signature envelope just
// accumulates ratifications. countRatifications cross-references
// the carried signatures against the latest officials roster to
// produce the "N of M ratifications" figure a verifier needs to
// weigh the envelope. The org's own clerk-issuance signature
// counts as one ratification when the org identity also appears
// on the roster (which it does not have to — the org may keep
// itself off the human roster and treat its key purely as the
// issuance-clerk seat).

export interface RatificationSummary {
  /** Total officials on the latest roster. */
  total: number;
  /** Officials whose signatures appear on the envelope. */
  ratified: number;
  /** Names of officials who ratified, in roster order. */
  byName: string[];
}

/**
 * Cross-reference the envelope's signatures against the supplied
 * officials list. Returns null when the roster is empty — there is
 * nothing meaningful to render against an empty governance set.
 */
export function countRatifications(
  envelope: Attestation,
  officials: readonly Official[],
): RatificationSummary | null {
  if (officials.length === 0) return null;
  const signers = new Set(envelope.signatures.map((s) => s.signer));
  const byName: string[] = [];
  let ratified = 0;
  for (const o of officials) {
    if (signers.has(o.pubkey)) {
      ratified++;
      byName.push(o.name || `${o.pubkey.slice(0, 8)}…${o.pubkey.slice(-4)}`);
    }
  }
  return { total: officials.length, ratified, byName };
}

/**
 * Build, sign, hold, and anchor a new officials roster for the
 * organization. Officials are sorted by pubkey and de-duplicated
 * before serialization so the same set always produces the same
 * canonical leaf and the same digest, regardless of the order the
 * operator added them.
 */
export async function publishOfficialsRoster(
  wallet: Wallet,
  ownerId: string,
  anchorWorker: WorkerHandle | null,
  officials: readonly Official[],
): Promise<Attestation> {
  for (const o of officials) {
    if (!HEX_64.test(o.pubkey.trim())) {
      throw new Error(`official pubkey is not 64-character hex: ${o.pubkey}`);
    }
  }
  const normalized = uniqueByPubkey(sortOfficials(officials));
  const draft = credentialAttestation({
    subject: wallet.identity,
    tier: 'notable',
    fields: {
      credential_type: 'officials',
      org_id: wallet.identity,
      officials: normalized,
      issued_at: new Date().toISOString(),
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
