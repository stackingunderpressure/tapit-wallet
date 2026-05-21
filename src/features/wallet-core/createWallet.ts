import { Wallet } from 'tapit-attest';
import { walletStore } from '../storage/walletStore.ts';

// First-login flow. Generates a fresh keypair, encrypts the snapshot
// under the user's passphrase, and persists it to both stores.
// Returns the unlocked Wallet so the caller can put it into context.
//
// The keypair never leaves this function unencrypted. The passphrase
// never crosses the network — encryption happens client-side, the
// host receives ciphertext only.
export async function createWallet(
  ownerId: string,
  passphrase: string,
): Promise<Wallet> {
  if (passphrase.length === 0) throw new Error('passphrase must not be empty');
  const wallet = Wallet.generate();
  const blob = await wallet.exportEncrypted(passphrase);
  await walletStore.save(ownerId, blob);
  return wallet;
}
