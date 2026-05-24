import { lazy, Suspense } from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { JournalTabs } from './JournalTabs.tsx';

// FreshTodayCarousel + FreshMemoriesStrip are lazy-loaded so the
// Classic-themed wallet never ships the Fresh journal code. Only
// operators who have flipped Appearance to Fresh (or System with
// dark-OS) pay the bytes. Suspense fallback is null — the Classic
// surface had no loading state at this seam and Fresh first-render
// is fast enough not to need one either.
const FreshTodayCarousel = lazy(() =>
  import('./FreshTodayCarousel.tsx').then((m) => ({
    default: m.FreshTodayCarousel,
  })),
);
const FreshMemoriesStrip = lazy(() =>
  import('./FreshMemoriesStrip.tsx').then((m) => ({
    default: m.FreshMemoriesStrip,
  })),
);
const FreshStreakIndicator = lazy(() =>
  import('./FreshStreakIndicator.tsx').then((m) => ({
    default: m.FreshStreakIndicator,
  })),
);

interface Props {
  entries: Attestation[];
}

/**
 * Theme-aware journal surface. Renders FreshTodayCarousel (with
 * the Memories anniversary strip on top) when the resolved theme
 * is 'fresh', JournalTabs otherwise. Kept as a thin router rather
 * than a branch inside JournalTabs so the Classic file stays
 * unchanged and operators on Classic do not pay any Fresh-related
 * bytes outside the lazy boundary.
 *
 * Cuts 3 + 4 of the 2026-05-24 Fresh roadmap.
 */
export function JournalTabRouter({ entries }: Props) {
  const { resolvedTheme, prefs } = useWallet();
  if (resolvedTheme === 'fresh') {
    return (
      <Suspense fallback={null}>
        {prefs.streaksEnabled && (
          <div className="mb-3">
            <FreshStreakIndicator entries={entries} />
          </div>
        )}
        {prefs.memoriesEnabled && <FreshMemoriesStrip entries={entries} />}
        <div className="mt-3">
          <FreshTodayCarousel entries={entries} />
        </div>
      </Suspense>
    );
  }
  return <JournalTabs entries={entries} />;
}
