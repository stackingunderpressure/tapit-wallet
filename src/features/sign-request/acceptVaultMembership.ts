import type { Attestation, FieldValue, Wallet } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import type { VaultMembershipRequestPayload } from './vaultMembershipChannel.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import { checkRangedKeys } from './freshAddressLeaf.ts';
import { isVaultMembership, readVaultMembership } from './vaultTrail.ts';
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
  // A fresh-address vault's keys must really be the vault's own before this
  // wallet signs them into its membership (freshAddressLeaf.ts).
  if (request.ranged_keys?.length) checkRangedKeys(request.ranged_keys, request.leaf_scripts);

  const fields: Record<string, FieldValue> = {
    agreement_type: 'vault-membership',
    vault_descriptor: request.vault_descriptor,
    vault_name: request.vault_name,
    role: request.role,
    ...(request.role_label ? { role_label: request.role_label } : {}),
    leaf_scripts: JSON.stringify(request.leaf_scripts),
    ...(request.ranged_keys?.length ? { ranged_keys: JSON.stringify(request.ranged_keys) } : {}),
    review_mode: request.review_mode ?? 'wellness',
    ...(request.wellness_path ? { wellness_path: 'true' } : {}),
    ...(request.change_scripts?.length ? { change_scripts: JSON.stringify(request.change_scripts) } : {}),
    ...(request.network ? { network: request.network } : {}),
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
  // An updated offer replaces the membership it updates (2026-11-24): the
  // older one for this vault and role, missing the fresh-address keys,
  // would otherwise be the one signing looks up first.
  const newId = envelopeId(signed);
  for (const att of await wallet.holdings()) {
    if (!isVaultMembership(att) || envelopeId(att) === newId) continue;
    const v = readVaultMembership(att);
    if (v.vaultDescriptor === request.vault_descriptor && v.role === request.role) await wallet.unhold(envelopeId(att));
  }
  await saveWallet();

  const digestHex = newId;
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
