import type { Wallet } from 'tapit-attest';
import { walletStore, type SaveOutcome } from '../storage/walletStore.ts';

// Re-encrypt the current wallet snapshot and persist it. The
// passphrase is held in WalletProvider's closure — never exported,
// never stored, never serialized. This function is the only place
// downstream of unlock that needs it.
export async function saveWallet(
  wallet: Wallet,
  passphrase: string,
  ownerId: string,
): Promise<SaveOutcome> {
  const blob = await wallet.exportEncrypted(passphrase);
  return walletStore.save(ownerId, blob);
}
