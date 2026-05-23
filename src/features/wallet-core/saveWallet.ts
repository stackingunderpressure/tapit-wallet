import type { Wallet } from 'tapit-attest';
import { walletStore, type SaveOutcome } from '../storage/walletStore.ts';

// Re-encrypt the current wallet snapshot and persist it. The
// passphrase is held in WalletProvider's closure — never exported,
// never stored, never serialized. This function is the only place
// downstream of unlock that needs it.
//
// Phase 5e-iii-b-2 — three save paths, dispatched on the existing
// stored blob's version:
//   (1) No existing blob (first save before createWallet finishes
//       wiring): use v2 fresh — generate K_data and wrap with
//       passphrase. createWallet itself handles this case so this
//       function rarely sees it.
//   (2) Existing v1 blob: this is a legacy wallet that pre-dates
//       Phase 5e. UPGRADE to v2 on this save — generate a fresh
//       K_data, wrap with passphrase. After the upgrade the
//       recovery-cohort flow becomes available.
//   (3) Existing v2 blob: REUSE the existing K_data via
//       exportRecoverableReuseKData. Subsequent saves MUST keep
//       K_data stable so distributed cohort shares stay valid. This
//       is the load-bearing path the cascade depends on.
export async function saveWallet(
  wallet: Wallet,
  passphrase: string,
  ownerId: string,
): Promise<SaveOutcome> {
  const existing = await walletStore.load(ownerId);
  if (existing && existing.blob.v === 2) {
    // Path 3 — preserve K_data.
    const { blob } = await wallet.exportRecoverableReuseKData(existing.blob, passphrase);
    return walletStore.save(ownerId, blob);
  }
  // Paths 1 and 2 — fresh v2 export. Generates a new K_data.
  const { blob } = await wallet.exportRecoverable(passphrase);
  return walletStore.save(ownerId, blob);
}
