# carpenter-state-for-foreman — chat-arc rebase + relationship leaf sub-cut 2a

> PFOR-012 structured operational state. Written 2026-05-24 immediately after committing 8563b66 on `claude/families-feature-review-8DbXs`. Aggregates the prior chat-arc session (brief + Cut 1) and this session (rebase onto main + sub-cut 2a) against the main-state baseline left by the other Carpenter's Fresh roadmap Cut 7.

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

**Two-Carpenter workflow note:** Two parallel Claude sessions, main is the handshake point. The `claude/wallet-implementation-questions-umXHh` arc shipped Fresh roadmap Cuts 1-5, 7-9 plus handshake-flow overhaul plus several bug fixes to main between 2026-05-24 earlier today and the close-out at `de5a797`. The `claude/families-feature-review-8DbXs` arc opened with an audit question that matured into the per-peer chat surface roadmap brief plus its Cut 1 wire-format scaffolding, then in this session rebased onto main and shipped sub-cut 2a (relationship leaf on handshakes). Branch is currently four commits ahead of `origin/main` (brief at `00a9027`, chat Cut 1 at `02e3493`, sub-cut 2a at `8563b66`, plus this comms close-out which is about to land).

## WHAT-CHANGED-RECENTLY

**Per-peer chat surface arc, this branch (`00a9027` → `02e3493` → `8563b66` + comms close-out)**

- `00a9027` Brief — per-peer chat surface + promote-to-envelope roadmap. Lives at `project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-24-per-peer-chat-surface-roadmap.md`. Ten sections; four phased cuts; locks the operator's four chip-question decisions; suggestions-not-orders format.
- `02e3493` Per-peer chat Cut 1 — TAPIT_CHAT_KIND + send/subscribe helpers. New event kind 9574 adjacent to TAPIT_ENVELOPE_KIND 9573. `sendChatMessageTo` + `subscribeChatMessages` in `encryptedInbox.ts` mirror the envelope path (Schnorr signature, NIP-44 v2 wrap, recipient `p` tag) but carry a `ChatPayload` JSON object instead of a serialized Attestation. `parseChatPayload` defensively drops non-JSON and shape-wrong payloads silently. 7 new round-trip tests; transport suite 17 → 24 tests. Wire-format scaffolding only; no UI.
- `8563b66` Per-peer chat sub-cut 2a — optional relationship leaf on handshakes. Folded brief section 7's sibling cut into the data layer and the existing HandshakeModal builder UX. Optional family / friend / coworker / acquaintance / other leaf chosen by the builder via a chip picker at both build-points (r-preview for in-person, not-here panel for remote initiator). Surfaced for explicit agreement to the co-signer in the i-preview step so both signatures cover the value. Rendered as a chip on ConnectionCard alongside the Tier P/R badge in both Classic and Fresh themes (FreshCrew renders ConnectionCard below its bubble row). Leaf omitted from envelope when unset for back-compat with older handshakes. 5 new tests in `createHandshake.test.ts`.

**Prior main-state baseline carried forward (from `de5a797`):**

The other Carpenter's `claude/wallet-implementation-questions-umXHh` arc shipped Fresh roadmap Cuts 1, 2, 3, 4, 5, 7, 8, 9 to main plus the handshake-flow overhaul plus several bug fixes plus the Fresh default theme flip. The Fresh young-adult-friendly skin is structurally complete pending Sage Cut 6 voice authorship. All details in their session's carpenter-state which my rebase reconciled against — see commit `322a40d` and the chain that followed it for the full enumeration. Their `WHAT'S-PENDING` carries forward.

## Gates at session end

- typecheck ✓ clean
- lint ✓ clean
- test ✓ 60/60 (transport 24/24 from Cut 1; 5 new createHandshake tests from sub-cut 2a)
- build ✓ clean — 4.09s build, bundle budgets not affected (sub-cut 2a is a small additive UI change inside existing components + a small data layer change)

File-size note: `HandshakeModal.tsx` grew from 559 → 685 lines with the RelationshipChips component + state + UI wiring. Still 115 lines below the 800-line hard limit. Future cuts that add UI to this modal should plan to extract the AccordionPanel + RelationshipChips helpers to their own file before crossing the limit.

## WHAT'S-PENDING

1. **Per-peer chat sub-cut 2b — per-peer thread UI under People tab.** The largest single piece of the chat arc by code volume, and it has an unresolved architecture call (in-memory state in WalletContext vs IDB-paged from a future messagesStore). New `messaging` feature folder + `manifest.ts`, `PeerThread.tsx` + `MessageBubble.tsx` + `MessageComposer.tsx` components, `HomeScreen.tsx` wiring so a tap on `ConnectionCard` (Classic) or a FreshCrew bubble (Fresh) opens the thread, `WalletProvider.tsx` extended to expose recent chat messages per peer. Thread header pins the relationship chip from sub-cut 2a from its first commit. Operator decision needed: in-memory vs IDB-paged. Recommend in-memory for 2b alone with refactor to IDB-paging when Cut 4 lands.

2. **Per-peer chat Cut 3 — promote-to-envelope (plus-menu + long-press).** Wiring from chat moments into the existing journal composer, MarkPresenceModal, CosignRequestModal, share-held-envelope flow, disclosure-proof flow via optional `prefill` props. Mostly wiring; lighter than 2b.

3. **Per-peer chat Cut 4 — local persistence + opt-in cloud backup.** New `storage/messagesStore.ts`, `walletStore.ts` snapshot schema extension, Settings toggle "Include chat history in cloud backup" default OFF with inline explainer, first-time-thread-open modal surfacing the choice. Chat-attached media reuses existing `mediaStore`.

4. **Fresh roadmap Cut 6 — Sage persona activation.** Carried forward from the other Carpenter's handoff. Blocked on operator-authored Sage voice (name, register, tone, personality). The brief flagged this as operator-mode authorship. Until this lands the Fresh roadmap is at 8/9 cuts and the audience pilot has one structural blocker.

5. **Phase 5e-vii peer co-sign UI** — carried forward. Library shipped earlier; self-signed half auto-emits on recovery. Remaining is RecoverySuccessionModal initiator + peer-side responder + envelope-route wiring.

6. **Rotation resilience cuts 2 + 3** — carried forward. Cut 1 shipped (auto-rebuild subscription on rotation). Cuts 2 + 3 broadcast rotation announcements + handle share-refresh on receive.

7. **Document signing for medical/legal — hash-attestation flow** — carried forward. Smallest first cut needs no new crypto.

8. **Birthday leaf on founding identity** — surfaced in the other Carpenter's handoff during Cut 7. Enables the over-18 / over-21 Quick-share presets. Optional structural change to the founding identity; new wallets only; existing wallets see "add birthday to enable this" placeholders. No urgency unless audience pilot signals age-verification as a top job.

9. **Operator field tests still load-bearing.** /verify wife-test, Cut 7 share-card flow on real device, two-device 5c stack against real Nostr relays, two-device blended distribute + recovery, Tier V presence on a real device, first real-device key rotation walk, and now the new Cut 2a relationship-label flow end-to-end.

10. **Latent items unchanged.** Wallet-side K_data integration test, cohort-peer key-rotation NIP-44 verification, HEIC/WebP re-encode, OTS fixture restoration, `Tap-it-Attest-main.zip` cleanup.

## WHAT-TO-FLAG

**Sub-cut 2b has an architecture decision the operator should make before code lands.** In-memory chat history in WalletContext is simple and fast but scales poorly past thousands of messages per peer. IDB-paged from a `messagesStore` scales cleanly but is more code and requires Cut 4 to land first. Recommended path is in-memory for 2b alone with refactor to IDB-paging when Cut 4 ships, but the operator should be the one to make the call.

**The chat-arc vs Sage-Cut-6 priority is a real fork.** With Fresh at 8/9 and the wallet described as ready for the young-adult-audience pilot pending Sage's voice, continuing the chat arc immediately means the pilot waits. Pausing the chat arc to ship Sage means the chat surface waits. Both are valid. The operator should name the priority before the next dispatch.

**Relationship picker is chip-only.** Five presets (family / friend / coworker / acquaintance / other). No free-text custom option. If the audience pilot signals the five labels feel too narrow (someone wants 'spouse' or 'sibling' or 'mentor' as their own chip), additive change: add a "Custom…" chip that reveals an input. Not urgent; flagging as a potential pilot-driven follow-on.

**File-size warning carries forward.** `HandshakeModal.tsx` is now 685 lines. `WalletProvider.tsx` is 689 (other Carpenter's growth). `HomeScreen.tsx` is 790. `FreshOnboarding.tsx` is 751. `SettingsScreen.tsx` is 750. The wallet has a lot of files within 100 lines of the 800-line hard limit; the next round of cuts to any of these files should plan extraction proactively.

**The relationship leaf is plumbing the rest of the wallet can lean on for free.** Recovery cohort picker can surface family chips first as default keyholder candidates. Journal composer's subject picker can suggest family members when you're writing about them. The chat thread header (Cut 2b) pins the relationship chip. All these are downstream affordances that get easier because the leaf exists; none required a new attestation kind or library change.

## RECOMMENDED-NEXT-MOVES

In order of value-per-effort, considering all live arcs:

1. **Operator decision on chat-arc vs Sage-Cut-6 priority + the sub-cut 2b architecture call.** Both are five-minute decisions. Cheap to ask, expensive to retrofit.
2. **If continuing the chat arc:** sub-cut 2b — per-peer thread UI under People tab. One full session.
3. **If pausing the chat arc:** Sage Cut 6 voice authorship from the operator, then a Carpenter dispatch to wire the dormant `src/features/persona` scaffolding as a context-aware nudge layer. Cut 6 brief lives in the Fresh roadmap brief's open-questions section.
4. **Operator browser-verifies the just-landed pieces against live Netlify+Supabase:** Cut 7 share-card flow (Settings → Appearance pick Fresh → Quick share → screenshot a card → paste URL into another tab → verifier turns green); and the new Cut 2a relationship-label flow (New handshake → pick a chip → confirm the chip persists on the resulting ConnectionCard).
5. **Per-peer chat Cut 3** — promote-to-envelope plus-menu and long-press. Half to one session.
6. **Per-peer chat Cut 4** — local persistence + opt-in cloud backup. Closes the chat arc.
7. **Carry-forward items** — Phase 5e-vii peer co-sign UI, rotation resilience 2+3, hash-attestation doc-signing, birthday leaf.

## OPERATOR'S-CURRENT-VIBE

Operator authorized Option B mid-truncation ("B yes add fix in") trusting the Carpenter to read the room. The cross-Carpenter drift was caught by the SessionStart hook and surfaced honestly before any action; the operator stayed engaged through the reconciliation and authorized the rebase + folded-fix cleanly. The session shape was: drift alert → ground against main → propose three options → operator picks B → rebase → cut sub-cut 2a → gates → comms close-out. Operator listens via TTS; one-block prose format respected throughout chat replies. Maximum-leverage-per-dispatch mode — the rebase + sub-cut 2a + comms close-out + handoff aggregation all landed inside one session by sizing the cut deliberately and punting sub-cut 2b honestly rather than overreaching. The wallet's structural complete-ness is becoming visible (Fresh 8/9, chat-arc 2/4 with 2a folded in, pre-pilot polish phase deepening); the question of where to spend the next dispatch is now squarely operator-mode.

## Ideas ready to revisit

All prior entries hold. New since the previous handoff:

- **2026-05-24 — Chat arc sub-cut 2b**: per-peer thread UI under People tab. In-memory state vs IDB-paged decision pending. PeerThread header pins relationship chip from sub-cut 2a.
- **2026-05-24 — Recovery cohort sane defaults via relationship leaf**: future cut. Cohort editor sorts family chips first, friends second, treats coworkers/acquaintances as lower-trust pool. Zero new crypto.
- **2026-05-24 — Journal subject-picker suggests family members**: future cut. When the operator writes a journal entry, the subject picker reads the relationship leaves and suggests the family chips at the top. Zero new crypto.
- **2026-05-24 — Custom-text relationship chip**: if audience pilot signals the five presets feel too narrow, add a Custom… chip that reveals a free-text input. Smallest additive cut.
- **2026-05-24 — Anchored chat (Tier 2 of chat taxonomy)**: one-toggle "Bitcoin-anchor this message" affordance. Lands as part of Cut 3 or its own micro-cut after Cut 4.
- **2026-05-24 — Share-an-existing-attestation-with-a-peer affordance**: inverse of inbox-receive path. Lives inside Cut 3's promote-menu.
