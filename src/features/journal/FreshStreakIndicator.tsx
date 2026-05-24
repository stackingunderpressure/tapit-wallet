import { useMemo } from 'react';
import type { Attestation } from 'tapit-attest';
import { computeStreak } from './computeStreak.ts';

interface Props {
  entries: Attestation[];
}

// Small persistent indicator rendered above the Today carousel
// when prefs.streaksEnabled is on. Pure derivation — counts
// consecutive days back from today with at least one signed entry.
// No new cryptography, no anchoring concern; the math is local
// and the entries themselves carry the signed dates.
//
// Renders nothing when the streak is zero so a brand-new wallet
// is not nagged with a "0 day streak" the moment they open Today.
//
// Shipped as part of Cut 9 of the 2026-05-24 Fresh roadmap.
export function FreshStreakIndicator({ entries }: Props) {
  const streak = useMemo(() => computeStreak(entries), [entries]);
  if (streak <= 0) return null;

  return (
    <div
      role="status"
      aria-label={`${streak} day streak`}
      className="inline-flex items-center gap-2 rounded-full bg-fresh-surface-glass backdrop-blur-xl border border-fresh-anchor-glow/40 px-3 py-1.5 text-xs font-medium text-fresh-text-primary"
    >
      <span aria-hidden className="text-fresh-anchor-glow">🔥</span>
      <span>
        {streak} day{streak === 1 ? '' : 's'}
      </span>
    </div>
  );
}
