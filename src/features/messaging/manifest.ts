import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'messaging',
  born: '2026-05-25',
  purpose:
    'Sub-cut 2b of the per-peer chat surface roadmap (brief 2026-05-24-per-peer-chat-surface-roadmap.md). The per-peer thread surface that opens under the People tab when the operator taps a ConnectionCard (Classic) or a Crew bubble (Fresh). Renders Tier 1 chat messages — TAPIT_CHAT_KIND events from the transport, signed and end-to-end encrypted, not anchored, not attestations — in iMessage-shape with the operator-aligned right and the peer-aligned left, a header carrying the peer name + relationship chip + Tier P/R badge, and a composer pinned at the bottom. Messages live in WalletContext per-peer (Map<peerPubkey, ThreadMessage[]>) backed by storage/messagesStore.ts via the useChatPersistence hook — load on first unlock per owner, debounce-save on every state change. Operator-reported bug fix 2026-05-25: outbound messages were vanishing on reload because the relay subscription filter is #p=mine, so the relay never re-delivered the operator own sent messages back. IDB persistence (local-only, encrypted at rest via tapit-attest PBKDF2-AES — same posture walletStore + mediaStore already use, passphrase flowed in through useChatPersistence) closes that gap. Cut 4 still owns the opt-in cloud-backup toggle (default OFF). Sub-cut 2c shipped 2026-05-25: promote-to-envelope plus-menu (composer + button) and bubble long-press both open a bottom-sheet PromoteMenu seeded with the source text. First target wired end-to-end is Save as journal entry — the chat moment opens JournalComposer with the source text in the body and the peer pinned as the About-someone-else subject; if the handshake carries relationship=family the category pre-picks Family. PROMOTE_TARGETS in promoteTarget.ts is data-driven so future targets (mark-presence, witness-ask, cosign-request, share-held-envelope, disclose-proof) plug into the same menu without restructuring.',
  touches: [
    'src/features/messaging/manifest.ts',
    'src/features/messaging/threadMessage.ts',
    'src/features/messaging/bubbleFormat.ts',
    'src/features/messaging/MessageBubble.tsx',
    'src/features/messaging/MessageComposer.tsx',
    'src/features/messaging/PeerThread.tsx',
    'src/features/messaging/useChatPersistence.ts',
    'src/features/messaging/PromoteMenu.tsx',
    'src/features/messaging/promoteTarget.ts',
    'src/features/messaging/promoteToJournalPrefill.ts',
    'src/features/messaging/promoteToPresencePrefill.ts',
    'src/features/messaging/PromoteRouter.tsx',
    'src/features/messaging/HeldEnvelopePicker.tsx',
    'src/features/messaging/useLongPress.ts',
  ],
  depends_on: ['wallet-core', 'transport', 'connections', 'theme', 'presence', 'cosigning', 'disclosure'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'WalletProvider owns the per-peer thread map and the sendChatMessage callback; messaging consumes both via useWallet. The chat subscription runs alongside the existing inbox subscription inside WalletProvider transport useEffect — same transport handle, separate handler, independent kind filter (TAPIT_CHAT_KIND vs TAPIT_ENVELOPE_KIND). Outbound chat optimistically appends to the local thread before publish settles so the composer feels instant; if publish fails the message stays in the thread but a future polish cut will mark it as undelivered. ConnectionCard gains an optional onOpen prop; ClassicConnections + FreshCrew pass it through. removal_safe: false because HomeScreen imports PeerThread.',
};
