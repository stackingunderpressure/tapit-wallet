import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'circle-phrase',
  born: '2026-08-08',
  purpose:
    "The phone-callback phrase pair (docs/2026-08-callback-verification-and-amount-tiers.md's callback ritual, made concrete per the operator's 2026-08-08 request). A Tapit Circle vault owner picks ONE shared normal phrase and ONE shared duress phrase for their circle and sends both, once, NIP-44 encrypted, to every member's Tapit wallet. During a live phone call verifying a spend request, the caller reads back one of the two phrases; the listener types whatever they heard into this wallet before Approve unlocks. A normal-phrase match proceeds to sign; a duress-phrase match silently blocks signing and raises a real duress flag instead (sign-request feature). Nothing here signs anything itself -- this feature only stores the phrase pair (hashed, never plaintext) and answers 'which phrase was that.'",
  touches: [
    'src/features/circle-phrase/circlePhrase.ts',
    'src/features/circle-phrase/circlePhraseChannel.ts',
    'src/features/circle-phrase/useCirclePhraseDeliveries.ts',
    'src/features/circle-phrase/CirclePhraseReceiver.tsx',
    'src/features/circle-phrase/CirclePhraseSection.tsx',
  ],
  depends_on: ['wallet-core', 'transport', 'storage'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    "circlePhrase.ts is the storage + verification core, deliberately independent of transport: storeCirclePhrasePair(vaultDescriptor, vaultName, normalPhrase, duressPhrase) salts a fresh 16-byte random salt and PBKDF2-SHA256 hashes (210,000 rounds, matching the round count DynastyTrust documents for its own passphrase material) BOTH phrases before anything touches IndexedDB -- the plaintext is never written anywhere, only ever held in a local variable long enough to hash it. checkCirclePhrase(vaultDescriptor, entered) hashes the caller's entry with the stored salt and compares against both stored hashes, returning a typed result ('normal' | 'duress' | 'no-match' | 'not-configured' | 'locked') rather than throwing, so the approval screen can branch cleanly. Five wrong guesses locks that vault's phrase check for five minutes (a UX speed bump against a stolen-device brute force; the KDF cost is the real boundary, not the lockout). Storage is one aggregate record keyed 'circlePhrase:v1' in the shared idb wrapper (same IndexedDB the wallet blob itself uses), keyed internally per-vault by sha256(vaultDescriptor) so a listing read is a single get. circlePhraseChannel.ts is the receive-only Nostr half: a new event kind (9577, the next free sibling after the psbt-cosign channel's 9576) carries a NIP-44-encrypted {v, vault_descriptor, vault_name, normal_phrase, duress_phrase} payload, verified (event signature + id) then decrypted then shape-checked before ever reaching a handler -- same discipline as psbtCosignChannel.ts and the liveness channel. useCirclePhraseDeliveries.ts reads wallet/transport straight from WalletContext (WalletProvider.tsx is at its 800-line hard limit, same reasoning usePsbtCosignRequests.ts documents) and, unlike that receive-only hook, stores IMMEDIATELY on receipt rather than holding state for a later approve step -- there is no approval gate for accepting a phrase pair, only for later USING one. CirclePhraseReceiver.tsx is the ~2-line mount in HomeScreen.tsx (matching IncomingPsbtCosignBanner's footprint) that shows a transient 'safety phrase saved' confirmation; the durable status view (CirclePhraseSection.tsx, which vaults have a pair, when received, whether locked out) lives in Settings where there was still headroom under its own file-size limit. The consuming side -- SignApprovalScreen.tsx replacing its plain calloutConfirmed checkbox with a real phrase-entry gate, and raising a duress flag on a duress-phrase match -- lives in the sign-request feature, not here; this feature only answers 'which phrase was that,' it never decides what to do about it.",
};
