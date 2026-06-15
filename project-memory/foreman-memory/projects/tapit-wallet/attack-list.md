# Tapit — Attack List (build backlog, ranked) — 2026-06-06

*Operator: "make an attack list and let's cut some things." Ranked by
value-to-size and dependency order, grounded in what's actually BUILT vs
SPECCED. The operator is field-testing the human/splitting loop in parallel.
Cut top-down; re-rank as field results come in.*

## Built foundation (shipped — the floor we cut on top of)
"Your secrets" dashboard (Shamir split/combine + magic marker, templates,
ledger, chat/share-sheet/copy/QR distribution + tagging, opt-in keep-a-copy
re-send) · recovery cohort (splits K_data not the seed; full ceremony) ·
journal/capture/camera/anchoring/messaging/single-key orgs.

## ATTACK ORDER

1. ✅ DONE (febb280) **Teaching layer — education cut 1**. leak-vs-loss
   gut-check + live in-the-moment threshold explainer in the secrets create
   flow (secretLiteracy.ts, jargon-guarded). The loss-only no-split PATH is the
   deferred cut 2.
2. ✅ DONE (7b9ecd4) **Per-piece hash commitments**. SecretRecord.hashes
   (SHA-256 per piece, stored regardless — safe metadata); pieceIndexForToken +
   a "Check a returned piece" tool in SecretDetail verify a returned piece
   without rebuilding. Cheap enabler for the retrieval/swap arc.
3. **Part B-1 — held/recognized pieces** [MEDIUM] ← NEXT. A sent piece becomes a
   recognized held object on the receiver side (keep/decline), reusing the
   recovery held-share + inbox routing. First real step toward the
   social-custody network + heartbeat liveness.
4. **Conditional-release v1** [MEDIUM-BIG]. Consensus-release flow (circle
   agrees to release a secret to a claimant) from the 2026-06-04 brief.
5. **Collections + proof bundles cut 1** [MEDIUM]. Curated collections of
   journal moments + multi-entry verifiable share. From the 2026-06-05 brief.
6. **Capture cut 2** [MEDIUM · SW infra]. POST share-target so photos shared
   IN from other apps reach Capture (Tier 1b).
7. **Fix the latent test flakes** [SMALL · hygiene]. TWO distinct intermittents,
   both pass in isolation, both surface only in the full suite: (a) the
   identity-gate canonicalization one (order-dependent shared-global pollution);
   (b) transport.test.ts "chat-message round-trip … Alice to Bob" (NIP-17
   gift-wrap — likely randomness-flavored: ephemeral keys / randomized
   timestamps, a different root cause than (a)). Root both out so green is honest.

## Blocked / north-star (do NOT attack yet — no foundation)
Everything Bitcoin: tapscript vaults, timelocks, FROST threshold-signing,
covenants, on-chain anything (no Bitcoin layer exists — Satoshi's biggest
unbuilt block). Depends-on chains: Part B-2 heartbeat → needs B-1; Part D
handshake holding-slot → needs B; Part E social-sig + decoys → needs B/D;
E-Bitcoin timelocked-tapscript-leaf → needs the Bitcoin layer + ideally FROST.

## Honest standing note
Design has run ahead of build this arc (8 briefs, 1 shipped cut today). The
load-bearing UNVALIDATED assumption is human reliability — real people holding
a real piece and returning it over time. The operator is field-testing that;
the build should stay small and real until those results come back. Mission:
smallest useful version correctly.

## Messaging audit — 2026-06-15 (verified against code, not just an agent claim)

**CONFIRMED GAP [HIGH when triggered · rare trigger] — peer key rotation breaks
chat attribution.** tapit-attest HAS the succession machinery
(createSuccessionLink / verifySuccessionChain in core/succession.ts), but it is
NOT wired through messaging end to end:
- A rotating peer never SENDS their succession proof to peers. RotateKeySection
  signs the succession link locally; its own copy admits "your peers do not know
  you rotated until you tell them" — no sendEnvelope to known peers.
- inboxEnvelopeHandler ingests NO peer succession — the wallet holds no map of
  a peer's new-key→old-identity.
- useChatTransport files incoming chat under the RAW item.senderPubkey
  (useChatTransport.ts:70,74,79) with zero rotation resolution; PeerThread opens
  only handshake-keyed threads. So a peer who rotates and messages from the new
  key lands in chatThreadsByPeer[newKey], a thread the UI never opens →
  effectively invisible. The operator opens the old thread, sees nothing, thinks
  they were ignored. Low frequency (rotation is a recovery/compromise event) but
  real, and exactly the scenario the operator asked about.

WHAT IS SOLID (verified): the RECEIVE side of MY OWN rotation is correct — the
chat subscription filters on my keyHistory and decrypt uses nip44DecryptFromAnyKey
across retired keys (encryptedInbox.ts + nip17.ts), tested in encryptedInbox.test.
NIP-17 three-layer wrap, MAC-failure silent-drop, event-id dedup, self-CC
multi-device sync, relay-replay handling all correct + tested. Send-fail rips the
optimistic bubble out honestly.

FIX PATH (a real multi-part feature, not a one-liner — needs operator scope call):
1. Rotation announcement: on Wallet.rotate(), send a succession envelope to known
   peers (or include the succession link in the first message after rotation).
2. Receive-side ingest: inboxEnvelopeHandler verifies + holds peer succession,
   building a peer keyAlias map (every key a peer has used → canonical peer id).
3. Messaging resolution: useChatTransport resolves incoming senderPubkey through
   the keyAlias map and files into the existing thread; send path addresses the
   peer's CURRENT key.
4. Thread merge on load (useChatPersistence) so historical split threads reunite.
INTERIM SAFETY (smaller, but has a spam tradeoff): surface messages from
unknown/unresolved senders instead of silently filing them — but without
succession we can't tell a rotated friend from a stranger, so blanket surfacing
opens a spam vector. The succession-verified fix (above) is the right one.

**Flake note update:** attack-list item 7 flake (a), the identity-gate
canonicalization intermittent, was ROOT-CAUSED + FIXED 2026-06-15 (pinnable
designated_at; commit on main). Flake (b), the NIP-17 chat round-trip
intermittent, is STILL latent and worth rooting out (ephemeral-key / timestamp
randomness in the test).
