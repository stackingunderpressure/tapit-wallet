import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'auth',
  born: '2026-05-21',
  purpose:
    'Supabase login. Three options on both the Classic (WalletGuide SignInForm) and Fresh (EmailStep) surfaces: one-tap Google/Apple OAuth (OAuthButtons.tsx, 2026-06-13), email magic-link/code, and email+password (PasswordSignIn.tsx, 2026-06-14 — signInWithPassword + a Create-account signUp; instant session only when "Confirm email" is OFF in the Supabase project, which the operator sets for frictionless testing). No password forms. Establishes an authenticated session that scopes wallet storage access via RLS. The wallet key itself is independent — auth is just the host gate, not the identity. OAuth was added because the built-in email mailer rate-limits repeated sends; signInWithOAuth has no such limit, sends no email, and returns through the same /auth/callback as magic-link (detectSessionInUrl). Provider credentials are configured in the Supabase dashboard (operator step); the buttons are wired into both the Classic WalletGuide SignInForm and the Fresh EmailStep. New OAuth users with no stored blob land in WalletProvider first-login (PassphrasePrompt) → wallet creation, same as any new user.',
  touches: [
    'src/features/auth/LoginPage.tsx',
    'src/features/auth/AuthCallback.tsx',
    'src/features/auth/AuthGate.tsx',
    'src/features/auth/useSession.ts',
    'src/features/auth/WalletGuide.tsx',
    'src/features/auth/WalletGuideBitcoinTab.tsx',
    'src/features/auth/OAuthButtons.tsx',
    'src/features/auth/PasswordSignIn.tsx',
  ],
  depends_on: [],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    'WalletGuide 2026-05-28 (PLAN.md Tier 1 item 5) gained a Bitcoin\'s-role tab framing why this wallet uses Bitcoin as the public OpenTimestamps clock and NOT as the money layer (no UTXOs, no Lightning, no zaps) — the doctrine answer grounded in SATOSHI.md so a serious Bitcoin community evaluator opening this wallet finds the framing in-app rather than having to ask. The tab content lives in WalletGuideBitcoinTab.tsx and loads via React.lazy + Suspense per the bundle-budget rule that names 12KB as the threshold past which non-Account tabs lazy-load. Subsequent tab additions follow the same lazy-load pattern. Supabase session persistence + auto-refresh + detectSessionInUrl are all enabled in shared/lib/supabase.ts so the magic-link redirect lands authenticated. The signed-in Account screen (SignedInAccount in WalletGuide.tsx) carries two actions 2026-05-31: a primary "Sign in with a different email" button and a secondary "Sign out". Both call supabase().auth.signOut(), which fires onAuthStateChange and re-renders Account into SignInForm at the email-entry step — that step IS the different-email login surface (signInWithOtp with shouldCreateUser:true, so any address works). The two buttons share one clearSession(which) helper and differ only in framing + busy label; the switch-account path is surfaced explicitly so a returning operator who wants to bind this device to another email account does not have to reason that "Sign out" is the way to get there. The wallet\'s encrypted snapshot is untouched by either action — it stays in IndexedDB + cloud backup and signing back in with the original email restores it.',
};
