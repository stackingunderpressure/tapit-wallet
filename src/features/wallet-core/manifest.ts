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
    'src/features/wallet-core/IdentityCeremony.tsx',
    'src/features/wallet-core/HomeScreen.tsx',
    'src/features/wallet-core/IdentityCard.tsx',
    'src/features/wallet-core/AttestationCard.tsx',
    'src/features/wallet-core/useIdleLock.ts',
    'src/features/wallet-core/RotateKeySection.tsx',
    'src/features/wallet-core/OrgIdentitySections.tsx',
    'src/features/wallet-core/FamilyIdentitySections.tsx',
    'src/features/wallet-core/useOpenMemberRosterControls.ts',
    'src/features/wallet-core/useInboxAccepts.ts',
  ],
  depends_on: ['auth', 'storage'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    'Per DESIGN.md §5, the wallet stays unlocked for the session once the passphrase has been entered. Re-prompt on a fresh browser session. v1 ships passphrase only — biometric/WebAuthn unlock is Phase 7+. Phase 8 Phase E4 cut 5 (2026-05-27) extracted the three inbox accept-helpers (acceptRecoveryShare, acceptMembership, acceptSelfMembership) from HomeScreen into the new useInboxAccepts hook so HomeScreen could absorb the peer-side vouch-witness routing state without crossing the 800-line hard limit. The hook is callsite-shape-identical to the inline helpers — same wallet/ownerId/anchorWorker/identity/holdings dependencies pulled from useWallet, same orgDeclaration parameter (computed by the caller via findOwnOrgDeclaration), same return shape consumed by routeInbox. The 3 helpers share a homogeneous shape (verify-via-feature-module, hold-and-anchor, save, refresh, dismiss matching inbox row) so they cluster naturally into one hook, and future inbox-route accept-helpers (e.g. roster-update-accept, charter-amendment-accept in Phase D) can land in useInboxAccepts without re-growing HomeScreen.',
};
