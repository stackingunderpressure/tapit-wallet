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

## Latest letter — 2026-05-26 late evening (Phase E4 cut 3 full UI wiring — closes Phase E arc)

### What just shipped

One substantive commit landed this session plus this close-out flush.
The operator opened with the same full-chunk delegation pattern the
last four sessions ran under — "Fire up and continue wherever the
other guy left off and fill up your contacts till you're done. Find
a good stopping point sounds delicious." — and the prior letter
named Phase E4 cut 3 as the recommended first move with one chip-form
question explicitly pre-written: how wide to scope the cut. Per
PFOR-019 and the prior letter's guidance the carpenter surfaced that
chip on session-start with four options (full cut 3, just the
org-creation picker, just the join-org modal, picker plus members
view skipping the join modal). Operator picked the recommended
"Full cut 3 (all three)" option, which committed the session to
landing all three interlocking threads in one commit. The cut closes
the Phase E arc end to end — substrate from cuts 1 and 2 was fully
landed by prior sessions, and cut 3 was purely about exposing it to
operator-visible surfaces.

Commit d0ebc55 shipped Phase 8 Phase E4 cut 3 itself. Eleven files
changed: four new files plus seven modifications. Thread one shipped
src/features/settings/JoinPolicyPicker.tsx as a React.lazy sibling
to the existing OrgRulesEditor in the same SettingsScreen lazy-load
section pattern. The AuthRule discriminated union splits two ways
at the type level — AuthRuleForOrgAction carries threshold and
eligible, AuthRuleForJoin carries a kind-tagged policy payload — and
giving the join half its own UI surface that owns the kind-specific
sub-forms for each of the six policy kinds (open / allow_list /
deny_list / requires_handshake / requires_credential /
requires_vouch) was cleaner than trying to generalize OrgRulesEditor.
The picker tracks per-kind draft fields separately from the committed
JoinPolicy so half-typed pubkey lists preserve in-progress text. SettingsScreen tracks the join policy as a separate state slot from
the org-action rules, and folds both halves into one AuthRule array
at submit time so buildAuthSubtree gets a single canonical input.
Per-kind validation mirrors what buildAuthSubtree would throw at
declaration time, but at form-input time so the operator never gets
a confusing failure toast for a structural issue the form could
have caught.

Thread two extended src/features/wallet-core/OrgIdentitySections.tsx
with a Joined-members section plus a publish-roster button. The
substrate was already there from Phase E3 cut 2 —
acceptedSelfMemberships pulls every accepted self-membership in
chronological join order, pendingSelfMemberships returns the delta
against the latest published roster, and publishOpenMemberRoster
signs and holds and anchors a fresh snapshot. The UI just had to
render the list and surface the pending-delta as an amber chip on
the button, calling publishOpenMemberRoster on tap.

Thread three was the novel piece — the new
src/features/connections/JoinOrgModal.tsx. The any-wallet join-an-org
flow takes an org self-declaration as input via paste or scan, parses
it via parseEnvelope and isOrganizationSelfDeclaration, reads the
declared join-policy via findAuthRule plus the isJoinRule type narrow,
renders the policy in plain language via a kind-dispatched
describePolicy helper, and then routes to a proof-picker step when
the policy is requires_handshake or requires_credential. The picker
filters holdings down to proof-eligible attestations — for handshake,
relationship-kind envelopes signed by both the joiner and at least
one anchor pubkey from policy.with_any_of; for credential,
credential-kind envelopes whose credential_type leaf matches the
policy and whose subject equals the joiner, optionally signed by
the named issuer. The joiner picks one, the modal calls
tapit-attest's disclosureProof on the appropriate leaf (verification
for handshake, credential_type for credential), bakes the resulting
DisclosureProofBundle into buildSelfMembershipDraft's proofs
parameter from cut 2, signs with the joiner's wallet, and offers QR
plus Mycelium delivery so the org-side acceptor can ingest the
envelope through the existing self-membership-receive routing. The
vouch policy gets a plain-prose notice on the send step explaining
that cosignatures from existing members must be collected before
submitting to the org — the full cosig orchestration sub-flow is not
wired through JoinOrgModal yet but the joiner-signed envelope is a
valid starting point for the existing cosigning surface to extend
onto.

Two same-commit extractions resolved the file-size hard-limit
overage cut 3 induced. SettingsScreen.tsx grew to 823 lines and
HomeScreen.tsx grew to 824 — both over the 800-line hard limit the
file-size test enforces. src/features/settings/OrgDeclarationSection.tsx
encapsulates the full org-creation form state machine (org name,
org rules, join policy, busy, error) plus the declareAsOrganization
handler and lazy-loads OrgRulesEditor + JoinPolicyPicker internally;
SettingsScreen drops from 823 to 656 lines after the extraction.
src/features/wallet-core/useOpenMemberRosterControls.ts encapsulates
the joinedMembers + pendingMembers useMemos plus the publishing flag
plus the publish callback that calls publishOpenMemberRoster; HomeScreen
drops from 824 to 797 lines after the hook extraction. Both
extractions are clean component-and-hook boundaries — the extracted
pieces have well-defined inputs and outputs and their internal state
machines were never reused outside their consumer screens.

Bundle budgets: three new explicit budgets (JoinPolicyPicker 3KB gz,
JoinOrgModal 6KB gz, openMemberRoster helpers 2.5KB gz); three small
bumps to existing chunks (HomeScreen 18.5→19.5KB for the openMemberRoster
static imports plus the JoinOrgModal-lazy declaration, SettingsScreen
10.5→11KB for the OrgDeclarationSection extraction landing in its
static import graph, CSS 7.5→8KB for the new Tailwind utilities the
picker sub-forms plus the modal layout plus the publish-roster amber
chip introduced into the content scanner). All three bumps absorb
measured overage of less than 100 bytes; headroom carries the next
polish cut. New chunks landed: JoinPolicyPicker at 2.20KB gz (budget
3KB), JoinOrgModal at 4.03KB gz (budget 6KB).

All four gates green throughout the cut 3 commit. Typecheck clean.
Lint clean. 255 of 255 tests passing on session start and on session
end — no test deltas because cut 3 ships UI consumers of the
already-tested substrate from cuts 1 and 2 (the existing tests for
evaluateJoinPolicy, verifyOpenJoinedMembership, buildSelfMembershipDraft,
the proof readers, acceptedSelfMemberships, pendingSelfMemberships,
and publishOpenMemberRoster all stay valid because the on-wire shape
did not change). Build OK with all bundle budgets within limits. The
file-size test now flags JoinOrgModal at 580 lines as a soft warn —
joining RecoveryInitiatorModal at 800 (right at the hard limit),
FreshOnboarding at 776, HomeScreen at 797, WalletProvider at 751,
SettingsScreen at 656, authRule.ts at 430, HandshakeModal at 723,
WalletGuide at 710 — the same list the prior carpenter would
recognize, plus the one new entry for the modal that shipped this
session.

### What's hot right now

Nothing in-flight. Working tree clean as of pre-close-out, dispatch
branch `claude/multisig-orgs-status-jiLwm` carries the one code
commit plus this close-out flush, and the branch tip is being pushed
to main per PFOR-016 (`git push origin <branch>:main`) as the final
act of close-out so the Stop-hook gate clears and the next SessionStart
hook reads a fresh letter from origin/main. Branch and main will be
at the same SHA after the push. The next carpenter inherits a clean
shared base with the Phase E arc fully closed — substrate landed
(cuts 1 and 2) AND UI landed (cut 3). Phase E ends here.

### Land-mines for the next carpenter

HomeScreen.tsx sits at 797 lines, three lines under the 800-line
hard limit. Any further addition there will trigger the hard error
and require another extraction before the change can land. Plan an
extraction up front if the next session touches HomeScreen. The
natural next extraction candidates are the inbox-routing dispatcher
(routeInbox + the per-route accept* handlers) or the tab-content
rendering for one of the four tabs.

The vouch policy path in JoinOrgModal is structurally incomplete.
The modal builds a joiner-signed envelope and surfaces a plain-prose
notice that cosignatures from existing members must be collected
before submitting to the org, but does not orchestrate that
collection itself. The existing CosignRequestModal in
src/features/cosigning/ handles fanout for org-action issuance under
threshold-greater-than-one rules; an org-context-shaped invocation
pattern extending it to vouch collection (where the eligible set is
"any pubkey already known to the org as a member" rather than a
named eligible list) is the next natural cut. Worth a chip-form
decision before code starts because the from-any-member-of-the-known
-set picker is a structurally different shape from the existing
from-this-named-eligible-list picker. The chip phrasing would be
something like: "Extend CosignRequestModal with an org-vouch context
variant / Build a separate VouchRequestModal sibling / Park the
sub-flow and require operators to use the cosigning surface manually
for vouch joins."

The describePolicy plain-language renderer plus the proof-candidate
filter helpers (findHandshakeProofCandidates,
findCredentialProofCandidates) are inlined into JoinOrgModal as
local functions. A future verifier-side UI or a Foreman briefing UI
would want the same helpers — one-file extraction when the second
consumer lands. Parked until then; same pattern as the policy
description that the prior letter named.

The connections manifest notes field is now approximately 20
kilobytes of unbroken text covering twelve phases of work — up from
17 at session start. The Phase E4 cut 3 paragraph extended it
substantially. The same markdown-sub-section refactor question the
prior letter named is still pending: do you want the manifest notes
to evolve into markdown sub-sections for legibility, or stay as
flowing prose for TTS, given that the connections manifest is now
roughly the size of a small README? Worth a chip-form question some
session — the answer affects every future manifest-update workflow.

receiveSelfMembership's orgSelfDecl parameter is still passed in by
the caller — the consistency question the prior letter named as
worth pinning before a second caller path landed. Cut 3 did NOT
introduce a second caller (JoinOrgModal builds + sends but does not
receive; HomeScreen.acceptSelfMembership remains the only receive
path), so the chip is still deferrable. Pin the chip the next session
a second receiver path is about to land: centralize the lookup
inside receiveSelfMembership (take wallet + holdings, derive
declaration via findOwnOrgDeclaration internally), or keep the
caller-side pattern uniform with the rest of the create-attestation
function family. Probably worth pinning before any Phase D charter-
amendment flow lands as a second consumer.

publishOfficialsRoster + publishOpenMemberRoster + receiveSelfMembership
all hit anchorQueue.upsert which uses IndexedDB which jsdom does not
back. Tests exercise the pure builders + signed wallet.hold directly
so the same envelope shape the production path emits is verified,
but the full publish-pipeline storage round-trip is not exercised.
Same uncertainty surface carried forward from prior phases; not
blocking. fake-indexeddb or a polyfill would close this if a future
test refactor wants storage assertions on the publish paths.

No component tests landed for the new modals or pickers. The vitest
harness is pure logic — no React Testing Library in the toolchain —
so adding component tests would require pulling testing-library/react
and configuration into the project. The pure-function substrate the
UI consumes is fully covered by the existing 255 tests; the UI-layer
untested-ness is the same coverage gap that applies to every other
modal in the codebase (HandshakeModal, MembershipModal, RecoveryInitiator
Modal, etc.) — not a Phase E4 cut 3 regression. Worth a chip-form
decision if you want to extend the toolchain.

### Operator mood-read

Same delegate-and-verify mode the last four sessions have run under.
Opening prompt was explicit about wanting maximum productive use of
the context window with a satisfying stopping point. Prior letter
named the substantive first move (Phase E4 cut 3) AND named the
chip-form question worth asking up front (cut 3 scope); carpenter
surfaced the chip immediately on session-start per PFOR-019; operator
picked the recommended full-cut-3 option in one round-trip; cut 3
then proceeded autonomously through commit plus comms flush plus
push. No mid-session operator interventions, no redirections, no
further chip-form questions beyond the opening one. One substantive
commit this session (versus three last session) but cut 3 is
structurally larger and tighter — four new files plus seven
modifications across three features, the on-wire shape unchanged,
the four gates clean, all in one cohesive cut closing the Phase E
arc. The carpenter-to-carpenter chip-form-question loop the prior
letter named as a pattern has now worked TWO sessions in a row
exactly as designed; that pattern is real and is worth naming as
documented carpenter doctrine when the operator next touches the
standing orders.

### Recommended first move for the next session

Three good options, ranked by leverage. The first is the most
substantive and continues the arc-closing momentum; the second
closes the obvious incomplete piece in JoinOrgModal; the third is
the consistency-question chip that has been deferred for two
sessions and is approaching the point where it should land before
another consumer arrives.

Option 1: Phase D charter-amendment chain. New helpers in
src/features/governance/ or src/features/connections/ —
walkCharterChain + findActiveCharter + a dissolution-endpoint
predicate. Continues the org-control axis (how an org changes its
own rules over time) in parallel with the membership-acquisition
axis Phase E just closed (how outsiders join the org). Does NOT
depend on Phase E substrate; the brief lives in
project-memory/foreman-memory/projects/tapit-wallet/briefs/ as a
charter-amendment-chain-roadmap document (verify the exact filename
before reading — the prior letter named it and Phase D was sketched
across multiple briefs). Similar level of work to cut 1 of Phase E
(one new module plus tests plus a small UI surface to expose the
charter chain on the Identity tab). Brief estimate: 1-2 sessions.

Option 2: JoinOrgModal vouch-cosignature collection sub-flow. The
missing piece flagged above. Lets a joiner under a requires_vouch
policy actually orchestrate gathering the required cosignatures from
existing org members before submitting to the org. Reuses the
existing CosignRequestModal in cosigning/ with an org-vouch-context
variant alongside the existing org-action-context variant. Chip-
worthy on session start because the picker shape (from-any-member-of-
known-set) is structurally different from the existing picker shape
(from-this-named-eligible-list); silent-picking the picker shape
would lock a UX decision the operator should see before committing.

Option 3: receiveSelfMembership orgSelfDecl-lookup centralization.
The consistency question the prior letter named as worth pinning
before cut 3 introduced a second caller path. Cut 3 did NOT
introduce a second caller (JoinOrgModal builds + sends but does not
receive), so the chip is still deferrable, but cut 3 puts a Profile-
side join flow into operator reach which means the next person to
add a batch-import or AI-driven-acceptor path will be the trigger.
Chip-worthy because it changes the create-attestation function
family's calling convention; small code change once locked. Could
be done preemptively before Phase D lands as a second consumer.

Alternative housekeeping if none of the substantive cuts appeal:
the manifest-notes markdown-sub-section refactor chip (chip-worthy
because the connections notes are now ~20KB of unbroken prose and
the answer revises a TTS-listenable doctrine), the describePolicy +
proof-candidate-filter extraction (parked until second consumer;
could be done now if extraction-discipline maintenance is the
appeal), or the component-test toolchain extension (would require
pulling testing-library/react into the project — chip-worthy because
it adds a dependency).

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
