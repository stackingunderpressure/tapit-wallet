# Carpenter opinions — theory walk + cross-Carpenter drift hook

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-23 — long no-code theory conversation that
> ended with a drift catch and a mechanical fix.

## Section 1: What I did.

This was a two-phase session, and the second phase is the more
important one even though the first phase took most of the
words. Phase A was a long no-code theory conversation across
the wallet's whole surface, which you asked for at the top with
"Read everything about our wallet and I have some questions
about implementations and just theory no code changes." I
grounded in CLAUDE.md, CLAUDE_ROOT.md, DESIGN.md, PLAN.md,
MYCELIUM_NETWORK_SPEC.md, all twelve live feature manifests,
and the tapit-attest README on this branch, and then we worked
the conversation through six progressively deeper questions: how
Nostr fits the wallet plumbing (transport not identity, your
existing Nostr account is separate from the wallet keypair by
default, same Schnorr/secp256k1 math, Phase 5c brings Tier R +
remote sync + the deferred NIP-46 and recovery-cohort slots),
what spectacular human patterns the substrate unlocks (the four
magical properties — provably-before, mutually-held, selectively-
naked, succession-continuous — combined into the application
clusters of accountable public speech via signed predictions,
the whole human life as a continuous signed thread, mutual-
consent-permanent contracts and consents, witness-converging
historical evidence, selective professional credentialing,
fraud-proof object provenance, lost-child kin recognition,
community-as-living-organism, rolling continuous attestation,
and the entire ritual cluster), is there anything else like
this in the world (PGP web-of-trust as the 35-year-old
grandparent, Keybase as the dead closest-built consumer
ancestor, W3C VC and EU eIDAS 2.0 as institutional cousin, EAS
on Ethereum as the closest live attestation primitive, Nostr
as transport substrate, DynastyTrust as the direct lineage
ancestor since tapit-attest was literally extracted from its
governance-attestation layer), is the selfish use case enough
for adoption (probably not on its own, eight strategic
recommendations recorded), what could the substrate do for food
supply chains and shipping (mapping is direct because the
Phase 2.6 custody-handoff primitive IS supply-chain handoff
mathematically, ten concrete applications walked, B2B
expansion is a real strategic question worth a deliberate
decision), and finally your wife's load-bearing adoption
question — "she sees it as trusting the wallet" — which I
answered by walking the actual VerifyProofScreen and
ShareProofModal code as it lives in the repo, giving you
concrete steps for the demonstration (share a proof, she
opens /verify in her browser outside AuthGate, pastes, sees
green, tampers one character, watches it flip to amber because
the math literally cannot lie about the leaf hash matching the
signed merkle root). You confirmed the demonstration landed.

Phase B is where this session earned its keep. When you asked
"Main?" — meaning push the comms commit to main as well as the
branch — and I tried, the push got rejected as not fast-
forward, which forced me to fetch origin/main and look at what
was actually there. What I found was that the code-Carpenter on
a parallel session had been busy: 19+ commits had landed on
main since this branch was rooted, including Phase 5c-i in
twelve sub-phases (alpha through lambda — NIP-44 v2 primitive,
Nostr wire client, wallet wire-up, inbox UI, auto-route,
send-back, send-via-Nostr for co-sign and membership,
membership auto-receive, send-via-Nostr from issue-show,
operator-editable custom relay list), Phase 5c-ii Tier R
remote handshakes, NIP-44 reference-vector interop, auto-
dismiss polish, multi-field disclosure as a library + UI
primitive, and most recently org-mode declaration plus Members
view (Phase 5b-org-i). The theory conversation we had been
having for the previous hour had operated entirely on a stale
PLAN.md — I was confidently telling you "Phase 5c-i is the
next code cut" while in fact it had been shipped twelve times
over. Specific things I told you were materially wrong-
relative-to-actual-state: my "Nostr operational doctrine before
5c ships" recommendation was moot because 5c had shipped, my
walk of the verify-page UI was against the older single-leaf
VerifyProofScreen rather than the multi-field disclosure
version on main, and my whole forward-looking strategic frame
had several timing claims that needed correction. The
GROUNDING GATE that's been firing every turn of this session
finally caught me at exactly the moment when the catch
mattered — when I was about to push stale comms to main and
overwrite the code-Carpenter's accurate handoff with my
incorrect view of the world. That catch is the gate doing its
job. The lesson was that the gate has a blind spot for cross-
Carpenter drift specifically, because CLAUDE.md and
CLAUDE_ROOT.md describe doctrine and architecture rather than
the current state of shipped phases, and reading them
faithfully (which I did) doesn't surface that origin/main has
moved. You named the fix directly and authorized the work:
"let's put some hooks both ways like we're both carpenters no
matter what... let's set up some gates to climb over them and
fix them and catch them."

So I built it. The cleanup was first: I merged origin/main
into this branch, took main's version of all five comms files
(since main's are the truth and mine were stale), then built
the gate. The gate lives at scripts/session-start-grounding.mjs
— a small Node CLI script that fetches origin quietly, computes
the merge-base of HEAD against origin/main, and emits a
structured drift report into the session's initial context if
main has moved past where the branch is rooted. It reports
three states: no drift (branch is current — "no other Carpenter
has shipped to main since this branch was rooted"), drift
detected (lists the commits, summarizes the most-recent
current.json on main, names the required reads — carpenter-
state-for-foreman.md, current.json, PLAN.md — and reminds the
session that main is the cross-Carpenter handshake point), and
unreachable (origin not fetchable, soft warning). I wired it
into .claude/settings.json as a SessionStart hook, preserving
the existing UserPromptSubmit GROUNDING GATE prose alongside it.
All four gates pass — typecheck, lint, test (31/31), build (274
modules in 3.13 seconds). The hook tested green on this branch
since it's now current with main after the merge. The drift
path is verified by code reading and by the fact that this
hook would have caught the very drift this session hit if it
had existed at session start. Mechanism over prose, per the
CLAUDE_ROOT.md doctrine — the rule that kept getting missed
is now a check that fails.

## Section 2: What you could do better.

The two-Claude-in-parallel workflow is genuinely a real
innovation and it's working — you're getting code velocity on
one stream and strategic conversation on another, simultaneously,
which is more than one Carpenter could produce serially. The
specific failure mode this session surfaced doesn't invalidate
the pattern; it just names the protocol the pattern needs to
run cleanly. The fix that's now landed (SessionStart hook fires
the drift check on every session start) covers the case where a
theory-Carpenter opens a session on a stale branch. There are
two complementary moves worth considering as future increments.
First, a PreToolUse hook on git push that re-runs the same
drift check would be belt-and-suspenders — it catches the case
where drift opens during a session that started clean, which
matters less but isn't zero. Second, the doctrine note in
CLAUDE_ROOT.md says "branch gate: no unfinished or dead branch
before new work — run by the SessionStart hook" — but no such
branch-unfinished check actually exists as a script. That's a
separate gap from this session's work and worth flagging for
the next no-code dispatch: either implement the branch-gate or
delete the doctrine claim.

On the theory side, my replies were too long. The wife-as-
skeptic question and the supply-chain question both deserved
longer answers; the human-patterns walk and the comparables
landscape could have been tighter. The one-block doctrine
constraint biases me toward exhaustiveness as a substitute for
structure, and I should watch that more carefully — the
operator listens via TTS and a paragraph that goes too long
loses the through-line. The eight strategic recommendations
remain real and at least three of them are pure writing work
that fits a future no-code dispatch cleanly: the verify-page
polish audit (which becomes load-bearing once you walk it with
your wife), the plain-English UX language audit (sweep user-
facing surfaces, drop "attestation" / "envelope" / "merkle" in
favor of human English), and the Nostr operational doctrine
rewritten as post-hoc documentation now that 5c has shipped
(documents what the code actually does rather than constrains
what it will do). The supply-chain expansion question deserves
an explicit decision rather than sitting in idea limbo — pursue,
defer, or non-goal, but name it consciously.

One more honest meta-note: I caught my own drift at the right
moment, which is the gate working, but I shouldn't have needed
to catch it at push-time. The fix going forward is that the
SessionStart hook now exists, so any future theory-session will
get the drift report in the first lines of its context and
won't accumulate an hour of confident-but-wrong-relative-to-
current-state conversation before the catch fires.

## Section 3: The bigger picture.

The doctrine in CLAUDE_ROOT.md says "Mechanism over prose. When
a rule keeps getting missed, the fix is a check that fails — not
another paragraph in this file." This session was that doctrine
working twice in one arc. The rule that kept getting missed was
"ground against actual current state on origin/main at session
start, not against the snapshot of PLAN.md sitting on the
branch you happen to be checked out on." The mechanism is now
in scripts/session-start-grounding.mjs and .claude/settings.json,
and the next Carpenter session of any kind — code-cutting,
theory, comms-only, whatever — will get the drift status
injected into its very first context. The same hook protects
both Carpenter streams: code-Carpenter learns at session start
if the theory-Carpenter has committed anything they need to
reconcile against, and theory-Carpenter learns at session start
that the code-Carpenter has been busy. Symmetric, mechanical,
load-bearing.

The deeper observation, which I want to name because it's the
real lesson of this session: the comms protocol you and Frank
have designed — current.json, carpenter-opinions.md,
carpenter-state-for-foreman.md, in-flight.jsonl, interactions.
jsonl — was DESIGNED for exactly this cross-session, cross-
Carpenter handoff case. The reason carpenter-state-for-foreman.md
exists is so any future Carpenter (same Claude continuing, a
different Claude on a different stream, or you reading on your
phone) can pick up the current state in one read. The two-Claude
pattern just makes that design assumption load-bearing rather
than ceremonial, because either Claude could be the previous
one. The hook this session built is small; the protocol it's
defending is the bigger thing, and the protocol works because
you and Frank designed it before either of us realized how
load-bearing it would become.

The whole stack you've built — tapit-attest, the wallet, the
comms protocol, the two-Carpenter workflow, the GROUNDING GATE,
and now this drift hook — is the same shape of system at every
layer: math-not-trust at the bottom (signatures, OTS anchoring,
merkle proofs), mechanism-not-prose in the middle (gates,
hooks, manifest doctrine, file-size checks), and operator-as-
commander at the top (you make the WHY calls, the Foreman shapes
the HOW, the Carpenter cuts). Every layer protects against the
failure mode of the layer above it: math protects against
platform betrayal, mechanism protects against Carpenter drift,
operator-as-commander protects against runaway autonomy. The
session that just ended is what happens when one of those
defenses fires correctly and the next defense gets added in
the same breath. Go run the wife-test, ship 5c-iii when the
field test informs it, and the mycelium grows another node
either way. The math is doing its work; the mechanism is doing
its work; the operator is in the right seat. That's the whole
game.
