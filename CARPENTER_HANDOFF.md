# Carpenter Hand-Off — tip-of-main letter to the next carpenter

> This file is overwritten at the end of every meaningful session and
> committed to main as the final act before close-out. The SessionStart
> hook reads it from origin/main and injects it as the first context
> the next carpenter sees. No carpenter ever opens blind.
>
> Format: one letter per close-out, dated, in plain prose. The
> sections below are templates — fill them in honestly, including
> the bits the next carpenter would otherwise have to reverse-engineer
> from commits.

## Latest letter — 2026-05-26 mid-morning (Phase E2 joiner-side self-membership + transport routing)

### What just shipped

Two commits landed this session — one of code shipping Phase 8
Phase E2 from the open-joining brief, plus the close-out flush
commit that overwrites this letter and the comms artifacts. The
session was unusual: the SessionStart hook surfaced the prior
Phase E1 letter naming Phase E2 as the recommended next move,
but the working tree on wake-up already held a substantively
complete Phase E2 cut from a dispatched session that ended
before commit. The grounding gate caught the contradiction
between letter and disk; this session's role pivoted from
"plan and execute Phase E2" to "verify the in-flight work,
finish the close-out artifacts the prior session never wrote,
and ship." All four gates ran against the existing files on
disk and came back green (typecheck clean, eslint clean, 176
of 176 tests passing, build clean with bundle budgets passing).
File-size claims in the prior drafts audited against `wc -l`
came in within rounding of reality.

The Phase E2 cut itself is the joiner-side of the membership-
acquisition axis plus the org-side inbox routing that recognizes
a self-membership envelope and dispatches it to a placeholder
acceptor. Substrate decision (Option 1 vs 2 vs 3) is still
operator-pending; the Phase E2 shape works under all three
options because the joiner-side builder and the org-side routing
are the same regardless of whether the org publishes a roster
(Option 1), verifies purely by self-claim (Option 2), or does
both (Option 3).

`createMembership.ts` grew from 122 to 223 lines with four new
exports. `buildSelfMembershipDraft(joinerIdentity, orgId,
orgName)` produces an unsigned credential-kind attestation whose
`credential_type` leaf is the literal string `self_membership`
and whose top-level leaves are `org_id`, `org_name`, `joined_at`,
and `requested_at`. Both timestamps are set in a single
`new Date().toISOString()` call at draft time and stay byte-
identical for an envelope built in one shot — under the Option 2
substrate (unilateral self-claim) they remain equal for the
envelope's life; under Option 1 the org's roster snapshot
timestamps the acceptance independently, leaving the joiner's
`requested_at` as the joiner's intent. Phase E3 / E4 will sharpen
the distinction in code if the chosen substrate calls for it.
`isSelfMembership` is the mutually-exclusive predicate to
`isMembership` — both gate on `att.kind === 'credential'`, both
read `credential_type`, but only one matches per envelope so
consumers never confuse the two shapes. `readSelfMembership`
lifts the signed leaves into a SelfMembershipView for downstream
display. `receiveSelfMembership` is the Phase E2 acceptor
placeholder — it throws if handed a non-self-membership shape
(integrity gate), then holds and anchors the envelope locally
via `holdAndAnchor`. Phase E3 will layer join-policy evaluation
and pending-roster buffering on top of this same hook without
touching the routing surface.

`envelopeRoute.ts` grew by one new InboxRouteAction
(`self-membership-receive`) and one new branch in `routeFor` —
labels read "Accept join request" with the hint "A self-
membership claim addressed to your organization." HomeScreen's
`routeInbox` switch gained an `acceptSelfMembership` branch that
mirrors `acceptMembership` exactly: call the receive helper,
save and refresh wallet state, dismiss the inbox row. HomeScreen
went from 725 to 748 lines (still well under the 800-line hard
limit) and its chunk stayed at 17.28 KB gz under the 18 KB
named budget.

Tests grew from 162 to 176 (+14). `createMembership.test.ts`
ships 9 new tests across four describe blocks — three for
`buildSelfMembershipDraft` (subject-binding, timestamp identity,
joiner-signable round-trip), three for `isSelfMembership`
(positive case, complement to isMembership, kind-mismatch on
handshakes), one for `readSelfMembership` (full field round-
trip), two for `receiveSelfMembership` (integrity gate throw on
wrong shape, hold-able envelope via direct `wallet.hold` call).
The storage round-trip through receiveSelfMembership itself is
deferred — `anchorQueue.upsert` hits IndexedDB which jsdom does
not ship, so the test exercises wallet.hold directly to prove
the produced envelope is hold-able by any wallet (which is the
integrity contract the placeholder depends on). Phase E3 will
need fake-indexeddb or a polyfill if it wants storage assertions
beyond what wallet.hold provides. A new `envelopeRoute.test.ts`
ships 5 dispatch tests covering self-membership, org-issued
membership, single-signed and counter-signed Tier P handshakes,
and a single-signed Tier R remote handshake — the dispatcher
knows about every shape and a future addition cannot quietly
steal a route from an earlier one. Both connections and
transport manifests gained Phase E2 paragraphs describing the
cut and its boundary with Phase E3.

All four gates green: typecheck clean, eslint clean, 176 of 176
tests passing, build OK with every named chunk under budget. No
new bundle budgets were required — `buildSelfMembershipDraft`
has no production caller until Phase E4 lands the UI, and
`receiveSelfMembership` ships inside the existing createMembership
chunk already in the HomeScreen import graph.

### What's hot right now

Nothing. Working tree is clean, dispatch branch
`claude/multisig-orgs-status-jiLwm` carries the new code and
close-out commits on top of the prior session's tip, and the
branch tip was pushed to `main` per the PFOR-016 pattern
(`git push origin <branch>:main`) as the final act of close-out
so the Stop-hook gate clears and the next SessionStart hook
reads a fresh letter from origin/main. Branch and main are at
the same SHA now. The next carpenter inherits a clean shared
base with the joiner-side of the membership-acquisition axis
substrate ready for Phase E3 (org-side policy evaluation +
roster buffer, gated on the substrate-decision chip) or Phase
E4 (joiner-side UI + verifier).

### Land-mines for the next carpenter

The substrate decision from the open-joining brief — Option 1
(org auto-publishes a roster), Option 2 (org pre-signs an open-
membership policy, verifier walks the auth tree), Option 3
(hybrid, both proofs valid) — is still operator-pending. Phase
E3's scope changes substantially depending on the pick: Option
1 ships a roster-publish job plus a pending-buffer; Option 2
mostly skips E3 and grows E4's verifier; Option 3 ships shared
helpers across both. The Phase E2 cut was deliberately written
to be substrate-agnostic so the choice can still be made cleanly.
Surface the chip to the operator before opening Phase E3.

`receiveSelfMembership` is named as a "placeholder" in code
comments and the manifest, but it is wired into HomeScreen and
will actually hold an incoming self-membership envelope locally
when the inbox routes one. That is intentional — the envelope
should not be lost between Phases — but it means an operator
could already test the end-to-end shipping path today between
two browser instances if both wallets opt into Mycelium. There
is no policy evaluation, so any envelope addressed at the org
gets accepted into holdings; Phase E3 adds the gate. Worth
calling out so the next carpenter does not think they need to
unwire it before adding the gate.

`createMembership.ts` at 223 lines is fine today, but if Phase
E3 adds a self-membership acceptor with policy evaluation +
roster buffer + verifyOpenJoinedMembership, the file could
cross the 400-line soft warn. The natural split when it earns
extraction is `createMembership.ts` keeping the org-issued
membership shape and a sibling `createSelfMembership.ts`
taking the joiner-side builder, predicate, reader, and
acceptor. The substrate decision shapes the split — wait for
it before pre-extracting.

The `createOrganization.ts` file (546 lines), the governance
`authRule.ts` (430 lines), and `SettingsScreen.tsx` (789 lines)
all remain in the soft-warn band from prior sessions. Same
extraction plans apply: officials-roster out of
createOrganization, `authorizedBy.ts` out of authRule, org-mode
section out of SettingsScreen. None are blocking; all are
cheap when the right shape and reason arrive.

The three-manifest governance-direction notes sentence sweep
(connections, cosigning, settings) the prior letter named is
STILL pending — fourth session it has been deferred. Cheap
low-energy autonomous cut, just keeps slipping because each
session takes a load-bearing axis instead. Worth picking up
when a session opens without a substantive directional pull.

The bundle-budget script catch-all still buckets 11 unnamed
JS chunks; no change this session. Pre-existing hygiene debt
unchanged.

### Operator mood-read

Sharp and trusting in delegate-and-verify mode. The operator's
prompt was "Fire up and find the next chunk of work to cut to
fill a session of context and stop in a safe spot." — a clean
delegation to the carpenter to choose the axis, execute, and
land safely. No chip-form direction question was needed because
the wake-up surprise (prior dispatched session ended with WIP in
the tree and drafted close-out artifacts but no commits) made
the right move structurally obvious: verify the in-flight work,
complete the four missing close-out artifacts, commit, push to
main. The operator did not redirect mid-session and did not need
to. Tonally efficient throughout — the carpenter was expected to
handle the unusual wake-up state per doctrine without escalating,
and the doctrine (grounding gate, deferred-flush close-out, PFOR-
016 push-to-main) absorbed the situation cleanly.

A real failure mode surfaced and is worth naming for the
operator: a dispatched session can die with uncommitted technical
work in the tree, and only the next session sees it. The recovery
cost was non-trivial (about a third of this session's context
burned on verification, audit, and close-out completion). The
Stop hook the prior carpenter added catches the case where a
session tries to END with commits ahead of main, but cannot
catch the case where a session DIES with uncommitted work. A
hardening idea worth a future chip: a heartbeat-style guard that
periodically commits WIP to a `wip/` branch so ungraceful death
leaves a trail rather than a working-tree orphan.

### Recommended first move for the next session

The substrate-decision chip — Option 1 vs Option 2 vs Option 3
from the open-joining brief — before any Phase E3 / E4 code.
The four-option chip can frame it as: "Option 1 — org auto-
publishes roster, online-presence required, single auditable
artifact; Option 2 — org pre-signs open-membership policy,
truly leaderless, verifier walks auth tree, no central roster;
Option 3 — hybrid, both proofs valid, best UX but more test
discipline; Defer — keep building substrate-agnostic, pick later."
Recommended is Option 3 (hybrid) because the operator framed
the org as a "wallet-shaped sovereign entity" and Option 3
preserves the most sovereignty (works offline) while still
allowing the consolidated roster UX when an org wants it. After
the chip locks the substrate, Phase E3 (org-side acceptor +
policy evaluation, maybe roster buffer depending on Option) is
the natural next cut — about one to two sessions depending on
the substrate.

Alternative first moves if the operator wants the substrate
chip deferred: the three-manifest governance-notes sweep
(low-energy autonomous polish), the bundle-budget unnamed-chunk
hygiene sweep (11 chunks need named budgets), the
`createOrganization.ts` officials-roster extraction (75 lines
out into a sibling, drops the file under the soft warn), or
Phase D charter-amendment chain (`walkCharterChain` +
`findActiveCharter` + dissolution endpoint, continues the org-
control axis in parallel with the membership-acquisition axis).
Phase D does not depend on the Phase E substrate decision so it
is the safest substantive move if the chip drags.

If the SessionStart hook injected something that contradicts
what is above, trust the SessionStart hook — it reads from
origin/main and this file was current at the time of writing.
Drift detection in the same hook will flag if your branch has
fallen behind main.

---

## Format reference for future close-out letters

Each letter has five sections. Keep them prose, not bullet lists,
so the operator can listen via TTS without choppy fragmentation:

1. **What just shipped** — two to four paragraphs naming commits,
   files, and the WHY behind the work. Educational, like a senior
   engineer talking to a colleague over coffee.
2. **What's hot right now** — uncommitted state, pending chips,
   in-flight cuts, anything the next carpenter inherits half-done.
3. **Land-mines for the next carpenter** — concrete risks with
   file paths and line numbers. No hedging. If nothing surfaced,
   say "no land-mines this round."
4. **Operator mood-read** — how the operator was operating today
   (generative, frustrated, fast, careful, on-iPhone, on-desktop).
   Honest, not flattering.
5. **Recommended first move for the next session** — the specific
   cut you would make first if you were waking up tomorrow. Name
   the brief, name the files, name the alternative.

Replace this section, not append to it. The handoff is point-in-time
state, not a journal. The git history is the journal.
