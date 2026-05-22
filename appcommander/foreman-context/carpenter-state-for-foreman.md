# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

## WHAT-CHANGED-RECENTLY

Phase 5c-i-γ landed on the working branch as commit `25be3ba`. That cut routed the entire peer-encryption + Nostr-event-signing surface through the Wallet object so the private key never crosses a module boundary (D-03), and turned that doctrine line from a docstring into a runtime guarantee.

Wallet class additions in `tapit-attest/src/core/wallet.ts`:
- `signDigest(digest)` — signs a 32-byte digest with the active key
- `nip44EncryptTo(plaintext, recipientPubkey)` — encrypts as this wallet to a peer
- `nip44DecryptFrom(payload, senderPubkey)` — decrypts from a peer to this wallet
- The `keypair` field was converted from TS-private to JS `#private` — true runtime encapsulation, unreachable from outside the class. All internal `this.keypair` accesses became `this.#keypair` (10 sites). No external caller was reading `wallet.keypair` (verified by grep before the change).

Transport feature refactored:
- `nostrEvent.ts`: `buildEvent` now takes a `sign: (digest) => string` callback instead of a raw private key. Pure function; no key handling inside the module.
- `encryptedInbox.ts`: `sendEnvelopeTo` and `subscribeInbox` now take a `Wallet` instead of pubkey+privkey string pairs.
- `connectWallet.ts` (new) — the one-call entry point: takes a Wallet + onEnvelope handler, opens a NostrTransport (or accepts an injected Transport for tests), subscribes the inbox, returns a handle whose `close()` tears the whole thing down.
- `transport.test.ts`: updated to the new API; added 2 connectWallet tests.

Tapit-attest gained `test/wallet-peer.test.mjs` with 6 tests: signDigest round-trip, signDigest length validation, NIP-44 wallet-to-wallet round-trip, third-party MAC failure, wrong-sender MAC failure, and the runtime-private-keypair check (the one that surfaced the TS-private gap).

All eight gates green in both packages: tapit-attest typecheck/lint/test (97/97, 4 skipped network-deps); wallet typecheck/lint/test (31/31)/build with bundle budgets clean. Pushed branch only.

## WHAT'S-PENDING

NIP-44 reference-vector cross-check — still outstanding from the previous two sessions. Becomes more urgent now because 5c-i-δ is the cut after which real encrypted messages start going to real public relays.

5c-i-δ is the next cut: wire `connectWallet` into `WalletProvider` behind an operator opt-in toggle, expose inbox envelopes via `WalletContext`, surface them in the UI (likely as a People-tab notification or an absorb-modal route). Needs: a new `nostrTransportEnabled` pref (default false), a settings toggle, the WalletProvider lifecycle hook (mirror the anchorWorker pattern), and an inbox-state slot in context.

5c-ii (remote handshakes Tier R), 5c-iii (connection sync), 5d, 5e, 5f all still queued.

## WHAT-TO-FLAG

Two things to keep in mind.

First, the same `tapit-attest/test/encryption.test.mjs:22` flake (1/256 chance the first ciphertext byte is `0x00` and the corruption is a no-op) is still in the suite. Not in scope this cut. One-line fix when someone is next in that file.

Second, by deferring the `WalletProvider` wiring to 5c-i-δ, the wallet still does NOT open any Nostr connections on unlock. Until the operator turns on a settings toggle in the next cut, the wallet's pubkey is never broadcast to a public relay. That is the right posture for shipping in the meantime — no privacy regression yet — but it means 5a/5b field-testing remains in-person-only until 5c-i-δ lands.

`current.json` at confidence 92. Uncertainty: real-relay round-trip evidence still pending (will arrive once the operator opts the next cut into actual network traffic).

## RECOMMENDED-NEXT-MOVES

Either: (1) operator says "push to main" and the three pending 5c-i commits (α/β/γ) land together — they form a coherent slice; (2) operator dispatches 5c-i-δ and the next session wires the transport into WalletProvider behind a settings toggle, exposing the inbox to the UI; (3) operator field-tests Phases 5a (handshake) and 5b (membership) with two devices to stress the existing in-person flows.

Natural sequence is (1) → (2). The three-commit gap to main is now meaningful surface area but each cut is independently safe and tested.

## OPERATOR'S-CURRENT-VIBE

Last operator message: "Yes build on." Maximum momentum, minimum ceremony. The α/β/γ rhythm is paying off — each cut lands clean, the next is teed up. The grounding gate caught a real D-03 gap this turn (the TS-private vs JS-private distinction) and pulled the fix into scope; that is exactly the kind of thing the gate exists for, and worth noting because it means the gate is working as designed.

## Ideas ready to revisit

Sign-in-with-existing-Nostr-account — surface this when 5c-i-δ adds user-visible "your Nostr identity" framing. Currently in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.

NIP-44 reference-vector verification — still on the homework list; recommend doing it before 5c-i-δ ships, not after.

Wallet as a hardware-backed object (secure element / passkey-derived key) — implicit in the architecture now that the Wallet class is the single owner of the keypair surface. The interface is ready for it; the implementation is the part that catches up. Not actionable today, but worth keeping on the long horizon as the doctrine that the Wallet class hides its keys from everything (including the calling code) makes a future hardware backend a swap, not a rewrite.
