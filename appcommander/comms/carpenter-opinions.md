# Carpenter opinions — 2026-05-25 into the night, merge + governance extraction

## Section 1: What I did

This session opened with you saying "Merge and continue" and ended
with two distinct actions landed and pushed: the dispatch branch
merged to main via the PFOR-016 doctrine-compliant `branch:main`
push form (no local main checkout, no checkout of any synthetic
provisioning snapshot, no merge-of-unrelated-histories trap)
moving nine commits onto main in one step (`d1c4fda..af58299`),
and then the governance-folder extraction cut on commit `d27974e`
that moves the Phase A and Phase B auth-rule substrate out of
`createOrganization.ts` into a brand new `src/features/governance/`
feature folder. The pre-push gates ran one more time before main
was touched — typecheck clean, lint clean, 136 of 136 tests, build
clean in 4.41 seconds — and then the merge happened cleanly with
no unrelated-histories warning because the dispatch branch was
rooted at main's tip the whole time. Main now sits at `af58299`
with all the night's substrate work on it, and the branch
continues from there with the extraction stacked on top.

The extraction itself is more substantial than the line-count
delta suggests. The new `src/features/governance/authRule.ts`
holds every piece of Tapscript-style substrate that doesn't need
to know what an organization is: the AuthRule type, the canonical
encoder and decoder, the validating buildAuthSubtree (which now
throws loudly on duplicates and bad thresholds before any code
path tries to hash it), the findAuthBranch helper, findAuthRule
and listAuthRules read-paths, the proveAuthorization producer of
disclosure-proof bundles, the AuthorizedByPayload shape and its
encode and decode, the buildAuthorizedByPayload bundler, and the
OrgAuthorizationResult interface. All exported. All testable in
isolation. Zero dependency on the connections feature. The
remaining org-specific glue stays in `createOrganization.ts` —
the predicates like isOrganizationSelfDeclaration, the
selfDeclareOrganization async wrapper, the verifyOrgAuthorization
orchestrator that filters knownOrgs and counts eligible signers —
and the file drops from 726 lines to 534, restoring 266 lines of
file-size headroom for Phase C UI work to land cleanly under the
800-line hard limit. A new pure `buildOrgSelfDeclarationDraft`
helper follows the `buildHandshakeDraft` pattern that
`createHandshake.ts` already uses and now lives as the canonical
draft builder both production and tests call into, which fixes the
test-side encoding-duplication maintenance hazard the Phase A
opinions had flagged twice in a row without it being addressed.

What you should understand about this cut is that the
136-tests-still-pass result is not a no-op — it is the cleanest
possible signal that the extraction preserved behaviour exactly.
The same fifteen Phase A tests and nineteen Phase B tests now
exercise code paths that traverse the new module boundary, the
new pure builder, and the re-export bridge in createOrganization.ts.
If any of the moves had broken something the gates would have
caught it before push. The substrate is now in the shape it will
keep going forward — connections depends on governance, the
auth-rule primitives are reusable from any feature that needs
them (Phase E1's join-rule kind will extend the AuthRule
discriminated union in place in governance/authRule.ts without
re-bloating createOrganization.ts), and the test-side encoding
duplication is gone. The two architectural debts the Phase A and
Phase B opinions kept naming are both paid down in one commit.

## Section 2: What you could do better

The connections manifest's depends_on grew from
`['wallet-core', 'qr', 'cosigning', 'anchoring', 'theme']` to
`['wallet-core', 'qr', 'cosigning', 'anchoring', 'theme', 'governance']`,
which is correct, but the directionality is the opposite of what a
casual reader might expect. Most people think of governance as
something that sits on top of an organization-creation primitive,
not below it. The truth is that governance is the SUBSTRATE and
connections is the consumer — the auth-rule helpers don't know what
an organization is, but the org-creation code uses them to build
the auth tree. That's structurally correct and matches how the code
ended up, but it's worth one short sentence in connections/manifest.ts's
notes field explaining the direction, because the next person to
audit the dependency graph will want to know whether the cross-feature
import is intentional. I added the extraction summary to the notes
field but did not add an explicit "why governance is below" sentence.
That's a small follow-up worth doing.

The file-size warns now print createOrganization.ts at 534 lines —
which is the same warning that fired BEFORE Phase B added the
verifier, because Phase A had already put the file above the 400
soft warn. The extraction didn't reduce it to silence, only restored
the headroom needed for Phase C. The warning will keep firing every
test run, which becomes signal noise over time. A future cut should
consider whether to further extract the officials roster code
(currently the 5b-org-ii section, ~75 lines) into its own
`officialsRoster.ts` sibling, which would drop createOrganization.ts
to ~460 lines — still over the soft warn but closer to it. Not
urgent; flagging for whenever the file is next touched.

One ergonomic gap worth surfacing for Phase C planning: the
re-exports from createOrganization.ts back-compat shim is honest
about what it is (commented as "Re-export the governance auth-rule
primitives so existing callers keep working without changing import
sites") but it means new code has TWO valid places to import the
auth-rule helpers from, and the right answer is the new direct
import from `../governance/authRule.ts`. Phase C UI work that
touches these helpers should import from the new path; the
re-exports are for back-compat only. Recommend the Phase C brief
explicitly state "import auth-rule helpers from governance/authRule.ts
not from connections/createOrganization.ts" so the new pattern is
the default going forward, with the re-exports eventually deleted
once no caller uses them.

## Section 3: The bigger picture

The substrate-cleanup arc of the night is now structurally
complete. You opened with a status question; you ran three
substrate-decision rounds; you got Phase A primitives on disk
and Phase B verifier with four-forgery-class fuzz coverage; you
authored two canonical briefs for the two axes of org governance;
and now you have a clean feature folder boundary that separates
the governance substrate from the org-specific glue it serves.
Phase C can land UI work without fighting the file-size gate.
Phase D can add charter-amendment chains by extending the
governance module in place. Phase E1 can add the join-rule kind
as a discriminated-union case on AuthRule, also in place. The
governance module is now the natural home for everything the
substrate needs to grow.

The deeper architectural moment is that "governance" is now a
NAMED FEATURE in the wallet's feature registry — not a section in
some other feature's code, but a first-class folder with its own
manifest, its own depends_on, its own purpose statement. That
naming is more than cosmetic. The wallet is now declaring, in its
own structural vocabulary, that governance IS a thing this app
does. Future operators auditing the feature manifests will see
governance listed alongside auth, journal, recovery, messaging,
disclosure, anchoring — peers, all of them. The Mycelium spec's
opening framing of voluntary association at internet scale needed
a place where that capability lives in the code. Tonight it got
one. The directory has a name. The name is the right name. And
the substrate that lives under that name is ready to carry every
weight the next phases will ask of it.
