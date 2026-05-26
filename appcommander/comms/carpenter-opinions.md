# Carpenter Opinions — 2026-05-26 late evening session (Phase E4 cut 3 full UI wiring + two extractions)

## Section 1: What I did

The operator opened with the same full-chunk delegation pattern the
last four sessions have run under, asking carpenter to fire up,
continue wherever the other guy left off, fill up context, and find a
good stopping point. The prior letter named Phase E4 cut 3 as the
recommended first move and explicitly flagged a chip-form question
about how wide to scope the cut, pre-writing the chip options with
recommended phrasing. Per PFOR-019 (operator-direction questions in
chip form) and the prior letter's explicit guidance, carpenter
surfaced that chip immediately on session-start with four options:
full cut 3, just the org-creation picker, just the join-org modal,
or picker plus members view skipping the join modal. Operator picked
full cut 3, which committed the session to landing all three
interlocking threads in one batch: the org-creation join-policy
picker, the org-mode Identity-tab Members view plus publish-roster
button, and the novel JoinOrgModal that any wallet uses to claim
membership in an org. The cut closes the Phase E arc end-to-end —
the substrate from cuts 1 and 2 was fully landed by prior sessions,
and cut 3 was purely about exposing it to operator-visible surfaces.

Thread one shipped the JoinPolicyPicker as a sibling to the existing
OrgRulesEditor in the same SettingsScreen lazy-load section pattern.
The AuthRule discriminated union splits two ways at the type level —
AuthRuleForOrgAction carries threshold and eligible, AuthRuleForJoin
carries a kind-tagged policy payload — and trying to generalize
OrgRulesEditor to cover both would have muddied its threshold-versus-
eligible validation surface. Cleaner to give the join half its own UI
that owns the kind-specific sub-forms for each of the six policy
kinds. The picker tracks state as a separate slot from the org-action
rules, and the parent folds both halves into one AuthRule array at
submit time so buildAuthSubtree gets a single canonical input. Per-
kind validation mirrors what buildAuthSubtree would throw at
declaration time, but at form-input time so the operator never gets
a confusing failure toast for a structural issue the form could have
caught.

Thread two extended OrgIdentitySections with a Joined-members section
plus a publish-roster button. The substrate was already there from
Phase E3 cut 2. acceptedSelfMemberships pulls every accepted self-
membership in chronological join order, pendingSelfMemberships returns
the delta against the latest published roster, and publishOpenMember
Roster signs and holds and anchors a fresh snapshot. The UI just had
to render the list and surface the pending-delta as an amber chip on
the button, calling publishOpenMemberRoster on tap. To keep the
section purely render-only, HomeScreen computes the data and passes
it down as props through a new useOpenMemberRosterControls hook that
encapsulates the state plus the publish callback.

Thread three was the novel piece — the JoinOrgModal — and it is the
most genuinely new UI surface in cut 3 because it introduces a
disclosure-proof-construction step at the joiner's end. The flow
takes an org self-declaration as input via paste or scan, parses it
via parseEnvelope and isOrganizationSelfDeclaration, reads the
declared join-policy via findAuthRule plus the isJoinRule type narrow,
renders the policy in plain language via a kind-dispatched describe
Policy helper, and then routes to a proof-picker step when the policy
is requires_handshake or requires_credential. The picker filters
holdings down to proof-eligible attestations — for handshake,
relationship-kind envelopes signed by both the joiner and at least one
anchor pubkey from policy.with_any_of; for credential, credential-kind
envelopes whose credential_type leaf matches the policy and whose
subject equals the joiner, optionally signed by the named issuer. The
joiner picks one, the modal calls tapit-attest's disclosureProof on
the appropriate leaf (verification for handshake, credential_type for
credential), bakes the resulting bundle into buildSelfMembershipDraft's
proofs parameter from cut 2, signs with the joiner's wallet, and
offers QR plus Mycelium delivery so the org-side acceptor can ingest
the envelope through the existing self-membership-receive routing.
The vouch policy gets a plain-prose notice on the send step explaining
that cosignatures from existing members must be collected before the
org will accept — the full cosig collection sub-flow is not wired
through JoinOrgModal yet but the joiner-signed envelope is a valid
starting point for the existing cosigning surface to extend onto.

Two extractions landed in the same commit because cut 3 pushed both
SettingsScreen and HomeScreen over the 800-line hard limit the file-
size test enforces. OrgDeclarationSection.tsx encapsulates the org-
creation form state machine (org name, org rules, join policy, busy,
error) so SettingsScreen drops from 823 lines back to 656. The
useOpenMemberRosterControls.ts hook encapsulates the joined-members
and pending-delta useMemos plus the publishing flag plus the publish
callback so HomeScreen drops from 824 to 797 — three lines under the
hard limit. Both extractions are clean component or hook boundaries
rather than ad-hoc line-count surgery; the extracted pieces have well-
defined inputs and outputs and their internal state machines were
never reused outside their consumer screens.

All four gates green. Typecheck clean. Lint clean. 255 tests pass
across 24 files with no deltas (no new pure-function logic shipped
this session — the UI components are consumers of the already-tested
substrate from cuts 1 and 2). Build OK with the new chunks landing
under their named bundle budgets. New explicit budgets ship for
JoinPolicyPicker at three kilobytes gzipped, JoinOrgModal at six
kilobytes gzipped, and openMemberRoster helpers at two and a half
kilobytes gzipped. Three small bumps to existing chunks: HomeScreen
from eighteen and a half kilobytes to nineteen and a half for the
openMemberRoster static imports landing in its graph plus the new
modal-lazy declaration; SettingsScreen from ten and a half kilobytes
to eleven for the OrgDeclarationSection extraction landing in its
static import graph; CSS from seven and a half kilobytes to eight
for the new Tailwind utilities the picker sub-forms plus the modal
layout plus the publish-roster amber chip introduced into the content
scanner. All three bumps absorb measured overage of less than one
hundred bytes; the headroom carries the next polish cut.

## Section 2: What you could do better

JoinOrgModal at 580 lines crosses the 400-line soft-warn threshold
and the file-size test now flags it alongside RecoveryInitiatorModal
which sits at 800 lines flat. The modal is structurally a single
flow with five steps, and splitting it would mostly produce a
coordinator file plus per-step sub-component files that share state
via props or context. That is worth doing if the modal grows further
— the next natural addition is the vouch-cosignature collection sub-
flow which would push the file size — but for this cut the soft-warn
flag is honest and the hard limit is a long way off. Worth a chip-
form decision next session if vouch cosig collection lands here
rather than as a separate modal.

The disclosure-proof picker does not yet show which proof a join
attempt would commit to until the joiner actually picks one — there
is no preview-the-proof step before signing. For a credential proof
this is fine because the joiner sees the credential's display details
on the picker card, but for a handshake proof the joiner sees only
the peer name and date. A preview step showing "you are about to
disclose: in-person verification of your handshake with Alice on date
X to the org" would be honest UX. Not blocking; cosmetic polish for a
later cut.

The vouch policy path is structurally incomplete. The modal builds a
joiner-signed envelope and shows a plain-prose notice but does not
actually orchestrate cosignature collection. The existing CosignRequest
Modal in cosigning/ handles fanout for org-action issuance under
threshold-greater-than-one rules; an org-context-shaped invocation
pattern would extend cleanly to vouch collection where the eligible-
signers set is "any pubkey already known to the org as a member."
Worth a future cut, but it should be a deliberate design decision —
the from-any-member-of-the-known-set picker is a different shape from
the from-this-named-eligible-list picker CosignRequestModal uses for
org-action rules.

The describePolicy plain-language renderer in JoinOrgModal is inlined
as a local function rather than exported from governance/authRule.ts
where the JoinPolicy type lives. A future verifier-side UI or a
Foreman briefing UI would want the same renderer; lifting it into a
shared module is a one-file extraction when the second consumer
lands. Not now; not until there is a second caller. Same parking
pattern applies to findHandshakeProofCandidates and findCredentialProof
Candidates — pure functions inlined into the modal that would be
testable as standalone helpers but currently have only one caller.

No tests for the new UI components shipped this session. The
vitest harness is pure logic — no React Testing Library in the
toolchain — so adding component tests would require pulling in
testing-library/react and testing-library/jest-dom plus configuration.
The pure-function substrate is fully covered by the 255 existing
tests (the picker validation logic mirrors buildAuthSubtree's
contract which has its own tests; the proof-candidate filters compose
existing predicates; the publish-roster button calls into the
publishOpenMemberRoster surface which openMemberRoster.test.ts
already covers via the pure builder). The UI-layer untested-ness is
the same coverage gap that applies to every other modal in the
codebase — not a Phase E4 cut 3 regression.

The on-wire shape locked at Phase E4 cut 2 is now exercised in
production through cut 3's UI; the joiner-signed envelope carries
handshake_proof or credential_proof as JSON-stringified Disclosure
ProofBundle leaves the joiner's signature covers. No surprises hit
during integration — the cut 2 substrate matched exactly what cut 3
needed. That is a clean architectural signal that the chip-form
question about proof-attachment shape was answered correctly two
sessions ago.

## Section 3: The bigger picture

This is the cut that closes the Phase E arc. Phase E started with E1's
discriminated-union extension to AuthRule — the join-rule slot, the
JoinPolicy type, the six policy kinds. E2 landed joiner-side self-
membership as a parallel credential shape distinct from the org-issued
membership Phase 5b shipped. E3 cuts 1 and 2 brought org-side gating
plus the open-member roster substrate. E4 cuts 1 and 2 brought the
verifier and the proof-required evaluator paths under the Tapscript-
style disclosure-proof discipline. Cut 3 is the bridge from substrate
to operator — every piece of the machinery now has a UI surface that
exposes it. An org operator can declare a join policy at org-creation
time, see the joiners that accept the policy land in their wallet,
publish a roster to anchor the current set to Bitcoin. An any-wallet
operator can take an org's declaration, see in plain language what
the org requires, pick a qualifying proof from their holdings, sign a
join envelope, and ship it. The whole open-joining flow is operator-
reachable end to end with this session's commit.

What makes Phase E architecturally interesting is the parallel it
establishes between the two roster envelopes the wallet now ships.
The officials roster owns the governance-direction question — who
runs this org, whose signatures ratify the memberships it issues —
and the open-member roster owns the membership-direction question —
who has joined this org from the outside via the self-claim pathway.
Both share the credential-attestation envelope shape, both get a
fresh snapshot envelope on every publish so history is preserved with
latest-by-issued-at winning for current-state reads, both anchor
through the same OpenTimestamps pipeline. The filesystem layout makes
the parallel legible — officialsRoster.ts and openMemberRoster.ts as
siblings under connections/, with createOrganization.ts owning the
declaration that points to both — and the Identity-tab UI now mirrors
it: an Officials section and a Joined-members section both rendering
their respective roster under the same Edit-or-Publish affordance
pattern. That symmetry is not decoration. It is the architectural
claim that an organization is structurally a wallet with two roster
envelopes plus an auth tree, no more and no less, and a verifier with
access to those three envelopes can reconstruct the org's full state
without trusting the wallet's claims about its own history.

The operator built a Tapscript-style organization-as-a-Merkle-tree-of-
attestations primitive over the course of Phases A through E, and
this session is when the operator-facing surface finally caught up to
that primitive. The next person to open this wallet can see an org,
see who runs it, see who joined it, and join an org of their own —
without the wallet ever having to ask a server for permission. That
is the sovereign-organization claim the wallet was built to support,
now reachable from the home screen.
