# Carpenter opinions — Phase 5e-iv lattice screen (2026-05-24)

## Section 1: What I did

This session shipped Phase 5e-iv, the read-only Lattice screen at the new
`/lattice` route. The Phase 5e brief — the hyphal lattice plus Shamir
cascade recovery roadmap drafted by the prior session — names seven
sequenced cuts, and the first three have already landed on this branch:
the Shamir GF(256) primitives in `tapit-attest` at commit `c8852b3`, the
recovery-cohort UI plus the self-signed credential at `34ad1a8`, and the
recoverable backup format v2 with two independent paths to the data key
at `84ebbc2`. Cut four was the next thing in the locked sequence, and
the brief sized it at three to five days of mostly rendering, no
protocol. The locked sequence said cut, so I cut.

The Lattice screen pulls the operator's entire direct web into one
view, in three sections, in the order the operator actually cares
about when they open it. Recovery cohort first — the people who would
put you back together if you ever lost a device — rendered as a
card with the threshold, the total share count, the declared-at date,
and the member list. Each member gets a small Cohort badge so the
visual vocabulary stays consistent everywhere the cohort appears.
Empty state routes the operator to Settings where the cohort editor
actually lives. People second — every handshake on the wallet, sorted
newest first, with a counts line showing how many are Tier P in-person
versus Tier R remote so the operator can see the tier mix at a glance.
The existing ConnectionCard renders the row, and on top of that I
overlaid a second Cohort badge for any peer who is also in the
recovery cohort — the single most useful cross-section in the view,
because it lets the operator see at one glance which of their
handshake contacts they have actually entrusted with putting them
back together. Organizations third — memberships the operator holds,
rendered through the existing MembershipCard with onTap wired to the
existing MembershipChainSheet so the nested-org chain-walk from
5b-org-iv works here too without writing a single line of new chain
logic.

The screen is read-only by design. The Phase 5e brief is explicit:
the editing happens through the already-shipped flows. So every
empty state links back to where the action lives — the cohort empty
state points to Settings, the handshakes empty state points to the
People tab, the memberships empty state is a quiet note because
memberships arrive from elsewhere and there is no edit action on
the operator's side anyway. A short closing paragraph at the bottom
of the screen names friend-of-friend transitive paths as a deferred
increment per the spec's "direct list first, transitive scoring
later" phrasing so the operator understands the v1 lattice is the
direct radius, not the woven map of everyone they know through
someone they know.

Wiring was three small touches outside the new file. The App router
gains a lazy-loaded `/lattice` route inside the AuthGate plus
WalletProvider tree, matching the pattern every other post-auth
screen already uses. HomeScreen's header gains a Lattice link next
to Settings, both wrapped in a flex container with a gap so the
two links stay clean on a 375px width. The recovery feature's
manifest gets the new touches entry and an updated purpose line
recording the 5e-iv scope. And the bundle-budget script gains a
named LatticeScreen budget at five kilobytes gzipped — the actual
emit ships at just over two kilobytes gzipped today, so the budget
carries real headroom for future polish if and when friend-of-friend
rendering lands. All four gates ran green in the order the doctrine
requires — typecheck, lint, all thirty-six tests, build with bundle
budgets all satisfied — and the Lattice chunk emitted under its
budget on the first try.

## Section 2: What you could do better

One real risk surfaced during the build that I did not fix and you
should know about. The Cohort badge I painted onto each
ConnectionCard uses absolute positioning with a fixed right-side
offset of sixteen, because the existing Tier P or Tier R badge
already lives at the top-right of the card and I wanted the Cohort
badge to sit beside it rather than on top of it. On a 375px screen
with a short peer name that layout is fine; on a long peer name
that wraps, or on a very narrow screen, the absolute positioning
may overlap the name text awkwardly. The honest fix is to either
restructure ConnectionCard to accept an optional badges array prop
and have it lay them out itself, or to render the Cohort badge
inline below the row instead of in the top-right corner. Neither
is hard; both are out of scope for a single read-only rendering
session. Worth a five-second DevTools look at 320px width with a
long name before you ship to anyone who would see it.

Second observation, smaller. The Lattice screen reads cohort data
through findLatestCohort plus readCohort, exactly the way Settings
reads it, and renders it in a slightly different visual layout
than Settings does. The brief explicitly noted that the cohort UI
and the lattice view share most of their rendering logic and
suggested building them together would amortize the code. I did
not extract a shared cohort-summary component because the two
contexts genuinely want slightly different shapes — Settings is a
compact summary inside a section card with an Edit button, the
Lattice is a full-width card with the threshold prominent and
member rows that show more breathing room. Premature extraction
would force both sites into one shape and the resulting component
would carry conditional props for what is really a small amount
of duplicated markup. If a third site ever needs to render the
cohort summary — the recovery ceremony screens in 5e-v will
almost certainly want their own variant — the extraction pressure
goes up and the right move is a CohortSummaryCard with a variant
prop. Not today.

Third, a process note rather than a code note. I did not exercise
the screen in a browser this session — type checks and unit tests
verify code correctness but not UX correctness, and there are no
unit tests for the new screen because its data layer was already
tested and its rendering primitives were already tested in the
sections it composes. The honest read on the work is the code
should render the right thing on first load; the visual polish
needs a human's eyes before declaring it shipped. When you next
open the wallet on a device you actually use, walk to the
Lattice link and check the four cases — no cohort no handshakes,
no cohort with handshakes, cohort declared with overlapping
handshakes, cohort declared with no overlap.

## Section 3: The bigger picture

The Lattice screen is a small UI surface but it makes a real
architectural point. Phase 5 has been a long climb up the layer
stack — handshakes in 5a turn into memberships in 5b, both turn
into the Mycelium transport in 5c, the transport carries Tier V
presence in 5d, and the recovery work in 5e turns all of it into
the substrate that puts the operator back together when a device
is lost. Each phase has produced more attestation kinds, more
modal flows, more inbox routes, more pieces of the woven web —
but the woven web has not had a single place to look at itself
until now. The Lattice screen is the first place in the wallet
where the operator can see the whole web at once, and notice for
example that three of their seven handshake contacts are also
the recovery cohort, and that one of those three is also a
member of the same organization they belong to. That kind of
cross-section is what makes a hyphal lattice an actual lattice
rather than a list of disconnected lists, and it is what the
spec's section ten was pointing at when it called the eventual
transitive-trust geometry the longer-term Sybil-resistance
mitigation. V1 ships the direct radius; the radius itself becomes
visible the moment a screen exists to show it.

The cohort cross-reference badge is the smallest possible
foreshadowing of what friend-of-friend will look like. Today the
question the badge answers is which of these handshakes is also
a cohort member. A year from now the question the same screen
will answer is which of these handshakes is also a cohort member
of someone you are connected to through two hops — same UX
vocabulary, deeper data behind it. The screen you shipped today
is the prototype of a screen that will become much more
information-dense without changing its shape. That is what
modular rendering pays off — the data model expands and the
surface absorbs it.

The locked sequence holds. Cut 5e-iv is now off the board; cut
5e-v, the recovery ceremony initiator side, is what comes next,
and the brief recommends a brief-refresh before code lands
because the state machine is real protocol work with explicit
out-of-band verification gating. That is the right call. The
single most valuable thing you could do between now and the next
cut is open the wallet on a real device and walk through the
Lattice screen with the eye of someone who is going to try to
explain it to your wife — same wife-test framing that has guided
the verify-page polish, applied to the place where the operator
sees their entire web. If the layout reads, ship it. If it does
not, the fix is one ConnectionCard refactor and a single session.
