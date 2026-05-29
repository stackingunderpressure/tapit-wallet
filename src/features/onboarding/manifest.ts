import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'onboarding',
  born: '2026-05-24',
  purpose:
    'Fresh compose-before-login onboarding. The 90-second state machine the brief promised: splash, compose, choose-a-name, choose-a-passphrase, recovery primer, email, code. Volatile bundle held in module-level memory (never localStorage, never sessionStorage, never IndexedDB) across the sign-in handoff. WalletProvider consumes the bundle on first-login and runs the post-sign-in identity-plus-first-entry ceremony so the wallet ships with both already in place by the time the operator lands on the home screen. Renders only under theme=fresh; Classic onboarding stays unchanged.',
  touches: [
    'src/features/onboarding/manifest.ts',
    'src/features/onboarding/FreshOnboarding.tsx',
    'src/features/onboarding/freshOnboardingSteps.tsx',
    'src/features/onboarding/pendingOnboarding.ts',
    'src/features/onboarding/applyOnboardingBundle.ts',
  ],
  depends_on: ['theme', 'auth', 'wallet-core', 'journal', 'storage', 'anchoring'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'Import-existing-nsec branch added 2026-05-29 (PLAN.md Tier 1 item 9): FreshOnboarding\'s state machine gained import-disclose + import-enter steps, the OnboardingBundle gained an optional importedPrivateKeyHex field, and WalletProvider\'s onboarding-setup effect branches on the field to call createWalletFromImport instead of createWallet. Operators tap an "Already have a Nostr identity? Import it" link from the compose step to enter the import branch; the import branch shows the honest keys-discipline-tradeoff disclosure (same content as the Classic ImportNostrIdentityPrompt), captures the nsec, derives the pubkey for confirmation, then routes back to the name step where the existing fresh state machine resumes (passphrase → passphrase-warn → recovery → email → code). Step components (SplashStep / ComposeStep / NameStep / PassphraseStep / RecoveryStep + RecoveryCard helper / EmailStep / CodeStep + ImportDiscloseStep + ImportEnterStep) extracted into freshOnboardingSteps.tsx 2026-05-28 (PLAN.md Tier 1 item 3) so FreshOnboarding.tsx stays under the 800-line hard limit. The step components are presentation-only and take their state + callbacks via props; the orchestrator owns the state machine, the Supabase OTP auth handshake, and the volatile-bundle handoff to WalletProvider. FreshOnboardingShell stays in the orchestrator because it is the page-layout wrapper. Pause-safe because removing the toggle from LoginPage routing reverts the Fresh signed-out surface to the FreshLoginShell email-only landing the prior cut shipped. Not removal-safe because WalletProvider has a bundle-consumption branch baked in — deleting the onboarding feature requires also removing that branch and the registered manifest. Bundle is in-memory only; tab close or page reload restarts the flow with no persisted trail. The captured passphrase is held in component state through the recovery primer + email + code steps, then moved to pendingOnboarding for one tick, then read into WalletProvider passphraseRef and erased from the holder — the same live-in-memory lifecycle the unlock flow uses today.',
};
