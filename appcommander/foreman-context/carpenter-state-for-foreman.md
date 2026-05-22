# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

## WHAT-CHANGED-RECENTLY

Phase 5c-i-δ landed on the working branch as commit `2679e13`. That cut closed the 5c-i slice — the wallet now talks to the Nostr network on operator opt-in.

Concrete changes:
- `src/features/storage/prefsStore.ts` — Prefs interface gained `nostrTransportEnabled: boolean`; DEFAULT_PREFS sets it to `false`. Default-off because subscribing exposes the wallet pubkey to public relays.
- `src/features/wallet-core/WalletContext.ts` — `WalletContextValue` exposes `inboxEnvelopes: InboxEnvelope[]` and `dismissInboxEnvelope: (eventId) => void`.
- `src/features/wallet-core/WalletProvider.tsx` — new `useEffect` that mirrors the anchorWorker lifecycle: opens `connectWallet` when (a) phase is unlocked/needs-identity AND (b) pref is true. Dedupes incoming envelopes by event id. Cleanup tears down on lock/disable. `connectWallet` is dynamically imported so users who never opt in pay zero bytes for the transport stack.
- `src/features/settings/SettingsScreen.tsx` — new "Mycelium network" section above local-backup with a toggle and a privacy-explainer paragraph.
- `src/features/transport/InboxPanel.tsx` (new) — renders a list of incoming envelopes at the top of the People tab; each row has Copy (puts envelope JSON on clipboard) and Dismiss (drops it from context). No auto-routing yet — that's the next cut.
- `src/features/wallet-core/HomeScreen.tsx` — pulls `inboxEnvelopes` + `dismissInboxEnvelope` from context; mounts InboxPanel as the first child of the People tab section.
- `src/features/transport/manifest.ts` — touches updated; `wallet-core` added to depends_on; `removal_safe` flipped to false (HomeScreen now imports InboxPanel).
- `scripts/bundle-budget.mjs` — named two new code-split chunks: `transport (Mycelium opt-in)` at 5 KB gz cap (current ~1.6 KB) and `parseEnvelope helper` at 800 B gz cap (current ~0.3 KB).

All eight gates green: tapit-attest typecheck/lint/test (97/97 with 4 skipped network-deps); wallet typecheck/lint/test (31/31)/build with bundle budgets clean. Pushed branch only.

## WHAT'S-PENDING

Branch is now four commits ahead of main with the full 5c-i slice: α (NIP-44 primitive), β (wire client), γ (Wallet wire-up), δ (UI + opt-in). All four are pure additions, each gated, each independently safe. Ready to land on main together when the operator says the word.

5c-i-ε is the next sub-cut: auto-route incoming envelopes to the matching modal based on attestation kind / signature state (cosign-as-witness for an envelope needing a counter-signature, absorb-cosign for an envelope with new signatures to merge, membership-receive for a credential envelope). That removes the manual copy-and-paste step from today's InboxPanel.

NIP-44 reference-vector verification — most urgent open item. Recommend before the operator runs a two-device field test, because that's the first cross-implementation interop check the toggle being on actually enables. Fifteen-minute job; the upstream vectors live in the NIP-44 spec repo.

5c-ii (remote handshakes, Tier R), 5c-iii (connection sync), 5d, 5e, 5f all still queued behind the wiring above.

## WHAT-TO-FLAG

Two things.

The WalletProvider chunk is at 5.33 KB gz against a 5.5 KB budget. Tight, intentional — the transport effect added net code even with the dynamic import. Any further additions to WalletProvider almost certainly need their own dynamic import or the budget needs a documented bump.

The pre-existing tapit-attest `encryption.test.mjs:22` flake (1/256 chance the corrupt byte equals the original) is still in the suite — unrelated to this cut, but it lives in shared territory and a future Carpenter passing through that file should fix it. One-line change.

`current.json` at confidence 88. Uncertainty: WebSocket reconnect logic is unit-tested via injected fakes, not against live relays; real-relay behavior arrives with the first two-device field test the operator runs.

## RECOMMENDED-NEXT-MOVES

Either: (1) operator says "push to main" and the full 5c-i slice (four commits) lands together; (2) operator dispatches 5c-i-ε and the next session adds auto-routing to InboxPanel; (3) operator runs a NIP-44 reference-vector check before any real-relay testing; (4) operator field-tests by enabling the toggle on two devices in different rooms and verifying envelopes flow.

Natural sequence is (1) → (3) → (2) — land the slice on main so it stops being branch-divergent, run the interop check so the next field test has confidence, then add auto-routing so the UX stops requiring manual copy-paste. (4) becomes possible after (3); the toggle works today but the interop check is the prerequisite for trusting cross-implementation messages.

## OPERATOR'S-CURRENT-VIBE

Last operator message: "Yes, if you have a clear line of site continue on." Quietly authoritative. They are letting the rhythm run and pulling the brake only if I lose direction. The 5c-i slice landed four cuts in a row with no operator intervention required — each cut staying small enough that the grounding-gate hook does its job and the gate cycle catches what regression there is. The cadence is the thing the operator built when they asked for the grounding gate to exist; it is doing what it was designed to do.

## Ideas ready to revisit

Sign-in-with-existing-Nostr-account — the natural surface for this is now visible: the Settings screen has a Mycelium-network section, and if a user is going to flip that toggle, they should also be able to import an existing Nostr identity instead of starting fresh. Worth surfacing when 5c-ii (remote handshakes) lands and identity-import becomes a more concrete UX question. Currently in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.

NIP-44 reference-vector verification — still the most urgent open item.

Wallet as a hardware-backed object (secure element / passkey-derived key) — the architecture is ready. The Wallet class now owns the keypair as a JS #private field, exposes only signing and encrypting methods, and the transport feature consumes those methods without ever touching the key. The day a hardware backend lands, it slots in behind the same Wallet interface and nothing above it changes. Not actionable today; worth keeping in mind because the door is already cut for it.

InboxPanel manual-paste UX — the panel currently relies on the operator copying envelope JSON and pasting into the matching modal. 5c-i-ε removes that step. If 5c-i-ε slips for any reason, consider adding an inline hint naming which modal each envelope kind belongs in.
