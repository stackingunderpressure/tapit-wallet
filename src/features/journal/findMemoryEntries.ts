import type { Attestation } from 'tapit-attest';
import { momentTimestamp } from './momentDate.ts';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TARGETS = [365, 30, 7] as const;
const WINDOW_MS = MS_PER_DAY / 2; // ±12h around the anniversary

export interface MemoryHit {
  daysAgo: 7 | 30 | 365;
  attestation: Attestation;
}

/**
 * Pure helper that scans the operator's journal entries and
 * surfaces ones from approximately 7, 30, and 365 days before
 * `now`. The match window is ±12h around the exact anniversary
 * so an entry from any hour of the anniversary day surfaces.
 * Multiple hits per target day are allowed — the Memories strip
 * displays them in order.
 *
 * Shipped as part of Cut 4 of the 2026-05-24 Fresh roadmap; the
 * 2026-06-14 Moments cut switched the matching axis from written_at
 * to momentTimestamp, so a backfilled memory (event_date set to an
 * older day) resurfaces on the day it actually HAPPENED rather than
 * the day it was typed in. Entries without an event_date still match
 * on written_at exactly as before.
 */
export function findMemoryEntries(
  entries: readonly Attestation[],
  now: number = Date.now(),
): MemoryHit[] {
  const hits: MemoryHit[] = [];
  for (const att of entries) {
    const t = momentTimestamp(att);
    for (const days of TARGETS) {
      const target = now - days * MS_PER_DAY;
      if (Math.abs(t - target) <= WINDOW_MS) {
        hits.push({ daysAgo: days, attestation: att });
        break;
      }
    }
  }
  // Recent anniversaries first (7 before 30 before 365), then by
  // moment timestamp ascending so multi-hit days surface in
  // chronological order.
  return hits.sort((a, b) => {
    if (a.daysAgo !== b.daysAgo) return a.daysAgo - b.daysAgo;
    return momentTimestamp(a.attestation) - momentTimestamp(b.attestation);
  });
}
