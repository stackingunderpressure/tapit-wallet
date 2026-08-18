import type { Wallet, SignInAttestation } from 'tapit-attest';
import { buildEvent } from '../transport/nostrEvent.ts';
import type { PublishResult, Transport } from '../transport/transport.ts';
import type { SignGrant } from './types.ts';

// The QR/connect sibling of psbtCosignResponseChannel.ts -- a sign-in
// request that carried a response_channel (DynastyTrust's
// wallet-signin.ts's startTapitConnectRequest, delivered here via a
// scanned QR rather than a same-tab deeplink) has no page to redirect
// the signed grant back to. This publishes it straight back to the
// requester's ephemeral reply pubkey instead, same pattern, same
// reasoning as the psbt-cosign response channel this mirrors.
//
// Deliberately its own event kind (9582, the next free sibling after the
// circle-phrase ack channel's 9581) -- a signed sign-in grant is neither
// an Attestation nor a request, same "give every payload shape its own
// kind" discipline every other custom kind in this feature already
// follows.
//
// Signs and encrypts as the WALLET'S OWN real identity, same as
// psbtCosignResponseChannel.ts -- not a new privacy leak: revealing the
// wallet's real pubkey to whoever asked is the entire point of a
// sign-in/link response (the SignInAttestation itself carries that
// pubkey), identical information to what the existing redirect-based
// grant already hands the verifier directly.
export const SIGN_IN_RESPONSE_KIND = 9582;

export interface SignInResponsePayload {
  v: 1;
  grant: SignGrant;
}

/**
 * Publish a signed sign-in grant back to the requester's ephemeral reply
 * pubkey. `requesterPubkey` is `request.response_channel.requester_pubkey`
 * from the original SignInSignRequest.
 */
export async function sendSignInResponseOverNostr(
  transport: Transport,
  sender: Wallet,
  signIn: SignInAttestation,
  nonce: string | undefined,
  requesterPubkey: string,
): Promise<PublishResult> {
  const grant: SignGrant = { v: 1, ...(nonce ? { nonce } : {}), signIn };
  const payload: SignInResponsePayload = { v: 1, grant };
  const ciphertext = sender.nip44EncryptTo(JSON.stringify(payload), requesterPubkey);
  const event = await buildEvent({
    pubkey: sender.publicKey,
    sign: (digest) => sender.signDigest(digest),
    kind: SIGN_IN_RESPONSE_KIND,
    content: ciphertext,
    tags: [['p', requesterPubkey]],
  });
  return transport.publish(event);
}
