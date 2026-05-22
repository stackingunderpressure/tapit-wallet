# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active.

---

## WHAT-CHANGED-RECENTLY

**Two mechanical guardrails shipped** under the operator's "cut
away, verify and justify every change, continue adding
guardrails" directive. Branch and main at `75033ec`.

1. **File-size guardrail** (`57e32bc`). `src/file-size.test.ts`
   walks every wallet source file, counts total lines, applies
   CLAUDE_ROOT.md lines 83-84's two tiers: `console.warn`
   (non-fatal) over 400 lines, test FAILS over 800. Largest
   wallet file today is WalletProvider.tsx at 273 lines — check
   passes clean, stands guard.

2. **Keys-never-leave guardrail** (`75033ec`). `src/keys-never-leave.test.ts`
   greps every wallet source file for two hard-fail patterns:
   console.* calls passing a secret-named identifier
   (privateKey/passphrase/seed/mnemonic/secretKey), and
   localStorage/sessionStorage.setItem with a secret identifier.
   This is the mechanical check for non-negotiable #1 — "keys
   never leave unencrypted, outranks every other rule" — which
   previously had NO check. Documented gaps (not silent):
   "transmits" on-wire (structurally prevented by encrypt-
   before-network storage design) and indirect object leaks
   (console.log(wallet)).

Both verified by deliberate canary:
- file-size: lowered threshold to 200, confirmed WalletProvider
  (273 lines) trips it, restored.
- keys-never-leave: injected console.log of passphrase into
  createJournalEntry, confirmed caught at exact file+line+kind,
  restored byte-identical from backup.

## GATE FENCE STATUS — now complete

CLAUDE_ROOT.md gate fence names five rules that matter enough to
enforce. As of this session all five are covered:
- **gates (typecheck/lint/test/build)** — base gates, always run.
- **keys-never-leave audit** — `src/keys-never-leave.test.ts` ✓ NEW
- **tapit-attest integrity** — `src/library-seam.test.ts` ✓
- **feature-manifest coverage** — `src/features-registry.test.ts` ✓
- **branch gate** — SessionStart hook concern, not a vitest test.

Plus two non-gate-fence mechanical checks added this week:
- **bundle-budget** — `scripts/bundle-budget.mjs`, build-step ✓
- **file-size 400/800** — `src/file-size.test.ts` ✓ NEW

The doctrine is now legible in test results. Five mechanism-over-
prose conversions total this session-week.

## Gates at session end

**Root:** typecheck / lint / test (19/19 across 5 test files:
persona-contract, features-registry, library-seam, file-size,
keys-never-leave) / build all green.

**tapit-attest:** unchanged 82 / 78 / 0 / 4.

**Both new guardrails pass clean** on current code — no wallet
file over 400 lines, no wallet file logs or web-stores a secret.

**Keys-never-leave audit:** now MECHANICAL plus still load-
bearing review surface per the gate fence for any code touching
keys.

**File-size rule:** now MECHANICAL. Largest file WalletProvider.tsx
at 273 lines.

## WHAT'S-PENDING

1. **Operator browser-verifies the Cut-1-through-Cut-4 punch
   list** plus the full v1 stack against the live Netlify +
   Supabase deploy. Still pending; verify-checklist in PLAN.md
   and recent comms.
2. **Operator-side: Cut 2 migration** (`20260522000001_create_wallet_media_bucket.sql`)
   in Supabase SQL editor if not already run.
3. **Lower-value guardrail candidates** (NOT cut — surfaced for
   operator decision, would risk cruft per non-negotiable #3 if
   added without need):
   - Total-post-auth-bytes ceiling — bundle-budget gap
     (death-by-a-thousand-cuts). Worth it if the trend climbs.
   - Manifest touches-array accuracy — Carpenter leans AGAINST
     (friction on every file add, low cost of staleness).
4. **Non-blocking follow-ups** unchanged: multi-tab worker
   coordination, OTS fixture restoration (4 skipped library
   tests), Tap-it-Attest-main.zip cleanup, backfill remote
   media for pre-Cut-2 entries.
5. **Phase 5** (Mycelium + Shamir recovery) still waits for
   MYCELIUM_NETWORK_SPEC.md.

## WHAT-TO-FLAG

**The gate fence is mechanically complete.** Every rule
CLAUDE_ROOT.md names as worth enforcing is now either a base
gate or a mechanical check, except the branch gate which is a
SessionStart hook. The guardrail-adding directive has a natural
stopping point here — further checks would be inventing
enforcement for rules the doctrine does not name, which
non-negotiable #3 warns against. The Carpenter stopped at two
doctrine-named guardrails rather than manufacturing marginal
ones.

**Keys-never-leave is now mechanical but still heuristic.** It
catches the by-name developer-mistake class (debug-logging a
secret, web-storing a passphrase). It does NOT catch indirect
object leaks or on-wire transmits. The gate fence's "load-
bearing review surface" guidance for key-touching code still
applies on top of the check. Frank should treat any new code
that touches the Wallet object, the passphrase, or a network
call as review surface even with the check passing.

**The operator-verification debt is the real open item.** Five
mechanism conversions + a full punch list shipped this session-
week, all gate-level confidence only. Browser verification
against the live deploy is the bridge to feature-level
confidence and is operator-side work.

## RECOMMENDED-NEXT-MOVES

1. Operator browser-verifies the live deploy against the
   PLAN.md checklist.
2. If clean: ship. If any stall: report the specific failure.
3. The two lower-value guardrail candidates are available if
   the operator wants them; the Carpenter recommends the
   total-bytes ceiling only if the bundle trend keeps climbing
   and recommends against the touches-accuracy check.
4. Phase 5 holds for MYCELIUM_NETWORK_SPEC.md.

## OPERATOR'S-CURRENT-VIBE

Disciplined, guardrail-focused, doctrine-anchored. The recurring
"reground, verify don't trust, next piece / continue adding
guardrails" rhythm has produced five mechanism conversions
across the session-week, each a clean focused commit. The
operator values the mechanism-over-prose pattern and the
verify-don't-trust discipline; the Carpenter has matched both.
The natural completion of the gate fence is a good moment for
the operator to either pivot to browser verification or name a
new direction. Expect one of those next.

## Ideas ready to revisit

All earlier idea entries hold. Updated this session:

- **The gate fence is mechanically complete.** Five mechanism-
  over-prose conversions: manifest coverage, tapit-attest
  integrity, bundle-budget, file-size, keys-never-leave. The
  doctrine's enforce-worthy rules are now checks.

- **Two lower-value guardrail candidates remain** but the
  Carpenter deliberately did NOT cut them to avoid cruft:
  total-post-auth-bytes ceiling (worth it if bundle trend
  climbs) and manifest touches-accuracy (recommended against —
  friction outweighs benefit).

- **Mechanism converts attention to leverage.** Each check is a
  one-time withdrawal from the Carpenter's attention budget
  that never has to be repaid. The reclaimed attention is the
  real product — future sessions spend more on the feature and
  less on remembering the rules.

The 16+ earlier idea entries are stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
