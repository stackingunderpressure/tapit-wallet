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
    'src/features/identity-gate/identityLeafCredential.ts',
    'src/features/identity-gate/identityLeafCredential.test.ts',
    'src/features/identity-gate/verifyReleaseAuthorityBundle.ts',
    'src/features/identity-gate/verifyReleaseAuthorityBundle.test.ts',
  ],
  depends_on: ['wallet-core', 'connections'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    'Sub-cut B (2026-05-29) ships the three envelope kinds — attest-release-authority, revoke-release-authority, imposter-signal — as credential attestations with a credential_type discriminator (matches the family-unit + recovery-cohort pattern; no new envelope-kind machinery required, rides on the existing credentialAttestation primitive in tapit-attest). Builders validate structurally before encoding (pubkey hex format, non-empty leaf names, horizon-after-now); readers tolerate missing leaves and return empty strings; typeguards isolate each credential_type so a downstream consumer cannot accidentally treat one as another. Sub-cut C.1 (2026-05-29) ships the identity-leaf credential primitive — a generic typed shape for structured claims the operator commits to as PART OF THEIR IDENTITY (vouching circle, Bitcoin spending key commitments, custody-handoff authorities, Lightning node pubkeys, etc.). Each leaf is a self-signed credential by the operator with a closed-vocabulary leaf_type discriminator. The SIGNED CREDENTIAL\'S envelopeId IS the leaf\'s cryptographic commitment — sub-cut C.3 will extend the attest-release-authority envelope to bind to this envelopeId so leaf rotation invalidates prior attestations (closes gap 2). Latest-by-issuedAt wins per leaf_type; older leaves stay held + anchored as audit chain. First concrete leaf type shipped is vouching_circle (with canonical-sort pubkey payload so equal-content leaves produce equal envelopeIds — making the commitment deterministic). Helpers: buildVouchingCircleLeafDraft, readVouchingCircleLeaf, isVouchingCircleLeaf, findLatestVouchingCircleLeaf (latest-by-issuedAt matching the findLatestCohort pattern). No UI integration yet — sub-cut C.2 will promote the VouchingCircleSection from prefs-only to sign-on-save. No UI surfaces yet for the release-authority envelopes either — those live in sub-cuts D through F. Sub-cut A (vouching-circle peer-picker) lives in src/features/connections/ because the candidate-finder reads existing peer-relationship substrate; the gate-specific envelopes + the identity-leaf credential primitive live here to keep the architectural-core surface grouped. removal_safe + pause_safe true because no downstream code currently consumes these envelopes (sub-cut E will add the verifier wrapper that does).',
};
