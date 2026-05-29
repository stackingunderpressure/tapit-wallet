import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'auth',
  born: '2026-05-21',
  purpose:
    'Supabase email magic-link login. No password forms. Establishes an authenticated session that scopes wallet storage access via RLS. The wallet key itself is independent — auth is just the host gate, not the identity.',
  touches: [
    'src/features/auth/LoginPage.tsx',
    'src/features/auth/AuthCallback.tsx',
    'src/features/auth/AuthGate.tsx',
    'src/features/auth/useSession.ts',
    'src/features/auth/WalletGuide.tsx',
    'src/features/auth/WalletGuideBitcoinTab.tsx',
  ],
  depends_on: [],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    'WalletGuide 2026-05-28 (PLAN.md Tier 1 item 5) gained a Bitcoin\'s-role tab framing why this wallet uses Bitcoin as the public OpenTimestamps clock and NOT as the money layer (no UTXOs, no Lightning, no zaps) — the doctrine answer grounded in SATOSHI.md so a serious Bitcoin community evaluator opening this wallet finds the framing in-app rather than having to ask. The tab content lives in WalletGuideBitcoinTab.tsx and loads via React.lazy + Suspense per the bundle-budget rule that names 12KB as the threshold past which non-Account tabs lazy-load. Subsequent tab additions follow the same lazy-load pattern. Supabase session persistence + auto-refresh + detectSessionInUrl are all enabled in shared/lib/supabase.ts so the magic-link redirect lands authenticated.',
};
