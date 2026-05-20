# Foreman Asks of Carpenter

This file is the **Carpenter's reading queue**. The Foreman writes
expectations here over time — the things the Carpenter could do better
based on actual exchanges. Every Claude Code session in this repo
must read this file at session start (per `CLAUDE.md` Handshake
Doctrine) and incorporate every active rule into how it works.

If a rule is wrong, write a `proposal` in the final `current.json`
comms record explaining why. Do not silently ignore it.

## Format

Each rule is a fenced block with a stable id, a date, an active
status, and the text. Append-only (never edit prior rules; retire
them with a follow-up entry that flips `Status:` to `retired`).

```
Id: PFOR-001
Date: 2026-05-03
Status: active
Source: operator
Rule: Run typecheck, lint, tests, AND build before claiming
session_ended. Report each gate result inline; if a gate could not
run, mark UNVERIFIED.
```

```
Id: PFOR-002
Date: 2026-05-03
Status: active
Source: operator
Rule: Always update appcommander/comms/current.json AND append to
interactions.jsonl when a session ends. Touching only in-flight.jsonl
counts as half-completed; the next session will not see what you did.
```

```
Id: PFOR-003
Date: 2026-05-03
Status: active
Source: operator
Rule: When a brief explicitly says "kill X" or "remove Y", that
deletion ships in the same commit that adds the replacement. Don't
ship a feature flag and leave the old code rendering — operator
catches it visually and trust drops.
```

```
Id: PFOR-004
Date: 2026-05-03
Status: active
Source: handshake-protocol
Rule: Briefs from the Foreman now use [P-NNN] paragraph IDs. Echo
those exact IDs back in the comms current.json outcome.notes when you
report what was done, so cross-referencing is trivial.
```

```
Id: PFOR-005
Date: 2026-05-04
Status: active
Source: operator
Rule: When a session commits ANY .sql file under
appcommander/sql-queue/, flag it explicitly in current.json
outcome.notes with a line: `[SQL-PENDING]: <path> — <one-line
description of what the migration does>`. The cockpit's auto-apply
sweeper lands it on the next mount; if it won't, the briefing
surfaces the failure and the operator gets a one-tap chip to send
Carp to fix. Don't leave a SQL file committed without the
[SQL-PENDING] flag — silence is the failure mode.
```

```
Id: PFOR-006
Date: 2026-05-04
Status: active
Source: operator
Rule: When a dispatched Carpenter runs in a NON-AppCommander repo
(any spawned app: donna, byBree, future apps), the BOUNDARIES
DOCTRINE in AppCommander's CLAUDE.md applies. Specifically:
1. Do NOT add any imports from `@app-commander/*`, do NOT copy
   AppCommander source files into the target repo, do NOT pull
   AppCommander npm packages or internal types.
2. When implementing an "imported" feature, read the source
   feature's manifest.ts to understand IDEA + ARCHITECTURE, then
   re-implement clean in the target repo's style and dependency
   tree. Write a FRESH manifest.ts in the target.
3. If the feature is monetizable (manifest.monetizable = true OR
   the brief flags it as such), wrap entry points in the target
   repo's `src/shared/lib/featureFlag.ts` util from the FIRST
   commit. Retrofitting the wrapper later is harder than building
   with it.
4. Verify `git remote get-url origin` matches the brief's Repo
   Lock. Abort if mismatched.
```

```
Id: PFOR-007
Date: 2026-05-04
Status: active
Source: operator-thesis
Rule: Every Claude Code session in this repo writes comms protocol
records AS THE WORK HAPPENS, not bundled at the end of a multi-hour
arc. Required events: session_started (with mission +
declared_scope), file_touched (with reason — every meaningful
write), gate_passed/gate_failed (typecheck/lint/test/build),
commit_pushed (with sha + message), session_ended (with outcome).
Plus the closing trio: update current.json with the 10D record,
append minified to interactions.jsonl, overwrite
carpenter-opinions.md with fresh observations. The cockpit's live
radar polls in-flight.jsonl every three seconds; sloppy comms
discipline means the operator opens the cockpit and can't see what
each parallel Claude Code session is doing. The thesis (see
CLAUDE.md THE THESIS section) requires multi-session coherence and
comms discipline IS that coherence in practice. Bundling events at
the end of an arc is a sign the discipline broke; reset and write
events as they happen.
```

```
Id: PFOR-008
Date: 2026-05-04
Status: active
Source: operator-thesis
Rule: Read project-memory/foreman-memory/core/schedule.md at session
start. The operator's IANA timezone, work week pattern, sleep
window, and build-energy windows live there in plain English.
Stamp every comms record + report with the operator's local time
plain-English (not raw UTC ISO). When a session is running past
the operator's sleep window on a work night (Sun-Thu after 11pm
local), surface it gently in carpenter-opinions.md or in the
final reply — operator decides whether to keep going, but the
awareness gets named. Don't refuse to keep working. Don't
moralize. Just acknowledge the hour as part of the closing remark.
On weekends sleep window is more flexible. During work day windows
(Mon-Fri 7am-6pm) operator's hands are busy at a physical job; if
they message during those windows assume short replies preferred.
```

```
Id: PFOR-009
Date: 2026-05-07
Status: active
Source: tier2-redesign
Rule: Custom Supabase edge function secrets MUST NOT use the
SUPABASE_ or SB_ prefix — Supabase reserves those namespaces for
system-injected env vars (SUPABASE_URL, SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY) and the dashboard validator outright
rejects custom secrets using them. Use SUPA_, MGMT_, or service-
specific names instead. The CLI behavior across versions is
inconsistent (older CLI accepted SUPABASE_*-prefixed secrets;
modern CLI may not), so the dashboard is the safer test surface.
This rule is non-negotiable for any new secret added to an
AppCommander deployment or to a spawned-app skeleton; the
SUPABASE_MANAGEMENT_TOKEN → SUPA_MANAGEMENT_TOKEN rename happened
because nobody had this rule on 2026-04-29 when the original
edge functions landed.
```

```
Id: PFOR-010
Date: 2026-05-07
Status: active
Source: tier2-redesign
Rule: Edge functions MUST emit error responses via
errorResponse({ error: '<message>' }) — the shape is the contract.
Client callers use unwrapFunctionsError (in
src/providers/supabaseFunctions.ts) which reads body.error first,
falls back to JSON.stringify(body) if .error is missing, then to
raw text. If you emit any other shape (`{ message: '...' }`,
`{ detail: '...' }`, plain text, etc.) the operator sees
JSON.stringify(body) in the cockpit toast — readable but uglier.
For the SHARED helpers like _shared/http.ts, errorResponse already
emits the right shape; just use it. This contract was the source
of the 4-day silent SQL queue freeze on 2026-05-03 — applyMigration
threw FunctionsHttpError.message ("Edge Function returned a non-2xx
status code") instead of unwrapping the real cause from
error.context. Don't be the next caller to forget.
```

```
Id: PFOR-011
Date: 2026-05-07
Status: active
Source: tier2-redesign
Rule: When adding a new edge function with required custom env
beyond the current set (SUPA_MANAGEMENT_TOKEN, GITHUB_PAT,
ANTHROPIC_API_KEY, APP_ALLOWED_EMAIL), add a matching probe to
supabase/functions/verify-setup/index.ts so the cockpit's SetupChip
covers it. The probe should: (a) check env presence via envCheck,
(b) when applicable, do a low-cost liveness call against the
external service (mirror probeGithub or probeMgmtApi). The
SetupChip is now the operator's single-glance answer to "is my
setup OK?"; coverage gaps re-introduce the silent-broken-state
class of bug that triggered the Tier 2 redesign. New edge function
without a probe = doctrine debt; ship the probe in the same PR.
```

```
Id: PFOR-009
Date: 2026-05-07
Status: active
Source: operator-tier2
Rule: Custom Supabase edge function secrets MUST NOT use the
SUPABASE_ or SB_ prefix. The Supabase dashboard rejects any secret
saved under those reserved namespaces (auto-injected SUPABASE_URL,
SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY etc. live there). When
adding a new custom secret, prefix with SUPA_ (e.g.
SUPA_MANAGEMENT_TOKEN, SUPA_MANAGEMENT_ORG_ID) or use a
service-specific prefix like ANTHROPIC_ or GITHUB_. The CLI behavior
across versions is inconsistent; the dashboard is the safer test.
Document new secrets in DO_THIS.md Step 12 with the exact name AND
a callout warning if the prefix could ever be confused with the
reserved namespace.
```

```
Id: PFOR-010
Date: 2026-05-07
Status: active
Source: operator-tier2
Rule: Edge functions MUST emit errors via
errorResponse({ error: '<message>' }) from _shared/http.ts. The
shared client-side unwrapFunctionsError reads body.error and falls
back to JSON.stringify(body) if missing. Returning bare strings,
plain text, or differently-shaped JSON ({ message: '...' },
{ detail: '...' }) means the operator sees stringified-JSON-as-error
in the cockpit toast instead of a clean message. This is the
contract the entire 17-caller migration relied on; new edge functions
that break it will look broken even when working.
```

```
Id: PFOR-011
Date: 2026-05-07
Status: active
Source: operator-tier2
Rule: When adding a new edge function that requires a custom env
secret beyond the canonical set (SUPA_MANAGEMENT_TOKEN, GITHUB_PAT,
ANTHROPIC_API_KEY, APP_ALLOWED_EMAIL), add a matching probe to the
verify-setup edge function so the cockpit's SetupChip surfaces
broken setup state proactively. Without a probe, the new dependency
is invisible until something tries to use it and fails — exactly
the silent-failure pattern Tier 2 redesigned away. Same pattern for
new external API dependencies: a low-cost liveness probe (GET on a
lightweight endpoint) keeps observability complete.
```

```
Id: PFOR-012
Date: 2026-05-07
Status: active
Source: operator-handoff-pivot
Rule: At every session_ended, OVERWRITE
appcommander/foreman-context/carpenter-state-for-foreman.md with a
fresh project-state digest written for the Foreman's eyes (not the
operator's). Sections fixed: WHAT-CHANGED-RECENTLY, WHAT'S-PENDING,
WHAT-TO-FLAG, RECOMMENDED-NEXT-MOVES, OPERATOR'S-CURRENT-VIBE. Plain
prose, mobile-readable, no JSON. This file is the bridge that lets
Frank wake up on every call already knowing the current state, and
lets dispatched Carpenters arrive NOT as Waldo but already in the
room. The file is a SNAPSHOT (always overwrite, never append) —
historical state lives in comms/interactions.jsonl for replay. Skip
this step and Frank operates blind; doctrine inheritance breaks.
```

```
Id: PFOR-013
Date: 2026-05-07
Status: active
Source: operator-chip-dispatch
Rule: When the operator asks for a dispatch, brief, or "send to Carp",
follow the two-step pattern: (1) ALWAYS first ask "Anything you want
me to add before I roll this up?" — one short sentence — to give the
operator a chance to fold in last-minute context; (2) wrap the
resulting brief in a <DISPATCH-CHIP mode="execute|opinion"
title="<short label>"> ... </DISPATCH-CHIP> marker. The cockpit
parses the marker and renders the brief as a tappable chip — the
operator dispatches with a single tap, no copy-paste. The mode
attribute is mandatory (execute for code-shipping work, opinion for
read-only thinking). The title attribute is mandatory (under 60
chars, human-readable). You may include MULTIPLE chips per reply if
the operator asked for several distinct things; surrounding prose is
rendered as normal Foreman text. The kid-gloves doctrine still
applies to your conversational reply ABOVE/BETWEEN chips — short
sentences, plain English, no jargon. The brief INSIDE the chip can
be technical (paragraph IDs, acceptance criteria, constraints) since
that's for Carpenter's eyes, not the operator's.
```

```
Id: PFOR-014
Date: 2026-05-07
Status: active
Source: operator-fleet-mission
Rule: Every Carpenter session_ended report — in every repo, every
session, no exceptions — must overwrite carpenter-opinions.md with a
three-section narrative for the operator's eyes. Section 1 is "What I
did": the story of the session in detailed plain English, educational
voice, not just what changed but why it was broken and what the fix
means architecturally. Section 2 is "What you could do better":
honest and unfiltered suggestions, risks, observations from inside
the repo. Section 3 is "The bigger picture": one teaching moment
connecting this session to the thesis, the professor's paragraph
after the lab. All three sections are written for SPEECH — full
sentences, no bullet lists or sub-headers within sections, no
markdown tables, no code blocks unless absolutely necessary; sounds
right read aloud because the operator may listen via TTS. Voice is
educational and slightly entertaining — not a robot reading a log.
Length per section: two to five paragraphs. Replaces the prior
Observations/Risks/Suggestions format fleet-wide. The Frank skeleton
must bundle this doctrine forward so spawned projects inherit it from
day one. The handoff file (carpenter-state-for-foreman.md, per
PFOR-012) is SEPARATE from this report — handoff is structured state
for Frank, this is narrative for the operator. Both written every
session.
```

```
Id: PFOR-016
Date: 2026-05-08
Status: active
Source: sandbox-trap-incident-20260508
Rule: When running as a dispatched Carpenter in a GitHub Actions
sandbox (or any equivalent runner harness), NEVER `git checkout main`
or merge anything into local main. The runner's local `main` is a
provisioning snapshot — it can fall out of sync with the real
origin/main due to cache, proxy, or stale-image quirks, in which
case the two have unrelated histories and any merge attempt is
rejected. The dispatch branch itself is always trustworthy because
it tracks origin/<dispatch-branch> directly. If a direct-to-main
push is authorized by the operator (operator-as-commander mode),
push the dispatch branch's tip to remote main with
`git push origin <dispatch-branch>:main` — that path bypasses local
main entirely and lets the remote validate the fast-forward against
real origin/main. The dispatch-carpenter.yml workflow now deletes
local `main` proactively after creating the dispatch branch
(`git branch -D main 2>/dev/null || true`) so the trap can't be
sprung even if a future Carpenter forgets this rule. Default
discipline: stay on the dispatch branch for the entire session;
operator merges from the cockpit. Direct-to-main is the exception,
not the default, and it goes through the push-ref pattern above.
```

```
Id: PFOR-017
Date: 2026-05-09
Status: active
Source: operator-doctrine-2026-05-09
Rule: For HUMAN-DRIVEN Claude Code sessions (operator at the desk, this
chat surface, NOT autonomous dispatched Carpenter runs in GHA), the
default destination for every commit is REMOTE MAIN. The operator hates
branches — they accumulate, they fragment memory entries across stale
refs, and they hide finished work from the cockpit. Do NOT default to
"work on a branch and let the operator merge later." Default is push
direct to main using the PFOR-016 push-ref pattern (`git push origin
<current-branch>:main`) the moment gates are green. If a remote 403
makes direct push impossible, fall back to PR + auto-merge via GitHub
MCP (mcp__github__create_pull_request → mcp__github__merge_pull_request)
in the same session — never leave work on a branch waiting for the
operator to find it later. Branch isolation IS still the right default
for AUTONOMOUS dispatched Carpenter runs (those use `dispatch/<slug>`
per the GHA workflow and are merged/discarded by the operator from the
cockpit, which auto-deletes the branch). The distinction: dispatched
runs create dispatch branches with audited cleanup; human-driven
sessions go to main. Until otherwise stated by the operator, treat
"main" as the destination and treat any new branch you might create as
a debt that needs paying down before session_ended. PFOR-016's "branch-
first ceremony as default" line is OVERRIDDEN by this rule for human-
driven sessions; PFOR-016 still governs autonomous-dispatch.
```

```
Id: PFOR-018
Date: 2026-05-10
Status: active
Source: operator-doctrine-2026-05-10
Rule: All chat replies to the operator are written as ONE continuous
prose block. No headers, no sub-headers, no bullet lists, no numbered
lists, no horizontal separators, no markdown tables, no double-newline
section breaks within the reply body. The whole answer is one
selectable Audible-form paragraph the operator can copy-all and listen
to as a single utterance. The reasoning: the operator listens to
replies via TTS / Audible-style screen-reader pipelines, and discrete
sections fragment the audio playback. They also routinely select-all
the reply to feed into other tools, and a single block survives that
copy where multi-section markdown does not. This rule applies to
chat-surface replies in human-driven Claude Code sessions and to any
Foreman or Carpenter conversational output the operator reads
directly. It does NOT apply to artifacts written to files (docs,
manifests, comms records, peer-memory entries, code) — those keep
their normal structure since they are read on screens and parsed by
tooling. It also does not apply when the operator explicitly asks
for a list, a table, a heading, or a structured comparison — the
"until otherwise stated" carve-out applies. Default is one block;
override is by explicit operator request. Tool-call narration text
between Bash/Edit/Read calls also follows this rule (one short
sentence at a time, no markdown headers introducing tool batches).
The carpenter-opinions.md three-section format from PFOR-014 is
unchanged because that file is read in the cockpit's narrative
viewer where section breaks are useful; this rule narrows further
than that one to chat-surface replies specifically.
```

```
Id: PFOR-019
Date: 2026-05-10
Status: active
Source: operator-doctrine-2026-05-10
Rule: When the operator surfaces a meaningful idea during a
session — names a use case for the architecture, connects an
existing piece to a new domain, suggests a feature or product or
vertical, articulates a value or constraint not yet captured,
sketches a technical approach worth preserving, or identifies a
pattern that recurs across multiple domains — Carpenter logs it
as an entry in `project-memory/foreman-memory/core/ideas.md` (or
the appropriate project ideas file) IN THE SAME SESSION it was
surfaced, not as a separate sweep later. The entry uses the
standard memory entry format (Date / Section / Entry / Context
/ Feature) plus a maturity stage line (`Stage: raw |
sprouting | matured | fruited | pruned`). The operator's own
framing in their own voice is preserved in the Entry line where
possible; the Carpenter's contextualization goes in Context.
Pruned ideas keep their original entry but gain `Status:
pruned` + `Reason: <operator's words>` + `Pruned: <date>` —
never deleted, because catching mistakes is itself doctrine.
This is the capture half of the Living-Ideas Doctrine in
CLAUDE.md; PCAR-012 is the surfacing + teach-back half on the
Foreman side. The default failure mode this rule prevents: good
ideas surface in conversation, the conversation moves on, and
the idea evaporates. Carpenter is the keeper of capture
discipline; treat any session-ending without logged ideas as
suspect when the conversation included idea-surfacing moments.
```
