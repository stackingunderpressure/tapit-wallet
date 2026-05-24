import type { Attestation, FieldBranch } from 'tapit-attest';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function writtenAt(att: Attestation): number {
  const claim = att.claim as FieldBranch;
  const c = claim.children.find((x) => x.name === 'written_at');
  if (c && c.node === 'leaf' && typeof c.value === 'string') {
    const t = Date.parse(c.value);
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(att.issuedAt);
}

function dayBucket(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Pure streak math. Counts how many consecutive days, working
 * back from today, the operator has signed at least one journal
 * entry. Today's missing entry does not reset the streak — only
 * a missing yesterday does — so the operator has the full day
 * to add an entry without losing the chain.
 *
 * Returns 0 when there are no entries. Returns 0 when neither
 * today nor yesterday carried an entry.
 *
 * Shipped as part of Cut 9 of the 2026-05-24 Fresh roadmap.
 */
export function computeStreak(
  entries: readonly Attestation[],
  now: number = Date.now(),
): number {
  if (entries.length === 0) return 0;

  const days = new Set<number>();
  for (const e of entries) days.add(dayBucket(writtenAt(e)));

  const today = dayBucket(now);
  const yesterday = today - MS_PER_DAY;

  let cursor: number;
  if (days.has(today)) {
    cursor = today;
  } else if (days.has(yesterday)) {
    cursor = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= MS_PER_DAY;
  }
  return streak;
}
