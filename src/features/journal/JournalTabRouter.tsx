import { lazy, Suspense } from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { JournalTabs } from './JournalTabs.tsx';

// FreshTodayCarousel is lazy-loaded so the Classic-themed wallet
// never ships the Fresh carousel code. Only operators who have
// flipped Appearance to Fresh (or System with dark-OS) pay the
// bytes. Suspense fallback is null — the Classic surface had no
// loading state at this seam and Fresh first-render is fast enough
// not to need one either.
const FreshTodayCarousel = lazy(() =>
  import('./FreshTodayCarousel.tsx').then((m) => ({
    default: m.FreshTodayCarousel,
  })),
);

interface Props {
  entries: Attestation[];
}

/**
 * Theme-aware journal surface. Renders FreshTodayCarousel when the
 * resolved theme is 'fresh', JournalTabs otherwise. Kept as a thin
 * router rather than a branch inside JournalTabs so the Classic
 * file stays unchanged and operators on Classic do not pay any
 * Fresh-related bytes outside the lazy boundary.
 *
 * Shipped as part of Cut 3 of the 2026-05-24 Fresh roadmap.
 */
export function JournalTabRouter({ entries }: Props) {
  const { resolvedTheme } = useWallet();
  if (resolvedTheme === 'fresh') {
    return (
      <Suspense fallback={null}>
        <FreshTodayCarousel entries={entries} />
      </Suspense>
    );
  }
  return <JournalTabs entries={entries} />;
}
