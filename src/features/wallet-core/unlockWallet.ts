import { Wallet } from 'tapit-attest';
import type { WalletBlob } from '../storage/localStore.ts';

// Returning-user flow. The passphrase is consumed once to derive the
// decryption key and then dropped. Throws with a stable message if
// the passphrase is wrong so the UI can render a retry without
// guessing at the underlying error.
//
// 5e-iii-b-2 — the unlock path now handles both v1 EncryptedBlob
// (legacy, still on disk for operators who set up before the v2
// migration) and v2 RecoverableEncryptedBlob (the cascade-ready
// format every fresh save mints from this cut onward). The
// discriminator is the blob's `v` field; we dispatch accordingly.
// The next save after a successful v1 unlock automatically migrates
// the on-disk blob to v2 — there is no separate migration step.
export async function unlockWallet(
  blob: WalletBlob,
  passphrase: string,
): Promise<Wallet> {
  try {
    if (blob.v === 2) {
      return await Wallet.restoreFromRecoverable(blob, passphrase);
    }
    return await Wallet.restore(blob, passphrase);
  } catch {
    throw new Error('Wrong passphrase. Try again.');
  }
}
