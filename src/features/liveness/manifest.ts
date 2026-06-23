import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'liveness',
  born: '2026-06-22',
  purpose:
    "The green / no-report / red surface — a quiet way for a person to tell the people they trust that they are OK, and to see at a glance whether those people are. Slice 1: a local store + a plain-English panel over the tapit-attest liveness primitive. The wallet mints a self-signed proof-of-life heartbeat (green while fresh, no-report once stale) and can raise a duress red flag on itself or a chosen circle member; red dominates everything and only counts from chosen people. The private key never leaves the Wallet — both actions sign through wallet.signDigest via the proofOfLifeDigestFor / duressFlagDigestFor helpers, the same no-key-leak seam the sign-request sign-in path uses.",
  touches: [
    'src/features/liveness/liveness.ts',
    'src/features/liveness/liveness.test.ts',
    'src/features/liveness/LivenessPanel.tsx',
    'src/features/liveness/manifest.ts',
    'tapit-attest/src/core/liveness.ts',
  ],
  depends_on: ['wallet-core'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    "Slice 1 of the 'green ladder'. The liveness signals (ProofOfLife, DuressFlag) are NOT Attestation envelopes, so they do not ride the encrypted inbox (sendEnvelopeTo / subscribeInbox), whose receive half runs parseEnvelope -> assertWellFormed and would reject them. TRANSPORT PATH B (deferred): network propagation is stubbed behind the sendSignal / onSignal seam in liveness.ts. The clean ride exists one layer below the inbox — buildEvent + wallet.nip44EncryptTo + transport.publish/subscribe (the same primitives the encrypted inbox is built from) on a SEPARATE custom liveness event kind, a sibling to TAPIT_ENVELOPE_KIND (9573), exactly as NIP-17 chat rides its own kind 1059 rather than the envelope kind. The next cut adds that kind, encrypts each signal to the recipient, and on receive decrypts + verifyProofOfLife / verifyDuressFlag (never parseEnvelope) before applyIncomingSignal folds it into the store. That keeps the one-envelope standard untouched: liveness gets its own wire kind and never pretends to be an Attestation. Clearing a raised red flag is deliberately omitted from slice 1 — it is a higher-layer quorum concern (the primitive holds reds until a human clears them; an alarm that times itself out is worse than one that persists). pause_safe + removal_safe: deleting the touches leaves a working app — nothing else imports this feature yet.",
};
