import type { Attestation } from 'tapit-attest';
import { isHandshake, leafValue } from '../connections/createHandshake.ts';
import { isMembership, isSelfMembership } from '../connections/createMembership.ts';
import { isFamilyUnit, readFamilyUnit } from '../connections/familyUnit.ts';
import { isRecoveryShare } from '../recovery/createShares.ts';
import { isRecoveryRequest } from '../recovery/createRecoveryRequest.ts';
import {
  isReleaseAuthorityRequest,
  isAttestReleaseAuthority,
  isRevokeReleaseAuthority,
} from '../identity-gate/releaseAuthorityEnvelopes.ts';
import { PEER_COPY } from './peerCopy.ts';

// Envelope routing — kind-to-action mapping used by both the Mycelium
// inbox (InboxPanel) and the in-person scan path (ScanEnvelopeModal).
// Extracted from InboxPanel.tsx so any future arrival transport can
// hand the wallet an Attestation and get back the same action label,
// hint, and downstream handler key the inbox uses.
//
// The blended-recovery vision (operator framing 2026-05-23): the same
// envelope can ride Mycelium relays from a peer two states away OR a
// QR code from a peer next door, and the wallet routes it through the
// same modal in either case. The transport choice is the operator's
// (or the peer's) — the routing decision is the envelope's shape.
//
// Most envelope kinds route from shape alone; self-membership is the
// one shape that needs receiver context to disambiguate. A self-
// membership envelope flows: joiner signs → joiner sends to a vouching
// peer → peer cosigns and returns → joiner absorbs → joiner sends the
// cosigned bundle to the org → org accepts. The receiver at each
// arrival is different (peer, joiner, org), and the right action
// differs by receiver. Passing receiverPubkey lets the dispatcher
// route the same envelope to three different surfaces:
//
//   1. joiner-side loop-back (receiver IS subject, >1 signature) →
//      absorb-cosign so the merged cosignature lands on the held copy.
//   2. peer-side vouch arrival (receiver is NEITHER subject NOR the
//      org named in org_id, 1 signature) → vouch-witness so the peer
//      sees a "vouch for this joiner" surface and can attach their
//      signature as an attestation of personal trust. Without this
//      branch the envelope routes to self-membership-receive which
//      warns-and-returns silently on a non-org wallet, leaving the
//      peer with no actionable surface.
//   3. org-side accept (receiver IS the org named in org_id, any
//      signature count) → self-membership-receive, which runs the
//      org's declared join-policy gate before holding the envelope.

export type InboxRouteAction =
  | 'cosign-witness'
  | 'absorb-cosign'
  | 'membership-receive'
  | 'self-membership-receive'
  | 'vouch-witness'
  | 'family-ratify'
  | 'recovery-share-receive'
  | 'recovery-request-respond'
  | 'release-authority-respond'
  | 'release-authority-collect';

export interface EnvelopeRoute {
  action: InboxRouteAction;
  /** Short button label. */
  label: string;
  /** One-line plain-English hint shown next to the action. */
  hint: string;
}

export function routeFor(
  att: Attestation,
  receiverPubkey?: string,
): EnvelopeRoute | null {
  if (isHandshake(att)) {
    if (att.signatures.length <= 1) {
      return {
        action: 'cosign-witness',
        ...PEER_COPY.handshakeIncoming,
      };
    }
    return {
      action: 'absorb-cosign',
      ...PEER_COPY.handshakeApproved,
    };
  }
  if (isMembership(att)) {
    return {
      action: 'membership-receive',
      ...PEER_COPY.membershipIncoming,
    };
  }
  if (isSelfMembership(att)) {
    const receiver = receiverPubkey?.trim().toLowerCase();
    const subject = att.subject.trim().toLowerCase();
    const orgId = leafValue(att, 'org_id').trim().toLowerCase();
    // Loop-back: receiver IS the joiner (envelope subject) and the
    // envelope already carries a vouching peer's cosignature in
    // addition to the joiner's own. Route to absorb-cosign so the
    // joiner's held copy gets the new signature merged in.
    if (receiver && att.signatures.length > 1 && subject === receiver) {
      return {
        action: 'absorb-cosign',
        ...PEER_COPY.vouchCollected,
      };
    }
    // Vouch-witness: a vouching peer received the joiner's 1-sig
    // envelope. Receiver is NEITHER the joiner (subject) NOR the org
    // named in the org_id leaf. Route to a peer-facing signing
    // surface so the peer can attach their signature as an attestation
    // of personal trust. Without this branch the envelope routes to
    // self-membership-receive which short-circuits on a non-org wallet
    // and leaves the peer with no actionable surface.
    if (
      receiver &&
      att.signatures.length === 1 &&
      subject !== receiver &&
      orgId !== receiver
    ) {
      return {
        action: 'vouch-witness',
        ...PEER_COPY.vouchRequest,
      };
    }
    return {
      action: 'self-membership-receive',
      ...PEER_COPY.joinRequestForOrg,
    };
  }
  if (isFamilyUnit(att)) {
    // Family-unit envelopes ride the cosign loop on the substrate
    // familyUnit.ts established: the founder signs and ships to each
    // named member, the member signs and ships back, the founder
    // absorbs the cosignature into their held copy. Routing splits on
    // who the receiver is relative to the envelope:
    //
    //   1. Founder receiving back (receiver IS the envelope subject)
    //      → absorb-cosign so the new cosignature merges into the
    //      held copy. AbsorbCosignModal works on family-unit envelopes
    //      out of the box because it's envelope-kind-agnostic — it
    //      matches by envelopeId and runs mergeSignatures.
    //   2. Named member who has NOT yet signed → family-ratify. The
    //      member-side FamilyRatifyModal opens with the envelope,
    //      shows the family graph for review, and signs + holds +
    //      sends-back-to-founder in one tap.
    //   3. Named member who HAS already signed (e.g. a re-broadcast of
    //      the envelope with more signatures from other members
    //      accumulated since) → absorb-cosign so the member's held
    //      copy ticks up to the latest signature set. The member
    //      doesn't sign again — wallet.sign filters by signer, so
    //      re-signing is a no-op anyway, but routing to absorb keeps
    //      the surface honest about what the action actually does.
    //   4. Not-named third party, OR no receiver context → null. A
    //      family-unit envelope reaching a wallet that isn't named in
    //      the member list has no defined action.
    //
    // Rotated-key subtlety: a member who has rotated signs with their
    // active key, which differs from the genesis pubkey stored in
    // members[].pubkey. routeFor doesn't have wallet.keyHistory, so a
    // rotated member who has already signed routes to family-ratify
    // here (their genesis pubkey isn't in signers[]). That's fine —
    // FamilyRatifyModal's signing step is idempotent (wallet.sign
    // filters duplicates), so a rotated member re-signing produces no
    // new signature on the wire and the send-back is a no-op merge on
    // the founder side. The per-member display-state in
    // FamilyIdentitySections does carry the keyAliases bridge, so
    // founder-side rendering stays honest.
    const receiver = receiverPubkey?.trim().toLowerCase();
    if (!receiver) return null;
    const subject = att.subject.trim().toLowerCase();
    if (receiver === subject) {
      return {
        action: 'absorb-cosign',
        ...PEER_COPY.familyConfirmed,
      };
    }
    const view = readFamilyUnit(att);
    const named = view.members.some(
      (m) => m.pubkey.toLowerCase() === receiver,
    );
    if (!named) return null;
    const signers = new Set(att.signatures.map((s) => s.signer.toLowerCase()));
    if (signers.has(receiver)) {
      return {
        action: 'absorb-cosign',
        ...PEER_COPY.familyCaughtUp,
      };
    }
    return {
      action: 'family-ratify',
      ...PEER_COPY.familyConfirmRequest,
    };
  }
  if (isRecoveryShare(att)) {
    return {
      action: 'recovery-share-receive',
      ...PEER_COPY.recoveryShareHold,
    };
  }
  if (isRecoveryRequest(att)) {
    return {
      action: 'recovery-request-respond',
      ...PEER_COPY.recoveryHelp,
    };
  }
  if (isReleaseAuthorityRequest(att)) {
    return {
      action: 'release-authority-respond',
      ...PEER_COPY.releaseVouchRequest,
    };
  }
  if (isAttestReleaseAuthority(att) || isRevokeReleaseAuthority(att)) {
    // A vouch (attest) or a withdrawal (revoke) a peer signed for one of
    // your gates. Auto-collect it (hold + anchor) so the gate recompute
    // applies it — a revoke drops a previously-counted voucher.
    return {
      action: 'release-authority-collect',
      ...PEER_COPY.releaseVouchUpdate,
    };
  }
  return null;
}
