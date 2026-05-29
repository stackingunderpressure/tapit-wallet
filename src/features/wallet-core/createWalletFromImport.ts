import { Wallet, publicKeyFromPrivate } from 'tapit-attest';
import { walletStore } from '../storage/walletStore.ts';

// Import-existing-nsec entry point (PLAN.md Tier 1 item 9). Takes
// the 32-byte hex private key the operator brought from their
// existing Nostr client (Primal, Damus, etc.), constructs a Wallet
// around that keypair via Wallet.fromKeypair, encrypts the snapshot
// under the chosen passphrase via the v2 recoverable format, and
// persists it.
//
// Unlike createWallet which generates a fresh key, this path
// imports an external one. The keys-never-leave-the-wallet-
// unencrypted discipline becomes more nuanced for imported
// identities — the operator's nsec already exists outside Tapit
// (in their other Nostr client, in their nsec-bunker, etc.) and
// the import surface is honest about that tradeoff before the
// operator commits. This file just does the cryptographic plumbing;
// the honest-disclosure UX lives in ImportNostrIdentityPrompt.
//
// The passphrase Tapit asks for here is a NEW passphrase for the
// LOCAL ENCRYPTED COPY of the imported keypair. It is not your
// existing wallet's passphrase (if any) and it never crosses the
// network — encryption happens client-side, the host receives
// ciphertext only.
export async function createWalletFromImport(
  ownerId: string,
  passphrase: string,
  privateKeyHex: string,
): Promise<Wallet> {
  if (passphrase.length === 0) throw new Error('passphrase must not be empty');
  if (!/^[0-9a-f]{64}$/i.test(privateKeyHex)) {
    throw new Error('imported private key must be 64-character hex');
  }
  const publicKey = publicKeyFromPrivate(privateKeyHex);
  const wallet = Wallet.fromKeypair({
    privateKey: privateKeyHex.toLowerCase(),
    publicKey,
  });
  const { blob } = await wallet.exportRecoverable(passphrase);
  await walletStore.save(ownerId, blob);
  return wallet;
}
