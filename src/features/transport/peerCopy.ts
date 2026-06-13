// Warm, plain-language copy for every Mycelium peer exchange that surfaces in
// the inbox. Centralized here (2026-06-13) so the friendly voice is consistent
// and so a jargon-guard test can keep cryptography words off the screen — the
// same trick secretTemplates uses for the secrets surface.
//
// VOICE: warm & plain (operator's pick). No "sign / co-sign / signature /
// absorb / anchor / envelope / attestation / Mycelium / ratification" — the
// person sees connecting, approving, vouching, keeping-safe, in human words.
// The sender's name is rendered separately by the inbox, so each hint stays
// generic (no name interpolation here).
//
// Keyed by the concrete situation rather than by route action, because one
// action (e.g. "add it to your copy") shows up in several situations and each
// deserves its own friendly line.

export interface PeerCopy {
  /** Short button label — a verb the person taps. */
  label: string;
  /** One warm line shown next to it. */
  hint: string;
}

export const PEER_COPY = {
  // Someone you met wants to connect; it's waiting for your yes.
  handshakeIncoming: {
    label: 'Connect',
    hint: 'Wants to connect with you — shake on it?',
  },
  // They already said yes; one tap finishes it on your side.
  handshakeApproved: {
    label: 'Finish',
    hint: 'They said yes! Tap to finish connecting.',
  },
  // A group added you.
  membershipIncoming: {
    label: 'Keep it',
    hint: 'A group added you — tap to keep it.',
  },
  // A friend stood up for your request to join a group; add theirs in.
  vouchCollected: {
    label: 'Add it',
    hint: 'A friend stood up for you — tap to add it to your request.',
  },
  // A friend is asking you to vouch for them joining a group.
  vouchRequest: {
    label: 'Vouch',
    hint: 'A friend asked you to vouch for them joining a group.',
  },
  // Someone wants into a group you run.
  joinRequestForOrg: {
    label: 'Let them in',
    hint: 'Someone wants to join your group — tap to review.',
  },
  // A family member said yes to the family you started.
  familyConfirmed: {
    label: 'Finish',
    hint: 'A family member said yes — tap to add it to your copy.',
  },
  // New yeses on a family you're already part of.
  familyCaughtUp: {
    label: 'Catch up',
    hint: "New family approvals — tap to catch up your copy.",
  },
  // Someone added you to their family and wants your okay.
  familyConfirmRequest: {
    label: 'Confirm',
    hint: 'Someone added you to their family — tap to confirm.',
  },
  // A friend trusts you to safekeep one piece of their backup.
  recoveryShareHold: {
    label: 'Keep it safe',
    hint: 'A friend asked you to safekeep a piece of their backup.',
  },
  // A friend wants you to hold one piece of a secret of theirs (B-1).
  secretPieceIncoming: {
    label: 'Keep it',
    hint: 'Wants you to hold a piece of their secret — keep it safe, or let it go.',
  },
  // A friend is setting up a new phone and needs your piece back.
  recoveryHelp: {
    label: 'Help out',
    hint: 'A friend is setting up a new phone and needs your piece to get back in.',
  },
  // A friend asks you to vouch that they really control something of theirs.
  releaseVouchRequest: {
    label: 'Vouch',
    hint: "A friend asked you to vouch that it's really them.",
  },
  // A friend changed who vouches for them; catch your copy up.
  releaseVouchUpdate: {
    label: 'Catch up',
    hint: 'A friend changed who vouches for them — tap to catch up.',
  },
} satisfies Record<string, PeerCopy>;

export type PeerCopyKey = keyof typeof PEER_COPY;
