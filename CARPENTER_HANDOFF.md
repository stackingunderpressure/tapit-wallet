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

## Latest letter — 2026-05-26 evening (Phase E4 cut 2 + officials extraction + dedicated test file)

### What just shipped

Three substantive commits landed this session plus this close-out
flush. The operator opened with the same full-chunk delegation
pattern the last three sessions ran under — "Fire up and take the
next chunk of code to progress things the way you see fit fill up
context enough to stop hook clean" — and the prior letter named
Phase E4 cut 2 (proof-required policy evaluators) as the recommended
first move with one design choice flagged as worth chipping up front.
That chip was the right move. The proof-attachment shape question
locks the on-wire envelope shape for every future open-joined-with-
proof self-membership in the codebase, and silently picking would
have left the operator stuck with that choice without seeing the
trade-off. Carpenter surfaced the four options as a chip-form
question (DisclosureProof+cosigs recommended / full attestation as
leaf / hybrid by kind / pause cut 2); operator picked the recommended
DisclosureProof option. From there cut 2 was concrete substrate work
with no further ambiguity.

Commit 695b631 shipped Phase 8 Phase E4 cut 2 itself. Builder:
buildSelfMembershipDraft in src/features/connections/createMembership.
ts gained an optional fourth `proofs` parameter (SelfMembershipProofs
= {handshake_proof?, credential_proof?}); each supplied
DisclosureProofBundle is JSON-stringified into a top-level leaf on
the self-membership envelope so the joiner's own signature covers
the proof leaf — it cannot be detached or swapped after signing,
same Tapscript-style discipline the Phase A/B authorized_by leaf
established but on the joiner side. Two paired reader helpers
(readHandshakeProof + readCredentialProof) JSON.parse the leaf back
with a lightweight shape gate returning null on absent or malformed
leaves rather than throwing into UI render paths. Vouch needs no
new leaf because cosignatures already ride envelope.signatures[].
Evaluator: evaluateJoinPolicy in src/features/governance/
evaluateJoinPolicy.ts flipped the three Phase-E3-deferred returns
into real verification. Handshake reads handshake_proof, runs
verifyDisclosureProof, asserts meta.kind=relationship and the leaf
is the non-empty verification leaf isHandshake checks for, and
confirms carried signatures include the joiner AND one pubkey from
policy.with_any_of. Credential reads credential_proof, runs
verifyDisclosureProof, asserts meta.kind=credential and meta.subject
=joiner, confirms the disclosed credential_type matches policy.
credential_type, and when policy names an issuer confirms signatures
include them. Vouch derives the org's known-member set inline from
holdings (subjects of self-memberships whose org_id matches this
org + member_id leaves of memberships issued by this org —
predicate logic duplicated here rather than reverse-importing from
connections so governance stays free of consumer dependencies),
counts known-member cosigners minus joiner against policy.
from_any_member_count. The verifyOpenJoinedMembership public
signature stayed stable per the prior letter's guidance; cut 2 work
was entirely internal to the evaluator. Tests grew across three
files for +18 net (221→239): evaluateJoinPolicy.test.ts 13→21
covering missing-proof-leaf rejects, malformed-JSON rejects, happy-
path acceptance for handshake/credential/vouch, wrong-envelope-kind
rejects, wrong-credential-type rejects, wrong-subject rejects,
wrong-issuer rejects, insufficient-voucher-count rejects;
createMembership.test.ts 18→22 covering the builder + readers +
back-compat shape + receiveSelfMembership happy-path on
requires_credential; verifyOpenJoinedMembership.test.ts three
Phase-E4-deferred tests flipped to assert new concrete reject
reasons (no handshake_proof leaf / no credential_proof leaf / no
known members in holdings on the verifier-side path).

Commit 7f4cffa shipped the prior-letter-named officials-roster
extraction that five consecutive close-out letters had named as
worth doing. Symbols moved from createOrganization.ts to a new
src/features/connections/officialsRoster.ts sibling: Official,
RatificationSummary, isOfficialsRoster, readOfficials,
findLatestOfficialsRoster, countRatifications, publishOfficialsRoster
plus internal HEX_64, sortOfficials, uniqueByPubkey helpers. 198
lines in the new file. createOrganization.ts drops from 546 to 368
lines — back under the 400-line soft warn band. Five consumer
sites updated to import directly from the new module rather than
from a back-compat re-export on createOrganization: HomeScreen.tsx,
OrgIdentitySections.tsx, MembershipCard.tsx, RatificationsBadge.tsx,
OfficialsEditorModal.tsx. The officials-vs-open-member parallel is
now legible at the filesystem level: officialsRoster owns who runs
the org, openMemberRoster owns who joined the org, createOrganization
owns the declaration pointing to both. Five-file churn was bounded
so direct imports won over back-compat re-exports.

Commit 66d8aed shipped officialsRoster.test.ts with 16 focused
tests closing a long-standing coverage gap — the officials roster
code had zero dedicated tests under either name, even back when it
lived in createOrganization.ts. Covers: isOfficialsRoster predicate
both polarities; readOfficials (round-trip canonical JSON, drops
malformed pubkey entries individually, empty on missing leaf, empty
on non-JSON leaf, lowercases pubkeys on read); findLatestOfficialsRoster
(latest-by-issued_at selection in either input order, null on no-
org-match, skips rosters the org never signed, null on no-rosters);
countRatifications (quorum count with named officials, null on
empty officials list, pubkey-prefix fallback when an official has
no name); publishOfficialsRoster's validation gate (throws on non-
hex pubkey BEFORE the IndexedDB layer that jsdom does not back).
publishOfficialsRoster's storage round-trip stays unverified for
the same reason openMemberRoster's does — anchorQueue.upsert is
IndexedDB-bound and jsdom does not ship it; tests deliberately stop
one method-call earlier in the chain exercising the same envelope
shape the production path produces. 239→255 tests passing (+16).

All four gates green throughout all three commits: typecheck clean,
eslint clean, tests 221→239→239→255 across the session, build OK
with every chunk under its named budget.

### What's hot right now

Nothing in-flight. Working tree is clean as of pre-close-out,
dispatch branch `claude/multisig-orgs-status-jiLwm` carries the
three code commits plus this close-out flush, and the branch tip
is being pushed to main per PFOR-016 (`git push origin <branch>:main`)
as the final act of close-out so the Stop-hook gate clears and the
next SessionStart hook reads a fresh letter from origin/main.
Branch and main will be at the same SHA after the push. The next
carpenter inherits a clean shared base with Phase E4 substrate
fully landed (cuts 1+2 verifier + evaluator + builder + readers all
shipped, officials-roster extracted to its own home with dedicated
coverage) and Phase E4 cut 3 (UI wiring) as the natural next arc.

### Land-mines for the next carpenter

Phase E4 cut 3 (UI wiring) is the natural next arc but it is a
genuinely UI-heavy session — three concurrent threads can ship in
parallel or sequentially: an org-creation membership-policy picker
inside the SettingsScreen + OrgRulesEditor lazy-load surface; a
Members view + publish-roster button on the org-mode Identity tab
inside OrgIdentitySections; an any-wallet Profile join-an-org flow
(new JoinOrgModal.tsx) that for proof-required policy kinds needs
a proof-picker step letting the joiner pick which held attestation
to disclose. The Join modal is the most novel piece because it
introduces a new disclosure-proof-construction step at the joiner's
end — disclosureProof() from tapit-attest is the primitive, but
the UI flow that filters holdings + lets the joiner pick + bakes
the result into buildSelfMembershipDraft's proofs parameter is
new surface. Worth chip-form-asking the operator at session start
whether to ship all three threads in one session (ambitious but
self-contained) or just one or two (more conservative).

The receiveSelfMembership signature still requires orgSelfDecl as
a parameter from the caller. HomeScreen.acceptSelfMembership does
the lookup correctly via the existing orgDeclaration useMemo, but
any new caller path (a ScanEnvelopeModal flow, a batch-import
path, an AI-driven acceptor) needs to remember the
findOwnOrgDeclaration lookup itself or it will get a confusing
throw at the gates. Worthwhile chip-form decision next session if
cut 3 introduces more callers: centralize the lookup inside
receiveSelfMembership (take wallet + holdings, derive declaration
via findOwnOrgDeclaration internally), or keep the caller-side
pattern uniform with the rest of the create-attestation function
family. Either choice is defensible; the question is consistency.
Probably worth pinning before cut 3's Profile join flow lands as
a second caller path beyond HomeScreen.

The connections manifest notes field is now roughly 17 kilobytes
of unbroken text covering eleven phases of work — up from 14 at
session start. The Phase E4 cut 2 paragraph and the officials-
extraction addendum both expanded it. The prior letter named the
markdown-sub-section refactor as worth doing but the doctrine for
manifest notes is intentionally TTS-listenable prose without
headers, so a markdown-shaped refactor would be either a cosmetic
semantic-preserving rewrite (low value) or a structural change
that revises the doctrine itself (worth chipping, not silent-
picking). Worth surfacing as a chip-form question some session:
do you want the manifest notes to evolve into markdown sub-sections
for legibility, or stay as flowing prose for TTS, given that the
connections manifest is now the leading indicator that the prose
form has grown past human-scannable size?

authRule.ts at 430 lines remains in the soft-warn band. No obvious
clean extraction point yet — the encoder/decoder pair plus the
discriminated-union helpers plus the disclosureProof wrappers are
all tightly coupled to AuthRule's shape and splitting them would
mostly produce two files with a thick cross-import surface.
SettingsScreen.tsx (789) and HomeScreen.tsx (760) also remain in
the soft-warn band; prior letters named extraction plans for them
but none has shipped. Both are higher-effort than they look
because the cuts are component-shaped not pure-function-shaped.
HomeScreen grew slightly this session (757→760) from splitting
the connections import block into two destinations after the
officials extraction.

publishOfficialsRoster + publishOpenMemberRoster + receiveSelfMembership
all hit anchorQueue.upsert which uses IndexedDB which jsdom does
not back. Tests exercise the pure builders + signed wallet.hold
directly so the same envelope shape the production path emits is
verified, but the full publish-pipeline storage round-trip is not
exercised. Same uncertainty surface carried forward from Phase E2
/ E3 / E4 cut 2 happy-path. Not blocking. fake-indexeddb or a
polyfill would close this if Phase E4 cut 3 (or any future test
refactor) wants storage assertions on the publish paths.

### Operator mood-read

Same delegate-and-verify mode the last three sessions ran under.
Opening prompt was explicit about wanting maximum productive use
of the context window. Prior letter named the substantive first
move (Phase E4 cut 2) AND named the chip-form question worth
asking up front (the proof-attachment shape); carpenter surfaced
the chip immediately on session-start per PFOR-019; operator
picked the recommended option in one round-trip; cut 2 then
proceeded autonomously through commit. After cut 2 landed with
ample context remaining, carpenter pivoted to two opportunistic
prior-letter-named items the session was ready to absorb: the
officials-roster extraction (mechanical, deferred five sessions in
a row, finally ripe) and the dedicated test file (coverage
opportunity surfaced by the extraction). No mid-session operator
interventions, no redirections, no further chip-form questions
beyond the opening one. Three substantive commits, all four gates
green throughout. Honest mood-read: this is the kind of session
the doctrine was built to enable — clear chip-form handoff for
one design decision concretely flagged by the prior letter,
autonomous execution against a concrete plan after the chip
locked, opportunistic polish slotted in after the substantive cut,
one close-out flush at the end. The carpenter-to-carpenter chip-
form loop worked exactly as designed; this is a pattern worth
naming explicitly somewhere if it has not been already (prior
letter signals chip is needed; current letter surfaces it on
session-start; one round-trip and design locks).

### Recommended first move for the next session

Phase E4 cut 3 — UI wiring. The substrate is fully landed; cut 3
is now purely about exposing it to operator-visible surfaces. The
three concurrent threads:

1. Org-creation form gains a membership-policy picker. SettingsScreen.
   tsx already lazy-loads OrgRulesEditor for the multi-rule editor
   on auth rules; the join-policy picker fits inside that pattern.
   Each policy kind needs its own sub-form: open = no fields;
   allow_list / deny_list = pubkey-list editor; requires_handshake
   = with_any_of pubkey-list editor; requires_credential =
   credential_type text + optional issuer pubkey; requires_vouch =
   from_any_member_count number.

2. Org-mode Identity tab gains a Members view + publish-roster
   button. OrgIdentitySections.tsx renders the org-mode sub-sections;
   adding a Members section pulls the chronological order from
   openMemberRoster.acceptedSelfMemberships(orgIdentity, holdings)
   and renders a card-per-member with name/pubkey/joined-at. The
   publish-roster button computes pendingSelfMemberships(orgIdentity,
   holdings, latestRoster) and shows the count as an amber chip
   when non-zero; clicking calls publishOpenMemberRoster.

3. Any-wallet Profile gains a Join-an-org flow. New JoinOrgModal.tsx
   accepts an org-pubkey paste-or-scan, finds-or-fetches the org's
   self-declaration, reads the declared join-policy via
   findAuthRule(orgDecl, 'join'), renders the policy in plain
   language, and shows a Join button that calls
   buildSelfMembershipDraft + joiner.sign + ships over Mycelium.
   For requires_handshake / requires_credential the modal also
   needs a proof-picker step: filter holdings for matching
   attestations, let the joiner pick one, produce a
   DisclosureProofBundle via disclosureProof(), and bake it into
   buildSelfMembershipDraft's optional proofs parameter (the shape
   shipped this session).

Cut 3's first chip is whether to ship all three threads in one
session (ambitious, self-contained, would close out the Phase E
arc) or to scope down to one or two (conservative, leaves room
for the centralize-receiveSelfMembership consistency decision +
the manifest-notes refactor chip as parallel work). Recommended
chip phrasing: "Phase E4 cut 3 — three threads ready to ship.
Full cut 3 in one session / Just the org-creation policy picker /
Just the join-org modal / Pause cut 3 — different first move."
Recommended option: full cut 3 IF the operator wants to close
Phase E in one session and has bandwidth to verify three UI flows.

Alternative first moves if cut 3 is too UI-heavy:
- Phase D charter-amendment chain (walkCharterChain +
  findActiveCharter + dissolution endpoint — continues the org-
  control axis in parallel with the membership-acquisition axis,
  does NOT depend on Phase E substrate, similar level of work
  to cut 1 of Phase E).
- Centralize receiveSelfMembership's orgSelfDecl lookup (chip-
  worthy because it changes the create-attestation function
  family's calling convention; small code change once locked).
- Markdown-sub-section refactor of connections/manifest.ts notes
  field (chip-form question about whether to flex the TTS-prose
  doctrine for this case).

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
