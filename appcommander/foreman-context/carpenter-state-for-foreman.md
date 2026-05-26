# carpenter-state-for-foreman — Phase E4 cut 3 (full UI wiring) + two extractions

> PFOR-012 structured operational state. Written 2026-05-26 late
> evening at session close-out. One substantive commit landed on the
> dispatch branch `claude/multisig-orgs-status-jiLwm` this session
> plus this close-out flush. Branch tip pushed to main per PFOR-016
> as the final act so the Stop-hook gate clears. All four gates
> green throughout. 255 of 255 tests on session start → 255 of 255
> on session end (no test deltas — cut 3 ships UI consumers of the
> already-tested substrate; existing test coverage stays valid).

**Operator-mode note:** Human-driven session via Claude Code on the
web. Opening was the same explicit full-chunk delegation pattern
the last four sessions ran under: "Fire up and continue wherever
the other guy left off and fill up your contacts till you're done.
Find a good stopping point sounds delicious." The prior letter named
Phase E4 cut 3 as the recommended first move and explicitly
pre-wrote the chip-form question about how wide to scope the cut.
Carpenter surfaced the chip immediately per PFOR-019; operator
picked the recommended full-cut-3 option; the rest of the session
ran autonomously through commit + comms flush + push to main.

## WHAT-CHANGED-RECENTLY

One substantive commit on the dispatch branch plus this close-out
flush.

**`d0ebc55`** — Phase 8 Phase E4 cut 3 — open-joining UI wiring
(full cut). Eleven files changed: four new files plus seven
modifications. The four new files: `src/features/settings/JoinPolicy
Picker.tsx` (lazy-loaded sibling to OrgRulesEditor with six policy-
kind sub-forms), `src/features/settings/OrgDeclarationSection.tsx`
(extracted from SettingsScreen to keep it under the 800-line hard
limit; encapsulates the full org-creation form state machine),
`src/features/connections/JoinOrgModal.tsx` (the novel any-wallet
join-an-org modal with paste-or-scan org input, plain-language
policy renderer, proof-picker step, sign + share flow), and
`src/features/wallet-core/useOpenMemberRosterControls.ts` (extracted
from HomeScreen to keep it under the 800-line hard limit;
encapsulates the joined-members + pending-delta + publishing flag
+ publish callback). The seven modifications: `SettingsScreen.tsx`
strips the org-creation form down to a one-line OrgDeclarationSection
reference (823→656 lines), `HomeScreen.tsx` swaps the inline useMemos
for the new hook and adds a "+ Join an org" button alongside
"+ Membership" plus the JoinOrgModal mount point (824→797 lines),
`OrgIdentitySections.tsx` gains a Joined-members section plus
publish-roster button with amber pending-delta chip, `scripts/bundle-
budget.mjs` adds three new explicit budgets (JoinPolicyPicker 3KB,
JoinOrgModal 6KB, openMemberRoster helpers 2.5KB) and bumps three
existing budgets (HomeScreen 18.5→19.5KB, SettingsScreen 10.5→11KB,
CSS 7.5→8KB), and the three feature manifests (settings, connections,
wallet-core) update touches lists and add paragraph-length cut 3
narrative to the connections manifest notes.

Cut 3 is purely UI wiring on top of the substrate cuts 1 and 2
landed. No on-wire envelope shape changed. No new tests landed
because no new pure-function logic shipped — the UI components are
consumers of evaluateJoinPolicy + verifyOpenJoinedMembership +
buildSelfMembershipDraft + publishOpenMemberRoster + acceptedSelf
Memberships + pendingSelfMemberships, all of which have full test
coverage from prior sessions.

## WHAT'S-PENDING

Nothing in-flight. Working tree clean post-commit. Dispatch branch
carries the cut 3 commit plus this close-out flush; the branch tip
is being pushed to main per PFOR-016 (`git push origin
<branch>:main`) as the final act of close-out so the Stop-hook gate
clears and the next SessionStart hook reads a fresh letter from
origin/main. Branch and main will be at the same SHA after the
push. Phase E arc is closed end to end — substrate (cuts 1+2) and
UI (cut 3) both shipped.

## WHAT-TO-FLAG

Two file-size soft-warn flags now visible in test output. JoinOrg
Modal lands at 580 lines (over the 400-line soft-warn but well under
the 800-line hard limit). HomeScreen sits at 797 lines, three lines
under the hard limit — any further addition there will trigger the
hard error and require another extraction. RecoveryInitiatorModal
remains at 800 lines flat, also at the hard limit.

The vouch policy path in JoinOrgModal is structurally incomplete —
the modal builds a joiner-signed envelope and surfaces a plain-prose
notice that cosignatures from existing members must be collected
before submitting to the org, but does not orchestrate that
collection itself. The existing CosignRequestModal in
`src/features/cosigning/` handles fanout for org-action issuance
under threshold-greater-than-one rules; an org-context-shaped
invocation pattern extending it to vouch collection (where the
eligible set is "any pubkey already known to the org as a member"
rather than a named eligible list) is the next natural cut. Worth a
chip-form decision before code starts because the from-any-member-
of-the-known-set picker is a structurally different shape from the
from-this-named-eligible-list picker.

The `describePolicy` plain-language renderer plus the proof-candidate
filter helpers (`findHandshakeProofCandidates`, `findCredentialProof
Candidates`) are inlined into JoinOrgModal as local functions. A
future verifier-side UI or a Foreman briefing UI would want the same
helpers — one-file extraction when the second consumer lands. Parked
until then.

The 800-line file-size flag mentioned in the prior letter's land-mine
section for HomeScreen + SettingsScreen + WalletProvider + Settings
Screen-equivalent files still applies. HomeScreen is now three lines
under the hard limit after this session's extraction; SettingsScreen
has 144 lines of headroom; the rest carry varying margins. The next
substantial addition to HomeScreen will need to extract before
landing, not after.

The connections manifest `notes` field is now approximately 20
kilobytes of unbroken text covering twelve phases of work — up from
17 at session start. The same markdown-sub-section refactor question
the prior letter named is still pending: do you want the manifest
notes to evolve into markdown sub-sections for legibility, or stay
as flowing prose for TTS, given that the connections manifest is now
roughly the size of a small README? Worth a chip-form question some
session.

publishOfficialsRoster + publishOpenMemberRoster + receiveSelfMembership
+ now publishOpenMemberRoster called through the new hook all hit
anchorQueue.upsert which uses IndexedDB which jsdom does not back.
Tests exercise the pure builders + signed wallet.hold directly so
the same envelope shape the production path emits is verified, but
the full publish-pipeline storage round-trip is not exercised. Same
uncertainty surface carried forward; not blocking. fake-indexeddb or
a polyfill would close this if a future test refactor wants storage
assertions on the publish paths.

## RECOMMENDED-NEXT-MOVES

Three good first-move options, ranked by leverage:

1. **Phase D charter-amendment chain** — `walkCharterChain` +
   `findActiveCharter` + a dissolution endpoint. Continues the org-
   control axis in parallel with the membership-acquisition axis Phase
   E just closed. Does not depend on Phase E substrate. Similar level
   of work to cut 1 of Phase E (one new module under
   `src/features/connections/` or `src/features/governance/` plus
   tests plus a small UI surface to expose the charter chain on the
   Identity tab). Brief estimate: 1-2 sessions.

2. **JoinOrgModal vouch-cosignature collection sub-flow** — the
   missing piece flagged above. Lets a joiner under a `requires_vouch`
   policy actually orchestrate gathering the required cosignatures
   from existing org members before submitting to the org. Probably
   reuses the existing CosignRequestModal in `cosigning/` with an
   org-vouch-context variant alongside the existing org-action-
   context variant. Chip-worthy because it changes the eligible-
   signers picker shape (from-any-member-of-known-set instead of
   from-named-eligible-list).

3. **`receiveSelfMembership` orgSelfDecl-lookup centralization** —
   the consistency question the prior letter named as worth pinning
   before cut 3 introduced a second caller path. Cut 3's JoinOrgModal
   does NOT call `receiveSelfMembership` (it builds + sends; the org-
   side `HomeScreen.acceptSelfMembership` is the only caller), so the
   chip is still deferrable. Worth a chip-form decision the next
   session a second receiver path is about to land: centralize the
   lookup inside `receiveSelfMembership` (take wallet + holdings,
   derive declaration via `findOwnOrgDeclaration` internally), or
   keep the caller-side pattern uniform with the rest of the create-
   attestation function family.

Alternative housekeeping if none of the substantive cuts appeal: the
manifest-notes markdown-sub-section refactor (chip-worthy because it
revises a TTS-listenable doctrine), the `describePolicy` + proof-
candidate-filter extraction (parked until second consumer; could be
done now if extraction-discipline maintenance is the appeal), or
component tests for the new modals (would require pulling testing-
library/react into the toolchain — chip-worthy because it adds a
dependency).

## OPERATOR'S-CURRENT-VIBE

Same delegate-and-verify mode the last four sessions ran under.
Opening prompt was explicit about wanting maximum productive use of
the context window with a satisfying stopping point. Prior letter
named the substantive first move (Phase E4 cut 3) AND named the
chip-form question worth asking up front (cut 3 scope); carpenter
surfaced the chip immediately on session-start per PFOR-019; operator
picked the recommended full-cut-3 option in one round-trip; cut 3
then proceeded autonomously through commit + comms flush + push.
No mid-session operator interventions, no redirections, no further
chip-form questions beyond the opening one. One substantive commit
this session (versus three last session) but cut 3 is structurally
larger and tighter — four new files plus seven modifications across
three features, the on-wire shape unchanged, the four gates clean,
all in one cohesive cut. The carpenter-to-carpenter chip-form-question
loop the prior letter named as a pattern worth surfacing has now
worked TWO sessions in a row exactly as designed; that pattern is
real and is worth naming as a documented carpenter doctrine when the
operator next touches the standing orders.

## Ideas ready to revisit

No new operator-surfaced ideas this session — the conversation was
purely directional (the cut 3 scope chip) plus the closing
"satisfying stopping point" prompt. The prior letter's named ideas
all still apply: the manifest-notes markdown-sub-section question is
still pending a chip, the receiveSelfMembership lookup-centralization
question is still pending the second-caller trigger, the authRule.ts
430-line trim has no obvious clean extraction point yet.
