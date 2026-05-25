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

## Latest letter — 2026-05-25 evening (seeding session)

### What just shipped

Phase 8 Phase C cut 1 landed on main as commit `0e03300`. The
`RatificationsBadge` component now reads the Phase B `authorized_by`
leaf from any envelope it renders and appends `(rule: <action>)` to
the label, so when an org-issued credential is shown the viewer sees
which Tapscript-style auth-tree branch authorized it. The substrate
for this (`decodeAuthorizedBy` in `src/features/governance/authRule.ts`)
was already shipped in Phase B — the cut was wallet-side plumbing
only, about fifteen lines added to a single file. Bundle budget for
the HomeScreen chunk was bumped from 18KB to 18.5KB to absorb the
~22-byte gz delta from `decodeAuthorizedBy` landing in the badge's
import graph. The bump comment in `scripts/bundle-budget.mjs` names
the cut as cause so a future auditor can trace it back.

Same commit also reconciled `PLAN.md` Phase 4.5 from `[NEXT]` to
`[DONE]`. The plan had drifted while the actual code (tabbed home in
`HomeScreen.tsx`, the `share_target` entry in
`public/manifest.webmanifest`, the `/capture` route mounted to
`CaptureScreen.tsx`) shipped quietly in earlier sessions without a
plan update. Status is now honest.

### What's hot right now

The closed-loop hook substrate is in progress in this same session.
This file you are reading is part of that cut. The
`scripts/session-start-grounding.mjs` hook script has been extended
to read `CARPENTER_HANDOFF.md` from origin/main on every session
start and inject it as additionalContext. The doctrine block in
`CLAUDE.md` is being updated alongside to name the close-out
protocol and shift the AppCommander comms cadence from
"write-on-every-event" to "one rich flush at end of context-full
session." These three changes (hook script, this handoff file,
CLAUDE.md doctrine) are intended to ship together in one commit.

If you are the next carpenter reading this, the loop is now self-
sustaining — your first read on wake-up was this section, written
by the prior carpenter, pulled from tip-of-main by the SessionStart
hook. Your job at close-out is to overwrite this section with your
own state-of-the-room and push.

### Land-mines for the next carpenter

The connections/manifest.ts `depends_on` lists governance, which is
structurally correct but counter-intuitive at first read (governance
is the SUBSTRATE, connections is the consumer). The notes field has
the extraction summary but does not have an explicit one-sentence
"why governance is below" explanation. Recommend adding that sentence
in a follow-up cut so future auditors don't have to reverse-engineer
the direction.

The re-exports from `createOrganization.ts` of governance primitives
are back-compat shims. Any future Phase C / D / E UI work that
touches auth-rule helpers should import them DIRECTLY from
`../governance/authRule.ts`, not from `./createOrganization.ts`.
The re-exports can eventually be deleted once all import sites
migrate; do not add new imports through the shim.

`createOrganization.ts` sits at 534 lines, over the 400 soft-warn
threshold. File-size warnings keep firing every test run. A future
cut could extract the officials-roster section (~75 lines) into a
sibling `officialsRoster.ts` to drop the file under the warn. Not
urgent; flag for whenever the file is next touched substantially.

### Operator mood-read

Operator is in a generative mood and trusting delegation. The
session opened with a roadmap status question, walked through the
ranked-cuts list, picked the recommended path (Tier 0 then Phase C),
and authorized the push to main on the merit of the gates. Mid-cut
the operator surfaced the closed-loop hook idea as a side project
and asked for confirmation of understanding before implementation
— and then approved the recommended sequence (commit Phase C cut 1
first, then start hook work). Two cuts moving at once, both with
operator authorization, both ship-ready. The operator is on iOS,
listening to replies via TTS, and the chip-form questions are
working for direction. Voice mode reliable; the only friction is
that voice-typed prompts read as run-on but the meaning comes
through.

### Recommended first move for the next session

Continue the Phase 8 Phase C arc with cut 2 — the multi-rule org
creation UI in `SettingsScreen.tsx`. Substrate is ready, the
`authRules` parameter on `selfDeclareOrganization` was added in
Phase A, and the badge surfaces rule names so the loop closes
end-to-end once a multi-rule org can actually be CREATED in the
browser. Brief of record:
`project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-25-tapscript-style-org-authorization-tree-roadmap.md`,
the `### Phase C` heading. Alternative first move: Phase 8 Phase E1
(extend `AuthRule` in `governance/authRule.ts` to a discriminated
union including the join-rule kind for the open-joining substrate).
Independent of Phase C; one focused session; opens the membership-
acquisition axis. The operator may want to chip-pick between these
two on session start.

If the SessionStart hook injected something that contradicts what's
above, trust the SessionStart hook — it reads from origin/main and
this file was current at the time of writing. Drift detection in the
same hook will flag if your branch has fallen behind main.

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
