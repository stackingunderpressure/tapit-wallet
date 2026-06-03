import type { Attestation } from 'tapit-attest';
import { isHandshake, leafValue } from '../connections/createHandshake.ts';
import { isMembership, isSelfMembership } from '../connections/createMembership.ts';
import { isFamilyUnit, readFamilyUnit } from '../connections/familyUnit.ts';
import { isRecoveryShare } from '../recovery/createShares.ts';
import { isRecoveryRequest } from '../recovery/createRecoveryRequest.ts';
import { isReleaseAuthorityRequest } from '../identity-gate/releaseAuthorityEnvelopes.ts';

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
  | 'release-authority-respond';

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
        label: 'Review & sign',
        hint: 'A handshake waiting for your signature.',
      };
    }
    return {
      action: 'absorb-cosign',
      label: 'Absorb signature',
      hint: 'A counter-signed handshake — merge it into your copy.',
    };
  }
  if (isMembership(att)) {
    return {
      action: 'membership-receive',
      label: 'Accept membership',
      hint: 'A membership credential issued to you.',
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
        label: 'Absorb vouch',
        hint: 'A vouch you collected — merge it into your join envelope.',
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
        label: 'Vouch',
        hint: 'A peer is asking you to vouch for their join request.',
      };
    }
    return {
      action: 'self-membership-receive',
      label: 'Accept join request',
      hint: 'A self-membership claim addressed to your organization.',
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
        label: 'Absorb signature',
        hint: 'A family ratification — merge it into your copy.',
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
        label: 'Absorb signatures',
        hint: 'A family you already ratified — merge any new signatures into your copy.',
      };
    }
    return {
      action: 'family-ratify',
      label: 'Ratify family',
      hint: 'Someone named you in their family. Review and sign to confirm.',
    };
  }
  if (isRecoveryShare(att)) {
    return {
      action: 'recovery-share-receive',
      label: 'Hold share',
      hint: 'A recovery share — a peer is asking you to hold one piece of their backup.',
    };
  }
  if (isRecoveryRequest(att)) {
    return {
      action: 'recovery-request-respond',
      label: 'Help recover',
      hint: 'A peer is recovering their wallet on a new device and asking for your share.',
    };
  }
  if (isReleaseAuthorityRequest(att)) {
    return {
      action: 'release-authority-respond',
      label: 'Vouch',
      hint: 'A peer is asking you to vouch that they control something important.',
    };
  }
  return null;
}
