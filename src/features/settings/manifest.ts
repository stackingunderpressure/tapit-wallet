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
    'src/features/settings/manifest.ts',
  ],
  depends_on: ['auth', 'wallet-core', 'storage', 'theme', 'governance', 'connections'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "Per DESIGN.md §6 the wallet defaults to cloud sync ON (most users are forgetful). Settings is where they can flip it off for a sovereign setup. Governance direction: Phase 8 Phase C cut 2 added OrgRulesEditor as a React.lazy section that lets the operator declare multi-rule Tapscript-style auth trees at org-self-declaration time — each rule names an action (routine_issuance, expulsion, charter_amendment, etc.) plus a threshold and an eligible-signers list, with validation running at submit time per buildAuthSubtree's contract in src/features/governance/authRule.ts; AppearanceSection separately holds the Fresh-theme radio + the Fresh-extras toggles (Memories strip, Streak indicator) that gate the Today-tab Fresh embellishments.",
};
