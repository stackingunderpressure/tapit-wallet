import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'settings',
  born: '2026-05-21',
  purpose:
    'Settings surface: cloud-sync toggle (default ON), local encrypted-backup download, sign-out. Backup posture sits here because v1 keeps the home screen card-focused; settings is where the wallet exposes the rest of its policy knobs.',
  touches: [
    'src/features/settings/SettingsScreen.tsx',
    'src/features/settings/localExport.ts',
    'src/features/settings/KnownLimitationsSection.tsx',
    'src/features/settings/AppearanceSection.tsx',
    'src/features/settings/OrgRulesEditor.tsx',
    'src/features/settings/JoinPolicyPicker.tsx',
    'src/features/settings/OrgDeclarationSection.tsx',
    'src/features/settings/PublicKeySection.tsx',
    'src/features/settings/manifest.ts',
  ],
  depends_on: ['auth', 'wallet-core', 'storage', 'theme', 'governance', 'connections'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "Per DESIGN.md §6 the wallet defaults to cloud sync ON (most users are forgetful). Settings is where they can flip it off for a sovereign setup. Governance direction: Phase 8 Phase C cut 2 added OrgRulesEditor as a React.lazy section that lets the operator declare multi-rule Tapscript-style auth trees at org-self-declaration time — each rule names an action (routine_issuance, expulsion, charter_amendment, etc.) plus a threshold and an eligible-signers list, with validation running at submit time per buildAuthSubtree's contract in src/features/governance/authRule.ts; AppearanceSection separately holds the Fresh-theme radio + the Fresh-extras toggles (Memories strip, Streak indicator) that gate the Today-tab Fresh embellishments. Phase 8 Phase E4 cut 3 adds the JoinPolicyPicker sibling to OrgRulesEditor — same React.lazy section pattern, owns the join-policy half of the org's auth tree (kind-tagged JoinPolicy payload with six sub-forms for open / allow_list / deny_list / requires_handshake / requires_credential / requires_vouch). Tracked as an independent slot in SettingsScreen state because the picker's UI is structurally different from the org-action rule editor (the AuthRule discriminated union splits two ways at the type level — AuthRuleForOrgAction has threshold + eligible, AuthRuleForJoin has the policy payload — and the two halves are folded into one AuthRule[] at submit time so buildAuthSubtree gets a single canonical input). The org-declaration form section (already substantial as of Phase C cut 2) plus the new JoinPolicyPicker integration extracted to OrgDeclarationSection.tsx so SettingsScreen stays under the 800-line hard limit; the section encapsulates the form state (orgName, orgRules, joinPolicy, busy, error) so SettingsScreen only passes the wallet shell + post-save callbacks + the existing-org-declaration probe. PublicKeySection (2026-08-08, Cut C1 manual half of DynastyTrust's docs/integration-phase2-vault-key-bridge.md) is the wallet's first screen that shows the operator their own public key as text + copy + QR (reusing features/qr/QrShow.tsx) — no passphrase gate, since it's a public key, not a secret. It's the manual fallback every later deep-link automation in the vault-key bridge plan is required to keep working alongside: an app that wants this wallet as a Bitcoin vault signer can be handed the key by copy/paste or QR scan today, with zero new protocol work, while the sign-request deep-link version (a new intent alongside attest/cosign-existing/sign-in/psbt-cosign) is a later, additive cut on top of this, not a prerequisite for it.",
};
