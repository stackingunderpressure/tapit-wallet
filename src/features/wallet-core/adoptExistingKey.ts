import {
  Wallet,
  publicKeyFromPrivate,
  createSuccessionLink,
  type WalletSnapshot,
  type Keypair,
} from 'tapit-attest';
import { saveWallet } from './saveWallet.ts';

// Adopt-an-existing-Nostr-key flow ("Switch to my existing Nostr key",
// operator request 2026-06-03). The operator already holds an old Nostr
// identity (an nsec they used in Primal / Damus / Amethyst) and wants
// THIS wallet — with all the holdings it has accumulated — to publish
// as that old identity going forward.
//
// The naive read of "take my old key as my new key" is destructive: a
// different private key is a different identity, so swapping the keypair
// outright would orphan every attestation this wallet already signed
// with its current key. The succession mechanism is the non-destructive
// path. Instead of replacing the identity, we ROTATE TO the supplied old
// key — exactly what RotateKeySection does, except the destination key is
// one the operator provides rather than a freshly-generated random one:
//
//   1. The current active key signs a succession link binding
//      current-key -> old-key (createSuccessionLink, fromPrivateKey is
//      the CURRENT private key — proving the wallet authorized handing
//      off to the old key).
//   2. The wallet is rebuilt with the old key as the active signing key,
//      the current key pushed into the retired set (so messages
//      encrypted to it before the swap stay decryptable), and the
//      succession chain extended by the new link.
//
// After this, the wallet's stable IDENTITY (genesis pubkey) is unchanged,
// every existing holding still verifies (it was signed under a key the
// succession chain walks back from), and every NEW Nostr event the wallet
// publishes — kind-0 profile, kind-1 note, NIP-44 chat — is signed by the
// old key and therefore appears under the operator's old npub. The
// operator is back to being their old account, with the Tapit substrate
// intact on top of it.
//
// This is a pure app-layer assembly over chassis primitives the library
// already exports (snapshot, createSuccessionLink, fromSnapshot). It does
// NOT touch tapit-attest. The keys-never-leave-unencrypted discipline is
// honored: the old private key arrives already-decrypted from the
// operator's paste, is wrapped into the v2 recoverable snapshot under the
// passphrase Tapit already holds, and never crosses the network.

export interface AdoptExistingKeyResult {
  wallet: Wallet;
  /** The old key now active — its x-only pubkey, for confirmation UI. */
  adoptedPublicKey: string;
  /** The key that was retired by this adoption (the prior active key). */
  retiredPublicKey: string;
}

/**
 * Rotate the given wallet to an operator-supplied private key, preserving
 * the wallet's identity, holdings, and prior keys. Persists the resulting
 * snapshot under `passphrase` (the wallet's existing unlock passphrase)
 * via the v2 recoverable path. Returns the rebuilt wallet.
 *
 * Throws when the supplied key is malformed, when it is already the
 * active key (nothing to do — guards against an accidental no-op swap),
 * or when the wallet cannot be re-snapshotted.
 */
export async function adoptExistingKey(
  wallet: Wallet,
  passphrase: string,
  ownerId: string,
  oldPrivateKeyHex: string,
): Promise<AdoptExistingKeyResult> {
  if (passphrase.length === 0) throw new Error('passphrase must not be empty');
  if (!/^[0-9a-f]{64}$/i.test(oldPrivateKeyHex)) {
    throw new Error('private key must be 64-character hex');
  }
  const oldPriv = oldPrivateKeyHex.toLowerCase();
  const oldPublicKey = publicKeyFromPrivate(oldPriv);

  const snapshot: WalletSnapshot = await wallet.snapshot();
  const currentKeypair = snapshot.activeKeypair;

  if (oldPublicKey === currentKeypair.publicKey) {
    throw new Error(
      'That key is already this wallet\'s active key — nothing to switch.',
    );
  }
  // Guard against re-adopting any key already in this wallet's history —
  // its genesis identity OR any previously-retired key. keyHistory is the
  // full set (identity + every succession toKey). Re-adopting one would
  // create a cycle in the succession chain and make the key-history walk
  // ambiguous, so refuse it outright.
  if (wallet.keyHistory.includes(oldPublicKey)) {
    throw new Error(
      'That key already appears in this wallet\'s key history.',
    );
  }

  // The current active key signs the link handing authority to the old
  // key. `previous` is the last succession link (undefined for a wallet
  // that has never rotated), so the chain stays continuous.
  const previous = snapshot.succession[snapshot.succession.length - 1];
  const link = createSuccessionLink({
    fromPrivateKey: currentKeypair.privateKey,
    toKey: oldPublicKey,
    previous,
  });

  const adoptedKeypair: Keypair = {
    privateKey: oldPriv,
    publicKey: oldPublicKey,
  };
  // The retiring (current) key is retained so the wallet can still
  // decrypt messages addressed to it before peers learn of the switch —
  // same posture as Wallet.rotate(). Oldest-first ordering preserved.
  const retiredKeypairs: Keypair[] = [
    ...(snapshot.retiredKeypairs ?? []),
    currentKeypair,
  ];

  const nextSnapshot: WalletSnapshot = {
    ...snapshot,
    activeKeypair: adoptedKeypair,
    succession: [...snapshot.succession, link],
    retiredKeypairs,
  };

  const rebuilt = await Wallet.fromSnapshot(nextSnapshot);
  // Sanity: the rebuilt chain must verify from identity to the adopted
  // key before we persist. If it doesn't, refuse — never write a wallet
  // whose key history doesn't resolve.
  if (!rebuilt.verifyKeyHistory()) {
    throw new Error(
      'Adoption produced a key history that does not verify — aborted, your wallet is unchanged.',
    );
  }

  // Persist through saveWallet, NOT a raw exportRecoverable: saveWallet
  // reuses the existing v2 blob's K_data (exportRecoverableReuseKData) so
  // any recovery-cohort shares the operator already distributed stay
  // valid. A fresh K_data here would silently invalidate the cohort
  // cascade — the same load-bearing invariant the rotate path depends on.
  await saveWallet(rebuilt, passphrase, ownerId);

  return {
    wallet: rebuilt,
    adoptedPublicKey: oldPublicKey,
    retiredPublicKey: currentKeypair.publicKey,
  };
}
