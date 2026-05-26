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

## Latest letter — 2026-05-26 early morning (Phase C cut 3 caller-wiring — org-issuance loop closes end-to-end)

### What just shipped

One commit landed on the dispatch branch this session — `d0283b4` —
and it was the close-out of the Phase 8 Phase C arc. The prior
carpenter's letter explicitly named caller-wiring for the new
`CosignRequestModal` `orgContext` mode as the recommended first
move and flagged the prop as dead code until a caller constructs
it. I took that as the cut. The natural caller is `MembershipModal`
because that's where the operator's wallet — acting as an
organization — actually signs a membership envelope, so that's the
point where authorized_by needs to be baked in and the threshold
needs to be checked for further co-signs. The cut had two halves
that depend on each other.

The first half was `src/features/connections/createMembership.ts`:
`buildMembershipDraft` gained an optional third parameter,
`authorizedBy`, of type `AuthorizedByPayload` from
`governance/authRule.ts`. When supplied, the draft adds a top-level
`authorized_by` leaf encoded via `encodeAuthorizedBy` before being
handed off to the signer; the org's signature then covers that
leaf, so a downstream attacker cannot detach the disclosure proof,
swap in a different one, and present the new combination as
still-signed. Omitted, the draft falls back to the original
five-field shape and pre-Phase-8 orgs (whose self-declarations
predate the auth tree) continue issuing memberships exactly as
before. Back-compat is structural rather than a flag.

The second half was `MembershipModal.tsx`: the modal now reads
`holdings` from `useWallet`, derives `ownOrg` via
`findOwnOrgDeclaration(holdings, wallet.identity)` in a useMemo,
derives the `routine_issuance` rule via `findAuthRule(ownOrg,
'routine_issuance')` in a second useMemo, builds the
`AuthorizedByPayload` via `buildAuthorizedByPayload(ownOrg,
'routine_issuance')` inside `onScanIdentity`, and threads it into
the existing `buildMembershipDraft` call right before `wallet.sign`.
The `routine_issuance` constant lives at the top of the file with
a comment naming the Phase D follow-up that will add a chip-form
action picker when an org has more than one issuance-capable rule.
When the rule's threshold is greater than one, the issue-show step
renders a new amber banner under the QR titled "Needs co-signs to
satisfy routine_issuance" with a "Request co-signs from eligible
signers" button. The button opens a lazy-loaded `CosignRequestModal`
via `lazy(() => import('../cosigning/CosignRequestModal.tsx')...)`
with `orgContext={orgSelfDecl: ownOrg, action: 'routine_issuance'}`
passed as the second prop. The lazy chunk is the same one
`JournalDetail` and `PromoteRouter` already share, so the
MembershipModal's static surface in the HomeScreen chunk gained
maybe 400-600 bytes gz and rode in comfortably under the existing
18.5KB budget without a bump.

`createMembership.test.ts` is new and ships four round-trip tests
that exercise the producer-verifier loop end-to-end:
back-compat draft has no `authorized_by` leaf; threshold-one
founder-only happy path returns `verifyOrgAuthorization` =
`authorized: true` with `eligibleCount: 1, thresholdRequired: 1`;
threshold-two single-sig refusal returns `authorized: false` with
the reason containing "threshold not met"; threshold-two dual-sig
acceptance returns `authorized: true` with `eligibleCount: 2` once
the second eligible signer co-signs the same envelope. That fourth
test is the one that proves the closed loop works under genuine
multi-sig conditions, not just the trivial single-eligible case.
`PLAN.md` Phase 8 Phase C bullet is now marked `[DONE 2026-05-26]`
with a one-paragraph rollup of cuts 1, 2, 3 and an explicit note
that the deferred `RulesEditorModal` belongs to Phase D's
charter-amendment chain rather than to a Phase C follow-up.
`connections/manifest.ts` notes extended with one final paragraph
documenting the new wiring + the four round-trip tests; touches
list adds `createMembership.test.ts`. All four gates green:
typecheck clean, eslint clean, 140/140 tests, build clean in ~3.3s
with bundle-budget audit OK across every named chunk.

### What's hot right now

Nothing. The working tree is clean, the dispatch branch
`claude/multisig-orgs-status-jiLwm` is at `d0283b4`, the close-out
flush you are reading is the deliverable for this session, and
main remains at `1ca0059` (the prior carpenter's close-out merge)
until the operator merges the branch from the cockpit. The next
carpenter inherits a clean shared base with no half-finished cuts.
Phase C as briefed is complete — the org-control axis spans
producer (Phase A), verifier (Phase B), creation UI (cut 2),
request UI (cut 3 modal), and caller wiring (this session).

### Land-mines for the next carpenter

`HomeScreen.tsx` is at 797 lines, three lines under the 800-line
hard limit that fails `npm test` (the file-size test FAILS past
800, doesn't just WARN). Phase D will almost certainly add to
either HomeScreen or `MembershipModal.tsx` or both. The honest
move when the file is next touched substantively is to lazy-load
`MembershipModal` from `HomeScreen` (the same pattern
`OrgRulesEditor` uses in `SettingsScreen`). That frees ~0.5KB
from the HomeScreen chunk and pushes the new `CosignRequestModal`
lazy import one layer further from the cold-start path. Not
urgent today but the margin is genuinely thin.

`MembershipModal.tsx` hard-codes `'routine_issuance'` as the only
issuance action via a `ROUTINE_ISSUANCE` constant at the top of
the file. The comment names the Phase D follow-up that will add
a chip-form action picker on the `issue-scan` step when the
operator's org has more than one issuance-capable rule. Acceptable
today because the canonical brief says routine issuance is the
only issuance-capable rule until Phase D adds explicit per-action
chips, but flagged so future cuts don't miss it.

The three-manifest governance-direction notes sentence sweep is
still pending from the prior letter. `connections/manifest.ts`,
`cosigning/manifest.ts`, and `settings/manifest.ts` all depend on
`governance` without explaining why the dependency direction
reads upside-down on first inspection. A five-minute autonomous
cut adding "governance is the substrate primitive; this feature
consumes it" to each notes field would be cheap and would close
the most pickable thread the prior letter flagged. I held off
this session because cut-3 caller-wiring was the load-bearing
work and one focused commit was the right shape.

`createOrganization.ts` still sits at 534 lines over the 400
soft-warn threshold; the file-size warning fires loudly every
test run. The prior letter named officials-roster extraction
(~75 lines into a sibling `officialsRoster.ts`) as the obvious
future cut to drop the file under the warn. Still applies.
`SettingsScreen.tsx` at ~765 lines is in the same shape — under
the hard limit, well over the soft warn, and the next Phase D
cut that adds to the org-mode section should extract that
section into a sibling `OrgModeSection.tsx`.

### Operator mood-read

Direct and trusting. The operator's prompt was one sentence —
"Cut what is next on list take as big of a chunk as you can
handle safely" — handed off to the SessionStart-injected
inheritance letter which explicitly named caller-wiring as the
recommended first move. No chip-form direction asks were needed
because the next move was unambiguous in the inheritance and
the operator's prompt explicitly authorized "as big of a chunk
as you can handle safely". The session ran one focused commit,
all four gates each pass, and closed at the natural arc boundary
when Phase C went from three-of-four-cuts-done to done. First
time the closed-loop hook substrate has fired both ends in
production — the prior session pushed `CARPENTER_HANDOFF.md` to
main as the final act of close-out, this session's SessionStart
hook read it from origin/main and injected it as the first
context, and the recommended first move proved to be exactly
the cut to take. The loop validated structurally on the second
invocation of its existence, which is worth noting because
future carpenters reading the protocol benefit from knowing
it's been validated under real conditions and not just specified.

### Recommended first move for the next session

Browser-test the closed loop against the live Netlify+Supabase
deploy before doing anything else. Walk: log in, open Settings,
declare the wallet as a multi-rule org with the founder plus one
peer eligible and threshold 2 for routine_issuance, confirm the
rule renders correctly in `OrgRulesEditor`; close Settings, open
Connections > Membership > Issue a membership, scan a recipient's
identity QR, confirm the amber "Needs co-signs to satisfy
routine_issuance" banner appears on the issue-show step, tap the
"Request co-signs from eligible signers" button, confirm
`CosignRequestModal` opens with the action banner and the
constrained eligible-signers picker rendering one-tap rows for
the founder and the peer. If every step holds, Phase C is
verified end-to-end in production and the next chip is genuinely
an axis-pick rather than a within-axis pick.

After verification, the natural axes are: Phase D (charter
amendment chain via `walkCharterChain` and `findActiveCharter`
plus the dissolution endpoint and the `RulesEditorModal`
deferred from Phase C; one to two sessions; continues the
org-control axis); Phase E1 (extend `AuthRule` in
`governance/authRule.ts` to a discriminated union with the
join-rule kind opening the membership-acquisition axis; one
focused session; brief of record
`project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-25-open-joining-and-configurable-membership-policy-roadmap.md`);
or the three-manifest governance-direction notes sentence sweep
as a low-energy autonomous polish session. Either of the first
two would benefit from the `MembershipModal` lazy-load from
`HomeScreen` as the load-bearing first cut before adding new
surface, because the HomeScreen chunk is three lines from the
hard limit. Brief of record for Phase C+D:
`project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-25-tapscript-style-org-authorization-tree-roadmap.md`.

If the SessionStart hook injected something that contradicts what's
above, trust the SessionStart hook — it reads from origin/main and
this file was current at the time of writing. Drift detection in
the same hook will flag if your branch has fallen behind main.

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
