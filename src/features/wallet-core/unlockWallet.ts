import { Wallet } from 'tapit-attest';
import type { AnyEncryptedBlob } from '../storage/localStore.ts';

// Returning-user flow. The passphrase is consumed once to derive the
// decryption key and then dropped. Throws with a stable message if
// the passphrase is wrong so the UI can render a retry without
// guessing at the underlying error.
//
// Phase 5e-iii-b-2 — dispatches on blob version. v1 (legacy) routes
// through Wallet.restore (PBKDF2-direct path); v2 routes through
// Wallet.restoreRecoverable (passphrase-unwraps K_data, then
// decrypts the data half). The recovery-from-shares path
// (restoreFromKData) is a separate code path used by the ceremony,
// not by unlock.
export async function unlockWallet(
  blob: AnyEncryptedBlob,
  passphrase: string,
): Promise<Wallet> {
  try {
    if (blob.v === 2) {
      return await Wallet.restoreRecoverable(blob, passphrase);
    }
    return await Wallet.restore(blob, passphrase);
  } catch {
    throw new Error('Wrong passphrase. Try again.');
  }
}
