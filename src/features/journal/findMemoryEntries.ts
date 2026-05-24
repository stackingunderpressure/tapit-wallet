import type { Attestation, FieldBranch } from 'tapit-attest';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TARGETS = [365, 30, 7] as const;
const WINDOW_MS = MS_PER_DAY / 2; // ±12h around the anniversary

export interface MemoryHit {
  daysAgo: 7 | 30 | 365;
  attestation: Attestation;
}

function writtenAt(att: Attestation): number {
  const claim = att.claim as FieldBranch;
  const c = claim.children.find((x) => x.name === 'written_at');
  if (c && c.node === 'leaf' && typeof c.value === 'string') {
    const t = Date.parse(c.value);
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(att.issuedAt);
}

/**
 * Pure helper that scans the operator's journal entries and
 * surfaces ones written approximately 7, 30, and 365 days before
 * `now`. The match window is ±12h around the exact anniversary
 * so an entry written at any hour of the anniversary day
 * surfaces. Multiple hits per target day are allowed — the
 * Memories strip displays them in order.
 *
 * Shipped as part of Cut 4 of the 2026-05-24 Fresh roadmap. The
 * math is already in place because every journal entry carries
 * its written_at; this is just the filter.
 */
export function findMemoryEntries(
  entries: readonly Attestation[],
  now: number = Date.now(),
): MemoryHit[] {
  const hits: MemoryHit[] = [];
  for (const att of entries) {
    const t = writtenAt(att);
    for (const days of TARGETS) {
      const target = now - days * MS_PER_DAY;
      if (Math.abs(t - target) <= WINDOW_MS) {
        hits.push({ daysAgo: days, attestation: att });
        break;
      }
    }
  }
  // Recent anniversaries first (7 before 30 before 365), then by
  // written_at ascending so multi-hit days surface in chronological
  // order.
  return hits.sort((a, b) => {
    if (a.daysAgo !== b.daysAgo) return a.daysAgo - b.daysAgo;
    return writtenAt(a.attestation) - writtenAt(b.attestation);
  });
}
