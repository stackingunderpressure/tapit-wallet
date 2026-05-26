# carpenter-state-for-foreman — HomeScreen lazy-load + Phase E1 substrate

> PFOR-012 structured operational state. Written 2026-05-26 morning at session close-out. Two commits landed on the dispatch branch this session, all four gates green: `09926a1` lazy-load MembershipModal from HomeScreen + extract OrgIdentitySections, and `9989bc0` Phase 8 Phase E1 — AuthRule discriminated-union with join-rule kind. Working tree clean. Branch `claude/multisig-orgs-status-jiLwm` carries this work plus the prior session's `d0283b4` caller-wiring commit; main remains at `1ca0059` (the prior carpenter's close-out merge from before cut 3 caller-wiring) until the operator merges the branch from the cockpit. Three commits on the branch ahead of main now.

**Operator-mode note:** Dispatched session via Claude Code on the web. Open-invitation prompt — "Fire it up and cut the next code until context is full and good a stopping point" — handed off to the SessionStart inheritance, which surfaced the prior letter from origin/main (`1ca0059`) rather than the fresher one on the dispatch branch. Carpenter grounded against the actual files in the branch, caught that the recommended-next-move (caller-wiring) had already shipped in `d0283b4`, and re-oriented via a chip-form direction question. Operator picked "HomeScreen lazy-load + Phase E1 (Recommended)" — the largest of the four chip options. Mid-session correction from the operator on the carpenter's use of "stale" to describe the handoff: dispatched-session protocol routes carpenter work through the cockpit's merge button, not direct-to-main, so the absence of newer work on main is structural rather than a bug. Correction landed cleanly; work continued without disruption.

## WHAT-CHANGED-RECENTLY

Two commits on the dispatch branch, both load-bearing for opening the membership-acquisition axis.

`09926a1` HomeScreen lazy-load + OrgIdentitySections extraction — `src/features/wallet-core/HomeScreen.tsx` switches `MembershipModal` from a static import to React.lazy with Suspense fallback. Same lazy pattern OrgRulesEditor uses from SettingsScreen. New `src/features/wallet-core/OrgIdentitySections.tsx` (~116 lines) holds the Identity-tab Officials roster + Members-issued sections that pure-render from props (`officials`, `issuedMemberships`, `onOpenOfficials`, `onOpenMembership`). The Organization banner above IdentityCard stayed inline. HomeScreen dropped from 796 to 725 lines (71-line headroom won). HomeScreen chunk dropped from ~17.8KB to 17.22KB gz cold-start; new MembershipModal chunk 2.84KB gz under the 4KB named budget added to `scripts/bundle-budget.mjs`. `wallet-core/manifest.ts` touches list extended with the new file.

`9989bc0` Phase 8 Phase E1 — AuthRule discriminated-union — `src/features/governance/authRule.ts` extended substantially. Existing `AuthRule` interface renamed to `AuthRuleForOrgAction` (preserves `{action, threshold, eligible}` shape; covers signer-side rules). New `AuthRuleForJoin` interface carries `{action: 'join', policy: JoinPolicy}` where `JoinPolicy` is a six-kind union: `open` / `allow_list` / `deny_list` / `requires_handshake` / `requires_credential` / `requires_vouch`. Re-exported `AuthRule` is the discriminated union. New type guards `isOrgActionRule` and `isJoinRule`. `encodeAuthRuleValue` / `decodeAuthRuleValue` / `buildAuthSubtree` dispatch by action name — `'join'` takes the policy path, anything else takes the `{threshold, eligible}` path. Pre-E1 declarations decode unchanged. Kind-specific validation runs at `buildAuthSubtree` time. `defaultAuthRules` return type tightened to `AuthRuleForOrgAction[]`. Three rule consumers narrow via `isOrgActionRule` at the lookup boundary: `MembershipModal` (issuance-rule useMemo refuses to bake authorized_by if non-org-action), `CosignRequestModal` (orgRule useMemo falls back to general PeerPicker on join-action context), `verifyOrgAuthorization` (returns `authorized: false` with honest "not a signer-side org-action rule" reason). `SettingsScreen` orgRules state and `OrgRulesEditor` value/onChange prop types tightened to `AuthRuleForOrgAction`. `createOrganization.test.ts` assertions narrowed via the type guard at three sites.

`src/features/governance/authRule.test.ts` (new, ~220 lines) — 22 tests covering: type-guard correctness; each of the six `JoinPolicy` kinds round-tripping encode → decode unchanged; pubkey lists sorted+lowercased inside the policy payload; decode rejecting malformed payloads (missing policy, unknown kind, non-array pubkeys, empty credential_type, non-positive vouch count); `buildAuthSubtree` accepting mixed rule sets, rejecting duplicate action names, enforcing kind-specific validation, and still throwing on existing org-action validation paths; backward compat — pre-E1 `{threshold, eligible}` value still decodes under non-join action names.

`src/features/governance/manifest.ts` notes extended with a paragraph documenting the discriminated union, the six policy kinds, the dispatch-by-action-name design, the new type guards, and the Phase E2/E3/E4 follow-on plan. `touches` list adds the new tests file.

`scripts/bundle-budget.mjs` gained two named budgets: `MembershipModal` at 4KB gz (Cut 1) and `authRule` at 3KB gz (Cut 2). Unnamed-chunk count dropped from 12 to 11.

All four pre-push gates clean across both commits: typecheck, lint, 162/162 tests (was 140; +22 new in authRule.test.ts), build clean with bundle budgets passing across every named chunk. No bumps to existing budgets needed.

## WHAT'S-PENDING

Phase E1 is data-model only by brief design — Phase E2 (joiner-side self-membership credential + Mycelium transport extension) is the natural producer-side follow-on and where the next session should start. Brief of record: `2026-05-25-open-joining-and-configurable-membership-policy-roadmap.md` under `### Phase E2`.

Open axes:

Phase E2 — joiner-side self-membership and transport. Add `buildSelfMembershipDraft(joiner, orgId, orgName)` to `createMembership.ts` (or sibling `createSelfMembership.ts` if file-size headroom argues for it) producing an unsigned credential-kind attestation with `credential_type: 'self_membership'` + `org_id` / `org_name` / `joined_at` / `requested_at` leaves. Joiner signs locally. Add `isSelfMembership` / `readSelfMembership` predicates. Extend `src/features/transport/envelopeRoute.ts` Phase 5c-i-ε inbox routing to recognize incoming self-membership envelopes and route to a new acceptor handler placeholder (actual acceptor ships in Phase E3). About one focused session.

Phase D — charter amendment chain (`walkCharterChain` / `findActiveCharter`) + dissolution endpoint + the deferred `RulesEditorModal`. Each new self-declaration must be authorized by the prior charter's `charter_amendment` rule. Continues the org-control axis. About one to two sessions. Brief of record: `2026-05-25-tapscript-style-org-authorization-tree-roadmap.md` under `### Phase D`.

Three-manifest governance-direction notes sentence sweep — `connections/manifest.ts`, `cosigning/manifest.ts`, `settings/manifest.ts` all depend on `governance` without explaining the dependency direction. Deferred again this session (third letter in a row). Five-minute autonomous cut adding "governance is the substrate primitive; this feature consumes it" to each notes field. Cheapest pickable thread.

Bundle-budget script unnamed-chunk hygiene sweep — 11 chunks fall through to the catch-all. Each is small enough to pass but the script's intent is explicit named budgets per chunk. Low-energy session task.

Operator-side: browser-verify the Phase C end-to-end loop against the live deploy (declare a multi-rule org via Settings, issue a membership, confirm the amber Request co-signs banner + constrained eligible-signers picker fires in CosignRequestModal). Still pending from the prior letter — operator's call, not a carpenter task.

Natural next chip for the operator on session start: Phase E2, Phase D, three-manifest notes sweep, or bundle-budget hygiene sweep.

## WHAT-TO-FLAG

`src/features/governance/authRule.ts` at 430 lines is over the 400-line soft warn. Phase E2 weight may push it past comfortable. Natural split when it earns extraction: `authRule.ts` keeps the rule primitives and field-tree encoding/decoding; `authorizedBy.ts` takes the `AuthorizedByPayload` + encode/decode/build helpers because those two surfaces are coherent and consumed independently. Don't pre-extract — let Phase E2's actual weight decide.

`src/features/connections/createOrganization.ts` grew from 534 to 546 lines (verifyOrgAuthorization gained the narrow-by-type-guard branch). Still well under hard limit. Officials-roster extraction (~75 lines into sibling `officialsRoster.ts`) remains the obvious next move named by two prior letters; would drop the file under the warn.

`src/features/settings/SettingsScreen.tsx` at 789 lines is approaching extraction territory. The org-mode section is the natural target when Phase E4 adds the join-policy picker chip; the right shape and reason both arrive then. Don't pre-extract.

`MembershipModal.tsx` hard-codes `ROUTINE_ISSUANCE` as the only issuance action. Chip-form action picker on the `issue-scan` step is a Phase D / E4 follow-up (depends on `findActiveCharter` to enumerate currently-active rules). Comment in file names this.

Eight files now trigger the 400-line file-size warn collectively: `authRule.ts` (430), `createOrganization.ts` (546), `WalletGuide.tsx` (710), `HandshakeModal.tsx` (697), `FreshOnboarding.tsx` (776), `RecoveryInitiatorModal.tsx` (800), `SettingsScreen.tsx` (789), `WalletProvider.tsx` (751), `HomeScreen.tsx` (726). The warn-chorus is reaching the point where signal goes stale unless extractions ship. Doctrine intent is warns get acted on, not just absorbed. A future session could pick the most-honest single extraction and ship it as a focused cut.

Bundle-budget unnamed-chunk count dropped from 12 to 11 this session (named `authRule`). Eleven small chunks still falling through to the catch-all. Hygiene-only — not load-bearing — but the convention is named budgets per chunk.

## RECOMMENDED-NEXT-MOVES

For the operator: chip-pick the next axis between Phase E2 (recommended — natural extension of the substrate just shipped), Phase D (continues the org-control axis; one to two sessions), the three-manifest notes sweep (low-energy polish), or the bundle-budget hygiene sweep. The Phase C end-to-end browser verification from the prior letter remains pending and is operator-side work the carpenter can't do.

For the Foreman: a Phase E2 pre-brief would benefit from naming three things up front. First, the file-placement decision (self-membership helpers in `createMembership.ts` vs. a sibling `createSelfMembership.ts`) — recommend the sibling because `createMembership.ts` is at 122 lines and adding ~80 lines of self-membership helpers would still leave headroom but the conceptual separation is cleaner; org-issued vs joiner-signed are different roles. Second, the transport-side routing extension (`envelopeRoute.ts` adding a `'self-membership-receive'` action) is a small extension of the existing Phase 5c-i-ε pattern; reference the `'membership-receive'` and `'recovery-share-receive'` cases as the model. Third, the acceptor handler placeholder in Phase E2 should be wired but no-op — the actual evaluation against the join-rule ships in Phase E3 and is the heaviest Phase E cut.

For both: the dispatched-session structural framing the operator corrected the carpenter on mid-session is worth preserving as doctrine. "Stale" is the wrong word for a tip-of-main handoff letter that doesn't carry the dispatch-branch work yet; the framing is "one merge behind" or "pending merge from cockpit". Worth a sentence in the next skeleton-bundle of `CLAUDE.md` so future carpenters don't have to be corrected on the same framing.

## Ideas ready to revisit

Nothing new surfaced this session. The session opened on an inherited recommendation, got re-pointed mid-action via chip-form when the recommendation turned out to already be done, and ran two cuts on the substantive next axes. The mycelial ideas file under `project-memory/foreman-memory/core/ideas.md` carries no entries that fit this session's surface; no surfacing rule fired.
