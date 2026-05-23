import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'recovery',
  born: '2026-05-24',
  purpose:
    'Phase 5e — hyphal lattice + Shamir cascade recovery (MYCELIUM_NETWORK_SPEC §12). Cut 5e-iii-a shipped the recovery-cohort declaration UI + credential; 5e-iii-b shipped the cryptographic foundation (backup-format v2 with two independent paths to K_data). Cut 5e-iv adds the read-only Lattice screen at /lattice — the operator’s direct web in one view: handshakes (Tier P + Tier R), memberships (with the existing chain-walk sheet), and the declared cohort, with a Cohort badge surfacing the overlap between handshake contacts and cohort members. Editing routes back to the already-shipped flows (People tab / Identity tab / Settings). The recovery ceremony itself (initiator + responder + recovery-succession event) lands in 5e-v / -vi / -vii. The cryptographic floor (GF(256) Shamir split + combine) shipped in tapit-attest at 5e-ii. The load-bearing constraint stays loud: the Shamir split is over the backup ENCRYPTION KEY, never the signing keypair.',
  touches: [
    'src/features/recovery/createCohort.ts',
    'src/features/recovery/CohortEditorModal.tsx',
    'src/features/recovery/LatticeScreen.tsx',
  ],
  depends_on: ['wallet-core', 'anchoring', 'connections'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    'The cohort credential carries the member list as canonical JSON of {pubkey, name} pairs sorted + deduplicated so the digest is stable regardless of pick order. Latest-by-issuedAt wins for the in-effect cohort; older cohorts stay held + anchored for governance audit. Cohort members are sourced from existing handshakes today; organizations from memberships are a follow-on (would extend candidate pool from isMembership holdings). The publishCohort builder validates threshold + totalShares + member count + Shamir GF(256) ceiling (255 max) before signing.',
};
