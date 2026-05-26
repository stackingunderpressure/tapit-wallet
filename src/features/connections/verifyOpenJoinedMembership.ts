import type { Attestation } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { findAuthRule, isJoinRule } from '../governance/authRule.ts';
import { evaluateJoinPolicy } from '../governance/evaluateJoinPolicy.ts';
import { leafValue } from './createHandshake.ts';
import { isSelfMembership } from './createMembership.ts';
import {
  isOpenMemberRoster,
  readOpenMemberRoster,
} from './openMemberRoster.ts';
import { isOrganizationSelfDeclaration } from './createOrganization.ts';

// Phase 8 Phase E4 cut 1 — open-joined-membership verifier. Under the
// operator-locked Option 3 hybrid substrate from the open-joining brief
// (project-memory/foreman-memory/projects/tapit-wallet/briefs/
// 2026-05-25-open-joining-and-configurable-membership-policy-roadmap.md),
// a self-signed membership envelope is provable in TWO independent ways
// and the verifier accepts whichever path checks out:
//
//   ROSTER PATH (Option 1) — the org publishes a periodic open-member
//     roster snapshot (envelope shape shipped in Phase E3 cut 2). The
//     verifier consults the latest roster the caller holds; the joiner
//     is valid iff their pubkey + self-membership envelopeId appear as
//     an entry in that signed roster. The org chose to ratify them by
//     publishing; the roster's own signature is the proof.
//
//   AUTH-TREE PATH (Option 2) — the org's self-declaration carries an
//     {action: 'join', policy: ...} leaf in its auth tree (Phase E1
//     discriminated-union shape, Phase E3 cut 1 evaluator). The
//     verifier looks up the rule via findAuthRule, type-narrows via
//     isJoinRule, and runs evaluateJoinPolicy against the envelope.
//     For the list-checking policies (open / allow_list / deny_list)
//     the evaluator returns a verdict from the envelope alone; for
//     the proof-required kinds (handshake / credential / vouch) the
//     evaluator currently rejects with reason naming Phase E4 cut 2
//     as the milestone that adds proof reading.
//
// Hybrid precedence: roster path is consulted first because the roster
// is a single auditable artifact and the verifier already holds it; if
// it validates, no policy walk is needed. If the roster either is not
// held or does not name the member, the verifier falls back to the
// auth-tree walk. Both rejecting yields a consolidated reason naming
// both attempted paths.
//
// Structural gates run BEFORE either path so an envelope that is
// shape-broken or org-mismatched gets rejected with a clear reason
// rather than a misleading policy-rejection or roster-absence reason.
//
// This module is a pure composer — no I/O, no signing, no wallet
// calls. Caller responsibility (wallet.hold, ScanEnvelopeModal flow,
// Mycelium inbox routing) for the cryptographic integrity of the
// envelopes passed in. The verifier checks structural bindings
// (subject == signed, org_id matches the named self-declaration) but
// does not re-verify signatures because the calling code path has
// already done so via wallet.hold's internal verify.

/** Named outcome of the open-joined-membership verifier. */
export interface OpenJoinVerificationResult {
  /** True iff at least one of the hybrid proof paths accepts the joiner. */
  valid: boolean;
  /** Human-readable reason. When valid, names which path accepted. When
   *  invalid, names every path that rejected and why. */
  reason: string;
  /** Which proof path succeeded. `'none'` when invalid. */
  proofPath: 'roster' | 'auth_tree' | 'none';
}

/**
 * Verify an open-joined self-membership envelope under the Option 3
 * hybrid substrate. Structural gates run first; then the roster path
 * is tried (when a current roster is supplied); then the auth-tree
 * path. Returns valid as soon as either succeeds, with `proofPath`
 * naming which one. Returns invalid only when both paths reject (or
 * when a structural gate fails before either path runs).
 *
 * Caller responsibility:
 *  - envelope is a self-membership credential the caller pulled from
 *    holdings (or just received and is about to hold). wallet.hold
 *    has already verified the joiner's signature cryptographically;
 *    this verifier only checks the signature claim is structurally
 *    present.
 *  - orgSelfDecl is the org's self-declaration the caller holds
 *    locally — the same envelope findOwnOrgDeclaration returns for
 *    the org operator, or the envelope a remote joiner scanned + held
 *    when learning the org's pubkey.
 *  - currentRoster, when supplied, is the latest open-member roster
 *    the caller holds for the named org (findLatestOpenMemberRoster
 *    is the production lookup). Omit or pass null when no roster has
 *    been published yet; the verifier falls back to the auth-tree
 *    path.
 */
export function verifyOpenJoinedMembership(
  envelope: Attestation,
  orgSelfDecl: Attestation,
  currentRoster?: Attestation | null,
): OpenJoinVerificationResult {
  // ---------- Structural gates ----------

  if (!isSelfMembership(envelope)) {
    return {
      valid: false,
      reason: 'envelope is not a self-membership credential',
      proofPath: 'none',
    };
  }

  if (!isOrganizationSelfDeclaration(orgSelfDecl)) {
    return {
      valid: false,
      reason: 'orgSelfDecl is not an organization self-declaration',
      proofPath: 'none',
    };
  }

  const orgIdLower = orgSelfDecl.subject.toLowerCase();
  const envelopeOrgId = leafValue(envelope, 'org_id').toLowerCase();
  if (envelopeOrgId !== orgIdLower) {
    return {
      valid: false,
      reason: "envelope's org_id leaf does not match orgSelfDecl.subject",
      proofPath: 'none',
    };
  }

  const joinerSubject = envelope.subject.toLowerCase();
  const joinerSigned = envelope.signatures.some(
    (s) => s.signer.toLowerCase() === joinerSubject,
  );
  if (!joinerSigned) {
    return {
      valid: false,
      reason: 'self-membership envelope is not signed by its subject (the joiner)',
      proofPath: 'none',
    };
  }

  const orgSigned = orgSelfDecl.signatures.some(
    (s) => s.signer.toLowerCase() === orgIdLower,
  );
  if (!orgSigned) {
    return {
      valid: false,
      reason: 'org self-declaration is not signed by its subject (the org)',
      proofPath: 'none',
    };
  }

  // ---------- Roster path (Option 1) ----------

  const rosterReason = tryRosterPath(envelope, orgSelfDecl, currentRoster ?? null);
  if (rosterReason.accepted) {
    return { valid: true, reason: rosterReason.reason, proofPath: 'roster' };
  }

  // ---------- Auth-tree path (Option 2) ----------

  const treeReason = tryAuthTreePath(envelope, orgSelfDecl);
  if (treeReason.accepted) {
    return { valid: true, reason: treeReason.reason, proofPath: 'auth_tree' };
  }

  return {
    valid: false,
    reason: `no hybrid proof accepted — roster path: ${rosterReason.reason}; auth-tree path: ${treeReason.reason}`,
    proofPath: 'none',
  };
}

interface PathOutcome {
  accepted: boolean;
  reason: string;
}

function tryRosterPath(
  envelope: Attestation,
  orgSelfDecl: Attestation,
  currentRoster: Attestation | null,
): PathOutcome {
  if (!currentRoster) {
    return { accepted: false, reason: 'no current roster supplied' };
  }
  if (!isOpenMemberRoster(currentRoster)) {
    return { accepted: false, reason: 'current roster envelope is not an open-member roster' };
  }
  const orgIdLower = orgSelfDecl.subject.toLowerCase();
  if (currentRoster.subject.toLowerCase() !== orgIdLower) {
    return {
      accepted: false,
      reason: 'current roster is subject-bound to a different org',
    };
  }
  const rosterSignedByOrg = currentRoster.signatures.some(
    (s) => s.signer.toLowerCase() === orgIdLower,
  );
  if (!rosterSignedByOrg) {
    return {
      accepted: false,
      reason: 'current roster is not signed by the org',
    };
  }
  const entries = readOpenMemberRoster(currentRoster);
  const joinerLower = envelope.subject.toLowerCase();
  const envId = envelopeId(envelope);
  const match = entries.find(
    (e) =>
      e.member_id.toLowerCase() === joinerLower &&
      e.self_membership_envelope_id === envId,
  );
  if (!match) {
    return {
      accepted: false,
      reason: "current roster does not list this joiner's self-membership envelope",
    };
  }
  return {
    accepted: true,
    reason: 'joiner is named on the org-signed open-member roster',
  };
}

function tryAuthTreePath(envelope: Attestation, orgSelfDecl: Attestation): PathOutcome {
  const found = findAuthRule(orgSelfDecl, 'join');
  if (!found) {
    return {
      accepted: false,
      reason: 'org has not declared a join policy in its auth tree',
    };
  }
  if (!isJoinRule(found.rule)) {
    return {
      accepted: false,
      reason: "auth-tree leaf at 'join' is not a join rule",
    };
  }
  const verdict = evaluateJoinPolicy(found.rule.policy, envelope, []);
  if (!verdict.accepted) {
    return { accepted: false, reason: verdict.reason };
  }
  return { accepted: true, reason: verdict.reason };
}
