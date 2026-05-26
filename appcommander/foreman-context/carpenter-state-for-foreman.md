# carpenter-state-for-foreman — Phase C cut 3 caller-wiring

> PFOR-012 structured operational state. Written 2026-05-26 early morning at session close-out. One commit landed on the dispatch branch this session, all four gates green: `d0283b4` Phase C cut 3 caller-wiring — MembershipModal closes the org-issuance loop end-to-end. Working tree clean. Branch `claude/multisig-orgs-status-jiLwm` carries this work; main remains at `1ca0059` (the prior carpenter's close-out merge) until the operator merges the branch from the cockpit.

**Operator-mode note:** Dispatched session via Claude Code on the web. Single-prompt direction — "Cut what is next on list take as big of a chunk as you can handle safely" — handed off to the SessionStart-injected inheritance which explicitly named caller-wiring for cut 3 as the recommended first move. Session ran one focused commit, all four gates each pass, and closed at the natural arc boundary (Phase C complete). First time in this project the closed-loop hook substrate has fired both ends: the prior session pushed `CARPENTER_HANDOFF.md` to main, and this session's SessionStart hook read it from `origin/main` and injected it as the first context — the loop validated structurally on the second invocation of its existence.

## WHAT-CHANGED-RECENTLY

One commit on the dispatch branch, closing the Phase 8 Phase C arc end-to-end.

`d0283b4` Phase C cut 3 caller-wiring — `src/features/connections/createMembership.ts` `buildMembershipDraft` gains optional `authorizedBy` parameter that bakes an `authorized_by` top-level leaf via `encodeAuthorizedBy` from `governance/authRule.ts`. Back-compat path preserved when no payload is supplied — pre-Phase-8 orgs continue to ship the original five-field membership shape unchanged. `src/features/connections/MembershipModal.tsx` pulls `findOwnOrgDeclaration`, `findAuthRule`, and `buildAuthorizedByPayload` into useMemo derivations off holdings + wallet.identity, threads `authorizedBy` through the existing `buildMembershipDraft` call in `onScanIdentity`, and renders an amber banner on the issue-show step when the rule's threshold is greater than one. The banner exposes a "Request co-signs from eligible signers" button that opens a lazy-loaded `CosignRequestModal` with `orgContext={orgSelfDecl: ownOrg, action: 'routine_issuance'}` — same lazy chunk that `JournalDetail` and `PromoteRouter` already share, so no static-import bloat hit HomeScreen.

`src/features/connections/createMembership.test.ts` (new, ~140 lines) — four round-trip tests through `verifyOrgAuthorization`: back-compat draft has no `authorized_by` leaf; threshold=1 founder-only happy path returns `authorized: true` with `eligibleCount: 1`; threshold=2 single-sig refusal returns `authorized: false` with `reason` containing "threshold not met"; threshold=2 dual-sig acceptance returns `authorized: true` with `eligibleCount: 2` once the second eligible signer co-signs the same envelope.

`PLAN.md` Phase 8 Phase C bullet marked `[DONE 2026-05-26]` with a one-paragraph rollup of cuts 1, 2, and 3 explicitly naming the new MembershipModal wiring and noting that the deferred RulesEditorModal belongs in Phase D's charter-amendment chain.

`src/features/connections/manifest.ts` notes extended with one final paragraph documenting the new `buildMembershipDraft` parameter, the `MembershipModal` threading, the threshold-conditional banner + lazy CosignRequestModal, and the four round-trip tests; touches list adds `createMembership.test.ts`.

All four pre-push gates clean: typecheck, lint, 140/140 tests (4 new), build clean in ~3.3s, bundle-budget audit OK across every named chunk. No budget bumps required — HomeScreen carries MembershipModal as static import and the growth fit existing 18.5KB budget.

## WHAT'S-PENDING

Phase C as briefed is complete. The org-control axis from the canonical Tapscript-style brief now spans producer (Phase A), verifier (Phase B), creation UI (cut 2), request UI (cut 3 modal), and caller-wiring (this session). The fourth Phase C bullet (post-declaration `RulesEditorModal`) was explicitly delegated to Phase D's charter-amendment chain because it depends on `walkCharterChain` / `findActiveCharter` substrate.

Open axes:

Phase D — charter amendment chain (`walkCharterChain` / `findActiveCharter`) + dissolution endpoint + the deferred `RulesEditorModal`. Each new self-declaration must be authorized by the prior charter's `charter_amendment` rule. About one to two sessions. Brief of record: `2026-05-25-tapscript-style-org-authorization-tree-roadmap.md` under `### Phase D`.

Phase E1 — extend `AuthRule` in `governance/authRule.ts` to a discriminated union with the join-rule kind. Independent of Phase D; opens the membership-acquisition axis for the open-joining substrate (Phase E2-E5). One focused session. Brief of record: `2026-05-25-open-joining-and-configurable-membership-policy-roadmap.md`.

Three-manifest governance-direction notes sentence sweep — `connections/manifest.ts`, `cosigning/manifest.ts`, `settings/manifest.ts` all depend on `governance` without explaining why the dependency direction reads upside-down on first inspection. A five-minute autonomous cut adding "governance is the substrate primitive; this feature consumes it" to each notes field would be cheap and closes the most pickable thread the prior letter flagged.

Natural next chip for the operator on session start: Phase D, Phase E1, the three-manifest sweep, or "first browser-verify the closed loop end-to-end against the live deploy".

## WHAT-TO-FLAG

`HomeScreen.tsx` is at 797 lines, three lines under the 800-line hard limit that fails `npm test`. Phase D will almost certainly add to either HomeScreen or MembershipModal or both. The honest move when the file is next touched substantively is to lazy-load `MembershipModal` from `HomeScreen` (the same pattern `OrgRulesEditor` uses in `SettingsScreen`). That frees ~0.5KB from the HomeScreen chunk and also pushes the new CosignRequestModal lazy import one layer further from the cold-start path. Not urgent today but the margin is thin enough to flag.

`MembershipModal.tsx` hard-codes `'routine_issuance'` as the only issuance action. The constant is named `ROUTINE_ISSUANCE` at the top of the file, with a comment explaining the limitation. A future cut should add a chip-form action picker on the `issue-scan` step when the operator's org has more than one issuance-capable rule. Acceptable today because the canonical brief says routine issuance is the only issuance-capable rule until Phase D adds explicit per-action chips.

The amber banner copy on the `issue-show` step leans technical. Honest, but a copy review when a non-technical reader is in front of the screen would be a good pass. Phase D will probably touch this surface again, so the review is well-timed at that point.

The "Closed-Loop Hand-Off Protocol" doctrine block in `CLAUDE.md` was added in the prior session and was already flagged for fleet-wide propagation. This session validated the loop end-to-end — the prior session pushed the letter to main as a final act, this session's SessionStart hook read it from `origin/main` and injected it as additionalContext, and the recommended first move proved to be exactly the cut to take. The loop's structural guarantee holds. Worth noting in the next skeleton-bundle sweep that the protocol is not just specified — it's now operationally validated.

## RECOMMENDED-NEXT-MOVES

For the operator: browser-test the closed loop against the live Netlify+Supabase deploy. Walk: log in, open Settings, declare the wallet as a multi-rule org (founder + one peer eligible, threshold 2 for routine_issuance), confirm the rule renders correctly in OrgRulesEditor; close Settings, open Connections > Membership > Issue a membership, scan a recipient's identity QR, confirm the amber Request co-signs banner appears on the issue-show step, tap it, confirm CosignRequestModal opens with the action banner + constrained eligible-signers picker. If every step holds, the Phase C arc is verified end-to-end in production and the operator can confidently chip the next axis.

For the Foreman: a Phase D pre-brief would benefit from naming three things up front. First, the `RulesEditorModal` deferred from Phase C belongs here and should be sized as part of Phase D's first cut not as a bolted-on after. Second, the `MembershipModal` action-picker chip (so the operator can choose which rule a given membership is issued under) is a natural Phase D sub-cut once `findActiveCharter` exists to enumerate the currently-active rules. Third, `HomeScreen.tsx` is three lines from the hard limit and the load-bearing first move of any Phase D session that touches Home should be lazy-loading `MembershipModal` to free margin before adding anything new.

For both: the closed-loop hand-off substrate's second invocation worked exactly as designed. Worth a sentence of acknowledgement in the next inheritance letter — not for vanity but because future carpenters reading the protocol will benefit from knowing it's been validated under real conditions, not just specified.

## Ideas ready to revisit

Nothing new surfaced this session — the operator's prompt was direct and the work followed the prior letter's specification exactly. The mycelial ideas file under `project-memory/foreman-memory/core/ideas.md` carries no entries that fit this session's surface; no surfacing rule fired.
