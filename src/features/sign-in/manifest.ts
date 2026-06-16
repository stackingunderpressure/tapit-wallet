import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'sign-in',
  born: '2026-06-16',
  purpose:
    "The wallet's local history of key-control sign-ins. Each entry is a TA-1 sign-in attestation (a fresh nonce-bearing challenge the holder Schnorr-signed), kept so a person can show when they signed in and -- once anchored via OpenTimestamps -- prove the key was live at that moment. A self-issued record is a liveness proof; a relying party's challenge (Dynasty over Nostr, later) is real authentication checked by that party, never here.",
  touches: [
    'src/features/sign-in/signInLedger.ts',
    'src/features/sign-in/signInLedger.test.ts',
  ],
  depends_on: [],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    'Domain core only this cut (TW-6): pure, storage-agnostic ledger functions over the tapit-attest TA-1 primitive. The encrypted-store persistence and the visible "when you signed in" history screen are the documented follow-up. depends_on is empty because the shipped code requires only the TA-1 primitive in tapit-attest; the future remote-login records will arrive over the Nostr seam (TW-2, transport) but that wiring is not in this cut. verifySignInRecord is tamper-detection on the stored ledger, NOT a remote auth decision -- that distinction is load-bearing and documented in signInLedger.ts.',
};
