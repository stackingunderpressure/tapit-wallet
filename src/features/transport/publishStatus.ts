import type { PublishResult } from './transport.ts';

// Plain-English summary of a publish outcome for inline display in
// any modal that ships an envelope. Keeps the language uniform
// across CosignRequestModal, CosignAsWitnessModal, MembershipModal,
// and HandshakeModal so the operator reads the same words wherever
// they hit Send. Honest about what "Sent" means — relay accepted,
// not "the recipient has read it."

export interface PublishStatusSummary {
  /** Short headline label, suitable for a button-state. */
  label: string;
  /** One-line plain-English detail, color-tone hint included. */
  detail: string;
  /** 'ok' (accepted somewhere) | 'pending' (no acks yet) | 'fail' (all rejected). */
  tone: 'ok' | 'pending' | 'fail';
}

export function summarizePublish(result: PublishResult): PublishStatusSummary {
  if (result.dispatched === 0) {
    return {
      label: 'Not sent',
      detail: 'No relays configured.',
      tone: 'fail',
    };
  }
  if (result.accepted.length > 0) {
    const n = result.accepted.length;
    const total = result.dispatched;
    return {
      label: `Sent — ${n} of ${total} relays accepted`,
      detail:
        n === total
          ? 'Every relay confirmed the message.'
          : `${n} of ${total} relays confirmed the message; the rest were still pending or did not accept.`,
      tone: 'ok',
    };
  }
  if (result.rejected.length > 0 && result.pending.length === 0) {
    const firstReason = result.rejected[0]?.reason;
    return {
      label: 'Rejected by every relay',
      detail: firstReason
        ? `Every relay refused the message. First reason: ${firstReason}.`
        : 'Every relay refused the message.',
      tone: 'fail',
    };
  }
  // No accepts yet but at least one relay never responded — the timeout
  // elapsed before a verdict.
  return {
    label: 'Sent — no acks yet',
    detail:
      'Dispatched to the relays but no confirmation arrived in time. The message may still land; if not, try again.',
    tone: 'pending',
  };
}
