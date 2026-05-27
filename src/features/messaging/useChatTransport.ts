import { useCallback, useEffect, useRef, useState } from 'react';
import type { Wallet } from 'tapit-attest';
import type { Transport } from '../transport/transport.ts';
import type { InboxChatMessage } from '../transport/encryptedInbox.ts';
import type { ThreadMessage } from './threadMessage.ts';
import { summarizePublish } from '../transport/publishStatus.ts';
import { useChatPersistence } from './useChatPersistence.ts';

export interface SendChatMessageResult {
  warning?: string;
}

export interface UseChatTransportArgs {
  transport: Transport | null;
  wallet: Wallet | null;
  ownerId: string | null;
  passphrase: string | null;
}

export interface UseChatTransportResult {
  chatThreadsByPeer: ReadonlyMap<string, readonly ThreadMessage[]>;
  sendChatMessage(
    recipientPubkey: string,
    text: string,
  ): Promise<SendChatMessageResult>;
  // Drop the in-memory chat thread for a peer (case-insensitive match).
  // Used by removePeerConnection — the handshake unhold and the chat
  // purge belong to the same operator gesture.
  purgePeerThread(peerPubkey: string): void;
}

// Owns the per-peer chat-thread substrate so WalletProvider does
// not carry it. State (Map<peerPubkey, ThreadMessage[]>), the
// chat-kind subscription bound to the live Mycelium transport,
// the optimistic-send + publish-result reconciliation, and the
// IDB-paged persistence wiring all live here. Extracted from
// WalletProvider during the 2026-05-27 useChatTransport cut so
// the provider stays under the 800-line hard limit.
//
// The subscription effect keys on (transport, wallet) so it
// reacts to lock/unlock, opt-in/opt-out, and Wallet.rotate()
// (which keeps the wallet reference but changes the publicKey,
// driving a transport tear-down + re-open in WalletProvider so
// `transport` becomes a new reference here).
export function useChatTransport({
  transport,
  wallet,
  ownerId,
  passphrase,
}: UseChatTransportArgs): UseChatTransportResult {
  const [chatThreadsByPeer, setChatThreadsByPeer] = useState<
    ReadonlyMap<string, readonly ThreadMessage[]>
  >(() => new Map());
  const chatSubRef = useRef<{ close(): void } | null>(null);

  useEffect(() => {
    if (!transport || !wallet) return;
    let cancelled = false;
    void import('../transport/encryptedInbox.ts').then(
      ({ subscribeChatMessages }) => {
        if (cancelled) return;
        const chatSub = subscribeChatMessages(
          transport,
          wallet,
          (item: InboxChatMessage) => {
            const incoming: ThreadMessage = {
              direction: 'in',
              text: item.payload.text,
              ts: item.receivedAt,
              peerPubkey: item.senderPubkey,
              eventId: item.eventId,
            };
            setChatThreadsByPeer((prev) => {
              const existing = prev.get(item.senderPubkey) ?? [];
              if (existing.some((m) => m.eventId === item.eventId)) {
                return prev;
              }
              const next = new Map(prev);
              next.set(item.senderPubkey, [...existing, incoming]);
              return next;
            });
          },
        );
        chatSubRef.current = chatSub;
      },
    );
    return () => {
      cancelled = true;
      if (chatSubRef.current) {
        chatSubRef.current.close();
        chatSubRef.current = null;
      }
    };
  }, [transport, wallet]);

  const sendChatMessage = useCallback(
    async (
      recipientPubkey: string,
      text: string,
    ): Promise<SendChatMessageResult> => {
      if (!transport) {
        throw new Error(
          'Mycelium network is not connected — enable it in Settings.',
        );
      }
      if (!wallet) {
        throw new Error('wallet must be unlocked');
      }
      const trimmed = text.trim();
      if (trimmed.length === 0) return {};
      // Optimistic local append before publish so the composer
      // clears instantly and the operator sees their message in
      // the thread. Publish result attaches the event id below.
      const localTs = Math.floor(Date.now() / 1000);
      setChatThreadsByPeer((prev) => {
        const existing = prev.get(recipientPubkey) ?? [];
        const next = new Map(prev);
        next.set(recipientPubkey, [
          ...existing,
          {
            direction: 'out',
            text: trimmed,
            ts: localTs,
            peerPubkey: recipientPubkey,
          },
        ]);
        return next;
      });
      const { sendChatMessageTo } = await import(
        '../transport/encryptedInbox.ts'
      );
      const result = await sendChatMessageTo(
        transport,
        { text: trimmed },
        recipientPubkey,
        wallet,
        { created_at: localTs },
      );
      // Inspect publish outcome. Transport.publish does NOT reject on
      // relay failure — the caller has to read PublishResult to know
      // whether the event actually went out. Without this check the
      // operator's optimistic local append made them THINK the
      // message sent while every relay silently rejected — the bug
      // they reported as "messages are still not sending properly.
      // The other person is not receiving the message either way."
      // 'fail' = every relay rejected AND none are still pending →
      // the message is not going anywhere; surface the failure and
      // rip the optimistic record out so the operator's thread
      // honestly reflects what happened. 'pending' / 'ok' both
      // attach the eventId and let the operator keep the optimistic
      // record; pending messages may still land via slow relays.
      const summary = summarizePublish(result.publish);
      if (summary.tone === 'fail') {
        setChatThreadsByPeer((prev) => {
          const existing = prev.get(recipientPubkey) ?? [];
          const filtered = existing.filter(
            (m) =>
              !(
                m.direction === 'out' &&
                m.ts === localTs &&
                m.text === trimmed &&
                !m.eventId
              ),
          );
          const next = new Map(prev);
          next.set(recipientPubkey, filtered);
          return next;
        });
        throw new Error(summary.detail);
      }
      // Attach the event id to the optimistic record so subsequent
      // re-arrivals from relay history dedupe correctly. Match by
      // ts + text + direction since the optimistic record had no id.
      const eventId = result.event.id;
      setChatThreadsByPeer((prev) => {
        const existing = prev.get(recipientPubkey) ?? [];
        const updated = existing.map((m) =>
          m.direction === 'out' &&
          m.ts === localTs &&
          m.text === trimmed &&
          !m.eventId
            ? { ...m, eventId }
            : m,
        );
        const next = new Map(prev);
        next.set(recipientPubkey, updated);
        return next;
      });
      // 'pending' = at least one relay still might land it, but no
      // acks before timeout. Surface a soft warning so the operator
      // sees the message is in-flight rather than confirmed-sent.
      // Operator chip-decision 2026-05-25: amber non-blocking
      // signal distinct from the red 'fail' path.
      if (summary.tone === 'pending') {
        return { warning: summary.detail };
      }
      return {};
    },
    [transport, wallet],
  );

  const purgePeerThread = useCallback((peerPubkey: string) => {
    setChatThreadsByPeer((prev) => {
      const lower = peerPubkey.toLowerCase();
      let dropped = false;
      const next = new Map<string, readonly ThreadMessage[]>();
      for (const [k, v] of prev) {
        if (k.toLowerCase() === lower) {
          dropped = true;
          continue;
        }
        next.set(k, v);
      }
      return dropped ? next : prev;
    });
  }, []);

  useChatPersistence(ownerId, passphrase, chatThreadsByPeer, setChatThreadsByPeer);

  return { chatThreadsByPeer, sendChatMessage, purgePeerThread };
}
