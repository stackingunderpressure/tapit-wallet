# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active. v1 is shipped. Operator is on iOS.

---

## WHAT-CHANGED-RECENTLY

Branch `claude/wallet-implementation-questions-umXHh`; previous
work on `claude/compare-library-wallet-OW5FF` (5a, 5b, 5c-design
arc) ended at `dbd6ce6`. Recent arc:

- **Phase 5a — in-person handshake** (`6e206aa`).
- **Verified-badge fix** (`b2260f9`).
- **Recovery woven into spec §12** (`4e30f34`).
- **Phase 5b — organizations + membership** (`85d6a51`).
- **Org-key governance + Phase 5f + Phase 5c sketch**
  (`c655526`).
- **Phase 5c design questions resolved — D-11** (`7d4bcaa`,
  `dbd6ce6`).
- **2026-05-23 — no-code theory conversation** (this session,
  no commits). The operator opened a strategy-and-theory
  session covering Nostr plumbing, human-pattern applications,
  comparable systems in the world, adoption strategy, eight
  strategic recommendations, supply-chain/shipping/production
  expansion, and the operator's wife's "how is this not just
  trusting the wallet" question. Closed on the verify-page
  tampering test as the load-bearing adoption demonstration.

## Gates at session end

No gates run — theory only. Gates last green at `85d6a51`
(Phase 5b). tapit-attest unchanged 82/78/0/4.

## WHAT'S-PENDING

1. **Operator runs the verify-page tampering test with his
   wife.** Highest-value UX feedback signal the project has at
   its disposal right now — write down each stumble, that's the
   verify-page polish backlog written by the median user.
2. **Cut Phase 5c-i — STILL THE NEXT CODE CUT.** The transport-
   agnostic interface + a minimal Nostr client + encrypted async
   peer delivery. Design fully locked (D-11; sketch
   briefs/2026-05-22-phase-5c-nostr-transport-sketch.md). One
   build-architecture choice to make when cutting: a minimal
   hand-rolled Nostr transport reusing tapit-attest keys vs a
   Nostr library — lean minimal, since the protocol is small
   and the crypto is already owned. 5c-i is plumbing — no
   immediate visible surface.
3. **Eight strategic recommendations on the stack** (from this
   session, all no-code or polish-shaped):
   - **A. Nostr operational doctrine** — a new doc alongside
     MYCELIUM_NETWORK_SPEC.md specifying relay-selection,
     encryption-default, NIP-65 publishing, metadata-
     minimization, default-private-opt-in-public posture per
     envelope type. **URGENT** — must exist before 5c-i code
     lands or it'll be backfilled badly.
   - **B. Verify-page polish audit** — short-form hex pubkeys
     humanized, amber→red severity question, QR-scan-as-primary
     vs textarea-as-primary, "what just happened" inline
     explanation for first-time visitors.
   - **C. Plain-English UX language audit** — sweep user-facing
     surfaces, build a glossary mapping "attestation" /
     "envelope" / "merkle" / "tier" to human English, ship the
     rename pass.
   - **D. Auto-anchor passive capture** — biggest adoption
     lever but real new feature; deferred design conversation.
   - **E. Interim peer-recovery story** before full Phase 5e
     Shamir cascade — design conversation.
   - **F. First-pilot organization arc** for institutional
     onramp — policy/sales work, operator's hands.
   - **G. Tap-fast co-sign** riding Phase 5a QR primitives —
     wants two-device field test first to ground what's hard.
   - **H. Positioning principle: substrate underneath existing
     behavior** — meta, informs the others.
4. **Supply-chain expansion decision** — surfaced this session
   as a real strategic question. Is the food/shipping/production
   substrate a future B2B product, a deliberate non-goal for the
   personal-wallet identity, or a parallel track? Decision
   needed before it haunts the roadmap further.
5. **Operator field-tests 5a + 5b** with two devices — build-
   verified only.
6. **Phase 5c-ii** (remote Tier R handshakes), **5c-iii**
   (connection sync), then **5d** (device-verified presence),
   **5e** (hyphal lattice + recovery), **5f** (quorum org keys).
7. **Capture Bridge Tier 1b** — photo/file capture (Android).
8. **v1.5:** native shell + App Store + iOS share extension.

## WHAT-TO-FLAG

**The verify-page is now the most important UX surface in the
product.** This session promoted recommendation B from "one of
eight" to "load-bearing for adoption." The math-not-trust thesis
is hollow until a non-cryptographer can paste a proof, tamper
one character, and watch the math reject it on a webpage that
required no install and no login. Every successful tampering
test is a recruitment moment. The page lives at /verify outside
AuthGate (App.tsx:58-65) and is shipped; what's needed is
polish, not architecture.

**The operator is recruiting his wife as the test subject.**
This is the highest-fidelity adoption signal the project has had
yet. Treat anything she stumbles on as a P0 fix candidate.

**Nostr operational doctrine is urgent.** The 5c-i code cut is
next in line, and the operational defaults (relays, encryption,
metadata minimization, publishing posture) must be specified
before code lands or doctrine gets compromised by what the code
already happens to do. Recommend pulling recommendation A
forward as the next no-code dispatch.

**Supply-chain expansion needs a deliberate decision.** Walked
the full B2B potential this session and the engineering is
mostly already shipped (Phase 2.6 custody-handoff = supply-chain
handoff mathematically). Whether to pursue it, defer it, or
declare it non-goal should be named explicitly rather than left
in idea limbo.

**5a/5b remain build-verified only** — two-device field test
still pending before later increments lean hard on them.

## RECOMMENDED-NEXT-MOVES

1. **Operator runs the verify-page tampering test with his
   wife.** Write down every stumble.
2. **Land the Nostr operational doctrine** (recommendation A)
   in the next no-code dispatch, before 5c-i code is cut.
3. **Decide the supply-chain expansion question** — pursue,
   defer, or non-goal.
4. **Cut Phase 5c-i** (transport interface + encrypted async
   delivery) — design is locked.
5. **Operator field-tests handshake + membership** (two
   devices).
6. **Verify-page polish audit** (recommendation B) — informed
   by the wife-as-test-subject feedback.
7. Then 5c-ii / 5c-iii, 5d, 5e, 5f in sequence.

## OPERATOR'S-CURRENT-VIBE

Reflective, big-picture, decisive. Spent this session
consolidating his own understanding of what's been built and
what's possible — the kind of session a founder runs when the
build is real enough that the strategic questions can be sharper
than the technical ones. His wife's skeptic question hit him as
real adoption feedback and he sat with it cleanly rather than
defending. Closed with "I may come back later, but at least
we'll have it" — content with letting the conversation live as
written record for now, low pressure to immediately execute,
high trust that the right next moves are visible on the stack.
Expect either (a) a return to Phase 5c-i implementation cleanly,
or (b) a no-code dispatch on the Nostr operational doctrine or
the verify-page audit, depending on which question feels most
alive when he comes back.

## Ideas ready to revisit

All earlier entries hold. Org-key governance is in spec §6
(phased 5f); "the slime" recovery framing is in §12; Phase 5c
is designed (D-11). Eight strategic recommendations from the
2026-05-23 theory session are now formally on the stack (above).
Supply-chain expansion is a fresh idea-entry candidate worth
adding to ideas.md as a sprouting-stage entry pending the
explicit decision. The Mycelium People-network vision continues
to fruit — 5a and 5b built, 5c designed, 5c-i ready to cut.
Full entries in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
