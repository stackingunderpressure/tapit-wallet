# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against
live Netlify + Supabase deploy. v1 shipped. Operator on iOS, listens via
TTS. SessionStart drift hook is active on this branch and reported "no
drift detected" at session open.

**Branch:** `claude/next-steps-xzmdk`. Current with `origin/main` at
session start; carries `530e946` (verify-page polish), the 5c-iii pair,
5d Tier V, the Phase 5f quorum-keys brief, the Phase 5e Shamir cascade
roadmap, and the Shamir + cohort + backup-v2 cuts (5e-ii, 5e-iii-a,
5e-iii-b). This session adds 5e-iv on top.

## WHAT-CHANGED-RECENTLY

This 2026-05-24 session shipped Phase 5e-iv — the read-only Lattice
screen at `/lattice`. Per the Phase 5e brief the cut was sized at 3-5
days of mostly rendering with no protocol, and the locked sequence
made it the next thing to cut. One session was enough.

The screen surfaces the operator's direct web in three sections, in
the order they care about when they open it: Recovery cohort (with
threshold, total shares, declared-at, member list, and a Cohort
badge per member), People (handshakes sorted newest-first with a
Tier P / Tier R counts line, and a Cohort badge overlaid on any
ConnectionCard whose peer is also in the cohort), and Organizations
(memberships with the existing MembershipChainSheet wired in for
nested-org walks). Empty states route the operator back to the
editing surfaces — Settings for cohort, the People tab for
handshakes. Friend-of-friend transitive paths are explicitly named
as a future increment per the spec's "direct list first, transitive
scoring later" framing.

Wiring touches outside the new screen: lazy `/lattice` route added
to `src/App.tsx`, header link "Lattice" added next to Settings on
HomeScreen (wrapped in flex gap-4), recovery manifest touches array
updated, bundle-budget script gains a LatticeScreen 5KB budget.
Actual ship size: 2.12 KB gzipped.

Phase 5e position now: 5e-i (library decision, documented in
`decisions.md`), 5e-ii (Shamir primitives in tapit-attest), 5e-iii-a
(cohort UI + credential), 5e-iii-b (backup format v2), 5e-iv
(Lattice screen, this cut) — all landed. Remaining: 5e-v (recovery
ceremony initiator), 5e-vi (recovery ceremony responder), 5e-vii
(recovery-succession event).

## Gates at session end

- typecheck ✓
- lint ✓
- test ✓ — 36/36 wallet tests (no new tests; pure composition of
  already-tested data layer + already-tested rendering primitives)
- build ✓ — all bundle budgets green; LatticeScreen 2.12 KB gz under
  a 5 KB budget

## WHAT'S-PENDING

1. **Operator walk-through the new Lattice screen** on a real device.
   Four cases worth checking: no cohort no handshakes (full empty
   state), no cohort with handshakes (cohort empty + People list +
   no Cohort badges), cohort declared with overlapping handshakes
   (Cohort badges visible on the ConnectionCards), cohort declared
   with no overlap (cohort section shows members but no badges on
   any ConnectionCard). Pay attention to the absolute-positioned
   Cohort badge on ConnectionCard at narrow widths — see the
   carpenter-opinions Section 2 note for the specific concern.
2. **5e-v — recovery ceremony, initiator side.** The big one. New-
   device first-run detects cloud-backup blob exists, generates
   a fresh local keypair, publishes a recovery request via
   Mycelium addressed to each cohort member's pubkey, names the
   new keypair in the request, asks peers to verify out-of-band
   before encrypting their shares. State machine work: fresh
   keypair generation + recovery-request envelope shape + Mycelium
   publish + collect-M-shares + combine + decrypt + Wallet.restore.
   Brief recommends brief-refresh before code lands — the state
   machine is real protocol work with explicit out-of-band
   verification gating, and the Mycelium round-trips need
   ack-aware honest status.
3. **5e-vi — responder side, 5e-vii — recovery-succession event.**
   Follow-on cuts after 5e-v lands.
4. **Phase 5f — quorum org keys.** Brief already in place at
   `briefs/2026-05-23-quorum-org-keys-roadmap.md`; opens cleanly
   once 5e is complete.
5. **Operator field test of the full 5a/5b/5c/5d stack** against
   real Nostr relays with two devices. Open question that no
   amount of code work can resolve.
6. **Wife-test of the verify-page** with the polish that landed
   at `530e946`. Highest-fidelity adoption-UX signal at hand.

## WHAT-TO-FLAG

**The Cohort badge on ConnectionCard uses absolute positioning with
a fixed right offset of 16** so it sits beside the Tier P / Tier R
badge that already lives at the top-right. On a 375px screen with
short peer names the layout reads fine; on a long peer name that
wraps, or on a very narrow screen, the badge may overlap the name
text awkwardly. The clean fix is restructuring ConnectionCard to
accept an optional badges array prop and laying them out
internally, OR rendering the Cohort badge inline below the row.
Either is a small follow-on; not done this session because the
brief sized 5e-iv as a single-session rendering cut. Worth a
DevTools look at 320px width before declaring the visual
unconditionally clean.

**No browser walk-through this session.** Tests and type checks
verify code correctness, not UX correctness. The honest read is
"the code should render the right thing on first load; the visual
polish needs a human's eyes before declaring it shipped." The
walk-through is the WHAT'S-PENDING #1 above for that reason.

**The Phase 5e brief explicitly recommended brief-first for the
recovery ceremony cuts** (5e-v / 5e-vi / 5e-vii) because the state
machine is real protocol work, and that recommendation stands.
Recommend the next session opens with a brief refresh for 5e-v
specifically — fresh-keypair generation, recovery-request envelope
shape, the receive-side modal copy that surfaces out-of-band
verification as a required step rather than an afterthought, and
the share-encryption-to-fresh-pubkey path. The brief at
`briefs/2026-05-24-shamir-cascade-recovery-roadmap.md` is the
right starting point.

## RECOMMENDED-NEXT-MOVES

1. **Operator walks the Lattice screen on a real device** to
   validate the visual at 375px / 320px and confirm the cohort
   cross-reference badge does what it should.
2. **Brief-refresh for Phase 5e-v** — the recovery ceremony
   initiator state machine. Sketch the envelope shape, the modal
   sequence, and the failure-mode handling before code lands.
3. **Cut 5e-v** once the brief is sharp. Sized 1-2 weeks in the
   original brief; budget accordingly.
4. **Operator field test of 5a/5b/5c/5d stack** against real
   relays with two devices remains the open evidence question.
5. **Wife-test of the polished verify-page** — independent of the
   5e arc; the most actionable adoption signal at hand.

## OPERATOR'S-CURRENT-VIBE

Operator is in execution-flow mode: terse instruction ("Fire up
and take over on next steps knock out what you can as long as you
see the line"), trusts the Carpenter to ground, see the locked
sequence, and cut. Hands off, autonomous, but with the standing
constraint that the gates must be green and the comms must be
written. This session honored both. The line was clear — Phase
5e-iv was the next thing in the locked sequence and it was a
single-session rendering cut — and the work landed in one pass
with all four gates green on the first try.

## Ideas ready to revisit

- **CohortSummaryCard extraction with variant prop** — pressure
  to extract a shared component grows when 5e-v adds a third
  rendering site for cohort data (the recovery ceremony screens).
  Pre-decision: hold off until then.
- **ConnectionCard badges array prop** — refactor enabling
  multiple badges on the top-right corner without absolute
  positioning. Worth doing if the Lattice screen's Cohort badge
  overlap surfaces as a real problem in the operator's walk-
  through.
- **Friend-of-friend transitive paths on the Lattice screen** —
  the v1 surface explicitly names this as a deferred increment.
  Likely the natural follow-on after the recovery ceremony arc
  closes; same UX vocabulary, deeper data behind it.
- **Lattice screen → wife-test framing** — if the verify-page
  wife-test produces good adoption signal, the Lattice screen
  is the natural second demo target ("this is the web that
  proves who I am, and the web that puts me back together").

Full entries belong in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`; this session did not write to that file — the new entries above are flagged here for the next session to fold in.
