import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'governance',
  born: '2026-05-25',
  purpose:
    'Tapscript-style authorization-tree primitives for organizations. Phase 8 Phase A and Phase B of the canonical brief (project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-25-tapscript-style-org-authorization-tree-roadmap.md) extracted from src/features/connections/createOrganization.ts at Phase C cut-time so file-size headroom on createOrganization.ts is restored before any UI work touches it. Exports the AuthRule type + the encode/decode/build helpers for the auth sub-branch + findAuthRule + listAuthRules + proveAuthorization (the producer side of cross-envelope authorization proofs) + AuthorizedByPayload + encode/decode/buildAuthorizedByPayload + the OrgAuthorizationResult shape. The verifier itself (verifyOrgAuthorization) stays in connections/createOrganization.ts because it uses the org-self-declaration predicate; everything else is org-agnostic substrate that future cuts (Phase E1 join-rule kind, Phase D charter amendment) extend in place.',
  touches: [
    'src/features/governance/authRule.ts',
  ],
  depends_on: ['wallet-core'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    'Zero new cryptographic code; the entire module is a layer over the shipped disclosureProof / verifyDisclosureProof primitive from tapit-attest/src/core/field-tree.ts, applied to AUTHORIZATION RULES instead of facts. The substrate this module ships is what Phase C UI (multi-rule org creation form), Phase D (charter amendment chain), and Phase E1+ (open-joining via a discriminated-union join-rule kind) all build on top of without further substrate work. Phase B verifier (verifyOrgAuthorization) intentionally stays in connections/createOrganization.ts because it filters knownOrgs via isOrganizationSelfDeclaration which is org-specific; the verifier imports the rule-decoding and payload-decoding primitives from this module. Tests live alongside the consumers (createOrganization.test.ts covers both the producer side via direct imports from here and the verifier side via the org-specific glue).',
};
