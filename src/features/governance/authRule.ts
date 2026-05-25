import type {
  Attestation,
  DisclosureProofBundle,
  FieldBranch,
  FieldLeaf,
} from 'tapit-attest';
import { disclosureProof } from 'tapit-attest';

// Phase 8 Phase A — Tapscript-style authorization rules. Each rule
// is { action, threshold, eligible[] } — "this action requires this
// many signatures from this eligible set." Rules become field-tree
// leaves under a sub-branch named `auth` in an org self-declaration's
// claim tree. The shipped disclosureProof primitive then produces a
// reveal-one-leaf proof that downstream envelopes carry as their
// authorization, exactly the way a Taproot spend reveals one
// Tapscript leaf from a Merkle tree of alternative spending
// conditions — same Merkle shape, off-chain, with attestation leaves
// instead of script leaves. See
// project-memory/foreman-memory/projects/tapit-wallet/briefs/
// 2026-05-25-tapscript-style-org-authorization-tree-roadmap.md.
//
// This module is the org-agnostic substrate. Org-specific glue
// (selfDeclareOrganization, verifyOrgAuthorization, etc.) lives in
// src/features/connections/createOrganization.ts and imports from
// here. Future phases (Phase E1 join-rule kind, Phase D charter
// amendment chain) extend the rule shape here in place.

export interface AuthRule {
  /** Action name (e.g. 'routine_issuance', 'expulsion'). Distinct per org. */
  action: string;
  /** Minimum eligible signatures required to authorize the action. */
  threshold: number;
  /** Pubkeys (x-only hex) whose signatures count toward the threshold. */
  eligible: readonly string[];
}

/** Default rule applied when an org self-declaration is built without
 *  explicit authRules — preserves the "founder signs everything"
 *  behaviour of pre-Phase-A orgs as an explicit single-rule charter. */
export function defaultAuthRules(orgIdentity: string): AuthRule[] {
  return [{ action: 'routine_issuance', threshold: 1, eligible: [orgIdentity] }];
}

/** Canonical encoding of a rule's value-payload, sorted-eligible so
 *  the same rule always hashes the same way regardless of input order. */
export function encodeAuthRuleValue(rule: AuthRule): string {
  const eligibleSorted = [...rule.eligible]
    .map((e) => e.trim().toLowerCase())
    .sort();
  return JSON.stringify({ threshold: rule.threshold, eligible: eligibleSorted });
}

/** Parse a rule out of its encoded leaf value. Returns null on any
 *  shape mismatch — callers treat null as "this rule slot is malformed,
 *  ignore it" rather than throwing into UI render paths. */
export function decodeAuthRuleValue(action: string, value: unknown): AuthRule | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    if (typeof p.threshold !== 'number' || !Number.isFinite(p.threshold)) return null;
    if (!Array.isArray(p.eligible)) return null;
    const eligible: string[] = [];
    for (const e of p.eligible) {
      if (typeof e !== 'string') return null;
      eligible.push(e);
    }
    return { action, threshold: p.threshold, eligible };
  } catch {
    return null;
  }
}

/** Build the sub-object that becomes the `auth` branch in the claim
 *  tree. Throws on duplicate action names, on threshold less than 1,
 *  or on threshold exceeding the eligible-set size — all three would
 *  produce an authorization rule that can never be satisfied or is
 *  ambiguous, so we reject at creation time rather than at verify time. */
export function buildAuthSubtree(rules: readonly AuthRule[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rules) {
    if (out[r.action] !== undefined) {
      throw new Error(`duplicate auth rule action: ${r.action}`);
    }
    if (!Number.isInteger(r.threshold) || r.threshold < 1) {
      throw new Error(`auth rule threshold must be a positive integer: ${r.action}`);
    }
    if (r.eligible.length < r.threshold) {
      throw new Error(
        `auth rule threshold ${r.threshold} exceeds eligible count ${r.eligible.length}: ${r.action}`,
      );
    }
    out[r.action] = encodeAuthRuleValue(r);
  }
  return out;
}

/** Locate the `auth` branch in a self-declaration's claim tree, or
 *  null if the declaration predates Phase A and carries no auth tree. */
function findAuthBranch(orgSelfDecl: Attestation): FieldBranch | null {
  for (const child of orgSelfDecl.claim.children) {
    if (child.node === 'branch' && child.name === 'auth') return child;
  }
  return null;
}

/**
 * Look up one authorization rule by action name. Returns the rule
 * plus the slash-delimited path inside the claim tree (e.g.
 * `auth/routine_issuance`) so callers can pass that path straight
 * to disclosureProof. Returns null if no auth tree is present, or
 * if the named action is not declared, or if the leaf is malformed.
 */
export function findAuthRule(
  orgSelfDecl: Attestation,
  action: string,
): { rule: AuthRule; path: string } | null {
  const authBranch = findAuthBranch(orgSelfDecl);
  if (!authBranch) return null;
  for (const child of authBranch.children) {
    if (child.node !== 'leaf' || child.name !== action) continue;
    const leaf = child as FieldLeaf;
    const rule = decodeAuthRuleValue(action, leaf.value);
    if (!rule) return null;
    return { rule, path: `auth/${action}` };
  }
  return null;
}

/** Enumerate every declared rule in the org's auth tree, in
 *  field-tree order. Empty array for declarations with no auth tree
 *  or a malformed one. Useful for governance-display UI in Phase C. */
export function listAuthRules(orgSelfDecl: Attestation): AuthRule[] {
  const authBranch = findAuthBranch(orgSelfDecl);
  if (!authBranch) return [];
  const out: AuthRule[] = [];
  for (const child of authBranch.children) {
    if (child.node !== 'leaf') continue;
    const rule = decodeAuthRuleValue(child.name, (child as FieldLeaf).value);
    if (rule) out.push(rule);
  }
  return out;
}

/**
 * Produce a disclosure proof of one authorization rule from the org's
 * self-declaration. Downstream envelopes carry this bundle as their
 * authorization — the verifier reconstructs the self-declaration's
 * claim root from the proof and confirms the named action's rule is
 * genuinely committed in the org's signed declaration. Returns null
 * when the rule does not exist.
 */
export function proveAuthorization(
  orgSelfDecl: Attestation,
  action: string,
): DisclosureProofBundle | null {
  const found = findAuthRule(orgSelfDecl, action);
  if (!found) return null;
  return disclosureProof(orgSelfDecl, found.path);
}

// Phase 8 Phase B — Authorized envelope shape. An org-issued
// credential carries its authorization as a top-level `authorized_by`
// leaf whose canonical-JSON value is {org_identity, action, proof}.
// The proof is the Phase A DisclosureProofBundle for the rule the
// action is authorized under. Putting the payload INSIDE the
// envelope's claim tree means the envelope's own signature covers
// the proof too — a caller cannot detach the proof, swap it for a
// different one, and present the new combination as still-signed.

/** The shape carried inside the `authorized_by` leaf of an org-issued envelope. */
export interface AuthorizedByPayload {
  /** Hex pubkey of the org whose self-declaration this proof comes from. */
  org_identity: string;
  /** Action name claimed; must match the disclosed leaf's name. */
  action: string;
  /** Disclosure proof of the auth-rule leaf from the org's self-declaration. */
  proof: DisclosureProofBundle;
}

/** Encode an AuthorizedByPayload as a canonical-JSON string for use as a field-tree leaf value. */
export function encodeAuthorizedBy(payload: AuthorizedByPayload): string {
  return JSON.stringify(payload);
}

/** Parse the `authorized_by` leaf value back into a payload, or null on any shape mismatch. */
export function decodeAuthorizedBy(value: unknown): AuthorizedByPayload | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    if (typeof p.org_identity !== 'string') return null;
    if (typeof p.action !== 'string') return null;
    if (!p.proof || typeof p.proof !== 'object') return null;
    // The proof's deep shape is validated by verifyDisclosureProof at verify
    // time; this decoder only confirms the outer envelope of fields is present.
    return {
      org_identity: p.org_identity,
      action: p.action,
      proof: p.proof as DisclosureProofBundle,
    };
  } catch {
    return null;
  }
}

/** Bundle the org's self-declaration + an action into an AuthorizedByPayload ready
 *  to inline as the `authorized_by` leaf of a child credential. Returns null when
 *  the action is not declared in the org's auth tree. */
export function buildAuthorizedByPayload(
  orgSelfDecl: Attestation,
  action: string,
): AuthorizedByPayload | null {
  const proof = proveAuthorization(orgSelfDecl, action);
  if (!proof) return null;
  return {
    org_identity: orgSelfDecl.subject,
    action,
    proof,
  };
}

export interface OrgAuthorizationResult {
  /** True iff the envelope carries a valid cross-envelope authorization proof
   *  from the named org AND meets the disclosed rule's eligible-signature threshold. */
  authorized: boolean;
  /** Human-readable reason; meaningful whether authorized or not. */
  reason: string;
  /** When evaluable, how many eligible signatures were counted on the envelope. */
  eligibleCount?: number;
  /** When evaluable, the threshold the rule required. */
  thresholdRequired?: number;
}
