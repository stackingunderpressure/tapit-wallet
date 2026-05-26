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

## Latest letter — 2026-05-26 early afternoon (Phase E3 cuts 1 and 2 under Option 3 hybrid substrate)

### What just shipped

Three commits landed this session: two of code shipping Phase 8
Phase E3 cuts 1 and 2 from the open-joining brief under the
operator-locked Option 3 hybrid substrate, plus this close-out
flush commit that overwrites the comms artifacts and the letter
you are reading. The session opened with the substrate-decision
chip the prior letter named as the recommended first move — a
four-option AskUserQuestion presenting Option 1 (org publishes a
roster), Option 2 (org pre-signs an open-membership policy,
verifier walks the auth tree), Option 3 (hybrid, both proofs
valid), and Defer (keep building substrate-agnostic). The operator
picked Option 3 hybrid as recommended. That single chip-tap locked
Phase E3's scope and the session proceeded autonomously through
both substrate slices.

Cut 1 (commit 58af435) shipped src/features/governance/
evaluateJoinPolicy.ts — a pure {policy, selfMembership, holdings}
→ {accepted, reason} function that takes the JoinPolicy from
Phase E1's discriminated-union shape and returns an honest verdict
on the joiner. Three of the six policy kinds (open / allow_list /
deny_list) accept or reject purely from the envelope's joiner
pubkey with case + whitespace normalization so a mixed-case hex
pubkey arriving from a relay still matches a lowercase allow-list
entry. The other three kinds (requires_handshake /
requires_credential / requires_vouch) need joiner-side proof
attachment that Phase E2's buildSelfMembershipDraft does not yet
produce, so the evaluator rejects them with a reason naming
Phase E4 as the milestone that adds proof reading. The honest
contract: do not pretend to validate something you cannot
validate today; surface the deferred state explicitly so the
operator and verifier both know the policy starts working when
Phase E4 lands. The Phase E2 placeholder receiveSelfMembership in
createMembership.ts grew from a single-gate function (envelope
shape, then holdAndAnchor) to a three-gate function — shape, org
must hold its own self-declaration with a join rule (looked up
via findAuthRule), evaluateJoinPolicy must accept the joiner.
Reject reasons surface through Error.message so an eventual UI
surface can show the org operator why a join request did not
land. HomeScreen.acceptSelfMembership grew the wiring to pass
orgDeclaration + holdings into the new signature; early-returns
with console.warn when the wallet has not declared itself as an
org (a self-membership routed to a personal wallet has no
business getting accepted into holdings). Cut 1 added 9 new
evaluateJoinPolicy tests + 3 new receiveSelfMembership scenarios
= 12 tests (176 → 188).

Cut 2 (commit c6dcc07) shipped src/features/connections/
openMemberRoster.ts — the open-member roster envelope substrate
using the same envelope-shape pattern publishOfficialsRoster uses
since the org-mode-5b cuts. Subject = the org's pubkey,
credential_type leaf = the literal string `open_member_roster`,
members leaf = canonical JSON of {member_id, joined_at,
self_membership_envelope_id} entries sorted ascending by
joined_at then by member_id for stable tiebreaks, issued_at at
publish time. Six exports: acceptedSelfMemberships
(all self-memberships in holdings addressed to the named org,
sorted by join order), pendingSelfMemberships (delta —
accepted-set minus already-on-latest-roster, useful for showing
the operator how many new joins would be in the next snapshot),
buildOpenMemberRosterDraft (pure unsigned builder),
publishOpenMemberRoster (sign + hold + anchorQueue.upsert +
worker.kick the same way publishOfficialsRoster does),
findLatestOpenMemberRoster (latest-by-issuedAt selection
mirroring findLatestOfficialsRoster exactly), readOpenMemberRoster
(shape-tolerant member-list parser that drops malformed entries
individually). 14 new tests covering predicate, filtering by
org_id, sort order, entry shape, latest-wins, delta computation,
empty + already-published edge cases. Cut 2 added 14 tests
(188 → 202).

All four gates green throughout: typecheck clean, eslint clean,
202 of 202 tests passing (was 176; +26 across both cuts), build
clean with every named chunk under budget. HomeScreen chunk
stayed at 17.32 KB gz under the 18 KB budget. No new bundle
budgets required because openMemberRoster has no production
caller yet — Phase E4 wires the publish button. Three manifests
updated (governance, connections, transport) with cut-1 and cut-2
paragraphs explaining the new contracts.

Two small process bumps happened during cut 2. A string-escape
stumble on the connections manifest left a duplicated closing
quote that tsc caught as unterminated-string-literal; fixed in
one edit. Five strict-null-checks bumps in the new test file on
entries[0] / result[0] accesses; fixed with non-null assertions
after preceding length assertions. Both caught by the gates;
discipline of running typecheck + lint + tests + build after
each cut paid for itself.

### What's hot right now

Nothing. Working tree is clean as of pre-close-out, dispatch
branch `claude/multisig-orgs-status-jiLwm` carries the two code
commits plus this close-out flush on top of the prior session's
tip, and the branch tip is being pushed to main per PFOR-016
(`git push origin <branch>:main`) as the final act of close-out
so the Stop-hook gate clears and the next SessionStart hook reads
a fresh letter from origin/main. Branch and main are at the same
SHA. The next carpenter inherits a clean shared base with the
full Phase E3 substrate landed and Phase E4 (verifier + UI) as
the natural next arc.

### Land-mines for the next carpenter

The receiveSelfMembership signature now requires orgSelfDecl as
a parameter from the caller — a breaking change from the Phase E2
shape that took just wallet/ownerId/anchorWorker/attestation.
HomeScreen.acceptSelfMembership does the lookup correctly via the
existing orgDeclaration useMemo, but any new caller path (a
ScanEnvelopeModal flow, a batch-import path, an AI-driven
acceptor, a CLI-level wrapper) needs to remember to do the
findOwnOrgDeclaration lookup itself or it will get a confusing
throw at the gates rather than a clean "this wallet has no org
declaration" error. A worthwhile chip next session: centralize
the lookup inside receiveSelfMembership (take wallet + holdings,
derive declaration via findOwnOrgDeclaration internally), or keep
the caller-side pattern uniform with the rest of the
create-attestation function family in this domain. Either choice
is defensible; the question is consistency.

publishOpenMemberRoster hits anchorQueue.upsert which uses
IndexedDB which jsdom does not back. Tests exercise the pure
builders + signed wallet.hold directly so the same envelope shape
the production path emits is verified, but the full publish-
pipeline storage round-trip is not exercised. Same uncertainty
surface as Phase E2's receiveSelfMembership tests carried
forward; not blocking, just honest. fake-indexeddb or a polyfill
would close this if Phase E4 wants storage assertions on the
publish path.

The bundle-budget script still buckets 11 unrecognized JS chunks
under the catch-all unnamed-budget line. No change this session
because openMemberRoster has no production caller yet so it does
not form a chunk. Phase E4 will wire the publish button which
means a new chunk forms, and that is when the named-budget debt
becomes load-bearing — the catch-all grows from 11 to 12 and the
debt keeps slipping. Worth doing the bundle-budget naming sweep
BEFORE Phase E4 lands so the new chunk ships with a real budget
rather than another row in the catch-all bucket.

`createOrganization.ts` (546 lines), `governance/authRule.ts`
(430 lines), `SettingsScreen.tsx` (789 lines), `HomeScreen.tsx`
(757 lines this session) all remain in the soft-warn band. Same
extraction plans apply as the prior letter named; none blocking.
createMembership.ts grew to 251 lines this session — well under
the 400 soft warn, room to add the Phase E4 UI helpers if they
earn it without forcing a split yet.

The three-manifest governance-direction notes sentence sweep
(connections, cosigning, settings) the prior letter named is
STILL pending — FIFTH session deferred now. Low-energy
autonomous cut, keeps slipping because each session takes a
load-bearing axis. Worth picking up when a session opens without
a substantive directional pull.

### Operator mood-read

Sharp, trusting, full-chunk delegation mode. The opening prompt
was explicit: "Fire up and continue with a full chunk context
session. Any questions for me put in question chips I'll answer
for you." That is a clear instruction to (a) use AskUserQuestion
(PFOR-019 chip-form) for directional questions rather than prose
escalation, and (b) fill the full context window with productive
work rather than parking early in a safe spot. The substrate-
decision chip was the single most important pending decision;
surfacing it immediately as the first move was the right call
and the operator picked the recommended Option 3 hybrid without
prose pushback. The session then ran autonomously through both
cuts — no mid-session redirection, no chip-form questions
surfaced after the first one, no operator intervention needed.
Tonally the operator is in pure delegate-and-verify mode: trusts
the carpenter to choose scope inside the locked substrate, expects
the close-out narrative (carpenter-opinions.md three-section,
this letter) to be the operator-facing surface, prefers the
chip-form interface for any future directional question that can
be enumerated. Honest mood-read: this is the kind of session the
operator built the doctrine to enable — one chip up front, one
full-chunk autonomous run, one close-out flush at the end.

### Recommended first move for the next session

Phase E4 — verifier plus UI. verifyOpenJoinedMembership composes
findAuthRule (for the Option 2 auth-tree walk under hybrid) with
findLatestOpenMemberRoster + readOpenMemberRoster (for the
Option 1 roster walk under hybrid); under hybrid, accept whichever
proof verifies. UI work: org creation form gains a membership-
policy picker (open / allow_list / requires_handshake /
requires_credential), org-mode Identity tab gains a Members view
rendering the chronological roster (founder first by anchor
height, joiners after), a publish-roster button plus a
pending-delta surface so the operator sees how many new joins
would land in the next snapshot, and any-wallet Profile gains a
Join-an-org flow (paste / scan org pubkey → see declared join
policy → click Join → self-membership signed + shipped over
Mycelium). Brief estimates 2-3 sessions for the full Phase E4
arc; a reasonable first cut is just the verifier function plus
its tests, with the UI work split across cuts 2 and 3 of E4.

Alternative first moves if Phase E4 is too big a swing: Phase D
charter-amendment chain (walkCharterChain + findActiveCharter +
dissolution endpoint — continues the org-control axis in parallel
with the membership-acquisition axis, does NOT depend on Phase E
substrate); the three-manifest governance-direction notes sweep
(low-energy autonomous polish, FIFTH session deferred now); the
bundle-budget unnamed-chunk hygiene sweep (11 chunks need named
budgets, worth doing BEFORE Phase E4 wires a new chunk); the
`createOrganization.ts` officials-roster extraction (~75 lines
into a sibling, drops the file under the soft warn).

If the SessionStart hook injected something that contradicts what
is above, trust the SessionStart hook — it reads from origin/main
and this file was current at the time of writing. Drift detection
in the same hook will flag if your branch has fallen behind main.

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
