import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'identity-gate',
  born: '2026-05-29',
  purpose:
    'The peer-mediated identity gate substrate — the architectural core named in PLAN.md Founding Vision (2026-05-29) where the community a person chooses is what vouches for their validity. The Tapit identity tree carries identity leaves (Bitcoin spending keys, custody-handoff authorities, recovery shares) committed via the existing Merkle field-tree primitive; release of those leaves requires producing disclosure proofs alongside an M-of-N bundle of fresh peer attestations. If peers revoke or the math fails, the gate stops resolving — the network screams imposter, the key cannot be released, the operator is structurally protected against compromise, coercion, and going-missing. Tier 1 item 11 in PLAN.md. Composes existing substrate (Phase 8 AuthRule trees, Phase 4 multi-leaf disclosure proofs, the vouch-loop pattern from Phase E4 cut 5, OpenTimestamps anchoring) with new envelope kinds shipped here.',
  touches: [
    'src/features/identity-gate/manifest.ts',
    'src/features/identity-gate/releaseAuthorityEnvelopes.ts',
    'src/features/identity-gate/releaseAuthorityEnvelopes.test.ts',
  ],
  depends_on: ['wallet-core', 'connections'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    'Sub-cut B (2026-05-29) ships the three envelope kinds — attest-release-authority, revoke-release-authority, imposter-signal — as credential attestations with a credential_type discriminator (matches the family-unit + recovery-cohort pattern; no new envelope-kind machinery required, rides on the existing credentialAttestation primitive in tapit-attest). Builders validate structurally before encoding (pubkey hex format, non-empty leaf names, horizon-after-now); readers tolerate missing leaves and return empty strings; typeguards isolate each credential_type so a downstream consumer cannot accidentally treat one as another. No UI surfaces yet — that lives in sub-cuts C through F. Sub-cut A (vouching-circle peer-picker) lives in src/features/connections/ because the candidate-finder reads existing peer-relationship substrate; the gate-specific envelopes live here to keep the architectural-core surface grouped. removal_safe + pause_safe true because no downstream code currently consumes these envelopes (sub-cut E will add the verifier wrapper that does).',
};
