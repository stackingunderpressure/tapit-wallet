import type { Attestation, Wallet } from 'tapit-attest';
import { buildEvent } from '../transport/nostrEvent.ts';
import { wrapSignedEvent } from '../transport/nip17.ts';
import type { PublishResult, Transport } from '../transport/transport.ts';
import type { SignGrant } from './types.ts';

// The Nostr reply for a record request (intent 'attest' or 'cosign-existing')
// that arrived over recordRequestChannel.ts. Same shape and reasoning as
// signInResponseChannel.ts: there is no page to redirect back to, so the
// signed envelope goes straight to the requester's reply pubkey, encrypted
// and gift-wrapped so relays cannot see which wallet answered.
//
// Its own kind (9586, the next free after the record REQUEST kind 9585)
// for the same give-every-payload-its-own-kind reason as its siblings.
//
// First consumer: the Family Bitcoin Game (operator, 2026-11-27: the
// redirect reloaded Tapit and asked for the passphrase on every sign).
export const RECORD_RESPONSE_KIND = 9586;

export interface RecordResponsePayload {
  v: 1;
  grant: SignGrant;
}

export async function sendRecordResponseOverNostr(
  transport: Transport,
  sender: Wallet,
  envelope: Attestation,
  nonce: string | undefined,
  requesterPubkey: string,
): Promise<PublishResult> {
  const grant: SignGrant = { v: 1, ...(nonce ? { nonce } : {}), envelope };
  const payload: RecordResponsePayload = { v: 1, grant };
  const ciphertext = sender.nip44EncryptTo(JSON.stringify(payload), requesterPubkey);
  const event = await buildEvent({
    pubkey: sender.publicKey,
    sign: (digest) => sender.signDigest(digest),
    kind: RECORD_RESPONSE_KIND,
    content: ciphertext,
    tags: [['p', requesterPubkey]],
  });
  return transport.publish(await wrapSignedEvent(event, requesterPubkey, sender));
}
