# carpenter-state-for-foreman — Phase 8 Phase A landed (Tapscript-style auth tree on disk)

> PFOR-012 structured operational state. Written 2026-05-25 late evening immediately after committing 4eaeba8 on `claude/multisig-orgs-status-jiLwm`. Branch now sits four commits ahead of `origin/main` (two doc-only commits from the brief-authoring session 0eab0e8 + 9e58108 + a close-out 7d76cbd, plus this Phase A code commit 4eaeba8). All four gates green; ready for either a merge to main or a direct continuation into Phase B.

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS. Session was triggered by "Yes a please" authorizing Phase A code on top of the canonical Tapscript-style brief committed earlier in the night.

## WHAT-CHANGED-RECENTLY

Commit 4eaeba8 — "Phase 8 Phase A — Tapscript-style auth tree on org self-declaration" — four files touched:

`src/features/connections/createOrganization.ts` (modified, now 534 lines): added `AuthRule` interface (`{action, threshold, eligible[]}`); internal helpers `defaultAuthRules`, `encodeAuthRuleValue`, `decodeAuthRuleValue`, `buildAuthSubtree`; extended `selfDeclareOrganization` with optional `authRules` parameter (defaults to single `routine_issuance` rule with founder eligible); shipped three new exported helpers `findAuthRule`, `listAuthRules`, `proveAuthorization`. The last one wraps the shipped `disclosureProof` from `tapit-attest/src/core/field-tree.ts` — zero new cryptographic code, the authorization proof IS a regular selective-disclosure proof of one rule leaf. Validation throws synchronously on duplicate action, threshold < 1, non-integer threshold, threshold > eligible-set size.

`src/features/connections/createOrganization.test.ts` (new, 233 lines): 15 tests across three describe blocks (validation throws, auth-tree shape, proveAuthorization). The load-bearing test is the cross-envelope tamper-detection case which forges a leaf-value in a proof bundle and confirms `verifyDisclosureProof` rejects it — proving the carried signature binds the proof to the original claim digest and tampering is detected.

`src/features/connections/manifest.ts` (modified): added `createOrganization.test.ts` to touches; extended notes with Phase 8 Phase A paragraph naming the new exports.

`appcommander/comms/in-flight.jsonl` (modified): logged session_started, four file_touched events, one gate_passed event for typecheck + lint + 117/117 tests + build.

## WHAT'S-PENDING

Phase B per the brief: introduce an `authorized_by` leaf on credential-kind attestations carrying `{org_identity, action, proof: DisclosureProofBundle}`, ship `verifyOrgAuthorization(envelope, knownOrgs)` that reconstructs the org's claim root from the proof, confirms the disclosed rule matches the action, and counts eligible-signer signatures vs threshold. Estimated one session. Tests must cover the four forgery patterns flagged in opinions: leaf-value tampered, wrong-org self-declaration glued onto the proof, tampered sibling-hash path, and tampered meta-fields. Phase A's tamper-detection test covers one of the four; Phase B should ship the other three.

Operator has not yet authorized Phase B. Natural next chip is whether to cut Phase B immediately, extract the auth helpers into a new `src/features/governance/authRule.ts` first (file-size headroom is becoming a concern — createOrganization.ts is 534 lines and Phase B will add ~100 more), or pause to merge the current branch to main before continuing the arc.

## WHAT-TO-FLAG

File-size warn surfaced on `createOrganization.ts` at 534 lines (over the 400 soft warn, well under the 800 hard limit). Phase B will push this toward 650. The brief flagged that extraction into `src/features/governance/authRule.ts` was an option to consider at cut time; Phase B is the cut time. Recommend chip-form: extract before or during Phase B's first edit.

Test-side duplication risk: `createOrganization.test.ts` reimplements the auth-subtree encoding inline in its `inlineSelfDeclaration` helper rather than importing `buildAuthSubtree` from the source file (which is currently unexported). The encoding now lives in two places; a future change to the canonical encoding format requires updating both. The right move at Phase B time is to either export `buildAuthSubtree` for tests, or to factor out a pure `buildOrgSelfDeclarationDraft` helper following the `buildHandshakeDraft` pattern that `createHandshake.ts` already uses. Either is fine; pick one before any encoding change lands.

Cross-envelope binding is the load-bearing security property of the substrate, and Phase A's single tamper test only covers leaf-value forgery. Phase B's verifier needs a dedicated fuzz file covering all four forgery classes (leaf-value, wrong-org-binding, tampered-path, tampered-meta). Recommend this be called out explicitly in Phase B's brief or dispatch instructions so the test-discipline scope is not negotiable down to "just the happy path."

## RECOMMENDED-NEXT-MOVES

For the operator: optionally pull the dispatch branch to a desktop and read `createOrganization.test.ts` end to end — the tests ARE the architectural argument made concrete, and reading them is the fastest way to internalize what Phase A actually shipped. Then decide whether to authorize Phase B, request the governance-folder extraction first, or merge the current branch to main and pick up Phase B fresh.

For the Foreman: the natural next brief if Phase B is authorized would be a one-page Phase B test-discipline outline covering the four forgery classes. Could be authored proactively without operator direction because the test scope is already constrained by the substrate decision and the Phase A risk surface. Recommend it lands before Phase B dispatch so the Carpenter session opens with a clear test target.

For both: the FROST brief in the drawer is still framed as "the upgrade path the day an org needs signer-anonymity." Phase A has not changed that framing; if the operator can name a concrete use case where signer-anonymity matters (dissident orgs, whistleblower committees), log it as a living-ideas entry per the new doctrine so the FROST brief has a concrete future-trigger rather than sitting as architectural completeness.

## OPERATOR'S-CURRENT-VIBE

Engaged and shipping. The "Yes a please" was tight and decisive after the substrate-decision arc, and the Carpenter executed within scope without re-asking. The leaves-theory question from earlier in the night turned out to be the load-bearing intervention of the whole multi-key org sequence, and Phase A landing tonight closes a clean loop: question raised at 1am, substrate decided at 1:30am, code on disk and gates green by 2:30am. The operator should sleep on this one and authorize Phase B fresh — the code is good, the brief is canonical, and rushing Phase B now would mean cutting the verifier without the dedicated fuzz file that the security surface deserves.
