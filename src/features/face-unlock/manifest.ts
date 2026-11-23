import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'face-unlock',
  born: '2026-11-23',
  purpose:
    'Unlock the wallet with Face ID (or the device\'s own biometric) instead of typing the passphrase, and ask for Face ID again before every signature. A platform passkey with the WebAuthn PRF extension releases a secret that seals a copy of the passphrase on this device only; nothing is sent anywhere. Typing the passphrase always still works.',
  touches: [
    'src/features/face-unlock/faceUnlock.ts',
    'src/features/face-unlock/FaceUnlockSection.tsx',
    'src/features/face-unlock/FaceUnlockButton.tsx',
    'src/features/face-unlock/index.ts',
    'src/features/face-unlock/confirm.ts',
    'src/features/wallet-core/UnlockPrompt.tsx',
    'src/features/settings/SettingsScreen.tsx',
    'src/features/sign-request/SignApprovalScreen.tsx',
    'src/features/sign-request/IncomingVaultMembershipBanner.tsx',
    'src/features/connections/FamilyRatifyModal.tsx',
    'src/features/cosigning/CosignAsWitnessModal.tsx',
  ],
  depends_on: ['wallet-core', 'settings', 'storage'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'Needs a browser that returns PRF results (Safari on iOS 18 and later with iCloud Keychain passkeys, recent Chrome). Where PRF is missing the setup says so and saves nothing. When the passphrase has changed (recovery sets a new one), the old seal no longer opens the wallet; the unlock screen removes it and says so. Anyone holding this device\'s storage who can also pass Face ID on the passkey can unlock: that is the trade the person opts into in Settings.',
};
