import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'presence',
  born: '2026-05-24',
  purpose:
    'Phase 5d — Tier V device-verified presence (MYCELIUM_NETWORK_SPEC §4). A signed credential-kind attestation binding three facts together: a fresh WebAuthn passkey assertion (the wallet OWNER authenticated in this moment, not just the device-holder), a fresh geolocation reading (the device reported being at this lat/lng with this accuracy), and the wallet clock at signing time. Honest about limits per the spec — geolocation can be spoofed, biometric proves device-owner-authenticated rather than unspoofable presence — so the operator framing stays "to the best of the device ability." Two credential shapes: device-passkey (one-time enrollment storing credentialId + public key) and tier-v-presence (the actual event). The verifier path is informational this cut: the assertion materials are recorded as leaves, but the wallet does not auto-verify the WebAuthn signature; that is the verifier-side responsibility once enrollment keys are exchanged out of band.',
  touches: [
    'src/features/presence/webauthn.ts',
    'src/features/presence/geolocation.ts',
    'src/features/presence/createPresence.ts',
    'src/features/presence/MarkPresenceModal.tsx',
    'src/features/presence/PresenceDetailModal.tsx',
  ],
  depends_on: ['wallet-core', 'anchoring', 'connections', 'transport'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'WebAuthn requires HTTPS in production (works on localhost for dev). The passkey enrollment is per-device — phone and tablet each enroll their own; both are recorded as device-passkey credentials with subject == own identity. holdings.find queries by credentialId at presence time, so multi-device passkey rosters compose cleanly. Phase 5d does NOT verify the WebAuthn assertion signature inside the wallet; that is left to the verifier flow because it requires the enrollment-credential public key the wallet does not always have on hand at sign time. depends_on lists transport because the modal fires syncEnvelope to multi-device-mirror the new events.',
};
