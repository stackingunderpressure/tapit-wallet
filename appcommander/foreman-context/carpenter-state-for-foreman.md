# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active.

---

## WHAT-CHANGED-RECENTLY

**Bundle-budget mechanism shipped** at commit `5a933a9` on
branch + main. Third mechanism-over-prose conversion this
session-week (after library-seam audit `66637f1` and the
photo-capture/punch-list block). Per CLAUDE_ROOT.md
non-negotiable #5.

New `scripts/bundle-budget.mjs`:
- Reads every `.js` and `.css` file under `dist/assets` post-
  vite-build, gzips each, asserts size against per-pattern
  budget.
- Each currently-emitted chunk has an explicit named budget
  with 20-40% headroom above today's measured size. Patterns
  match Vite's content-hashed filenames.
- Catch-all at 3KB gz forces any new unrecognized chunk to
  surface immediately with "add a named budget" guidance.
- Failure output: file, over-by, three-fix recipe (code-split
  / audit-and-bump / refactor).
- Wired into `npm run build` after `vite build` so the build
  gate fails on budget violations. Standalone via
  `npm run check-bundle`.

**Verify-don't-trust applied to the check itself:** deliberately
tightened the QrShow budget to 5KB gz against its real 11.62KB
size, confirmed exit code 1 with the exact filename + over-by
+ three-fix message, restored to real 15KB, confirmed exit code
0 with all 18 chunks named. Mechanism works end to end.

**Mid-session caught a shell-cwd-persisted error** when running
the script after a prior `cd dist/assets`. The Node module-not-
found error surfaced the issue cleanly; recovered with explicit
`cd /home/user/tapit-wallet`. Third time this session-week.

## Gates at session end

**Root:** typecheck / lint / test (17/17) / build all green.
Build gate now includes bundle-budget assertion.

**tapit-attest:** unchanged at 82 / 78 / 0 / 4.

**Bundle posture (login surface unchanged ~110KB gz):** all 18
emitted chunks under their named budgets:
- index (login main): 3.50KB gz / 5KB budget
- WalletProvider: 3.90KB / 5.5KB
- HomeScreen: 5.37KB / 8KB
- JournalDetail: 5.29KB / 8KB
- SettingsScreen: 1.88KB / 3KB
- SignApprovalScreen: 2.83KB / 4KB
- VerifyProofScreen: under 5KB
- QrShow (qrcode lib): 11.62KB / 15KB
- QrScanModal: 1.33KB / 3KB
- WalletContext: 0.13KB / 0.5KB
- useWallet hook: 0.21KB / 0.5KB
- useAnchorWorker hook: 0.18KB / 0.5KB
- anchorQueue: 0.58KB / 1.5KB
- saveWallet: 0.78KB / 2KB
- attest vendor (lazy): 26.40KB / 35KB
- react vendor: 53.19KB / 60KB
- supabase vendor: 54.28KB / 60KB
- css: ~3KB / 6KB

**Keys-never-leave audit clean.** Doctrine-only commit, no
runtime surface touched.

**File-size rule satisfied.** Largest source file remains
`WalletProvider.tsx` at 273 lines. NO MECHANICAL CHECK YET —
that's the next mechanism candidate (see below).

## WHAT'S-PENDING

1. **Operator browser-verifies the Cut-1-through-Cut-4 punch
   list** against the live Netlify + Supabase deploy (still
   pending from the previous block). PLAN.md and prior
   comms have the walk-through.
2. **Operator-side: Cut 2 migration** still needs running in
   Supabase SQL editor if not already (the wallet_media
   bucket migration from `20260522000001_create_wallet_media_bucket.sql`).
3. **Five non-blocking follow-ups** unchanged:
   - Multi-tab worker coordination (BroadcastChannel).
   - OTS fixture restoration (4 skipped library tests).
   - `Tap-it-Attest-main.zip` cleanup at repo root.
   - Backfill remote media for pre-Cut-2 entries.
   - Total-post-auth-bytes ceiling (this block's gap — the
     per-chunk check doesn't catch death-by-a-thousand-cuts).
4. **Next mechanism candidate logged: file-size limit.**
   CLAUDE_ROOT.md mentions 400-line warn / 800 error but no
   check fails. Same conversion shape as library-seam +
   bundle-budget. Small, mechanical, preventive. Logged in
   the bundle-budget commit message and in ideas.

## WHAT-TO-FLAG

**Third mechanism conversion this session-week.** Library-seam
(commit 66637f1), now bundle-budget (5a933a9). Same pattern
each time: re-ground in CLAUDE_ROOT.md, find the verbal rule
that's been holding by attention, convert to a check that
fails. Each conversion reduces ongoing Carpenter-attention
cost. The remaining attention can go to actual product work.

**The pattern of doctrine-driven task selection is robust.**
This session: operator said "reground, next piece" — the
doctrine itself selected the task. Worth keeping crisp: when
the operator gives an ambiguous "next piece" directive, the
mechanism-over-prose non-negotiable is a reliable source for
the next-piece pick whenever a verbal rule has been holding
by attention for several sessions.

**Shell-cwd-persistence keeps biting.** Three times this
session-week. The Bash tool documentation says cwd persists;
my workflow needs to always prefix significant commands with
explicit `cd /home/user/tapit-wallet &&` when there's any
chance a prior command cd'd elsewhere. Could log as a
Carpenter operating-protocol pattern.

## RECOMMENDED-NEXT-MOVES

1. Operator browser-verifies the Cut-1-through-Cut-4 punch
   list against the live deploy whenever they're ready.
2. If clean: ship. If any stall: report the specific failure.
3. Next mechanism conversion (file-size limit) is available
   for any quiet slot.
4. The non-blocking follow-ups remain available.
5. Phase 5 (Mycelium + Shamir recovery) still waits for
   MYCELIUM_NETWORK_SPEC.md.

## OPERATOR'S-CURRENT-VIBE

Disciplined, doctrine-anchored. The "reground, verify don't
trust, take care of the next piece" directive is becoming a
recurring rhythm — each invocation produces one focused
commit that does what the doctrine asks. The mechanism-over-
prose pattern is the throughline. Expect either browser-verify
findings or another reground-and-next-piece directive next.

## Ideas ready to revisit

All earlier idea entries hold. Updated observations from this
session:

- **The third mechanism-over-prose conversion landed.** The
  conversion treatment is increasingly the right answer to
  the operator's "next piece" directives because each one
  visibly reduces the rule-keeps-getting-missed risk class.

- **File-size limit is the next mechanism candidate.**
  CLAUDE_ROOT.md 400-line warn / 800 error has been holding
  by attention but has no check. Same conversion shape.

- **Total-post-auth-bytes ceiling** is a gap in the bundle-
  budget mechanism — death by a thousand cuts where every
  chunk creeps toward its budget ceiling without any single
  chunk failing. Worth adding if the trend continues.

The 16+ earlier idea entries are stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
