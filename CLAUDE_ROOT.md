# CLAUDE.md — Tapit Wallet

## What this file is
Short by design. It ORIENTS; it does not ENFORCE. Enforcement is
gates — see "The gate fence". Deep detail lives in the docs this file
points at, not here. Long conversations drift: if you have lost the
thread, re-read this file before acting.

## The non-negotiables — never violate these
1. **The user's keys never leave the wallet unencrypted.** Not in an
   env var, not in a log, not in a commit, not in a database column,
   not in transit without client-side encryption. This rule outranks
   every other rule in this file. A wallet that loses a user's keys
   is not a wallet, it is a betrayal.
2. This is real, identity-touching software. The test loop is sacred.
   Nothing is "done" until typecheck / lint / test / build are green
   or honestly marked UNVERIFIED. Never claim a gate passed that you
   did not run.
3. Build the smallest useful thing, correctly. No cruft, no dead
   features, no half-finished code, no abstraction the task did not
   ask for. A wallet a non-technical person cannot use is a wallet
   that does not exist.
4. **Never re-implement `tapit-attest`.** The library is the
   load-bearing crypto core — keypair, signing, the six attestation
   kinds, the three trust tiers, the Merkle field tree, encrypted
   backup, sync, peer recovery, succession, anchoring, revocation.
   Seventy-six tests prove the math. Consume it; do not duplicate it.
   One library, one envelope standard, fleet-wide.
5. Mechanism over prose. When a rule keeps getting missed, the fix is
   a check that fails — not another paragraph in this file.
6. Compartmentalize. Feature-first modules under
   `src/features/<slug>/`, clean boundaries, each feature a slide-in
   module with a `manifest.ts` and an `index.ts` public edge.
7. Secrets stay server-side. Never in frontend code, never logged,
   never committed. ANTHROPIC_API_KEY, SUPABASE_URL,
   SUPABASE_ANON_KEY by name only. **A user's private key or seed is
   never an env var.** It lives only in the user's wallet, encrypted.
8. Direct-to-main authorized for human-driven sessions. Gates must
   pass before push. `git revert` is the safety net. Dispatched
   autonomous runs use the branch-first protocol.
9. Every session writes its comms records before it ends — see Comms.

## The thesis — why Tapit Wallet exists
1. **Identity should be something a person holds, not something a
   person rents.** Today a person's identity and reputation are rows
   in other companies' databases — LinkedIn, banks, platforms,
   government portals. Tapit Wallet inverts that. The user's keypair
   is generated on their device, never leaves unencrypted, and is the
   Merkle holder of the signed attestations that make up their
   verifiable life.
2. **One identity per person, owned by them, that every app can
   request signatures from.** The wallet is the one place keys live;
   every other app — fleet app or third-party — connects *to* the
   wallet over the Layer 2 inter-app pathway. Other apps never hold
   keys themselves.
3. **Math, not trust.** Other wallets and apps verify a Tapit
   attestation by checking signatures, not by trusting a platform.
   The platform layer is removed from the trust equation.

Every feature must serve one of these three or it does not belong.

## How the operator works
Direct answers, practical execution, modular code, mobile-first,
command-center UX, no fluff, explicit files-changed, clear diagnosis
before fixes. Chat replies: one continuous prose block,
speech-friendly — the operator listens via TTS — no headers or lists
unless he asks for them.

## Default stack
TypeScript. React 18 + Vite for the web wallet, Tailwind for styling.
Supabase for auth and the encrypted-blob sync host (the host only
ever stores ciphertext — it never sees a key). Netlify for hosting.
Anthropic Claude as the wallet bot's brain. **`tapit-attest`** as the
attestation primitive + the `Wallet` core object — chassis-inherited
at the repo root as `tapit-attest/`, consumed as a `file:`
dependency. Mobile-first, 375px design target, 44px tap targets.

## Architecture
Feature-first. `src/features/<slug>/` owns its components, hooks,
services, types, `manifest.ts`, and `index.ts` boundary.
`src/shared/` for true primitives, `src/core/` for cross-cutting.
Each feature: clear types, an isolated service layer, no deep
imports into another feature's internals. Files over 400 lines warn,
over 800 error. A feature is something you can pause, price, or
remove cleanly — its manifest says so.

The wallet is built in four layers:
- **Layer 1 — Wallet core.** The `Wallet` class from `tapit-attest`
  — already built and tested. Keypair, succession chain, attestation
  holder, sign-both-ways, encrypted backup, sync, peer recovery.
- **Layer 2 — Inter-app signing pathway.** `SignRequest` /
  `SignGrant` / `HoldRequest` message shapes, Nostr NIP-46 transport,
  a legible approval screen that shows the user what they are about
  to sign in plain English.
- **Layer 3 — The Mycelium peer network.** Wallet-to-wallet
  discovery, mutual verification, transitive trust lattice.
  **Deferred** to its own spec (`MYCELIUM_NETWORK_SPEC.md`) — not
  started until that spec exists.
- **Layer 4 — Frictionless surface + wallet bot.** The conversational
  guide built on the chassis bot runtime for non-technical users
  during key creation, backup, approval, and recovery.

Build bottom-up. See `PLAN.md` for the phased build order.

## The build flow
Discovery (already done in `DISCOVERY.md`) → derive the structure
from that discovery → build one vertical slice end-to-end → gates
green → update memory and comms → ship. Phases 1 through 4 in
`PLAN.md` define the v1 vertical slices; Phase 5 (Layer 3) is
deferred behind its own spec. Do not build ten screens before one
flow works.

## The gate fence — enforcement lives here, not in prose
The rules that matter are checks, not paragraphs:
- gates: typecheck, lint, test, build — green or honestly UNVERIFIED.
- **keys-never-leave audit:** no code path that logs, commits, or
  transmits a private key, a seed, or a decrypted snapshot. The
  rule outranks every other rule; treat any code that touches these
  values as load-bearing review surface.
- **`tapit-attest` integrity:** no re-implementation. Consume the
  library; never copy its internals.
- feature-manifest coverage test.
- branch gate: no unfinished or dead branch before new work — run
  by the SessionStart hook.
When a rule matters enough to enforce, add a check. Do not add prose
here.

## Comms — every session, no exceptions
Every session, including chat-only, before it ends writes:
`appcommander/comms/current.json` (the 10D record, replace),
`appcommander/comms/interactions.jsonl` (append),
`appcommander/comms/in-flight.jsonl` (live events as they happen),
`appcommander/comms/carpenter-opinions.md` (the three-section
narrative for the operator), and
`appcommander/foreman-context/carpenter-state-for-foreman.md` (the
handoff). The cockpit reads these — stale comms means the cockpit
is lying. The skeleton-shared Carpenter doctrine inside this
project's bundled doctrine documents has the full spec.

## Working protocols
Bug fixes: diagnose the cause, make the smallest safe fix, state the
files changed, give the test command, note remaining risk. Do not
refactor unasked. Do not add dependencies casually. Risky or
hard-to-reverse actions (force-push, deletes, anything touching
shared state, anything that touches keys) get confirmed first.

**Trust witnessed operator evidence over code reading when they
conflict.** When the operator reports observed behavior and you
cannot independently verify, the answer is "I cannot verify from
here, please check before we conclude" — not a probability estimate
dressed up as analysis.

## The doctrine map — read these when they are relevant
- `DISCOVERY.md` — the app's DNA. The problem, the user, the MVP
  scope, P0/P1 features, the anti-features, the data model.
- `PLAN.md` — the phased build order. Phases 1-4 for v1, Phase 5
  (Layer 3) deferred to its own spec.
- `tapit-attest/README.md` — the load-bearing crypto core. Six
  attestation kinds, three trust tiers, the envelope shape, the
  signing math, the v1 surface, the v1.1+ slots.
- `project-memory/foreman-memory/core/THE_THESIS.md` — why
  AppCommander exists and why this wallet is part of that fleet.
- `project-memory/foreman-memory/core/MYCELIUM.md` — the network
  spec; the long-term shape Layer 3 grows into.
- `project-memory/foreman-memory/core/HEARTH_SPEC.md` — what a
  Hearth is. A Tapit Wallet is a Hearth's identity layer.
- `project-memory/foreman-memory/core/HEARTWOOD.md` — governance
  doctrine for federated communities.
- `project-memory/foreman-memory/core/SATOSHI.md` — Bitcoin
  financial substrate; how anchoring uses OpenTimestamps for the
  public-clock layer.
- The skeleton-shared Carpenter doctrine bundled in this repo —
  the operational Carpenter rulebook (comms protocol details,
  manifest doctrine, job-code protocol, the three-section report,
  the eyes-payload pattern, the chat-reply one-block rule). Lives
  alongside this file when the bootstrap copies it in.

## Re-grounding
Before any significant action, re-state the active constraints in
one line — including the keys-never-leave rule, which is always
active. If you cannot, you have drifted — re-read this file, and
read the machinery before reasoning about it.
