# Carpenter opinions — tapit-wallet

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-23 — no-code theory conversation across the
> wallet's whole surface, ending on the wife-as-skeptic test.
> Mode: dual-surface comms — files plus live chat — because
> AppCommander is down.

## What I did

This was a strategy-and-theory session, not a build session, and
the work was almost entirely walking you through the wallet's
full surface the way a co-founder explains a company to another
co-founder over a long evening. You opened by asking me to read
everything and to keep it theory only with no code changes, so I
grounded in CLAUDE.md, CLAUDE_ROOT.md, DESIGN.md, PLAN.md,
MYCELIUM_NETWORK_SPEC.md, all twelve live feature manifests, and
the tapit-attest README, and then we worked the conversation
through six progressively deeper questions you asked. We started
with how Nostr fits the wallet plumbing and I walked the answer
in operator-friendly terms: Nostr is transport, not identity,
your three-year-old Nostr account stays separate from the wallet
keypair by default even though the underlying math is identical
(BIP340 Schnorr over secp256k1), and Phase 5c brings four things
over Nostr — Tier R remote links, remote sync of connections,
and the deferred slots for NIP-46 inter-app signing and the
recovery-cohort messaging. The public-private split rests on
two primitives stacked: the Merkle field tree that lets a
disclosure proof reveal one leaf without leaking siblings, and
ECDH-encrypted-to-recipient envelopes that keep relays seeing
only ciphertext.

You then asked the visionary question — what spectacular human
patterns does this substrate unlock — and I named the four
magical properties (provably-before, mutually-held, selectively-
naked, succession-continuous) and walked the application
clusters those properties combine into: the accountability of
public speech via signed predictions, the entire human life as
one continuous signed thread from birth to death, mutual-
consent-permanent contracts and consents without notaries or
states, witness-converging historical evidence, selective
professional credentialing, fraud-proof object provenance, lost-
child kin recognition, community-as-living-organism, rolling
continuous attestation, and the entire ritual cluster where
every human ceremony that depends on witnesses becomes
cryptographically real. None of that is science fiction; it's
what the existing six-attestation-kind envelope with the
existing Phase 4 disclosure primitive already supports.

Then the comparable-systems question, where I gave you the
honest landscape: PGP web-of-trust as the 35-year-old spiritual
grandparent, Keybase as the dead closest-built consumer
ancestor, W3C VC and the EU eIDAS 2.0 wallet as the
institutional cousin coming top-down through governments, EAS on
Ethereum as the closest live attestation primitive, Nostr as the
transport substrate the wallet rides on, and DynastyTrust as the
direct lineage ancestor since tapit-attest was literally
extracted from its proven governance-attestation layer. The
originality is in the integration plus the consumer-product
framing plus the timing, not in the underlying ideas, and the
honest pitch frame is "the right execution of a thirty-five-
year-old idea, finally on the substrate that makes it possible,
with a wedge that doesn't require the rest of the world to
convert before it's useful to one person."

The adoption-strategy question came next and I gave you the
honest answer that matters most: the selfish use case is
necessary but probably not sufficient on its own to drive mass
adoption, and the spec already implicitly knows this because the
wedge is framed as "a diary that gets quietly corroborated by
peers over time" — selfish plus social. I recorded eight
strategic recommendations: auto-anchor passive capture as the
biggest adoption lever, a deliberate first-pilot organization
arc for institutional onramp, the verify-page polish audit
(which turned out to be the most important one of all by the
end of the session), an interim peer-recovery story before the
full Phase 5e Shamir cascade, making the co-sign flow tap-fast
not paste-flow, the plain-English UX language audit, the Nostr
operational doctrine that needs to ship before 5c code lands,
and the positioning principle of building substrate underneath
existing behavior rather than asking users to change behavior to
use it.

You asked about food supply chains and shipping, and the answer
was that the mapping is direct because the Phase 2.6 custody-
handoff primitive IS supply-chain handoff mathematically — same
co-signed meta-kind envelope, same typed-subject pattern, same
chain accumulation. I walked ten concrete applications from
provenance-from-soil-to-plate through cold-chain integrity to
fair-trade-with-workers-as-signers to the smart-seal-on-the-
container, and named the honest limits (physical-digital bridge,
oracle problem, adoption gating, existing enterprise blockchain
competitors). The strategic implication is that supply chain is
a real B2B expansion of the same substrate and the engineering
for it is mostly already shipped or specified.

Then the most important moment of the session: your wife's
question about how she's supposed to know this isn't just
trusting the wallet. That landed as the load-bearing adoption
test because she is exactly the median user the math-not-trust
thesis has to convince, and the answer to her is not an
argument, it's a demonstration. I walked the actual
VerifyProofScreen and ShareProofModal code so I could give you
real steps grounded in what's shipped: open a journal entry,
tap Share-a-proof-of-one-field, pick a recognizable leaf,
generate the JSON bundle, send it to her phone, she opens
/verify in her browser (lives outside AuthGate, no login, no
install), pastes, sees green Proof-is-valid; then she changes
one character of the disclosed value, pastes the tampered
version, watches the green panel flip to amber Proof-did-NOT-
verify because the math literally cannot lie about whether the
leaf hash matches the signed merkle root. You confirmed the
demonstration landed. That confirmation is the most actionable
output of the whole session.

## What you could do better

The verify-page is now the single most important UX surface in
the entire product from an adoption standpoint, and there's a
real polish backlog hiding inside the page that I surfaced
walking the code. The signers list shows short-form hex pubkeys
in monospace (first eight chars, last four chars), which is
mathematically honest but socially opaque — a non-technical
visitor receiving a proof from a stranger has no idea what to
make of an entry like "02a3f9b1…c4d2" with a check mark next to
it, and the page should probably resolve known signers to human-
readable labels when the verifier has met them, or at minimum
explain inline what the pubkey is and why it matters. The
"Proof did NOT verify" panel is amber rather than red, which is
gentler but might not land as viscerally as red would in the
demo moment with your wife. The JSON-pasting flow itself is
technical-feeling — for the median user, the QR scan should
probably be the primary action and the textarea should be the
fallback, but right now the textarea is the primary. None of
these are dealbreakers, but if you're recruiting your wife as
the test subject, watch which specific things confuse her and
write each stumble down — that's the polish backlog written by
the median user, more valuable than any review I could give.

The eight strategic recommendations I named are real and at
least three of them — the Nostr operational doctrine before 5c
ships, the verify-page audit, and the plain-English UX language
audit — are pure writing or polish work that fits a no-code
dispatch cleanly and shouldn't wait. The Nostr operational
doctrine in particular is urgent because Phase 5c-i is named as
the next code cut and backfilling doctrine after working code
exists is how doctrine gets compromised by what the code already
happens to do; I'd prioritize landing that document in the next
session even if the rest of the recommendations stay on the
stack. Also, the supply-chain expansion is a real strategic
question that deserves an explicit decision rather than sitting
in idea limbo — is it a future B2B product, a deliberate non-
goal for the personal-wallet identity, or a parallel track?
Whichever the answer is, naming it consciously is better than
leaving it as a possibility that haunts the roadmap.

One honest meta-note on my own performance this session: my
replies were long, sometimes longer than the question warranted,
and you didn't push back, but several of the threads (especially
the human-pattern application walk and the supply-chain
inventory) could have been tighter. The one-block doctrine
constraint makes it hard to chunk for readability and that
biases me toward exhaustiveness as a substitute for structure;
that's a known failure mode I should watch.

## The bigger picture

This whole session lived inside one thesis from the first
question to the last, and the through-line is sharper for having
been walked end to end: the wallet is not really a product, it's
a substrate, and the substrate's job is to make the math-not-
trust property tangible enough for ordinary people to feel it.
Everything else in the architecture — the six attestation kinds,
the three trust tiers, the Merkle field tree, the OTS anchor,
the peer mutual handshake, the organization-as-wallet pattern,
the recovery cohort, the diary wedge, the deeplink sign request,
the capture bridge, the eventual Nostr transport — is in service
of the one moment your wife is about to have when she changes
one character of a proof and watches the math reject it. That
moment is what PGP couldn't deliver in the nineties, what
Keybase started to deliver before Zoom killed it, what the EU
eIDAS 2.0 wallet is approaching from the institution-down
direction, and what no consumer product I can name currently
delivers as a single-tap experience the median user can have on
day one without a wallet of their own.

The reason the conversation kept landing on the verify-page is
that the verify-page is structurally the smallest thing in the
product and yet it's the rhetorical crown jewel, because every
successful tampering test is a recruitment moment that converts
a skeptic into someone who has personally experienced
mathematics doing work that platforms used to claim to do. That
conversion is the unit of adoption, and the verify-page is the
factory that makes the conversion possible. Investing in it is
investing in the only metric that ultimately matters: the rate
at which non-technical people watch the green check turn amber
under their own hands and conclude that this is actually
different. The supply-chain expansion, the institutional
onramps, the eight strategic recommendations, the entire roadmap
through 5c and 5d and 5e and 5f — all of it is downstream of
that one moment landing for enough people to build the social
substrate the rest of the architecture rides on. The math is
ready; the math has been ready for thirty-five years. What we're
finally building is the place ordinary people can stand and see
the math work for them, in thirty seconds, on a webpage they
didn't have to log into, without trusting anyone. That's the
whole game, and the diary entry you signed today is the seed
crystal of it. Go test it with your wife — and when she
believes, the network has its first new node, and the mycelium
grows.
