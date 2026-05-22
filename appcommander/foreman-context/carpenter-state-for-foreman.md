# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

## WHAT-CHANGED-RECENTLY

Phase 5c-i-α landed on the working branch as commit 1338264. That cut added the NIP-44 v2 peer-encryption primitive to tapit-attest at `tapit-attest/src/core/nip44.ts` with thirteen spec-shaped tests at `tapit-attest/test/nip44.test.mjs` and a re-export from `tapit-attest/src/index.ts`. No new dependencies — uses only the audited `@noble` primitives already in tapit-attest deps (`secp256k1`, `chacha20`, `hmac`, `hkdf extract/expand`, `sha256`). All eight gates green: tapit-attest typecheck, lint, 91/91 tests; wallet typecheck, lint, 19/19 tests, build with bundle budgets all under ceiling. Pushed branch only — NOT pushed to main (operator did not say the word for this cut).

The two functions exported are `encryptTo(plaintext, recipientPubkey, senderPrivkey)` and `decryptFrom(payload, senderPubkey, recipientPrivkey)`. Both accept x-only hex pubkeys (the BIP340 form tapit-attest already uses everywhere) and lift them with the `0x02` prefix internally for ECDH. Decryption throws on MAC failure with a constant-time compare. Payload is base64 of `version(1) || nonce(32) || ciphertext || mac(32)`.

The Phase 5c decisions session (D-11) immediately before this turn resolved the four open design questions in the Phase 5c sketch: default-replaceable relays, in-person handshake bootstraps the remote channel, custom encrypted Nostr event kinds carry the tapit-attest envelope, and the wallet's secp256k1 key is reused as the Nostr identity. Those decisions are why the encryption primitive looks the way it does — same key, x-only form, NIP-44 v2 envelope.

## WHAT'S-PENDING

The primitive needs interop verification against the upstream NIP-44 v2 reference test vectors before the wallet ships encrypted messages to non-Tapit Nostr clients. The test file notes this explicitly. The round-trip and tamper tests verify internal consistency; the reference vectors verify byte-for-byte interop with the wider Nostr ecosystem.

Phase 5c-i-β is the next cut and is a wallet cut, not a library cut. A transport-agnostic interface (`Transport` type with `publish`, `subscribe`, `close`) plus a minimal Nostr-WS implementation behind that interface; an encrypted-event-kind constant; the send/receive glue that wraps a tapit-attest envelope in NIP-44 ciphertext on the way out and unwraps on the way in. That cut is where the wallet stops being a single-device app.

5c-ii (remote handshakes), 5c-iii (connection sync), 5d, 5e, 5f are queued after.

## WHAT-TO-FLAG

Nothing surprising in the working tree. The branch is clean and ahead of `origin/claude/compare-library-wallet-OW5FF` by zero (just pushed). Main is at `4aabae2` (the sign-in-with-existing-Nostr-account idea log) — this commit `1338264` is one commit ahead of main on the branch and has not been merged. If the operator wants this on main, they need to say so and I will push branch → main.

The grounding-gate hook in `.claude/settings.json` is committed and active. It is firing on every dispatch.

## RECOMMENDED-NEXT-MOVES

Either: (1) operator says "push to main" and this commit lands on main alongside the previous Phase 5c work; (2) operator dispatches 5c-i-β and the next session opens the wallet wire client (minimal Nostr WebSocket + transport-agnostic interface + send/receive using `encryptTo`/`decryptFrom`); (3) operator field-tests Phase 5a (handshake) and 5b (membership) with two devices now that the local handshake flow is wired and shipped.

The natural sequence is (1) → (2). Pushing to main keeps branch and main in sync, which is the pattern since `e21c3b8`. Then cutting 5c-i-β next session gets the wallet onto Nostr, which is the milestone the operator is chasing.

## OPERATOR'S-CURRENT-VIBE

Last operator message: "Yes, I want to go with your recommended version and I think it's beautiful and I think you did a great job grounding and I'm ready for five CI in your manner." High momentum, high trust, gave room to cut the work in isolation. The operator framed 5c-i as the cut to make and trusted the judgment on how to slice it (the α/β split — library primitive first, wire client second — was my call inside that authorization). They want the network on, but they also recognized that the right way to get there is one well-tested primitive at a time. The session is ready to land cleanly and hand the next decision back.

## Ideas ready to revisit

Sign-in-with-existing-Nostr-account (logged in the previous session). The operator mentioned this as a thought during the 5c-i greenlight: rare power users may already have a Nostr identity, and giving them the option to sign into the wallet with that existing keypair would let them inherit their pre-existing reputation rather than starting fresh. Worth surfacing when the Nostr wire client lands (5c-i-β or 5c-ii) since that is when the "this is your Nostr identity" framing becomes user-visible. Currently logged in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
