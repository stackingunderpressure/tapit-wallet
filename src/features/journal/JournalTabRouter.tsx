import { lazy, Suspense } from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';

// FreshTodayCarousel + FreshMemoriesStrip are lazy-loaded so the
// Fresh journal code rides its own chunk. Suspense fallback is null —
// first-render is fast enough not to need one.
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
 * The journal surface: FreshTodayCarousel with the optional Memories
 * anniversary strip and Streak indicator on top. Once a theme router
 * (Fresh vs the retired Classic JournalTabs); now Fresh-only, kept as
 * the lazy boundary so the Fresh journal code rides its own chunk.
 */
export function JournalTabRouter({ entries }: Props) {
  const { prefs } = useWallet();
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
