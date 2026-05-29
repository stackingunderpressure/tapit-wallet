import type { Wallet } from 'tapit-attest';

// Shared types + small helpers for the RecoveryInitiator flow.
// Extracted 2026-05-28 to give RecoveryInitiatorModal headroom
// under the 800-line hard limit so the Tier 1 cross-device
// recovery field-test can land its fixes here rather than
// breach the modal's size budget.

export interface CohortEntry {
  pubkey: string;
  name: string;
}

export interface PeerStatus {
  pubkey: string;
  name: string;
  state:
    | 'queued'
    | 'sending'
    | 'sent'
    | 'send-failed'
    | 'received'
    | 'response-error';
  detail?: string;
}

export type RecoveryPhase =
  | { kind: 'configuring' }
  | { kind: 'sending' }
  | { kind: 'awaiting'; received: number; needed: number }
  | { kind: 'combining' }
  | { kind: 'restoring' }
  | { kind: 'naming'; restored: Wallet }
  | { kind: 'saving' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

export const HEX_64 = /^[0-9a-f]{64}$/i;

export function phaseHeadline(
  phase: RecoveryPhase,
  peerCount: number,
): string {
  switch (phase.kind) {
    case 'configuring':
      return 'Recover your wallet';
    case 'sending':
      return 'Asking your cohort…';
    case 'awaiting':
      return `Waiting for ${phase.needed} of ${peerCount}…`;
    case 'combining':
      return 'Combining the shares…';
    case 'restoring':
      return 'Putting your wallet back together…';
    case 'naming':
      return 'Choose a new passphrase';
    case 'saving':
      return 'Saving your wallet…';
    case 'done':
      return 'Welcome back.';
    case 'error':
      return 'Recovery stopped';
  }
}

export function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}
