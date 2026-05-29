import type { Anchor, Attestation } from 'tapit-attest';
import type { AnchorRow } from './anchorQueue.ts';

// Derived verification status for journal/attestation surfaces.
// Centralizes the "anchor-from-attestation-or-row" precedence the
// JournalCard / JournalDetail / FreshTodayCard surfaces all needed
// independently, and adds the third state PLAN.md Tier 1 item 4
// asked for — `stalled` surfaces when the OpenTimestamps calendar
// has been unreachable across enough failed attempts that the
// operator should SEE the case rather than have it lurk silently
// behind a perpetual "Time-verifying…" badge.
//
// Threshold rationale: the anchor worker backs off failed rows
// 5min × 2^(attempts-1) capped at 1hr per anchorWorker.ts. At
// 5 attempts the backoff has saturated at the 1hr ceiling, so an
// outage that's lasted long enough to cross five attempts is
// structurally past "transient relay slowness" — the wallet is
// honest about that without alarming. Below the threshold the
// state stays `verifying` because retries are still cheap and
// the calendar may catch up.

export const STALLED_AFTER_ATTEMPTS = 5;

export type VerificationKind = 'verified' | 'verifying' | 'stalled';

export interface VerificationStatus {
  kind: VerificationKind;
  /** The confirmed anchor when kind === 'verified'; null otherwise. */
  anchor: Anchor | null;
  /** Failed-attempt count for the live queue row, surfaced when stalled. */
  attempts: number;
}

export function deriveVerificationStatus(
  attestation: Attestation,
  row: AnchorRow | undefined,
): VerificationStatus {
  // Prefer the confirmed anchor persisted on the attestation itself —
  // it rides the encrypted wallet backup and stays sticky across
  // reloads, re-unlocks, and device restores. The live queue row is
  // only a fallback for entries not yet confirmed.
  if (attestation.anchor?.status === 'confirmed') {
    return { kind: 'verified', anchor: attestation.anchor, attempts: 0 };
  }
  if (row?.state === 'confirmed') {
    return { kind: 'verified', anchor: row.anchor, attempts: 0 };
  }
  if (
    row?.state === 'failed' &&
    row.attempts >= STALLED_AFTER_ATTEMPTS
  ) {
    return { kind: 'stalled', anchor: null, attempts: row.attempts };
  }
  return { kind: 'verifying', anchor: null, attempts: row?.attempts ?? 0 };
}
