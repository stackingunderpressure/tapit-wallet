import type { Wallet } from 'tapit-attest';
import { buildEvent } from '../transport/nostrEvent.ts';
import type { PublishResult, Transport } from '../transport/transport.ts';

// Cut B3 slice 2 (docs/build-map-and-cut-lists.md; DynastyTrust
// tapit-nostr-cosign.ts's own header named this as the follow-on slice) --
// the other half of the round trip psbtCosignChannel.ts started. A
// psbt-cosign request that arrived over Nostr has no page to redirect the
// signed PSBT back to (approveRequest.ts's usual window.location.href
// pattern assumes a same-tab deeplink); this publishes the signed PSBT
// straight back to the requester's ephemeral reply pubkey instead.
//
// Deliberately its own event kind (9579, the next free sibling after the
// vault-membership channel's 9578) rather than riding the request's own
// kind (9576) or the envelope inbox (9573) -- same reasoning as every
// other custom kind in this feature: a signed-PSBT reply is neither an
// Attestation nor a request, and giving it a distinct kind means no
// existing subscriber has to defensively filter content it was never
// meant to see.
//
// Unlike the request side (which uses an EPHEMERAL sender identity
// because DynastyTrust has no persistent Tapit identity), this side
// signs and encrypts as the WALLET'S OWN real identity -- the same
// pattern encryptedInbox.ts's sendEnvelopeTo uses for a wallet-originated
// send. That's not a new privacy leak: DynastyTrust already addressed
// the original request to this wallet's real pubkey (it had to, to
// deliver it), so a relay watching the wire learns nothing about this
// wallet's identity from the response that it couldn't already see on
// the request.
export const PSBT_COSIGN_RESPONSE_KIND = 9579;

export interface PsbtCosignResponsePayload {
  v: 1;
  psbt_hex: string;
}

/**
 * Publish a signed PSBT back to the requester's ephemeral reply pubkey.
 * `requesterPubkey` is `request.response_channel.requester_pubkey` from
 * the original PsbtCosignSignRequest.
 */
export async function sendPsbtCosignResponseOverNostr(
  transport: Transport,
  sender: Wallet,
  psbtHex: string,
  requesterPubkey: string,
): Promise<PublishResult> {
  const payload: PsbtCosignResponsePayload = { v: 1, psbt_hex: psbtHex };
  const ciphertext = sender.nip44EncryptTo(JSON.stringify(payload), requesterPubkey);
  const event = await buildEvent({
    pubkey: sender.publicKey,
    sign: (digest) => sender.signDigest(digest),
    kind: PSBT_COSIGN_RESPONSE_KIND,
    content: ciphertext,
    tags: [['p', requesterPubkey]],
  });
  return transport.publish(event);
}
