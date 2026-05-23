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
  ],
  depends_on: ['wallet-core', 'anchoring', 'connections', 'qr'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    'The cohort credential carries the member list as canonical JSON of {pubkey, name} pairs sorted + deduplicated so the digest is stable regardless of pick order. Latest-by-issuedAt wins for the in-effect cohort; older cohorts stay held + anchored for governance audit. Cohort members are sourced from existing handshakes today; organizations from memberships are a follow-on (would extend candidate pool from isMembership holdings). The publishCohort builder validates threshold + totalShares + member count + Shamir GF(256) ceiling (255 max) before signing.',
};
