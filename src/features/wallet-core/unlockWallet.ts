import { Wallet, unwrapKData } from 'tapit-attest';
import type { WalletBlob } from '../storage/localStore.ts';

// Returning-user flow. The passphrase is consumed once to derive the
// decryption key and then dropped. Throws with a stable message if
// the passphrase is wrong so the UI can render a retry without
// guessing at the underlying error.
//
// 5e-iii-c-β — unlock extracts K_data from v2 blobs so subsequent
// saves can re-encrypt with the same K_data and any cohort-held
// Shamir shares stay valid. v1 blobs return kData=null; the next
// save migrates the on-disk blob to v2 by minting a fresh K_data.
// There is no separate migration step.

export interface UnlockWalletResult {
  wallet: Wallet;
  /** K_data extracted from a v2 blob, or null when unlocking a v1 blob. */
  kData: Uint8Array | null;
}

export async function unlockWallet(
  blob: WalletBlob,
  passphrase: string,
): Promise<UnlockWalletResult> {
  try {
    if (blob.v === 2) {
      const wallet = await Wallet.restoreFromRecoverable(blob, passphrase);
      const kData = unwrapKData(blob, passphrase);
      return { wallet, kData };
    }
    const wallet = await Wallet.restore(blob, passphrase);
    return { wallet, kData: null };
  } catch {
    throw new Error('Wrong passphrase. Try again.');
  }
}
