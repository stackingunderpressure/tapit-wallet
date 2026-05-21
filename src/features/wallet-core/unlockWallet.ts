import { Wallet, type EncryptedBlob } from 'tapit-attest';

// Returning-user flow. The passphrase is consumed once to derive the
// decryption key and then dropped. Throws with a stable message if
// the passphrase is wrong so the UI can render a retry without
// guessing at the underlying error.
export async function unlockWallet(
  blob: EncryptedBlob,
  passphrase: string,
): Promise<Wallet> {
  try {
    return await Wallet.restore(blob, passphrase);
  } catch {
    throw new Error('Wrong passphrase. Try again.');
  }
}
