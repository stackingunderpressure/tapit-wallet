# carpenter-state-for-foreman — Phase 8 Phase B landed (verifier on disk)

> PFOR-012 structured operational state. Written 2026-05-25 deep evening / into the night immediately after committing a319ad6 on `claude/multisig-orgs-status-jiLwm`. Branch sits seven commits ahead of `origin/main`: brief commits 0eab0e8 / 9e58108 / 7d76cbd, Phase A code 4eaeba8 + close-out eea0542, open-joining brief eab7743 + close-out 5c3c7f7, and now Phase B code a319ad6. All four gates green for both code commits; the brief/close-out commits are doc-only.

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS. Session was triggered by operator picking Option 1 for the open-joining substrate AND delegating the next-cut decision to the Carpenter with "you can start cutting in best spot for you." The Carpenter picked Phase B verifier per the prior session's recommendation, which the open-joining brief had also flagged as a hard prerequisite for Phase E4.

## WHAT-CHANGED-RECENTLY

Commit a319ad6 — "Phase 8 Phase B — verifyOrgAuthorization + authorized_by leaf" — four files touched:

`src/features/connections/createOrganization.ts` (modified, now 726 lines): added `AuthorizedByPayload` interface; `encodeAuthorizedBy` / `decodeAuthorizedBy` / `buildAuthorizedByPayload` helpers; `OrgAuthorizationResult` interface; `verifyOrgAuthorization(envelope, knownOrgs)` verifier. The verifier is a seven-step pipeline: read authorized_by leaf, decode payload, look up org self-declaration in knownOrgs, run `verifyDisclosureProof`, confirm cross-envelope binding via `proofResult.digest === envelopeId(orgSelfDecl)`, confirm disclosed leaf name matches claimed action, decode rule, count distinct eligible signers against threshold. Imports `verifyDisclosureProof` from tapit-attest (new import).

`src/features/connections/createOrganization.test.ts` (modified): 19 new tests across 5 describe blocks bringing the file to 34 tests total. Headline block is the four-forgery-class fuzz coverage: leaf-value tampered, wrong-org-binding via same-subject-different-digest, tampered sibling-hash path, tampered meta-fields. Plus action-claim mismatch, plus encode/decode round-trips, plus buildAuthorizedByPayload null cases, plus happy-path / missing-org / malformed / threshold-not-met / ineligible-signer refusal cases.

`src/features/connections/manifest.ts` (modified): notes field extended with the Phase 8 Phase B paragraph.

`appcommander/comms/in-flight.jsonl` (modified): session_started + three file_touched + one gate_passed event.

## WHAT'S-PENDING

Phase C of the canonical Tapscript brief: UI for multi-rule org creation + per-action signing flow. Extends the existing `SettingsScreen.tsx` org-creation form to let the operator declare multiple rules at creation time, generalizes `CosignRequestModal` to multi-fanout-by-rule, extends `RatificationsBadge` to render the rule name inline. About one to two sessions. Operator authorization required.

Phase E1 of the open-joining brief: extend `AuthRule` to a discriminated union including the join-rule kind (open / allow-list / requires-handshake / requires-credential / requires-vouch). Independent of Phase C; can run in parallel. One session.

Phase D and Phase E2-E4 are downstream of the above and can be scheduled after the immediate next move is chosen.

Operator has not yet authorized Phase C, Phase E1, or any specific next move. Natural next chip is a three-way: Phase C / Phase E1 / pause to merge to main.

## WHAT-TO-FLAG

File-size warn is now the loudest issue on the board. createOrganization.ts is at 726 lines, 74 below the 800-line hard limit. Phase C will push it over. The extraction to `src/features/governance/authRule.ts` is no longer optional — it MUST be the first work item of Phase C, before any UI code lands, or the file-size gate will fail CI. Recommend the next dispatched session's brief explicitly state this as work item one. The extraction is also the right moment to fix the Phase A test-side encoding duplication (the test file's `inlineSelfDeclaration` helper duplicates `buildAuthSubtree` inline rather than importing it) — factor a pure `buildOrgSelfDeclarationDraft` helper following the `buildHandshakeDraft` pattern that `createHandshake.ts` already uses, and have production code and tests both import it.

The brief navigation problem from prior sessions remains. Five 2026-05-25 org-governance briefs in the folder, two canonical (Tapscript-style + open-joining), three superseded (May 23 MuSig2, May 25 morning FROST, May 25 evening list-of-sigs). The SUPERSEDED-BY banner pass recommendation from two prior opinions has not been actioned. Cheapest forward-progress task for an autonomous Foreman cycle.

One small ergonomic gap surfaced during Phase B that's worth noting for Phase C planning: `verifyOrgAuthorization(envelope, knownOrgs)` requires the caller to pre-filter holdings down to org self-declarations. In production code paths the caller will usually have the full holdings array. Recommend adding a `verifyOrgAuthorizationFromHoldings(envelope, holdings)` adapter as a tiny pre-Phase-C cut — five lines, filters holdings via `isOrganizationSelfDeclaration`, calls the existing verifier. Not shipping today because the brief didn't name it.

## RECOMMENDED-NEXT-MOVES

For the operator: optionally pull the branch and run `npm test -- createOrganization` to see all 34 tests green; the four-forgery tests in particular are worth reading as the security argument made concrete. Then decide via chip-form: Phase C (governance-folder extraction + multi-rule org creation UI), Phase E1 (join-rule shape), or pause to merge to main before continuing the arc.

For the Foreman: the SUPERSEDED-BY banner pass across the three historical briefs is still the cheapest high-value autonomous task. Alternatively, a one-page Phase C pre-brief that names "governance-folder extraction is work item one" non-negotiably would prevent the file-size gate from biting at Phase C dispatch time.

For both: the Tapscript substrate is now complete in producer-and-consumer form. Phase C / D / E1+ all build ON TOP of the substrate rather than INTO it. The architectural milestone of "governance vocabulary as a sturdy primitive" is locked. Recommend treating the next cuts as configurations of the existing substrate rather than as new substrate work.

## OPERATOR'S-CURRENT-VIBE

Trusting the Carpenter to pick the right next cut and shipping fast. "You can start cutting in best spot for you" was a clean delegation that produced a clean execution. The pace remains sustainable — three substrate decisions + two code phases + two architectural briefs across one night without any debt being kicked down the road that hadn't been explicitly flagged. The operator can sleep on Phase B's landing with confidence that the four-forgery test coverage actually defends the substrate's load-bearing security property. Phase C is the largest remaining piece of work, and it's UI-heavy rather than substrate-heavy — different texture than tonight's cuts, but the substrate beneath it is ready.
