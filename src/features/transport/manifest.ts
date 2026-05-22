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
    'src/features/transport/defaultRelays.ts',
  ],
  depends_on: ['cosigning'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    'The wallet key is reused as the Nostr identity (D-11d) — same x-only BIP340 pubkey, same Schnorr signature. Signing a Nostr event id uses signDigest from tapit-attest so the wallet never re-implements crypto. encryptedInbox is the only entry point the rest of the wallet should call; it owns the NIP-44 wrap/unwrap and re-parses the inner envelope through the existing cosigning/parseEnvelope helper. The Nostr WebSocket client auto-reconnects with exponential backoff and dedupes events by id across relays; persistent offline outbox + sync resume are deferred to 5c-iii. depends_on lists cosigning because encryptedInbox imports its parseEnvelope helper.',
};
