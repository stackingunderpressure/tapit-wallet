# carpenter-state-for-foreman — chat-arc through sub-cut 2b (thread UI shipped)

> PFOR-012 structured operational state. Written 2026-05-25 immediately after committing 1bcaeb1 on `claude/families-feature-review-8DbXs`. Aggregates the full chat-arc to date (brief + Cut 1 + sub-cut 2a + sub-cut 2b) against the main-state baseline left by the other Carpenter's Fresh roadmap Cut 7. Branch sits five commits ahead of `origin/main` awaiting merge.

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

**Two-Carpenter workflow note:** Two parallel Claude sessions, main is the handshake point. The `claude/wallet-implementation-questions-umXHh` arc shipped Fresh roadmap Cuts 1-5, 7-9 plus handshake-flow overhaul plus several bug fixes to main between 2026-05-24 morning and the close-out at `de5a797`. The `claude/families-feature-review-8DbXs` arc opened with an audit question, matured into the per-peer chat surface roadmap brief, then shipped Cut 1 (wire format), sub-cut 2a (relationship leaf), and sub-cut 2b (per-peer thread UI). The chat surface now has data layer + builder UX + thread destination — sub-cut 2c (promote-to-envelope) and Cut 4 (persistence) remain.

## WHAT-CHANGED-RECENTLY

**Per-peer chat arc, this branch (cumulative on top of `de5a797`):**

- `00a9027` Brief — per-peer chat surface + promote-to-envelope roadmap. Lives at `project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-24-per-peer-chat-surface-roadmap.md`. Ten sections; four phased cuts.
- `02e3493` Per-peer chat Cut 1 — TAPIT_CHAT_KIND + send/subscribe helpers. New event kind 9574 adjacent to envelope kind 9573. `sendChatMessageTo` + `subscribeChatMessages` mirror the envelope path; 7 round-trip tests in `transport.test.ts`.
- `8563b66` Per-peer chat sub-cut 2a — optional relationship leaf on handshakes. family / friend / coworker / acquaintance / other chip picker at both build-points in HandshakeModal; co-signer agreement surface in i-preview; chip rendered on ConnectionCard across both themes. 5 new tests in `createHandshake.test.ts`.
- `af0a042` Comms close-out for the rebase + sub-cut 2a session.
- `1bcaeb1` Per-peer chat sub-cut 2b — per-peer thread UI under People tab. New `messaging` feature folder (manifest + threadMessage + bubbleFormat + MessageBubble + MessageComposer + PeerThread). WalletContext gains `chatThreadsByPeer` + `sendChatMessage`. WalletProvider opens TAPIT_CHAT_KIND subscription alongside envelope inbox; optimistic local append on send. ConnectionCard / FreshCrew / ClassicConnections wire tap-to-open. PeopleTabBody extracted from HomeScreen to stay under 800-line hard limit. Bundle budgets +0.5KB each on WalletProvider + HomeScreen.

**Prior main-state baseline carried forward (from `de5a797`):** the other Carpenter's `claude/wallet-implementation-questions-umXHh` arc shipped Fresh roadmap Cuts 1, 2, 3, 4, 5, 7, 8, 9 to main plus the handshake-flow overhaul plus several bug fixes plus the Fresh default theme flip. Fresh young-adult-friendly skin structurally complete pending Sage Cut 6 voice authorship.

## Gates at session end

- typecheck ✓ clean
- lint ✓ clean (after extracting `formatBubbleHeader` into `bubbleFormat.ts` to satisfy react-refresh)
- test ✓ 60/60 (transport 24/24 from Cut 1; createHandshake 5/5 from sub-cut 2a; no new tests this cut)
- build ✓ clean in 4.34s; bundle budgets bumped on WalletProvider (8KB → 8.5KB) + HomeScreen (16KB → 16.5KB) with dated comments

File-size watch: `HomeScreen.tsx` 775 lines (extracted PeopleTabBody to stay under 800), `WalletProvider.tsx` 798 lines (TWO LINES BELOW the hard limit — next dispatch must plan extraction before touching it), `HandshakeModal.tsx` 685, `RecoveryInitiatorModal.tsx` 800 (at the limit), `FreshOnboarding.tsx` 751, `SettingsScreen.tsx` 750, `WalletGuide.tsx` 710.

## WHAT'S-PENDING

1. **Per-peer chat sub-cut 2c — promote-to-envelope (plus-menu + long-press).** Adds a `+` button in MessageComposer and long-press on MessageBubble that opens a menu with template targets: Save as journal entry, Mark presence with this person, Ask to witness an entry, Send cosign request, Share a held envelope, Disclose a proof of one leaf. Each target launches the existing modal pre-populated with the peer's pubkey and a quoted reference to the chat moment. Mostly wiring into existing modals via optional `prefill` props; lighter than 2b despite being the most visible-magic piece. Critical doctrine moment — the soft chat layer meets the deliberate-hand signed-life-history layer.

2. **Per-peer chat Cut 4 — local persistence + opt-in cloud backup.** New `storage/messagesStore.ts` keyed by `(ownerId, peerPubkey)`. `walletStore.ts` snapshot schema extension. Settings toggle "Include chat history in cloud backup" default OFF with inline explainer. First-time-thread-open modal surfacing the choice. Chat-attached media reuses existing `mediaStore`. Closes the chat arc.

3. **Messaging UI tests** — PeerThread render tests + the chat-thread integration test against a fake transport (mirror the `transport.test.ts` pattern). Flagged as a polish follow-on; not blocking sub-cut 2c.

4. **WalletProvider extraction** — file is at 798 lines, two below the 800 hard limit. The transport useEffect is the natural extraction target; pull it into its own hook (`useTransportConnection` or similar) so future cuts that touch the transport effect don't immediately trip the file-size test. Half a session.

5. **Fresh roadmap Cut 6 — Sage persona activation.** Carried forward from the other Carpenter's handoff. Blocked on operator-authored Sage voice. Until this lands the Fresh roadmap is at 8/9 cuts and the audience pilot has one structural blocker.

6. **Phase 5e-vii peer co-sign UI** — carried forward. Library shipped; self-signed half auto-emits on recovery. Remaining is RecoverySuccessionModal initiator + peer-side responder + envelope-route wiring.

7. **Rotation resilience cuts 2 + 3** — carried forward. Cut 1 shipped. Cuts 2 + 3 broadcast rotation announcements + handle share-refresh on receive.

8. **Document signing for medical/legal — hash-attestation flow** — carried forward.

9. **Birthday leaf on founding identity** — surfaced from Cut 7. Enables over-18 / over-21 Quick-share presets. No urgency unless audience pilot signals.

10. **Operator field tests still load-bearing.** /verify wife-test, Cut 7 share-card flow on real device, two-device 5c stack against real Nostr relays, two-device blended distribute + recovery, Tier V presence on a real device, first real-device key rotation walk, the new sub-cut 2a relationship-label flow, and now the sub-cut 2b per-peer thread flow.

11. **Latent items unchanged.** Wallet-side K_data integration test, cohort-peer key-rotation NIP-44 verification, HEIC/WebP re-encode, OTS fixture restoration, `Tap-it-Attest-main.zip` cleanup.

## WHAT-TO-FLAG

**WalletProvider is at 798 lines (two below hard limit).** Any future touch on this file must extract first. Natural target: the transport useEffect (lines ~250-380) lifted into `useTransportConnection.ts` as its own hook. Would also clean up the chatSubRef / statusUnsubRef / transportRef trio that currently lives in WalletProvider's top-level state.

**Sub-cut 2b ships no automated UI tests.** PeerThread render tests + the chat-thread end-to-end integration against a fake transport are the natural follow-on. Mirror `transport.test.ts`'s FakeTransport pattern. Half a cut.

**Chat surface usefulness depends on Mycelium being enabled.** Tier P in-person handshakes don't auto-route the chat-capable pubkey through the relay unless Mycelium is opted in via Settings. Operators field-testing should enable Mycelium first and confirm relay status is green before expecting the chat surface to feel alive. Worth surfacing in the explainer copy in a future polish cut.

**Bundle-budget bumps are real but small.** +0.5KB on each of WalletProvider and HomeScreen. The bumps absorb the chat state + subscription + the PeopleTabBody indirection. The HomeScreen overage was technically only 0.02KB but the budget check rejected; bumped to give modest headroom rather than land exactly at the line.

**The relationship chip from sub-cut 2a now shows up in three places** — ConnectionCard (in both themes), and PeerThread header. Recovery cohort picker is the natural next consumer (sort family chips first as default keyholder candidates); journal composer subject-picker can later surface family members as quick-pick subjects. Both are zero-new-crypto adds whenever the operator wants them.

## RECOMMENDED-NEXT-MOVES

In order of value-per-effort:

1. **Operator browser-verifies the just-landed Cut 2a + Cut 2b stack against live Netlify+Supabase.** Pick a Tier R peer, open a handshake with the relationship chip, confirm it lands; tap the resulting ConnectionCard, watch PeerThread open with the relationship chip in the header; send a chat message, watch it appear optimistically then settle with the eventId; on the other device, watch the message arrive in the thread.
2. **Per-peer chat sub-cut 2c — promote-to-envelope plus-menu and long-press.** The unlock that ties the soft chat surface back to the signed-life-history thesis. One full session.
3. **WalletProvider extraction (`useTransportConnection`).** Half a session. Unblocks future sub-cut 2c / Cut 4 / rotation-resilience cuts that touch the transport effect.
4. **Per-peer chat Cut 4 — local persistence + opt-in cloud backup.** Closes the chat arc.
5. **Messaging UI tests** — PeerThread + chat-integration. Polish.
6. **Sage Cut 6** — operator-authored voice → Carpenter persona activation. Unblocks the audience pilot.
7. **Carry-forward items.** Phase 5e-vii peer co-sign UI, rotation resilience 2+3, hash-attestation doc-signing, birthday leaf.

## OPERATOR'S-CURRENT-VIBE

Operator authorised the next cut with a minimal "Recenter and continue on" after the prior session's chat-arc close-out, trusting the Carpenter to read the room on the architecture call. The session shape was: ground against main → confirm no drift → cut sub-cut 2b → hit file-size + lint walls → extract PeopleTabBody + bubbleFormat → cut again → all gates green → push. Operator listens via TTS; one-block prose format respected throughout chat replies. Momentum mode — three chat-arc cuts shipped across two sessions, the People tab now functionally a place to talk to your people rather than a list of pubkeys. The visible-magic delta is real and field-testable as soon as the operator wants to walk it. The chat-arc has two more cuts (2c promote + 4 persist) to feel complete; Sage Cut 6 is a parallel arc the operator owns the authorship for.

## Ideas ready to revisit

All prior entries hold. New since the previous handoff:

- **2026-05-25 — Chat arc sub-cut 2c**: promote-to-envelope plus-menu + long-press. The deliberate-hand layer on top of today's soft chat layer. Critical doctrine moment — collapses friction between casual conversation and signed life-history.
- **2026-05-25 — Messaging UI tests**: PeerThread render tests + chat-thread integration against a fake transport. Mirror the existing transport.test.ts FakeTransport pattern. Half a cut.
- **2026-05-25 — useTransportConnection hook**: extract the transport useEffect from WalletProvider into its own hook before the next touch trips the 800-line hard limit. Pulls the chatSubRef / statusUnsubRef / transportRef trio with it.
- **2026-05-25 — Chat-surface Mycelium-on hint copy**: when the operator opens an empty thread and Mycelium is off, the empty-state explainer should name "Turn on Mycelium in Settings to start messaging" rather than just saying "no messages yet." Tiny polish; lands as part of sub-cut 2c or its own micro-cut.
- **2026-05-25 — Recovery cohort sane defaults via relationship leaf**: cohort editor sorts family chips first, friends second, treats coworkers / acquaintances as lower-trust pool. Zero new crypto. (Carried from prior; now twice as desirable since the relationship chip is a daily-visible element.)
- **2026-05-25 — Journal subject-picker family suggestions**: when the operator writes a journal entry, the subject picker reads the relationship leaves and suggests family chips at the top. Zero new crypto. (Carried; same elevation.)
