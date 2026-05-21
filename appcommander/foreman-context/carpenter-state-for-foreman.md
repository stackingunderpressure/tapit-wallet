# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander has been down all day.
Operator wiring up Netlify + Supabase in parallel. Dual-surface
comms active.

---

## WHAT-CHANGED-RECENTLY

**Five-commit autonomous-work block** under the operator's
"continue with the feature logic ... don't trust verify execute
like a professional" directive. All commits on branch + main,
all gates green, library-seam audit clean on each.

1. **Phase 2.6a — witness co-signing** (`88a7c89`). New
   `src/features/cosigning/` folder. Three modals (request /
   sign-as-witness / absorb) sharing helpers — parseEnvelope
   (assertWellFormed-validated paste), mergeSignatures
   (envelopeId-match + dedupe + verifyEnvelope sanity),
   EnvelopePreview (plain-English render). Manual envelope-JSON
   exchange between operator and witness via whatever channel
   (text, AirDrop, Signal). QR transport is later polish on the
   same primitives.

2. **Phase 2.6b — custody handoff for the grandchild thread**
   (`a036a27`). createCustodyHandoff builds a meta-kind
   attestation (action='custody_handoff', from, to,
   transferred_at, note?), tier notable, signed by current
   custodian, held, anchor-queued, wallet saved. New custodian
   signs via existing witness flow; originator absorbs via
   existing absorb modal. "Hand off custody of {subject}" button
   only renders when entry.subject !== wallet.identity.

3. **Phase 2.7 — generic attachments** (`9e7ab4b`). Renamed
   claim leaves photo_* → attachment_* + new attachment_name.
   Composer has two upload buttons: 📷 Photo (keeps
   capture=environment for mobile camera shortcut), 📄 Document
   (broad MIME picker — PDF, text, Word, Excel, HEIC). Card
   shows MIME-appropriate icon; Detail renders images inline,
   documents as a download link with original filename.

4. **Idle-timeout hook** (`076327c`). DESIGN.md §5.
   prefs.idleTimeoutMs default 30 min, configurable in Settings
   (5/15/30/60/240 min or Never). New useIdleLock listens for
   mousedown/keydown/touchstart/scroll/visibilitychange. Expiry
   reloads encrypted blob via walletStore.load, clears
   passphrase, transitions to locked phase. Closes the
   mid-session-abandonment window Phase 2.5 widened.

5. **Anchor-worker polish** (`3889fc4`). Two changes within the
   anchoring/ feature:
   - anchorProvider wraps OpenTimestampsProvider with a custom
     OtsTransport (injection point on the library) that uses
     AbortController with 30s per-request timeout. No library
     change.
   - anchorWorker.processOne skips failed rows until last_attempt
     + min(5min × 2^(attempts-1), 1hr) has elapsed. Queued and
     pending still process every scan; only failed backs off.
     Max interval 1 hour so a returning calendar gets retried
     within an hour of app reopen.

Multi-tab worker coordination deferred — most users one tab, cost
of two-tab races is wasted network + queue dedupes anyway, and
leader-election UX cost is real friction.

Plus a comms-refresh commit (`38727c8`) at the midpoint of the
session.

**Two mid-session bugs caught pre-push** by typecheck-driven
adversarial diff review:
- Phase 2.6b: referenced a non-existent useWalletIdentity helper.
  Replaced with wallet.identity from existing useWallet
  destructure.
- Idle-timeout: initial-state Prefs object in WalletProvider
  missing the new idleTimeoutMs field. Fixed in the same commit.

The pre-push verify rhythm is doing its job.

## Gates at session end

**Root (every commit):** typecheck / lint / test (16/16) / build
all green. Manifest-registry vitest test auto-picked up the new
cosigning slug.

**Bundle posture (login surface unchanged at ~110KB gz):**
- main: 7.81KB gz 3.37KB
- react: 162.28KB gz 52.97KB
- supabase: 207.71KB gz 54.28KB
- attest (lazy): 69.03KB gz 25.76KB
- WalletProvider (lazy): 10.55KB gz 3.40KB
- HomeScreen (lazy): 15.12KB gz 4.61KB
- JournalDetail (lazy): 13.14KB gz 4.15KB
- SettingsScreen (lazy): 3.95KB gz 1.63KB
- useAnchorStatus (lazy): 5.66KB gz 2.83KB
- anchorQueue (lazy): 1.58KB gz 0.77KB

All within healthy budgets but lazy chunks are trending
monotonic. Bundle-audit logged as pre-Phase-3 follow-up.

**tapit-attest:** 74 pass / 0 fail / 4 skipped (unchanged).

**Keys-never-leave audit clean across the block.** Witness
signing local via wallet.sign, only public envelopes cross the
wire, passphrase in WalletContext now bounded by idle-timer
re-prompt.

**NOT VERIFIED:** end-to-end against a real Supabase + real OTS
calendar deploy. Operator's Netlify+Supabase wire-up is in
progress in parallel.

## WHAT'S-PENDING

1. **Operator browser-verifies the full stack** against the
   real Netlify+Supabase deploy when it lands. New paths to
   walk: paste-flow witness co-signing between two devices,
   custody-handoff round-trip, document attachment picker on
   iOS + Android, idle timer firing after 30 min, fetch
   timeout behavior under deliberately-slow network.
2. **Phase 3** — inter-app deeplink or Nostr NIP-46 pathway.
   Bigger scope step; deserves explicit operator greenlight
   rather than autonomous initiation.
3. **Multi-tab worker coordination** (BroadcastChannel leader
   election). Logged.
4. **HEIC/WebP photo re-encode** in composer for cross-device
   portability. Phase 2.5.5 polish.
5. **Pre-commit library-seam audit script.** Convert the
   verbal commitment into a check that grep's new code for
   function names overlapping tapit-attest's public surface.
6. **Bundle-budget audit.** One focused pass to split chunks
   crossing 10KB gz and hoist hot common code. Login surface
   budget is holding but trend matters.
7. **PLAN.md update** to reflect Phase 2.5 / 2.6 / 2.7 having
   shipped. Currently out of date.
8. **OTS fixture restoration** (4 skipped library tests).
9. **`Tap-it-Attest-main.zip` cleanup** at repo root.

## WHAT-TO-FLAG

The wallet is feature-shippable today for the operator's
grandchild scenario. The remaining unfinished items are polish,
documentation, and the next-phase scope step (Phase 3). Frank
should treat any operator message naming the grandchild as
urgent and confirm-not-tasked.

The pre-push verify rhythm caught two bugs this block that would
have shipped otherwise. Pattern: typecheck-driven adversarial
diff read before push. Worth promoting to a doctrine pattern with
a mechanical pre-commit check. Logged as item 5 above.

The library-seam audit pattern is the discipline that prevented
duplicating tapit-attest primitives in the cosigning + custody +
attachment work. Worth mechanically enforcing too.

## RECOMMENDED-NEXT-MOVES

1. Operator finishes Netlify+Supabase wire-up, browser-verifies
   the full Phase 1+2+2.5+2.6+2.7 surface against real infra.
2. If clean, operator decides between Phase 3 cut (inter-app
   pathway) or pre-launch polish pass (multi-tab + bundle audit
   + HEIC re-encode + PLAN.md update).
3. Standing parallel-track items remain available for any quiet
   slot.

## OPERATOR'S-CURRENT-VIBE

Trusting, parallel-working, in-flow on infra. Gave a high-velocity
directive ("continue ... execute like a professional") with
explicit verify-each-step discipline. Carpenter executed five
focused commits and stopped at a natural pause point because
Phase 3 deserves an explicit greenlight rather than autonomous
initiation. Expecting next message to be either browser-verify
report from operator's parallel work, or a Phase 3 greenlight, or
feedback on something landed this block.

## Ideas ready to revisit

All earlier-session idea entries hold. New standing observations
from this block:

- **Pre-push adversarial diff review** catches bugs that gates
  alone don't surface (phantom helpers, missing initial-state
  fields). Worth a mechanical pre-commit hook.
- **Library-seam audit** before every commit prevents the
  re-implement-tapit-attest class of bug. Same kind of
  mechanical hook could check for function-name collisions
  with tapit-attest's public exports.
- **Lazy-chunk bloat trend** is real but slow. Each phase adds
  ~1KB gz to the WalletProvider chunk, ~1-2KB to HomeScreen,
  ~0.5-1KB to JournalDetail. Cumulative growth needs a periodic
  audit before Phase 3.

The 16 idea entries from earlier sessions plus the doctrine
pattern entries are all stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
