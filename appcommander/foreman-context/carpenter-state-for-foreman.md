# carpenter-state-for-foreman — Phase C cuts 1, 2, 3 + closed-loop hook substrate

> PFOR-012 structured operational state. Written 2026-05-25 deep evening at session close-out. Four commits landed on main this session, all four gates green on each: `0e03300` Phase C cut 1 + Phase 4.5 reconcile + budget bump, `7ac4e7e` closed-loop carpenter hand-off substrate, `b55ccb4` Phase C cut 2 multi-rule org creation UI, `0f2ba8e` Phase C cut 3 CosignRequestModal org-action mode. Branch and main now coincident at `0f2ba8e`. Working tree clean.

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Voice-typed input via TTS playback throughout. Dual-surface comms active. v1 is shipped. Operator is on iOS. Session opened with "What is our next features on the roadmap that are not complete and what are some features that are missing?" — answered in single-block prose per PFOR-018; followed by ranked-cuts list + chip-form direction asks per PFOR-019; followed by a four-cut working session ending in operator-initiated wrap. First flush of AppCommander comms under the new "deferred-flush" doctrine the operator authorized mid-session.

## WHAT-CHANGED-RECENTLY

Four commits on main, walking the Phase 8 Tapscript-style org-governance arc from Phase B verifier through the badge surface, the org-creation form, and the cosign-request modal — plus the closed-loop carpenter hand-off substrate the operator surfaced mid-session.

`0e03300` Phase C cut 1 — `src/features/connections/RatificationsBadge.tsx` now reads `authorized_by` via `decodeAuthorizedBy` from `governance/authRule.ts` and appends `(rule: <action>)` to the label. `PLAN.md` Phase 4.5 reconciled from `[NEXT]` to `[DONE]` (tabbed home + Web Share Target capture bridge shipped quietly in earlier sessions). `scripts/bundle-budget.mjs` HomeScreen bumped 18KB → 18.5KB to absorb the import delta.

`7ac4e7e` Closed-loop substrate — new `CARPENTER_HANDOFF.md` at repo root carrying the format-template letter, extended `scripts/session-start-grounding.mjs` to read it from `origin/main` and inject as additionalContext alongside the existing drift report, `CLAUDE.md` gained the "Closed-Loop Hand-Off Protocol" section and the existing Live-Comms Protocol was softened from "write events in real time" to "buffer in memory, flush in one batch at session-end." The session you are reading this from is the first flush under the new doctrine.

`b55ccb4` Phase C cut 2 — new `src/features/settings/OrgRulesEditor.tsx` (~245 lines) renders the multi-rule editor: default routine_issuance rule shown as non-deletable card, "Add rule" mini-form with input-time validation mirroring all four `buildAuthSubtree` throws. `SettingsScreen.tsx` wires `orgRules` state through `selfDeclareOrganization`. Editor is React.lazy (1.9KB gz separate chunk, keeps SettingsScreen budget unchanged). `settings/manifest.ts` depends_on gains `governance` + `connections`; touches list gains OrgRulesEditor.tsx. `scripts/bundle-budget.mjs` adds a named OrgRulesEditor budget at 3KB gz.

`0f2ba8e` Phase C cut 3 — `CosignRequestModal.tsx` gains optional `orgContext: {orgSelfDecl, action}` prop. When present: looks up rule via `findAuthRule`, derives eligible-signer display names from handshake roster, renders banner with action+threshold, replaces general PeerPicker with constrained one-tap eligible list. `cosigning/manifest.ts` depends_on gains `connections` + `governance`. `scripts/bundle-budget.mjs` adds a named CosignRequestModal budget at 4KB gz.

All four pre-push gate sweeps clean: typecheck, lint, 136/136 tests, build clean in ~4.3-4.6s each.

## WHAT'S-PENDING

Three Phase C bullets done; the fourth (post-declaration `RulesEditorModal`) belongs in Phase D because it depends on the charter amendment chain substrate. So Phase C the canonical arc is essentially complete.

Phase C cut 3 ships substrate-only. The new `orgContext` prop is defined and the modal renders correctly when given one, but no production code path currently constructs the prop. The next natural cut wires a caller: grep `CosignRequestModal` in `connections/` and `messaging/`, find the org-issuance flow, construct `{orgSelfDecl, action: 'routine_issuance'}` at the org-side request point. One focused session. Closes the Phase C arc end-to-end in the browser.

Phase D — charter amendment chain (`walkCharterChain`, `findActiveCharter`, dissolution endpoint) plus the `RulesEditorModal` deferred from Phase C. One to two sessions. Brief of record: `2026-05-25-tapscript-style-org-authorization-tree-roadmap.md` `### Phase D` heading.

Phase E1 — extend `AuthRule` in `governance/authRule.ts` to a discriminated union with the join-rule kind. Independent of Phase D; opens the membership-acquisition axis for the open-joining substrate (Phase E2-E5). One focused session. Brief of record: `2026-05-25-open-joining-and-configurable-membership-policy-roadmap.md`.

Natural next chip for the operator on session start: caller-wiring for cut 3, Phase D, or Phase E1.

## WHAT-TO-FLAG

The new "Closed-Loop Hand-Off Protocol" doctrine block in `CLAUDE.md` is fleet-wide-shared per the file's own preamble — the next skeleton-bundle sweep will propagate it into by-bree, donna, mpea-coach, and any future skeletons. That's almost certainly what the operator intended (they named the idea generally, not as a tapit-wallet-specific override), but worth surfacing so the operator knows the next bundle carries the new doctrine fleet-wide. If they want this scoped to tapit-wallet, the doctrine needs an explicit scope-gating note which the current write does not include.

`SettingsScreen.tsx` is at roughly 765 lines, growing again. Phase D will likely add to the org-mode section. The 800-line hard limit blocks `npm test` (file-size test FAILS past 800, doesn't just WARN). The honest move when next touched substantially is to extract the org-mode section into a sibling `OrgModeSection.tsx`. Flag it for whoever picks Phase D.

Three feature manifests (`connections/manifest.ts`, `cosigning/manifest.ts`, `settings/manifest.ts`) now depend on `governance` without a one-sentence notes explanation of why governance sits below. The land-mine has multiplied from one manifest to three. A five-minute sweep to add "governance is the substrate, this feature consumes it" sentence to each notes field would be a cheap autonomous win.

The doctrine I added explicitly says "Mid-session writes are explicitly NOT allowed under the new cadence." That doctrine is what justified this single close-out flush. Future carpenters reading the old write-on-every-event pattern in `appcommander/comms/in-flight.jsonl` archive should know it's a doctrine pivot, not a sloppy session — the prior pattern was the standing order until this session, and the next session's events will be a single batch at close-out.

## RECOMMENDED-NEXT-MOVES

For the operator: optionally browser-test the multi-rule org creation form against the live Netlify+Supabase deploy. Walk: log in, open Settings, tap "Declare this wallet as an organization", confirm the default rule renders, tap "Add rule", paste a pubkey, set threshold 1, confirm validation handles the off-by-one cases. Then chip-pick the next move at session start.

For the Foreman: SUPERSEDED-BY banner pass across the three superseded org-governance briefs remains the cheapest high-value autonomous task and has now been pending across three close-outs. Alternatively, a Phase D pre-brief that names "import auth-rule helpers from governance/authRule.ts not from connections/createOrganization.ts" non-negotiably AND names the org-mode section extraction from SettingsScreen.tsx as the load-bearing first move would set the right shape from the start.

For both: the Phase C arc as briefed is essentially complete in three cuts. The org-control axis from the canonical Tapscript-style brief now spans producer (Phase A), verifier (Phase B), creation UI (cut 2), request UI (cut 3), badge surface (cut 1). Future cuts extend the surface rather than reshape the substrate. Phase D (charter amendment chain) and Phase E1 (join-rule kind) are the two open axes.

## OPERATOR'S-CURRENT-VIBE

Generative throughout. Session opened with the roadmap-status question, walked through the ranked-cuts list, and the operator picked the recommended Tier-0-then-Phase-C path. Mid-session the operator surfaced the closed-loop hook substrate as a side project and asked for confirmation of understanding before implementation — that's the operator's "test me back" pattern, the same one they use with the Foreman. They then approved the recommended sequence (commit Phase C cut 1 first, then start the hook work), authorizing two cuts in motion at once.

Chip-form direction worked smoothly. The operator picked each chip without hesitation; all four picks matched the (Recommended) option, which signals carpenter framing and operator intent were aligned end-to-end. Voice-typed prompts read as run-on but the meaning came through every time. The close-out was operator-initiated rather than carpenter-prompted — the chip "Wrap and close out" was picked when there was still capacity to keep cutting, suggesting the operator was happy with the day's surface and wanted to lock in a clean state for tomorrow.

The pace was sustainable: four commits across the session, each one small enough to commit individually, each one shipping with all four gates green. No false starts, no rework, no scope creep. The two-session arc of the org-control axis (Phase A + B yesterday, Phase C cuts 1/2/3 today) is now cohesive enough to demo end-to-end in the browser. The operator's wrap signal is the right move; the substrate is locked, the surface is legible, the loop is closed. Sleep cleanly.
