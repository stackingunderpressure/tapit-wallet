import type { Attestation } from 'tapit-attest';
import { isHandshake } from '../connections/createHandshake.ts';
import { isMembership } from '../connections/createMembership.ts';
import { isRecoveryShare } from '../recovery/createShares.ts';
import { isRecoveryRequest } from '../recovery/createRecoveryRequest.ts';

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

export type InboxRouteAction =
  | 'cosign-witness'
  | 'absorb-cosign'
  | 'membership-receive'
  | 'recovery-share-receive'
  | 'recovery-request-respond';

export interface EnvelopeRoute {
  action: InboxRouteAction;
  /** Short button label. */
  label: string;
  /** One-line plain-English hint shown next to the action. */
  hint: string;
}

export function routeFor(att: Attestation): EnvelopeRoute | null {
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
  return null;
}
