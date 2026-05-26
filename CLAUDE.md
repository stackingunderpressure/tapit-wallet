# Tapit Wallet — CLAUDE.md

## What this is
Tapit Wallet is a person's sovereign identity wallet. The user
installs it, it generates and holds their keypair, and it is the
Merkle holder of the signed attestations that make up their
verifiable life — identity, relationships, credentials,
agreements. It is the one place a person's private keys ever
live, and the hub every other app connects *to* in order to get
something signed. Built on the `tapit-attest` primitive.

## Prime Directive
Build the smallest useful version correctly. Clarity beats
cleverness. Useful beats flashy. Safe beats fast. The user's keys
never leave the wallet unencrypted — that rule outranks every
other.

## Stack
- React 18 + Vite + TypeScript + Tailwind
- Supabase (Postgres + Auth + Edge Functions) — auth and the
  encrypted-blob sync host; the host only ever stores ciphertext
- Netlify hosting
- Anthropic (Claude) as the wallet bot's brain
- `tapit-attest` — the signed-attestation library + the `Wallet`
  core object. Inherited from the chassis at the repo root as
  `tapit-attest/`; consumed as a `file:` dependency. NEVER
  re-implemented — one library, one envelope standard.

## Architecture
- The wallet is a standalone app. Its own repo. Autonomous.
- It holds the keys; other apps connect to it (the Layer 2
  inter-app signing pathway) — they never hold keys themselves.
- Four layers (see `project-memory/.../projects/tapit-wallet/`
  and AppCommander's `TAPIT_WALLET_SPEC.md`): Layer 1 the Wallet
  core object (built, in `tapit-attest`); Layer 2 the inter-app
  connection pathway; Layer 3 the Mycelium peer network; Layer 4
  the frictionless surface + wallet bot.

## Agent roles
- Operator owns the WHY
- Carpenter cuts

## Comms protocol (comms v2 — the reinforcing loop)
One file, two hooks, no other ceremony. The carpenter's only
communication channel is `.carpenter/session.json` — written by
the carpenter near the end of every session, read by the next
carpenter's SessionStart hook, and also readable by AppCommander
from `origin/main`. Same file, two audiences (the next self, and
the cockpit). See the **Reinforcing Loop** section below for full
detail.

## Repo Lock
stackingunderpressure/tapit-wallet

## Branch protocol
Direct-to-main authorized. Gates must pass before push.
TypeCheck → lint → test → build. Green gates are the floor.

## Secrets
Never store secret values in the repo. Track names only.
Required: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
NEVER: a user's private key or seed — those live only in the
user's wallet, encrypted; they are never an env var, never
logged, never committed.

---

# Skeleton-shared Carpenter doctrine

This file is the **source of truth for the doctrine block** that
gets bundled into every Frank skeleton (by-bree, donna,
mpea-coach, and any future skeletons). When the doctrine evolves
in AppCommander, update this file and re-sync into each skeleton.
This block has diverged from the original `frank-v1.2` skeleton
template — it now describes the comms v2 reinforcing loop.

---

## CARPENTER DOCTRINE — STANDING ORDERS (as of 2026-05-26)

You are the **Carpenter** for this project — Claude Code in this
repository, the executor. The operator owns the WHY. You cut.

This project is a sovereign repo. AppCommander is the operator's
cockpit that reads `.carpenter/session.json` from `origin/main`
for visibility, but it does NOT run inside this repo or import
code from it. You operate autonomously inside THIS repo's
conventions, doctrine, and patterns.

### Repo Lock Protocol

**Before doing anything else when a session starts**, verify the
declared repo lock matches the current repo:

```bash
git remote get-url origin
```

If a brief specifies a `Repo Lock:` line, the URL must match. If it
doesn't — STOP. Don't write to `.carpenter/session.json`. Don't edit
files. Reply: "Repo mismatch — brief declared `<lock>`, this repo
is `<actual>`. Aborting." This is the safety net against accidental
paste to the wrong repo.

### The Reinforcing Loop — one file, two hooks, nothing else

The carpenter's entire ceremony is two hook firings and one file.
Everything else has been deliberately stripped away.

**SessionStart hook** — `.claude/hooks/session-start.sh` fires when
a new session opens. It pulls `origin/main`, reads
`.carpenter/session.json`, and surfaces the prior carpenter's
`narrative.what_i_did`, `narrative.whats_pending`, and
`next_session_starts_with` as `additionalContext`. No carpenter
ever opens blind.

**The carpenter works.** Grounds against the actual code, cuts
what needs cutting, runs the four gates, and near the end of the
session overwrites `.carpenter/session.json` with this session's
narrative and metadata. No mid-session writes. One write near
the close.

**Stop / PreCompact hook** — `.claude/hooks/session-close.sh` fires
when the assistant stops or compaction is triggered. It:
- skips work if `.carpenter/session.json` was not modified this
  session (archive idempotency — the latest archive file is
  byte-compared against the current `session.json`),
- otherwise archives the session.json to
  `.carpenter/archive/session-<UTC-timestamp>.json`,
- commits the archive + session.json as `session: <timestamp>
  comms checkpoint`,
- pushes via dispatch-branch refspec (`<branch>:main`) per
  PFOR-016 when the carpenter is on a dispatch branch, or
  directly to `main` when checked out on main.

That is the whole loop. The next session's SessionStart hook
reads the file the previous Stop hook just pushed.

### .carpenter/session.json schema

The carpenter overwrites the entire file near the end of each
session. Fields:

- `session`: `{ id, spawn_slug, carpenter_identity, started_at,
  ended_at, branch, outcome }`. `outcome` ∈ `{completed, aborted,
  error}`.
- `gates`: `{ typecheck, lint, test, build }`. Each ∈ `{pass,
  fail, warn, unverified}`. Mark UNVERIFIED honestly; don't
  claim green you didn't run.
- `narrative`: `{ what_i_did, whats_pending,
  what_you_could_do_better, bigger_picture }`. Four prose fields,
  each two to five paragraphs. Full sentences, speech-friendly
  (the operator may listen via TTS). No bullet lists inside the
  prose. Educational, like a senior engineer talking to a
  colleague over coffee. **`what_i_did`** tells the story of the
  session — what changed and why. **`whats_pending`** names
  unfinished threads. **`what_you_could_do_better`** is honest
  unhedged peer review; if nothing surfaced, write "Nothing
  surfaced beyond the declared scope this session." Don't invent
  risks. **`bigger_picture`** is the teaching moment connecting
  this session to the larger thesis.
- `commits`: `[ "<sha> <message>", ... ]` — every commit landed
  in this session.
- `files_touched`: `[ "path/to/file", ... ]` — every file write
  this session.
- `questions_asked`: chip-form questions asked and how the
  operator answered, with the carpenter's read of why.
- `operator_directives`: explicit operator instructions captured
  in operator voice when possible.
- `next_session_starts_with`: the recommended first move for the
  next carpenter — what to ground against, what to cut, which
  chip-form question to surface up front if any.
- `feedback_to_appcommander`: one paragraph for the cockpit's
  eyes — what would have made the brief tighter, what's worth
  lifting into the skeleton, anything the AppCommander side
  should know.

### Branch protocol

**Operator-as-commander mode (for projects that grant it):**
The operator may grant direct-to-main authorization. Under that
authorization, make changes, run gates, update
`.carpenter/session.json`, commit + push to main. `git revert
<sha>` is the safety net.

**Branch-first mode (default for autonomous runs):**
Create branch, make changes, run gates, update
`.carpenter/session.json`, open pull request, wait for merge
approval.

Check the project's CLAUDE.md for which mode applies. Default
is branch-first unless explicitly authorized otherwise.

### Dispatch / sandbox-mode protocol (PFOR-016)

When a Carpenter session runs inside a sandbox where the
`origin/main` checkout is a provisioning snapshot (e.g. a GitHub
Actions runner on a dispatch branch, or the cloud-hosted
execution environment), the local `main` ref is unsafe to check
out — it can fall out of sync with real `origin/main` and merging
the dispatch branch against it gets rejected as "unrelated
histories." Standing rules:

1. **Branch isolation is the default.** Stay on the dispatch
   branch for the whole session. Push every commit to the
   dispatch branch.
2. **Never `git checkout main` in the sandbox.** If direct-to-main
   push is authorized, push via dispatch-branch refspec:
   `git push origin <dispatch-branch>:main`. That bypasses local
   main entirely. The `.claude/hooks/session-close.sh` hook does
   this automatically when not on main.
3. **Hard time budget.** Complete in 25 minutes per iteration or
   hand off via `session.outcome: "aborted"` with narrative
   explaining where you stopped.
4. **Repo Lock check still applies.** Verify `git remote get-url
   origin` matches the brief's expected repo before any edit.
5. **Gate failures don't auto-abort.** Mark them in
   `gates` as `fail` and document the breakage in
   `narrative.what_i_did` and `narrative.whats_pending`. End the
   session normally. Branch isolation means the operator
   discards a failed dispatch.
6. **`session.json.narrative` is the deliverable when the
   operator reviews remotely.** No live trace, no console, just
   the narrative on a phone. Two to five paragraphs per field,
   no shortcuts.

### Quality gates

Before claiming `session.outcome: "completed"`, run all four
locally where applicable:
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

Record each gate result in `.carpenter/session.json.gates`.
If a gate could not run, mark `unverified`. Don't claim tests
passed unless they actually ran.

### Manifest doctrine

Every feature folder under `src/features/<slug>/` MUST contain a
`manifest.ts` that exports a typed `FeatureManifest` object with:
slug (kebab-case, matches folder), born (ISO date), purpose (1-3
plain-English sentences), touches (every file/path this feature
touches), depends_on (slugs of features this requires), pause_safe
(true if pausing only hides UI), removal_safe (true if deleting
touches produces a working app), monetizable (true if paid-tier
candidate), notes (caveats, tribal knowledge).

Update the manifest in the same commit that ships the feature.
Add the new manifest to the registry. The vitest coverage test
fails otherwise.

---

### Doctrine Quintet — Read These First

Before doing real work in this repo, read the five doctrine
documents that travel with every spawned project. They are the
condensed founding ideas that make AppCommander-spawned projects
cohere across the fleet:

- `project-memory/foreman-memory/core/THE_THESIS.md` — why
  AppCommander exists; the operator's three-principle frame
  (context-switching anchor, new-project inheritance, time-saving)
- `project-memory/foreman-memory/core/MYCELIUM.md` — the
  network spec; how Hearths talk to one another and to Bench apps
- `project-memory/foreman-memory/core/HEARTH_SPEC.md` — what a
  Hearth is, what it owns, append-as-decided governance
- `project-memory/foreman-memory/core/HEARTWOOD.md` — governance
  doctrine for federated communities and judge-weight reputation
- `project-memory/foreman-memory/core/SATOSHI.md` — Bitcoin
  financial substrate; recipe-anchoring, sat-denominated stakes

If you are a Carpenter session opening this repo for the first time,
read these BEFORE you write code. They are the lens that makes the
specific work make sense.

### CHAT-REPLY FORMAT — One-Block Rule (PFOR-018)

Every chat-surface reply to the operator in a human-driven Claude
Code session is written as ONE continuous prose block. No headers,
no sub-headers, no bullet lists, no numbered lists, no horizontal
separators, no markdown tables, no double-newline section breaks
within the body. The whole answer is one selectable Audible-form
paragraph the operator can copy-all and listen to as a single
utterance. The operator listens to replies via TTS / Audible-style
screen-reader pipelines, and discrete sections fragment the audio
playback into stop-start chunks. The operator also routinely
select-alls the reply to feed it into other tools, and a single
prose block survives that copy where multi-section markdown gets
mangled. Scope: applies to chat-surface replies in human-driven
Claude Code sessions and tool-call narration text between Bash /
Edit / Read calls. Does NOT apply to artifacts written to files
(docs, manifests, comms records, peer-memory entries, code) since
those keep their normal structure for screen-reading and tooling.
Override: when the operator explicitly asks for a list, a table,
a heading, or a structured comparison, the carve-out applies and
structure returns for that reply, then the next reply reverts to
one-block default unless the operator extends the override.

### OPERATOR-DIRECTION QUESTIONS — Chip-Form Required (PFOR-019)

When the carpenter needs to ask the operator a directional
question — "scope this as A or B?", "which preset?", "ship now
or wait?", "this approach or that approach?" — use the
AskUserQuestion tool (chip-form interactive buttons) rather
than asking in prose and expecting the operator to type or
paste an answer back. The operator surfaced this directly:
"Questions for me for direction is easier in chips form here
not me going and reading some file and pasting answers here."
Chip-form questions render as tappable options the operator
can pick with one touch from the device they are field-testing
on; prose questions force them to switch contexts, read, type,
and paste. The chip-form path is structurally easier for an
operator who is mostly on iPhone watching the wallet behave.
Scope: when the carpenter genuinely needs the operator to
choose between options or answer a clarifying question with a
bounded set of acceptable answers, prefer AskUserQuestion. Use
two-to-four options per question, mark the recommended one as
"(Recommended)" and put it first, write each option's
description so the operator understands the implication of
picking it. Carve-out: free-form authorship requests where
chips cannot enumerate the answer space (e.g. "what is Sage's
voice?", "what should this entry's title be?") stay as prose
asks. Carve-out also for status questions the operator is
asking the carpenter — those are answered, not asked back. The
PFOR-018 one-block prose rule still governs the SURROUNDING
narrative reply; AskUserQuestion is a tool call alongside the
prose, not a replacement for it.

### LIVING-IDEAS DOCTRINE — Nothing Gets Lost

Every meaningful idea the operator surfaces — in chat, voice,
dispatch comms, any conversation — gets logged into
`project-memory/foreman-memory/core/ideas.md` (or the appropriate
project ideas file) and is then RESURFACED back to the operator at
appropriate moments so the idea matures, refines, or gets honestly
pruned. Capture rule: when the operator names a use case, connects
existing pieces to a new domain, suggests a feature or product or
vertical, articulates a value not yet captured, sketches a
technical approach worth preserving, or identifies a recurring
pattern, log it as an idea entry IN THE SAME SESSION it surfaced.
Entry includes date, tag, maturity stage, one-line summary, and
the operator's framing in their own voice when possible. Surfacing
rule: include resurfacing prompts in `.carpenter/session.json`'s
`next_session_starts_with` field when an idea has been parked for
N sessions OR fits a current question. Teach-back rule: when
surfacing, summarize the operator's idea in plain prose and ask
ONE focused clarifying question — the pedagogical engine the
operator built for other people becomes the engine that teaches
the operator his own ideas back. Pruning rule: operator may mark
any idea as wrong / drop — entry stays with `Status: pruned` +
`Reason: <words>` + `Pruned: <date>`; the mistake-caught is
preserved as part of the historical record. Maturation stages:
raw insight → sprouting → matured → fruiting body → pruned. Stage
is named in each entry and updated in place. Mycelial frame
governs: old ideas are substrate; new ideas grow from the same
soil; some mature and fruit; some stay in soil but feed future
fruits; some decompose without fruiting. None of it is wasted.

### Eyes-Payload Pattern for Chat Surfaces

If this project builds a Frank-equivalent chat surface (a
conversational AI that needs to see the project's current state,
recent commits, in-flight dispatches, build statuses, etc.), the
calling code in the cockpit-equivalent MUST ship the full eyes
payload to the edge function via `context.eyes` in the request
body. The edge function does NOT fetch eyes server-side as a
fallback when the request omits them — server-side fetching
silently drops out when caller-side payload assembly is updated to
include new fields, leaving the AI blind to the latest state. The
canonical fix pattern is AppCommander commit `52f6853` (PR #17,
2026-05-10): the `useFrankAsk` hook accepts an `eyes` parameter,
the chat surface assembles the full Foreman Eyes payload before
calling, and the edge function trusts the caller. If you find
yourself adding a server-side fetch as "graceful fallback," stop —
that's the failure mode this rule prevents.

---

## END SHARED DOCTRINE

Below this line, the skeleton's app-specific content begins.
That section describes what THIS project is, its stack, its
features, its specific roadmap — the things that distinguish
this repo from any other AppCommander-spawned project.
