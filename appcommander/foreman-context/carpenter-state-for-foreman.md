# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

**Two-Carpenter workflow note:** Two parallel Claude sessions, main is the handshake point. `SessionStart` hook in `.claude/settings.json` validated again this session — confirmed no drift on entry, branch was current with main at 28f3238.

## WHAT-CHANGED-RECENTLY

Three substantial cuts this 2026-05-24 session, shipping the Phase 5e substrate without the ceremony state machine itself:

- **Cut 1 — Storage migration to v2 with K_data reuse** (`8ea9393`). New tapit-attest primitives `unwrapKData` + `reencryptRecoverableReuseKData` + `Wallet.exportRecoverableReuseKData`. `AnyEncryptedBlob` union flows through localStore + walletStore + remoteStore. createWallet writes v2 from day one; unlockWallet dispatches on `v`; saveWallet has three paths (fresh v2 / legacy v1 upgrade / v2 reuse). The reuse path is load-bearing: K_data stays stable across all future saves, so distributed shares stay valid forever.

- **Cut 2 — Recovery-share builders** (`806c45e`). `src/features/recovery/createShares.ts` exports `isRecoveryShare`, `readRecoveryShare`, `buildRecoveryShareEnvelope` (NIP-44 wraps share to peer), `buildRecoveryShares` (splits + builds N envelopes), `decryptHeldShare` (responder side), `holdRecoveryShare` (verify + hold + anchor on receive). Two new round-trip tests cover the full Shamir-split → encrypt-to-peer → peer-decrypts → combine loop.

- **Cut 3 — Distribute + receive routing** (`71c9dc6`). `DistributeSharesModal` launched from CohortEditorModal once a cohort exists. Walks N peers with live per-row status (pending / sending / sent / failed) using `summarizePublish` for uniform language. `InboxPanel` + `HomeScreen` route incoming recovery-share envelopes via new `recovery-share-receive` action; peer's wallet auto-routes the share to `holdRecoveryShare`.

D-03 stays loud across all three cuts: only K_data (32-byte symmetric data-encryption key) is ever split. The signing keypair is never touched.

Prior arc on main (from code-Carpenter and prior theory-Carpenter sessions):

- Phase 5c complete (5c-i α-λ, 5c-ii Tier R, 5c-iii-a delivery acks, 5c-iii-b multi-device sync).
- Phase 5d Tier V device-verified presence.
- Phase 5b-org full four-cut roadmap.
- Phase 5e-ii Shamir primitives.
- Phase 5e-iii-a cohort recording UI + credential.
- Phase 5e-iii-b backup format v2 (library half).
- Phase 5e-iii-b-2 library half (Wallet methods).
- Phase 5e-iv Lattice visualization.
- Verify-page polish for wife-test.
- Phase 5e + 5f roadmap briefs.

## Gates at session end

- typecheck ✓
- lint ✓
- test ✓ — wallet 38/38 (2 new round-trip tests this session); tapit-attest 146 total (142 pass + 4 skipped network; 2 new this session)
- build ✓ — clean, no unrecognized chunks

## WHAT'S-PENDING

1. **THE BIG PIECE — Phase 5e-v + 5e-vi + 5e-vii** (the recovery ceremony itself). All prerequisites now landed. Multi-round protocol-state-machine work:
   - **5e-v initiator**: new-device first-run detects cloud-blob-exists-but-no-local-wallet → offers recovery flow → operator types/confirms cohort pubkeys (they have no local cohort credential because no wallet) → wallet generates fresh keypair → broadcasts recovery-request envelopes to each cohort pubkey via Mycelium naming the new pubkey.
   - **5e-vi responder**: cohort peer receives recovery-request → modal opens with STRICT out-of-band verification gating ("have you verified by voice/video/in-person that this is really them?") → on confirm, peer's wallet looks up their held recovery-share for the matching subject, decrypts via `decryptHeldShare`, re-encrypts the raw share bytes to the new device's pubkey via `nip44EncryptTo`, sends back via Mycelium.
   - **5e-vii recovery-succession**: new device collects M share-response envelopes, combines via `combineShares`, decrypts the cloud v2 blob via `Wallet.restoreFromKData`, restores the full wallet, then requests M cohort peers co-sign a recovery-succession credential binding new key to old identity. Touches the existing `tapit-attest/src/core/succession.ts` primitive — third shape of the chain alongside self-rotation and dual-signed-transition.

2. **Latent bug — createCohort.readCohort reads `threshold` from a numeric leaf via leafValue (string-only), gets '', `Number('')` is 0, default-fallback of 3 masks it as the threshold silently resetting to 3 each time the cohort editor opens.** Fix is either (a) store threshold/totalShares as strings (matching the pattern in createShares.ts) or (b) add typed leafNumber helper to tapit-attest. Small follow-on, should land before the wife-test of recovery.

3. **Operator runs the wife-test of the polished /verify** — verify-page polish shipped at `530e946`.

4. **Operator field-tests the full 5c stack with two devices** against real Nostr relays.

5. **Operator field-tests Tier V presence** on a real device with real biometric + GPS.

6. **First end-to-end distribute test** — declare a cohort with two real devices via Mycelium, click Distribute, watch the share arrive at the peer device's inbox and become a held attestation.

### Strategic recommendations on the stack:

- A. Verify-page polish audit — DONE (`530e946`).
- B. Plain-English UX language audit — open.
- C. Nostr operational doctrine as post-hoc documentation — open.
- D. Supply-chain expansion decision — open.
- E. Interim peer-recovery story — superseded by 5e arc.
- F. Auto-anchor passive capture — open.
- G. First-pilot organization arc — operator's hands.
- H. Positioning principle — open.

## WHAT-TO-FLAG

**The substrate for the cascade is complete.** A wallet can declare a cohort, distribute shares, peers can hold their shares, and K_data stays stable across every save so the shares never silently age out. The ceremony itself remains.

**The K_data-stable property is load-bearing.** If saveWallet ever drifts away from `exportRecoverableReuseKData` on the v2-existing-blob path, every distributed share silently invalidates against the next blob and recovery breaks. This is the single most fragile invariant in the cascade. Worth a comment-pin and possibly a vitest that walks save twice and asserts K_data identity (didn't add in this session — flag for future).

**Latent bug in existing cohort code** — see WHAT'S-PENDING #2.

**DistributeSharesModal requires Mycelium transport enabled** — the existing sendEnvelope throws cleanly if not, but worth a note in the modal's empty-state prompt.

**Per-peer status is honest about Sent semantics** — "Sent" means a relay returned an OK frame, NOT that the recipient has accepted/decrypted/held. Consistent with the rest of the Send-via-Nostr surface.

## RECOMMENDED-NEXT-MOVES

1. **Fresh session for the ceremony** — Phase 5e-v + 5e-vi + 5e-vii bundled. Per operator directive: "we'll start a fresh one and knock out in one go."
2. **Small follow-on cut** to fix the latent threshold bug in createCohort before the wife-test of recovery.
3. **End-to-end distribute test** with two real devices once the operator has time.
4. **Field tests** (wife-test, two-device 5c, Tier V real device) increasingly load-bearing.
5. After the ceremony: **Phase 5f quorum org keys** per the `840ae02` brief.

## OPERATOR'S-CURRENT-VIBE

Meta-aware and momentum-protecting. Opened this session with "see where we are and let's cut" — clear directive to ground first, then ship. Hook fired, substrate landed in three layered cuts. The two-Carpenter workflow continues to produce one-Carpenter coherence; the SessionStart hook is now well-validated across multiple parallel-shipping scenarios.

The operator listens via TTS and copy-alls; verbose theory replies remain a real cost. Stay tight.

## Ideas ready to revisit

All prior entries hold. The supply-chain expansion decision is still open. The wife-test framing remains the highest-fidelity adoption signal at hand. The PreToolUse drift hook idea (belt-and-suspenders) is still a candidate. The branch-gate implementation idea is still on the stack.

- **NEW 2026-05-24 — K_data-stable property pin**: worth a comment + maybe a vitest that walks save twice and asserts K_data identity. Single most fragile invariant in the cascade.
- **NEW 2026-05-24 — typed leafNumber helper or string-leaves convention**: address the latent threshold bug in createCohort.readCohort and pin a project-wide convention for numeric leaves.

Full entries in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
