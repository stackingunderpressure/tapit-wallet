# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

**Two-Carpenter workflow note:** The operator runs two parallel Claude sessions — one cutting code, one in theory conversation — each on its own branch. Main is the canonical handshake point between the two streams. A new `SessionStart` hook in `.claude/settings.json` now mechanically detects drift between the branch and `origin/main` at every session start.

## WHAT-CHANGED-RECENTLY

Phase 5c is structurally complete on main (last code work at `f406199` "Officials roster — Phase 5b-org-ii", which landed during this very session — the code-Carpenter shipped between this branch's first push and this branch's main push, which the new hook would have caught). This 2026-05-23 session added one piece of infrastructure on top:

- **Cross-Carpenter drift hook** — `scripts/session-start-grounding.mjs` plus a `SessionStart` entry in `.claude/settings.json`. Fetches origin at every session start; if `origin/main` has moved past the current branch's merge-base, emits a structured drift report into the session's initial context (commit list, most-recent `current.json` summary, required reads). Catches the failure mode that surfaced this session: a theory-Carpenter on a stale branch confidently giving forward-looking advice that's wrong-relative-to-actual-state because main has shipped past where the branch was rooted.

Prior arc on main (from the code-Carpenter, branch `claude/compare-library-wallet-OW5FF` merged):

- **Phase 5a** in-person handshake (`6e206aa`).
- **Phase 5b** organizations + membership (`85d6a51`).
- **Phase 5c-i α through λ** — NIP-44 v2 primitive, Nostr wire client, wallet wire-up, inbox UI, auto-route, send-back, send-via-Nostr in CosignRequestModal + MembershipModal, peer picker, membership auto-receive, operator-editable custom relay list.
- **NIP-44 reference-vector interop** (`a4c8f23`) — 10/10 upstream spec vectors round-trip.
- **Phase 5c-ii** Tier R remote handshakes (`daabd3d`).
- **Auto-dismiss polish** (`93afbc4`).
- **Multi-field disclosure proofs** (`c013ae1`) — library primitive + wallet UI.
- **Phase 5b-org-i** org-mode declaration + Members view (`11a262e`).
- **Phase 5b-org-ii** officials roster — editable list of org officers as a signed credential, history audit-friendly (`f406199`, landed during this session).

## Gates at session end

- typecheck ✓
- lint ✓
- test ✓ — 31/31 wallet tests; tapit-attest at 98/98 from prior sessions (4 skipped network-deps)
- build ✓ — 274 modules transformed in 3.13s

## WHAT'S-PENDING

1. **Operator runs the wife-test of the verify-page.** From the theory conversation: share a proof from a journal entry → wife opens `/verify` in her browser (outside `AuthGate`, no install) → pastes, sees green → tampers one character of the disclosed value, sees amber. The most valuable adoption-UX signal the project has at its disposal. Note: the verify page surface MAY have changed with the multi-field disclosure work — a quick walk before the wife-test would be smart.
2. **Operator field-tests the full 5c stack** with two devices against real Nostr relays. The open question that nothing in code-land can resolve.
3. **5c-iii** — multi-device connection sync + relay-OK delivery acks. Only piece of Phase 5c left.
4. **Phase 5d** — Tier V device-verified presence (WebAuthn / passkey + geolocation + timestamp).
5. **Phase 5e / 5f** — quorum org-key governance + recovery-share workflows.

### Eight strategic recommendations from the 2026-05-23 theory walk (on the stack, no-code or polish-shaped):

- **A. Verify-page polish audit** — short-form hex pubkeys humanized, amber→red severity question, QR-as-primary vs textarea-as-primary, "what just happened" inline explanation for first-time visitors. Promoted to highest-leverage by the wife-test framing.
- **B. Plain-English UX language audit** — sweep user-facing surfaces, build a glossary mapping "attestation" / "envelope" / "merkle" / "tier" to human English, ship the rename pass.
- **C. Nostr operational doctrine as POST-hoc documentation** — now that 5c has shipped, doc what the code actually does for relays, encryption defaults, metadata posture, NIP-65 publishing. (Was framed as pre-5c in the theory session, but 5c had already shipped.)
- **D. Supply-chain expansion decision** — pursue, defer, or non-goal. The Phase 2.6 custody-handoff primitive IS supply-chain handoff mathematically; ten concrete applications walked in the conversation. Worth a deliberate call.
- **E. Interim peer-recovery story** before the full Phase 5e Shamir cascade — design conversation.
- **F. Auto-anchor passive capture** — biggest adoption lever named; real new feature, deferred design conversation.
- **G. First-pilot organization arc** for institutional onramp — policy/sales work, operator's hands.
- **H. Positioning principle: substrate underneath existing behavior** — meta, informs the others.

## WHAT-TO-FLAG

**The cross-Carpenter drift hook is the first of its kind in this repo.** Future PreToolUse hook on git push for belt-and-suspenders is a candidate but not built — SessionStart alone catches the case that surfaced. The CLAUDE_ROOT.md doctrine mentions "branch gate: no unfinished or dead branch before new work — run by the SessionStart hook" — that's a SEPARATE gap; no branch-unfinished check exists as a script. Worth either implementing or removing the doctrine claim in a future session.

**The theory conversation from this session's Phase A produced real strategic value despite operating on stale state.** Most of it survives the correction (the math-not-trust thesis is timeless; the human-patterns walk is forward-looking; the supply-chain mapping is unaffected by what shipped this week; the comparable-systems landscape is unaffected by phase progression). The eight recommendations are now in front of the operator. The wife-test is the single most actionable item.

**Multi-field disclosure proofs shipped on main** (`c013ae1`). The original Phase 4 single-leaf primitive has been generalized. If the operator runs the wife-test, the verify-page experience MAY have changed surface-wise (multi-leaf reveals, etc.) — worth a five-minute walk before the demo.

**The two-Carpenter workflow is now structurally protected.** Each session starts with a fetch + drift check. If the OTHER Carpenter has shipped to main, this session knows immediately and grounds against main rather than the stale local PLAN.md. If they haven't, the hook says so explicitly. Bidirectional, mechanical.

## RECOMMENDED-NEXT-MOVES

1. **Operator runs the wife-test of the verify-page.** Highest-fidelity UX signal available right now.
2. **Operator field-tests 5a/5b/5c stack with two devices** against real Nostr relays.
3. **Cut 5c-iii** if the field test reveals delivery-ack or multi-device-sync urgency.
4. **Cut Phase 5d Tier V** as the next major increment.
5. **Pull verify-page polish audit forward** if the wife-test produces stumbling-point data.
6. **Decide supply-chain expansion question** explicitly.

## OPERATOR'S-CURRENT-VIBE

Reflective, big-picture, decisive, and increasingly meta-aware about the workflow itself. This session ended with the operator naming the cross-Carpenter failure mode directly: "that's me cutting code on one Claude and write ideas and theory with the other Claude and then you just watched it divergent catch up in one instant." He authorized the hook addition with broad latitude — "you resolve that however you think is best you know where I stand" — and named the right design principle: "let's set up some gates to climb over them and fix them and catch them." Maximum trust in autonomy; expects mechanical defenses against the failure modes he names. The Carpenter delivered on that authorization this session.

The operator listens via TTS and copy-alls replies, so verbose theory replies are a real cost — that's a feedback note for future sessions.

## Ideas ready to revisit

- **NIP-44 reference vectors** — DONE earlier on 2026-05-23.
- **Sign-in-with-existing-Nostr-account** — entry logged earlier; natural moment is now or just after the first two-device field test.
- **Delivery confirmation UI** — becomes the 5c-iii cut.
- **Tier R responder identity fetch** — polish for after field test; today's name-as-typed is honest about the tier.
- **Wallet as hardware-backed object** — long horizon; Wallet class owns `#keypair`, the day a secure-element / passkey backend lands it slots in behind the same interface.
- **NEW 2026-05-23 — supply-chain expansion** — surfaced in theory walk; needs deliberate pursue/defer/non-goal decision. The same substrate that does personal sovereignty does food provenance, cold-chain integrity, fair-trade-with-workers-as-signers, smart-seal-on-container, counterfeit-proof pharmaceuticals. B2B revenue model exists; doesn't compromise the sovereignty constraint.
- **NEW 2026-05-23 — wife-test framing for adoption** — the "paste, tamper, watch math reject" demonstration on /verify is the unit of conversion for non-cryptographers. Promoted from idea to immediate operator action.
- **NEW 2026-05-23 — PreToolUse drift hook for git push** — belt-and-suspenders to this session's SessionStart hook.
- **NEW 2026-05-23 — branch-gate implementation** — the doctrine claim in CLAUDE_ROOT.md mentions a SessionStart-driven branch-gate that doesn't actually exist as a script. Either implement or delete the claim.

Full entries in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md` (note: this session did not write to ideas.md — the new entries above are flagged here for the next session to fold in).
