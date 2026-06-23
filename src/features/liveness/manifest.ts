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
    'src/features/transport/livenessChannel.ts',
    'src/features/transport/livenessChannel.test.ts',
    'tapit-attest/src/core/liveness.ts',
  ],
  depends_on: ['wallet-core', 'transport'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    "Slice 1 of the 'green ladder'. The liveness signals (ProofOfLife, DuressFlag) are NOT Attestation envelopes, so they do not ride the encrypted inbox (sendEnvelopeTo / subscribeInbox), whose receive half runs parseEnvelope -> assertWellFormed and would reject them. TRANSPORT PATH B (DONE): network propagation now rides the dedicated encrypted liveness channel src/features/transport/livenessChannel.ts on its OWN wire kind TAPIT_LIVENESS_KIND = 9575 (a sibling to TAPIT_ENVELOPE_KIND 9573, distinct from the retired chat kind 9574 and NIP-17 kind 1059), exactly as NIP-17 chat rides its own kind rather than the envelope kind. sendLivenessSignal serializes the LivenessSignal wrapper, NIP-44-encrypts it to the recipient via wallet.nip44EncryptTo, buildEvents it on the liveness kind with a p tag, and publishes; relays see only ciphertext. subscribeLiveness verifies the outer event, decrypts via nip44DecryptFromAnyKey, JSON-parses, then re-verifies the INNER signal with verifyProofOfLife / verifyDuressFlag (NEVER parseEnvelope) so a forged heartbeat or red flag from a relay or stranger never reaches the handler, dedups by event id, and hands the signal to applyIncomingSignal. The seam is wired by two thin optional adapters in liveness.ts — createTransportSendSignal (pass as createLivenessStore's sendSignal) and subscribeLivenessStore (folds inner-verified arrivals into the store). The store itself stays transport-agnostic and no-op-safe: createLivenessStore with no sendSignal still works fully for the local-only surface, so depends_on adds transport without making the local store require it. That keeps the one-envelope standard untouched: liveness gets its own wire kind and never pretends to be an Attestation. Clearing a raised red flag is deliberately omitted from slice 1 — it is a higher-layer quorum concern (the primitive holds reds until a human clears them; an alarm that times itself out is worse than one that persists). pause_safe + removal_safe: deleting the touches leaves a working app — nothing else imports this feature yet.",
};
