import type { Attestation } from 'tapit-attest';
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
// and its own auth tree. The other three kinds (`requires_handshake`,
// `requires_credential`, `requires_vouch`) need joiner-side proof
// attachment that Phase E2's buildSelfMembershipDraft does not yet
// produce; this cut returns a structured reject for those, with the
// reason naming Phase E4 as the milestone that adds proof reading.
// Phase E4 extends this evaluator with the proof-bundle path; the
// signature here stays stable.

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
 *  `subject` as the joiner's pubkey for the list-checking policies.
 *  `_holdings` is the org wallet's current holdings — reserved for
 *  Phase E4 when proof-attached policies start consulting them; this
 *  cut does not read it. Pure function, no I/O. */
export function evaluateJoinPolicy(
  policy: JoinPolicy,
  selfMembership: Attestation,
  _holdings: readonly Attestation[],
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
      return {
        accepted: false,
        reason:
          'policy kind requires_handshake needs joiner-side proof attachment, deferred to Phase E4',
      };
    case 'requires_credential':
      return {
        accepted: false,
        reason:
          'policy kind requires_credential needs joiner-side proof attachment, deferred to Phase E4',
      };
    case 'requires_vouch':
      return {
        accepted: false,
        reason:
          'policy kind requires_vouch needs cosign-bearing self-membership, deferred to Phase E4',
      };
  }
}
