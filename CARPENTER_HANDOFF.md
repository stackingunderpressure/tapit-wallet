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

## Latest letter — 2026-05-25 deep evening (Phase C arc + closed-loop hook substrate)

### What just shipped

Four commits landed on main in this session, walking the Phase 8
Tapscript-style org governance arc from the badge surface down to
the cosign-request layer and shipping the closed-loop hand-off
substrate alongside. The first commit was `0e03300` — Phase C cut 1
— which extended `RatificationsBadge` to read the Phase B
`authorized_by` leaf via `decodeAuthorizedBy` and append
`(rule: <action>)` to the label, so any envelope rendered in the
wallet's home or membership cards now surfaces the Tapscript-style
auth-tree branch it was issued under. The same commit reconciled
`PLAN.md` Phase 4.5 from `[NEXT]` to `[DONE]` because the tabbed-
home and Web Share Target capture bridge had quietly shipped in
earlier sessions without a plan update, and bumped the HomeScreen
bundle budget from 18KB to 18.5KB to absorb the twenty-two-byte
`decodeAuthorizedBy` import landing in the badge's chunk.

The second commit was `7ac4e7e` — the closed-loop carpenter hand-off
substrate the operator surfaced as a side project mid-cut. It added
this very file (`CARPENTER_HANDOFF.md`) at the repo root, extended
`scripts/session-start-grounding.mjs` to read it from `origin/main`
on every session start and inject it as `additionalContext` alongside
the existing drift-detection report, and added the new
"Closed-Loop Hand-Off Protocol" section to `CLAUDE.md` plus a
softening of the prior "Live-Comms Protocol" to a deferred-flush
variant. The doctrine now names the carpenter-to-carpenter channel
(tip-of-main `CARPENTER_HANDOFF.md`) separately from the carpenter-
to-operator-and-Foreman channel (AppCommander comms) and says both
flush ONCE per session at close-out, not on every push or commit.
The loop is self-sustaining: end-of-session push guarantees next-
session read.

The third commit was `b55ccb4` — Phase C cut 2 — the multi-rule org
creation UI in `SettingsScreen`. A new lazy-loaded component
`src/features/settings/OrgRulesEditor.tsx` (~245 lines) renders the
current rules list, shows the default routine_issuance rule as a
non-deletable card so the operator sees what they are signing even
with no additions, and exposes an "Add rule" mini-form that
validates duplicate actions, threshold less than one, threshold
exceeding eligible count, and malformed hex at input time — the
operator never sees a confusing post-submit error for a structural
issue the form could catch. The org-creation form in
`SettingsScreen` now wires `orgRules` state through to
`selfDeclareOrganization` so the `authRules` parameter shipped in
Phase A is finally exercised from the UI. The fourth commit was
`0f2ba8e` — Phase C cut 3 — which extended `CosignRequestModal`
with an optional `orgContext` prop. When the modal is opened with
`{orgSelfDecl, action}` it looks up the matching rule via
`findAuthRule`, renders a banner naming the action and the
threshold, and replaces the general `PeerPicker` with a constrained
one-tap eligible-signers list. Existing call sites are unchanged
because the prop is optional; caller wire-up for the new mode is
the next cut. Three of the four Phase C bullets in the canonical
brief are now done; the fourth (post-declaration `RulesEditorModal`)
actually depends on Phase D's charter amendment chain and belongs
there.

All four gates stayed green across all four commits: typecheck,
lint, 136/136 tests, build clean in roughly 4.3 seconds. Bundle
budgets were bumped or named explicitly for every new chunk
(HomeScreen 18→18.5KB, new OrgRulesEditor budget at 3KB, new
CosignRequestModal budget at 4KB) so no surprise growth slipped
through the catch-all.

### What's hot right now

Nothing. The working tree is clean, both branch and main are at
commit `0f2ba8e`, and the close-out flush you are reading is the
deliverable for this session. The next carpenter inherits a clean
shared base with no half-finished cuts.

### Land-mines for the next carpenter

The Phase C cut 3 substrate (CosignRequestModal org-action mode)
ships without any caller wiring. The optional `orgContext` prop is
defined and exercised by the modal's internal rendering path, but
no place in the wallet currently constructs it. Find the org-
issuance flow (likely lives in or around `createMembership` or an
org-issuance modal in `connections/`) and wire it to pass
`{orgSelfDecl: ownOrgDeclaration, action: 'routine_issuance'}` to
`CosignRequestModal` when the operator opens cosign-request from
an org-issued envelope. Until that wiring lands the new banner and
constrained picker are dead code in production paths — they will
render if a future caller passes the prop but no current caller
does.

The `connections/manifest.ts` `depends_on` lists `governance`,
which is structurally correct but counter-intuitive on first read
(governance is the SUBSTRATE, connections is the consumer). The
notes field still does not have an explicit one-sentence
"why governance sits below" explanation. Recommend adding that
sentence in a follow-up cut so future auditors don't have to
reverse-engineer the direction. The same audit applies to
`cosigning/manifest.ts` and `settings/manifest.ts` which both
gained governance dependencies today.

`createOrganization.ts` still sits at 534 lines, over the 400 soft-
warn threshold. File-size warnings keep firing every test run. A
future cut could extract the officials-roster section (~75 lines)
into a sibling `officialsRoster.ts` to drop the file under the
warn. The re-exports from `createOrganization.ts` of governance
primitives are back-compat shims; new code should import directly
from `governance/authRule.ts` per the convention the prior
governance-extraction session named.

`SettingsScreen.tsx` is now at roughly 765 lines (grew ~15 lines
from the cut 2 work). Still under the 800-line hard limit but the
file-size warn fires loudly. If a Phase D cut adds materially to
this file, an honest extraction (the org-mode section into its own
sub-component) is the right move.

### Operator mood-read

Generative all the way through. The session opened with the
roadmap-status question, walked through the ranked-cuts list, and
picked the recommended Tier-0-then-Phase-C path. Mid-session the
operator surfaced the closed-loop hook substrate as a "side
project" and asked for confirmation of understanding before
implementation, then approved the recommended sequence (commit
Phase C cut 1 first, then start the hook work). The voice-typed
prompts read as run-on but the meaning came through clearly each
time. Chip-form questions for direction worked smoothly — the
operator picked each one without hesitation, all four picks
matched the (Recommended) tagged option, which is a clean signal
that the carpenter's framing and the operator's intent were
aligned end-to-end. The pace was steady, the cuts were small
enough to commit individually, and the close-out was operator-
initiated rather than carpenter-prompted — the chip "Wrap and
close out" was picked when there was still capacity to keep
cutting, suggesting the operator was happy with the day's surface
and wanted to lock in a clean state for tomorrow. Two-session arc
of the org-control axis (Phase A and B yesterday, Phase C cuts
1/2/3 today) is now cohesive enough to demo end-to-end in the
browser.

### Recommended first move for the next session

Wire a caller for the new CosignRequestModal `orgContext` mode.
Find the org-issuance flow (start by grepping for
`CosignRequestModal` in `connections/` and `messaging/` — the
PromoteRouter already uses the modal but for non-org envelopes;
the org-side caller likely lives in MembershipModal or a new
org-issuance modal). Construct `{orgSelfDecl: own org declaration,
action: 'routine_issuance'}` and pass it. This closes the Phase C
arc end-to-end in the browser: the operator can declare a multi-
rule org via the form, issue a membership under a rule, request
co-signs from the rule's eligible signers via the constrained
picker, and see the rule name on the resulting badge. About one
focused session. Brief of record:
`project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-25-tapscript-style-org-authorization-tree-roadmap.md`.

Alternative first moves: Phase D (charter amendment chain via
`walkCharterChain` and `findActiveCharter` plus the dissolution
endpoint and the `RulesEditorModal` deferred from Phase C), or
Phase E1 (extend `AuthRule` in `governance/authRule.ts` to a
discriminated union with the join-rule kind for the open-joining
substrate). Phase D continues the org-control axis; Phase E1
opens the membership-acquisition axis. Either is one focused
session and independent of the cut 3 caller-wiring task. The
operator may want to chip-pick between caller-wiring, Phase D,
and Phase E1 on session start.

If the SessionStart hook injected something that contradicts what's
above, trust the SessionStart hook — it reads from origin/main and
this file was current at the time of writing. Drift detection in
the same hook will flag if your branch has fallen behind main.

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
