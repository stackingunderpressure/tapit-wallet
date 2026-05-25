# Carpenter opinions — 2026-05-25 late evening, Phase 8 Phase A shipped

## Section 1: What I did

This session opened with a "Yes a please" from you authorizing
Phase A of the Tapscript-style org authorization tree roadmap
that the prior session committed to disk, and ended with that
phase fully shipped — four gates green, four files changed, one
new test file with fifteen passing tests, all pushed to the
dispatch branch as commit 4eaeba8. The substrate is now real
code in the wallet. The grounding pass before any edit read
`tapit-attest/src/core/field-tree.ts` end to end again to
re-confirm the disclosure primitive I would be calling, read
`tapit-attest/src/core/types.ts` to verify the `FieldValue`
type accepts strings as leaf values (it does, which is what
made the rules-as-JSON-string-leaves design work), checked
`tapit-attest/src/index.ts` to confirm the disclosure primitive
is re-exported at the top level, and pulled the existing
callers of `selfDeclareOrganization` (just `SettingsScreen.tsx`
today, passing four positional args) to verify that adding an
optional fifth parameter would not break anything in the
production code path.

What landed in `createOrganization.ts` is the cleanest possible
expression of the substrate decision. An `AuthRule` interface
with `action`, `threshold`, and `eligible[]`. Internal helpers
`encodeAuthRuleValue` that produces canonical JSON of
`{threshold, eligible}` with the eligible list sorted and
lowercased so the same rule always hashes the same way
regardless of caller input order, `decodeAuthRuleValue` that
parses it back with a tolerant null-on-malformed return so
display paths never throw, and `buildAuthSubtree` that fails
loudly on the four conditions that would produce an unsignable
rule — duplicate action names, threshold less than one,
non-integer threshold, threshold exceeding the eligible-set
size — caught synchronously at creation time so malformed rules
never reach storage. `selfDeclareOrganization` gained an
optional `authRules` parameter that defaults to a single
`routine_issuance` rule with the founder eligible; when
omitted, the declaration still carries an auth sub-branch so
governance is self-documenting in the envelope. The three new
exported helpers — `findAuthRule`, `listAuthRules`, and
`proveAuthorization` — read from the auth sub-branch and, in
the case of proveAuthorization, wrap the shipped
`disclosureProof` primitive to produce a real
`DisclosureProofBundle` that Phase B will consume.

The test file is where the architectural argument from the
brief became falsifiable, and the load-bearing test is the
last one in the suite: the cross-envelope tamper-detection
case. The test produces a real authorization proof against a
real signed self-declaration, then forges a copy of the proof
with the leaf value tampered to claim a much higher threshold
than what was actually declared, and asserts that
`verifyDisclosureProof` rejects the forgery. That test passes
because the carried signature was made over the original
claim digest, and the verifier reconstructs the claim root
from the leaf-plus-path inside the proof bundle — a tampered
leaf reconstructs to a different root, the recomputed
attestation digest doesn't match the signed one, and the
signature check fails. That is the security-critical property
of the whole substrate, and the wallet has it provably,
right now, on disk. Fourteen other tests cover the validation
gates and the encode-decode round-trips and the legacy-no-auth-
branch case. Gates all green, build clean in 3.43 seconds, no
new bundle weight to speak of because the disclosure primitive
was already shipped.

## Section 2: What you could do better

`createOrganization.ts` is now at 534 lines, over the 400-line
soft warn threshold and 266 lines below the 800-line hard
limit. The brief flagged this would happen and recommended
extracting the new auth helpers into a sibling
`src/features/governance/authRule.ts` if file-size headroom
runs short. Phase B will add the `verifyOrgAuthorization`
helper and the `authorized_by` leaf-decode logic — easily
another hundred lines — which puts us pushing 650 in this one
file. Worth doing the extraction at the START of Phase B
rather than as cleanup at the end; cuts that touch a 700-line
file slow down disproportionately as the file-size warn keeps
firing in CI noise. Recommend the next chip be whether to
extract before or during Phase B's first edit.

The cross-envelope tamper-detection test is good but it tests
ONE forgery pattern — the leaf-value-tampered case. There are
at least three other forgery patterns Phase B's verifier will
need to defend against and should have dedicated tests for: a
disclosure proof produced against a DIFFERENT org's
self-declaration glued onto an envelope claiming this org's
authority, a disclosure proof with a tampered sibling-hash
path that reconstructs to an arbitrary attacker-chosen root,
and a disclosure proof whose meta fields have been edited to
claim a different subject or issuedAt than what was actually
signed. The brief flagged "cross-envelope binding" as the main
Phase B risk surface; Phase B's first dispatch should ship the
verifier WITH a dedicated fuzz file
(`verifyOrgAuthorization.fuzz.test.ts` or similar) covering
all four classes, not just spot tests against the happy path.

One nit on the test file: I duplicated the auth-subtree
encoding logic inline in `inlineSelfDeclaration` rather than
exporting `buildAuthSubtree` for tests to import. The
duplication is a few lines but it's a real maintenance hazard
because the canonical encoding lives in TWO places now, and a
future change to the encoding (say, switching to a different
JSON shape or adding a version byte) requires updating both.
The right move at Phase B time is to either export
`buildAuthSubtree` (cheap, slightly leaky) or to factor out a
pure `buildOrgSelfDeclarationDraft` helper following the
`buildHandshakeDraft` pattern that `createHandshake.ts`
already uses. Pick one of those before any encoding change
lands.

## Section 3: The bigger picture

The whole point of tonight is that the wallet now demonstrably
holds the architectural shape the operator named hours ago.
Phase A's deliverable is not a feature an operator can use — it
is a primitive that proves the substrate compiles, type-checks,
verifies its own cryptography under tamper, and integrates
cleanly with the shipped disclosure-proof code. That sounds
modest, but it is the load-bearing first step. Every subsequent
phase builds on a substrate that no longer has to be argued for
from theory — the math is on disk, the tests pass, the
disclosure-proof round-trip survives forgery. The brief said
"zero new cryptographic code in tapit-attest" and that promise
held: not a single byte of new crypto, just the existing
selective-disclosure primitive generalized from facts to rules
through a different choice of what to put in the leaves.

The deeper pattern that emerged tonight is the one named in the
prior session's opinions: the Merkle-tree-with-selective-reveal
is a more general primitive than any of its named applications.
You shipped it for facts; now you have shipped it for
authorization rules; the FROST brief in the drawer is the day
you need an aggregate-signature primitive on top. The wallet
has been quietly becoming a Taproot-shaped sovereign identity
substrate for the entire arc of the tapit-attest library, and
the operator naming this with the leaves-theory question was
the moment that pattern became visible. Phase B turns the
substrate into a working verifier; Phase C turns the verifier
into a usable creation flow; Phase D turns the creation flow
into a governable charter. Each phase is itself a primitive a
person could use; together they are an organization a person
could run. That is the wallet's quiet bet — that sovereign
identity scales from individual to institution on the same
math — and tonight that bet has its first verifiable foothold
inside an organization's own self-declaration.
