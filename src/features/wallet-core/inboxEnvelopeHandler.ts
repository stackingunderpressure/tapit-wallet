import type { MutableRefObject } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { saveWallet } from './saveWallet.ts';
import { mergeSignatures } from '../cosigning/mergeSignatures.ts';
import {
  findCompletedHandshakeWith,
  isHandshake,
} from '../connections/createHandshake.ts';
import type { InboxEnvelope } from '../transport/encryptedInbox.ts';

// Inbox-arrival handler factory — extracted from WalletProvider so
// the transport useEffect stays compact and WalletProvider stays
// under the 800-line file-size hard limit. The handler closes over
// the wallet + state setters supplied at factory time; returning a
// stable function lets the caller wire it into connectWallet
// without inlining the eighty-line silent-absorb body inside the
// effect's onEnvelope.
//
// The two paths preserved here:
//   1. Self-CC (sender == wallet pubkey, recipient == wallet pubkey)
//      — multi-device sync. Hold the envelope, save, refresh holdings.
//   2. Silent-absorb (incoming envelopeId matches an already-held
//      envelope) — merge new signatures into the held copy and drop
//      any stale inbox row that pointed at the same envelopeId.
//      Falls back to surfacing the envelope in the inbox UI if the
//      merge fails or if no held copy exists.

export interface InboxHandlerDeps {
  wallet: Wallet;
  ownerId: string | undefined;
  passphraseRef: MutableRefObject<string | null>;
  setInboxEnvelopes: (
    update: (prev: InboxEnvelope[]) => InboxEnvelope[],
  ) => void;
  setHoldings: (next: Attestation[]) => void;
}

export function createInboxEnvelopeHandler(deps: InboxHandlerDeps) {
  const { wallet, ownerId, passphraseRef, setInboxEnvelopes, setHoldings } = deps;
  return (item: InboxEnvelope): void => {
    if (item.senderPubkey === wallet.publicKey) {
      void (async () => {
        try {
          await wallet.hold(item.envelope);
          const pass = passphraseRef.current;
          if (pass && ownerId) {
            await saveWallet(wallet, pass, ownerId);
          }
          setHoldings(await wallet.holdings());
        } catch (err) {
          console.warn('self-CC auto-hold failed', err);
        }
      })();
      return;
    }
    void (async () => {
      try {
        const incomingId = envelopeId(item.envelope);
        const holdings = await wallet.holdings();
        // Silent-drop relay replays of handshake requests from peers
        // we already have a completed handshake with. The Nostr relay
        // re-delivers these on every wallet unlock; surfacing them as
        // still-pending rows confuses the operator into thinking the
        // connection did not complete when it actually did.
        if (
          isHandshake(item.envelope) &&
          findCompletedHandshakeWith(holdings, wallet.identity, item.senderPubkey)
        ) {
          return;
        }
        const held = holdings.find((a) => envelopeId(a) === incomingId);
        if (!held) {
          setInboxEnvelopes((prev) =>
            prev.some((p) => p.eventId === item.eventId)
              ? prev
              : [item, ...prev],
          );
          return;
        }
        const { merged, newSignatures } = mergeSignatures(held, item.envelope);
        if (newSignatures.length === 0) {
          setInboxEnvelopes((prev) =>
            prev.filter((p) => envelopeId(p.envelope) !== incomingId),
          );
          return;
        }
        await wallet.hold(merged);
        const pass = passphraseRef.current;
        if (pass && ownerId) {
          await saveWallet(wallet, pass, ownerId);
        }
        setHoldings(await wallet.holdings());
        setInboxEnvelopes((prev) =>
          prev.filter((p) => envelopeId(p.envelope) !== incomingId),
        );
      } catch (err) {
        console.warn('silent-absorb on inbox arrival failed', err);
        setInboxEnvelopes((prev) =>
          prev.some((p) => p.eventId === item.eventId)
            ? prev
            : [item, ...prev],
        );
      }
    })();
  };
}
