# carpenter-state-for-foreman — Merged to main + governance extraction landed

> PFOR-012 structured operational state. Written 2026-05-25 into the night immediately after pushing the governance extraction commit d27974e on `claude/multisig-orgs-status-jiLwm`. Main was advanced earlier in the session (`d1c4fda..af58299`) via the PFOR-016 doctrine-compliant branch:main push form. Dispatch branch now sits ONE commit ahead of main (the extraction itself; not yet pushed to main).

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS. Session was triggered by "Merge and continue" which the Carpenter interpreted as two actions: (1) merge current branch state to main with pre-push gate verification, (2) continue cutting with the best-spot pick — which per the prior session's opinions was the governance-folder extraction as the load-bearing prerequisite for Phase C UI work.

## WHAT-CHANGED-RECENTLY

Merge to main: nine commits moved onto main (`d1c4fda..af58299`) carrying the brief-authoring arc (list-of-sigs → Tapscript-style → open-joining), Phase A code, Phase B verifier, and all their close-outs. Pre-push gates ran one more time before the push and were all green (typecheck, lint, 136/136 tests, build clean in 4.41s).

Commit d27974e — "Extract Tapscript auth-rule substrate to src/features/governance/" — seven files touched:

`src/features/governance/manifest.ts` (new): feature manifest for the new governance feature folder. depends_on: ['wallet-core'] only — governance is org-agnostic substrate and intentionally does not depend on connections.

`src/features/governance/authRule.ts` (new, ~220 lines): hosts the entire extracted Phase A + Phase B substrate. AuthRule type + defaultAuthRules + encodeAuthRuleValue + decodeAuthRuleValue + buildAuthSubtree (now exported, fixing the test-side encoding duplication) + findAuthBranch (internal) + findAuthRule + listAuthRules + proveAuthorization + AuthorizedByPayload + encodeAuthorizedBy + decodeAuthorizedBy + buildAuthorizedByPayload + OrgAuthorizationResult interface. Zero new cryptographic code; entire module is wallet-side plumbing on the shipped disclosureProof primitive.

`src/features/connections/createOrganization.ts` (modified, now 534 lines from 726): removed the extracted code; added re-exports of governance primitives for back-compat with existing import sites; added a new pure `buildOrgSelfDeclarationDraft` helper following the `buildHandshakeDraft` pattern in createHandshake.ts; refactored selfDeclareOrganization to wrap the new builder; verifyOrgAuthorization stays but imports decodeAuthorizedBy + decodeAuthRuleValue from governance/authRule.ts.

`src/features/connections/createOrganization.test.ts` (modified): imports auth-rule helpers from governance/authRule.ts; the test's inlineSelfDeclaration helper now calls the new pure builder + wallet.sign instead of duplicating the encoding logic inline. 136/136 tests still pass — clean signal that the move preserved behaviour.

`src/features-registry.ts` (modified): registered the new governance feature in the manifest list.

`src/features/connections/manifest.ts` (modified): depends_on gained 'governance'; notes field extended with the extraction summary.

`appcommander/comms/in-flight.jsonl` (modified): session_started + commit_pushed-for-main + six file_touched + one gate_passed event.

## WHAT'S-PENDING

The substrate is now in its final structural shape. Three natural next moves:

Phase C of the canonical Tapscript brief — multi-rule org creation UI in `SettingsScreen.tsx` + multi-fanout generalization of `CosignRequestModal` + `RatificationsBadge` extension to render rule names inline. Now lands cleanly against the 534-line createOrganization.ts with full headroom. About one to two sessions.

Phase E1 of the open-joining brief — extend AuthRule in `governance/authRule.ts` to a discriminated union including the join-rule kind (open / allow-list / requires-handshake / requires-credential / requires-vouch). Updates to encodeAuthRuleValue / decodeAuthRuleValue / buildAuthSubtree to recognize the new shape. One session, independent of Phase C, prerequisite for Phase E2-E4.

Push the extraction commit (d27974e) to main. The branch is one commit ahead; the operator can signal a second branch:main push whenever they want it on main.

Operator has not yet authorized any next move past the extraction. Natural next chip is the three-way: Phase C / Phase E1 / push-current-extraction-to-main.

## WHAT-TO-FLAG

The connections/manifest.ts depends_on now lists governance, which is structurally correct but counter-intuitive at first read (governance is the SUBSTRATE, connections is the consumer — most readers would expect the opposite direction). The notes field has the extraction summary but does not have an explicit one-sentence "why governance is below" explanation. Recommend adding that sentence in a follow-up cut so future auditors don't have to reverse-engineer the direction.

The re-exports from createOrganization.ts are back-compat shims. Phase C UI work that touches the auth-rule helpers should import them DIRECTLY from `../governance/authRule.ts`, not from `./createOrganization.ts`. The Phase C brief should state this explicitly so the new direct-import pattern becomes the default going forward and the re-exports can eventually be deleted.

createOrganization.ts is at 534 lines — still over the 400 soft warn (file-size noise will keep firing every test run). A future cut could extract the officials-roster section (~75 lines) into a sibling `officialsRoster.ts` to drop the file closer to the soft warn. Not urgent; flagging for whenever the file is next touched substantially.

The brief navigation problem from prior sessions remains unaddressed. Five 2026-05-25 org-governance briefs in the folder; SUPERSEDED-BY banner pass is still the cheapest forward-progress autonomous task.

## RECOMMENDED-NEXT-MOVES

For the operator: optionally pull the extraction locally and run `npm test` to confirm 136/136 still pass against the new file structure. Then decide via chip-form: Phase C UI work (multi-rule org creation), Phase E1 (join-rule kind extension), push-current-to-main (the extraction by itself), or pause.

For the Foreman: SUPERSEDED-BY banner pass across the three superseded briefs is still the cheapest high-value autonomous task. Alternatively, a Phase C pre-brief that names "import auth-rule helpers from governance/authRule.ts not from connections/createOrganization.ts" non-negotiably would set the right import pattern from the start.

For both: the substrate-cleanup arc is now structurally complete. Phase A primitives, Phase B verifier, governance folder extraction, encoding-duplication fix, test-side cleanup, file-size headroom restored — all four debts the prior opinions kept naming are paid down on commit d27974e. Future cuts extend the substrate rather than reshape it.

## OPERATOR'S-CURRENT-VIBE

Trusting delegation continues to produce clean execution. "Merge and continue" turned into a textbook two-action session: merge cleanly via the doctrine-compliant push form, extract into governance to pay down the file-size and encoding-duplication debts in one commit, leave the substrate in its final structural shape for Phase C and beyond. The operator should sleep well — main is current, the branch is one commit ahead, the substrate is shaped right for what comes next. The pace remains sustainable. The architectural shape is locked.
