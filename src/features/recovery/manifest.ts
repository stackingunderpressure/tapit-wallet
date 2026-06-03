import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'recovery',
  born: '2026-05-24',
  purpose:
    'Phase 5e — hyphal lattice + Shamir cascade recovery (MYCELIUM_NETWORK_SPEC §12). Cut 5e-iii-a ships this: the operator declares which peers from their handshake web they would trust to help recover this wallet on a new device, along with the (M, N) threshold the recovery ceremony will require. The cohort is recorded as a self-signed credential, anchored to Bitcoin alongside everything else. Share distribution + backup-format v2 lands in 5e-iii-b. The recovery ceremony itself (initiator + responder + recovery-succession event) lands in 5e-v / -vi / -vii. The cryptographic floor (GF(256) Shamir split + combine) shipped in tapit-attest at 5e-ii. The load-bearing constraint stays loud: the Shamir split is over the backup ENCRYPTION KEY, never the signing keypair.',
  touches: [
    'src/features/recovery/createCohort.ts',
    'src/features/recovery/createCohort.test.ts',
    'src/features/recovery/CohortEditorModal.tsx',
    'src/features/recovery/lattice.ts',
    'src/features/recovery/LatticePanel.tsx',
    'src/features/recovery/createShares.ts',
    'src/features/recovery/createShares.test.ts',
    'src/features/recovery/DistributeSharesModal.tsx',
    'src/features/recovery/createRecoveryRequest.ts',
    'src/features/recovery/createRecoveryRequest.test.ts',
    'src/features/recovery/RecoveryResponderModal.tsx',
    'src/features/recovery/RecoveryInitiatorModal.tsx',
    'src/features/recovery/RecoveryConfigStep.tsx',
    'src/features/recovery/RecoveryAwaitingShares.tsx',
    'src/features/recovery/RecoveryNamingStep.tsx',
    'src/features/recovery/recoveryInitiatorTypes.ts',
    'src/features/recovery/RecoveryKeyImportModal.tsx',
    'src/features/recovery/RestoreFromFileModal.tsx',
    'src/features/recovery/createRecoverySuccession.ts',
    'src/features/recovery/createRecoverySuccession.test.ts',
  ],
  depends_on: ['wallet-core', 'anchoring', 'connections', 'qr'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    'RecoveryInitiatorModal extraction 2026-05-28 (PLAN.md Tier 1 item 2): the three phase-render blocks (configuring → RecoveryConfigStep, sending/awaiting/combining/restoring → RecoveryAwaitingShares, naming → RecoveryNamingStep) plus shared types + helpers (recoveryInitiatorTypes) moved into sibling files so the orchestrator stays under the 800-line hard limit. Sub-components own presentation only; the absorb-share / publish-result / combine-and-restore / save-under-new-passphrase logic stays in the parent. Done pre-emptively before the Tier 1 cross-device recovery field-test so any fixes that test surfaces land in the right sub-component rather than re-growing the orchestrator. The cohort credential carries the member list as canonical JSON of {pubkey, name} pairs sorted + deduplicated so the digest is stable regardless of pick order. Latest-by-issuedAt wins for the in-effect cohort; older cohorts stay held + anchored for governance audit. Cohort members are sourced from existing handshakes today; organizations from memberships are a follow-on (would extend candidate pool from isMembership holdings). The publishCohort builder validates threshold + totalShares + member count + Shamir GF(256) ceiling (255 max) before signing.',
};
