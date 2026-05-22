import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'transport',
  born: '2026-05-22',
  purpose:
    'Phase 5c-i-β of the Mycelium peer network — the wire layer that lets two wallets exchange tapit-attest envelopes across distance through encrypted Nostr events (D-06, D-11). A Transport-agnostic interface (publish, subscribe, close) so the network substrate is swappable; a minimal Nostr WebSocket client behind that interface; an encrypted inbox that wraps each envelope in NIP-44 v2 ciphertext (recipient-addressed in a `p` tag) and unwraps incoming events back into typed Attestation objects. Relays only ever see ciphertext — the social graph is private (MYCELIUM_NETWORK_SPEC §9). Default relay set ships with the wallet and is replaceable by the user (D-11a). Tapit envelopes ride inside a custom event kind (TAPIT_ENVELOPE_KIND = 9573); NIP-46 stays reserved for the separate app-to-wallet sign pathway (D-11c). No UI wiring this cut — that lands with 5c-i-γ.',
  touches: [
    'src/features/transport/transport.ts',
    'src/features/transport/nostrEvent.ts',
    'src/features/transport/nostrTransport.ts',
    'src/features/transport/encryptedInbox.ts',
    'src/features/transport/connectWallet.ts',
    'src/features/transport/defaultRelays.ts',
    'src/features/transport/InboxPanel.tsx',
  ],
  depends_on: ['cosigning', 'wallet-core'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'The wallet key is reused as the Nostr identity (D-11d) — same x-only BIP340 pubkey, same Schnorr signature. The Wallet class exposes signDigest, nip44EncryptTo, and nip44DecryptFrom so this feature never sees the raw private key (D-03). encryptedInbox is the helper layer; connectWallet is the one-call entry point that opens a NostrTransport (or accepts an injected one for tests), subscribes the inbox, and returns a handle whose close() tears everything down. The Nostr WebSocket client auto-reconnects with exponential backoff and dedupes events by id across relays; persistent offline outbox + sync resume are deferred to 5c-iii. WalletProvider opens the transport on unlock when the operator has enabled the nostrTransportEnabled pref (default false — subscribing exposes the wallet pubkey to public relays), and InboxPanel renders incoming envelopes at the top of the People tab. depends_on lists cosigning (encryptedInbox uses its parseEnvelope helper) and wallet-core (InboxPanel reads inbox state from WalletContext); removal_safe is false because HomeScreen imports InboxPanel.',
};
