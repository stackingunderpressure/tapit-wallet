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
  ],
  depends_on: [],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    'Supabase session persistence + auto-refresh + detectSessionInUrl are all enabled in shared/lib/supabase.ts so the magic-link redirect lands authenticated.',
};
