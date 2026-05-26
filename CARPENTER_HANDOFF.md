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

## Latest letter — 2026-05-26 late afternoon (Phase E4 cut 1 verifier + bundle-budget hygiene + manifest sweep)

### What just shipped

Three substantive commits landed this session plus this close-out
flush. The operator opened with explicit full-chunk delegation —
"Fire up and continue on fill up your session with as much context
as you're comfortable taking on" — and the prior letter named Phase
E4 cut 1 (the verifier function) as the recommended first move with
the design fully composable from already-shipped substrate. That
meant no design chip was needed up front; the work was concretely
defined, and the session opened directly into it.

Commit 05dff84 shipped Phase 8 Phase E4 cut 1 — the open-joined-
membership verifier at src/features/connections/
verifyOpenJoinedMembership.ts (200 lines) plus its test file (246
lines, 19 new tests). The verifier is a pure composer over six
already-shipped pieces from Phase E1/E2/E3: findAuthRule + isJoinRule
from governance/authRule.ts, evaluateJoinPolicy from governance/
evaluateJoinPolicy.ts, isOpenMemberRoster + readOpenMemberRoster
from openMemberRoster.ts, isSelfMembership from createMembership.ts,
isOrganizationSelfDeclaration from createOrganization.ts. The single
export verifyOpenJoinedMembership(envelope, orgSelfDecl, currentRoster?)
returns {valid, reason, proofPath} where proofPath names 'roster' on
Option 1 success, 'auth_tree' on Option 2 success, or 'none' on
rejection. Four structural gates run first (envelope is a self-
membership, orgSelfDecl is an org self-declaration, envelope org_id
matches orgSelfDecl.subject case-insensitively, envelope signed by
its subject, orgSelfDecl signed by the org); then the roster path
is tried (cheaper, single auditable artifact — roster must be
subject-bound to the org, signed by the org, and contain an entry
where member_id matches the joiner AND self_membership_envelope_id
matches envelopeId(envelope)); then the auth-tree path falls back
via findAuthRule + isJoinRule + evaluateJoinPolicy. Both paths
rejecting yields a consolidated reason naming both attempted paths.

Commit 1946cc8 shipped the bundle-budget unnamed-chunk hygiene sweep
the prior letter named as worth landing BEFORE Phase E4 wires UI
chunks. Eleven chunks that previously bucketed under the catch-all
"(unrecognized js chunk — add a named budget)" line gained explicit
named budgets in scripts/bundle-budget.mjs with roughly 40-50%
headroom above current gzipped size and an inline comment per chunk
naming what it carries and the growth direction it can absorb. The
11 chunks were the Fresh-theme Today-tab components (composeFAB,
crew layout, memories strip, streak indicator, today carousel), two
utility modals (QuickShare, ShareProof), the Tier V presence
helpers, the normalize-image helper, the onboarding-holder constant,
and the WebAuthn wrappers. The catch-all stays in place as the
safety net for genuinely-new chunks but no longer fires for chunks
that ship today.

Commit 780bd50 shipped the three-manifest governance-direction
notes sweep that the last FIVE close-out letters named as worth
doing. cosigning/manifest.ts gained a sentence explaining the
Phase 8 Phase C cut 3 orgContext mode on CosignRequestModal (reads
the auth rule via findAuthRule, shows a banner naming action +
threshold, replaces the general PeerPicker with an eligible-signers
picker scoped to the rule's eligible set). settings/manifest.ts
gained a sentence explaining the Phase 8 Phase C cut 2 OrgRulesEditor
(the React.lazy multi-rule editor at org-self-declaration time) plus
AppearanceSection (Fresh-theme controls). connections/manifest.ts,
already extensively documented on the governance side, gained a
short anchor framing sentence positioned between the credential-vs-
handshake intro and the per-phase paragraphs that names the
substrate-as-foundation dependency direction crisply.

All four gates green throughout all three commits: typecheck clean,
eslint clean, 202 of 202 → 221 of 221 tests passing (+19 from cut 1),
build OK with every chunk now bucketed under its own named budget.

### What's hot right now

Nothing in-flight. Working tree is clean as of pre-close-out, dispatch
branch `claude/multisig-orgs-status-jiLwm` carries the three code
commits plus this close-out flush on top of the prior session's tip,
and the branch tip is being pushed to main per PFOR-016
(`git push origin <branch>:main`) as the final act of close-out so
the Stop-hook gate clears and the next SessionStart hook reads a
fresh letter from origin/main. Branch and main are at the same SHA.
The next carpenter inherits a clean shared base with the Phase E4
verifier landed and the Phase E4 cut 2 (proof-required policy
extensions) as the natural next arc.

### Land-mines for the next carpenter

Phase E4 cut 2 has a real design choice worth chipping up front
before any code lands. The three proof-required policy kinds
(requires_handshake / requires_credential / requires_vouch) need
joiner-side proof attachment to the self-membership envelope, and
there are two attachment shapes available: attach the FULL
attestation as a canonical-JSON leaf (simplest to verify, biggest
envelope) or attach a disclosureProof bundle from tapit-attest
(smaller, requires verifyDisclosureProof composition, more aligned
with the Tapscript-style reveal-one-leaf discipline). Carpenter's
recommendation in carpenter-opinions.md section 2 is disclosure-
proof for credential and handshake (both already have disclosure-
proof-shaped reveal paths through tapit-attest), and full-cosignature
for vouch (already on the envelope's signatures field). Whatever the
operator picks, the answer locks the shape of every future open-
joined-with-proof envelope, so it's worth the chip-form question
up front rather than just picking and shipping.

The connections manifest notes field is now around fourteen
kilobytes of unbroken text covering ten phases of work. A future
reader looking for "what does the open-member roster do" or "where
does verifyOpenJoinedMembership live" has to scan a wall of text.
A markdown-shaped notes field with sub-sections would surface the
structure better — and the manifest type allows multi-line strings,
so the readability cost is real and the migration cost is one
search-and-replace. The connections feature is approaching the point
where its manifest is itself the leading indicator that the feature
has grown too big to document as one prose blob. Worth a clean-up
cut some session when nothing more substantive is calling.

The receiveSelfMembership signature still requires orgSelfDecl as a
parameter from the caller (the prior letter named this). HomeScreen.
acceptSelfMembership does the lookup correctly via the existing
orgDeclaration useMemo, but any new caller path (a ScanEnvelopeModal
flow, a batch-import path, an AI-driven acceptor) needs to remember
to do the findOwnOrgDeclaration lookup itself or it will get a
confusing throw at the gates. A worthwhile decision next session:
centralize the lookup inside receiveSelfMembership (take wallet +
holdings, derive declaration via findOwnOrgDeclaration internally),
or keep the caller-side pattern uniform with the rest of the
create-attestation function family. Either choice is defensible;
the question is consistency.

`createOrganization.ts` (546 lines), `governance/authRule.ts` (430
lines), `SettingsScreen.tsx` (789 lines), `HomeScreen.tsx` (757
lines) all remain in the soft-warn band. Same extraction plans
apply as the prior letter named; none blocking. The cleanest
extraction is createOrganization.ts → officialsRoster.ts (~185
lines moved, drops the file from 546 to ~361, mirrors the
openMemberRoster.ts file structure for a satisfying parallel since
the two roster shapes serve the two halves of the membership
lifecycle — governance vs membership). Carpenter considered taking
it on as a fourth commit this session but the session was already
substantive and the extraction deserves a fresh session's full
attention.

publishOpenMemberRoster + receiveSelfMembership both hit
anchorQueue.upsert which uses IndexedDB which jsdom does not back.
Tests exercise the pure builders + signed wallet.hold directly so
the same envelope shape the production path emits is verified, but
the full publish-pipeline storage round-trip is not exercised.
Same uncertainty surface as Phase E2 and E3 carried forward; not
blocking, just honest. fake-indexeddb or a polyfill would close
this if Phase E4 wants storage assertions on the publish path.

### Operator mood-read

Same delegate-and-verify mode the prior session ran under. Opening
prompt was explicit about wanting maximum productive use of the
context window. Prior letter named the substantive first move
(Phase E4 cut 1) and the design was fully concrete, so no opening
chip was needed; carpenter proceeded autonomously. After cut 1
landed with ample context remaining, carpenter pivoted to two
architectural-polish items the prior letter explicitly named as
worth landing BEFORE Phase E4 UI lands — bundle-budget hygiene and
the FIFTH-session-deferred manifest sweep — and shipped both with
all four gates green throughout. Mid-session there were no operator
interventions, no redirections, no chip-form questions surfaced.
The session was three substantive commits, none of which required
directional input from the operator beyond the opening permission
to fill the context window. Honest mood-read: this is the kind of
session the operator built the doctrine to enable — clear handoff
from the prior letter, autonomous execution against a concrete
plan, polish slotted in after the substantive cut, one close-out
flush at the end.

### Recommended first move for the next session

Phase E4 cut 2 — proof-required policy kinds. Open the session with
a chip-form question to lock the proof-attachment shape (full
attestation vs disclosureProof bundle); recommended option per
carpenter-opinions.md section 2 is disclosure-proof for credential
and handshake, full-cosignature for vouch. Once the chip is locked,
the cut splits as: (a) extend buildSelfMembershipDraft to accept
optional proof-attachment parameters that emit new canonical-JSON
leaves on the envelope (handshake_proof / credential_proof — the
vouch case needs no new leaf since cosignatures already ride
signatures[]), (b) extend evaluateJoinPolicy to read those leaves
and verify them via the appropriate primitive (verifyDisclosureProof
for credential and handshake; signature-count against known-member
set for vouch), (c) extend the connections manifest notes with a
Phase E4 cut 2 paragraph, (d) all four gates green. The
verifyOpenJoinedMembership public signature stays stable — cut 2
work is internal to the evaluator. One session for design + the
first policy kind (probably requires_credential since it's the
cleanest); the remaining two kinds can slot into the same
architecture in follow-on cuts. After cut 2 lands, cut 3 wires the
UI: org-creation membership-policy picker (open / allow_list /
requires_handshake / requires_credential), org-mode Identity tab
gains a Members view rendering the chronological roster (founder
first by anchor height, joiners after), publish-roster button +
pending-delta surface, any-wallet Profile gains a Join-an-org flow
(paste / scan org pubkey → see declared join policy → click Join →
self-membership signed + shipped over Mycelium).

Alternative first moves if Phase E4 cut 2 is too design-heavy for
the next session: Phase D charter-amendment chain (walkCharterChain +
findActiveCharter + dissolution endpoint — continues the org-control
axis in parallel with the membership-acquisition axis, does NOT
depend on Phase E substrate); createOrganization.ts officials-roster
extraction (~185 lines into officialsRoster.ts sibling, drops file
from 546 to ~361 well under soft warn, mirrors openMemberRoster.ts
file structure); connections manifest notes refactor to markdown
sub-sections (lowers cognitive load for future readers, mechanical
search-and-replace).

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
