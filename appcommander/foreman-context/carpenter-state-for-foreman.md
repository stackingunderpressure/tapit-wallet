# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

**Two-Carpenter workflow note:** Two parallel Claude sessions, main is the handshake point. `SessionStart` hook in `.claude/settings.json` continues to catch drift cleanly across handoffs.

## WHAT-CHANGED-RECENTLY

Three cuts this 2026-05-23 session shipping Phase 5e-v — the recovery initiator on the new device. The slime is real in code end-to-end through the initiator side. Phase 5e-vii (peer-witnessed recovery-succession event) remains for a fresh session.

- **Cut 1 — Library primitive `encryptRecoverableWithKData`** (`57bd569`). Fills the gap between `encryptRecoverable` (mints fresh K_data, would invalidate cohort shares) and `reencryptRecoverableReuseKData` (requires the OLD passphrase). Takes a known K_data + new passphrase, returns a fresh v2 blob: same K_data the cohort has shares of, passphrase-wrap for the new passphrase. Plus `Wallet.exportRecoverableWithKData(kData, passphrase)` calling the primitive against `this.snapshot()`. 8 new tapit-attest tests including the cascade-survives-recovery invariant.
- **Cut 2 — RecoveryInitiatorModal + locked-screen entry point** (`fa55c57`). `UnlockPrompt` gains a "Lost passphrase? Start recovery" link that React.lazy-loads the modal. Modal generates a fresh ceremony Wallet on mount and opens an ephemeral NostrTransport via `connectWallet` (dynamic import keeps the Mycelium WS client out of the lock-screen bundle). State machine: configuring → sending (publishes N recovery-requests, per-peer status) → awaiting (inbox subscription on ceremony pubkey, decryptShareResponse on each) → combining → restoring (`Wallet.restoreFromKData` against the cloud blob) → naming (new-passphrase prompt) → saving (`exportRecoverableWithKData` preserves K_data; `walletStore.save` under new pass) → done. `WalletProvider.onRecovered(wallet, passphrase)` lands into the unlocked phase. Modal chunk 4.16KB gz vs 6KB budget.
- **Cut 3 — Latent threshold-leaf bug in createCohort** (`8547175`). `leafValue` returned strings only, so threshold + total_shares stored as numeric leaves read as `''` → `Number('') || 0` → 0 → default-fallback to 3 in the editor, silently resetting the operator's chosen threshold on every reopen. `publishCohort` now writes both as strings (matching `createShares.ts`); `readCohort` uses a new `readNumberLeaf` helper that handles BOTH conventions so any pre-fix cohort already anchored still reads correctly. 3 regression tests.

D-03 stays loud across all three cuts: only K_data is touched, signing keypair never split, recovery transfers authority through restored snapshot only.

## Gates at session end

- typecheck ✓
- lint ✓
- test ✓ — wallet 43/43 (3 new tests this session); tapit-attest 154 total (150 pass + 4 skipped network; 8 new this session)
- build ✓ — clean, RecoveryInitiatorModal 4.16KB gz, all budgets respected

## WHAT'S-PENDING

1. **Phase 5e-vii — peer-witnessed recovery-succession event.** The third shape of the succession chain (alongside self-rotation and dual-signed-transition). After the restored wallet is in the operator's hands (which Cut 2 already delivers), M peers from the cohort co-sign a meta-kind attestation asserting "we cooperated in restoring identity X to device Y on date Z." Subject = old operator identity; leaves = previous_key, new_key (the restored wallet's keypair — same as previous because `restoreFromKData` reconstitutes the original keypair from the snapshot; the rotation-after-restore is a separate forward-secrecy concern), recovered_at, cohort_M_witnesses. M peers asked to co-sign via either the existing `CosignRequestModal` paste-flow pattern OR a new Mycelium-pushed variant that builds on the ephemeral-transport pattern Cut 2 established. The Mycelium-pushed variant is the better UX (peers who just responded with their share are now in the cohort, the restored wallet already knows their pubkeys, no out-of-band paste needed) but requires two new envelope shapes (cosign-request, cosign-response) and a new responder modal. Genuinely its own session.

2. **Wallet-side K_data-stable invariant test.** The library-side property is locked at `tapit-attest/test/wallet-recoverable.test.mjs` ("exportRecoverableReuseKData keeps K_data stable across saves" + Cut 1's "exportRecoverableWithKData saves under a fresh passphrase while preserving K_data"). The wallet-side concern is `src/features/wallet-core/saveWallet.ts`'s 4-line dispatch — does it correctly route to path-3 (`exportRecoverableReuseKData`) when the existing blob is v2? Testing this requires either adding `fake-indexeddb` as a dev dependency (no existing usage in the codebase) or setting up `vi.mock` patterns (also no existing usage). Honest read: library coverage is the practical floor and the dispatch is small enough to inspect, so this flag deserves consideration but is not blocking the wife-test of recovery.

3. **End-to-end real-device test of the full ceremony.** Cut 2 wires everything but has only been gate-tested in vitest. The first real-device walk through the initiator modal — with a real peer running the responder side over Mycelium relays — is the load-bearing UX validation. Worth doing before any further UX polish so the language + state-machine transitions are tested by actual hands.

4. **Operator runs the wife-test of /verify** — verify-page polish shipped at `530e946`.

5. **First end-to-end distribute test with two devices** — declare cohort, click Distribute, watch the share arrive in peer's inbox, peer hits Hold share, peer's wallet now holds the recovery-share attestation. The smallest real-device demo that exercises Phase 5e end-to-end before the ceremony itself runs in anger.

6. **Operator field-tests Tier V presence** on a real device.

### Strategic recommendations on the stack:

- A. Verify-page polish audit — DONE (`530e946`).
- B. Plain-English UX language audit — open.
- C. Nostr operational doctrine as post-hoc documentation — open.
- D. Supply-chain expansion decision — open.
- E. Interim peer-recovery story — fully superseded; Phase 5e shipped through the initiator side now.
- F. Auto-anchor passive capture — open.
- G. First-pilot organization arc — operator's hands.
- H. Positioning principle — open.

## WHAT-TO-FLAG

**The ceremony's UI choreography is now untested-in-browser.** The initiator modal lands cleanly at every gate, but the state machine has not been driven by a real operator's hands through a real Mycelium round-trip yet. The vitest round-trip in `createRecoveryRequest.test.ts` covers the math — operator forgets keypair, ceremony Wallet builds request, three of five peers respond, ceremony combines + decryptRecoverableWithKData decrypts. The UI layer — form validation, per-peer progress surface, new-passphrase prompt, transition into unlocked — needs a real-device walk before mass usage. Especially the threshold-not-yet-met awaiting state, where the operator is staring at a screen waiting for peer responses to arrive over Mycelium relays and might benefit from explicit "in case your peers can't reach you" guidance.

**The ephemeral transport's relay-set fallback is silent.** Cut 2's modal uses `prefs.nostrRelays` if non-empty, otherwise lets `connectWallet` fall back to `DEFAULT_RELAYS`. An operator who never opted into Mycelium will hit the default-relay path with no signal that they're using the defaults rather than their own list. Worth a small surfacing note in the modal — "Using default Mycelium relays since none are configured" — before the wife-test.

**The 5e-vii peer-witnessed succession is the last remaining Phase 5e piece and is its own multi-modal flow.** The peers who responded with shares are not automatically prompted to co-sign the succession event today. The restored wallet just lands in the unlocked phase; the operator can immediately use it, but there's no peer-witnessed attestation in the holdings asserting "the recovery happened." For Phase 5e to be fully spec-complete per MYCELIUM_NETWORK_SPEC.md §12 ("M peers co-sign a recovery-succession event"), the next session must build this. The cleanest landing: a `RecoverySuccessionModal` that opens immediately after `onRecovered` lands, asks the operator to confirm and ship a `cosign-request` envelope to each cohort responder, listens for `cosign-response` envelopes back, accumulates M signatures, holds the resulting meta-kind attestation. Two new envelope shapes parallel to the recovery-request/share-response pair already in `createRecoveryRequest.ts`.

**The `encryptRecoverableWithKData` library primitive is the new save-side seam.** Any future cut that touches the save path must be aware of this third dispatch case — fresh-v2 (encryptRecoverable), v2-reuse (exportRecoverableReuseKData), and v2-from-recovery (exportRecoverableWithKData). The third case is currently called only from `RecoveryInitiatorModal.saveUnderNewPassphrase`. If any other recovery seam emerges, route through this same primitive to preserve K_data.

## RECOMMENDED-NEXT-MOVES

1. **Fresh session for Phase 5e-vii** — the peer-witnessed recovery-succession event. Pre-decide the Mycelium-pushed-vs-paste-flow architecture before cutting; recommendation is Mycelium-pushed since the ephemeral-transport pattern from Cut 2 generalizes cleanly and the peers are already in the cohort.
2. **Operator runs the first real-device walk of the initiator modal** with a willing peer running the responder side. Capture rough edges in the state-machine transitions, the language, and the relay-set fallback signal.
3. **Wallet-side K_data-stable integration test** — either adopt fake-indexeddb or use vi.mock, pick one and document the pattern.
4. **Field tests** (wife-test of /verify, two-device 5c stack, Tier V real device, two-device distribute) remain load-bearing.
5. **After the ceremony's fully shipped:** Phase 5f quorum org keys per `840ae02`.

## OPERATOR'S-CURRENT-VIBE

Momentum-protecting, direct-cut authorization. "Fire up align and cut if it's clear and ask me anything if not" → "the big ceremony signing of the slime, they saved it dedicated just for you" → an in-session lag-correction redirect → "continue cutting last message was a lag." Three cuts shipped without over-reaching into the heaviest remaining piece (5e-vii). The two-Carpenter workflow continued to produce one-Carpenter coherence across cleanly-bounded sessions; this session inherited the substrate from 2026-05-24 and shipped the initiator side directly on top of it. The operator listens via TTS and copy-alls; keep replies tight.

## Ideas ready to revisit

All prior entries hold.

- **2026-05-23 — RecoveryInitiatorModal real-device walk**: the state-machine transitions and the per-peer progress surface deserve a peer-pretending-to-respond rehearsal before the ceremony first runs in anger. The strict-verification UI on the responder side (shipped last session) is load-bearing on that walk too.
- **2026-05-23 — Mycelium-pushed succession event**: leverage the ephemeral-transport pattern from Cut 2 for the 5e-vii co-signature collection rather than a paste-flow. Peers are already in the cohort and the restored wallet knows their pubkeys.
- **2026-05-23 — relay-set fallback signal**: small UX surfacing in the initiator modal when `prefs.nostrRelays` is empty and the ceremony falls back to defaults. Worth landing before the wife-test.
- **2026-05-24 — typed leafNumber helper or string-leaves convention**: addressed for the cohort credential this session, but a project-wide audit of numeric leaves (membership credentials, custody chains, etc.) might surface similar landmines.
- **2026-05-24 — recovery-responder UX real-device walk**: pairs with the initiator walk above. Both halves of the ceremony deserve a peer-pretending-to-respond rehearsal.

Full entries in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
