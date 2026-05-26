import type { Attestation, DisclosureProofBundle, FieldBranch } from 'tapit-attest';
import { verifyDisclosureProof } from 'tapit-attest';
import type { JoinPolicy } from './authRule.ts';

// Phase 8 Phase E3 cut 1 — join-policy evaluation. The org-side
// acceptor for an incoming self-membership envelope (Phase E2) calls
// this against the join-rule declared in the org's auth tree. The
// hybrid substrate (Option 3 from the open-joining brief) wants both
// proof paths valid in Phase E4: a roster snapshot the org publishes
// when online (Option 1) and the self-claim verifier walk against the
// org's auth tree when the org is offline (Option 2). Either way the
// gate that decides whether the join is structurally valid is the
// same — the join-policy declared in the org's self-declaration.
//
// Three policy kinds (`open`, `allow_list`, `deny_list`) evaluate
// purely against the self-membership envelope's `subject` (the
// joiner's pubkey) — the org has everything it needs in the envelope
// and its own auth tree.
//
// Phase 8 Phase E4 cut 2 — the three proof-required policy kinds
// (`requires_handshake`, `requires_credential`, `requires_vouch`)
// now evaluate too. Handshake + credential consult the joiner-side
// proof leaves the Phase E4 cut 2 builder bakes onto the
// self-membership envelope (handshake_proof / credential_proof are
// JSON-stringified DisclosureProofBundles whose own signatures are
// re-verified here via verifyDisclosureProof). Vouch consults the
// cosigners on envelope.signatures[] and confirms each named
// voucher is present in the org's known-member set derived from
// `holdings`. The proof-attachment shape was locked by the operator
// at Phase E4 cut 2 (disclosure-proof for handshake + credential,
// cosignatures for vouch); see the connections manifest notes for
// the rationale.

export interface JoinPolicyEvaluation {
  /** True iff the policy structurally accepts the joiner. False
   *  means the envelope must not be added to the pending-roster
   *  buffer; the joiner can resend later with the right proof or
   *  via a different pathway. */
  accepted: boolean;
  /** Human-readable reason; meaningful whether accepted or not. UI
   *  surfaces this verbatim when a join request lands and the org
   *  operator wants to know why it was accepted/rejected. */
  reason: string;
}

/** Evaluate a self-membership envelope against the org's declared
 *  join-policy. `selfMembership` MUST be a self-membership credential
 *  (caller guards with `isSelfMembership` before invoking); we read
 *  `subject` as the joiner's pubkey for the list-checking policies
 *  and the proof leaves for the proof-required kinds.
 *  `holdings` is the receiving wallet's holdings — consulted by
 *  `requires_vouch` to derive the known-member set of the named org.
 *  The verifier-side path (verifyOpenJoinedMembership) passes an
 *  empty array; vouch verification on the verifier side without
 *  holdings naturally rejects, which is the honest answer when the
 *  caller has no member context. Pure function, no I/O. */
export function evaluateJoinPolicy(
  policy: JoinPolicy,
  selfMembership: Attestation,
  holdings: readonly Attestation[],
): JoinPolicyEvaluation {
  const joinerId = selfMembership.subject.trim().toLowerCase();
  switch (policy.kind) {
    case 'open':
      return { accepted: true, reason: 'join policy is open — any wallet may self-claim membership' };
    case 'allow_list': {
      const list = policy.pubkeys.map((p) => p.trim().toLowerCase());
      if (list.includes(joinerId)) {
        return { accepted: true, reason: "joiner pubkey is on the org's allow-list" };
      }
      return { accepted: false, reason: "joiner pubkey is not on the org's allow-list" };
    }
    case 'deny_list': {
      const list = policy.pubkeys.map((p) => p.trim().toLowerCase());
      if (list.includes(joinerId)) {
        return { accepted: false, reason: "joiner pubkey is on the org's deny-list" };
      }
      return { accepted: true, reason: "joiner pubkey is not on the org's deny-list" };
    }
    case 'requires_handshake':
      return evaluateHandshakePolicy(policy, selfMembership, joinerId);
    case 'requires_credential':
      return evaluateCredentialPolicy(policy, selfMembership, joinerId);
    case 'requires_vouch':
      return evaluateVouchPolicy(policy, selfMembership, joinerId, holdings);
  }
}

// ---------- Phase E4 cut 2: proof-required policy paths ----------

function evaluateHandshakePolicy(
  policy: Extract<JoinPolicy, { kind: 'requires_handshake' }>,
  selfMembership: Attestation,
  joinerId: string,
): JoinPolicyEvaluation {
  const proof = readProofLeaf(selfMembership, 'handshake_proof');
  if (!proof) {
    return {
      accepted: false,
      reason: 'requires_handshake — no handshake_proof leaf attached to self-membership envelope',
    };
  }
  if (proof.meta.kind !== 'relationship') {
    return {
      accepted: false,
      reason: `requires_handshake — handshake_proof discloses a ${proof.meta.kind} envelope, not a relationship`,
    };
  }
  if (proof.leaf.name !== 'verification' || typeof proof.leaf.value !== 'string' || proof.leaf.value.length === 0) {
    return {
      accepted: false,
      reason: 'requires_handshake — handshake_proof must disclose a non-empty verification leaf',
    };
  }
  const verdict = verifyDisclosureProof(proof);
  if (!verdict.valid) {
    return {
      accepted: false,
      reason: `requires_handshake — handshake_proof cryptographic verification failed: ${verdict.errors.join('; ') || 'no valid signatures'}`,
    };
  }
  const validSigners = new Set(
    verdict.signers.filter((s) => s.valid).map((s) => s.signer.trim().toLowerCase()),
  );
  if (!validSigners.has(joinerId)) {
    return {
      accepted: false,
      reason: 'requires_handshake — handshake_proof carries no valid signature from the joiner',
    };
  }
  const allowed = new Set(policy.with_any_of.map((p) => p.trim().toLowerCase()));
  const anchorMatch = [...validSigners].some((s) => s !== joinerId && allowed.has(s));
  if (!anchorMatch) {
    return {
      accepted: false,
      reason: "requires_handshake — handshake_proof's other signer is not on the policy's with_any_of list",
    };
  }
  return { accepted: true, reason: 'requires_handshake — joiner holds a valid co-signed handshake with an anchor pubkey' };
}

function evaluateCredentialPolicy(
  policy: Extract<JoinPolicy, { kind: 'requires_credential' }>,
  selfMembership: Attestation,
  joinerId: string,
): JoinPolicyEvaluation {
  const proof = readProofLeaf(selfMembership, 'credential_proof');
  if (!proof) {
    return {
      accepted: false,
      reason: 'requires_credential — no credential_proof leaf attached to self-membership envelope',
    };
  }
  if (proof.meta.kind !== 'credential') {
    return {
      accepted: false,
      reason: `requires_credential — credential_proof discloses a ${proof.meta.kind} envelope, not a credential`,
    };
  }
  if (proof.meta.subject.trim().toLowerCase() !== joinerId) {
    return {
      accepted: false,
      reason: 'requires_credential — credential_proof subject is not the joiner',
    };
  }
  if (proof.leaf.name !== 'credential_type' || typeof proof.leaf.value !== 'string') {
    return {
      accepted: false,
      reason: 'requires_credential — credential_proof must disclose the credential_type leaf',
    };
  }
  if (proof.leaf.value !== policy.credential_type) {
    return {
      accepted: false,
      reason: `requires_credential — credential_proof discloses credential_type=${proof.leaf.value}, policy requires ${policy.credential_type}`,
    };
  }
  const verdict = verifyDisclosureProof(proof);
  if (!verdict.valid) {
    return {
      accepted: false,
      reason: `requires_credential — credential_proof cryptographic verification failed: ${verdict.errors.join('; ') || 'no valid signatures'}`,
    };
  }
  if (policy.issuer) {
    const issuerLower = policy.issuer.trim().toLowerCase();
    const validSigners = new Set(
      verdict.signers.filter((s) => s.valid).map((s) => s.signer.trim().toLowerCase()),
    );
    if (!validSigners.has(issuerLower)) {
      return {
        accepted: false,
        reason: "requires_credential — credential_proof carries no valid signature from the policy's named issuer",
      };
    }
  }
  return {
    accepted: true,
    reason: `requires_credential — joiner holds a valid ${policy.credential_type} credential${policy.issuer ? ' from the named issuer' : ''}`,
  };
}

function evaluateVouchPolicy(
  policy: Extract<JoinPolicy, { kind: 'requires_vouch' }>,
  selfMembership: Attestation,
  joinerId: string,
  holdings: readonly Attestation[],
): JoinPolicyEvaluation {
  const orgId = readLeaf(selfMembership, 'org_id').trim().toLowerCase();
  if (!orgId) {
    return {
      accepted: false,
      reason: 'requires_vouch — self-membership envelope has no org_id leaf',
    };
  }
  const knownMembers = knownMembersOf(orgId, holdings);
  if (knownMembers.size === 0) {
    return {
      accepted: false,
      reason: 'requires_vouch — no known members in holdings to verify vouchers against',
    };
  }
  const voucherSigners = new Set(
    selfMembership.signatures
      .map((s) => s.signer.trim().toLowerCase())
      .filter((s) => s !== joinerId && knownMembers.has(s)),
  );
  if (voucherSigners.size < policy.from_any_member_count) {
    return {
      accepted: false,
      reason: `requires_vouch — ${voucherSigners.size} known-member voucher signature(s) on self-membership, need ${policy.from_any_member_count}`,
    };
  }
  return {
    accepted: true,
    reason: `requires_vouch — ${voucherSigners.size} known-member voucher(s) cosigned the self-membership`,
  };
}

// ---------- Internal helpers ----------

function readProofLeaf(att: Attestation, name: string): DisclosureProofBundle | null {
  const raw = readLeaf(att, name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    if (typeof p.v !== 'number') return null;
    if (!p.meta || typeof p.meta !== 'object') return null;
    if (!p.leaf || typeof p.leaf !== 'object') return null;
    if (!Array.isArray(p.steps)) return null;
    if (!Array.isArray(p.signatures)) return null;
    return parsed as DisclosureProofBundle;
  } catch {
    return null;
  }
}

function readLeaf(att: Attestation, name: string): string {
  const claim = att.claim as FieldBranch;
  if (claim.node !== 'branch') return '';
  for (const c of claim.children) {
    if (c.node === 'leaf' && c.name === name && typeof c.value === 'string') {
      return c.value;
    }
  }
  return '';
}

// Derive the set of pubkeys (lowercased) that count as "known
// members of the org" for vouch evaluation. Two sources, by precedent
// in the codebase:
//
//   - subjects of self-memberships the holder has accepted whose
//     org_id leaf names this org (i.e. open-joined members)
//   - member_id leaves of memberships the named org issued (the
//     org-issued credential pattern from Phase 5b; org_id leaf
//     names this org)
//
// Predicate logic is inlined here rather than importing from the
// connections feature so the governance substrate stays free of
// reverse dependencies on the consumers that compose it.
function knownMembersOf(orgId: string, holdings: readonly Attestation[]): Set<string> {
  const out = new Set<string>();
  for (const a of holdings) {
    if (a.kind !== 'credential') continue;
    const claim = a.claim as FieldBranch;
    if (claim.node !== 'branch') continue;
    let credType = '';
    let attOrgId = '';
    let memberId = '';
    for (const c of claim.children) {
      if (c.node !== 'leaf' || typeof c.value !== 'string') continue;
      if (c.name === 'credential_type') credType = c.value;
      else if (c.name === 'org_id') attOrgId = c.value;
      else if (c.name === 'member_id') memberId = c.value;
    }
    if (attOrgId.trim().toLowerCase() !== orgId) continue;
    if (credType === 'self_membership') {
      out.add(a.subject.trim().toLowerCase());
    } else if (credType === 'membership' && memberId) {
      out.add(memberId.trim().toLowerCase());
    }
  }
  return out;
}
