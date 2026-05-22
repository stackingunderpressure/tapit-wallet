# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

## WHAT-CHANGED-RECENTLY

Phase 5c-i-β landed on the working branch as commit `5f65f3c`. That cut shipped the Nostr wire client in the wallet. Five new modules under `src/features/transport/` plus a one-function addition to tapit-attest:

- `tapit-attest/src/core/keys.ts` got `signDigest(digest, privateKey)` — a thin export that signs an arbitrary 32-byte digest with BIP340 Schnorr. The wallet uses it for Nostr event ids. Existing `signEnvelope` path unchanged.
- `src/features/transport/transport.ts` — the substrate-agnostic `Transport` interface (`publish`, `subscribe`, `close`).
- `src/features/transport/nostrEvent.ts` — NIP-01 event construction (`buildEvent`, `verifyEvent`) and the constant `TAPIT_ENVELOPE_KIND = 9573`.
- `src/features/transport/nostrTransport.ts` — minimal Nostr WebSocket client behind the interface. One socket per relay, auto-reconnect with exponential backoff (1s → 30s cap), REQ re-issue on reconnect, outbox flush, id-dedup across relays. `webSocketImpl` is injectable for tests.
- `src/features/transport/encryptedInbox.ts` — the high-level entry point. `sendEnvelopeTo` wraps a tapit-attest envelope in NIP-44 v2 ciphertext addressed to one recipient (recipient pubkey in a `p` tag) and publishes through the Transport. `subscribeInbox` verifies, decrypts, re-parses, drops anything tampered/mis-routed/junk silently. Uses the existing `cosigning/parseEnvelope` helper.
- `src/features/transport/defaultRelays.ts` — five widely-used public relays (`damus.io`, `nos.lol`, `snort.social`, `primal.net`, `nostr.wine`) so the wallet works out of the box; replaceable per D-11a.
- `src/features/transport/manifest.ts` and `src/features-registry.ts` — feature registered.
- `src/features/transport/transport.test.ts` — 10 tests covering sign/verify round-trip + tamper rejection, encrypted-inbox round-trip through a fake transport, tampered- and wrong-recipient drops, and Nostr wire-protocol frame shape via injected fake WebSocket.

All eight gates green in both packages: tapit-attest typecheck/lint/test (91/91, 4 skipped network-deps); wallet typecheck/lint/test (29/29) /build with bundle budgets clean. The transport feature tree-shakes out of the runtime bundle for now — no UI imports it yet. Pushed branch only.

## WHAT'S-PENDING

The transport stack is built and tested but not yet wired to any UI flow. The connections feature still only supports in-person handshakes and memberships through QR. Once the transport is wired up, an existing in-person flow can also travel async — that is 5c-i-γ.

NIP-44 interop verification against the upstream reference vectors is still outstanding (carried from last session). Should happen before 5c-i-γ ships, because that is when real messages start hitting real relays and being read by other wallets.

5c-ii (remote handshakes, Tier R), 5c-iii (connection sync), 5d, 5e, 5f all still queued.

## WHAT-TO-FLAG

One pre-existing flaky test in tapit-attest at `test/encryption.test.mjs:22` — the tampered-byte check replaces the first byte of the ciphertext with `"00"`, which is a no-op about 1/256 of the time. Not caused by this cut; it failed once and passed on retry. One-line fix when someone is in that file next: replace with a guaranteed-different value or XOR.

The Nostr event kind `9573` was picked because it is in the regular-events range (relays persist it, async delivery works) and not assigned to any major NIP. Worth socializing with the Nostr-tooling community or proposing a NIP before this ships to general users, to avoid a future collision dance. Today it is a swappable constant.

`current.json` at confidence 90. Uncertainty: the NostrTransport has not been pointed at a real public relay yet — wire-protocol shape verified via fake WebSocket, real-relay round-trip arrives with 5c-i-γ smoke test.

## RECOMMENDED-NEXT-MOVES

Either: (1) operator says "push to main" and `5f65f3c` (plus the prior 5c-i-α work waiting on the branch) lands on main; (2) operator dispatches 5c-i-γ and the next session wires the transport into the connections feature, adding a "send remotely" path to the handshake/membership modals and a top-level inbox subscription that routes incoming envelopes to the right cosign/absorb modal; (3) operator field-tests Phases 5a (handshake) and 5b (membership) with two devices.

Natural sequence is (1) → (2). The two-commit gap between branch and main is now `5c-i-α` (NIP-44) plus `5c-i-β` (transport) — both are pure additions, all gates green, low risk to land together.

## OPERATOR'S-CURRENT-VIBE

Last operator message: "Yes, continue on same as before. Cut the code." Tight, trust-the-rhythm authorization. The α/β slicing is paying off — each cut stays small enough to reason about end-to-end and walk through in opinions. Operator wants the network on; the path to it is one well-tested layer at a time. The next message can either bless main or dispatch the next cut; the working branch is clean and waiting.

## Ideas ready to revisit

Sign-in-with-existing-Nostr-account (logged previously). The natural moment to surface this is when 5c-i-γ adds user-visible "your Nostr identity" framing — at that point, giving rare power users the option to import a pre-existing keypair instead of generating a fresh one becomes a concrete UX choice rather than an abstract idea. Currently in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.

NIP-44 reference-vector verification — surface this once before 5c-i-γ ships, not as a blocker but as a piece of homework worth doing while the surface is still small.
