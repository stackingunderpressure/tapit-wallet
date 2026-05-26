import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'transport',
  born: '2026-05-22',
  purpose:
    'Phase 5c-i-β of the Mycelium peer network — the wire layer that lets two wallets exchange tapit-attest envelopes across distance through encrypted Nostr events (D-06, D-11). A Transport-agnostic interface (publish, subscribe, close) so the network substrate is swappable; a minimal Nostr WebSocket client behind that interface; an encrypted inbox that wraps each envelope in NIP-44 v2 ciphertext (recipient-addressed in a `p` tag) and unwraps incoming events back into typed Attestation objects. Relays only ever see ciphertext — the social graph is private (MYCELIUM_NETWORK_SPEC §9). Default relay set ships with the wallet and is replaceable by the user (D-11a). Tapit envelopes ride inside a custom event kind (TAPIT_ENVELOPE_KIND = 9573); NIP-46 stays reserved for the separate app-to-wallet sign pathway (D-11c). No UI wiring this cut — that lands with 5c-i-γ. Cut 1 of the per-peer chat surface roadmap (brief 2026-05-24-per-peer-chat-surface-roadmap.md) extends this feature with TAPIT_CHAT_KIND = 9574 plus sendChatMessageTo + subscribeChatMessages helpers that mirror the envelope path shape (same Schnorr signature, same NIP-44 v2 wrap, same recipient-addressed `p` tag) but carry a ChatPayload JSON object instead of a serialized Attestation — Tier 1 of the three-tier message taxonomy (signed + encrypted, not anchored, not an attestation). Promotion to a full envelope happens at the UI layer in later cuts.',
  touches: [
    'src/features/transport/transport.ts',
    'src/features/transport/nostrEvent.ts',
    'src/features/transport/nostrTransport.ts',
    'src/features/transport/encryptedInbox.ts',
    'src/features/transport/connectWallet.ts',
    'src/features/transport/defaultRelays.ts',
    'src/features/transport/InboxPanel.tsx',
    'src/features/transport/envelopeRoute.ts',
    'src/features/transport/envelopeRoute.test.ts',
    'src/features/transport/NostrIndicator.tsx',
  ],
  depends_on: ['cosigning', 'connections', 'wallet-core'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'The wallet key is reused as the Nostr identity (D-11d) — same x-only BIP340 pubkey, same Schnorr signature. The Wallet class exposes signDigest, nip44EncryptTo, and nip44DecryptFrom so this feature never sees the raw private key (D-03). encryptedInbox is the helper layer; connectWallet is the one-call entry point that opens a NostrTransport (or accepts an injected one for tests), subscribes the inbox, and returns a handle whose close() tears everything down. The Nostr WebSocket client auto-reconnects with exponential backoff and dedupes events by id across relays; persistent offline outbox + sync resume are deferred to 5c-iii. WalletProvider opens the transport on unlock when the operator has enabled the nostrTransportEnabled pref (default false — subscribing exposes the wallet pubkey to public relays), and InboxPanel renders incoming envelopes at the top of the People tab. 5c-i-ε added inbox routing: a one-signature handshake opens the CosignAsWitnessModal pre-loaded with the envelope; a two-signature handshake opens the AbsorbCosignModal pre-loaded. Memberships and other envelope kinds fall back to the Copy action until their auto-receive path lands. Phase 8 Phase E2 extends envelopeRoute with a `self-membership-receive` action that fires when an incoming envelope is a self-membership credential (isSelfMembership from createMembership.ts) — the joiner-side Phase E2 cut surfaces these as "Accept join request" rows so an org-host wallet routes them through the same dispatcher every other arrival uses. Phase 8 Phase E3 cut 1 (Option 3 hybrid substrate) replaced the placeholder acceptor behavior with structural join-policy gating: HomeScreen.acceptSelfMembership now passes the org wallet\'s own self-declaration + holdings into receiveSelfMembership, which runs the evaluateJoinPolicy helper from src/features/governance/ before holding the envelope. The routing surface itself did not change — InboxPanel still dispatches `self-membership-receive` via envelopeRoute exactly as it did in Phase E2; the gating happens downstream so the inbox-to-acceptor wire stays stable across phases. Cut 2 will layer the pending-roster buffer + roster-publication envelope on top without touching either layer. envelopeRoute.test.ts ships 5 dispatch tests asserting the routeFor verdict for self-membership, org-issued membership, single-signed Tier P handshake, counter-signed Tier P handshake, and a single-signed Tier R remote handshake — the dispatcher knows about every shape and a future addition cannot quietly steal a route from an earlier one. depends_on lists cosigning (encryptedInbox uses parseEnvelope; InboxPanel routes to the cosign modals), connections (the isHandshake / isSelfMembership predicates), and wallet-core (InboxPanel reads inbox state from WalletContext); removal_safe is false because HomeScreen imports InboxPanel.',
};
