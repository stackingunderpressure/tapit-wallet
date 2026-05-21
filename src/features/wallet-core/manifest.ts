import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'wallet-core',
  born: '2026-05-21',
  purpose:
    "The wallet itself: passphrase prompt on first login, key generation via tapit-attest, encrypted snapshot persisted through storage, unlock prompt on return. Provides the active Wallet object to the rest of the app via context. This is the product — everything else exists to serve this.",
  touches: [
    'src/features/wallet-core/createWallet.ts',
    'src/features/wallet-core/unlockWallet.ts',
    'src/features/wallet-core/saveWallet.ts',
    'src/features/wallet-core/createIdentityAttestation.ts',
    'src/features/wallet-core/WalletProvider.tsx',
    'src/features/wallet-core/WalletContext.ts',
    'src/features/wallet-core/useWallet.ts',
    'src/features/wallet-core/PassphrasePrompt.tsx',
    'src/features/wallet-core/UnlockPrompt.tsx',
    'src/features/wallet-core/DisplayNamePrompt.tsx',
    'src/features/wallet-core/HomeScreen.tsx',
    'src/features/wallet-core/IdentityCard.tsx',
    'src/features/wallet-core/AttestationCard.tsx',
  ],
  depends_on: ['auth', 'storage'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    'Per DESIGN.md §5, the wallet stays unlocked for the session once the passphrase has been entered. Re-prompt on a fresh browser session. v1 ships passphrase only — biometric/WebAuthn unlock is Phase 7+.',
};
