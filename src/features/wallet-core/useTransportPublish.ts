import { useCallback } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import type { Transport, PublishResult } from '../transport/transport.ts';

// The three outbound-publish callbacks the wallet exposes through
// context, extracted from WalletProvider so the provider stays under the
// file-size hard limit (CLAUDE_ROOT.md 800-line gate) and the publish
// contracts live in one cohesive place. All three share the same
// preconditions — a connected Mycelium transport and an unlocked (or
// needs-identity) wallet — and all three dynamic-import their transport
// module so the encrypted-inbox / note code stays out of the main
// bundle until the operator actually sends something.
//
//   sendEnvelope     — encrypt an envelope to a peer pubkey and publish.
//   publishPublicNote— publish a PUBLIC kind-1 note (world-readable).
//   syncEnvelope     — publish encrypted-to-self for multi-device sync;
//                      opportunistic, returns null when transport is off.
//
// `wallet` is the active unlocked Wallet or null; passing null (locked)
// makes sendEnvelope / publishPublicNote throw and syncEnvelope no-op,
// exactly as the inline versions did via the phase guard.

export interface TransportPublish {
  sendEnvelope: (recipientPubkey: string, envelope: Attestation) => Promise<PublishResult>;
  publishPublicNote: (
    content: string,
  ) => Promise<{ eventId: string; publish: PublishResult }>;
  syncEnvelope: (envelope: Attestation) => Promise<PublishResult | null>;
}

export function useTransportPublish(
  transport: Transport | null,
  wallet: Wallet | null,
): TransportPublish {
  const sendEnvelope = useCallback(
    async (recipientPubkey: string, envelope: Attestation) => {
      if (!transport) {
        throw new Error('Mycelium network is not connected — enable it in Settings.');
      }
      if (!wallet) throw new Error('wallet must be unlocked');
      const { sendEnvelopeTo } = await import('../transport/encryptedInbox.ts');
      const result = await sendEnvelopeTo(transport, envelope, recipientPubkey, wallet);
      return result.publish;
    },
    [transport, wallet],
  );

  // Publish a PUBLIC kind-1 Nostr note (Tier 1 item 8) — world-readable,
  // unencrypted, the opposite of sendEnvelope. Body lives in
  // nostrNote.publishNote; see WalletContext for the full contract.
  const publishPublicNote = useCallback(
    async (content: string) => {
      if (!transport) {
        throw new Error("You're not connected — turn on staying reachable in Settings.");
      }
      if (!wallet) throw new Error('wallet must be unlocked');
      const { publishNote } = await import('../transport/nostrNote.ts');
      return publishNote(transport, wallet, content);
    },
    [transport, wallet],
  );

  const syncEnvelope = useCallback(
    async (envelope: Attestation) => {
      // Opportunistic — when Mycelium is off, sync is a no-op and returns
      // null. Callers do not need to gate on this; the cloud-sync via
      // walletStore.save still delivers eventually.
      if (!transport || !wallet) return null;
      const { sendEnvelopeToSelf } = await import('../transport/encryptedInbox.ts');
      const result = await sendEnvelopeToSelf(transport, envelope, wallet);
      return result.publish;
    },
    [transport, wallet],
  );

  return { sendEnvelope, publishPublicNote, syncEnvelope };
}
