# Carpenter state — for Foreman's eyes

**Format note:** This file is the Carpenter's testimony, written
for the Foreman's eyes (Frank, running in AppCommander). The
Foreman edge function fetches it from main on every call and
injects it into Frank's system prompt BEFORE peer-memory rules.

**Operator-mode note:** AppCommander has been down all day.
Operator is wiring up Netlify + Supabase in parallel. Dual-
surface comms remains active.

---

## WHAT-CHANGED-RECENTLY

**Three features shipped in autonomous-work mode** under the
operator's "continue while I get the Netlify site ready ... don't
trust verify execute like a professional" directive. Each one
landed as a single commit with library-seam audit + adversarial
diff read pre-push.

**Phase 2.6a — witness co-signing** (commit `88a7c89`). New
`src/features/cosigning/` folder. Operator A taps "Request a
co-sign" on an entry → wallet shows canonical envelope JSON in a
copyable textarea → operator hands it off via whatever channel.
Operator B taps "Sign someone else's entry" on home → pastes →
plain-English `EnvelopePreview` → "I confirm" → `wallet.sign()`
appends witness signature → copy return JSON. Operator A pastes
return into "Add a co-signer's signature" → `mergeSignatures`
helper dedupes by signer+sig and runs `verifyEnvelope` sanity →
`wallet.hold()` replaces by `envelopeId` → save. All primitives
from `tapit-attest`: `envelopeId`, `canonicalEnvelope`,
`signEnvelope` via `wallet.sign`, `verifyEnvelope`,
`assertWellFormed`.

**Phase 2.6b — custody handoff** (commit `a036a27`). The
grandparent → parents → grandchild custody arc gets its middle
step. `createCustodyHandoff` builds a meta-kind attestation,
tier `notable`, claim `{action: custody_handoff, from, to,
transferred_at, note?}`. Signed by current custodian, held,
queued for OTS anchoring, wallet saved. New custodian signs via
the existing witness flow; originator absorbs via the existing
absorb modal. Multi-signed + anchored meta-attestation is the
chain authority event. Button only renders when `entry.subject !==
wallet.identity` so self-entries don't show it.

**Phase 2.7 — generic attachments** (commit `9e7ab4b`). Claim
leaves renamed `photo_*` → `attachment_*` plus new
`attachment_name`. Composer has two upload buttons: 📷 Photo
(keeps `capture="environment"` for the mobile-camera shortcut
that the grandchild scenario depends on) and 📄 Document (broad
file picker — PDF, text, Word, Excel, HEIC). Card shows the
appropriate icon based on MIME. Detail renders images inline,
documents as a download link. downloadEntry uses original
filename when recorded. EnvelopePreview says "photo" or "document"
based on MIME.

**Mid-session bug caught + fixed pre-push:** referenced a
non-existent `useWalletIdentity` helper in JournalDetail while
wiring the custody button. The typecheck-driven adversarial diff
review caught it before commit; replaced with `wallet.identity`
from the existing `useWallet` destructure. Pattern works.

## Gates at session end

**Root:** typecheck / lint / test (16/16) / build all green on
every one of the three commits. Manifest-registry vitest test
auto-picked up the new `cosigning` slug.

**Bundle posture (login surface unchanged at ~110KB gzipped):**
- main: 7.81KB gz 3.37KB
- react: 162KB gz 53KB
- supabase: 207KB gz 54KB
- attest (lazy, post-auth): 69KB gz 25.76KB — grew to carry
  journal + meta builders
- WalletProvider (lazy): 10.55KB gz 3.40KB
- HomeScreen (lazy): 15.12KB gz 4.62KB
- JournalDetail (lazy): 13.14KB gz 4.15KB
- SettingsScreen (lazy): 3.95KB gz 1.63KB
- useAnchorStatus (lazy): 5.66KB gz 2.83KB
- anchorQueue (lazy): 1.58KB gz 0.77KB

**tapit-attest:** 74 pass / 0 fail / 4 skipped (corrupted fixture
unchanged).

**Keys-never-leave audit:** clean across all three commits.
Witness signing happens locally via `wallet.sign`; only public
envelopes cross the wire via copy-paste; the witness's key
never leaves their device; the originator's wallet only
receives a signature.

**File-size rule** (CLAUDE_ROOT.md 400-line warn): satisfied.
Largest source file remains `WalletProvider.tsx` at 273 lines.

## WHAT'S-PENDING

1. **Continuing now: idle-timeout hook** (DESIGN.md §5) —
   highest-priority security item per the verify pass. The
   passphrase lives in WalletContext as of Phase 2.5; an
   unlocked wallet stays unlocked until sign-out today, which
   means a teenager grabbing the phone has full wallet powers.
   Fix: a 30-minute idle timer that re-prompts for the
   passphrase. Small enough for one focused commit.
2. **Anchor worker fetch timeout** — AbortController with
   ~30s timeout so a slow calendar can't hang a scan.
3. **Multi-tab worker coordination** — BroadcastChannel-based
   leader election or shared worker. Two tabs currently both
   stamp the same digest.
4. **Anchor worker exponential backoff** — `min(5min × 2^attempts,
   1hr)` to be polite when calendar is down for hours.
5. **Phase 3** — Nostr NIP-46 inter-app pathway. The remote
   transport equivalent of the in-person QR/paste cosigning
   flow. Bigger session.
6. **Pre-commit library-seam audit script** — convert the
   verbal commitment into a check (grep new code for function
   names that overlap tapit-attest's public surface). Catches
   the next variant of the digest/envelopeId bug class.
7. **Bundle-budget audit** — one focused pass to split anything
   over 10KB gz and hoist common code. Login surface budget is
   holding but the lazy chunks are trending monotonic.
8. **Browser verification by operator** — pending the Netlify +
   Supabase wire-up. Specific new tests for this session:
   paste-flow round-trip between two devices for co-signing,
   restore-and-verify-anchors-preserved (the Bug #2 fix from
   the verify pass), document-attachment download round-trip.
9. **Standing parallel-track items:** OTS fixture restoration
   (4 skipped library tests), `Tap-it-Attest-main.zip` cleanup,
   HEIC/WebP re-encode polish.

## WHAT-TO-FLAG

The grandchild-clock pressure is the real schedule. The wallet
is feature-shippable today for the operator's scenario; the
remaining work is polish + security + Phase 3 networking. Frank
should treat any operator message about the grandchild as urgent
and confirm-not-tasked.

The bundle bloat trend is monotonic across phases. Currently
under budget but worth a bundle-audit session before Phase 3.

The mid-session-bug catch pattern (typecheck-driven adversarial
diff read pre-push) saved one push this session. Worth promoting
to a doctrine pattern — the "look over your shoulder" instruction
the operator gave is what made it operational.

## RECOMMENDED-NEXT-MOVES

1. Carpenter cuts the idle-timeout hook next under the same
   autonomous-work directive.
2. Then the anchor-worker polish three (fetch timeout, multi-
   tab, backoff) — could be one commit or three.
3. Operator browser-verifies whenever the Netlify+Supabase
   wire-up lands.
4. Then operator decides whether to greenlight Phase 3 (Nostr
   NIP-46) or sit on the wedge to gather real-family-use feedback
   first.

## OPERATOR'S-CURRENT-VIBE

Trusting and parallel-working. The "execute like a professional"
directive is high-velocity but not loose — explicit verify-each-
step framing. The operator is in flow on the infra side; the
Carpenter is in flow on the feature side; both threads converge
when the operator returns to browser-verify.

## Ideas ready to revisit

Standing observations from prior sessions hold. New patterns this
session worth naming:

- **The pre-commit library-seam audit** is doctrine in spirit
  but should become a check. Pattern: any new function in
  `src/features/*` whose name overlaps `tapit-attest`'s public
  exports gets flagged for review.
- **Mid-session bug catching by typecheck-driven adversarial
  diff** — the "look over your shoulder" instruction the
  operator gave fires before push, not after gates. Operationalize
  as a pre-commit step.
- **Bundle bloat is monotonic across phases.** Lazy chunks
  trending up. Watch for the moment the cumulative-download
  cost for a returning user breaks 100KB gzipped (currently
  comfortably under).

The 16 idea entries from earlier sessions plus the doctrine
pattern entries are all stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
