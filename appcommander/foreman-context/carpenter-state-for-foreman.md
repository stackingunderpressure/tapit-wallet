# carpenter-state-for-foreman — Phase E2 joiner-side self-membership

> PFOR-012 structured operational state. Written 2026-05-26 mid-morning at session close-out. One commit of code (Phase 8 Phase E2) plus one close-out commit landed on the dispatch branch `claude/multisig-orgs-status-jiLwm` this session; branch tip pushed to main per PFOR-016 so the Stop-hook gate clears. All four gates green. 176/176 tests passing.

**Operator-mode note:** Dispatched session via Claude Code on the web. Open-invitation prompt — "Fire up and find the next chunk of work to cut to fill a session of context and stop in a safe spot." Wake-up surfaced an unusual state: the SessionStart hook injected the prior Phase E1 letter from origin/main, but the working tree held a substantively complete Phase E2 cut from a dispatched session that ended before commit. Carpenter grounded against the actual files in the branch, verified all four gates green against the in-flight work, audited file-size claims against reality, adopted the prior session's drafted CARPENTER_HANDOFF.md and current.json as accurate descriptions of the shipped work, completed the missing 4 close-out artifacts (in-flight.jsonl, interactions.jsonl, this file, carpenter-opinions.md), committed both the technical work and the close-out flush, and pushed branch tip to main. Branch and main now at the same SHA. Next session's SessionStart will read a fresh letter.

## WHAT-CHANGED-RECENTLY

One commit of substantive code on the dispatch branch shipping Phase 8 Phase E2 from the open-joining brief — the joiner-side substrate of the membership-acquisition axis plus the org-side inbox routing that recognizes incoming self-membership envelopes and dispatches them to a placeholder acceptor.

`src/features/connections/createMembership.ts` grew from 122 to 223 lines with four new exports inside the existing file (no sibling `createSelfMembership.ts` — the two credential shapes stay close enough that consumers see them side-by-side and the file remains well under the 400-line soft warn). `buildSelfMembershipDraft(joinerIdentity, orgId, orgName)` produces an unsigned credential-kind attestation with `credential_type: 'self_membership'` and top-level `org_id` / `org_name` / `joined_at` / `requested_at` leaves all set at draft time in a single `new Date().toISOString()` call. `isSelfMembership` is the mutually-exclusive predicate to `isMembership` — both gate on `att.kind === 'credential'` but `credential_type` discriminates. `readSelfMembership` lifts signed leaves into a `SelfMembershipView` for downstream display. `receiveSelfMembership` is the Phase E2 acceptor placeholder — throws on non-self-membership shape (integrity gate) then holds + anchors locally via `holdAndAnchor`. Phase E3 layers join-policy evaluation + pending-roster buffering on top of this hook without touching the routing surface.

`src/features/transport/envelopeRoute.ts` gained a new `InboxRouteAction` (`self-membership-receive`) and a `routeFor` branch that dispatches `isSelfMembership` envelopes to it. Label reads "Accept join request" with the hint "A self-membership claim addressed to your organization."

`src/features/wallet-core/HomeScreen.tsx` imports `receiveSelfMembership` and adds an `acceptSelfMembership` branch to its `routeInbox` switch mirroring `acceptMembership` exactly — call the receive helper, save and refresh wallet state, dismiss the inbox row. New helper async function `acceptSelfMembership` follows the same pattern as `acceptMembership` / `acceptRecoveryShare`. File grew 725 → 748 lines (well under the 800-line hard limit) and chunk stayed at 17.28 KB gz under the 18 KB named budget.

`src/features/connections/createMembership.test.ts` grew from 140 to 293 lines with 9 new tests across four describe blocks: `buildSelfMembershipDraft` (subject-binding, timestamp identity, joiner-signable round-trip), `isSelfMembership` (positive case, complement to `isMembership` on org-issued shape, kind-mismatch on handshake), `readSelfMembership` (full field round-trip through the view), `receiveSelfMembership` (integrity gate throws on wrong-shape, signed envelope is hold-able via direct `wallet.hold`). Storage round-trip through `receiveSelfMembership` itself is deferred — `anchorQueue.upsert` hits IndexedDB which jsdom does not ship; Phase E3 will need fake-indexeddb or a polyfill if it wants storage assertions beyond what `wallet.hold` provides.

`src/features/transport/envelopeRoute.test.ts` (new, 95 lines) — 5 dispatch tests asserting `routeFor`'s verdict for every shape the dispatcher knows about: self-membership, org-issued membership, single-signed Tier P handshake, counter-signed Tier P handshake, single-signed Tier R remote handshake. A future shape addition cannot quietly steal a route from an earlier one.

Both `connections/manifest.ts` and `transport/manifest.ts` gained Phase E2 paragraphs documenting the cut and naming Phase E3 as the natural follow-on.

All four gates green: typecheck clean, eslint clean, 176 of 176 tests passing (was 162; +14 new — 9 in createMembership.test.ts plus 5 in envelopeRoute.test.ts), build clean with bundle budgets passing across every named chunk. No bumps to existing budgets required.

## WHAT'S-PENDING

Phase E3 is the natural next axis but it cannot start cleanly until the operator picks the open-joining substrate between Option 1 (org publishes signed roster of accepted members), Option 2 (verifier walks the org's auth tree directly to check the joiner's claim against the declared policy), and Option 3 (hybrid). The Phase E2 cut was deliberately written to work cleanly under all three so the substrate decision does not block this session, but Phase E3 cannot ship without it — the code path under Option 1 ships a roster-publish job and a pending-roster buffer, while Option 2 skips most of E3 entirely and pushes verification to Phase E4's joiner-side verifier.

Open axes after the substrate chip lands:

Phase E3 — org-side acceptor with join-policy evaluation. Replace the `receiveSelfMembership` placeholder with the real org-side acceptor: look up the org's declared join-policy via `findAuthRule`, evaluate the joiner's claim against the relevant policy kind (open / allow_list / deny_list / requires_handshake / requires_credential / requires_vouch), and either accept or reject. Under Option 1, additionally publish a roster snapshot. One to two sessions depending on substrate.

Phase E4 — joiner-side UI + verifier. The Settings org-mode picker chip for join-policy when the operator declares their wallet as an org. The joiner-side UI for browsing orgs and submitting a self-membership envelope. A `verifyJoinAuthorization(envelope, org)` primitive that complements `verifyOrgAuthorization`. About one to two sessions.

Phase D — charter amendment chain (`walkCharterChain` / `findActiveCharter`) + dissolution endpoint + the deferred `RulesEditorModal`. Each new self-declaration must be authorized by the prior charter's `charter_amendment` rule. Continues the org-control axis. Independent of the Phase E substrate decision. About one to two sessions. Brief of record: `2026-05-25-tapscript-style-org-authorization-tree-roadmap.md` under `### Phase D`.

Three-manifest governance-direction notes sentence sweep — `connections/manifest.ts`, `cosigning/manifest.ts`, `settings/manifest.ts` all depend on `governance` without explaining the dependency direction. Now deferred FOUR letters in a row. Five-minute autonomous cut adding "governance is the substrate primitive; this feature consumes it" to each notes field. Cheapest pickable thread.

Bundle-budget script unnamed-chunk hygiene sweep — 11 chunks fall through to the catch-all. Each is small enough to pass but the script's intent is explicit named budgets per chunk. About 15 minutes if the bundle map is open.

`createOrganization.ts` officials-roster extraction — file at 546 lines, the ~75-line officials-roster sub-tree extracts cleanly into a sibling `officialsRoster.ts`. Drops the file back under the 400-line soft warn. Low-risk pickable cut.

Operator-side: browser-verify the Phase C end-to-end loop against the live deploy (declare a multi-rule org via Settings, issue a membership, confirm the amber Request co-signs banner + constrained eligible-signers picker fires in CosignRequestModal). Still pending from before — operator's call, not a carpenter task.

## WHAT-TO-FLAG

The wake-up state was unusual and worth naming for Frank: the prior dispatched session ended without committing despite having completed all the technical work AND drafted two of the six close-out artifacts. The grounding gate caught it because the actual files in the branch contradicted the SessionStart-injected letter. This is a real failure mode the dispatched-session model can hit, and the recovery cost was non-trivial (about a third of this session's context burned on verification, audit, and close-out completion). Worth a roadmap item: a heartbeat-style harness guard that periodically commits WIP to a `wip/` branch so an ungraceful session death leaves a trail rather than a working-tree orphan that only the next session can see.

The three-manifest governance-direction notes sweep is now deferred FOUR letters in a row. Each carpenter chooses a larger cut over the cheap autonomous polish. The deferral is becoming its own thread of entropy in the carpenter-to-carpenter inheritance chain. Frank should consider whether to pre-brief it as a non-negotiable next-cut to break the deferral cycle.

## RECOMMENDED-NEXT-MOVES

1. **Operator picks the Phase E open-joining substrate** via a chip-form direction question. Three options: Option 1 (org publishes signed roster), Option 2 (verifier walks auth tree directly), Option 3 (hybrid). The chip is the only thing blocking Phase E3 from starting cleanly.

2. **If the substrate chip drags**, the next carpenter takes Phase D (charter amendment chain) as it does not depend on the Phase E substrate decision, or the three-manifest governance-direction notes sweep as the cheapest pickable autonomous cut to break the four-letter deferral cycle.

3. **Low-energy session candidates** if the operator wants a lighter cut: bundle-budget unnamed-chunk hygiene sweep (11 chunks, ~15 minutes), `createOrganization.ts` officials-roster extraction (~75 lines into a sibling, drops file under the 400-line soft warn), or the manifest notes sweep.

## OPERATOR'S-CURRENT-VIBE

Open-invitation framing — "Fire up and find the next chunk of work to cut to fill a session of context and stop in a safe spot." Trusting the carpenter to choose the axis and execute. The operator is operating in delegate-and-verify mode, not in chip-driven specify mode this session. They want big chunks shipped safely with proper close-out. The carpenter's job is to find the cut, do it cleanly, and stop in a spot where the next session has a clean inheritance — which is exactly what the closed-loop hand-off doctrine is designed for. The wake-up surprise (unfinished work in the tree) was handled per doctrine (verify, complete, commit) without operator intervention; the operator gets a clean branch and main at the same tip after this push.

## Ideas ready to revisit

Nothing new this session. The deferred-four-times manifest notes sweep is the most-ready idea waiting to mature into action; the heartbeat-WIP-branch idea above is fresh and at the raw-insight stage — worth logging in the project ideas file when the operator next does a memory pass.
