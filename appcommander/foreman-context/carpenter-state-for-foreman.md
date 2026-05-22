# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active.

---

## WHAT-CHANGED-RECENTLY

A strategic + doctrine arc, not a code cut. Branch
`claude/compare-library-wallet-OW5FF` at `198d737`; main brought
up to date with it.

1. **Capture-bridge phase sketch** (`edb0bab`) —
   `briefs/2026-05-22-capture-bridge-phase-sketch.md`. The "push"
   direction of Layer 2: content sent TO the wallet from any app
   the user is in. Three tiers — Tier 1 Web Share Target
   (pure-PWA, Android one-tap), Tier 2 native share extension +
   App Store (the iOS path), Tier 3 desktop browser extension.
   Includes an App Store assessment: not hard to pass, because
   the app does no money / no exchange / no money transmission;
   the only real gate is Apple guideline 4.2 (no thin web
   wrappers), which the native share extension itself clears.

2. **PLAN.md Phase 4.5** (`64a9979`) — tabbed home + PWA-first
   capture bridge, both post-v1 and independent of Phase 5.

3. **Decisions D-07 and D-08** (`64a9979`) — D-07: capture
   bridge ships PWA-first, native + App Store deferred to v1.5.
   D-08: tabbed information architecture.

4. **Six ideas logged** in `ideas.md` — capture bridge,
   web-proof authenticity, the situations layer, the records
   vault, the agent/Donna bridge, and the **Mycelium
   People-network vision** (`9600e6a`): the People tab is not a
   contacts list — it is a discovered, propagated peer network
   where mutual in-person handshakes make people leaves in each
   other's trees. That vision IS Layer 3 and is spec-blocked by
   D-04.

5. **UserPromptSubmit grounding-gate hook** (`198d737`) — new
   committed `.claude/settings.json`. Injects the operator's
   stay-grounded directive (read the real code, no sketches, no
   assumptions, re-ground in CLAUDE.md) on every prompt.
   Verified: pipe-test, round-trip, jq schema check all pass.

## Gates at session end

No source code changed since `ff5c37e` (the elegant restyle),
where typecheck / lint / test (19/19) / build were all green.
The strategic commits are docs + config only, so the gates
stand. tapit-attest unchanged 82/78/0/4.

## WHAT'S-PENDING

1. **IMMEDIATE NEXT BUILD — the tabbed home (Phase 4.5).**
   Fully designed and operator-blessed, grounded against the
   real code (`HomeScreen.tsx`, `App.tsx`) last turn:
   - Journal and Identity are the two LIVE tabs. Journal = the
     diary (`JournalTabs` already does life-layer sub-tabs);
     Identity = `IdentityCard` + the identity attestation.
   - Captured = an honest "Coming soon" tab (capture bridge not
     built).
   - People = deferred; it is the Mycelium network, not a quick
     tab. Needs MYCELIUM_NETWORK_SPEC.md.
   - Tabs render as a segmented control under the header — a
     bottom tab bar collides with the floating "+ New entry"
     button.
2. **Operator-side, v1 launch blocker:** Resend custom-SMTP +
   email plumbing. DNS records (DKIM TXT, MX, SPF TXT) being
   entered into the Northwest DNS panel (nameservers
   `hosting.businessidentity.llc`); then Supabase custom SMTP,
   the `{{ .Token }}` template + landing line, and the Supabase
   email rate limit.
3. **Capture Bridge Tier 1** (Web Share Target) — after the
   tabbed home.
4. **MYCELIUM_NETWORK_SPEC.md** — needs writing; the operator's
   People-network vision (logged in ideas.md) is its heart. The
   three hard problems it must solve: sybil resistance, the
   social-graph privacy model, and the honest meaning of "the
   whole world in your tree".
5. **v1.5:** native shell + App Store + iOS share extension,
   bundled as one effort.
6. **Non-blocking follow-ups** unchanged: multi-tab worker
   coordination, OTS fixture restoration, Tap-it-Attest-main.zip
   cleanup, backfill remote media for pre-Cut-2 entries.

## WHAT-TO-FLAG

**The grounding-gate hook is live.** `.claude/settings.json`,
UserPromptSubmit. Every dispatch now gets the read-the-real-code
directive injected automatically. Honest limit: a hook injects
an instruction, it cannot force file reads; the only true hard
interlock is the harness already refusing Edit without a prior
Read.

**Session-handoff is now clean.** Working tree empty, branch
fully pushed, main caught up, all decisions/ideas/roadmap/sketch
committed, and these comms files refreshed. A new session
resuming on either `claude/compare-library-wallet-OW5FF` or
`main` gets the complete current picture. The immediate
actionable task is the tabbed home — designed, blessed, ready
to cut.

**People = Mycelium.** The operator's People-tab vision was
caught as the full Layer 3 peer network and routed to the spec
rather than improvised into a tab. Do not build People as a tab
before MYCELIUM_NETWORK_SPEC.md exists (D-04).

## RECOMMENDED-NEXT-MOVES

1. Build the tabbed home (Journal + Identity live, Captured
   coming-soon, segmented-control tabs under the header).
2. Operator finishes Resend / email plumbing — the v1 blocker.
3. Capture Bridge Tier 1 (Web Share Target).
4. Write MYCELIUM_NETWORK_SPEC.md from the logged vision.
5. v1.5: native shell + App Store + iOS share extension.

## OPERATOR'S-CURRENT-VIBE

High momentum, "ready to give this thing a cape", and visibly
energized — browser-verified real features on the live deploy
and felt the weight of what was built. Deeply committed to the
verify-don't-trust / stay-grounded discipline — committed enough
to ask for it to become a hook, which it now is. Just asked to
confirm that everything transfers durably to the repo for clean
session-to-session handoff — which it now does. Expect the next
move to be either the tabbed-home build or an email-plumbing
checkpoint.

## Ideas ready to revisit

All earlier idea entries hold. The 2026-05-22 additions: capture
bridge, web-proof authenticity, the situations layer, the
records vault, the agent/Donna bridge, and the Mycelium
People-network vision. The Mycelium vision is the load-bearing
one — it should mature into MYCELIUM_NETWORK_SPEC.md. Full
entries are stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
