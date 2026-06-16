import type { MutableRefObject } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { saveWallet } from './saveWallet.ts';
import { mergeSignatures } from '../cosigning/mergeSignatures.ts';
import {
  findCompletedHandshakeWith,
  isHandshake,
} from '../connections/createHandshake.ts';
import {
  isSecretPieceReceipt,
  readSecretPieceReceipt,
} from '../recovery/secretPiece.ts';
import { recordPieceReceipt, upsertRecord } from '../recovery/secretLedger.ts';
import { secretsLedgerStore } from '../storage/secretsLedgerStore.ts';
import { foreignTreesStore } from '../storage/foreignTreesStore.ts';
import {
  isFamilyTreeBundle,
  readFamilyTreeBundle,
} from '../friends-trees/familyTreeBundle.ts';
import {
  isKeySuccessionAnnouncement,
  isVerifiedAnnouncement,
} from '../transport/peerSuccession.ts';
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
  /**
   * Live set of envelopeIds the operator has permanently dismissed.
   * Read synchronously on each arrival so a relay replay of a
   * dismissed envelope is dropped before it can reach the inbox UI.
   * A ref (not a value) so the handler — created once when the
   * transport opens — always sees the latest set without being
   * rebuilt. Optional for callers/tests that don't wire persistence.
   */
  dismissedRef?: MutableRefObject<Set<string>>;
  setInboxEnvelopes: (
    update: (prev: InboxEnvelope[]) => InboxEnvelope[],
  ) => void;
  setHoldings: (next: Attestation[]) => void;
}

export function createInboxEnvelopeHandler(deps: InboxHandlerDeps) {
  const { wallet, ownerId, passphraseRef, dismissedRef, setInboxEnvelopes, setHoldings } =
    deps;
  return (item: InboxEnvelope): void => {
    // Permanently-dismissed envelopes never come back, regardless of
    // whether the wallet holds a copy. This is the only suppression
    // that works for an envelope the wallet has NO held copy of (e.g. a
    // handshake whose peer wallet was deleted) — the held-copy and
    // completed-handshake paths below cannot fire without a local copy
    // to match against. Keyed by the stable envelopeId so every relay
    // replay of the same envelope is caught.
    if (dismissedRef && dismissedRef.current.has(envelopeId(item.envelope))) {
      return;
    }
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
    // B-1: a holder's receipt ("I'm holding piece X of secret Y" / "I let it
    // go") arrives FROM a peer. Record it into the owner's secret ledger
    // silently — zero owner chore, the secret's detail just shows the piece as
    // confirmed next time it's opened — and never surface it as an inbox row.
    // Tightly guarded + fire-and-forget so it can never disrupt other arrivals.
    if (isSecretPieceReceipt(item.envelope)) {
      void (async () => {
        try {
          const pass = passphraseRef.current;
          if (!pass || !ownerId) return;
          const view = readSecretPieceReceipt(item.envelope);
          if (view.receiptFor !== wallet.identity) return;
          const records = await secretsLedgerStore.load(ownerId, pass);
          const rec = records.find((r) => r.id === view.secretId);
          if (!rec) return;
          const updated = recordPieceReceipt(rec, view.pieceIndex, {
            status: view.status,
            holderPubkey: view.holderId,
            at: view.confirmedAt,
          });
          await secretsLedgerStore.save(ownerId, pass, upsertRecord(records, updated));
        } catch (err) {
          console.warn('secret-piece receipt collect failed', err);
        }
      })();
      return;
    }
    // A friend's CONSENTED family-tree share arrives FROM a peer. Persist it
    // into the encrypted foreignTreesStore SILENTLY — zero owner chore, it
    // just appears under "Friends' trees" next time they open the Family tab —
    // and never surface it as an inbox row. PRIVACY RAIL #2: the bundle is
    // NEVER wallet.hold'd and NEVER mixed into the operator's own holdings or
    // kin graph; it lives only in the foreign-trees store, rooted on the
    // friend's own self-node and shown read-only. The senderPubkey is the
    // envelope signer recovered by the transport — that is the honest
    // provenance the receiver attributes the tree to. Tightly guarded +
    // fire-and-forget so it can never disrupt other arrivals.
    if (isFamilyTreeBundle(item.envelope)) {
      void (async () => {
        try {
          const pass = passphraseRef.current;
          if (!pass || !ownerId) return;
          const view = readFamilyTreeBundle(item.envelope, item.senderPubkey);
          await foreignTreesStore.upsert(ownerId, pass, {
            fromPubkey: view.senderPubkey,
            sharerName: view.sharerName,
            rootNodeId: view.rootNodeId,
            sharedAt: view.sharedAt,
            // Exactly one of trees / projection is populated depending on the
            // share mode the sender chose (minimal is the default).
            trees: view.trees,
            ...(view.projection ? { projection: view.projection } : {}),
          });
        } catch (err) {
          console.warn('friend family-tree share absorb failed', err);
        }
      })();
      return;
    }
    // A peer's key-succession announcement: they rotated and are telling
    // us their new key descends from the key we know. Verify it (chain
    // valid + signed by the chain's current key) and silently HOLD it so
    // the peer key-alias resolver can map their new messages back to the
    // person we already know — then never surface it as an inbox row.
    // Unverified/forged announcements are dropped, not held.
    if (isKeySuccessionAnnouncement(item.envelope)) {
      if (isVerifiedAnnouncement(item.envelope)) {
        void (async () => {
          try {
            await wallet.hold(item.envelope);
            const pass = passphraseRef.current;
            if (pass && ownerId) {
              await saveWallet(wallet, pass, ownerId);
            }
            setHoldings(await wallet.holdings());
          } catch (err) {
            console.warn('peer key-succession ingest failed', err);
          }
        })();
      }
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
        findCompletedHandshakeWith(holdings, wallet.keyHistory, item.senderPubkey)
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
