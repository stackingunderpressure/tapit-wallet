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
      const incomingId = envelopeId(item.envelope);

      // Step 1: read holdings. If this itself throws, conservatively
      // surface the envelope so the operator can decide.
      let holdings: Attestation[];
      try {
        holdings = await wallet.holdings();
      } catch (err) {
        console.warn('silent-absorb: holdings() failed', err);
        setInboxEnvelopes((prev) =>
          prev.some((p) => p.eventId === item.eventId)
            ? prev
            : [item, ...prev],
        );
        return;
      }

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

      // No held copy — unknown envelope. Surface as an inbox row so
      // the operator can act on it (or copy/paste it elsewhere).
      if (!held) {
        setInboxEnvelopes((prev) =>
          prev.some((p) => p.eventId === item.eventId)
            ? prev
            : [item, ...prev],
        );
        return;
      }

      // We HOLD a copy with the same envelopeId. From this branch
      // we NEVER re-add to inbox — the held copy is canonical, the
      // operator already absorbed this entry (manually or silently),
      // and re-surfacing it on every relay re-delivery is the
      // "old absorb signature reappears next session" bug operator
      // surfaced 2026-05-31. Even if mergeSignatures throws (rare
      // pathological verification case) or hold/save fails, the
      // held copy stands and the inbox row stays out.
      let mergeResult: ReturnType<typeof mergeSignatures>;
      try {
        mergeResult = mergeSignatures(held, item.envelope);
      } catch (err) {
        console.warn(
          'silent-absorb: merge threw on a held envelope; held copy stands',
          err,
        );
        setInboxEnvelopes((prev) =>
          prev.filter((p) => envelopeId(p.envelope) !== incomingId),
        );
        return;
      }

      if (mergeResult.newSignatures.length === 0) {
        setInboxEnvelopes((prev) =>
          prev.filter((p) => envelopeId(p.envelope) !== incomingId),
        );
        return;
      }

      // Incoming has new signatures — merge into holdings, persist,
      // refresh the consumer state.
      try {
        await wallet.hold(mergeResult.merged);
        const pass = passphraseRef.current;
        if (pass && ownerId) {
          await saveWallet(wallet, pass, ownerId);
        }
        setHoldings(await wallet.holdings());
      } catch (err) {
        console.warn(
          'silent-absorb: hold/save failed; held copy stands',
          err,
        );
      }
      setInboxEnvelopes((prev) =>
        prev.filter((p) => envelopeId(p.envelope) !== incomingId),
      );
    })();
  };
}
