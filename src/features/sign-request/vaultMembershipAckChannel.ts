import type { Wallet } from 'tapit-attest';
import { buildEvent } from '../transport/nostrEvent.ts';
import type { PublishResult, Transport } from '../transport/transport.ts';

// The other half of the "return roster" DynastyTrust's
// circle-membership-delivery.ts / vault-membership-ack-channel.ts asked
// for (2026-08-11, operator: "we need to have a return roster of it...
// a verified member that's signed it"). A vault-membership request
// arriving over Nostr has no page to redirect an answer back to; this
// publishes the accept/decline decision straight to the requester's
// ephemeral reply pubkey (request.response_channel.requester_pubkey)
// instead.
//
// Deliberately its own event kind (9580, the next free sibling after
// the psbt-cosign response channel's 9579) -- same reasoning as every
// other custom kind in this feature: an ack is neither an Attestation
// nor a request, so giving it a distinct kind means no existing
// subscriber has to defensively filter content it was never meant to
// see.
//
// Same identity posture as psbtCosignResponseChannel.ts: signs and
// encrypts as the WALLET'S OWN real identity, not an ephemeral one --
// DynastyTrust already addressed the original request to this wallet's
// real pubkey, so the ack reveals nothing about this wallet's identity
// that the request didn't already.
export const VAULT_MEMBERSHIP_ACK_KIND = 9580;

export interface VaultMembershipAckPayload {
  v: 1;
  // 'left' (2026-08-15) is a member's own wallet walking back an earlier
  // 'accepted' -- see leaveVaultMembership.ts.
  decision: 'accepted' | 'declined' | 'left';
}

/**
 * Publish an accept/decline ack back to the requester's ephemeral reply
 * pubkey. `requesterPubkey` is `request.response_channel.requester_pubkey`
 * from the original VaultMembershipRequestPayload. Callers should only
 * call this when `response_channel` was actually present on the request
 * -- there is nowhere to send an ack for an older request that predates
 * the field.
 */
export async function sendVaultMembershipAckOverNostr(
  transport: Transport,
  sender: Wallet,
  decision: 'accepted' | 'declined' | 'left',
  requesterPubkey: string,
): Promise<PublishResult> {
  const payload: VaultMembershipAckPayload = { v: 1, decision };
  const ciphertext = sender.nip44EncryptTo(JSON.stringify(payload), requesterPubkey);
  const event = await buildEvent({
    pubkey: sender.publicKey,
    sign: (digest) => sender.signDigest(digest),
    kind: VAULT_MEMBERSHIP_ACK_KIND,
    content: ciphertext,
    tags: [['p', requesterPubkey]],
  });
  return transport.publish(event);
}
