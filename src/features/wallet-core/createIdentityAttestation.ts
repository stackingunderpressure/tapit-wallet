import type { Attestation, Wallet } from 'tapit-attest';
import { identityAttestation } from 'tapit-attest';

// The founding declaration every Tapit identity is born with. It is
// stored as a signed leaf on the identity attestation, which means
// the affirmation is permanent, dated, and tamper-evident — the
// person did not just tap a button, they signed a statement.
export const FOUNDING_DECLARATION =
  'I am creating this identity of my own free will. These keys are ' +
  'mine. I am responsible for protecting them. What I sign with them ' +
  'is mine, and mine alone.';

export interface IdentityInput {
  /** What people call the person. Required. */
  displayName: string;
  /** Full / legal name. Optional — the person chooses whether it
   *  goes on the founding record. */
  fullName?: string;
  /**
   * The exact declaration text the person affirmed. Passed in (not
   * hardcoded here) so the record stores precisely what the person
   * was shown and agreed to, even if FOUNDING_DECLARATION is later
   * revised — the old identity keeps the wording it was signed with.
   */
  declaration: string;
}

// First-run identity attestation — the birth of the person's
// identity. Self-signed: the wallet is both subject and signer.
// Leaves on the Merkle field tree carry the display name, the
// optional full name, the founding declaration the person
// affirmed, the issue date, and the pubkey, so a verifier reading
// the tree can confirm WHO this attestation is about and WHAT they
// declared, all against the active signing key.
//
// Tier 'notable' — this is not a routine receipt. It is the root
// of the person's verifiable life; the whole succession chain and
// every future attestation hangs off this one. Routine is for
// day-to-day diary entries; the founding identity earns the
// middle tier.
export async function createIdentityAttestation(
  wallet: Wallet,
  input: IdentityInput,
): Promise<Attestation> {
  const fields: Record<string, string> = {
    display_name: input.displayName,
    declaration: input.declaration,
    pubkey: wallet.publicKey,
    created_at: new Date().toISOString(),
  };
  if (input.fullName && input.fullName.trim().length > 0) {
    fields.full_name = input.fullName.trim();
  }

  const draft = identityAttestation({
    subject: wallet.identity,
    tier: 'notable',
    fields,
  });
  const signed = wallet.sign(draft);
  await wallet.hold(signed);
  return signed;
}
