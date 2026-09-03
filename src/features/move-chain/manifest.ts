import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'move-chain',
  born: '2026-09-03',
  purpose:
    "The reusable mechanism behind 'Beat the HODL Machine' and any idea like it: an append-only, hash-linked chain of signed 'move' attestations rooted at a genesis, broadcast live over Nostr so anyone can watch it happen and verify it. A person places a rock and then buys and sells chunks; every move is a signed, ordered, tamper-evident record that walks all the way back to where the session started with no gap. It sits on the SAFE side of the attestation-vs-spend wall: a move expresses INTENT ('bought $250 of BTC at $70,000') and can never move a coin — it is an ordinary tapit-attest journal attestation, created and signed through the Wallet, chained on the library's own envelopeId, verified with the library's own verifyEnvelope. No new crypto is invented; different product ideas ride the same primitive by supplying their own move payload.",
  touches: [
    'src/features/move-chain/moveChain.ts',
    'src/features/move-chain/moveChain.test.ts',
    'src/features/move-chain/manifest.ts',
    'src/features/transport/moveChannel.ts',
    'src/features/transport/moveChannel.test.ts',
    'src/features-registry.ts',
  ],
  depends_on: ['transport'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    "Cut 1 (2026-09-03): the pure primitive + the public broadcast channel, no UI surface yet (the arena screen is a later cut, and until something imports these modules they add nothing to the bundle). moveChain.ts is PURE and fully tested (14 cases): buildMoveDraftInput shapes a move's DraftInput (chain metadata seq/prev live in the claim ALONGSIDE the idea's payload, nested under a `move` branch so a payload key can never collide, and both are covered by the signature); moveLink(att) = envelopeId(att) is the content address the next move chains on; readMoveMeta reads seq/prevHash/payload back; verifyMoveChain is all-or-nothing (every move validly signed BY ITS OWN SUBJECT IDENTITY so no one can claim another's chain, same owner as genesis, seq strictly 0,1,2…, prevHash === moveLink of the prior, genesis seq 0 / prev '') — a hole, reorder, edit, or identity-forgery all read invalid; orderMoves reassembles arrival-order into chain order. The broadcast channel is src/features/transport/moveChannel.ts on its OWN public wire kind MOVE_EVENT_KIND = 9584 (a sibling to envelope 9573 / liveness 9575 / sign-in 9582-9583) — UNENCRYPTED and unaddressed by design because a move is world-readable, the whole point being that a verifier anywhere can reassemble and check a chain. publishMove wraps a signed move as a Nostr event (content = the move JSON, tags = topic `t` + seq + the chain-root `e` on non-genesis moves) via buildEvent (key never leaves the wallet — signs through wallet.signDigest). subscribeMoves verifies the outer event, parses + assertWellFormed's the inner move, re-verifies the inner signature with verifyEnvelope, and BINDS the broadcaster to the author (the event pubkey must be a valid signer of the move it carries) so a relay or stranger cannot inject a move under a foreign name; every failure drops silently, dedup by event id. Tested (7 cases) against a fake Transport that records publishes and replays events — the whole channel logic is exercised EXCEPT the real relay websocket, which the sandbox can't reach: a live broadcast round-trip (watch the wallet's npub / the topic feed in a Nostr client) is owed on device. v1 binds a chain to one un-rotated identity (subject === a valid signer); honoring a mid-chain key rotation via the existing succession primitive is a later refinement. NOT built yet: the arena UI surface, and the genesis-of-chain wiring that ties a move chain to a donation/entry (the payment-genesis idea from the design chats) — this cut is the spine those ride.",
};
