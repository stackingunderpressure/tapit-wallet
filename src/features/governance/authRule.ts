import type {
  Attestation,
  DisclosureProofBundle,
  FieldBranch,
  FieldLeaf,
} from 'tapit-attest';
import { disclosureProof } from 'tapit-attest';

// Phase 8 Phase A — Tapscript-style authorization rules. Each rule
// is a leaf under the org self-declaration's `auth` claim-tree
// sub-branch, exactly the way a Taproot spend reveals one Tapscript
// leaf from a Merkle tree of alternative spending conditions — same
// Merkle shape, off-chain, with attestation leaves instead of script
// leaves. The shipped disclosureProof primitive produces the
// reveal-one-leaf proof that downstream envelopes carry as their
// authorization. See
// project-memory/foreman-memory/projects/tapit-wallet/briefs/
// 2026-05-25-tapscript-style-org-authorization-tree-roadmap.md.
//
// Phase E1 — the rule shape is a discriminated union. Existing
// org-action rules ({threshold, eligible}) cover SIGNER-SIDE
// authorization for actions the org takes (issuance, expulsion,
// charter amendment). The new join-rule kind covers JOINER-SIDE
// authorization for member-initiated joining and carries a `policy`
// payload instead of {threshold, eligible}. Dispatch happens by
// action name (`join` is the join-rule action) so the on-disk
// canonical-JSON encoding stays backward-compatible with pre-E1
// declarations — old rules decode unchanged, new join rules decode
// via the new path. See
// project-memory/foreman-memory/projects/tapit-wallet/briefs/
// 2026-05-25-open-joining-and-configurable-membership-policy-roadmap.md.
//
// This module is the org-agnostic substrate. Org-specific glue
// (selfDeclareOrganization, verifyOrgAuthorization, etc.) lives in
// src/features/connections/createOrganization.ts and imports from
// here.

/** A signer-side authorization rule for an action the ORG takes
 *  (issuance, expulsion, charter amendment, dissolution, etc.).
 *  Threshold names how many signatures from the eligible set are
 *  required for the action to be authorized. */
export interface AuthRuleForOrgAction {
  /** Action name. Anything except `'join'`. */
  action: string;
  /** Minimum eligible signatures required to authorize the action. */
  threshold: number;
  /** Pubkeys (x-only hex) whose signatures count toward the threshold. */
  eligible: readonly string[];
}

/** A joiner-side membership policy. Each kind names a different
 *  abuse-resistance posture an org can pick at declaration time. */
export type JoinPolicy =
  /** Anyone with a wallet can self-claim membership. */
  | { kind: 'open' }
  /** Only pubkeys in the list may self-claim. */
  | { kind: 'allow_list'; pubkeys: readonly string[] }
  /** Anyone except pubkeys in the list may self-claim. */
  | { kind: 'deny_list'; pubkeys: readonly string[] }
  /** Joiner must already hold a handshake with at least one of these pubkeys. */
  | { kind: 'requires_handshake'; with_any_of: readonly string[] }
  /** Joiner must hold a credential of this type (optionally issued by `issuer`). */
  | { kind: 'requires_credential'; credential_type: string; issuer?: string }
  /** Joiner needs co-signs from this many existing members. */
  | { kind: 'requires_vouch'; from_any_member_count: number };

/** A joiner-side rule. Action is always `'join'`; the `policy` field
 *  carries the kind-specific configuration. */
export interface AuthRuleForJoin {
  action: 'join';
  policy: JoinPolicy;
}

/** Discriminated union of every authorization rule kind an org's
 *  auth tree can carry. Dispatch on `action === 'join'` (or the
 *  `isJoinRule` type guard) before reading kind-specific fields. */
export type AuthRule = AuthRuleForOrgAction | AuthRuleForJoin;

/** True iff the rule is a joiner-side rule (action `'join'` with a `policy` payload). */
export function isJoinRule(rule: AuthRule): rule is AuthRuleForJoin {
  return rule.action === 'join' && 'policy' in rule;
}

/** True iff the rule is a signer-side rule for an org action. The
 *  complement of `isJoinRule`. */
export function isOrgActionRule(rule: AuthRule): rule is AuthRuleForOrgAction {
  return !isJoinRule(rule);
}

/** Default rule applied when an org self-declaration is built without
 *  explicit authRules — preserves the "founder signs everything"
 *  behaviour of pre-Phase-A orgs as an explicit single-rule charter. */
export function defaultAuthRules(orgIdentity: string): AuthRuleForOrgAction[] {
  return [{ action: 'routine_issuance', threshold: 1, eligible: [orgIdentity] }];
}

// ---------- Encoding / decoding (dispatch by rule kind) ----------

/** Canonical encoding of a rule's value-payload as a JSON string.
 *  Org-action rules encode as `{threshold, eligible}` with eligible
 *  sorted+lowercased so the same rule always hashes the same way.
 *  Join rules encode as `{policy: {kind, ...payload}}` with any
 *  pubkey-list fields inside the policy similarly sorted+lowercased. */
export function encodeAuthRuleValue(rule: AuthRule): string {
  if (isJoinRule(rule)) {
    return JSON.stringify({ policy: normalizeJoinPolicy(rule.policy) });
  }
  const eligibleSorted = [...rule.eligible]
    .map((e) => e.trim().toLowerCase())
    .sort();
  return JSON.stringify({ threshold: rule.threshold, eligible: eligibleSorted });
}

function normalizeJoinPolicy(p: JoinPolicy): JoinPolicy {
  switch (p.kind) {
    case 'allow_list':
      return { kind: 'allow_list', pubkeys: sortLowerHex(p.pubkeys) };
    case 'deny_list':
      return { kind: 'deny_list', pubkeys: sortLowerHex(p.pubkeys) };
    case 'requires_handshake':
      return { kind: 'requires_handshake', with_any_of: sortLowerHex(p.with_any_of) };
    case 'requires_credential':
      return p.issuer
        ? {
            kind: 'requires_credential',
            credential_type: p.credential_type,
            issuer: p.issuer.trim().toLowerCase(),
          }
        : { kind: 'requires_credential', credential_type: p.credential_type };
    case 'requires_vouch':
    case 'open':
      return p;
  }
}

function sortLowerHex(list: readonly string[]): string[] {
  return [...list].map((s) => s.trim().toLowerCase()).sort();
}

/** Parse a rule out of its encoded leaf value. Returns null on any
 *  shape mismatch — callers treat null as "this rule slot is malformed,
 *  ignore it" rather than throwing into UI render paths. Dispatch is
 *  by `action` name: `'join'` decodes the policy shape, anything else
 *  decodes the {threshold, eligible} shape. */
export function decodeAuthRuleValue(action: string, value: unknown): AuthRule | null {
  if (typeof value !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Record<string, unknown>;
  if (action === 'join') {
    const policy = decodeJoinPolicy(p.policy);
    return policy ? { action: 'join', policy } : null;
  }
  if (typeof p.threshold !== 'number' || !Number.isFinite(p.threshold)) return null;
  if (!Array.isArray(p.eligible)) return null;
  const eligible: string[] = [];
  for (const e of p.eligible) {
    if (typeof e !== 'string') return null;
    eligible.push(e);
  }
  return { action, threshold: p.threshold, eligible };
}

function decodeJoinPolicy(raw: unknown): JoinPolicy | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.kind !== 'string') return null;
  switch (p.kind) {
    case 'open':
      return { kind: 'open' };
    case 'allow_list': {
      const pubkeys = decodeStringArray(p.pubkeys);
      return pubkeys ? { kind: 'allow_list', pubkeys } : null;
    }
    case 'deny_list': {
      const pubkeys = decodeStringArray(p.pubkeys);
      return pubkeys ? { kind: 'deny_list', pubkeys } : null;
    }
    case 'requires_handshake': {
      const with_any_of = decodeStringArray(p.with_any_of);
      return with_any_of ? { kind: 'requires_handshake', with_any_of } : null;
    }
    case 'requires_credential': {
      if (typeof p.credential_type !== 'string' || p.credential_type.length === 0) return null;
      if (p.issuer !== undefined && typeof p.issuer !== 'string') return null;
      return p.issuer
        ? {
            kind: 'requires_credential',
            credential_type: p.credential_type,
            issuer: p.issuer,
          }
        : { kind: 'requires_credential', credential_type: p.credential_type };
    }
    case 'requires_vouch':
      if (
        typeof p.from_any_member_count !== 'number' ||
        !Number.isInteger(p.from_any_member_count) ||
        p.from_any_member_count < 1
      ) {
        return null;
      }
      return { kind: 'requires_vouch', from_any_member_count: p.from_any_member_count };
    default:
      return null;
  }
}

function decodeStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const s of raw) {
    if (typeof s !== 'string') return null;
    out.push(s);
  }
  return out;
}

// ---------- Auth-subtree construction (validate then encode) ----------

/** Build the sub-object that becomes the `auth` branch in the claim
 *  tree. Throws on duplicate action names (every rule slot must be
 *  unique by name in a single declaration) and on any kind-specific
 *  validation failure — org-action rules reject threshold < 1 / non-
 *  integer / threshold > eligible-count; join rules reject malformed
 *  policy payloads. All validation runs at creation time so
 *  unsignable rules never reach storage. */
export function buildAuthSubtree(rules: readonly AuthRule[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rules) {
    if (out[r.action] !== undefined) {
      throw new Error(`duplicate auth rule action: ${r.action}`);
    }
    if (isJoinRule(r)) {
      validateJoinPolicy(r.policy);
    } else {
      if (!Number.isInteger(r.threshold) || r.threshold < 1) {
        throw new Error(`auth rule threshold must be a positive integer: ${r.action}`);
      }
      if (r.eligible.length < r.threshold) {
        throw new Error(
          `auth rule threshold ${r.threshold} exceeds eligible count ${r.eligible.length}: ${r.action}`,
        );
      }
    }
    out[r.action] = encodeAuthRuleValue(r);
  }
  return out;
}

function validateJoinPolicy(p: JoinPolicy): void {
  switch (p.kind) {
    case 'open':
      return;
    case 'allow_list':
    case 'deny_list':
      // Empty lists are structurally fine — an empty allow_list
      // accepts nobody, an empty deny_list denies nobody. Both
      // are valid expressions even if rarely useful.
      for (const k of p.pubkeys) {
        if (typeof k !== 'string') {
          throw new Error(`join policy ${p.kind}: pubkeys must be strings`);
        }
      }
      return;
    case 'requires_handshake':
      if (p.with_any_of.length < 1) {
        throw new Error('join policy requires_handshake: with_any_of must name at least one pubkey');
      }
      return;
    case 'requires_credential':
      if (p.credential_type.length === 0) {
        throw new Error('join policy requires_credential: credential_type must be non-empty');
      }
      return;
    case 'requires_vouch':
      if (!Number.isInteger(p.from_any_member_count) || p.from_any_member_count < 1) {
        throw new Error('join policy requires_vouch: from_any_member_count must be a positive integer');
      }
      return;
  }
}

// ---------- Lookup helpers ----------

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
 * The returned rule is the union — callers that expect an
 * org-action shape narrow via `isOrgActionRule`; callers expecting
 * the join shape narrow via `isJoinRule`.
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
