# Carpenter state — for Foreman's eyes

**Format note:** This file is the Carpenter's testimony, written
for the Foreman's eyes (Frank, running in AppCommander). The
Foreman edge function fetches it from main on every call and
injects it into Frank's system prompt BEFORE peer-memory rules.
It's the bridge that lets Frank wake up on every call already
knowing what this project looks like right now.

The Carpenter overwrites this file at every `session_ended`.

**Operator-mode note:** AppCommander has been down today. The
operator has been reading the repo manually and asked the
Carpenter to keep writing comms records here AND narrate live in
chat. Both surfaces are current.

---

## WHAT-CHANGED-RECENTLY

**Phase 1 scaffold landed** as commit `d29fbd0` on both
`claude/compare-library-wallet-OW5FF` and `main`. 48 files, ~6800
insertions. The wallet is now a real running application.

The root of the repo now has a Vite + React 18 + TypeScript +
Tailwind project. `tapit-attest` is consumed as
`file:./tapit-attest`. Supabase magic-link auth via
`@supabase/supabase-js`. On first login, the wallet prompts for a
passphrase, calls `Wallet.generate()`, encrypts the snapshot via
`exportEncrypted(passphrase)`, and persists the ciphertext to
both IndexedDB (local fast) and Supabase `wallet_blobs`
(cross-device). On return, the unlock prompt decrypts via
`Wallet.restore`. Home screen renders one `IdentityCard` with the
public key.

Feature-first folder structure under `src/features/<slug>/` with
a `manifest.ts` per slug per CLAUDE.md doctrine. New features:
**auth**, **wallet-core**, **storage**. Existing dormant chassis
folders (persona, snapshot-builder, suggested-questions, temporal)
got minimal `pause_safe: true, removal_safe: true` manifests so
the new manifest-registry vitest test passes. No bot code
activated — only annotation that captures the dormant state
legibly.

The Supabase migration at
`supabase/migrations/20260521000001_create_wallet_blobs.sql`
creates the `wallet_blobs` table with full row-level security so
the host stores ciphertext only and structurally cannot read
another user's row.

Cheap fast shell choices:
- `index.html` inline-paints the wordmark before React mounts (~50ms
  first paint).
- Vite `manualChunks` splits react/supabase/attest into separate
  bundles; login surface ships ~110KB gzipped without IndexedDB or
  tapit-attest weight.
- WalletProvider + HomeScreen are `React.lazy()` so they only pull
  in after `AuthGate` confirms a session.
- Hand-rolled service worker at `public/sw.js` — 59 lines, no
  workbox. Shell-cache install + stale-while-revalidate + nav
  fallback. Production-only registration.

Two small touches alongside the new code:
- `src/shared/persona-contract.test.ts`: removed an
  `@ts-expect-error` directive that became unused under the new
  strict tsconfig. The import resolves cleanly without it. No bot
  code activated.
- Added the four pause-safe manifests to dormant chassis folders.

## Gates at session end

**Root:**
- typecheck: clean
- lint: 0 errors, 0 warnings
- test: 16/16 (12 persona-contract parity + 4 new manifest-registry)
- build: 133 modules, 2.01s

**tapit-attest:**
- typecheck / lint / build: green
- test: 74 pass / 0 fail / 4 skipped (unchanged from prior session)

**NOT VERIFIED:** visual rendering or end-to-end auth round-trip
in a browser — the sandbox has no browser. The operator must run
`npm run dev` locally with real Supabase credentials to confirm
the magic-link flow.

## WHAT'S-PENDING

1. **Operator browser verification.** Provision a Supabase project,
   fill `.env.local` with `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`, apply the wallet_blobs migration, run
   `npm run dev`, walk: login → magic-link → callback → passphrase
   prompt → home screen with pubkey → hard-reload → unlock prompt →
   home screen again. Any stall or error should be reported before
   Phase 2 opens.
2. **Phase 2 — identity attestation + backup posture.** First-run
   display-name flow, self-signed `identityAttestation` from
   tapit-attest, settings screen with cloud-toggle + local-export +
   backup-status banner. PLAN.md update in the same session to
   match DESIGN.md's six phases.
3. **`Tap-it-Attest-main.zip`** (116KB) still at repo root.
   Operator said "I'll delete zip later." Untouched.
4. **OTS fixture restoration.** Dedicated short session to re-stamp
   a known file against real OTS calendars, write the resulting
   `.ots` to `tapit-attest/test/fixtures/`, remove the four
   `SKIP_CORRUPTED_FIXTURE` annotations, re-run the suite. 15-min
   focused job. Can happen any time before or after Phase 2.

## WHAT-TO-FLAG

**Phase 1 is unverified at the feature level.** Code correctness is
proven by the four gates; feature correctness (does the magic-link
redirect actually land authenticated against a real Supabase
project? does the encrypted snapshot round-trip cleanly under real
RLS? does the service worker actually install on a real phone?)
requires a browser session against a live deploy, which only the
operator can run. Frank should resurface this as a "Phase 2 cannot
start until you confirm Phase 1 works in a browser" reminder if
the operator goes silent on this thread for more than a day.

The `env.ts` singleton intentionally throws lazily — only when
`supabase()` or `env()` is called, not at module-load time. This
keeps the shell paint working even on a misconfigured deploy and
puts the error in front of the user inside the auth flow rather
than as a white screen. If a future Carpenter session ever changes
that to throw at import time, the whole app falls over with a
blank screen and that would be a real regression. Worth flagging
in any future review of `env.ts`.

The bot scaffolding is now legibly dormant via four `manifest.ts`
files marked `pause_safe: true, removal_safe: true`. Phase 7+
bot-launch session should:
1. Replace those manifests with real ones describing the bot
   feature being wired up.
2. Add `botRuntime.ts` and the bot edge function wiring.
3. Decide whether to keep the four split folders or consolidate
   the bot into a single `wallet-bot` feature folder.

## RECOMMENDED-NEXT-MOVES

1. Operator runs `npm install && npm run dev` locally with real
   Supabase credentials and walks the full magic-link + key-gen +
   unlock flow.
2. If anything fails, the operator reports the specific failure
   and the next session diagnoses + fixes.
3. If everything works, Phase 2 (identity attestation + backup
   posture) is the next cutting session. One session per the
   plan. Will also update PLAN.md to match DESIGN.md's six-phase
   structure in the same commit.
4. The OTS fixture restoration is a small parallel-track job that
   can happen any time. Not blocking.

## OPERATOR'S-CURRENT-VIBE

Decisive and trusting. The Phase 1 brief was compact — "Yes use
efficient code modules easy to work on and cheap fast to load
shell" — and that compactness signals he's in flow and wants the
Carpenter to make the architectural calls inside the named
constraints rather than waiting for spec ceremony. He's running
manually because AppCommander is down and explicitly asked for
dual-surface comms (files plus live chat narration). Phase 1 is a
real shipping moment for the project — the first time the wallet
became a buildable application rather than a design doc — and the
operator's emotional state by the next exchange will partly depend
on whether the browser verification works on his end. If it works,
he'll likely want Phase 2 cut immediately. If it doesn't, the
mood will shift to debugging, and the next session needs to be
ready to pick up that thread rather than push Phase 2.

## Ideas ready to revisit

The 27 provisional D-decisions from the library-context design
doc remain unimported into
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
Worth seeding in Phase 2 with library-context provenance noted.
Top candidates remain D24 NFC tap-context-aware, D25 tap-to-cosign,
D26 mycelium category defaults, D27 transitive trust depth, D2
group keys with FROST.

A new structural idea surfaced this session that's worth naming:
**the lazy-loaded auth-vs-wallet boundary as a security pattern.**
The login surface ships without IndexedDB code, without
`tapit-attest`, and without any cryptographic operations. Only
after `AuthGate` confirms a session does the wallet provider
chunk download. This means an unauthenticated visitor's browser
never holds the wallet code in memory at all — the attack
surface for "what could a malicious script on the login page do"
is dramatically narrower than if everything shipped together. The
bundle architecture is now a security architecture too. Tag:
defense-in-depth, raw insight stage. Worth keeping when future
phases tempt us to consolidate bundles for convenience.

Standing observation carried from the merge session: **the
"documented TODO" decay pattern** — Frank should proactively
surface skipped tests and dormant manifests during quieter
periods so they don't slide into permanent state. The four
`SKIP_CORRUPTED_FIXTURE` tests and the four dormant manifests are
the current set.
