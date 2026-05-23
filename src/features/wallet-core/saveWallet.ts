import type { Wallet } from 'tapit-attest';
import { walletStore, type SaveOutcome } from '../storage/walletStore.ts';

// Re-encrypt the current wallet snapshot and persist it. The
// passphrase is held in WalletProvider's closure — never exported,
// never stored, never serialized. This function is the only place
// downstream of unlock that needs it.
//
// 5e-iii-c-β — saves preserve K_data across the unlocked session.
// On first save after a v1 unlock kData is null, so saveWallet mints
// a fresh K_data via exportRecoverable; the caller stores it for the
// next save. On every subsequent save kData is passed back in and
// saveWallet calls exportRecoverableWithKData — same K_data, same
// shares (if a recovery cohort has been declared). The seam is the
// returned `kData` value; callers must thread it through the
// unlocked session so cohort shares stay valid.

export interface SaveWalletResult {
  outcome: SaveOutcome;
  /** The K_data the blob was keyed on. Same as input when input was non-null. */
  kData: Uint8Array;
}

export async function saveWallet(
  wallet: Wallet,
  passphrase: string,
  ownerId: string,
  kData: Uint8Array | null,
): Promise<SaveWalletResult> {
  if (kData) {
    const blob = await wallet.exportRecoverableWithKData(passphrase, kData);
    const outcome = await walletStore.save(ownerId, blob);
    return { outcome, kData };
  }
  const { blob, kData: minted } = await wallet.exportRecoverable(passphrase);
  const outcome = await walletStore.save(ownerId, blob);
  return { outcome, kData: minted };
}
