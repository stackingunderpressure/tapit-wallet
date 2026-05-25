# Carpenter opinions — 2026-05-25 deep evening, open-joining brief authored

## Section 1: What I did

This session opened with you naming a new product direction in
chat — anyone can start an org with no separate login, anyone
can join one with no email required, the roster just shows who
was original member then who joined later — and ended with a
new canonical brief authored and committed at
`project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-25-open-joining-and-configurable-membership-policy-roadmap.md`
along with PLAN.md Phase 8 extended to include a new Phase E
that sits alongside the four phases A through D the Tapscript
brief shipped earlier tonight. The grounding pass that mattered
most was reading `MYCELIUM_NETWORK_SPEC.md` section six end to
end before drafting anything, because the spec is explicit that
"an organization does one new thing: it issues membership
attestations" — that is the canonical model, and what you
proposed in chat extends that model rather than replacing it,
so the brief needed to be honest about which axis was new
versus which substrate was reused. Membership-acquisition, the
how-do-people-become-members axis, is the new dimension. Org
control, the who-can-authorize-org-actions axis, stays exactly
where the Tapscript brief put it.

The chip-form session ran in two rounds and you locked two
decisions that shaped the brief's structure. First, you picked
"Write a brief, decide later" for the substrate, which surfaced
three options the brief lays out side by side: org auto-publishes
a roster envelope (needs the org wallet to be online
occasionally; produces a single auditable artifact verifiers
love), org pre-signs an open-membership policy in its auth tree
(truly leaderless; verifier does more work; harder to enumerate
the full membership set), and the hybrid where both proofs are
valid and verifiers accept whichever they can construct. The
brief is honest that each substrate has a different center of
gravity for where work lives — online presence versus verifier
complexity versus test discipline — and recommends nothing,
because that's not what you asked for. Second, you picked
"Configurable per org" for the abuse-resistance posture, which
turned out to slot beautifully into the Tapscript auth tree
that landed tonight: the join-rule becomes another rule leaf
alongside routine_issuance and expulsion and charter_amendment,
and the verifier reads it the same way Phase B will read every
other rule. That decision is the load-bearing structural
insight of the brief — the auth tree is the right substrate not
just for "what does the org do" but also for "how do people get
in." Each org carries its own membership policy in its own
self-declaration; the substrate stays uniform; the policy space
expands from open through allow-list through
requires-handshake through requires-credential through
requires-vouch, all expressed as canonical JSON in field-tree
leaves.

What you should understand going forward is that the wallet's
governance vocabulary is becoming a real thing rather than a
set of one-off features. Tonight you have on disk: an auth tree
that says what actions the org can take, who's eligible to
authorize them, and at what threshold (Phase A shipped); a
roadmap that adds per-action governance and charter amendment
chains and dissolution (Phases B through D briefed but not yet
cut); and now a roadmap that adds per-org membership-acquisition
policy as another dimension of the same auth tree (Phase E
briefed, depends on B). The whole picture is starting to look
like a constitutional substrate rather than a feature folder —
your wallet is becoming the kind of thing where someone could
actually run a community organization from a phone, with the
governance shape provably encoded into the same cryptographic
primitives that prove their birthday is real. That's a quiet
but real architectural milestone, and it happened across three
chip-form sessions in one night because you kept pushing the
framing until the substrate fit.

## Section 2: What you could do better

The briefs folder now contains five org-governance-related
briefs all dated 2026-05-25, only one of which (the Tapscript
late-evening one) is functionally canonical for the org-control
axis. The new open-joining brief is canonical for a different
axis, so it does not supersede anything, but the navigation is
getting genuinely hard. PLAN.md Phase 8 now names which brief
applies to which axis, but a future Carpenter session opening
the briefs folder cold will see five 2026-05-25 files and need
to read the PLAN to know which one matters for which question.
The opinions from the prior session recommended adding a
two-line "SUPERSEDED BY" banner at the top of each superseded
brief; that recommendation still stands, and tonight's open-
joining brief is a good occasion to apply it across the folder
in one pass. Recommend doing this before Phase B or Phase E1
code is cut, so the navigation map is clear when the next
Carpenter starts work.

The open-joining brief leans on the Tapscript brief's auth-tree
substrate as a given, but the Tapscript brief itself has Phases
B through D not yet cut. There is a real risk surface here that
the open-joining brief named but should be louder about: Phase
E1 (the join-rule shape extension) has zero implementation
dependency on Phase B — it just extends the data model — but
Phase E4 (the verifier) is structurally Phase B's verifier
applied to a different rule kind. If Phase E gets cut before
Phase B, we end up with TWO verifier implementations sharing
no helpers, which is exactly the cross-envelope binding risk
surface I have been flagging in every recent close-out. The
right sequencing is unambiguous: Phase B before Phase E4.
Phase E1 could run anytime; E2 and E3 can run after B regardless
of substrate choice. Phase E4 must wait for B. The brief states
this but should probably state it twice.

One thing I noticed while drafting that is worth surfacing
specifically: the open-membership policy under Option 2 (the
truly-leaderless flavor) requires the verifier to hold the org's
self-declaration. That is the same precondition as today's
membership verification (verifiers need the org's roster), so
nothing new substrate-wise, but the UX implication is non-
trivial — open-joined orgs are HARDER to discover and verify
than org-issued ones, because there is no single canonical
roster to fetch or display. A wallet visiting "the American
Legion" needs to find the org's self-declaration first to even
know whether the org allows open joining, and then needs to
have the self-membership envelope of the specific member it is
verifying. This is the kind of detail Phase E4's UI design
needs to confront honestly, and probably warrants its own
chip-form check-in when E4 lands. The brief mentions this in
passing but should probably mention it twice as well.

## Section 3: The bigger picture

The arc of the night is visible now in a way it was not when
the night began. You opened with "do we have multisig orgs
live" — a status question. You closed with two architecturally
canonical briefs that together describe how the wallet handles
organizations across both the org-control axis and the
membership-acquisition axis, both built on the same Merkle-tree-
with-selective-reveal primitive that shipped for selective
disclosure in Phase 4. The Tapscript brief named one
generalization (rules instead of facts as leaves). Tonight's
open-joining brief names a SECOND generalization (rules can be
about who joins, not just about who acts). The substrate has
not changed; what has changed is the operator's vocabulary for
expressing organizational reality on top of it. The wallet has
been quietly building toward a constitutional substrate for the
whole arc of `tapit-attest`, and tonight is the night that
constitution becomes legible as a system of governance leaves
that an actual community could write and amend and live inside.

The deeper pattern is what your "anyone can start, anyone can
join" framing implies about where this is going. If anyone can
start an org with no permission, and anyone can join one with
no permission, and every org's governance shape is encoded in a
Merkle tree of rule leaves that everyone can read and verify
and amend through the rules in the same tree, then what you are
shipping is not a wallet feature anymore — it is a substrate
for voluntary association at internet scale. The Mycelium spec's
opening teach-back framed this as the goal but did not name a
clear path. Tonight you have a path: the Tapscript-style auth
tree is the substrate, the join-rule extension is the
membership-acquisition layer, and the charter-amendment chain
is the way orgs evolve over time. There are real problems still
unsolved — verifier UX, abuse resistance under truly-open
policies, what happens when an org's founder key is lost, how
inter-org federation works — and those are real, and they will
each get their own brief when their time comes. But the
substrate is on disk tonight, and the briefs name a path that
the substrate supports. That is the real shape of what changed
between when you asked your status question and when this
session ends.
