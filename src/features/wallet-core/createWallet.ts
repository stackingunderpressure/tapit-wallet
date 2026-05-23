import { Wallet } from 'tapit-attest';
import { walletStore } from '../storage/walletStore.ts';

// First-login flow. Generates a fresh keypair, encrypts the snapshot
// under the user's passphrase, and persists it to both stores.
// Returns the unlocked Wallet AND the K_data so the caller can hold
// kData in memory for the duration of the unlocked session — every
// subsequent save re-uses it via exportRecoverableWithKData.
//
// The keypair never leaves this function unencrypted. The passphrase
// never crosses the network — encryption happens client-side, the
// host receives ciphertext only.

export interface CreateWalletResult {
  wallet: Wallet;
  /** The freshly-minted K_data for the first v2 blob this wallet wrote. */
  kData: Uint8Array;
}

export async function createWallet(
  ownerId: string,
  passphrase: string,
): Promise<CreateWalletResult> {
  if (passphrase.length === 0) throw new Error('passphrase must not be empty');
  const wallet = Wallet.generate();
  const { blob, kData } = await wallet.exportRecoverable(passphrase);
  await walletStore.save(ownerId, blob);
  return { wallet, kData };
}
