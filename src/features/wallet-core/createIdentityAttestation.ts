import type { Attestation, Wallet } from 'tapit-attest';
import { identityAttestation } from 'tapit-attest';

// First-run identity attestation. Self-signed: the wallet is both
// subject and signer. Leaves on the Merkle field tree carry the
// display name, the issue date, and the pubkey so a verifier
// reading the tree can confirm WHO this attestation is about
// against the active signing key.
//
// Tier 'routine' — a self-claim with no co-signer is the lowest-
// stakes thing in the system. Higher-tier identity attestations
// (co-signed by family, witnesses, services) get added over time;
// this one is just the wallet declaring "I am here, my name is X."
export async function createIdentityAttestation(
  wallet: Wallet,
  displayName: string,
): Promise<Attestation> {
  const draft = identityAttestation({
    subject: wallet.identity,
    tier: 'routine',
    fields: {
      display_name: displayName,
      pubkey: wallet.publicKey,
      created_at: new Date().toISOString(),
    },
  });
  const signed = wallet.sign(draft);
  await wallet.hold(signed);
  return signed;
}
