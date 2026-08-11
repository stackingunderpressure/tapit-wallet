import type { Wallet } from 'tapit-attest';
import { buildEvent } from '../transport/nostrEvent.ts';
import type { PublishResult, Transport } from '../transport/transport.ts';

// Real receipt confirmation for the circle safety phrase pair
// (DynastyTrust operator: "message couldn't drop in that situation" --
// a relay accepting the delivery publish never proved this wallet
// actually got it). Sent ONLY after storeCirclePhrasePair
// (circlePhrase.ts) has successfully written the pair, so a DynastyTrust
// confirmed_at genuinely means the pair is on this device now.
//
// Deliberately its own event kind (9581, the next free sibling after
// the vault-membership ack channel's 9580) -- same reasoning as every
// other custom kind in this feature: a receipt ack is neither an
// Attestation nor a request, so giving it a distinct kind means no
// existing subscriber has to defensively filter content it was never
// meant to see.
//
// Same identity posture as vaultMembershipAckChannel.ts /
// psbtCosignResponseChannel.ts: signs and encrypts as the WALLET'S OWN
// real identity, not an ephemeral one -- DynastyTrust already addressed
// the original delivery to this wallet's real pubkey, so the ack
// reveals nothing about this wallet's identity that the delivery
// didn't already.
export const CIRCLE_PHRASE_ACK_KIND = 9581;

export interface CirclePhraseAckPayload {
  v: 1;
  kind: 'circle-phrase-received';
}

/**
 * Publish a receipt ack back to the sender's ephemeral reply pubkey.
 * `requesterPubkey` is `delivery.response_channel.requester_pubkey` from
 * the original CirclePhraseDelivery. Callers should only call this when
 * `response_channel` was actually present -- there is nowhere to send an
 * ack for an older delivery that predates the field.
 */
export async function sendCirclePhraseAckOverNostr(
  transport: Transport,
  sender: Wallet,
  requesterPubkey: string,
): Promise<PublishResult> {
  const payload: CirclePhraseAckPayload = { v: 1, kind: 'circle-phrase-received' };
  const ciphertext = sender.nip44EncryptTo(JSON.stringify(payload), requesterPubkey);
  const event = await buildEvent({
    pubkey: sender.publicKey,
    sign: (digest) => sender.signDigest(digest),
    kind: CIRCLE_PHRASE_ACK_KIND,
    content: ciphertext,
    tags: [['p', requesterPubkey]],
  });
  return transport.publish(event);
}
