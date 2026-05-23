# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

**Two-Carpenter workflow note:** Two parallel Claude sessions, main is the handshake point. `SessionStart` hook in `.claude/settings.json` continues to catch drift cleanly across handoffs.

## WHAT-CHANGED-RECENTLY

Six feature cuts shipped 2026-05-23 across two logical sessions (the second extension authorized by the operator with "go until session_ended"). First half: Phase 5e-v ceremony initiator. Second half: the blended-recovery arc the operator named in their own words — "you go on the journey to get back your identity, all physical if need be" — Mycelium and in-person blended in both distribution and ceremony, threshold accumulates from any mix.

**Phase 5e-v ceremony cuts:**

- **Cut 1 — `encryptRecoverableWithKData` library primitive** (`57bd569`). Plus Wallet method, 8 new tests including the cascade-survives-recovery invariant. Fills the gap between `encryptRecoverable` (mints fresh K_data) and `reencryptRecoverableReuseKData` (needs OLD passphrase).
- **Cut 2 — RecoveryInitiatorModal + locked-screen entry** (`fa55c57`). 9-phase state machine, ephemeral NostrTransport, combine + restore + save-under-new-passphrase + onRecovered transition.
- **Cut 3 — Latent threshold-leaf bug fix in createCohort** (`8547175`). `readNumberLeaf` helper accepts both string and number leaves; publishCohort writes strings going forward. 3 regression tests.

**Blended-recovery arc cuts:**

- **Cut 4 — Blended distribute** (`eaadcde`). Per-peer transport choice in DistributeSharesModal: each row offers "Send via Nostr" or "Show QR (in person)." Extracted `routeFor` from InboxPanel into shared `envelopeRoute.ts`. New `ScanEnvelopeModal` (camera → parseEnvelope → routeFor → dispatch via the same handler InboxPanel uses). HomeScreen gains a "Scan envelope" button next to handshake. Same signed envelope ships through either transport.
- **Cut 5 — Blended ceremony halves** (`56938e5`). Responder modal grows "Release in person" alternative — builds share-response locally and renders as QR for the recovering operator to scan. Initiator modal extracts `absorbShareResponse` helper used by both Mycelium inbox callback and new QR scan path; "Scan a share-response" button visible in sending+awaiting phases. Peer-who-responded-in-person-only gets added to the journey board automatically.
- **Cut 6 — Blended request side** (`73db6cc`). RecoveryInitiatorModal stores the signed recovery-request envelope in state when beginSending builds it; "Show request QR" button renders it for any peer the operator visits in person. Mycelium publish runs in parallel — both paths coexist.

D-03 stays loud across all six cuts: only K_data is touched, signing keypair never split, recovery transfers authority through restored snapshot only.

## Gates at session end

- typecheck ✓
- lint ✓
- test ✓ — wallet 43/43 (3 new tests in Cut 3); tapit-attest 154 total (150 pass + 4 skipped network; 8 new in Cut 1)
- build ✓ — clean; RecoveryInitiatorModal 5.12 KB gz vs 6 KB budget, RecoveryResponderModal 2.32 KB gz, ScanEnvelopeModal 1.21 KB gz, all under budget

## WHAT'S-PENDING

1. **Phase 5e-vii — peer-witnessed recovery-succession event.** The third shape of the succession chain (alongside self-rotation and dual-signed-transition). After the restored wallet is in the operator's hands, M peers from the cohort co-sign a meta-kind attestation asserting "we cooperated in restoring identity X to device Y on date Z." Two new envelope shapes (cosign-request + cosign-response) parallel to the recovery-request/share-response pair already in `createRecoveryRequest.ts`. A new `RecoverySuccessionModal` that opens after `onRecovered` lands. Recommendation: Mycelium-pushed via the ephemeral-transport pattern Cut 2 established AND the QR alternative per the blended-recovery doctrine Cut 4-6 established — i.e. M peer co-signatures should accept the same blend, so the operator can collect succession signatures from peers who happened to be online OR from peers they visit in person. Genuinely its own session.

2. **Paper-K_data export — the lazy-operator's last resort.** The operator explicitly named this in 2026-05-23: "backups are the right answer but we are trying to help the lazy with great ux. Nothing fills that gap all the way." A "Show me my recovery key" surface in Settings → Local backup that exposes K_data (or a Shamir-split of K_data) as something the operator can write down on paper. Matching "type my recovery key back in" import on the lock screen so recovery from paper works without any cohort or any network. This unconditionally closes the gap for operators who do one small thing (write down a single key once); pairs with the blended cohort cascade for operators who do nothing. Recommendation: ship paper-K_data as a follow-on after 5e-vii so the operator can run a real-device walk that exercises both paths — cohort recovery AND paper recovery — and pick which one survives the wife-test.

3. **Wallet-side K_data-stable integration test.** Library-side covered (Cut 1's "exportRecoverableWithKData saves under a fresh passphrase while preserving K_data" plus the existing "exportRecoverableReuseKData keeps K_data stable across saves"). The wallet-side concern is `src/features/wallet-core/saveWallet.ts`'s 4-line dispatch — does it correctly route to path-3 when the existing blob is v2? Testing requires either adopting fake-indexeddb or vi.mock. Not blocking, but flagged.

4. **Real-device walk of the full blended flow.** The blended path lands at every gate but has only been vitest-built, not browser-walked. The first real walk should include one Nostr peer and one in-person peer at distribution time AND at recovery time, covering all four blend cells. Especially valuable: the in-person responder's "Release in person" QR display next to a recovering operator scanning it — that's the moment the slime metaphor becomes literal.

5. **Operator field-tests of the rest of the stack** — wife-test of /verify, two-device 5c stack, Tier V real device — all unchanged.

### Strategic recommendations on the stack:

- A. Verify-page polish audit — DONE (`530e946`).
- B. Plain-English UX language audit — open.
- C. Nostr operational doctrine as post-hoc documentation — open.
- D. Supply-chain expansion decision — open.
- E. Interim peer-recovery story — superseded; Phase 5e shipped through the blended initiator side now.
- F. Auto-anchor passive capture — open.
- G. First-pilot organization arc — operator's hands.
- H. Positioning principle — open.

## WHAT-TO-FLAG

**The blended-recovery arc is shipped but the journey-board UX could go deeper.** Today the per-peer rows in RecoveryInitiatorModal's awaiting phase show state (queued / sending / sent / received / send-failed / response-error) without distinguishing which transport carried the response or which transport the operator chose for the request. A richer journey board would show, per peer: "Alice — sent via Nostr 8:42pm — share received via Nostr 8:44pm" or "Bob — visited 9:15pm — share received in person 9:17pm." The current minimal version works (the threshold accumulates correctly regardless) but the operator framing was explicitly "you go on the journey," which deserves UI that narrates the journey. Worth landing alongside or after the real-device walk.

**ScanEnvelopeModal dispatches via the shared envelopeRoute and inherits its routing.** Any future envelope kind that the wallet wants to auto-route from BOTH Mycelium and in-person scans gets the in-person path for free as long as a new `routeFor` clause is added to `envelopeRoute.ts`. This is the seam the operator's blended-everything vision relies on — keep new envelope kinds going through this routing rather than building parallel dispatchers.

**Cohort-peer key rotation may break the in-person share-response decrypt.** Same concern flagged in the previous handoff for the Mycelium path applies to the QR path: the recovery-share envelope was NIP-44-encrypted to the peer's pubkey-at-distribution-time, and `decryptHeldShare` uses the peer's active keypair via `nip44DecryptFrom`. If the peer rotated, the share may fail to decrypt in either transport path. Worth verifying against the actual nip44 module surface before the wife-test; if rotation IS a problem, document it in the cohort-editor copy so peers know not to rotate without re-distributing.

**The "Show request QR" path can be shown to anyone, not just listed cohort members.** That's by design — the responder filter is `view.ownerId === requestView.oldIdentity && view.shareFor === wallet.identity`, so a stranger scanning the request just gets "no held share" and nothing leaks. But the operator should still be aware that the recovery-request envelope contains their old identity pubkey, their name, and their optional message — all of which is plaintext in the QR. If they're showing it to a stranger by accident, that information is visible. Worth a tiny note in the QR-display copy if the operator chooses to walk the recovery in a public place.

**Phase 5e-vii deserves the same blended treatment as 5e-v.** The peer-witnessed succession event is M co-signatures from cohort peers, which is structurally similar to the M share-responses the ceremony already collects. The same routing infrastructure (ephemeral transport plus QR alternative) should carry. Pre-decision for the next session: don't build a Mycelium-only succession flow and then have to re-add the QR path; design both transports from the first cut.

## RECOMMENDED-NEXT-MOVES

1. **Fresh session for Phase 5e-vii** — the peer-witnessed recovery-succession event. Two new envelope shapes (cosign-request + cosign-response), a RecoverySuccessionModal that opens after onRecovered lands and walks M peers through co-signing. Mycelium-pushed AND QR-pushed from the first cut, matching the blended doctrine.
2. **Paper-K_data export** as a follow-on or interleaved cut. Settings → Local backup → "Show me my recovery key" surface plus matching lock-screen import. Closes the lazy-operator gap unconditionally for anyone who writes down a single key.
3. **Real-device walk of the full blended flow** with two peers (one Nostr, one in-person). The first real-device proof that the journey UX actually feels like a journey.
4. **Journey-board polish** — per-peer transport-aware status surface in RecoveryInitiatorModal. Make the "you go on the journey" framing visible in the UI.
5. **Wallet-side K_data-stable integration test** and the rest of the smaller follow-ons remain on the queue.

## OPERATOR'S-CURRENT-VIBE

Direct-cut authorization with a vision-protecting redirect. Two sessions today: first half opened with "the big ceremony signing of the slime, they saved it dedicated just for you" and shipped Phase 5e-v end-to-end through the initiator side. Second half — when the closeout was already committed — the operator asked deep architectural questions ("walk me through the slime process," "what about save-info-on-phone offline-only") and arrived at the blended vision: "you go on the journey to get back your identity, all physical if need be." Said "Yes" to the proposed architecture and "Start now + go until session_ended" when asked about scope. Three more cuts shipped on top of the close-out. Seven commits this branch this calendar day, six of them feature cuts. The operator's framing "we are trying to help the lazy with great ux" stays the polestar — the blended path closes the gap meaningfully but not absolutely, and paper-K_data is the natural complement for the next session. Listens via TTS and copy-alls; keep replies tight.

## Ideas ready to revisit

All prior entries hold.

- **2026-05-23 — paper-K_data export**: the lazy-operator last resort. Settings exposure + lock-screen import. Pairs with the cohort cascade — operators who do nothing get the cohort path; operators who do one small thing get an unconditional fallback.
- **2026-05-23 — journey-board UX**: per-peer transport-aware status in RecoveryInitiatorModal. Make "you go on the journey" visible in the surface.
- **2026-05-23 — 5e-vii peer-witnessed succession with blended transport**: design Mycelium AND QR from the first cut, not Mycelium-only-then-retrofit.
- **2026-05-23 — cohort-peer key-rotation invariant verification**: walk through the nip44 module's handling of rotated keys against held envelopes before the wife-test. If rotation breaks decrypt, surface it in cohort-editor copy.
- **2026-05-24 — typed leafNumber helper or string-leaves convention**: addressed for the cohort credential, but a project-wide audit of numeric leaves might surface similar landmines elsewhere.
- **2026-05-24 — recovery-responder UX real-device walk**: pairs with the initiator walk. The blended path now means BOTH halves of BOTH transports need walking — four cells total.

Full entries in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
