import type { Attestation, FieldValue, Wallet } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import type { VaultMembershipRequestPayload } from './vaultMembershipChannel.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';

// Cut C3's actual issuance step. Mirrors coSignEnvelope.ts's "pure, no
// redirect" shape so it's unit-testable on its own: build the claim
// fields vaultTrail.ts's readVaultMembership expects, self-mint + self-
// sign via wallet.attest (satisfies findVaultTrail's signedByMe check --
// DynastyTrust never signs this, it only describes the fields), hold,
// queue anchoring exactly like approveRequest.ts's generic 'attest'
// branch does for every other self-minted attestation, and return the
// signed envelope. The caller (IncomingVaultMembershipBanner.tsx) owns
// dismissing the request from view and showing errors -- this function
// never touches window/navigation, since there is nowhere to redirect a
// Nostr-delivered request to.
export async function acceptVaultMembership(
  wallet: Wallet,
  ownerId: string,
  request: VaultMembershipRequestPayload,
  saveWallet: () => Promise<void>,
  worker: WorkerHandle | null,
): Promise<Attestation> {
  const fields: Record<string, FieldValue> = {
    agreement_type: 'vault-membership',
    vault_descriptor: request.vault_descriptor,
    vault_name: request.vault_name,
    role: request.role,
    leaf_scripts: JSON.stringify(request.leaf_scripts),
    ...(request.high_value_threshold_sats !== undefined
      ? { high_value_threshold_sats: request.high_value_threshold_sats }
      : {}),
  };

  const signed = wallet.attest({
    kind: 'agreement',
    tier: 'high_stakes',
    subject: request.vault_descriptor,
    fields,
  });

  await wallet.hold(signed);
  await saveWallet();

  const digestHex = envelopeId(signed);
  await anchorQueue.upsert(ownerId, {
    digestHex,
    state: 'queued',
    anchor: null,
    attempts: 0,
    last_attempt: null,
    last_error: null,
  });
  if (worker) void worker.kick();

  return signed;
}
