import type { Wallet } from 'tapit-attest';
import { walletStore, type SaveOutcome } from '../storage/walletStore.ts';

// Re-encrypt the current wallet snapshot and persist it. The
// passphrase is held in WalletProvider's closure — never exported,
// never stored, never serialized. This function is the only place
// downstream of unlock that needs it.
//
// 5e-iii-b-2 — saves now mint a v2 RecoverableEncryptedBlob (the
// Phase 5e cascade-ready format) instead of v1. Both formats keep
// the passphrase-unlock path intact, so existing v1 blobs on disk
// continue to unlock through unlockWallet's format detection.
// K_data is intentionally NOT retained on the producing device —
// the security of the recovery cascade relies on the device that
// minted K_data forgetting it after distribution. Pre-cohort
// (today) there is no distribution, so K_data is simply discarded;
// the cohort-publish cut (next in the 5e arc) will capture K_data
// on its way out for Shamir-split + Mycelium delivery.
export async function saveWallet(
  wallet: Wallet,
  passphrase: string,
  ownerId: string,
): Promise<SaveOutcome> {
  const { blob } = await wallet.exportRecoverable(passphrase);
  // K_data falls out of scope here; the cohort-distribution cut
  // will reach into exportRecoverable directly when it needs K_data.
  return walletStore.save(ownerId, blob);
}
