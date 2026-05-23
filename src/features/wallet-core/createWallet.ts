import { Wallet } from 'tapit-attest';
import { walletStore } from '../storage/walletStore.ts';

// First-login flow. Generates a fresh keypair, encrypts the snapshot
// under the user's passphrase via the v2 recoverable format, and
// persists it to both stores. Returns the unlocked Wallet so the
// caller can put it into context.
//
// Phase 5e-iii-b-2 — every new wallet is created in v2 format from
// the start so a recovery cohort can be declared and shares
// distributed without a format migration. K_data is generated here
// once and then reused across all future saves via
// Wallet.exportRecoverableReuseKData, so distributed shares stay
// valid forever.
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
  const { blob } = await wallet.exportRecoverable(passphrase);
  await walletStore.save(ownerId, blob);
  return wallet;
}
