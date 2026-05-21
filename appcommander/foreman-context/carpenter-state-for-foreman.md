# Carpenter state — for Foreman's eyes

**Format note:** This file is the Carpenter's testimony, written
for the Foreman's eyes (Frank, running in AppCommander). The
Foreman edge function fetches it from main on every call and
injects it into Frank's system prompt BEFORE peer-memory rules.
It's the bridge that lets Frank wake up on every call already
knowing what this project looks like right now.

The Carpenter overwrites this file at every `session_ended`.

**Operator-mode note:** AppCommander has been down today. Dual-
surface comms remains active — files plus live chat narration.

---

## WHAT-CHANGED-RECENTLY

**Operator surfaced a major design brief** — "Diary-First Wedge +
Mycelial Recovery Design," 4.5k words. Reframes the wallet's wedge
from sovereign-identity-platform to cryptographically-signed time-
anchored personal diary that gets quietly corroborated by peers
over time. Bitcoin 2010 analogy — start selfish, become substrate.

Filed verbatim into the repo at
`project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-21-diary-first-wedge.md`
with a Carpenter-response footer summarizing the in-chat engagement.
Ten idea entries appended to that project's `ideas.md` per the
LIVING-IDEAS doctrine.

**The Carpenter's chat engagement had four moves:**
1. **Reframe accepted.** Phase 2 as shipped was a setup wizard, not
   a daily-use tool. Diary-first is the right wedge.
2. **Recommended adding a `journal` attestation kind** to
   `tapit-attest` rather than reusing the existing `meta` kind.
   Cost: one line in `AttestationKind` union + one builder export.
   Reason: `meta` is the control-plane kind (revocation /
   succession / death-declaration); mixing daily content creates
   an inverse-filter smell.
3. **Technical clarification on Shamir recovery design.** The
   secret being split must be the encryption key for the cloud-
   mirrored backup blob, NOT the operator's signing keypair. Else
   M-of-N collusion = total identity capture forever. The M-of-N
   recovery-succession event is what transfers authority to the
   new keypair the operator generates on their fresh device.
4. **Two push-backs:** (a) recovery is a marketing moment but
   design it to work invisibly first; dramatizing the ceremony
   adds friction for a real user sweating a decade of receipts;
   (b) bot summarizes and prompts, NEVER signs — plain-English
   approval screen is the last line of defense.

**Phase-mapping proposal** the Carpenter named: Phase 2.5 (diary
surface — composer, journal-kind attestation, entry cards on home,
selective-recall view, mocked anchor badge) → Phase 2.75 / early
Phase 3 (port AppCommander's `ots-stamp` / `verify-ots-stamp`
protocol into `tapit-attest`'s `OtsProvider` interface to replace
the unverified npm wrapper) → Phase 3 (Nostr NIP-46 inter-app) →
Phase 5 (Mycelium peer + Shamir recovery as one). The
selfish-first reasoning: a user journaling daily by week 2 is
much more motivated to do recovery setup in week 3 than a user
who has only ever made one identity attestation.

**`CLAUDE_ROOT.md` landed on `origin/main`** via AppCommander
bootstrap commit `f61cf2d` between this session's fetch and push.
Merged cleanly (orthogonal change, no conflicts). Stale "NOT YET
PRESENT" claims in the Carpenter response footer and in the
matching ideas.md entry were corrected. The wallet repo now
carries BOTH `CLAUDE.md` (operational rulebook) AND `CLAUDE_ROOT.md`
(thesis-style orienting doctrine with non-negotiables, thesis,
four-layer architecture, doctrine map) at the root.

## Gates at session end

**Root (post-merge):**
- typecheck: clean
- lint: 0 errors, 0 warnings
- test: 16/16 (12 persona-contract + 4 manifest-registry)
- build: clean, bundle sizes unchanged (the merge brought only a
  markdown file)

**tapit-attest:** unchanged this session.

**Commits pushed this session (3 total):**
- `b78b867` — File diary-first-wedge brief + log 10 ideas
- `56c9740` — Merge of `origin/main` (bringing in `CLAUDE_ROOT.md`)
- `28fb359` — Update brief footer + ideas entry after merging

Branch and main both at `28fb359`. Working tree clean.

## WHAT'S-PENDING

1. **Operator direction on which brief proposals to greenlight.**
   The brief is explicitly "suggestions, not job orders." Carpenter
   recommendation order: (a) add `journal` kind to `tapit-attest`,
   (b) cut Phase 2.5 diary surface, (c) cut Phase 2.75 OTS port,
   (d) then Phase 3 inter-app, (e) eventually Phase 5
   Mycelium-peer + Shamir recovery as one phase after
   `MYCELIUM_NETWORK_SPEC.md` is written.
2. **Browser verification of Phases 1+2** still pending operator
   side — the magic-link round-trip, identity-attestation creation,
   settings toggle, and local-export need to be walked against a
   real Supabase project.
3. **`MYCELIUM_NETWORK_SPEC.md`** does not exist yet. Phase 5
   cannot start until that spec lands per existing doctrine. The
   brief is input to that spec.
4. **Standing follow-ups from prior sessions:** OTS fixture
   restoration (4 skipped tests in `tapit-attest`); idle-timeout
   hook (DESIGN.md §5); end-to-end integration test for the
   identity-attestation round-trip; `Tap-it-Attest-main.zip`
   cleanup at repo root.

## WHAT-TO-FLAG

The diary-first reframe is load-bearing and changes what every
subsequent phase ships toward. Frank should reset internal models
when seeing this state file — the wallet is no longer pitching
itself as a sovereign-identity-platform on day one; it is pitching
itself as a tamper-evident private diary that becomes an identity
substrate over months. Marketing copy, onboarding flow, and the
order of phases all shift accordingly.

The Shamir-encryption-key-not-signing-keypair clarification is
the most important technical detail in the brief. If Phase 5
cuts it wrong — splitting the signing keypair directly — M
coordinated peers can sign as the operator forever, which is the
exact failure mode the wallet exists to prevent. The recovery-
succession event signed by M peers is what transfers signing
authority to the new keypair generated by the operator on their
fresh device. This must be explicit in the Phase 5 brief.

The bootstrap-merge surprise (`CLAUDE_ROOT.md` landing on main
during the session) is a reminder that origin can move under the
Carpenter's feet when AppCommander is involved. Future sessions
that mention "the operator pasted X" or "AppCommander did Y"
should always fetch before reporting on repo state.

The Carpenter did substantial doctrine-compliant filing work
(brief + 10 ideas + merge) after the chat reply without explicit
operator greenlight. The reasoning was the LIVING-IDEAS doctrine
requires same-session capture. If the operator wants a more
conservative posture (engage in chat only and wait for filing
greenlight), they should say so.

## RECOMMENDED-NEXT-MOVES

1. Operator picks which proposal to greenlight next from: (a)
   add `journal` kind, (b) Phase 2.5 diary surface, (c) Phase 2.75
   OTS port, (d) Phase 3 inter-app, (e) browser-verify Phases 1+2
   first.
2. Carpenter recommendation order: a → b → c → browser-verify →
   Phase 3 (with Phase 5 holding for `MYCELIUM_NETWORK_SPEC.md`).
3. If operator wants `MYCELIUM_NETWORK_SPEC.md` drafted in
   parallel, the brief is the substrate — a Carpenter or Foreman
   session could pull the brief's sections 2, 4, 6, 7 plus the
   existing core doctrine into a real spec.

## OPERATOR'S-CURRENT-VIBE

Reflective and design-mode. The brief is a synthesis of a long
operator-plus-Claude AppCommander session, indicating the operator
spent real time in a different conversation crystallizing the
thesis and asked the wallet Carpenter to engage with it as
substrate rather than as a job order. The "chew on this and tell
me what you think" framing signals they want intellectual
engagement, not execution. The operator is comfortable letting
the Carpenter make architectural calls inside named constraints
and push back on framings the operator named (recovery as
marketing, bot role). Expect the next message to be either a
specific greenlight on one of the Carpenter's proposals or
further design refinement on a piece the operator wants to
re-think.

## Ideas ready to revisit

The 10 idea entries logged this session are all stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`:
- Diary-first wedge reframe — sprouting
- `journal` kind addition — matured (Carpenter recommendation made)
- Mycelial cascade recovery — sprouting (technical clarification flagged)
- Three-shape succession chain — sprouting
- Mycelium five-layer model — matured doctrine
- Honest AI-defenses framing — matured copy substrate
- Recovery-as-marketing with Carpenter pushback — matured
- Bot-never-signs rule — matured architectural rule for Phase 4
- No-better-plan competitive framing — matured positioning substrate
- CLAUDE_ROOT.md inheritance — matured (file now present)

Standing observations from prior sessions still hold: the "documented
TODO" decay pattern (4 SKIP_CORRUPTED_FIXTURE tests, idle-timeout
TODO, identity round-trip integration-test TODO), and the lazy-
loaded auth-vs-wallet boundary as a security pattern.

New standing observation worth naming: **origin can move under the
Carpenter during a session when AppCommander is involved.** Always
fetch before reporting on repo state for anything the operator
mentions has been touched from outside the wallet's own commit
history. Tag: doctrine-pattern.
