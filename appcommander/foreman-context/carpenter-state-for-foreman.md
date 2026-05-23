# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

**Two-Carpenter workflow note:** Two parallel Claude sessions, main is the handshake point. `SessionStart` hook in `.claude/settings.json` continues to catch drift cleanly across handoffs.

## WHAT-CHANGED-RECENTLY

Five cuts this 2026-05-24 session toward Phase 5e recovery ceremony. Substrate + responder half complete; initiator half remains for fresh session.

- **Cut 1 — Storage migration to v2 with K_data reuse** (`8ea9393`).
- **Cut 2 — Recovery-share builders** (`806c45e`).
- **Cut 3 — Distribute + receive routing** (`71c9dc6`).
- **Cut 4 — Recovery-request + share-response envelope helpers + end-to-end round-trip test** (`d894446`). The round-trip test walks the full ceremony in-process: operator encrypts blob, extracts K_data, builds shares, peers hold them, operator's keypair is dropped, ceremony Wallet builds request, three of five peers respond, ceremony combines + decryptRecoverableWithKData decrypts the original plaintext. Math of the cascade is proven before any UI ships.
- **Cut 5 — RecoveryResponderModal + inbox routing** (`1b089a5`). Strict out-of-band verification gating per brief decision 5; finds held share matching subject + share_for; builds + sends share-response via existing transport.

D-03 stays loud across all five cuts: only K_data is ever split. The signing keypair transfers authority ONLY through a peer-witnessed succession event the recovered wallet itself produces (5e-vii — remains for next session).

## Gates at session end

- typecheck ✓
- lint ✓
- test ✓ — wallet 40/40 (4 new tests this session including end-to-end ceremony round-trip); tapit-attest 146 total (142 pass + 4 skipped network; 2 new this session)
- build ✓ — clean, no unrecognized chunks

## WHAT'S-PENDING

1. **THE INITIATOR + COMBINE + SUCCESSION — Phase 5e-v + locked-screen wiring + restore + 5e-vii**. The heaviest remaining work.
   - **5e-v initiator**: RecoveryInitiatorModal that opens from UnlockPrompt via a new "Lost passphrase? Start recovery" link. Generates a ceremony Wallet locally. Spins up an EPHEMERAL NostrTransport tied to the ceremony pubkey using current prefs.nostrRelays — load-bearing architectural choice; the ceremony has no Supabase session so it cannot piggy-back on the operator's existing transport. Operator enters their old identity pubkey + cohort member pubkeys/names (no local cohort credential exists yet — they have to remember or look up out-of-band). Modal sends recovery-request envelopes to each cohort pubkey via the ephemeral transport.
   - **Combine + restore**: Ceremony pubkey's subscription receives share-response envelopes. UI shows per-responder progress (waiting / received / failed). Once M responses arrive, decryptShareResponse on each, combineShares to reconstruct K_data, then walletStore.load(ownerId) + Wallet.restoreFromKData(blob, kData) → restored Wallet.
   - **5e-vii recovery-succession**: meta-kind attestation built via tapit-attest's existing succession primitive (third shape of the chain — peer-witnessed alongside self-rotation and dual-signed-transition). Subject = old operator identity; leaves = previous_key, new_key (the freshly-restored wallet's keypair, NOT the ceremony keypair — the restored wallet IS the operator now), recovered_at, cohort_M_witnesses. M peers asked to co-sign via the existing co-sign machinery. Once M signatures collected, the succession event is held in the new wallet alongside the recovered snapshot.
   - **Save under new passphrase**: operator picks a new passphrase, restored wallet exports via exportRecoverable, walletStore.save with the new v2 blob, transition to unlocked state.

2. **Latent bug — createCohort.readCohort numeric leaf via leafValue returns 0; default-fallback masks** as threshold silently resetting on every cohort-editor open. Small follow-on cut. Doesn't affect the recovery ceremony (recovery-share envelopes already store numbers as strings) but does affect the cohort editor UX. Worth landing before the wife-test of recovery.

3. **K_data-stable invariant test** — assert across two serial saveWallet calls that the resulting blobs reuse the same K_data. Single most fragile property in the cascade; deserves a vitest.

4. **Operator runs the wife-test of /verify** — verify-page polish shipped at 530e946.

5. **Operator field-tests the full 5c stack with two devices** against real Nostr relays — also exercises the new distribute + responder flows.

6. **Operator field-tests Tier V presence** on a real device.

7. **First end-to-end distribute test with two devices**: declare cohort with peer's pubkey, click Distribute, watch the share arrive in peer's inbox, peer hits Hold share, peer's wallet now holds the recovery-share attestation. This is the smallest real-device demo that exercises Phase 5e end-to-end before the ceremony itself ships.

### Strategic recommendations on the stack:

- A. Verify-page polish audit — DONE (`530e946`).
- B. Plain-English UX language audit — open.
- C. Nostr operational doctrine as post-hoc documentation — open.
- D. Supply-chain expansion decision — open.
- E. Interim peer-recovery story — fully superseded now; Phase 5e is the recovery story.
- F. Auto-anchor passive capture — open.
- G. First-pilot organization arc — operator's hands.
- H. Positioning principle — open.

## WHAT-TO-FLAG

**The end-to-end round-trip test is the load-bearing proof the cascade works.** `createRecoveryRequest.test.ts` walks the full ceremony in-process and verifies plaintext recovery. Whatever else changes, that test must stay green.

**Ephemeral NostrTransport is the architectural choice the next session must make first.** The ceremony Wallet has no Supabase session and cannot piggy-back on the operator's existing transport. Cleanest: instantiate NostrTransport with the ceremony Wallet's keypair + current prefs.nostrRelays, subscribe to the ceremony pubkey, live for the modal duration, close on completion or abort. No persistent storage of the ceremony keypair anywhere.

**Strict verification gating in the responder modal is non-negotiable.** Real-device walk with a peer pretending to be a real responder is worth doing before the ceremony first runs in anger. The strict checkbox is the single most important UI element below the cryptography; the language has to land as serious-but-clear.

**The K_data-stable invariant is the single most fragile property in the cascade.** Worth a test that asserts identity across two serial saves before the next session adds anything else to saveWallet.

**The latent threshold bug in createCohort.readCohort** is small-but-real; default-fallback of 3 masks it as the threshold silently resetting on every cohort-editor reopen. Doesn't affect recovery directly because share envelopes store numbers as strings.

## RECOMMENDED-NEXT-MOVES

1. **Fresh session for the initiator + combine + succession** — heaviest remaining piece. Pre-decide the ephemeral-transport approach.
2. **Small follow-on cut** to fix the latent threshold bug in createCohort + add the K_data-stable invariant test.
3. **End-to-end distribute test** with two real devices.
4. **Field tests** (wife-test, two-device 5c, Tier V real device) remain load-bearing.
5. **After the ceremony**: Phase 5f quorum org keys per `840ae02`.

## OPERATOR'S-CURRENT-VIBE

Momentum-protecting, open-handed authorization. "See where we are and let's cut" → "Cont" — clear directive, broad trust, no chip-stalls. Five cuts shipped without overreaching into the heaviest work. The two-Carpenter workflow continues to produce one-Carpenter coherence across cleanly-bounded sessions.

The operator listens via TTS and copy-alls; keep replies tight.

## Ideas ready to revisit

All prior entries hold.

- **2026-05-24 — K_data-stable invariant test**: assert across two serial saves that the resulting blobs reuse the same K_data. Worth landing before the next save-path change.
- **2026-05-24 — typed leafNumber helper or string-leaves convention**: address the latent threshold bug in createCohort.readCohort, pin a project-wide convention for numeric leaves.
- **2026-05-24 — recovery-responder UX real-device walk**: the strict-verification checkbox is load-bearing; language deserves a peer-pretending-to-respond rehearsal.
- **2026-05-24 — ephemeral NostrTransport architectural decision**: pre-decide for the next session's initiator cut.

Full entries in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
