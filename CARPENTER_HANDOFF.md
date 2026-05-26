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

## Latest letter — 2026-05-26 morning (HomeScreen lazy-load + Phase E1 substrate)

### What just shipped

Two commits landed on the dispatch branch this session, both load-
bearing for clearing the next axis of work. The first was `09926a1`
— the safety-and-extraction cut the prior letter named as required
before any substantive new surface lands. `MembershipModal` is now
React.lazy from `HomeScreen` instead of a static import, the same
pattern `OrgRulesEditor` uses from `SettingsScreen`, and its lazy
chunk arrived at 2.84KB gz on the first build with a 4KB named
budget in `scripts/bundle-budget.mjs` to cover Phase D / E surface
growth. The lazy wrapper alone added about seven source lines to
HomeScreen, which would have pushed the file past the 800-line hard
limit, so the same commit extracted the Identity-tab Officials
roster + Members-issued sections into a new sibling component
`src/features/wallet-core/OrgIdentitySections.tsx`. The Organization
banner above IdentityCard stayed inline because it shares vertical
layout with the IdentityCard and AttestationCard right below it; only
the two below-IdentityCard sub-sections moved out. The extraction
took HomeScreen from 796 lines down to 725 and the HomeScreen chunk
from about 17.8KB gz down to 17.22KB gz at cold start. `wallet-core
/manifest.ts` touches list extended with the new file.

The second commit was `9989bc0` — Phase 8 Phase E1 from the open-
joining brief. `AuthRule` in `src/features/governance/authRule.ts`
is now a discriminated union of two kinds. `AuthRuleForOrgAction`
preserves the existing `{action, threshold, eligible}` shape and
covers signer-side rules (issuance, expulsion, charter amendment,
dissolution, anything the org itself takes action on); the encoded
leaf-value JSON shape is unchanged, so pre-E1 declarations decode
identically. `AuthRuleForJoin` is net-new and carries
`{action: 'join', policy: JoinPolicy}` where `JoinPolicy` is a
six-kind discriminated union covering the abuse-resistance postures
named in the brief: `open` (anyone with a wallet), `allow_list`,
`deny_list`, `requires_handshake` (must hold a Tier P or R handshake
with one of these pubkeys), `requires_credential` (must hold a
specific credential type, optionally issued by a named issuer), and
`requires_vouch` (existing members can vouch via co-signature).
Dispatch happens by action name in `encodeAuthRuleValue` /
`decodeAuthRuleValue` / `buildAuthSubtree` so a leaf whose name is
literally `join` takes the new policy path and any other leaf name
takes the existing `{threshold, eligible}` path. Type guards
`isOrgActionRule` and `isJoinRule` let consumers narrow the union
safely; the brief's Phase E1 scope is data-model only so no verifier
and no UI for join rules ship yet.

The narrowing cascade was the part I treated most carefully because
existing rule consumers read `rule.threshold` and `rule.eligible`
directly. `defaultAuthRules`'s return type tightened to
`AuthRuleForOrgAction[]` (it never returns join rules — it's the
founder-signs-everything fallback), which cascaded cleanly into
`SettingsScreen`'s orgRules state and `OrgRulesEditor`'s
value/onChange prop types both tightening to `AuthRuleForOrgAction`,
reflecting the editor's actual scope. Three lookup-boundary sites
narrow via `isOrgActionRule`: `MembershipModal`'s issuance-rule
useMemo refuses to bake `authorized_by` if the `routine_issuance`
leaf isn't org-action shape; `CosignRequestModal`'s orgRule useMemo
falls back to the general PeerPicker when handed a join-action
context; `verifyOrgAuthorization` in `createOrganization.ts` returns
`authorized: false` with an honest "not a signer-side org-action
rule" reason when the disclosed leaf is a join rule (joiner-side
verifier ships in Phase E4 as a sibling primitive). The
`createOrganization.test.ts` assertions narrowed via the same guard
at the three sites that read threshold/eligible directly.

New test file `src/features/governance/authRule.test.ts` ships 22
tests covering: each of the six `JoinPolicy` kinds round-tripping
encode → decode unchanged; pubkey lists getting sorted+lowercased
inside the policy payload exactly the way org-action eligible lists
already do; decode rejecting malformed payloads (missing policy,
unknown kind, non-array pubkeys, empty credential_type, non-positive
vouch count); `buildAuthSubtree` accepting a mixed rule set
(org-action + join), rejecting duplicate action names, enforcing
kind-specific validation; and backward compat (pre-E1 leaf values
still decode under non-join action names). The governance manifest
gained a paragraph documenting the discriminated union and the new
tests file in touches. A new bundle-budget entry for the `authRule`
chunk landed at 3KB gz; the chunk currently rides at 1.38KB gz, so
plenty of headroom for the Phase E2 self-membership decoder and
Phase D charter-amendment helpers that will join the file later.
All four gates green across both commits: typecheck clean, eslint
clean, 162 of 162 tests (was 140; 22 new), build OK with bundle
budgets passing across every named chunk.

### What's hot right now

Nothing. The working tree is clean, the dispatch branch
`claude/multisig-orgs-status-jiLwm` is at `9989bc0`, the close-out
flush you are reading is the deliverable for this session, and main
remains at `1ca0059` (still the prior carpenter's close-out merge)
until the operator merges the branch from the cockpit. The next
carpenter inherits a clean shared base with no half-finished cuts
and one whole open axis (Phase E2-E4) ready to start.

### Land-mines for the next carpenter

`src/features/governance/authRule.ts` is at 430 lines — over the
400-line soft-warn that fires loudly every test run. Not a hard
failure (the 800-line limit is what fails the file-size test) but
worth flagging. Phase E2 will add a self-membership decoder
(`buildSelfMembershipDraft`, `isSelfMembership`, `readSelfMembership`
helpers) that could land in this file or in a sibling
`createSelfMembership.ts`. If it lands here, the file pushes ~500
lines and the extraction question gets sharper. The natural split
when it earns extraction is into `authRule.ts` (the org-action +
join-rule primitives and the field-tree encoding/decoding) and
`authorizedBy.ts` (the `AuthorizedByPayload` + encode/decode/build
helpers for the cross-envelope authorization proof), because those
two surfaces are coherent and consumed independently.

`src/features/connections/createOrganization.ts` grew from 534 to
546 lines during this session because `verifyOrgAuthorization`
gained a narrow-by-type-guard branch. Still over the 400 soft warn,
still well under the 800 hard limit, but the officials-roster
extraction (~75 lines into a sibling `officialsRoster.ts`) the
prior letter named is still the obvious next move and would drop
this file under the warn. Re-exports of governance primitives from
`createOrganization.ts` are back-compat shims; new code should
import directly from `governance/authRule.ts` per the convention
the prior governance-extraction session named.

`src/features/settings/SettingsScreen.tsx` is at 789 lines now.
Still under the hard limit but close. The org-mode section is the
obvious extraction when Phase E4 adds the join-policy picker chip
to org-creation; that whole section becomes its own
`OrgModeSection.tsx` and SettingsScreen drops back into comfortable
range. Don't pre-extract — wait for Phase E4 to give it the
right shape and the right reason.

`MembershipModal.tsx` still hard-codes `'routine_issuance'` as the
only issuance action via the `ROUTINE_ISSUANCE` constant at the
top of the file. The comment there names the Phase D / E4 follow-up
that will add a chip-form action picker on the `issue-scan` step
when the operator's org has more than one issuance-capable rule.
Acceptable today; flagged so future cuts don't miss it. Phase E4 is
the natural home because that's when `findActiveCharter` exists to
enumerate the currently-active rules across the charter chain.

The three-manifest governance-direction notes sentence sweep that
the prior carpenter flagged twice now is STILL pending. I held off
again this session because the two cuts I took were both load-
bearing and I wanted to ship clean focused commits rather than a
mixed grab-bag. The sweep is `connections/manifest.ts`,
`cosigning/manifest.ts`, and `settings/manifest.ts` all gaining a
one-sentence "governance is the substrate primitive; this feature
consumes it" explanation so future auditors don't have to reverse-
engineer the dependency direction. Cheap and pickable as a low-
energy autonomous cut.

The bundle-budget script's catch-all currently buckets 11 unnamed
JS chunks (was 12 before I added a named budget for `authRule`).
Each is small (under 3KB gz, hence the catch-all pass) but the
script's stated intent is for every chunk to carry an explicit named
budget. Pre-existing hygiene debt — not load-bearing, but a cheap
follow-on cut if a session has spare context.

### Operator mood-read

Sharp and trusting in a hurry. The operator's prompt was the open
invitation to cut as much as I could safely handle, but the
SessionStart-injected handoff was the prior carpenter's `1ca0059`
letter from main rather than the fresher `8cf5af2` letter on the
dispatch branch — origin/main still doesn't carry the Phase C cut 3
caller-wiring close-out because the operator merges from the
cockpit, not from carpenters, and that merge hasn't happened yet.
I read the stale-on-main handoff and started planning the work the
prior prior letter had specified, then caught myself via the
grounding gate by reading the actual files in the branch and
noticing the caller-wiring was already done. I called the handoff
"stale" in my re-orientation reply and the operator corrected me
mid-action with "He didn't push to main lnuckle head" — a sharp
pointed correction that the prior carpenter had pushed correctly
per the dispatched-session branch-isolation protocol; the absence
on main is structural, not a bug. I acknowledged the correction
immediately and continued. Tonally the operator was efficient —
they want the carpenter to figure out the next work and execute it,
they care about precise framing, and they don't want the carpenter
to waste words. The chip-form direction question I asked after
re-orientation was answered "HomeScreen lazy-load + Phase E1
(Recommended)" with no hesitation, which is the largest of the four
options and matched the operator's stated appetite for chunky cuts.

### Recommended first move for the next session

Phase E2 — joiner-side self-membership and Mycelium transport. The
data-model substrate just shipped; the next natural cut is the
producer side of the open-joining axis. Concretely: add a new
helper to `src/features/connections/createMembership.ts` (or a
sibling `createSelfMembership.ts` if the file-size headroom argues
for it) named `buildSelfMembershipDraft(joiner, orgId, orgName)`
that produces an unsigned credential-kind attestation with
`credential_type: 'self_membership'` and a top-level
`org_id` / `org_name` / `joined_at` / `requested_at` leaf set. The
joiner signs it locally via `wallet.sign`. Add `isSelfMembership`
and `readSelfMembership` predicates alongside. Extend the Phase
5c-i-ε inbox routing in `src/features/transport/envelopeRoute.ts`
to recognize incoming self-membership envelopes and route them to
a new acceptor handler placeholder (the actual acceptor logic
ships in Phase E3). About one focused session. Brief of record:
`project-memory/foreman-memory/projects/tapit-wallet/briefs/
2026-05-25-open-joining-and-configurable-membership-policy-roadmap.md`
under `### Phase E2`.

Alternative first moves: Phase D (charter amendment chain via
`walkCharterChain` and `findActiveCharter` plus the dissolution
endpoint and the `RulesEditorModal` deferred from Phase C; continues
the org-control axis; one to two sessions); the three-manifest
governance-direction notes sentence sweep as a low-energy autonomous
polish session; or the bundle-budget script unnamed-chunk hygiene
sweep that names budgets for the 11 catch-all chunks. The operator
also still has the Phase C end-to-end browser verification on their
plate from the prior letter (declare a multi-rule org via Settings,
issue a membership, confirm the amber Request co-signs banner +
constrained eligible-signers picker fires) — that's their call to
make, not a carpenter task. Operator may chip-pick between Phase E2,
Phase D, the notes sweep, and the bundle hygiene sweep on session
start.

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
