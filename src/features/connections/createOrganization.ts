import type { Attestation, Wallet } from 'tapit-attest';
import {
  credentialAttestation,
  envelopeId,
  verifyDisclosureProof,
} from 'tapit-attest';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import {
  buildAuthSubtree,
  decodeAuthRuleValue,
  decodeAuthorizedBy,
  defaultAuthRules,
  isOrgActionRule,
  type AuthRule,
  type OrgAuthorizationResult,
} from '../governance/authRule.ts';
import { leafValue } from './createHandshake.ts';
import { isMembership, readMembership } from './createMembership.ts';

// Re-export the governance auth-rule primitives so existing callers
// of `createOrganization.ts` keep working without changing import
// sites. The substrate itself lives in `src/features/governance/`
// (Phase 8 Phase A + Phase B, see brief
// 2026-05-25-tapscript-style-org-authorization-tree-roadmap.md); the
// org-specific glue (selfDeclareOrganization, verifyOrgAuthorization,
// the officials roster, ratifications, the membership chain walker)
// stays here. Phase C UI work that needs the rule primitives should
// import them directly from '../governance/authRule.ts'.
export type {
  AuthRule,
  AuthorizedByPayload,
  OrgAuthorizationResult,
} from '../governance/authRule.ts';
export {
  buildAuthSubtree,
  buildAuthorizedByPayload,
  decodeAuthRuleValue,
  decodeAuthorizedBy,
  defaultAuthRules,
  encodeAuthRuleValue,
  encodeAuthorizedBy,
  findAuthRule,
  listAuthRules,
  proveAuthorization,
} from '../governance/authRule.ts';

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
//
// Phase 8 Phase A: optional authRules parameter declares the
// authorization tree at creation time. When omitted, a single
// routine_issuance rule with the founder eligible is used — the
// declaration always carries an auth sub-branch so the governance
// structure is self-documenting in the envelope itself.

/** Build the unsigned org-self-declaration draft. Pure function — no
 *  signing, no holding, no anchoring. Lets tests exercise the
 *  envelope shape and the auth-tree-encoding round-trip without
 *  needing the async hold/anchor pipeline. Production code calls
 *  this from selfDeclareOrganization below. */
export function buildOrgSelfDeclarationDraft(
  identity: string,
  orgName: string,
  authRules?: readonly AuthRule[],
  declaredAt?: string,
): Attestation {
  const trimmed = orgName.trim();
  if (trimmed.length === 0) {
    throw new Error('org name must not be empty');
  }
  const rules = authRules ?? defaultAuthRules(identity);
  const auth = buildAuthSubtree(rules);
  return credentialAttestation({
    subject: identity,
    tier: 'notable',
    fields: {
      credential_type: 'organization',
      org_name: trimmed,
      pubkey: identity,
      declared_at: declaredAt ?? new Date().toISOString(),
      auth,
    },
  });
}

export async function selfDeclareOrganization(
  wallet: Wallet,
  ownerId: string,
  anchorWorker: WorkerHandle | null,
  orgName: string,
  authRules?: readonly AuthRule[],
): Promise<Attestation> {
  const draft = buildOrgSelfDeclarationDraft(wallet.identity, orgName, authRules);
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

/**
 * Verify the cross-envelope authorization of an org-issued credential. The
 * envelope must carry an `authorized_by` top-level leaf whose payload names the
 * authorizing org, the action the credential claims to be issued under, and a
 * disclosure proof of the matching auth-rule from the org's self-declaration.
 *
 * Authorization holds iff:
 *   - the org's self-declaration is present in `knownOrgs`
 *   - the disclosure proof verifies under verifyDisclosureProof
 *   - the proof's recomputed digest equals the org self-declaration's envelopeId
 *     (i.e. the proof was made against THIS specific self-declaration)
 *   - the disclosed leaf's name matches the claimed action
 *   - at least `rule.threshold` of the envelope's signatures come from pubkeys
 *     in the disclosed rule's `eligible` set
 *
 * Returns a structured result rather than throwing because the caller is usually
 * UI code (a verifier badge, an inbox acceptor) that wants the reason in hand.
 *
 * Four-forgery-class fuzz coverage lives in createOrganization.test.ts: leaf-value
 * tampered, wrong-org-binding via same-subject-different-digest, tampered
 * sibling-hash path, tampered meta-fields. The first is caught by
 * verifyDisclosureProof; the second by the digest equality check below; the third
 * and fourth by verifyDisclosureProof again via different mutation paths.
 */
export function verifyOrgAuthorization(
  envelope: Attestation,
  knownOrgs: readonly Attestation[],
): OrgAuthorizationResult {
  const rawLeaf = leafValue(envelope, 'authorized_by');
  if (!rawLeaf) {
    return { authorized: false, reason: 'envelope has no authorized_by leaf' };
  }
  const payload = decodeAuthorizedBy(rawLeaf);
  if (!payload) {
    return { authorized: false, reason: 'authorized_by leaf is malformed' };
  }

  const orgIdLower = payload.org_identity.toLowerCase();
  const orgSelfDecl = knownOrgs.find(
    (o) =>
      isOrganizationSelfDeclaration(o) &&
      o.subject.toLowerCase() === orgIdLower,
  );
  if (!orgSelfDecl) {
    return {
      authorized: false,
      reason: `org self-declaration not held locally for ${payload.org_identity}`,
    };
  }

  const proofResult = verifyDisclosureProof(payload.proof);
  if (!proofResult.valid) {
    return {
      authorized: false,
      reason: `disclosure proof invalid: ${proofResult.errors.join('; ') || 'no valid signature'}`,
    };
  }

  const expectedDigest = envelopeId(orgSelfDecl);
  if (proofResult.digest.toLowerCase() !== expectedDigest.toLowerCase()) {
    return {
      authorized: false,
      reason: 'proof binds to a different attestation than the named org self-declaration',
    };
  }

  if (payload.proof.leaf.name !== payload.action) {
    return {
      authorized: false,
      reason: `proof discloses rule '${payload.proof.leaf.name}' but action claims '${payload.action}'`,
    };
  }

  const rule = decodeAuthRuleValue(payload.action, payload.proof.leaf.value);
  if (!rule) {
    return { authorized: false, reason: 'disclosed rule leaf is malformed' };
  }
  // verifyOrgAuthorization is the signer-side verifier for actions
  // the org takes (issuance, expulsion, charter amendment); joiner-
  // side verification (Phase E4) runs through a separate primitive
  // because the threshold-of-signatures model does not apply to
  // self-claim membership envelopes.
  if (!isOrgActionRule(rule)) {
    return {
      authorized: false,
      reason: `action '${payload.action}' is not a signer-side org-action rule`,
    };
  }

  const eligibleSet = new Set(rule.eligible.map((e) => e.toLowerCase()));
  const matchedSigners = new Set<string>();
  for (const sig of envelope.signatures) {
    const signerLower = sig.signer.toLowerCase();
    if (eligibleSet.has(signerLower)) {
      matchedSigners.add(signerLower);
    }
  }

  if (matchedSigners.size < rule.threshold) {
    return {
      authorized: false,
      reason: `threshold not met: ${matchedSigners.size} eligible signatures present, ${rule.threshold} required`,
      eligibleCount: matchedSigners.size,
      thresholdRequired: rule.threshold,
    };
  }

  return {
    authorized: true,
    reason: `${matchedSigners.size} of ${rule.threshold} required eligible signatures present`,
    eligibleCount: matchedSigners.size,
    thresholdRequired: rule.threshold,
  };
}

// 5b-org-ii (officials roster), 5b-org-iii (ratifications) — extracted
// to ./officialsRoster.ts as a sibling module so the governance-
// direction half of an org's self-issued credential set has its own
// home, mirroring openMemberRoster.ts on the membership-direction
// half. Type + helper exports: Official, RatificationSummary,
// isOfficialsRoster, readOfficials, findLatestOfficialsRoster,
// countRatifications, publishOfficialsRoster. Import directly from
// './officialsRoster.ts' at the call site rather than from this file.

// 5b-org-iv — nested-org chain walk. From any membership envelope,
// walk upward: this is the membership in X; here is X's membership
// in Y; here is Y's membership in Z — each link an ordinary
// membership attestation signed by the parent. The walk only sees
// what is in local holdings; when the parent chain is not locally
// known the walker stops, and the UI labels that "may continue
// further — the parent memberships are not in your wallet yet" so
// the operator is honest about visibility. Future Nostr-fetch or
// org-published-parents flows extend reach without changing this
// function's contract.

export interface ChainLink {
  /** Membership envelope; subject is the member at this level, org_id is the parent. */
  envelope: Attestation;
  /** Member side of this link (whoever is being declared a member). */
  memberId: string;
  memberName: string;
  /** Parent-org side (who is doing the declaring). */
  orgId: string;
  orgName: string;
}

export interface OrgChain {
  /** Ordered from the starting membership upward; first link is the input. */
  links: ChainLink[];
  /**
   * True when the walker ran out of locally-held data before
   * reaching a root — the chain may continue higher than what the
   * viewer can see locally.
   */
  truncated: boolean;
}

function toLink(att: Attestation): ChainLink {
  const m = readMembership(att);
  return {
    envelope: att,
    memberId: m.memberId,
    memberName: m.memberName,
    orgId: m.orgId,
    orgName: m.orgName,
  };
}

/**
 * Walk the nesting chain upward from a membership envelope, using
 * only the supplied holdings. At each step we look for a membership
 * whose subject equals the parent org's identity — i.e. THIS
 * organization's own membership in something larger. Stops on a cycle
 * (defensive — should not occur in a well-formed chain), when no
 * higher membership is locally held, or when the chain reaches a
 * length cap.
 */
export function walkOrgChain(
  holdings: readonly Attestation[],
  start: Attestation,
): OrgChain {
  if (!isMembership(start)) return { links: [], truncated: false };
  const links: ChainLink[] = [toLink(start)];
  const seen = new Set<string>([start.subject]);
  const MAX_DEPTH = 16; // honest soft cap; deeper than real federations
  for (let i = 0; i < MAX_DEPTH; i++) {
    const currentOrgId = links[links.length - 1]!.orgId;
    if (!currentOrgId) break;
    if (seen.has(currentOrgId)) break;
    seen.add(currentOrgId);
    const next = holdings.find(
      (a) => isMembership(a) && a.subject === currentOrgId,
    );
    if (!next) {
      return { links, truncated: true };
    }
    links.push(toLink(next));
  }
  return { links, truncated: false };
}
