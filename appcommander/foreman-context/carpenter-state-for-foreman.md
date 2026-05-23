# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

**Two-Carpenter workflow note:** The operator runs two parallel Claude sessions — one cutting code, one in theory conversation — each on its own branch. Main is the canonical handshake point. The `SessionStart` hook in `.claude/settings.json` (scripts/session-start-grounding.mjs) catches drift at every session entry. **Validated this session: hook fired on a 12-commit drift, this Carpenter grounded against actual main and picked up cleanly where the code-Carpenter left off.**

## WHAT-CHANGED-RECENTLY

Two cuts this session (2026-05-24, both on branch `claude/wallet-implementation-questions-umXHh`, both green at every gate):

- **Phase 5e-iii-b-2 (library half)** at commit `2ecaf4d` — Wallet.exportRecoverable, Wallet.restoreRecoverable, Wallet.restoreFromKData bridge the v2 backup format (shipped at the library level in 5e-iii-b) to the Wallet class lifecycle. Six new tapit-attest tests including end-to-end Shamir-split → combineShares → restoreFromKData. D-03 stays loud: only the symmetric K_data is ever split, never the signing keypair.

- **Phase 5e-iv** at commit `b976169` — Lattice tab as fifth top-level tab on HomeScreen. Read-only aggregation of handshakes (by tier P/R), organizations the wallet holds memberships in, and the recovery cohort with M-of-N. Pure data extraction in src/features/recovery/lattice.ts; view in LatticePanel.tsx; React.lazy-loaded. Three new bundle-budget entries (LatticePanel, CohortEditorModal, createCohort helpers — the latter two were previously unrecognized chunks).

Prior arc from the code-Carpenter (all on main):

- **Phase 5c** complete (5c-i α-λ, 5c-ii Tier R, 5c-iii-a delivery acks, 5c-iii-b multi-device sync).
- **Phase 5d** Tier V device-verified presence (`939ee51`).
- **Phase 5e-ii** Shamir primitives in tapit-attest (`c8852b3`).
- **Phase 5e-iii-a** recovery-cohort recording UI + credential (`34ad1a8`).
- **Phase 5e-iii-b** recoverable backup format v2 in tapit-attest (`84ebbc2`).
- **Phase 5b-org** full four-cut roadmap (`fcd1d55`).
- **Verify-page polish** for the wife-test (`530e946`).
- **Phase 5f roadmap brief** (`840ae02`) and **Phase 5e roadmap brief** (`d40afdb`).

## Gates at session end

- typecheck ✓
- lint ✓
- test ✓ — wallet 36/36; tapit-attest 144 total (140 pass + 4 skipped network-deps; 6 new this session)
- build ✓ — clean, no unrecognized chunks

## WHAT'S-PENDING

1. **THE BIG PIECE — Phase 5e-v (initiator) + 5e-vi (responder) + 5e-vii (recovery-succession event).** Operator directive: "we'll start a fresh one and knock out in one go." Multi-round protocol-state-machine work, the heaviest single cut in Phase 5e. Prerequisites all landed except:
   - **Storage migration to v2** — saveWallet.ts still calls Wallet.exportEncrypted (v1). For recovery to work, the wallet has to write v2 blobs at every save going forward. Migration is small (saveWallet.ts one-line change, walletStore.ts type union, WalletProvider.tsx unlock-path branch on `v`), but lives on the storage hot path. Bundle it with share distribution in the ceremony session.
   - **Share distribution flow** — after cohort declaration (5e-iii-a) and v2 storage (above), the wallet splits K_data via splitSecret (5e-ii), encrypts each share to its cohort member's pubkey using NIP-44 (the existing encryptedInbox.ts pattern), sends via Mycelium transport, and the peer's wallet auto-routes the incoming share to a "hold-recovery-share" action.
2. **Operator runs the wife-test of the polished /verify** — verify-page polish shipped at `530e946`, ready for the test.
3. **Operator field-tests the full 5c stack with two devices** against real Nostr relays.
4. **Operator field-tests Tier V presence** on a real device with real biometric + GPS.
5. **Brief refinement: harmonize Phase 5e brief's load-bearing constraint with decision #3 model (a)** — the two are mutually inconsistent as written. Model (a) is the right read (peers hold encrypted-to-them share blobs forever, decrypt only at recovery, re-encrypt to new pubkey); the load-bearing-constraint paragraph reads as if it forbids that but actually doesn't — it forbids pre-stashed access to the CURRENT signing key, which model (a) does NOT do. One paragraph of refinement.

### Strategic recommendations on the stack (from prior theory walk):

- A. Verify-page polish audit — DONE (`530e946`).
- B. Plain-English UX language audit — open.
- C. Nostr operational doctrine as post-hoc documentation — open.
- D. Supply-chain expansion decision — open.
- E. Interim peer-recovery story — superseded by 5e arc (will land at end of 5e).
- F. Auto-anchor passive capture — open.
- G. First-pilot organization arc — operator's hands.
- H. Positioning principle (substrate underneath existing behavior) — open.

## WHAT-TO-FLAG

**Cross-Carpenter handoff worked clean this session.** The SessionStart hook caught the 12-commit drift, this Carpenter grounded against actual main rather than the stale PLAN.md, identified the next cuts off the brief's sequence, settled chips from brief recommendations, and shipped two clean cuts without stalling on you for chip answers. This is the protocol working as designed.

**Five tabs at 375px is the visual maximum.** Lattice fits but tight. If a future cut adds a sixth tab, the right move is probably merging People into Lattice (since Lattice already includes the handshake list with richer per-row context) rather than continuing to add.

**Phase 5e brief has an internal inconsistency** about share distribution timing (load-bearing constraint vs decision #3 model (a)). The 5e-iii-b commit message takes the correct model-(a) interpretation but the brief should be refined to harmonize before 5e-v code lands.

**No source-code touched in transport, storage, or sign flows this session** — both cuts are additive. The big piece (ceremony) will be the first cut that touches the transport layer for share distribution.

## RECOMMENDED-NEXT-MOVES

1. **Fresh session for the big piece** — Phase 5e-v + 5e-vi + 5e-vii bundled with the storage-to-v2 migration and the share-distribution flow. Per operator directive: "we'll start a fresh one and knock out in one go."
2. **One-paragraph brief refinement** before that fresh session lands — harmonize the 5e brief's constraint and decision #3 model (a) text.
3. **Operator field tests** — wife-test, two-device 5c stack, Tier V on real device — all still open and increasingly load-bearing as 5e moves forward.
4. **After the ceremony**: Phase 5f quorum org keys per the `840ae02` brief.

## OPERATOR'S-CURRENT-VIBE

Meta-aware and decisive — opened this session specifically to verify the SessionStart hook caught the cross-Carpenter handoff (it did) and then directed this Carpenter to "cut the next pieces of code that you feel is ready to get to the big piece and then when we get to the big piece, we'll start a fresh one and knock out in one go." Maximum trust in autonomy, clear scope boundary on what to stop before. The two-Carpenter workflow is now a real practiced pattern with mechanical defense; expect continued high throughput.

The operator listens via TTS and copy-alls replies; verbose theory replies remain a real cost.

## Ideas ready to revisit

All prior entries hold. The supply-chain decision is still open. The wife-test framing is more actionable now that the verify-page polish has shipped. The PreToolUse drift hook idea for belt-and-suspenders is still a candidate. The branch-gate-implementation idea (the doctrine claim in CLAUDE_ROOT.md mentions a SessionStart-driven branch-gate that doesn't exist as a script — could fold into the existing session-start-grounding.mjs as a second check).

- **NEW 2026-05-24 — five-tabs-tight UX consideration**: 375px viewport with 5 tabs is the visual maximum. If a sixth surface is needed, consider merging People into Lattice (Lattice is a strict superset of People's rendering).

Full entries in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
