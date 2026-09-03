# Tapit Wallet — ideas

```
Date: 2026-05-18
Section: ideas
Entry: Hardware-wallet signing — the air-gapped QR path. The
user's Bitcoin hardware wallet becomes the wallet's signer: scan
a QR sign-request, confirm on the air-gapped device, scan the
response back. The key never touches an internet-connected
device.
Context: tapit-attest already uses BIP340 Schnorr over secp256k1
specifically to keep this path open. Connects to the
sovereign-credentials / tapit-signer-bridge thread in
AppCommander's ideas.md. Stage: raw.
Feature: wallet-core
```

```
Date: 2026-05-18
Section: ideas
Entry: Cloud-synced encrypted backup as the paid tier;
local-only backup stays free forever.
Context: backup-recovery is flagged monetizable: true. The host
only ever holds ciphertext, so charging for sync is charging for
convenience, not for access to the user's own data. Stage: raw.
Feature: backup-recovery
```

```
Date: 2026-05-18
Section: ideas
Entry: The wallet bot teaches the user their own attestation
history back — "here is what your wallet says about you, and who
vouched for it" — turning a holdings list into a narrative.
Context: An application of the fleet's teach-back pattern to the
wallet itself. Stage: raw.
Feature: wallet-bot
```

```
Date: 2026-05-18
Section: ideas
Entry: OpenTimestamps attestation anchoring (P1 in DISCOVERY.md).
Stamp held attestations into Bitcoin via OpenTimestamps and show
pending → confirmed (with block height) status, so an attestation
is tamper-evident in time and not only signature-valid.
Context: tapit-attest's current OpenTimestampsProvider wraps the
unverified `opentimestamps` npm package; the build should instead
add a provider behind the existing OtsProvider interface that
ports AppCommander's proven, dependency-free ots-stamp /
verify-ots-stamp protocol. See DISCOVERY.md "Honest notes".
Stage: sprouting.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Diary-first wedge reframe. The wallet's day-one product is a
cryptographically signed time-anchored personal diary — selfish use
case that does not require any network. Mycorrhizal partnerships
and the social layer accrue over weeks/months/years as a byproduct
of sustained use, not as preconditions. Bitcoin 2010 template: tip
forum users first, overthrow fiat later.
Context: Operator + AppCommander session brief, 2026-05-21. Source
of truth: project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-21-diary-first-wedge.md
sections 1, 6, 9, 10, 14. Maps onto a proposed Phase 2.5: composer +
journal-kind attestation + entry cards on home + selective recall +
mocked anchor badge. Stage: sprouting — load-bearing reframe waiting
on Carpenter cutting decision.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Add a `journal` attestation kind to tapit-attest for daily
diary content, distinct from the existing `meta` kind which is
control-plane only (revocation / succession / death-declaration).
Cost: one line in src/types.ts AttestationKind union + one builder
export in src/core/builders.ts. Carpenter recommendation: do it,
the inverse-filter smell of "show me my meta minus the non-diary
events" is the signal of a missed type.
Context: Open question 1 from the 2026-05-21 diary-first brief.
Carpenter leans add-the-kind. Stage: matured — recommendation made,
awaiting operator decision.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Mycelial cascade recovery via Shamir Secret Sharing (SLIP-0039)
with no pre-stashed key — the operator's own sharpening. M-of-N
initiation by peers who verify the operator's face in person/video,
then every subscribed peer's wallet auto-encrypts its Shamir share
to the new keypair and pushes to recovery relays. Reassembly +
recovery-succession event signed by M peers makes the new key
authoritative going forward.
Context: Brief section 7. Technical clarification flagged by
Carpenter: the Shamir split must be over an encryption key for the
cloud-mirrored backup blob, NOT over the signing keypair, so M-of-N
collusion does not equal total identity capture. Stage: sprouting
— design is sharp; awaits MYCELIUM_NETWORK_SPEC + Phase 5
implementation.
Feature: backup-recovery
```

```
Date: 2026-05-21
Section: ideas
Entry: Three-shape succession chain — self-signed (planned
rotation), dual-signed (transitional window), peer-witnessed
recovery (M peers collectively sign that new key represents the
same identity after a loss event). All three resolve to "the
public key currently representing this identity."
Context: Brief section 7. The peer-witnessed shape is what makes
the cascade recovery design valid. Stage: sprouting — needs
implementation in tapit-attest's succession module for Phase 5.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Mycelium five-layer identity model — taproot (keypair),
mycorrhizal partnerships (peers), hyphal lattice (transitive trust),
anchoring rings (OTS receipts), forest consensus (years-deep soft
agreement). The wallet works at layer 1 alone on day one, accrues
layers as users add peers and entries.
Context: Brief section 2. Frame is useful for naming what each
phase delivers. Stage: matured — substrate doctrine.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Honest AI-defenses framing — the architecture closes forged
signatures, backdated forgeries, forged credentials, reputation
forgery by fresh keypairs, and post-theft impersonation. It does
NOT close unverified channels (largest residual gap), the cold-start
gap, sybil resistance, AI content inside real attestations,
coercion, key theft from compromised devices, or truth itself. User
framing: "this wallet does not stop AI from generating content in
your name. It gives the rest of the world a way to tell the
difference when they decide they want to know."
Context: Brief section 4. Stage: matured — copy substrate for
marketing + onboarding language.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Recovery as marketing moment — every recovery event is
implicit evidence to the M signing peers that running a wallet was
worth it. Network-effect surface. Carpenter pushback: design
recovery to work invisibly first and look inspiring second.
Dramatizing the ceremony adds friction for a real user sweating
about a decade of receipts. Marketing benefit is downstream of the
experience working, never upstream of it.
Context: Brief section 7 + Carpenter response. Stage: matured —
adopt the insight, hold the discipline.
Feature: backup-recovery
```

```
Date: 2026-05-21
Section: ideas
Entry: Bot's role is summarize-and-prompt, NEVER sign. The plain-
English approval screen is the last line of defense if the bot is
compromised or hallucinates. Phase 4 carpenter must hold this line
even when the bot's UX would feel smoother if it could sign on
behalf.
Context: Brief section 6 + Carpenter pushback. Stage: matured —
hard architectural rule for Phase 4.
Feature: wallet-bot
```

```
Date: 2026-05-21
Section: ideas
Entry: The "no better plan" rhetorical move — does anyone have a
better plan that preserves the first principle (you own your
identity, no platform)? Apple/Google hardware attestation, Worldcoin,
gov ID, W3C VCs, Sovrin/uPort, Bluesky AT Protocol, hardware
wallets — each does sub-problems better, each costs the first
principle. The architecture is choosing correctly on the
meta-problem and accepting being weaker on sub-problems that can
be ameliorated inside the architecture over years.
Context: Brief section 5. Stage: matured — copy substrate for
positioning + competitive conversations.
Feature: doctrine
```

```
Date: 2026-05-21
Section: ideas
Entry: CLAUDE_ROOT.md inheritance — the wallet now carries BOTH the
operational CLAUDE.md (Carpenter rulebook) AND CLAUDE_ROOT.md
(thesis-style orienting doctrine — non-negotiables, thesis, four
layers, doctrine map). CLAUDE_ROOT.md landed via AppCommander
bootstrap commit f61cf2d on 2026-05-21 and was merged into the
wallet branch by the Carpenter while filing this brief.
Context: Brief section 12 question 7. Stage: matured — file
present, doctrine map in place, no open action.
Feature: doctrine
```

```
Date: 2026-05-21
Section: ideas
Entry: Grandchild-from-birth documentation scenario — the strongest
concrete first-cut use case the operator has named for the diary
wedge. On the day the operator's grandchild is born, the operator
writes a signed diary entry naming the birth, attaches a photo of
the newborn, OpenTimestamps-anchors against a Bitcoin block so the
timestamp is provable a decade from now, and family members
co-sign as witnesses. Then the operator keeps doing it as the
child grows. Every other v1 scenario composes from the same
primitives.
Context: Operator message 2026-05-21 evening. This becomes the
proof-target scenario for Phase 2.5. Grandchild's own keypair is
deferred to Phase 6 (family-mode custody) — Phase 2.5 records
attestations ABOUT the grandchild without a child wallet existing.
Stage: matured — drives the Phase 2.5 scoping.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Life-layer tabs as user-facing categorization — categories
like Diary, Family, Medical, Marriage, Witness are USER-FACING
filters over a category field that lives as a leaf inside each
attestation's Merkle field tree. Orthogonal to the protocol-level
AttestationKind taxonomy. Carpenter recommendation: hybrid schema
— ship suggested categories as defaults plus free-form typing
that auto-creates a tab.
Context: Operator's "tabs for different layers of life" framing.
A user's category choice is signed into the attestation (so it is
tamper-evident) but the kind taxonomy stays small and protocol-
level. Stage: sprouting — needs UX iteration once Phase 2.5
ships.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Court-grade witness alibi scenario — multiple family
members or peers each sign a "Tom was at location X from time T1
to time T2" attestation, the attestation is OpenTimestamps-anchored
against a Bitcoin block, and the multi-signature plus pre-event
timestamp gives admissible evidence in court a year later if Tom
is accused of being elsewhere. Each signature can be independently
verified against the witness's pubkey; the OTS anchor prevents
after-the-fact forgery; witnesses can be subpoenaed for testimony.
This is the strongest "math, not trust" demonstration the
architecture can produce.
Context: Operator explicitly named this as a v1 use case. Maps to
Phase 2.6 (family witness co-signing in person via QR). The
architecture supports it natively — multi-sig envelopes with
quorum-of-good verification + OTS anchoring + the Merkle field
tree are all already in tapit-attest.
Stage: matured — proof-target scenario for Phase 2.6.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Family-bootstrap network — instead of starting with a
Nostr-mediated peer-discovery layer, the wallet's first network
is the operator's family co-signing in person via QR exchange.
Nostr NIP-46 (Phase 3) becomes the remote/asynchronous version of
the same flow. Carpenter recommendation: Phase 2.6 does the
in-person co-sign without any networking; Phase 3 layers Nostr
on top of the same primitives.
Context: Operator described the network growing from family
outward — "my family will be starting it and then from there on
out it'll just be do you wanna do it." Maps to Phase 2.6.
Stage: matured — drives the Phase 2.6 scoping.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Photos + documents in v1 — media attachments to attestations
using the hash-on-chain bytes-in-encrypted-storage pattern. Photo
or document hash becomes a leaf in the attestation's field tree
(so it is signed and tamper-evident); bytes encrypted client-side
via tapit-attest's encrypt() and stored in a new Supabase Storage
bucket (wallet_media) RLS-scoped to the owner. Operator can flip
cloud media OFF as a settings toggle parallel to wallet_blobs
cloud-sync.
Context: Operator named photos and documents as v1. Maps to Phase
2.5 (photos) and Phase 2.7 (documents). Same code path, just
different MIME types.
Stage: sprouting — design clear, needs implementation in Phase 2.5
and Phase 2.7.
Feature: storage
```

```
Date: 2026-05-21
Section: ideas
Entry: OpenTimestamps port pulled forward into Phase 2.5. Operator
named OTS anchoring explicitly as part of the diary value prop.
The wallet's current OtsProvider wraps the unverified opentimestamps
npm package; porting AppCommander's ots-stamp / verify-ots-stamp
edge-function protocol into tapit-attest's OtsProvider interface
closes the unverified dependency surface AND delivers real
anchoring shipping in the same session as the diary surface.
Context: Operator message 2026-05-21 evening + brief section 8.
Was previously scoped as a separate Phase 2.75 but pulls forward.
Stage: matured — Carpenter recommendation: do it in Phase 2.5.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Signing is the commit; verification is async metadata.
Operator's reframe on the OTS lifecycle: the entry is committed
the moment it is signed (the user's act of recording is complete
on that gesture), and OpenTimestamps anchoring is metadata that
arrives later — usually within an hour, sometimes after days of
calendar retry. The UI must never present an entry as "waiting"
or "pending" or "failed"; only the verification badge varies,
between "Time-verifying…" (anything in progress, muted neutral
tone, never alarming) and "Time-verified · block NNN" (once
Bitcoin confirms). The state machine in the queue stays granular
(queued/pending/failed/confirmed) because the worker needs it for
retry logic; only the rendering collapses.
Context: Operator message 2026-05-21 — "There's no sense in it
being directly having to be tied to it and you're waiting on it.
It's more like it will be verified. It just takes time. It's
already committed." Doctrine pattern for the wallet — applies to
any future async-confirm lifecycle (Nostr ack, Shamir share
collection, peer recovery). Stage: matured — implemented in
commit 6cee87b across JournalCard, JournalDetail, JournalComposer.
Feature: doctrine
```

```
Date: 2026-05-22
Section: ideas
Entry: The capture bridge — timestamp anything in daily digital
life from where you already are. A Share Sheet target (iOS), a
share-intent target (Android), a Web Share Target manifest entry
(PWA-native, strong on Android), and/or a browser extension, so
that from inside Facebook, Photos, Safari, Notes — any app — the
user hits Share → Tapit Wallet and the content + URL + an
optional screenshot become a signed, OTS-anchored attestation in
one tap. This is the everyday on-ramp the Phase 3 deeplink bridge
does NOT cover: Phase 3 is an app pulling the user to the wallet;
the capture bridge is content pushed to the wallet from the app
the user is already in. The bridge principle: easy-to-walk means
it starts where the person already is.
Context: Operator 2026-05-22 — "can we verify timestamp a
Facebook post ... how do we put those bridges there so they're
just as easy to walk across." Tradeoff: a native Share Sheet
extension steps past the pure-PWA boundary the project has held;
the Web Share Target API is the PWA-pure partial path (good on
Android, limited on iOS), recommended as the first cut. Stage:
raw — strongest near-term interop move once v1 ships.
Feature: sign-request
```

```
Date: 2026-05-22
Section: ideas
Entry: Web-proof authenticity layer — turning witness-grade into
platform-attested. Today a timestamped capture of a Facebook post
proves "[your key] recorded that this content existed at Bitcoin
block N and you witnessed it" — strong against deletion,
backdating, and "you never said that" for the user's OWN speech;
weak as proof that the platform truly served it or that someone
ELSE said it. zkTLS / TLSNotary / Reclaim-Protocol-style web
proofs cryptographically attest that an HTTPS response genuinely
came from a named domain, which would upgrade a capture from
witness-grade to platform-attested.
Context: Operator 2026-05-22. Consistent with the existing
honest-AI-defenses idea — the wallet gives the world a way to
tell the difference, it does not stop fabrication. Stage: raw —
research-grade, long horizon, not v1 or v2.
Feature: sign-request
```

```
Date: 2026-05-22
Section: ideas
Entry: The "situations" layer — purpose-shaped presentation
modes, distinct from the holding-tabs. Tabs (Journal / Identity
/ People / Captured) organize what the wallet HOLDS; situations
organize how you USE it in the world — a "Show a doctor", "Show
an officer", "Apply for X" mode that shapes which attestations
surface and exactly what is disclosed. Built on Phase 4
selective disclosure: a situation IS a disclosure preset.
CRITICAL: situations are user-invoked, never auto-detected — a
sovereign wallet that geolocates you to know you are at a
hospital is surveillance and betrays the thesis. The user
declares the situation.
Context: Operator 2026-05-22 — "each tab smart about how it
interacts with the world ... hospital ... police station ...
grouped by how/where/why you would use it." Stage: raw — design
refinement layered on the Phase 4.5 tabbed home.
Feature: wallet-core
```

```
Date: 2026-05-22
Section: ideas
Entry: The wallet as a sovereign encrypted vault for important
documents — medical, legal, identity papers. Already possible
with existing primitives: a document is an encrypted attachment
on an attestation, its hash is signed into the Merkle tree
(tamper-evident), bytes encrypted client-side, recoverable via
the encrypted backup; the Medical life-layer tab already exists.
Framing must be precise: the wallet holds your sovereign COPY
with proof of integrity and timestamp — it is NOT the hospital's
canonical system of record. The "host sees only ciphertext"
property is also the regulatory shield (encrypted backup tool,
not a health-data processor). Caution: large medical files
(imaging) scale storage cost and encryption cycles — a real
follow-up if this grows past document-sized attachments.
Context: Operator 2026-05-22 — "are our medical records actually
in the wallet ... the place we can always recover them." Stage:
raw — candidate for a Vault / Records surface.
Feature: storage
```

```
Date: 2026-05-22
Section: ideas
Entry: Donna (the operator's existing AI assistant) and any
agent connect to the wallet across the Layer 2 bridge already
built in Phase 3 — never rebuilt inside the wallet. An agent
prepares, presents, navigates, negotiates, and constructs
SignRequests; but the hard rule holds (existing idea 2026-05-21)
— the bot NEVER signs; every signature passes through the human
at the plain-English approval screen. True "sign on your behalf"
autonomy would require a deliberate scoped delegation — a
capability attestation, "agent may sign kind X up to limit Y for
time Z", the wallet staying root authority — a future Phase 6+
design, not v1. A bot is an amplifier, never a crutch for a
confusing UI: the Prime Directive says a wallet a non-technical
person cannot use does not exist.
Context: Operator 2026-05-22 — "is Donna just gonna plug into
that ... reach into this app and sign your attestations and
negotiate the world on your behalf." Stage: raw.
Feature: app-connections
```

```
Date: 2026-05-22
Section: ideas
Entry: The People tab IS the Mycelium network — discovered, not
entered. The operator's vision: you never type a contact in; you
find people "in the public, in the world, in the wild", and some
"live in your home". You absorb them the way mycelium absorbs
spores — you propagate someone into your people by accepting the
identity attestation their wallet chooses to share, and they
accept yours; that mutual handshake is what determines "what leaf
they are and what leaf you are". Two leaves can later join to
compose higher structures — an organization, a church, whatever.
The network grows by discovery: the more you meet, the more of
the town, the state, the country, the world resolves inside your
wallet, until "your whole Merkle tree is made up in the wallet
the way you see it in real life". And membership becomes proof of
place: you prove where you live and where you are by proving,
with your leaf, that you are woven into that local mycelial
network.
Context: Operator 2026-05-22, spirit preserved verbatim. This is
Layer 3 — the Mycelium peer network — governed by decision D-04:
NOT built until MYCELIUM_NETWORK_SPEC.md exists. The honest hard
problems the spec must solve: (1) sybil resistance — what stops
fabricated people and fabricated town-networks; the in-person
handshake is the strongest defense and the spec must decide
whether a remote handshake counts at all, because the moment it
does the forgery gets cheap; (2) the privacy model of an
extremely sensitive who-knows-whom-and-where social graph; (3)
the honest meaning of "the whole world in your tree" — a wallet
holds its own leaves and cryptographic proofs of connection, not
the literal world. Parts map to existing primitives: the
handshake is a cousin of the Phase 2.6 in-person co-sign
exchange; a person-as-leaf is a relationship-kind attestation;
group composition relates to the Phase 7+ FROST/MuSig2 group-key
non-goal. Stage: sprouting — load-bearing vision; the right next
move is to WRITE MYCELIUM_NETWORK_SPEC.md, not to improvise it
into the Phase 4.5 tab build.
Feature: app-connections
```

```
Date: 2026-05-22
Section: ideas
Entry: "The slime" — the operator's mycelial framing for
social-recovery shares. As you live and interact through your
network you leave your slime across it: each trusted node (a
Phase 5a handshake peer, or a Phase 5b organization you belong
to) holds one Shamir share of the encryption key to your
cloud-mirrored backup blob. No single holder can use one share;
gather M of N shares back and your whole verifiable life
reconstructs. The key point the operator drew: recovery is NOT a
separate setup step — your recovery cohort IS the network you
already wove through handshakes and memberships. "Any one of
those can help me recover." Organizations can hold shares too,
because an organization is also a wallet and also a peer.
Context: Operator 2026-05-22, confirming Phase 5b and connecting
it to the existing Shamir cascade recovery design (ideas.md
2026-05-21). "Slime" is the experiential name for the share. The
load-bearing constraint is unchanged — the split is over the
backup encryption key, never the signing keypair, so M-of-N
collusion is not identity capture. Worked into
MYCELIUM_NETWORK_SPEC.md section 12.
Feature: backup-recovery
Stage: matured — the recovery design plus the operator's
connective framing are both now in the spec; awaits Phase 5e.
```

```
Date: 2026-05-22
Section: ideas
Entry: Sign in with an existing Nostr account. A person who
already has a Nostr identity (an nsec) could create their wallet
by importing that key rather than generating a fresh one — their
wallet identity then IS their existing Nostr identity, already
linked to their Nostr history and contacts. Natural because the
wallet's keys ARE Nostr keys by construction (secp256k1 / BIP340,
D-06) and tapit-attest is designed to import/export nsec. An
optional path at wallet creation: "generate a new identity" or
"use my existing Nostr account." Rare today, but for the
Nostr-native it means arriving already woven into the network.
Context: Operator 2026-05-22, surfaced alongside the Phase 5c-i
cut ("keep in mind ... continue on 5c-i"). An onboarding option,
Phase 5c-adjacent; not part of the 5c-i transport cut itself.
Feature: auth
Stage: raw.
```

```
Date: 2026-05-27
Section: ideas
Entry: Mycelium-tree visualization. A visual canvas that renders
the operator's relationships and organizations as a connected tree
of identicon nodes — the IdentityChip primitive becomes the node,
handshakes are edges between people, memberships are edges from
person to org, the org-chain walker traces edges from org up to
parent org. Family forms its own visible cluster (the relationship-
leaf 'family' / 'spouse' / 'child' / 'parent' / 'sibling' already
classifies handshake edges into the family subset, per
isFamilyRelationship in createHandshake.ts). Organizations are
their own cluster type. As the tree grows, branches condense and
collapse — the operator's whole family collapses to one node when
they zoom out to see "my church", the whole church collapses to
one node when they zoom out to see "my town". Categories emerge
as natural groupings: family, friend, coworker, acquaintance,
other (already the five values on the relationship leaf), and
org-membership as its own dimension. The substrate is whole —
handshakes are graph edges in holdings, memberships are tree
edges in holdings, walkOrgChain already walks org → parent → ...,
and IdentityChip already renders a person as an identicon node.
What is missing is the layout + interaction layer: how to position
nodes deterministically (radial? force-directed? tree-layout?),
how to render edges (SVG lines? Canvas?), how to collapse/expand
groups, how to handle the zoom-out condensation.
Context: Operator 2026-05-27, surfaced right after the IdentityChip
peek-through rollout (sessions 2026-05-27-0430 and 2026-05-27-0455).
The operator's voice: "I've always pictured a [mycelium / macro]
tree of your map like your family your organization and then you're
already as they build you... I like the idea of a visual of a
miracle [mycelium] tree for the people in their icons." Connects
thematically to the project's MYCELIUM doctrine — the mycelium
network IS the substrate being visualized; the operator is asking
to see the underground network rendered above ground. Natural
starting cut: a static SVG render of the operator's immediate
handshake-radius (1-hop) with collapsible org branches and no
force layout, just deterministic radial positioning. Expand outward
as the operator engages with each ring. Library options: pure SVG
+ d3-hierarchy (lightweight, no animation overhead), react-force-
graph (force layout but heavier bundle), or custom Canvas (most
control, most work).
Feature: connections
Stage: sprouting — first-version shipped 2026-05-27 as
src/features/connections/PeopleTree.tsx + peopleTreeLayout.ts.
Operator at center, handshake peers on an inner radial ring with
edges color-coded by relationship category (family / friend /
coworker / acquaintance / other), orgs the operator belongs to on
an outer ring with dashed violet edges. Deterministic angular
positioning via FNV-1a hash of pubkey (same hash the identicon
module uses) so the same peer always lands in the same spot.
SVG layer behind for edges, HTML+IdentityChip in front for nodes.
React.lazy from PeopleTabBody behind a List ↔ Tree segmented
toggle that defaults to List. Twenty new tests cover the pure
layout helpers. Open future cuts: angular sector grouping by
category (family peers visually cluster on one side), zoom +
collapse for trees that grow past one screen, multi-hop expansion
(your friend's friends), org-chain walking (your church belongs
to your denomination belongs to ...), tap-a-node-for-detail.
```


```
Date: 2026-06-03
Section: ideas
Entry: The public verification page as a teaching surface AND a
witnessed-correctness ledger — for the person who does NOT have a
Tapit wallet and does NOT want to download one, but clicks a link
to "verify the math." Two intertwined ideas the operator surfaced
together. (1) The /verify page a wallet-less visitor lands on
should TEACH — not just spit "valid ✓" but walk them through HOW
they can know for sure: here is the hash, here is the Merkle path,
here is the Bitcoin block this was anchored in, here is the
signature, and here is what each step proves, in plain language,
so a sovereignty-curious person learns to trust the math instead
of trusting our app's say-so. (2) The deeper idea: stack
WITNESSED attestations of correctness on top of the raw math. When
someone uses the page and verifies a proof and it shows correct,
that act can itself be recorded — a growing history of approved
hashes, almost a testvariation/testimony station where verifiers
attest "I ran the verification, the code is accurate, the math
checks out, the anchor in the Bitcoin blockchain is real." Get a
hundred independent attestations that the verify code is accurate
and the math is verified and a given proof's Bitcoin anchor is
this-and-that, and the claim starts to carry more weight than "my
app says it does." Operator's framing: it shifts trust from
"trust me / trust my app" to "trust the math, AND here are N
independent humans who checked the math and the code and signed
that it holds."
Context: Operator 2026-06-03, surfaced alongside a roadmap-
consolidation + cloud-backup-banner session. Grounds against the
already-shipped verifier path: PLAN.md "Where we are today" lists
selective-leaf disclosure proofs "with the verifier path running
OUTSIDE AuthGate so external parties can verify without a wallet
of their own" — the /verify route already exists for the wallet-
less visitor; this idea is about what that page DOES once they're
there. Connects to three existing doctrine threads. First,
HEARTWOOD's judge-weight reputation — the "hundred attestations"
are exactly judge-weight applied to a NEW object class (not
governance acts, not knowledge claims, but "this verification code
+ this math + this anchor is correct"), which echoes the Layer 4
bot framing where judge-weight was already extended from
governance to knowledge. Second, the tapit-attest substrate itself
— an "I verified this proof" attestation is just another signed
envelope kind; the verifiers don't need Tapit wallets to READ the
page but the ones who WANT to add a witnessed attestation would
sign one (which is itself a soft on-ramp: "liked verifying? the
people who vouch for correctness hold a wallet"). Third, Bitcoin-
as-public-clock (SATOSHI.md) — the attestations-of-correctness can
themselves be OpenTimestamps-anchored, so "100 people attested
this code was correct as of block N" is itself tamper-evident and
walk-backable. Open design questions, named honestly so they don't
get lost: (a) what exactly is being attested — the specific proof?
the verifier CODE at a specific commit/hash? the math/algorithm in
the abstract? these are three different objects and probably want
three different attestation shapes; (b) sybil resistance — 100
attestations from 100 throwaway keys is worth less than 5 from
known judges, so judge-weight has to gate this or the count is
gameable; (c) what does the wallet-less visitor SEE — a raw count,
a weighted score, the actual list of signer identities, a "audited
by X, Y, Z" badge?; (d) does verifying-in-browser require running
the verify code client-side (good — trustless) and if so how do we
make "here is the exact code that ran, audit it yourself" legible
to a non-coder. Natural smallest-useful first cut: make the
existing /verify page TEACH (idea 1) — expand the valid/invalid
result into a plain-language step-by-step of what was checked and
why each step is trustworthy, with the Bitcoin anchor block linked
out to a public explorer. The witnessed-correctness ledger (idea
2) is a larger second arc that wants its own roadmap brief once
the teaching surface exists to attach it to.
Feature: disclosure / verify (verifier path, currently outside
AuthGate)
Stage: raw insight — captured 2026-06-03, not yet scoped into a
cut. Resurface when the verifier-path teaching surface comes up or
when HEARTWOOD judge-weight gets its first concrete implementation.
```

```
Date: 2026-06-03
Section: ideas
Entry: Key-compromise equivocation gap — the succession-fork threat
and the social-graph backstop. The operator articulated the
self-custody recovery theory: "even if an attacker had my key, I'd
immediately denounce it as not-me, all my friends would
unsubscribe from the attacker's key and re-attach to my new key,
I could redo this ten times until the attacker tired — long-term
they do zero damage, only short-term could they take any control,
and I'd immediately have control back." The honest grounded
assessment after reading succession.ts: the theory is DIRECTIONALLY
right and the social backstop is genuinely strong, but there is a
real cryptographic gap that must be named, not papered over.
  The gap: a succession link is signed by the RETIRING key
(succession.ts createSuccessionLink — fromPrivateKey signs). So an
attacker who holds the compromised key can ALSO sign a valid
rotation. The operator and the attacker can each fork a valid chain
from the same compromised key: K->K_operator and K->K_attacker.
verifySuccessionChain validates EACH chain independently and has NO
fork-resolution logic (grep confirmed: no longest-chain, no
equivocation detection, no conflict adjudication anywhere). There
is also NO Bitcoin anchoring on succession links (confirmed empty),
so neither party can prove "mine was timestamped first," and NO
automatic rotation broadcast (confirmed empty), so the
"friends re-attach" step is entirely manual/out-of-band today.
  Why the operator still wins against their real circle: each
re-attach round resolves on a HUMAN out-of-band verification (voice,
video, in person) that the attacker categorically cannot forge —
they cannot be the operator to people who know the operator. So
against the actual social graph the operator wins every round
indefinitely. The "ten times until they tire" model holds
SOCIALLY. The unresolved part is STRANGERS: a cold verifier with no
out-of-band channel sees two validly-signed chains and the math
alone cannot say which is the real person. That is the proof we
cannot currently provide.
  Two further honest limits inside the compromise window: (1)
anything the attacker signs while holding the key produces
permanent valid signatures attributed to the operator; undoing them
needs explicit revocations (createRevocation exists — cleanup after
the fact, not prevention). (2) Rotating forward does NOT invalidate
the attacker's copy of the old key, so they can keep forking each
round; they are never locked out by rotation itself, only defeated
by the circle ignoring their branch.
Context: Operator 2026-06-03, self-custody threat-model probe ("are
there gaps in our theory we cannot provide that proof"). This is
the precise problem Tier 1 item 11 (peer-mediated identity
substrate) + HEARTWOOD judge-weight are designed to close: a cold
verifier resolves the fork by "the judges/peers whose weight counts
all vouch for K_operator and none vouch for K_attacker," turning
the social resolution the operator already relies on into something
cryptographically checkable by a stranger. The envelope-kind
substrate (release-authority, imposter_signal) is shipped as
primitives in identity-gate/; the LIVE fork-detection +
judge-weighted resolution at verify time is NOT yet wired. See the
2026-06-03 roadmap brief
"key-compromise-equivocation-and-fork-resolution-roadmap.md".
Feature: identity-gate / succession (tapit-attest chassis +
verifier path)
Stage: raw insight -> sprouting (brief written 2026-06-03). The
named first cuts: (a) Bitcoin-anchor succession links for objective
time-order, (b) fork DETECTION at verify time (surface "this key
has a competing chain"), (c) judge-weighted fork RESOLUTION so a
stranger can see which branch the weighted social graph endorses,
(d) rotation-announcement broadcast so peers auto-learn of a
legitimate switch. Resurface when item 11's release-ceremony UX is
cut — fork resolution is the same judge-weight machinery pointed at
a different question.
```

```
Date: 2026-06-03
Section: ideas
Entry: Graph-interlock sybil resistance — the lone-wolf-is-a-chicken-
and-egg trust model, and the scoring engine behind fork resolution.
Operator's framing: "a lone wolf is a chicken-and-egg and that's
fine — it shouldn't be hard to lobby for real-world connections.
Once you have real connections, we can judge mathematically where
and how many connections you have that overlap with US and the
people around you. An attacker who just spun up a wallet would have
none of the connection-level you'd expect — blatantly obvious
they're a spammer. The catch is they have NO deep connections, and
even if they fabricate them they can't be interconnected the way
they're supposed to be with the people around you who vouch for you.
Once flagged by someone, it's automatically not-a-trusted-source by
nature, then it has to prove itself, and if it has no cryptographic
proof on its side it's just bad information with no credibility."
  Where this is RIGHT (and it's the core insight): the unforgeable
property is INTERCONNECTION, not vouch count. An attacker can mint
1000 keys that all vouch for each other, but that cluster is an
ISLAND — no edges into the verifier's real graph — so from the
verifier's vantage it carries ~zero weight regardless of internal
density. This is genuine sybil resistance: it can't be beaten by
volume, only by actually being embedded in the real social graph,
which is exactly the slow real-world work an attacker can't shortcut.
findVouchingCircleCandidates.ts already computes the seed: it ranks
peers by OVERLAP across multiple trust sources (family AND cohort
AND handshake = more meaningfully connected than a one-source
contact). computeWeight (weighting.ts) sums distinct-signer weight.
The richer engine is the reserved advancedWeighting() v1.1 slot,
whose stated job is "corroboration-graph centrality" — THIS IDEA IS
THE SPEC FOR THAT EMPTY SLOT.
  Where the intuition needs sharpening (honest): "mathematically
improvable" has a hard ceiling. Graph connectivity is EVIDENCE
WEIGHTED FROM A VIEWPOINT, not a cryptographic PROOF. There is no
signature proving "this person is well-connected in the absolute";
there is only "from MY graph, their vouchers are people I already
weight, and they interlock." Connection-weight is always RELATIVE to
who is asking. That's actually a feature — the attacker can't
manufacture a globally-valid trust score — but it means we must
never display a universal trust number, only a per-verifier computed
one, and be honest that a stranger with only a partial view of the
graph gets a partial answer.
  The expensive open problem: computing graph-overlap / centrality
at verification time, especially for a stranger with a partial graph
view, is genuinely hard and probably not fully trustless. It likely
needs the verifier to bring their own graph, or to trust a relay's
view of the graph, and that boundary must be drawn explicitly so we
never pretend a partial graph gives a complete answer.
Context: Operator 2026-06-03, immediately after the key-compromise
equivocation / fork-resolution brief. This is the SCORING-MODEL
COMPANION to that brief: fork resolution (cut 3) doesn't merely
count vouches for the competing keys — it weights them by
graph-interlock and discounts self-referential islands, which is
precisely how a stranger tells the real operator's branch (endorsed
by an interlocked real graph) from the attacker's (endorsed only by
an island of fresh keys). Also the same engine that powers the
trusted-knowledge bot (Layer 4) and the witnessed-correctness ledger
(2026-06-03 verification-page idea) — every "how much do we trust
this" question routes through the same graph-weight engine.
Feature: connections / weighting (tapit-attest advancedWeighting
v1.1 slot) + identity-gate fork resolution + verifier path
Stage: sprouting — conceptual model captured, maps onto an existing
reserved code slot (advancedWeighting). Named pieces: (a) define
graph-interlock / island-discount centrality as the advancedWeighting
policy, (b) per-verifier (not global) weight computation, (c) the
flag -> must-prove-itself state transition driven by imposter_signal,
(d) explicit partial-graph honesty boundary. Resurface when
advancedWeighting v1.1 or fork-resolution cut 3 is scoped — they are
the same engine.
```

```
Date: 2026-06-03
Section: ideas
Entry: The graph IS the toy — captivation-first UX where the dumb-fun
hook and the sovereign primitive are the same gesture. Operator's
framing: people pick up Tapit to "play with" their friends and
family connections — see how many connections they share, how many
hops to someone in Alaska or France, family vs friends vs 5th-hop
strangers. It doesn't have to be useful; it has to be CAPTIVATING,
the way humans are captivated by dumb games. And by the time they're
playing, "oh hey it's also a testimony/diary, a family org, a
governance system, it's Nostr, proof-of-existence, your own medical
records without a corporation" — whatever the shiny thing is for
THAT person is the door they walk through. Operator: "I don't know
how to make that cool and awesome." The substrate is real and
unglamorous; the work is the UX that makes sovereignty feel like a
game.
  Key reframes (carpenter's response, captured): (1) The graph is
already half-built — PeopleTree renders operator-at-center, handshake
inner ring, org outer ring. The captivating version is making that
map feel ALIVE, not new substrate. (2) First-connection moment is
the whole ballgame: open onto a single glowing dot (you), "tap a
friend's phone to grow your web," and the first edge animates out
with haptic + sound. That gesture IS the security primitive AND the
dopamine hit — the dumb-fun thing and the sovereign thing are the
same tap. (3) Captivation = discovery you didn't author: background-
compute the surprising facts and surface them like fitness-app
streak cards — "4 friends in common with Sarah," "your web reaches
France in 3 hops," "connected to Alaska through Mike's cousin,"
"your family ring just closed a loop." The honest sovereign version
of Facebook's "People You May Know" uncanny mirror — same
fascination, but data never leaves the person, no corporation
mining it. (4) Visual/physical: pinch-zoom the web like a map,
watch it bloom, clusters glow by category (family/church/work),
zoom out till your town is one node, discover you're 2 hops from
someone. (5) Non-coercive quests that each secretly teach a
primitive: "add 3 people to unlock your family ring" (=cohort),
"first sealed entry" (=diary/proof-of-existence), "get one vouch"
(=trust-graph bootstrap), "verify a friend's proof" (=teach the
math). Feels like leveling up a character that is YOU, XP = real
relationships. (6) Sell the FEELING not the noun: nobody wants "a
decentralized identity wallet," everybody wants "the receipts" — I
was here, I knew these people, this happened, nobody can erase it or
charge me. Emotional hooks already in the substrate: "your kid's
whole childhood signed + timestamped, no company can lock you out,"
"a family tree that's cryptographically TRUE not Ancestry's
guesses," "proof you said it first," "your medical history that's
yours." Diary + Bitcoin anchor = sleeper killer feature (permanent,
private, provably-yours memory). (7) Nostr = distribution cheat
code: every share-to-Nostr proof is an ad to exactly the audience
that cares. FIVE FRONT DOORS, one substrate: Bitcoiner comes for
keys, new parent for baby-memory vault, prepper for family recovery
web, genealogy nerd for the real family tree, privacy person for
"no corporation in the middle" — all end up holding a sovereign key
without being asked to care about crypto.
  The honest hard part: graph-bloom + discovery is buildable on the
first hop or two from data we already have, but multi-hop ("Alaska 5
hops away") needs graph data the wallet doesn't gather yet, AND
doing it sovereignly — not phoning home to a server that sees
everyone's web — is the core tension. The cheap way to build the
addictive version is exactly the surveillance model we're replacing;
the discipline is compute-it-locally / peer-to-peer even when
harder.
Context: Operator 2026-06-03, the captivation/distribution thesis —
arguably THE product question, since the substrate is built and
adoption is the bottleneck. Connects: PeopleTree (connections), the
share-to-Nostr substrate (items 7/8 shipped), the graph-interlock
trust model (same 2026-06-03), and THE_THESIS (time-saving /
new-project inheritance framing). Highest-leverage SINGLE cut named:
make the FIRST connection moment cinematic (tap + animation +
haptic + "2 mutual friends" card) — mostly polish on existing
PeopleTree, and it's the exact moment a human is captured or lost.
Feature: connections (PeopleTree) + onboarding + theme/UX
Stage: raw insight -> sprouting. This wants its own UX/growth
roadmap brief before cutting. Resurface NEXT — adoption is the
bottleneck and this is the adoption thesis. First cut candidate:
cinematic first-connection. Second: background "web discovery"
cards. Third: the per-persona "five front doors" onboarding framing.
```

```
Date: 2026-06-03
Section: ideas
Entry: The edge that gets HEAVIER — remote-first connection, in-person
upgrade, and circles fusing when you physically bridge them. Operator's
refinement of the captivation thesis: the FIRST connection doesn't have
to be the magical one. It might be over Nostr, with someone you've never
met. The magic comes later — when you meet that person in real life at a
Bitcoin meetup and CLOSE THE LOOP by signing an in-person attestation,
the edge becomes heavier. The old remote link isn't discarded; the
in-person verification layers on top. One friend from Philadelphia, one
from California — when the operator physically meets people who bridge
those circles, the two webs grow together and start making hops, and
even though a link started over one medium it's been upgraded to a
personal in-person attestation from then on.
  Why this is RIGHT and closer than it feels (grounded in
createHandshake.ts): the substrate ALREADY signs two verification
tiers — verification:'remote' (Tier R, buildRemoteHandshakeDraft) and
verification:'in-person' (Tier P, the 3-QR exchange). Both are real
signed attestations TODAY. So "starts remote, gets heavier in person"
is NOT new crypto — the two weights already exist in the data. Exactly
three things are missing, none deep: (1) the graph doesn't SHOW the
difference — peopleTreeLayout/PeopleTree ignore the verification leaf,
so a remote and an in-person edge render identically; (2) the trust math
doesn't COUNT in-person heavier — that's just a bigger multiplier on the
in-person edge in the same weighting engine already specced
(advancedWeighting v1.1); (3) there's no UPGRADE gesture — meeting your
Nostr friend in person can't yet add the heavier in-person attestation
ON TOP of the existing remote one. That upgrade is the magic moment, and
it's beautiful because the remote edge stays as "we knew each other
online since March" while the in-person layers on as "verified face to
face in October" — the edge ACCUMULATES history and weight over time.
  The circle-fusion picture: each friend-cluster is its own web; the
moment the operator stands in a room and signs in-person with someone
bridging two clusters, that single HEAVIEST edge fuses two islands into
one graph, and because it carries the most weight it propagates the most
trust across the join. This is the literal mechanism behind "Philadelphia
and California circles grow together."
  KEY REFRAME — this solves last session's worry: the carpenter worried
the FIRST connection had to be cinematic or you lose people. This insight
is better: a low-stakes remote first link is FINE because the emotional
payoff is DEFERRED to the in-person upgrade — the close-the-loop moment
at the meetup, which is inherently meaningful because you actually
traveled and met a human. Dopamine lives at the MEETUP, not at signup.
Stronger, more honest hook: it rewards real-world connection, which is
the whole point, and it can't be faked or rushed.
  HONEST WORRIES (operator's, validated): (a) PWA vs App Store friction
is real — a web app can't do rich haptics or true phone-to-phone NFC
tap; the satisfying "tap your phones and feel it" needs a native app.
On PWA today the in-person path is the 3-QR scan — real and working but
a scan-and-show dance, not a tap. Make the QR exchange ceremonial NOW;
treat App Store as a real growth milestone, not someday. (b) Copy-paste
is the weakest, least-magical gesture — operator is right to flinch.
In-person QR (and eventually NFC) is where delight lives; copy-paste
should be the remote FALLBACK, never the headline.
Context: Operator 2026-06-03, refining the captivation/growth thesis.
Builds directly on the same-day "graph is the toy" entry and the
graph-interlock trust model. The in-person-upgrade gesture is the
concrete, near-term, substrate-exists cut that makes the whole
captivation story land without waiting on multi-hop graph data or a
native app.
Feature: connections (createHandshake tiers + peopleTreeLayout +
PeopleTree) + weighting (in-person multiplier) + a new upgrade gesture
Stage: sprouting. Named cuts: (1) render verification tier visually on
the graph (remote = thin/dashed, in-person = bold/solid/glowing) — pure
visual on data that exists; (2) in-person UPGRADE gesture — at a meetup,
add an in-person attestation on top of an existing remote handshake,
keeping both; (3) weight in-person > remote in the trust engine; (4)
make the QR exchange ceremonial; (5) App Store / native for NFC-tap +
haptics as the growth milestone. Belongs in the UX/growth roadmap brief
with the "graph is the toy" thesis. First cut candidate: visual tier
distinction (cheapest, all data present).
```

```
Date: 2026-06-03
Section: ideas
Entry: A verified network as a PROVENANCE engine for information —
witness, corroboration, and source-of-truth, with the
trust-is-not-correctness trap named. Operator's question: beyond
identity, what does having a verified network of real people around
you unlock for information delivery and verification — news, source
of truth, group-verified data, eyewitness signals? The big unlock:
a verified graph turns PROVENANCE into a first-class signal, which
is exactly what's missing from how information reaches people today.
Today a claim spreads by VIRALITY (how many amplifications), which
is trivially gamed by bots / bought reach / rage algorithms. A
verified graph replaces "how many" with "WHO, and were they actually
there." The strongest possible signal becomes "three people you
actually trust were physically present and signed an eyewitness
attestation" — categorically different from "this went viral." The
first-hand-witness vs relayed-hearsay distinction has never been
cryptographically expressible at internet scale; this substrate can
express it (in-person attestation + timestamp + location leaf =
"I, a real graph-weighted person, saw this with my own eyes here,
then").
  Use cases that stack: (1) LOCAL GROUND-TRUTH — neighbors signing
"road flooded, store closed, protest on Main St" carry real weight
because socially + geographically close and key-accountable. (2)
DISTRIBUTED FACT-CHECKING — not one central arbiter (platform
community notes) but the GRAPH weighting independent corroboration;
five witnesses who DON'T funnel through one source >> five who do
(island vs interlock, pointed at claims). (3) EXPERTISE ROUTING —
your doctor-friend's vouch on a medical claim weighs heavier IN
THAT DOMAIN than a stranger's (domain-tagged expertise weight). (4)
REPUTATION PORTABILITY — credibility follows your KEY across every
platform instead of being a follower count a company owns. (5)
COUNTER-DEEPFAKE (the one about to matter most) — in an AI-flooded
world, "a real human I can trace through my own trust graph
personally attested to this" is the scarce, unfakeable signal:
proof-of-human + proof-of-witness no model can synthesize, because
it requires being embedded in a real graph an AI has no edges into.
Same island/interlock math, pointed at claims.
  THE TRAP (carve in stone): this system is excellent at PROVENANCE
+ WITNESS (who said it, were they there, who corroborates, can it
be traced) and WEAK at CORRECTNESS (is it actually true). Different
questions; conflating them is dangerous. A tight graph of people who
all trust each other can be confidently, collectively, sincerely
WRONG. Trusted != correct. "Everyone I know believes this" is the
exact feeling that masquerades as truth and builds echo chambers.
Social trust != epistemic trust (your uncle: flawless eyewitness to
a crash, unreliable on virology). A naive version just builds
cryptographically-verified filter bubbles — arguably WORSE than the
status quo because it wraps groupthink in a trust score.
  THE DESIGN PRINCIPLE (the honest reframe): the system's job is NOT
to tell people what's true — it's to MAKE TRUST LEGIBLE. Replace
opaque algorithmic trust ("the feed decided you should see this")
with transparent social trust ("you see this because Alice, who was
THERE, signed it, and Bob + Carol independently corroborated, and
here's the chain"). Strictly better than what exists, but a
PROVENANCE ENGINE, NOT A TRUTH ORACLE. UX must always show the WHY —
the path, the witnesses, first-hand vs relayed, the domain — and
NEVER collapse to a single "73% true" number (that number is a lie
and launders groupthink into false authority). Same honesty
guardrail as the trust-graph: show the path + the humans, never a
global score; "well-sourced" must read clearly distinct from "true."
Context: Operator 2026-06-03, extending the verified-network thesis
to information/news. Arguably the LARGEST thing the substrate
enables — bigger than the wallet. Same engine as: the
trusted-knowledge-propagator bot (Layer 4), the witnessed-
correctness ledger (verification-page idea), and graph-interlock
weighting (fork-resolution). What's NEW: pointing it at CLAIMS +
EVENTS, not identities, and the witness primitives.
Feature: NEW domain — information provenance / witness layer.
Composes: attestation substrate + graph-interlock weighting +
identity-gate. New primitives needed: (a) first-hand-WITNESS
attestation kind (saw-it, with time + location leaves), (b)
relayed-vs-witnessed distinction in the claim shape, (c)
domain-tagged expertise weighting (a vouch carries weight IN a
named domain), (d) explicit "well-sourced != true" honesty layer in
any UI that surfaces it.
Stage: raw insight — large, foundational, downstream of Layer 4 +
graph-interlock weighting. Do NOT build before the trust backbone
(graph-interlock weighting + honesty guardrails) is real — pointing
a provenance engine at news WITHOUT the "not a truth oracle"
guardrails is the dangerous version. Resurface when Layer 4
(trusted-knowledge bot) or the witnessed-correctness ledger is
scoped — this is the same engine aimed at events.
```

```
Date: 2026-06-03
Section: ideas
Entry: Signed preference / taste / skill leaves weighted by your real
graph — the everyday, consumer-facing face of the provenance engine
(the honest replacement for fake reviews + ratings). Operator's
riff: put a leaf like "I don't like Chipotle" (or "I do") and post
that cryptographic leaf to a Nostr relay. Everyone subscribed who
weights you — mom, dad, an Instagram follower — sees it. Then you can
aggregate: "73% of my friends hate Chipotle, and they definitely hate
the one here." A leaf that is TOTALLY benign (not spam, not a witness
to an event) becomes WEIGHT AND GOLD to the people who weight that
person, and noise to a stranger who has no clue who they are. Extends
to every domain: judging carpenters on how good they build houses,
etc. — "the truth emerges because other people said so, not a false
narrative from an attacker."
  Why it's the unifying insight: a leaf doesn't have to be identity or
event-witness — it can be PREFERENCE, TASTE, OPINION, SKILL-VOUCH, and
the SAME provenance + graph-weight machinery makes it valuable to those
who know you and noise to those who don't. Same signed leaf, opposite
value depending on the EDGE between poster and reader — the
relative-to-the-asker principle in its most everyday form. The "73% of
my friends" step is aggregation = a recommendation engine whose inputs
are cryptographically signed by real trusted humans, not fake reviews /
bot ratings. Strictly better than Yelp/Google reviews: every input is a
real accountable human in YOUR graph. The carpenter-rating case is the
serious version — "is this carpenter good," answered by signed vouches
from people who actually hired him, with in-person + domain tiers
meaning a vouch from someone who SAW the work weighs more than gossip.
Four kinds of claim (preference, taste, skill-vouch, event-witness) —
ONE substrate, ONE engine, not four features.
  THE HONEST SHARPENING (operator said "the truth is what emerges" —
sharpen): the engine doesn't PRODUCE truth, it produces legible,
accountable, hard-to-fake CONSENSUS AMONG PEOPLE YOU TRUST. Usually
aligned with truth, not identical to it. For taste/experience questions
(is this carpenter reliable, is this restaurant good, does my friend
like Chipotle) trusted-belief-from-people-who'd-know IS the answer you
want — those are matters of experience + taste, not fact, so the engine
is perfect. Danger is ONLY when a taste-engine output is treated as a
truth-oracle output on a question with an actual fact behind it (a town
sincerely vouching for a quack). Same guardrail: show WHO + HOW they'd
know ("rated by 12 people you trust, 4 hired him directly"), never a
bare "73%" with no faces — the faces let the reader judge whether these
people's taste/expertise bears on the question.
  WHY IT BEATS ATTACKERS (operator's instinct, fully correct): a bad
actor flooding fake "great carpenter" vouches is an ISLAND with no
edges into your graph — fake consensus weighs ZERO to you while real
consensus from people you know rises. You don't need the system to
DETECT lies; you just need fabricated trust to be WEIGHTLESS, and the
real signal wins by default. Elegant: the truth (honest trusted-belief)
outcompetes the fabricated narrative not because the system judges
truth, but because fabricated trust can't get graph-weight from people
who'd actually know.
Context: Operator 2026-06-03, immediately after the provenance-engine
entry. This is the CONSUMER-FACING, everyday version — the one a
non-technical person (mom) would actually use and love. Same engine as
provenance/witness + graph-interlock weighting + Layer 4 bot, pointed
at benign preference/skill claims. Likely the most ACCESSIBLE on-ramp
of the whole vision (taste-sharing is fun + low-stakes), and it
piggybacks on share-to-Nostr (item 8, shipped) — a preference leaf is
just another signed envelope published to relays.
Feature: NEW — preference/taste/skill leaves + graph-weighted
aggregation (recommendation engine). Composes: attestation leaves +
share-to-Nostr (shipped) + graph-interlock weighting. New primitives:
(a) a preference/opinion leaf shape (subject = the thing rated, value =
like/dislike/score), (b) a skill-vouch attestation (domain-tagged: "X
is good at Y"), (c) graph-weighted aggregation query ("what do people I
trust think of Z"), (d) the same show-the-faces honesty UI.
Stage: raw insight -> sprouting. Lower-stakes + more fun than the
news/provenance version, so it may be the better FIRST consumer surface
for the weighting engine — but it still needs graph-interlock weighting
to be real to aggregate honestly. Resurface when graph-interlock
weighting (advancedWeighting v1.1) or the recommendation/aggregation
surface is scoped. Could be a killer demo: "ask your trusted graph,
not strangers."
```

```
Date: 2026-06-03
Section: ideas / doctrine
Entry: The Uncle Jim mesh + the honest-scope doctrine (claim what you
provide, never imply what you don't). Two intertwined ideas the
operator surfaced together.
  (1) THE UNCLE JIM MESH. In Bitcoin culture "Uncle Jim" is the
trusted technical person in a community who runs his own node, helps
relatives onboard, and vets things for people who can't vet for
themselves. Trust there is EARNED, LOCAL, and ACCOUNTABLE — Uncle Jim
isn't a certificate authority or a platform, he's a specific human the
community has watched behave well over years, with every reason to keep
behaving well because his standing IS his reward. Operator's insight:
the verified-network substrate lets EVERY community grow its own Uncle
Jim — the person who runs down sources, keeps records straight, checks
things are logged right — and makes his diligence LEGIBLE and PORTABLE
instead of trapped in his head. Today an Uncle Jim's judgment helps only
the handful who personally know him; with signed attestations weighted
by the real graph, his vetting becomes a signal others can lean on, and
his track record of being right + honest ACCRUES AS WEIGHT rather than
evaporating. Now imagine every community having one, vouching for each
other across communities: "everybody's shields up" — a MESH of
accountable local diligence where security comes not from one fortress
but from overlapping watchful neighbors, each covering gaps the others
can't see. This is how resilient human trust has always worked at
folk-scale; the substrate lets it span distance and survive the
platforms that currently middle-man it. (Directly serves THE_THESIS +
HEARTH_SPEC folk-scale framing; the Uncle Jim is the human node in the
Mycelium network.)
  (2) THE HONEST-SCOPE DOCTRINE (carve as standing principle, not just
an idea). Operator: "it doesn't solve every problem — you could still
get mugged going down the road and a bottle's not gonna stop that, even
a gun might not, and our thing doesn't stop that either — but what it
does do, it does; it provides the things we claim it provides, not the
things it doesn't. That's not what we're trying to do." This scoping
discipline is the maturity that separates a real tool from snake oil.
The most DANGEROUS thing a trust/security system can do is OVER-CLAIM:
the moment you tell someone "this keeps you safe" in the absolute, they
stop applying their own judgment, drop their other defenses, and the one
gap you didn't cover becomes catastrophic PRECISELY BECAUSE you implied
there were no gaps. Honest tools state what they do AND what they don't
with equal clarity — "this makes fabricated trust weightless and real
diligence portable; it does NOT verify objective truth, does NOT stop
physical harm, does NOT make a foolish community wise." That honesty is
not a weakness in the pitch — it IS the pitch, because it's what makes
the things you DO claim believable. A tool honest about its edges is one
you can trust at its center.
  This doctrine already runs through everything shipped: the verify page
("well-sourced != true"), the trust graph (show the faces, never a fake
confidence number), the recovery flows (state the cloud-blob floor
everyone hits instead of pretending there's always a way back), the
adopt-key + rotation honest-limitations disclosures. The operator has
been applying it consistently WITHOUT naming it. Name it: every future
feature passes through the lens "claim what you provide, refuse to imply
what you don't." It is the trust-graph honesty guardrail
(unknown != untrusted; provenance != truth) generalized to the whole
product's voice.
Context: Operator 2026-06-03, the culminating framing of the
verified-network / provenance / preference-leaf thread. The Uncle Jim
mesh is the human-scale picture of the graph-interlock trust model; the
honest-scope doctrine is the voice/ethics rule that keeps all of it from
becoming the over-promising surveillance-trust thing it's meant to
replace. Companion to the captivation/growth brief and the
provenance-engine entries.
Feature: doctrine (product voice + scope) + connections (Uncle Jim as
weighted graph node) + weighting
Stage: doctrine (adopt as standing principle) + sprouting (Uncle Jim
mesh as a framing for the trust/reputation surfaces). The honest-scope
doctrine should be applied NOW to all copy; the Uncle Jim mesh resurfaces
when reputation/vouch surfaces or the Layer 4 bot is scoped. Worth
lifting toward AppCommander doctrine — the honest-scope principle is
fleet-general, not Tapit-specific.
```

```
Date: 2026-06-03
Section: doctrine
Entry: Additive-proof positioning — the verifier keeps their burden, we
are extra proof that earns its way to substrate. Operator's framing
before cutting item 11, sharpening the honest-scope doctrine into a
product-positioning rule:
  - THE BURDEN STAYS ON THE VERIFIER. The person trying to decide if
    someone is trustworthy already has their own method/system they've
    deemed usable. We do NOT take that burden from them or replace it.
  - OURS IS EXTRA, ABOVE-AND-BEYOND PROOF ON ITS OWN MERITS — at first an
    optional additional signal a person can offer, NOT the thing anyone
    is required to rely on. Eventually, as it earns traction, it becomes
    substrate. But you start as the new option that has to prove itself,
    not the assumed authority. (Mirrors the system's own values: it has
    to earn weight the way a person does.)
  - WE DON'T SOLVE EVERY PROBLEM. We make sure the verifier CAN SEE an
    approvable path — a good track record / good service / whatever the
    use case needs — and decide for themselves. Showing the path is the
    product; rendering a verdict is not.
  - THE USE CASE IS DELIBERATELY BROAD SO OTHERS BUILD ON THE PRIMITIVE.
    People run their own servers, their own things, their own wallet UI —
    doesn't matter; the PRIMITIVES are the same. You are protected
    because your group of peers (and your organizations) can always set
    the record straight and help re-attest your identity to a new key if
    it ever comes to that.
  - ATTACK ECONOMICS BY DESIGN. Low-value claims (do you like Chipotle)
    have near-zero attack reward — not worth impersonating someone for.
    As the operator accrues more/heavier verification, the GATES RISE
    with the stakes; many high-stakes gates are already brutal in the
    real world ("you gotta give blood"). We are simply ANOTHER WAY to
    provide your proof, slotting into that existing escalation, not
    replacing it. The cost-to-fake rises with the value-of-faking, which
    is the right shape.
Context: Operator 2026-06-03, green-lighting the item-11 cut with this
positioning held. This is the honest-scope doctrine applied to GO-TO-
MARKET + design stance: build every gate surface so it presents an
OPTIONAL, ADDITIVE, self-proving signal the verifier weighs with their
own judgment — never a surface that implies "trust this because our
system says so." Bake into item-11 ceremony copy (D1-D4): the operator
OFFERS proof; the verifier (or their own system) decides. Companion to
the Uncle-Jim-mesh + honest-scope entry. Fleet-general — worth lifting
toward AppCommander doctrine alongside honest-scope.
Feature: doctrine (positioning + copy stance) -> applies to identity-gate
ceremony UX, the verify page, and every trust/reputation surface.
Stage: doctrine — adopt now, apply to the item-11 cut starting D1.
```

```
Date: 2026-06-03
Section: ideas
Entry: Edge gossip via handshake hand-off + Nostr refresh — the sovereign
answer to Phase B multi-hop graph data (how you get edges you don't hold
without a central server). Operator's insight: every time you handshake
someone, you ALSO receive a piece of their graph history — not all of it,
but the leaves/edges they've marked PUBLIC. You might later become those
people's direct contact; but regardless, each handshake reveals more of
the graph and their side's interconnectedness through people they already
knew. And it keeps refreshing continuously over the Mycelium/Nostr: peers
post their new little history-trees, which are meaningless to non-
subscribers but cryptographically verifiable by anyone subscribed, so
everything they say/do can be checked as true.
  Why it's the Phase B unlock + why it's SAFE: this is a gossip /
epidemic-propagation protocol for signed edges. The thing that makes it
safe — and lets you accept graph data from ANYONE — is that every edge is
a SIGNED attestation. "Bob handshaked Carol" carries Bob's signature, so
your phone verifies it LOCALLY regardless of who relayed it: you trust the
MATH, not the messenger. Forged edges fail the signature check and drop.
That's the property that lets a graph propagate peer-to-peer with no
central authority. It does NOT break sybil resistance: you now RECEIVE a
fake island's edges, but they're signed by zero-weight island keys, so the
interlock math still discounts them — gossip spreads data, weight stays
relative-to-you. The operator's "meaningless unless subscribed" instinct
is exactly that: edges are universally readable + verifiable, but only
MEANINGFUL to someone whose own graph they connect to.
  Already in the doctrine: MYCELIUM.md line 33 — "every Hearth maintains
its own local view of the lattice as it has explored it, refreshed by
federation queries," no master view. The operator independently re-derived
mycelium propagation; the NEW precision is the mechanism (handshake hands
over public graph history + Nostr continuous refresh).
  TWO SHARP EDGES (must be designed in, not bolted on):
  1. COLLIDES WITH THE PRIVACY DOCTRINE — and the operator anticipated
  the fix. MYCELIUM.md line 51: attestations are "stored in both endpoints
  and NEVER broadcast publicly… content stays private to the two parties."
  Your social graph is sensitive (who you know often reveals more than
  what you said), so private-by-default is deliberate. The reconciliation
  is the operator's "only leaves open to the public": a per-edge, opt-in
  PUBLIC flag layered on a private-by-default base. Most of the graph
  stays yours; only edges you explicitly mark shareable enter the gossip.
  This is what keeps the surveillance model OUT while the discovery toy
  works.
  2. BILATERAL CONSENT. A handshake is bilateral — publishing "I know
  Sarah" exposes SARAH'S connection to you, not just yours. The honest
  version needs BOTH parties to have consented to that edge being public,
  or you've leaked someone else's relationship. Real consent-design
  problem, must be built in from the start because the whole pitch is the
  NON-surveillance version.
  Practical plumbing (solvable, not philosophy): wallet accumulates many
  edges over time -> needs bounds + pruning (N-hop cap, public-only,
  drop stale); revocations must gossip too (rotated/removed edge must not
  linger as a zombie — carry revocation envelopes in the gossip).
Context: Operator 2026-06-03, solving the hardest open question in the
growth arc (Phase B in the captivation/growth brief). Turns "multi-hop
graph needs a server we don't want" into "multi-hop graph propagates as
signed, opt-in-public, bilaterally-consented edges over the mycelium."
Feature: NEW — edge-gossip / lattice propagation. Composes: handshake
attestations (createHandshake) + share-to-Nostr transport (shipped) +
graph-interlock weighting + revocation primitive. New primitives: (a)
per-edge public/private flag + bilateral-consent handshake step, (b) a
"my public edges" published set (kind-? Nostr event) peers subscribe to,
(c) edge-merge + dedup + prune on receipt, (d) revocation propagation, (e)
the local lattice store the overlap math (intersection + fading BFS) runs
against.
Stage: sprouting — the Phase B mechanism, faithful to MYCELIUM doctrine.
Gated: do NOT ship public-edge gossip without the opt-in + bilateral-
consent design, or it becomes the surveillance graph it's meant to
replace. Resurface when Phase B (multi-hop) or the lattice/discovery
surface is scoped. Belongs in the captivation/growth brief Phase B.
```

```
Date: 2026-06-03
Section: ideas
Entry: Family shared-secret / "safe word" — the concrete everyday face of
the circle primitive, built on the Shamir recovery substrate (NOT the
approval gate). Operator spitballing a concrete use for the abstract
"approval gate": a school pickup SAFE WORD. Set up as M-of-N across, say,
{me, husband, my mom, his mom} (e.g. 2-of-4 or 3-of-5); any qualifying
combination of those trusted people can come together to unlock/confirm
the secret word and give it to the school; no single person can leak or
change it alone; it can be reset later; it's a fail-safe. Operator also
flagged the teenager version: friend-group cliques jointly holding a
secret/clubhouse password where it takes a few of them together to admit
someone or reveal it.
  THE KEY DISTINCTION (the sharpening): the codeword is NOT the approval
  gate I built (item 11 D0-D4 = "my circle ATTESTS/approves an action,
  people vouch yes"). It is the OTHER flavor of the circle primitive: "my
  circle JOINTLY HOLDS a secret" = Shamir secret sharing, which the
  recovery cohort ALREADY implements (split the backup key M-of-N, any
  threshold reconstructs, fewer cannot — createShares.ts GF(256) Shamir +
  the recovery ceremony). So the safe-word is that same Shamir engine
  pointed at an ARBITRARY secret string instead of the backup key. Two
  flavors, do not conflate:
    1. Circle APPROVES an action  -> release-authority gate (built).
    2. Circle JOINTLY GUARDS a secret -> Shamir shares (recovery substrate).
  The codeword wants #2, and #2 is the more immediately normal-person-
  legible flavor — it may be the everyday consumer the abstract gate was
  missing.
  Use cases once seen as "a secret my people jointly hold": school pickup
  safe-word; spare-key location / house alarm code (survives one person
  forgetting, no single point of leak); family password any 2-of-4 can
  recover; break-glass "where the will / safe combo is" the kids can only
  open together when it's time; duress / "I'm okay" check-in word;
  teen friend-group clubhouse secret (clique admits/reveals jointly).
  HONEST SCOPE (keep): the wallet is great at "this secret is jointly
  held and provably recoverable by your people"; it does NOT enforce what
  a third party (the school) does with the word once revealed. It's the
  sovereign, no-company-in-the-middle shared family secret, not a magic
  real-world lock.
Context: Operator 2026-06-03, immediately after flagging the abstract
"gate a leaf" as unusable and choosing to anchor it to concrete uses.
This entry is the candidate concrete consumer. Reuses recovery/Shamir
(createShares.ts, createCohort.ts, the recovery ceremony) pointed at a
user-supplied secret string. Distinct primitive from the approval gate —
flag for whoever cuts it.
Feature: NEW (family-shared-secret) on recovery/Shamir substrate +
connections (the circle). Composes: createShares (GF(256) split/combine),
the cohort declaration + distribution + the recovery ceremony pattern,
pointed at an arbitrary secret instead of K_data. New: a "set a shared
secret" surface, M-of-N reveal/reset ceremony, plain "family safe word"
framing.
Stage: raw insight -> sprouting. Strong candidate for the everyday face
of the circle. Resurface when scoping the gate's concrete consumer OR a
general-purpose Shamir-shared-secret feature. Operator said don't go too
far down it yet — this is captured, not scoped.
```

```
Date: 2026-06-03
Section: ideas
Entry: Use-case catalog for the circle primitive (low monetary value /
high SOCIAL value) — the "my people jointly hold a secret OR jointly
approve an action" family of features. Operator asked for the full
breadth of where this lands. Two flavors throughout: (1) JOINTLY HOLD a
secret = Shamir (recovery substrate); (2) JOINTLY APPROVE an action =
release-authority gate (item 11).
  KIDS & TEENS: school pickup safe-word (M-of-N family); friend-group
  clubhouse password / secret society (clique jointly holds, few needed
  to admit); "is this really my friend" anti-catfish word; group-chat
  admin needs 2-of-3 to add/remove (no solo nuke or creep-invite);
  teen duress "come get me" word any parent sees; scavenger-hunt/game
  secrets that unlock only as a team; secret-santa assignments held so
  no one peeks alone.
  FAMILIES & PARENTS: alarm/garage/Wi-Fi code held M-of-N (survives one
  forgetting, no single-phone leak); spare-key location, safe combo,
  passport location; break-glass estate info (will, lawyer, insurance)
  kids open only TOGETHER when it's time; babysitter/grandparent
  emergency packet (doctor, allergies, ICE) released by any 2 adults;
  family proof-of-life / "I'm okay" check-in word; shared household
  account passwords any 2-of-4 recover; co-parenting neutral safe-word +
  pickup auth neither parent can unilaterally change.
  COUPLES: "this is really me, act on it" word for big requests
  (anti-deepfake-voice / SIM-swap scam defense); joint vault recoverable
  by either partner + one trusted third (breakup/death isn't a lockout).
  CAREGIVING / ELDERLY / HEALTH: aging parent's accounts/directives held
  by adult kids M-of-N (no solo action, together in emergency); trusted
  contacts see meds/allergies/DNR released by any 2 of care circle;
  dementia safety — caregiver circle jointly holds door code + "allowed
  to take Mom out" approval.
  FRIEND GROUPS & COMMUNITIES: mutual-aid shared resource list/safehouse
  only the circle holds; neighborhood watch gate code + "let contractor
  in" approval across neighbors; hobby clubs/bands/D&D shared lore +
  social logins; recovery/support group private meeting location to
  vouched members only; activists/journalists/at-risk — a contact or
  location no single member can leak under pressure (M-of-N reveal).
  SMALL BUSINESS & TEAMS: petty-cash code / POS admin PIN / alarm code
  held by shift leads M-of-N; server root / registrar / master password
  held by partners (no single or fired admin controls it); "approve
  before this happens" — 2-of-3 partners for a big purchase / press
  statement / granting access; founder break-glass key recovery.
  CIVIC / FAITH: congregation benevolence-fund access / members-in-need
  list held by deacons M-of-N; estate executor circle; co-op board /
  community-treasury approval.
  THE THROUGH-LINE (why low-money / high-social): every one of these is
  something people ALREADY handle with a sticky note, a group text, "ask
  my mom," or a shared password nobody should know — fragile, leaky,
  single-point-of-failure. This makes it sovereign (no company holds it),
  tamper-evident, recoverable, and COLLECTIVE BY DESIGN. The emotional
  hook is not money — it's "my people have my back, and no one of them
  can betray or fumble it alone." This is the adoption surface area: the
  circle primitive isn't a crypto feature, it's social infrastructure for
  trust people already practice informally.
  HONEST SCOPE (keep on all): the wallet makes a secret jointly-held +
  provably recoverable, or an action jointly-approved + provable — it
  does NOT enforce what a third party does with the result (the school,
  the bank). Sovereign shared-trust, not a real-world lock.
Context: Operator 2026-06-03, brainstorming breadth after the safe-word
example. This catalog is the adoption-thesis evidence: the circle
primitive (Shamir shared-secret + release-authority approval, BOTH
already substrate) has enormous low-stakes everyday surface area. Feeds
the captivation/growth brief AND the family-shared-secret entry. Picking
2-3 of these as shipped presets/templates is the likely path to making
the circle legible.
Stage: raw catalog — capture, not scoped. Resurface when scoping the
shared-secret feature or choosing concrete presets for the circle.
```

```
Date: 2026-06-04
Tag: shared-secret / ACCESS-MODEL scoping (who-gets-the-secret)
Summary: Operator challenged the "family safe word" framing — "is safe
word the only use case? who gets the secret, the person who started it
or everyone? did we lazily build without proper scope?" The honest
read: the CORE (Shamir split/combine over an arbitrary string with an
integrity marker) is general and sound, NOT lazy. But we shipped it
framed as ONE use case with ONE implicit access model that we never
deliberately chose — Shamir's default "whoever possesses M shares
reconstructs locally." The 2026-06-03 use-case catalog (above) proves
the surface spans at least THREE distinct mechanics, and they imply
DIFFERENT access models we have not designed for:
  1. SECRET-REVEAL, gatherer-holds (what we built): anyone who collects
     M pieces in one place pastes them and sees it. No designated owner,
     no consent step, no record of who contributed. In a 2-of-3 family
     word, if mom collects grandma's + dad's pieces, MOM sees it and
     grandma/dad had no approval moment. The creator already knows it
     (they typed it), so "rebuild" really serves OTHERS recovering it
     or the creator on a NEW device.
  2. SECRET-REVEAL, consent + named requester (the parked full
     round-trip): one person requests, each holder taps approve, the
     secret reconstitutes ONLY on the requester's device, with an
     auditable record of who helped. ("released by any 2 adults",
     break-glass.)
  3. SECRET-REVEAL, everyone-together (group consensus): all
     participants see it simultaneously when M agree. ("kids open the
     letter only TOGETHER when it's time.")
  4. (separate substrate) ACTION-APPROVAL, not secret at all —
     release-authority / item 11. "2-of-3 partners approve a purchase",
     "neither parent can unilaterally change the pickup auth." This is
     NOT the shared-secret primitive; conflating them is a trap.
THE SCOPING GAP: we let possession = access by omission, and the narrow
"safe word" naming hid that (a) the primitive is general and (b) the
access/consent/reveal-target dimension is a real design axis we skipped.
LIKELY DIRECTION: name it a general "shared secret / vault" primitive
with concrete presets, and decide the access model EXPLICITLY rather
than inheriting Shamir's default silently. Gatherer-reveal is an honest
base; consent+requester and reveal-to-all are deliberate stronger modes.
Reset-vs-reveal and who-may-initiate are sub-decisions inside each.
Context: Operator 2026-06-04, after the DM-as-chat cut shipped. This is
a healthy "stop and scope before stacking more" challenge. Surfaced as a
chip-form direction question this same turn.
OPERATOR CORRECTION (same turn): operator re-quoted their original
school-codeword framing and said "don't go too far down that road" — it
was ONE spitballed example. Reading it carefully, the gatherer-reveal
model we built is CORRECT for it, not lazy: any of those people could
come together to unlock the word, it doesn't matter which combination,
the circle is trusted, it can be changed/reset later, it was just the
fail safe. Possession = access with NO consent ceremony is the INTENDED
behavior here because trust in the circle is assumed; treating
gatherer-reveal as a gap was carpenter over-reach. The one genuinely
missing piece the operator's own words name is a first-class
CHANGE/RESET — today reset = make a new one + redistribute manually.
Consent / named-requester / everyone-together stay real for OTHER catalog
entries (break-glass, "open the letter together") but are NOT to be
chased off this one example.
Stage: sprouting — corrected. Base model (gatherer-reveal, any M of a
trusted circle, resettable fail-safe) is RIGHT and shipped. Open thread:
a clearer first-class reset/change flow.
Resurface: when we touch reset/change, or when a specific catalog use
case is explicitly chosen for a build.
```

```
Date: 2026-06-04
Tag: THESIS - peer-consensus as a covenant layer OUTSIDE bitcoin (two-layer serial consensus)
Summary: Operator's theory. If a Bitcoin key (or a Lightning preimage)
exists ONLY as Shamir shares across a Tapit peer group, then a threshold
of that group (e.g. 7-of-10) is a CONSENSUS LAYER that sits IN FRONT OF
Bitcoin's - prior, orthogonal, invisible to the chain. You must clear the
Tapit social-threshold gate BEFORE you can even produce the signature
Bitcoin/Lightning then validates. So we've effectively built "covenants
outside Bitcoin" - covenant-like conditional spend enforced by a peer
group, not by Bitcoin script. You pick your security level by your quorum
(100 keys harder to fake than 3); Bitcoin consensus is a separate,
second-order concern only reached AFTER Tapit consensus is achieved.
Cashu/Fedimint are steps toward this; the unlock is personal, configurable,
human-gated access you can turn on and off.
Carpenter refinements (honest, to make the thesis stronger):
 1. Strongest form THRESHOLD-SIGNS (FROST/MuSig2) - never reconstructs the
    key, so no single-point-of-assembly, and Bitcoin still sees ONE Schnorr
    sig so the whole 7-of-10 policy is invisible on-chain. Wallet TODAY is
    Shamir-RECONSTRUCTION only (no FROST in chassis, verified) - that's the
    upgrade that turns this from clever to bulletproof.
 2. The social layer's security = realness/independence/non-collusion of the
    holders -> underwritten by Tapit's IDENTITY GRAPH (handshakes, vouches,
    anchored history = Sybil/collusion resistance). Quorum size only buys
    security if the holders are genuinely independent humans, not sockpuppets.
    The web-of-trust is what gives the threshold its meaning.
 3. Real edge over ON-CHAIN covenants = MUTABILITY: turn the gate on/off,
    rotate, re-split, change the threshold, swap a bad member - zero on-chain
    cost, zero fee. Rigid Bitcoin covenants (fixed at UTXO creation) can't.
 4. It's personal, configurable BYZANTINE FAULT TOLERANCE: dial M against how
    many of your people could go crazy/be coerced/collude, per stakes.
 5. Precision so it's defensible: NOT literally a Bitcoin SCRIPT covenant
    (which nodes enforce on a UTXO). It's off-chain social/threshold custody
    as a pre-spend gate - you constrain WHO can ever produce the signature,
    not the coin on-chain. Same outcome, different mechanism; the difference
    (no Bitcoin permission needed) is the whole point.
 6. Fedimint already = threshold-guardian custody of BTC; Cashu = mint-
    custodied ecash. Both are STANDING INSTITUTIONS you JOIN. Tapit
    generalizes to AD-HOC, PERSONAL, payload-agnostic consensus gates woven
    into your OWN identity graph, for ANY secret, not just ecash.
Stage: matured thesis. This is the conceptual spine under the
conditional-release engine brief (2026-06-04).
Resurface: when scoping threshold-signing (FROST) vs reconstruction, and
when writing any "what is Tapit" positioning.
```

```
Date: 2026-06-04
Tag: FROST RECONSIDERATION - revisit the shelved threshold-signing unlock, lighter + social-first
Summary: Operator revisiting FROST. History (grounded): the
2026-05-25-frost-first-and-charter-governance-roadmap.md brief planned it
fully - operator-locked to vendor RFC 9591 FROST-secp256k1 (Rust->WASM),
four phases (A primitives -> B wallet quorum scaffolding/DKG -> C
quorum-controlled orgs -> D charter governance). It was shelved
("supposedly wasn't worth it") for bundle WEIGHT + load. BUT that same
brief already named the mitigation in its risk section: "lazy-load only
into quorum-aware screens so Classic single-key operators never pay the
bytes," and listed lighter TS libs (frostlib ~30-50KB, cmdcode/frost
~40-60KB) vs the heavy reference (zcash Rust->WASM ~150-250KB). So the
"not worth it" verdict likely attached to the HEAVY full-DKG + reference-
WASM combo, and the escape hatch may never have been exhausted.
Carpenter's fresh angles:
 1. The weight is bounded + one-time: a lazily-loaded chunk that only
    loads during a RARE group ceremony, not main-bundle weight, not
    per-op cost. Classic users pay zero. The wallet already lazy-loads
    aggressively (everything shipped this session does).
 2. Possible dodge of what actually broke it: TRUSTED-DEALER FROST - reuse
    today's Shamir-style dealer share distribution but make the shares
    FROST SIGNING shares, so the key is never reconstructed at signing,
    WITHOUT the heavy multi-round interactive DKG. Pair with a light TS
    lib + lazy load. Gives ~80% of the benefit (group-as-signer, key never
    assembled, Bitcoin sees one Schnorr sig) at a fraction of the weight.
    Honest cost: trusted-dealer reintroduces a gen-time single point (the
    dealer briefly knows the key) - same as Shamir today; full DKG removes
    it but is the heavy part.
 3. SOCIAL-LAYER-FIRST is the right framing and the old brief already had
    it: Phase B gives the wallet "the role of participant in a multi-party
    key WITHOUT yet knowing what the key is FOR." FROST's first unlock is
    GROUP IDENTITY - a family/club/Hearth/org that signs as ONE
    cryptographic agent (attestations, charters, vouches, governance) - the
    Heartwood/Mycelium governance backbone. A Bitcoin key, a Lightning
    channel, a descriptor, 12 words are just PAYLOADS that group key can
    later authorize. Operator: using FROST at the social layer before ever
    touching Bitcoin "is just as interesting as doing it only on Bitcoin."
 4. THE FRONTIER GAP the operator's "change out our social layer the way we
    want" exposes: MUTABLE membership with a STABLE group public key
    (proactive resharing - add/remove a member or change threshold WITHOUT
    changing the org's identity). This was EXPLICITLY OUT of the 2026-05-25
    plan ("no in-place authority-transfer ceremony in scope"). Cheap
    version: new DKG -> new group pubkey -> migrate/re-authorize (identity
    changes). Expensive version: resharing protocol preserving the pubkey
    (advanced, may not be in off-the-shelf libs). This is the genuinely
    hard piece and the one to go in eyes-open on.
Stage: matured -> actionable reconsideration. Pairs with the
conditional-release engine thesis (same session) and the existing FROST
brief.
Resurface: next time we scope quorum/threshold-signing or governance;
decide trusted-dealer-first vs full-DKG, and light-lib vs reference-WASM.
```

```
Date: 2026-06-04
Tag: ARCHITECTURE - fixed-peer-key + mutable-descriptor inheritance vault (cleanest synthesis)
Summary: Operator's design. The peers hold ONE FIXED key (their secret
never changes, distributed once, "no clue what they hold"); the owner
reconfigures wallets freely on his own side; the ONLY mutable,
must-propagate piece is the DESCRIPTOR. Maps cleanly to Bitcoin Taproot:
owner KEY-PATH (spend anytime, private, sole control while alive) + a
timelocked TAPLEAF k-of-n of the fixed peer keys (CSV relative timelock).
Bitcoin enforces that the peers cannot touch the coin before the timelock
matures EVEN IF fully colluding - trustless, strictly stronger than the
pure-social gate. This is why the $1M case wants the chain and the Netflix
case doesn't.
CSV detail = the operator's "pointless if alive / liveness": a relative
timelock resets every time the coin moves, so a periodic self-spend IS the
proof-of-life; stop (die) and the last UTXO's clock matures and the peer
branch opens. Honest cost: the dead-man's switch needs periodic on-chain
liveness spends (a chore + footprint), or absolute timelocks pushed forward.
DIVISION OF LABOR (the spine): peers hold the fixed KEY (high stakes,
direct, once); TAPIT holds the DESCRIPTOR (low stakes - watch-only public
keys + policy, no spending power - mutable, refreshed) and conditionally
RELEASES it to the heirs on consensus/after the event; BITCOIN enforces the
timelock + threshold. Tapit holds the MAP, not the money and not the key.
RESOLVES last turn's frontier gap: you do NOT reshare the group (the hard
problem). You keep the group FIXED and vary the descriptor around them.
Mutability via policy reconfiguration, not membership change.
GROUNDING: this is the proven Liana / Nunchuk inheritance-vault pattern
(primary key + timelocked recovery path via descriptors) - validated,
deployable on Bitcoin TODAY. Tapit's delta: (a) the recovery path is your
attested SOCIAL graph - real, Sybil-resistant humans, not a backup key in a
drawer; (b) Tapit solves the operational gap those vaults leave to the user
- keeping the heirs' descriptor current AND releasing it; (c) the identity
layer keeps peers recoverable as their own keys rotate.
FROST DISTINCTION: this design does NOT need FROST. A revealed k-of-n in a
Taproot tapleaf (multi_a / CHECKSIGADD) does it with plain Bitcoin script -
each peer signs independently with their fixed key, no DKG, no interactive
rounds, lighter than FROST. FROST only adds PRIVACY (peer-threshold becomes
a single aggregate sig, invisible on-chain even at spend). Optional upgrade,
NOT on the critical path for the inheritance vault.
THE ONE RISK TO NEVER GET WRONG: descriptor propagation. Keys without the
current descriptor = permanently bricked funds. System reliability = keeping
the heirs' descriptor copy current + retrievable = exactly Tapit's job, must
be bulletproof. Favor a stable descriptor or automatic Tapit-side refresh so
a rotation never strands the heirs. The descriptor reveals existence/amount/
peer-set (privacy), so hold it encrypted, release only to heirs.
REALITY: no Bitcoin layer in the wallet today (Satoshi's biggest unbuilt
block). Tapit-now contribution = descriptor custody + release; the Bitcoin
enforcement is north star.
Stage: matured architecture - cleanest synthesis of the arc so far.
Resurface: when the Bitcoin layer is scoped; pairs with the conditional-
release engine brief + the FROST reconsideration entry.
```

```
Date: 2026-06-05
Tag: VERIFIABLE PHOTOS - corner verify-stamp on shared photos + in-app camera follow-on
The operator: "have the metadata lock up in the corner of the picture - if
it's a selfie or you take it through the app it automatically stamps it or
put it on there later after it finalize." SHIPPED (this session): the
"stamped copy on share" path. Picking the chip-form fork, the operator chose
to NEVER modify the signed + anchored original; instead StampedPhotoButton
composites a verification badge onto a COPY at share time. The badge burns a
corner panel with a Tapit mark + capture date + who captured it + the
Bitcoin block (once confirmed) + a SCANNABLE QR that resolves to /verify with
a multiDisclosureProof bundle disclosing the attachment_sha256 leaf - a
scanner re-hashes the photo to confirm it's the signed-and-anchored one. Why
this model and not bake-at-capture: (a) keeps the file-integrity digest well
defined (the stored bytes ARE what was signed), (b) the badge can show the
LIVE Bitcoin block because it renders at share time, not capture time (the
block confirms minutes-to-hours later, async), (c) you can't put a verify-QR
OF the photo INTO the photo it's computed from without it chasing its tail.
DEFERRED ALTERNATIVE (sprouting): a light always-on cosmetic brand mark baked
into the bytes at capture for the "it just always has the mark" feel - signed
as part of the photo, travels permanently, but can only carry capture-date +
handle (no block, no self-referencing QR). Offer as a toggle later if the
operator wants the permanent look in addition to the verifiable copy.
IN-APP CAMERA / SELFIE (sprouting, the real follow-on): the operator believes
there is a camera on journal entries. GROUNDED: there is NOT. The composer
"photo" button is a plain <input type=file accept=image/*> with no capture
attribute - on a phone the OS picker offers "Take Photo" via the system
camera, but the app never runs getUserMedia, so there's no live preview, no
front-cam selfie toggle, no snap-in-app. A true in-app camera (getUserMedia
preview + capture + front/back toggle, then straight into normalizeImage ->
sign -> anchor -> optional stamp) is a clean, self-contained next cut that
would make "take it through the app and it stamps it" literal. Pairs directly
with the stamped-photo cut already shipped.
Stage: FRUITING — in-app camera SHIPPED 2026-06-05 (CameraCaptureModal, a
reusable getUserMedia camera with iOS-PWA native-capture fallback, wired into
the journal composer so capture -> sign -> anchor -> stamp is now literal).
Still sprouting on top: (a) wiring the camera into messaging — blocked on the
MESSAGING-IMAGE fork below; (b) the bake-at-capture cosmetic always-on mark.

MESSAGING-IMAGE fork (open, surfaced to operator 2026-06-05): chat is
TEXT-ONLY today (threadMessage.ts: attachments are an unbuilt "future" note)
and raw photo bytes can't ride NIP-17 relay DMs (size). So "use the camera in
messages" forks: (A) chat camera creates a signed+anchored journal entry and
shares the stamped copy to the peer via the system sheet (image travels
out-of-band; "we'll just link" = a verify link in the thread) — buildable now,
no new infra; (B) real in-Tapit image messages = host the encrypted blob +
reference it in the DM (NIP-94 / Blossom-style) so it renders in the peer's
thread — bigger, its own cut. Awaiting operator's pick in chip form.
```

```
Date: 2026-06-05
Tag: AGGREGATE CONNECTION DEMOGRAPHICS - coarse codes exchanged at handshake, tallied into a privacy-preserving census
The operator: "every time you have a handshake there is a certain amount of
values that change hands and it's kind of like a code. The first two digits is
the country code, the second two the state/province, the next few this-or-that
- not specific data to any one person - but somehow it passes person to person
to person and then it would show an aggregate for me of like 200 people from
the United States and 15 from Australia. I wouldn't know who they were, but I'd
know I was connected to that many people because of the aggregate count. I
wonder how that would work."
HOW IT COULD WORK (three escalating versions):
(1) LOCAL HISTOGRAM (buildable now, exact, fully private): each identity
carries a COARSE non-identifying origin code (country + region + maybe an
age-decade or a couple of opt-in buckets). It's already exchanged implicitly
when handshakes swap identity attestations. The wallet keeps a local GROUP-BY
over your own connections: "200 US, 15 AU." No network, no server, you only
count people you actually connected with. This is a stats view over data you
already hold (PeopleTree already aggregates the graph).
(2) NETWORK CENSUS (ambitious): "passes person to person to person" = the
codes propagate/aggregate across the Mycelium mesh so you see counts beyond
your direct connections. The hard parts: distinct-counting without a central
server (HyperLogLog / cardinality sketches that gossip + merge), DOUBLE-COUNT
avoidance, and SYBIL resistance (counts only mean something if the nodes are
real humans - the handshake/vouching graph is the Sybil defense).
(3) PROVABLE AGGREGATE (fits the chassis): with attestations + the existing
selective-disclosure proof machinery you could PROVE "I'm connected to >=N
people from the US" without revealing who - a verifiable aggregate claim.
THE LOAD-BEARING PRIVACY RULE: coarseness IS the privacy. Buckets must be
coarse enough that many people share each code (k-anonymity); pile on too many
digits (precise age, town, rare combo) and the "code" becomes a fingerprint
that re-identifies. Country+region is usually safe; resolution is the dial.
GROUNDING / FIT: handshakes already exchange identity attestations; the origin
code would be a coarse derived public leaf on identity. PeopleTree already does
graph aggregation. Disclosure proofs could make aggregates provable. Very much
in the grain of what exists.
OPEN FORK (asked operator in chips): is the aggregate over (a) YOUR own direct
connections [local histogram - easy, exact, private], (b) a network-wide
census propagated through the mesh [needs distinct-count sketches + Sybil
handling], or (c) something you want to PROVE to others?
Stage: raw insight -> sprouting. Resurface: pairs with the Mycelium network
spec and the identity-leaf model; the local-histogram version is a small,
high-delight cut that could ship well before the network-census version.
```

```
Date: 2026-06-05
Tag: AGGREGATE DEMOGRAPHICS - update: operator picked ALL THREE versions; grounding on the location leaf
Operator picked all three scopes (local histogram + network census + provable),
so the vision is the full stack; build order stays smallest-first.
GROUNDING (changes the first brick): the identity attestation ALREADY carries
an optional `location` leaf (createIdentityAttestation.ts), captured at the
founding ceremony (IdentityCeremony.tsx:93), read in HomeScreen + nostrProfile.
BUT it is FREE-TEXT ("Austin, TX" / "Texas" / "usa") so it will NOT bucket
cleanly into "200 US, 15 AU". leafValue(att,'location') already reads it off
any connection's identity, and handshakes already exchange identity
attestations, so the DATA PATH exists — the gap is STRUCTURE.
FIRST BRICK: a structured coarse origin code — country (ISO-ish), optionally
region — captured as a dropdown at the ceremony + editable in settings, then a
"Connections by region" histogram groups your handshaked connections by it.
The granularity is the PRIVACY DIAL (country-only = strongest k-anonymity;
country+region = finer but less anonymous). All three versions build on this
same coarse-code leaf: local = group your own; network = gossip/merge sketches;
provable = disclosure proof over the leaf.
OPEN (asked operator, chip): country-only vs country+region vs reuse free-text.
Stage: sprouting -> actionable. The local histogram is the small first cut;
network census + provable grow from the same leaf.
```

```
Date: 2026-06-05
Tag: BITCHAT / OFFLINE-MESH TRANSPORT - photos & payloads travel over regular channels, not Nostr-only
Operator (on camera-in-chat): "Can be shared over regular ways like iMessage,
AirDrop, Bluetooth. We don't have to have Nostr specifically. And what about
enabling BitChat for edge case and maybe adding that capability in as a medium
to travel through?"
TWO THINGS HERE:
(1) NOW, no new infra: the system share sheet (shareFile / Web Share API,
already built for the stamped photo) ALREADY routes to iMessage / AirDrop /
Bluetooth / anything installed. So "send a photo from a chat" can just be
capture -> share-out via the sheet; Nostr is not required. The camera modal +
shareFile already exist; this is a thin wiring cut.
(2) NORTH STAR, big: BitChat (Jack Dorsey's BLE offline mesh chat) as an
ADDITIONAL TRANSPORT MEDIUM the wallet can travel through — the edge case where
there's no internet/relays at all (disaster, off-grid, censorship). Tapit's
transport layer is currently Nostr relays (NIP-17). A BLE-mesh transport would
be a pluggable second medium under the same envelope abstraction. Big
integration (BLE, mesh routing, store-and-forward), its own cut. Fits the
sovereignty thesis hard: works when the internet doesn't.
Stage: (1) ready-to-build thin cut; (2) raw insight / north-star transport.
Resurface: pairs with the Mycelium network spec + the transport feature.
```

```
Date: 2026-06-05
Tag: CIVIC MERKLE / VERIFIABLE VOTING - town-as-ratified-leaf -> citizens-as-tree -> town/county/state nested hashes -> prove-you-voted-without-revealing-choice
Operator (theorizing, NO cut - log for later): "the town you belong to is one
of your leaves, ratified by people; you sign for the town if you're on the
board (alderman, treasurer). Your identity is tied to the town because you
chose to put it as a leaf and had it ratified. How far is that from voting? The
citizens make up a Merkle tree, each vote counts once, the town is a hash, the
county is a hash, the state is a hash - can each person prove they voted
without revealing what they voted for, and how does that change government?"
GROUNDING - WHAT ALREADY EXISTS (closer than it feels):
- Civic membership AS A RATIFIED LEAF: createMembership.ts (org-issued + self-
  membership); officials roster + countRatifications (officialsRoster.ts)
  counts how many roster pubkeys co-signed an envelope = exactly "you belong to
  the town, ratified by N people / signed by the board." Board roles via the
  roster. THIS IS SHIPPED.
- SECRET BALLOT PRIVACY: multiDisclosureProof prunes the Merkle claim tree so
  you reveal some leaves and hide siblings -> "prove I cast a valid vote in
  election X" while the choice stays a HIDDEN leaf. The prove-without-revealing
  primitive exists.
- IMMUTABLE PUBLIC TIMESTAMP: OpenTimestamps anchoring makes a vote/tally
  tamper-evident in time without a central counter.
- M-OF-N COUNTING: gatedReleaseBundle (count peer attestations against a
  threshold) + Shamir (recovery/sharedSecret). Counting/threshold patterns
  exist as primitives.
WHAT'S GENUINELY NEW / HARD:
- ONE-PERSON-ONE-VOTE (the crux): the identity model is relationship+time
  based, not a voter roll. Anonymous no-double-vote needs a NULLIFIER (prove
  membership in the eligible set + emit one deterministic per-election marker
  so a 2nd vote is detectable WITHOUT linking to identity) - that's ZERO-
  KNOWLEDGE membership proof (Semaphore/zk-SNARK tier), a heavier crypto class
  than the wallet's Shamir + Merkle-disclosure. NOT built.
- THRESHOLD SIGNATURES (FROST): roadmapped, not shipped - needed so an election
  result isn't forgeable by one official.
- HIERARCHICAL AGGREGATION town->county->state: no tree-of-trees today (each
  attestation is its own tree). But it's a natural Merkle-of-Merkles to add;
  conceptually the cleanest part of the operator's vision.
- TALLY CEREMONY: encrypt votes until close, threshold-decrypt, tally - new
  protocol design (homomorphic/mixnet for real elections).
THE KILLER CAVEAT (must not get wrong): "prove HOW you voted" enables VOTE-
BUYING. Real voting crypto wants RECEIPT-FREENESS / coercion-resistance: you
can verify your vote counted but CANNOT prove to a buyer which way you voted.
multiDisclosure alone, naively, makes vote-selling EASIER, not harder. So the
"prove you voted" property must be carefully split: prove PARTICIPATION +
validity publicly, keep the CHOICE unprovable-to-others. This is the line
between a toy and a real ballot.
HONEST VERDICT: two very different targets on a spectrum. (A) ACCOUNTABLE
FEDERATED CIVIC GOVERNANCE - small high-trust units (towns, HOAs, co-ops,
unions, DAOs), membership + roles ratified, decisions threshold-signed, results
anchored, participation provable, town->county->state Merkle aggregation. This
is ~10-30% built and the rest is in-grain (FROST + tree-of-trees + a vote
credential). VERY on-thesis, achievable. (B) ANONYMOUS SECRET-BALLOT NATIONAL
ELECTIONS - needs zk nullifiers + receipt-freeness + tally ceremony; a research
tier beyond current primitives; FAR.
HOW IT CHANGES GOVERNMENT (the payoff): trust shifts from INSTITUTIONAL ("trust
the election authority") to MATHEMATICAL ("anyone recomputes the tally from
anchored commitments, trusting no counter"). Fits Hearth/Heartwood federation
doctrine (consensus/multisig governance, append-as-decided) - local Hearths
compose upward = the town->county->state story. Start at the town/co-op scale,
not the nation.
Stage: matured thesis / north-star. Pairs with FROST brief, HEARTWOOD, HEARTH_
SPEC, MYCELIUM, and the conditional-release engine. Open question to mature:
which end of the spectrum (accountable-civic vs anonymous-ballot) is the target?
```

```
Date: 2026-06-05
Tag: VOTING IDEOLOGY - accountability/boldness vs the secret ballot (refines the civic-Merkle thesis)
Operator (theorizing, NOT solving, "understanding the pavement I'm laying"):
"If a candidate has to stand behind his promises and be held accountable, the
person voting should also do it in boldness, not hide behind a secret ballot.
I really don't know the answer." Articulating a VALUE leaning toward
open/accountable voting over default secrecy.
THE LOAD-BEARING HISTORY (the counter he'd want to know): the secret ballot
(Australian ballot, ~1850s AU -> US 1880s-90s) was itself the REFORM. Open /
viva-voce / colored-party-ticket voting was the PRE-reform default and was
abandoned precisely because openness enabled vote-buying (delivery was
verifiable), employer/landlord/creditor COERCION, and machine intimidation. So
"open = accountable" is the OLD system; secrecy was won to protect the weak.
THE KEY SEMANTIC DISTINCTION (resolves the apparent hypocrisy): transparency is
a tool for constraining POWER; privacy protects PERSONS. A candidate is
ACQUIRING power over others -> transparency flows UP the power gradient
(legitimate, necessary). A voter is an individual -> secrecy protects DOWN the
gradient from coercion. Same principle (constrain power, shield the
vulnerable), two positions. Slogan: "transparency for power, privacy for
persons."
SECOND DISTINCTION (dissolves a false tradeoff): VERIFIABILITY != ANONYMITY.
Modern voting crypto gives end-to-end-verifiable AND secret elections. So his
"can't trust hidden counts" worry is fixed by verifiable TALLIES + public RULES
+ public ELIGIBILITY, NOT by abolishing ballot secrecy. What's transparent =
the count/rules/roll; what's private = the individual choice.
THIRD (the genuine unresolved knot): "let the bold stand up" = voluntary public
disclosure of one's vote. But if disclosure is POSSIBLE, coercers DEMAND it
("prove you voted my way") -> vote-buying returns. Receipt-freeness specifically
forbids even voluntary proof. So there's a real tension between honoring
boldness and protecting everyone from being FORCED to be bold. Not resolved;
named honestly.
WHERE OPENNESS ACTUALLY WORKS: small, high-trust, low-coercion units where
standing up is the norm - town meetings, co-ops, union floors, Swiss
Landsgemeinde (show-of-hands cantonal assemblies still exist), Quaker
consensus. Openness is safest exactly where it's least needed (local, trusting)
and most dangerous where stakes + power-asymmetry are highest.
DESIGN PRINCIPLE FOR THE PAVEMENT: privacy/openness is a DIAL set per-decision
BY THE COMMUNITY, not a system-wide dogma the tool hardcodes. Wallet's job =
make the whole spectrum cleanly available (open ratification SHIPPED;
pseudonymous; anonymous-zk later) and the choice LEGIBLE - not pick the
ideology. Defaults + affordances shape behavior, so designing this IS a
political act (what he senses).
LINEAGES worth knowing: subsidiarity (decide at the most-local capable level),
Ostrom's commons-governance design principles, federalism, liquid democracy,
the Australian-ballot history. The thesis underneath = subsidiarity +
verifiability (trust math not institutions) + sovereignty (communities set
their own rules) = fits Hearth/Heartwood.
Stage: ideology in formation. NOT for cutting. Resurface whenever the
civic-voting thread is revisited; this is the values layer under it.
```

```
Date: 2026-06-06
Tag: FINANCIAL LEAF - Wealth Strategy <-> Tapit (tamper-evident finance proof)
Summary: Operator: make Wealth Strategy a LEAF you uncover/certify your
financial info from - selectively reveal a financial fact as tamper-evident,
signed, anchored proof. Fits perfectly: finance is just another payload for
Tapit's existing signed/anchored/selectively-disclosed Merkle-leaf primitive
(the disclosure feature already does this for claims). Clean fleet integration:
Wealth Strategy = the finance/onramp surface (SATOSHI.md), Tapit = the proof
surface, the leaf is the bridge.
LOAD-BEARING HONEST CAVEAT: tamper-evident != TRUE. A self-signed financial leaf
proves YOU claimed a fact, at a date, un-altered - NOT that it's true. "I have
$10M" anchored = proof you claimed it, not that you have it. To MEAN "I really
have it" it needs either (a) a real issuer's corroboration (bank/exchange/auditor
signs - the verifiable-credential model + web-of-trust, like a doctor corroborates
a medical record), or (b) cryptographic proof-of-funds (sign a challenge with the
key controlling the coins - Bitcoin-native, genuinely strong, but needs the unbuilt
Bitcoin layer).
Strongest honest versions: (1) "this is MY financial record, certified un-altered
as of a date" - provenance of your own books, honest + buildable NOW (it's the
journal/diary pointed at finance; no truth-claim beyond "mine, unchanged"); (2)
Bitcoin proof-of-funds via signing - north-star.
Other honest limits: financial leaves are high-stakes to reveal (proving a fact =
telling someone that fact) and inherently point-in-time (anchor = "as of", not
"currently" - a balance is stale next week); for regulated gatekeepers
(mortgage/court) a sovereign leaf COMPLEMENTS but won't replace an official bank
letter - strongest in informal/peer/sovereign/Bitcoin-native contexts.
Stage: sprouting. Resurface when scoping any finance/proof surface or the Wealth
Strategy <-> Tapit bridge.
```

```
Date: 2026-06-12
Tag: PROOF-OF-VERIFIED-KNOWLEDGE - a human-attested answer commons that caches reality and corrects AI (the layer under the concierge)
Operator (theorizing, "bounce it," NOT a cut): everybody asks the same AI the
same question over and over ("where do I kayak in the Ozarks of Arkansas") and
we burn compute re-deriving an answer we already know. The QUESTION is the same
for everyone; the VARIATIONS in answers are the difference. Attestations that
build up over time are the PROOF - people went out, tested what the AI said,
verified it, and signed it. "Signed by 3000 people that the first month's
answer was right" means we don't need 3000 bots re-looking-up the same info.
THE CORE INSIGHT (naming it): PROOF-OF-VERIFIED-KNOWLEDGE = a cache for REALITY
with a trust score. It inverts AI economics: today every query costs compute
and yields an UNVERIFIABLE, possibly-stale answer; here the millionth asker of
a settled question pays ~nothing and gets a HUMAN-PROVEN answer. Compute is
spent ONCE to canonicalize the question + draft answer; humans do the verifying
thereafter. It is a VERIFICATION/CURATION layer over AI, not a generation
replacement - it makes AI answers ACCOUNTABLE and fixes the oracle/staleness/
hallucination gap pure LLMs have (no ground-truth feedback loop today).
MAPS ONTO THE EXISTING CHASSIS (why this is in-grain, not sci-fi):
- canonical QUESTION = a stable subject/key (hash of the normalized question;
  curated entry). All phrasings of "where to kayak near Branson" map to ONE id.
- ANSWER = an attestation (a claim).
- VERIFICATION = a proof-of-presence-style signed attestation: "I went, it's
  right" / "wrong, it's actually Y now." Same primitive as the Trailhead
  guest+business co-sign.
- "3000 signed it" = the PROVABLE-AGGREGATE idea (prove N verified without
  naming them) + the aggregate-count idea, applied to answers.
- Bitcoin ANCHORING = freshness is provable ("last verified 3 days ago").
- LOCAL/EXPERT credential = weight: a local's verification outweighs a tourist's
  (Heartwood judge-weight). Ties to vetting credentials.
- PROOF-OF-PRESENCE as the Sybil defense: you can only verify a kayak spot if
  you have an anchored proof you were actually THERE (GPS/time/stamped-photo) -
  this is exactly the stamped-photo + proof-of-presence work, repurposed.
THIS UNIFIES MANY PRIOR THREADS: proof-of-presence (Trailhead), aggregate
counts (demographics), provable aggregates (civic voting), vetting credentials,
verifiable photos. The operator is converging on ONE thesis: a human-verified,
cryptographically-proven, energy-efficient knowledge layer that sits on top of
and CORRECTS AI.
HONEST HARD PARTS (do not gloss):
1. QUESTION CANONICALIZATION is make-or-break and ironically still needs AI -
   but ONCE (cluster phrasings -> one id), which SUPPORTS the energy argument
   (normalize+draft once, humans verify, then it's lookup).
2. ANSWER SUBJECTIVITY + DECAY: "best" depends on skill/season/water-level;
   answers are conditional and go stale (dam release changes). Verifications
   need CONTEXT (when/who/conditions) + EXPIRY + re-verification, not binary
   true/false.
3. SYBIL / ASTROTURF: if 3000 sigs = authority, businesses fake them. Defense =
   web-of-trust + local/expert weight + skin-in-the-game (sign wrong, lose
   verification weight) + proof-of-presence gating (must prove you were there).
4. COLD-START + LONG TAIL: first answer still needs a source (AI draft or local
   expert); popular Qs accrue verifications, obscure ones don't - value
   concentrates where traffic is, which is WHY tourist-towns/concierge is the
   right wedge.
ARCHITECTURE: this is its OWN fleet app on the tapit-attest + wallet substrate
(like Trailhead), NOT wallet code. Wallet = key custody + signing hub; this =
the answer-commons application layer. Possible product surfaces ("parks"/
value-parts): (a) local concierge wedge; (b) a "verified-answer cache" any AI
queries BEFORE recomputing (proof-backed RAG / anti-hallucination oracle);
(c) un-fakeable reviews (every "I used this" is proof-of-presence anchored);
(d) local-expertise reputation/earn (sats for verified answers); (e) time-
sensitive civic truth ("trail open?", "bridge out?", "clinic walk-ins?") that
decays + re-verifies; (f) disaster/off-grid verified info (pairs with BitChat).
Stage: matured thesis / candidate north-star product. Open question to mature:
is the wedge the consumer concierge (asker-facing) or the AI-facing verified-
answer cache (the energy/anti-hallucination API)? Those are different first
customers. Resurface with the Trailhead proof-of-presence work - same primitive.
```

```
Date: 2026-06-12
Tag: VERIFIED-KNOWLEDGE refinement — temporal append-only truth + REPORTER reputation bootstraps NEW info (the hall-monitor / tree-down model)
Operator (continuing the proof-of-verified-knowledge thread, river-hazard
example): on a river page, when a new tree falls there's always a "hall
monitor" ready to report it. KEY MOVES:
1) TEMPORAL / APPEND-ONLY TRUTH (a hash chain, not a mutable cell): a new
   hazard being real NOW does NOT mean the old info was wrong - the old info
   was TRUE FOR ITS WINDOW. New information is its own time-stamped, witnessed
   EVENT. The subject (a given rapid / spot) is a WITNESSED TIMELINE of state
   changes: appeared (confirmed by N) -> still there (re-confirmed) -> cleared
   (confirmed by M). You never overwrite truth; you APPEND a new witnessed link
   to the chain. The history is the value: "deep & dangerous from date X (N
   witnesses) until cleared date Y (M witnesses)."
2) REPORTER REPUTATION BOOTSTRAPS NEW INFO (resolves the cold-start/freshness
   trust gap): brand-new info CANNOT have 3000 confirmations yet - it just
   happened. So how do you trust it before the crowd verifies? You trust it IN
   PROPORTION TO THE REPORTER'S CRYPTOGRAPHICALLY-PROVEN TRACK RECORD - every
   prior time this hall-monitor said "tree down," N people later signed "yes,
   same tree, confirmed." A reporter with a perfect history gets believed
   immediately; "if a shithead brings the info, treat it like a shithead
   brought it." Confirmation is still presence-gated and accrues over hours/
   days; in that gap you act on REPUTATION. This is the missing piece that lets
   the system act on FRESH danger info without waiting for mass verification.
3) THE FLYWHEEL: AI lays the groundwork ONCE - drafts the Merkle tree of
   questions/paths; humans then "light up" the branches they care about, and
   the act of lighting-up REVEALS who is credible (the credible are repeatedly
   right about "the water's high," others aren't). Over time the track record
   proves itself and the system creates value for itself "because a few people
   are nerdy enough to do it" (the Wikipedia / OpenStreetMap dedicated-minority
   bootstrap).
MAPS ON: append-only witnessed chain = the attestation/anchor history already
is this. Reporter reputation = a DERIVED score over a person's history of
later-confirmed attestations (Heartwood judge-weight, and the provable-
aggregate "N confirmed" applied to the reporter, not just the answer).
HONEST NEW RISKS (specific to this refinement):
- REPUTATION FARM-THEN-RUG: build a clean record on easy true reports, then
  cash it in on one high-stakes lie. Mitigations: stake/skin-in-the-game,
  weight by recency + by how costly each past call was, decay, and the fact
  that a rug is itself a permanent signed black mark.
- ASYMMETRY OF DANGER INFO: a false-negative (missing a real hazard) can kill;
  a false-positive (crying wolf) wastes a portage. Reputation must weight these
  differently - over-reporting hazards is cheap-safe, under-reporting is
  catastrophic; the scoring should NOT punish a cautious over-reporter the way
  it punishes a missed hazard.
- SUBJECTIVITY THRESHOLDS: "water's high" is a judgment call with a band;
  domains differ - a navigation hazard is near-binary + presence-verifiable;
  "best restaurant" is taste. The model is strongest on objective, presence-
  checkable, decaying facts (hazards, hours, closures, access) - lead there.
Operator framing: "not trying to solve every problem - make OUR problems easier
and frictionless, provide value through AI and by making AI more efficient so
we don't recompute every time." Stage: matured thesis; this refinement
RESOLVES the cold-start objection. Resurface with Trailhead proof-of-presence
(same verification primitive) + Heartwood (reputation weight).
```

```
Date: 2026-06-14
Tag: STRATEGY - the thesis in one frame, competitive landscape, and where this is going (operator asked "anyone doing this? where's it going?")
THE THESIS IN ONE LINE: sovereign keys + signed attestations + social recovery
+ community-vouched personhood + proof-of-presence + a human-verified knowledge
layer AI can trust — all with the cryptography HIDDEN so ordinary people can use
it. The scarce thing in an AI-flooded world becomes "a certified human hand
verifiably did/saw/vouched this," and the portable cryptographic trail is how
both AI and humans filter for truth. "Proof-of-human as the new PageRank."
WHO'S DOING ADJACENT PIECES (honest legs assessment):
- Social-recovery wallets: Argent / ERC-4337 guardians + recovery DELAY = exactly
  our recall-brake. Proven in Ethereum. (Ours generalizes beyond a chain + a key.)
- Proof-of-personhood: Worldcoin/World (centralized iris orb — opposite of us,
  big money, privacy backlash) vs BrightID / Proof of Humanity / Gitcoin Passport
  (social-graph vouching — our philosophy, modest traction, used for Sybil-
  resistant airdrops/quadratic funding). Personhood is UNSOLVED + contested.
- Sovereign social: Nostr (our transport) — real grassroots momentum, web-of-
  trust filtering experiments; PGP web-of-trust (the OG, died on UX — the exact
  gap our mission names).
- Institutional DID/VC: W3C Verifiable Credentials + EU eIDAS 2.0 / EU Digital
  Identity Wallet (the biggest "legs" — govs mandating wallet-holds-credentials
  by ~2026), Microsoft Entra Verified ID. Issuer-centric (DMV->you), top-down;
  ours is peer/community-attested, bottom-up.
- Provenance / verified-for-AI: C2PA / Content Credentials (Adobe, cameras,
  signed media provenance — adjacent to our stamped-photo proof). Community Notes
  (X/Birdwatch — the most successful community-filtered truth layer at scale, via
  a bridging-consensus algo; NOT cryptographic/sovereign). Prediction markets
  (Polymarket = truth-via-stake).
THE GAP / OUR DIFFERENTIATION: the PIECES have legs separately; NOBODY (that I
know of, cutoff Jan 2026) is executing the integrated full stack — sovereign
keys + social custody + community personhood + proof-of-presence + AI-consumes-
the-proof-trail — packaged with the crypto hidden for normal people. The
integration + the UX-hiding + the verified-knowledge-for-AI angle is largely
unoccupied. Our two hard problems are the shared ones: bootstrapping the
community (the nerdy-few flywheel) and proof-of-personhood (Sybil vs privacy vs
inclusivity trilemma).
WHERE IT'S GOING (bet): four forces converge — (1) AI makes content infinitely
fake -> demand for proof-of-human + provenance spikes; (2) govs normalize
identity wallets (eIDAS); (3) AI AGENTS transacting need verifiable authority +
the human behind them; (4) eroding institutional trust -> appetite for math-
verifiable self-sovereign alternatives. Likely: the top-down DID/VC world and
the bottom-up Nostr/crypto-native world converge, personhood is the contested
keystone, AI is the accelerant/consumer of verified data. WINNER = whoever hides
the crypto best (our UX thesis) and bootstraps a real community first. Risks:
personhood unsolved; regulatory capture by centralized ID; network-effect cold
start; and the deepest — will people adopt sovereignty BEFORE a crisis forces it.
Stage: strategic frame. Resurface when prioritizing the verified-knowledge
product vs the wallet, and when positioning against eIDAS/Worldcoin/Nostr.
```

---

## 2026-06-14 — The Family Hearth / Host-Bot / everyday-engagement layer
Tag: product-direction / family-hub / engagement
Stage: raw insight (sprouting at the edges)
One-line: A warm "jokester / host of the night" layer inside the family wallet
that runs games, asks "how was your day," coordinates the household, and
celebrates milestones — the fluffy, intimate, private everyday gravity that
later carries the serious sovereign payload (secrets, recovery, civic proof).

Operator's framing in his own voice (lightly stitched from the riff):
"I'm having an idea about a family game night taken to a software level — the
family wallet kind of has that interface. It's like the jokester of the night,
plays games and asks people questions and coordinates and keeps the fun alive
inside the chat. If someone doesn't respond we're not gonna shame them — games
and interactions and 'how was your day?' I see that you flagged you had
something great — everybody claps and kisses and hugs. A nice fluffy
interaction for the family wallet that's private and intimate. And then it's
also the beaten-down path later on — the family hub of apps for every single
thing: someone has a dentist appointment, it's all in sync. Everybody has their
personal preferences and their personal bot that interfaces with the family
chat. I'm just coming up with ideas and smudging the ink on the edges of the
leather."

Why it matters (the strategic fit): the 2026-06-14 sovereign-family-nest
landscape research found the single biggest gap is exactly the BEATEN-PATH
fusion — no secure channel / recoverable-secrets store / family-AI-context
rides an app the family already opens every day. Insecure habits win because
iMessage is already open. This host-bot idea is the answer to "why would a
family open Tapit daily?" It is the everyday gravity that makes the rare
high-stakes moment (sign this, hold my secret, prove my membership) land on a
rail the family already trusts and already lives in. The fluffy layer is not a
distraction from the sovereign mission — it is the delivery vehicle for it. It
is also the most natural home for the family-owned AI-context layer (the
per-person bot interfacing with the family chat = family-owned RAG, de-duped,
selectively exposed), which the research flagged as the most open pillar of all.

Concrete sub-pieces worth keeping distinct as this matures:
- Host-bot persona: a warm, non-shaming "host of the night" voice (same
  warm-and-plain register already chosen for the Mycelium copy). Runs prompts,
  games, "how was your day," reacts to milestones.
- No-shame non-response handling: silence is never punished or even surfaced as
  a miss — cessation-as-signal is reserved for the heartbeat/liveness safety
  layer, NOT for everyday engagement. Keep those two uses of "did they respond"
  firewalled so the fun layer never feels like surveillance.
- Milestone showcase: a person flags a good thing; the family claps/hugs/kisses
  (reactions). This is the emotional opposite of the secrets layer and the
  reason people come back.
- Per-person bot ↔ family chat: each member has a personal preferences profile
  + personal bot that interfaces their preferences into the shared family chat
  and into the family-owned AI context. This is the family-AI-context pillar
  wearing a friendly face.
- Family-hub-of-apps sync: dentist appointment, schedules, everything in sync —
  the Cozi/Skylight everyday-coordination surface, but sovereign and
  self-custodied (the research's whole point: that category is crowded but ALL
  cloud-SaaS-the-vendor-can-read, NONE sovereign).

Open questions to resurface (teach-back next session):
- Is the host-bot one shared family persona, or does it speak AS each person's
  personal bot? (Probably both: a shared host + per-person bots, like a game
  show host plus each player's earpiece.)
- Where does the AI brain run for the fluffy layer — same Anthropic edge-fn
  path as the wallet bot, or does the family-owned-context constraint push some
  of it local-first? The research says family-AI-context is the most open and
  most defensible pillar, so getting the ownership boundary right here matters.
- Does the everyday engagement layer ship BEFORE or alongside the secure-channel
  hardening? (The research argues the everyday surface is the wedge, so there's
  a real case for the fluffy layer being an early cut, not a late one.)

Maturation note: this is the same whitespace the deep research named, viewed
from the demand side instead of the security side. Two facets of one body —
keep them growing from the same soil. Resurface when prioritizing the next
big arc (everyday-hub surface vs. continued secrets/recovery hardening).

---

## 2026-06-14 — The Story-Attestation (bot-prompted family oral history as a certified vault entry)
Tag: product-mechanism / family-hub / family-memory / attestation / keystone
Stage: sprouting (a concrete mechanism, not just a vibe)
One-line: The host-bot, reading the family's own teaching/heritage settings,
asks an elder to tell a personal story; the telling is captured, signed as that
person, time-anchored, and locked into the family vault — turning fragile oral
history into sovereign, replayable, verifiable, permanent family memory.

Operator's framing in his own voice (stitched from the riff):
"Say Grandma tells a story because the bot asked her to tell a story about
finances in 1945 — and because I have settings in the family wallet that I want
to teach finance, the stories it asks are personal and help get the family
history out in the open as a teaching mechanism that is being lost today, the
powwow from family member to family member, generation to generation. You come
home after a long hard day, open your phone, and go 'oh look, Grandma told the
story about 1945 and finance, back when it was really hard.' Everyone can draw
from it, and it's also a personal attestation that gets locked into the family
vault memory — it would maybe have died without a story had we not done that. We
can all certify that was Grandma; when we go back and play it again it's the
same file 300 years from now. It's early but there's nothing like it."

Why it's a keystone (not just a feature): this single act fuses every vein of
the family-nest thesis at once — an emotional family moment, a preserved piece
of irreplaceable oral history, a verifiable personal attestation (certified as
the teller, OpenTimestamps-anchored, tamper-evident), a permanent family-vault
entry, and a contribution to the family-owned AI context (the story becomes part
of the family's own selectively-exposed knowledge, teaching the next
generation). Warmth and sovereignty are the SAME act here, not a trade-off —
which is exactly the thesis. See 2026-06-14-the-living-family-nest-thesis.md.

Reuses infrastructure that already exists: the in-app camera + capture pipeline
(capture → normalizeImage → sign → anchor → stamp), the attestation/vault
substrate, and the wallet-bot brain (Anthropic edge fn) for the prompting. The
new piece is the bot-prompts-from-family-settings loop + a story credential_type
+ replay surface. Settings are sovereign and per-family ("I want to teach
finance" drives which stories get asked for).

Generalization: the "powwow" — elder-to-member, generation-to-generation
knowledge transfer eroded by modern life — becomes a first-class, bot-prompted,
attestation-producing ritual. The bot is the patient grandchild who always
remembers to ask; the wallet is the hearth that never forgets the answer.

Prioritization note: strong candidate for an EARLY cut — it's the sharpest point
of the everyday-surface wedge (the research's named whitespace), it viscerally
demonstrates "warmth and sovereignty are one thing," it reuses existing infra,
and it produces something a family does not want to lose. Resurface when the
next big arc is chosen, alongside the family-hearth host-bot idea (same body,
this is its most concrete organ).

Open questions to teach back: voice vs video vs text capture for a story (likely
all three, voice/video richest); how a story credential differs from a journal
entry (probably a typed attestation with teller + prompt + heritage-tag); how
replay + "verify it's still the same Grandma file" surfaces to a non-technical
family member; whether story prompts are scheduled/ambient ("Grandma, tell us
about...") or pulled on demand.

---

## 2026-06-14 — The family-context AI overlay ("double-pass") + the swappable sovereign substrate
Tag: product-mechanism / family-AI-context / sovereignty-stack / anti-deepfake
Stage: sprouting (concrete behavior + a sharp strategic stake)
One-line: The family bot is the SAME generic AI, but run through the family's
own private filter/memory/tree, so it does a "double pass" — answering the
generic question AND folding in what only your family knows — surfacing help no
corporate AI could ever give, on a substrate where the provider, the database,
and the network are all swappable and everything is verifiable from the bottom
up.

Operator's framing in his own voice (stitched from the riff):
"Imagine you're traveling through the US asking a regular ChatGPT or Claude for
directions — it has no context of your family, your history, your heritage. But
ask the family chatbot — same chatbot, with our family filters — and it can say
'hey, you're 35 miles from Aunt Martha's sister's cousin's ranch, you could stay
there tonight.' It's not a generic chat; it's information you'd never ever get
from a chatbot because it never got fed that — but in the moment, with your own
filtered kind, it knows your life, it knows to do the double pass, and the moment
it detects you're traveling and knows where you're asking about, it ties it all
together — layers of your memory and history and family tree — in a place it
would never ever have been on a private company's servers. The regular corporate
market can't solve this without providing these input places. I like it being
bottom-up: I can swap out any AI provider to help me with my body, or any
database to store my stuff, I can do it locally, run my own network, verify
everything, build new software as an independent person and say yeah that's all
true or it's not and show the holes in it — because that's what you'd want, you
want it transparent and people to build on top of the math and the protocol. In
a future where Grandma's story could get converted/faked by AI, you would not
have a trusted leg of verified history to stand on — you'd be stuck out in the
open with your pants down and no underwear on."

The mechanism (double-pass): the bot runs the generic query against whatever AI
provider, AND runs a second pass against the family's own private context (the
vault: memory, history, family tree, story-attestations, preferences). It fuses
the two only on the family's side, never on the provider's servers. Triggering
is contextual — "you're traveling + asking about this place" auto-pulls the
relevant family layers. The provider sees a generic question; the family sees a
family answer. This is the Eyes-Payload pattern at family scale: the family
assembles its own context and hands the model only what it chooses, per query.

Why corporate can't do it (the moat): a centralized AI cannot ethically or
legally hold every family's private heritage graph, and families won't (and
shouldn't) upload it. The only way this exists is bottom-up, family-held,
selectively-exposed — which is precisely Tapit's shape. The value is created by
the input place the corporate market structurally cannot provide.

The swappable sovereign substrate (the deeper sovereignty claim): provider-
agnostic (swap Claude/any model), storage-agnostic (swap DB, or local), network-
agnostic (run your own relay/Mycelium node), and fully verifiable (open math +
open protocol, build on top, prove or disprove it, show the holes). Sovereignty
means no single vendor is load-bearing — the family can replace any layer and
keep its nest. This is the "build on the math, not the company" thesis.

The sharp stake (anti-deepfake history): in a near future where AI can
fabricate Grandma's story convincingly, the ONLY defense is a trusted leg of
cryptographically verified history — signed-as-her, time-anchored, tamper-
evident, the same file forever. Without it you're "out in the open with your
pants down." This reframes the story-attestation keystone as not just sentimental
preservation but as load-bearing INFRASTRUCTURE for truth in an AI-saturated
world — the verified-knowledge-for-AI angle, applied to family memory. Ties
directly to the existing temporal-truth / provenance / verified-knowledge ideas
and the C2PA/Content-Credentials adjacency noted in the landscape research.

Resurface alongside: the living-family-nest thesis, the family-hearth host-bot,
and the story-attestation keystone — same body. This entry is the AI-context
organ + the sovereignty-substrate spine + the why-it-can't-be-faked nerve.
Open question to teach back: does the double-pass run client-side only (max
privacy, the provider never sees family data), or is there a trusted family
relay that does the fusion? (Client-side is the sovereign default; surface the
tradeoff when this becomes a cut.)

---

## 2026-06-14 — Multiple paths down the Merkle forest: typed memory trees + a router (the "double-pass" mechanics)
Tag: architecture / family-AI-context / merkle / selective-disclosure / retrieval
Stage: sprouting (recovering a previously-lost idea + grounding it in real code)
One-line: Don't keep one Merkle tree — keep a FOREST of typed trees (memories,
facts, heritage, places-been, preferences), and a router that decides which
tree(s) and which leaves to walk per query, tying selected leaves down to a
verifiable root while revealing nothing else; the model never traverses
anything — the family-side router selects and hands it only what it chose.

Operator's framing in his own voice (stitched from the riff):
"Explain the mechanisms when Claude decides which tiers of memory and which ones
to tie together down the Merkle root. I've had the idea before that down the
Merkle tree of ideas there could be multiple paths — one might lead down
memories, another down factual or something — where it starts to surface more
than one routine pattern like most models do, multiple paths down for a reason
you'd feed the idea into the model to get a better result. I dumped these ideas
somewhere and have no idea where they got lost. It reinforces my whole thesis
that you need someplace to put all your ideas and dump your things and the
places you've been, all of that is better context later — 'hey don't you
remember you drove right past that on Tuesday March 15.' My specific private AI
knows everything about me and nothing about me when it doesn't need to know
anything about me — privacy lies in the most sovereign way to hold your
information, only yours, only giving away what you have to, when you have to,
when it's most beneficial to yourself, in a way that does not give too much
away."

THE TWO MACHINES (the distinction that makes it buildable):
1. The Merkle tree is the PROOF + PRIVACY machine, and it is DETERMINISTIC — it
   decides nothing. In tapit-attest/src/core/field-tree.ts an attestation's
   claim is a tree of branches+leaves, hashed bottom-up (leafHash/branchHash) to
   one root; every signer signs a digest committing to that root, so changing any
   field at any depth breaks every signature. That's the tamper-evidence.
2. Selective disclosure is the "knows nothing about me when it doesn't need to"
   machine, and it ALSO already ships: disclosureProof reveals ONE leaf plus the
   sibling hashes up the path so a verifier reconstructs the root and checks the
   signature WITHOUT seeing any other leaf; multiDisclosureProof is the pruned
   multi-proof — reveal N chosen leaves, every non-disclosed sibling collapses to
   a single hash no matter how big its subtree. That IS "only give away what you
   have to, in a way that does not give too much away," in working code today.
3. The thing the operator calls "Claude deciding which tiers to tie together" is
   a THIRD machine that does NOT exist yet and is NOT the Merkle tree: a RETRIEVAL
   ROUTER. The model never reaches into memory and never walks the tree — the
   family-side code selects context and hands the model only what it chose (the
   Eyes-Payload pattern, already doctrine in this repo). This keeps the model
   swappable AND deliberately dumb about everything it isn't given — which is the
   sovereignty property, not a limitation.

THE SYNTHESIS (the recovered idea, made concrete): keep a FOREST of typed Merkle
trees instead of one — a memories tree, a facts tree, a heritage/story tree, a
places-been/route-log tree, a preferences tree. The "multiple paths down" are
these typed roots. A router (the double-pass) classifies the query — "this is a
travel question about THIS place" — picks the relevant tree(s), walks to the
relevant leaves, and uses multiDisclosureProof to tie exactly those leaves down
to a verifiable root, feeding the model that pruned bundle and nothing else. So
"you're 35 miles from Aunt Martha's ranch" comes from walking the family/places
trees, disclosing only the ranch leaf + its proof, while the birthday, the SSN,
and every other leaf stay collapsed to hashes the model never sees. Same model,
two passes (generic + family-context), fusion on the family's side, provable
provenance on every fact it surfaced.

WHY IT REINFORCES THE THESIS: the value of "don't you remember you drove past
that on March 15" only exists if there's a sovereign place to have dumped March
15 in the first place — the lost-idea problem is the product problem. And the
proof layer is what lets a future AI-fakes-everything world still trust the
recall: every surfaced memory carries a disclosure proof, so the family AI's
context is not just private, it's VERIFIABLE — facts the model states about your
life can be checked against signed, anchored leaves rather than hallucinated.

Open questions to teach back: does the router run fully client-side (max
sovereignty, provider never sees family data)? how are trees typed/namespaced —
by credential_type, by tier, by a new "memory kind"? does every dumped idea/
place become an attestation (signed+anchored) or a lighter local note that can
be PROMOTED to an attestation when it matters? what's the UX for "dump anything
here" that's frictionless enough to actually capture March 15? Resurface with
the living-family-nest thesis + double-pass overlay + story-attestation — same
body; this entry is its retrieval-and-proof nervous system.

---

## 2026-06-14 — Ownership vs custody of AI memory + the compromise-gated sovereign AI + the cloud-API boundary
Tag: sovereignty / family-AI-context / threat-model / data-ownership / integrity-gate
Stage: sprouting (clarifying the threat model + a sharp new feature: if-hacked-it-stops)
One-line: Commercial AI gives you a COPY of your memory on request but keeps
CUSTODY on its servers forever; the sovereign model inverts it — you hold the
living memory, the provider gets only a minimized disclosed snippet per query,
nothing is retained provider-side as YOUR identity graph, the model is swappable,
and the wallet can GATE disclosure so a detected compromise makes the AI refuse
to answer until the family restores the rightful state — by design, not a bug.

Operator's framing in his own voice (stitched from the riff):
"My wife's ChatGPT knows everything about her — medical history, everything she's
ever asked, in a file under that device and that account. The moment she leaves,
does she get to take all of that with her, or is it owned only by them? I don't
think they'd be kind about handing it over. She could ask for a dump, but she'd
have to constantly do that. Imagine having your own place where all your queries
show up for the next 20 years and you're not double-retrieving and double-
thinking — 'we've talked about this before, we're gonna do this structure,' not
asking a new chat the same thing every time. There's memory but there's not
PERSONAL memory. And verification right up front: if the math is off, reject
answering — tied into the Tapit social wallet, so if you've been hacked it quits
answering questions and quits extracting information and won't work until you get
everything back online the way it should be — that's by design, not a bug. How
does it get breached when you send pieces to a cloud API to process? Is it
keeping a log of those people and memories and API addresses, or is it just
answering the simple question and logging it down, and the person keeps the file
that's been rewritten over? I feel like there's nothing being built for the
sovereign family and sovereign people who want to carry all their information
forward in their own shape and form."

THE ANGLES, ANSWERED HONESTLY:
1. Ownership vs custody (the core distinction). Consumer ChatGPT/Claude memory +
   chat history live on the PROVIDER'S servers, bound to the account. You can
   EXPORT a copy (data dump), but that's a snapshot you take, not custody you
   hold — the provider keeps the canonical copy, controls the account, sets the
   terms, and can change them. "Take it with her" = she gets a zip, not the
   living thing; they keep theirs. Sovereign inverts it: the canonical living
   memory is hers, on her device/wallet; any provider only ever borrows a slice.
2. Where it lives. Today: provider cloud. Sovereign: the family vault (local-
   first, encrypted to each member's wallet, synced as ciphertext only — the
   host stores only ciphertext, the existing Tapit model).
3. Personal vs "memory feature." Provider memory is a summarized, provider-shaped,
   provider-owned convenience that can be wiped/changed and isn't portable as a
   structure. Personal memory = the typed Merkle forest the family owns, append-
   only, verifiable, 20-year, no re-asking ("we've talked about this before").
4. Compromise-gated disclosure (NEW FEATURE, sharp). Tie the AI-context router to
   the social-wallet integrity state: if the wallet's heartbeat/recall machinery
   (B-2 + recall brake) signals a compromise, the disclosure layer REFUSES — the
   AI stops surfacing memory and stops extracting until the family restores the
   rightful state via social recovery. Failure mode is "clam up," not "leak." By
   design. This is the threat-model answer to "what if she/I get hacked" and it
   reuses machinery we already speced.
5. THE HONEST BOUNDARY (don't oversell). When you send plaintext to a cloud model
   to reason over it, that provider SEES that plaintext while processing — there's
   no way to have a remote model reason over text it can't read short of exotic
   confidential-compute/FHE. So sovereignty here is NOT "the cloud never sees
   anything." It is: (a) MINIMIZE — send only the one disclosed leaf the query
   needs (selective disclosure already minimizes the crossing), never the whole
   tree/identity graph; (b) DE-IDENTIFY — the snippet carries the fact, not who
   it's about, where possible; (c) TERMS — use API tiers (not consumer) where
   inputs aren't trained on and retention is short/zero (Anthropic/OpenAI API
   default to no-training + limited retention, vs consumer which may train unless
   opted out; and note the 2025 court-ordered retention of OpenAI logs proved
   "deleted" isn't always deleted when litigation intervenes — a real sovereignty
   argument); (d) SWAPPABLE — no single provider accumulates a picture; (e)
   LOCAL-WHERE-POSSIBLE — run small models locally for the sensitive passes,
   cloud only for the heavy generic pass. The provider answers the narrow
   question and the canonical rewritten file stays with the family.
6. "Does it keep a log of people/memories/API addresses?" Consumer: effectively
   yes (that's the product). Properly-configured API: inputs/outputs aren't added
   to YOUR persistent profile and aren't trained on by default, but the provider
   still processes (and may briefly retain for abuse monitoring) the snippet you
   sent — so the defense is sending as little as possible, de-identified, under
   no-train/short-retention terms. The family's canonical log lives ONLY in the
   family vault.

WHY IT REINFORCES THE THESIS: the gap is real — nothing is built for the
sovereign family that wants to carry ALL its information forward in its own shape,
owning custody (not just export rights), with verifiable personal memory, a
compromise-gated AI that fails safe, and a minimized swappable boundary to any
cloud brain. Resurface with: living-family-nest thesis, double-pass overlay,
typed-Merkle-forest router, story-attestation. This entry is the threat-model +
data-ownership spine. Open question to teach back: how much of the sensitive pass
can run on a local small model so the cloud only ever sees the de-identified
generic pass?

---

## 2026-06-14 — Multi-perspective co-signed memory attestations + safety-first disclosure guardrail + redundant family-key-gated backup
Tag: product-mechanism / family-memory / web-of-trust / selective-disclosure / backup / personhood-comparison
Stage: sprouting (several concrete mechanisms + a strategic comparison)
One-line: "Fill-in-the-book" but live and sovereign — the bot interviews each
member, extracts their version of a shared memory, and the family CO-SIGNS it
(Mom surfaces the Disney 2009 trip, Dad signs, kids sign), so corroboration
across perspectives gives the memory WEIGHT; honestly marked as recalled-now-
about-then (not forged-as-then); disclosed selectively to medical/trip/music AIs
with a safety-first guardrail that clearly warns before anything sensitive
crosses; redundantly backed up as family-key-gated encrypted blobs to any number
of clouds nobody but the family can unlock.

Operator's framing in his own voice (stitched from the riff):
"Everybody has their own wallet and their own bot is the interface of the wallet.
We're playing a game — the family bot — and Mom fills in a whole questionnaire of
Mom questions, the deeper scientific ones, and it extracts the stories of when
they were younger and makes actual attestations of the way SHE remembers it and
the way I remember it — like the fill-out book where someone reads the stories
later, but the wallet's involved and an AI bot converses and pulls out the
stories and choreographs the family to tell stories about the children, and the
children tell how they remembered things, and those memories get backfilled. Mom
surfaces something, Dad signs it, the kids sign it, and it ends up a memory
attestation of the Walt Disney trip in 2009. Anyone signing up for the future
has a permanent record that wouldn't have to be backdated, but we'd have a
backdated version able to do — resurfaced slowly over time, the history fills in.
Later someone can't retell your history if you went through the trouble to put it
into personal attestations; if someone tried to disagree you'd have a leg to
stand on, and the more it intertwines the more weight it has. It's still your own
sovereign store you can disclose to medical places or AI bots for better trip
instructions with all your prerequisites, or music that already knows your tops —
you wouldn't have time to tell ChatGPT that, and do you even want it knowing
everything about you? When it's something super sensitive, you're warned clearly
by your protection guardrails — we always feel safe with being safe, not
explorer in that moment. And ways to put it to your personal server or plug in
any AWS backup, two AWS backups, data encrypted to blobs, a secret only the
family can unlock — redundant backup you can always come back to but no one else
can unlock because it's privy only to your family and your family keys being
green."

THE MECHANISMS (new, concrete):
1. Multi-perspective co-signed memory attestation. One shared event → multiple
   first-person tellings, each a leaf/attestation, optionally co-signed by other
   members who corroborate. This is web-of-trust applied to MEMORY: weight =
   number + closeness of corroborating signers. Reuses cosigning/mergeSignatures
   (already built). The Disney-2009 entry is a claim with per-member sub-claims
   + a co-signature set.
2. Honestly-marked backdating (anti-fraud, critical). The attestation is created
   NOW about a PAST event. NEVER forge the timestamp. The honest shape: issuedAt
   = now (OpenTimestamps anchors that it existed by now), plus a claimed
   event-date field ("about 2009") that is explicitly a recollection, not a
   contemporaneous proof. So the leg-to-stand-on is "as of today the family
   agrees this is how it happened," which strengthens over time as more sign — it
   is NOT a false claim that the record existed in 2009. Get this boundary right
   or the whole trust model rots.
3. The fill-the-book interview loop. Bot-choreographed questionnaire (the
   "deeper scientific Mom questions"), drip-resurfaced slowly over time so
   history backfills gradually rather than as a chore. Extends host-bot +
   story-attestation. suggested-questions feature (dormant) is the seed.
4. Safety-first disclosure guardrail. Before anything sensitive crosses the
   boundary to a medical/trip/music AI, the user is clearly warned by their own
   side's guardrail — default to SAFE, not exploratory, in that moment. UX layer
   on top of the selective-disclosure router. "We always feel safe with being
   safe."
5. Redundant family-key-gated backup (IS possible, grounded in our model). Data
   is encrypted client-side to a family secret; ciphertext blobs can be written
   to ANY number of destinations (personal server, two+ S3 buckets, etc.) — the
   host never holds plaintext (already our ciphertext-only model). Unlock requires
   family cooperation / quorum (Shamir among family keys — "family keys being
   green"). Redundant + sovereign + nobody-else-can-open. This is an extension of
   the existing snapshot/backup model to multi-destination + family-quorum unlock.

THE COMPARISON (operator's actual question — Worldcoin et al. vs this):
They are NOT close, and they're solving a DIFFERENT layer with the OPPOSITE
adoption vector. Worldcoin/World (centralized iris biometric), BrightID / Proof
of Humanity / Gitcoin Passport (social-graph personhood), eIDAS / W3C VC
(institution-issued credentials) are all PROOF-OF-PERSONHOOD / identity-RAIL
infrastructure — they answer "is this a unique real human / is this credential
valid," top-down or token-incentivized, with NO everyday use case pulling
adoption (Worldcoin literally pays people to scan eyes because there's no organic
reason to). This nest is the OPPOSITE vector: use-case-first, adoption-through-
warmth — the calculator-handed-people-math thesis. The family memory/disclosure
use case is the DAILY reason to show up that personhood projects structurally
lack. They could be COMPLEMENTARY (a personhood primitive the nest optionally
consumes for Sybil-resistance at civic scale) but they are philosophically
adverse (centralized biometric vs bottom-up sovereign social) and they do not
touch the family-everyday-hub use case at all. Adoption probability favors the
use-case-driven approach: people adopt a thing they want to open, not an identity
rail they're told to join. This is the strongest argument that the nest's wedge
is the warmth/use case, and personhood is a far-future optional input, not the
product.

Resurface with: master-synthesis-and-build-plan, living-family-nest thesis,
double-pass overlay, typed-Merkle-forest router. Open question to teach back: for
co-signed memories, what's the minimum corroboration that gives a memory
"weight," and how is that weight shown to a non-technical family member without
turning remembering into paperwork?

---

## 2026-06-14 — The "useful for me first" principle (single-player floor, community ceiling) + the 37-point-game legacy frame
Tag: product-principle / mission-sharpening / family-memory / legacy / adoption
Stage: matured (this is a refinement of the core value prop, not just a feature)
One-line: The value floor is SINGLE-PLAYER and self-sovereign — kept whole,
unchanged, mine, useful to me even if no one else ever verifies it; verification,
community co-signature, and civic scale are the CEILING that adds weight on top,
never the precondition. Same everyday life, different storage: the family snaps
the pictures they always snapped — what changes is WHERE and HOW it's kept.

Operator's framing in his own voice (stitched from the riff):
"Five years ago — 25 years ago — I played basketball in a very small town,
scored 37 points against good opponents, the whole town was there cheering, it
was a milestone in my life. That's very hard to go back and read now — newspaper
articles somewhere, my grandma kept a bunch — but short of collecting all that
into one place, there's no place where the family interacted with the community
in a way that also corroborates your story, where the whole town signs that you
had a 37-point game, thanks you for playing hard, congratulates you on a good
season, and you can go back 25 years later and read all of it in your OWN storage
— never logging back into Google or a player portal or any weird place. The
family did their normal everyday life, snapped the pictures they always snapped —
but WHERE and HOW they stored it is what changes. I've taken pictures at kids'
ball games my whole life; I can maybe find them, but they're not tied to any
event, not tied to the moment the bot asked 'say a few words about how proud you
are of your son.' It'd be so nice to go back and say yep, that's the file, it's
there, it's not changed, and I read it and I cry all over again because it's
preserved and I can share it later — and whether it's verifiable or not, it's
still mine, I kept it whole and unchanged, useful to me at the very least. I
don't have to prove it to anyone. But it guarantees I was the one who put it
there, because no one else has my key and why else would I have put it there. And
to rehash and re-remember it, and maybe share with my great-great-great-
grandchildren someday after I'm gone — stories told and stored in such a way they
can be verified that he did that on that day, all hashed together. Make it useful
for ME first, because I'm an old fart who'll die someday and I'd love to leave a
legacy if nothing else — and everybody would, whether it's their barbecue
recipes or proprietary carpentry information or financial principles to pass
down, and the powwow, sitting with the elder of the tribe and learning through
osmosis."

THE PRINCIPLE (mission-level, lock it in):
- SINGLE-PLAYER FLOOR. The product must be fully worth it for ONE person with
  ZERO other participants and ZERO external verification. Kept-whole-and-unchanged
  + mine + re-readable is the floor. This de-risks the cold-start problem
  completely: there is no empty-network dead zone, because day-one solo use
  already delivers. (Directly echoes CLAUDE.md: "if it only ever works for one
  family it already succeeded" — this is the single-person version of that.)
- SELF-ATTESTATION IS SUFFICIENT at the floor. "No one else has my key and why
  else would I have put it there" — your own signature + your own anchored
  timestamp already guarantees authorship and integrity to YOU. External
  verification is not required for the memory to be trustworthy to its owner.
- COMMUNITY CEILING adds WEIGHT, not validity-from-zero. The town co-signing the
  37-point game, the family co-signing the Disney trip — these stack corroboration
  on top of an already-valuable self-kept record. Weight grows with intertwining;
  it never gates the base value.
- SAME LIFE, DIFFERENT STORAGE (the wedge, restated cleanest). Don't ask families
  to change behavior — they already snap the photos, already tell the stories.
  Change only the substrate: where/how it's stored (sovereign, whole, unchanged,
  tied to event+feeling, no third-party portal to log back into). This is the
  lowest-friction adoption path there is.
- LEGACY AS THE UNIVERSAL DRIVER. Everyone has something to pass down — recipes,
  trade knowledge, financial principles, the powwow/osmosis transfer. "Leave a
  legacy if nothing else" is a near-universal motive; it's the emotional engine
  under the whole nest, and it's strongest precisely for the elders whose
  knowledge is most at risk of dying unrecorded.

PRODUCT CONSEQUENCES:
- Phase 1/2 (dump surface + story/memory attestation) deliver the single-player
  floor with NO network and NO cloud AI — confirming the build-plan sequencing.
- Photos must be tie-able to an EVENT + a FELT NOTE (bot-prompted "say a few
  words"), not loose in a roll — the difference between a camera roll and a
  legacy is the context+feeling bound to the moment, signed and anchored.
- "Read it and cry all over again" = replay/re-surface UX is a first-class
  feature, not an afterthought; the resurfacing IS part of the value.
- Verification is presented as a BONUS layer ("and it's even provable"), never as
  the reason to participate — keeps the honesty and lowers the bar.

Resurface with: master-synthesis-and-build-plan (this locks the single-player-
floor rationale under Phase 1/2 sequencing), living-family-nest thesis, co-signed
memories. Open question to teach back: what's the very first single-player thing a
person captures on day one that makes them feel the "that's mine, whole, and it'll
outlive me" feeling immediately?

---

## 2026-06-14 — "Sign the ball" (the wall-in-time) + cross-generational calendar/close-the-loop + own-first-syndicate-optionally (anti-Facebook-lock-in)
Tag: product-metaphor / family-coordination / co-signed-memory / strategy / interop
Stage: sprouting (a naming metaphor + a coordination loop + a strategic principle)
One-line: A shared calendar across generations closes the loop into co-signed
memories — you see the grandkid's ball game, you go, you snap the picture and
attest "he hit two home runs, here's how proud I am," it lands on your timeline
AND his, and others add "I saw the three home runs, so proud" — everyone signs
the ball, and you get to read the ball for 30-50 years; you OWN it first and can
still optionally syndicate the non-sensitive parts to Facebook, instead of being
locked in BECAUSE your memories are trapped there.

Operator's framing in his own voice (stitched from the riff):
"Anybody in the family can sync their calendars or other things. As my kids get
older and have their own kids and birthday parties, they're still my family — I'm
going to every one of their kids' birthday parties — so they sync their calendars
to mine and let me know when the ball games are. That exists today but not in a
family interface, and not where we close the loop later with a picture and an
attestation that I went to my grandson's ball game and he hit two home runs, and
I said how proud I was, and it goes on mine and it goes on his — just another
layer of memory that comes around later in life, instead of Facebook owning it.
I've seen so many people stay on Facebook because their memories are there —
Facebook literally owns what they say and how they say it. You could still choose
to share some of your Tapit attestations on Facebook that don't violate their
terms, because they have sharing down and that's great — but it doesn't stop us
having it for our own personal memories and records and proofs, where other
people can go inside those same proofs and say 'I saw the three home runs, I'm
super proud of you.' It's like a wall in time where everyone got to sign the ball
and you get to read the ball for the next 30-50 years of all those endearing
messages you don't want to lose because the ball got lost."

THE MECHANISMS / PRINCIPLES (new):
1. "SIGN THE BALL" — the emotional, plain-language name for the co-signed memory
   attestation. A memory is a ball everyone who was there gets to sign; the
   signatures are warm messages ("so proud, saw the three home runs"), not crypto
   jargon; you re-read the ball for decades; the digital ball can NEVER get lost
   (the physical one always does). Use this as the USER-FACING metaphor for
   co-signing — it removes all the cryptographic framing and makes signing feel
   like signing a keepsake. Strong candidate product name/metaphor for the
   co-sign UX.
2. CROSS-GENERATIONAL CALENDAR / COORDINATION. Family members sync calendars
   (and more) across households and generations — grandparent sees the grandkid's
   ball games and birthday parties. Coordination exists elsewhere (Cozi/Google)
   but NOT in a sovereign family interface AND not wired to close the loop into
   memory. This is the everyday-utility hook (the dentist-appointment-in-sync
   thread from the host-bot idea) with a memory payoff.
3. CLOSE-THE-LOOP (event -> memory). The calendar event is the front of the loop;
   attending + capturing + attesting + felt-note is the back. A scheduled game
   becomes, afterward, a co-signed memory that lands on MULTIPLE timelines (mine
   AND his) and accretes signers over time. The loop turns coordination into
   legacy automatically — the bot can even prompt the close ("you went to the
   game yesterday — want to sign the ball?").
4. OWN-FIRST, SYNDICATE-OPTIONALLY (strategy — don't fight the incumbent head-on).
   The lock-in that keeps people on Facebook IS that their memories are trapped
   there and Facebook owns the words. Tapit's answer is NOT "leave Facebook" — it
   is "OWN your memory in your sovereign store first, then optionally push the
   non-sensitive parts out to Facebook (or anywhere) as a syndication target."
   Facebook becomes an output channel, not the vault. This is the
   interoperate-don't-compete wedge: we win on ownership, they keep distribution,
   and the user stops being hostage. Lowers adoption resistance (no "abandon your
   network" ask) and reframes the moat as custody, not reach.

PRODUCT CONSEQUENCES:
- The co-sign UX should literally feel like signing a ball / a yearbook / a
  guestbook — warm messages, faces, no crypto words (extends the warm-and-plain
  peerCopy voice already shipped).
- A memory attestation must be able to land on MULTIPLE owners' timelines and
  accrete co-signs over time (multi-owner reference + append-only co-signature
  set; builds on cosigning).
- A share/syndication-out adapter (to Facebook/etc.) is a real roadmap item, but
  AFTER the sovereign store exists — own first, then syndicate. Honesty: only
  non-sensitive, user-chosen leaves go out (ties to the safety-first disclosure
  guardrail).
- Calendar sync is a candidate everyday-utility feature for the host-bot phase
  (Phase 5) but its real value is the close-the-loop into memory, so design them
  together.

Resurface with: master-synthesis-and-build-plan, co-signed memories, useful-for-
me-first principle, living-family-nest thesis. Open question to teach back: is
"sign the ball" the name for the whole co-sign feature, and what does the ball
look like on screen so a kid AND a grandparent both instantly get it?

---

## 2026-06-14 — REFINEMENT: the EVENT is the unit (adaptive signable surface) + the verify-badge growth engine + aggregate-your-own-history
Tag: product-metaphor / naming / growth / retrieval / strategy
Stage: maturing (refines the 2026-06-14 "sign the ball" entry — that's substrate;
this generalizes it)
One-line: "Sign the ball" is too narrow — the real unit is the EVENT (a million
kinds: game, 16th birthday, prom, recital), and the signable surface adapts to
each (ball / birthday card / etc.); syndicated posts carry a tap-to-verify Tapit
badge that propagates ownership contagiously ("that guy OWNS his prom pictures,
not just on his camera roll"); and later your bot can aggregate your own history
("give me all my 37-point games and above") and filter the sappy comments.

Operator's framing in his own voice (stitched from the riff):
"'Sign the ball' might be too specific — one event is a sports game, another is a
16th birthday party that has nothing to do with a ball, that'd be signing the
birthday card. It's more about the event being different, and there are a million
events and I've been to all of them because I have four kids — birthday parties,
proms, every single thing, and Facebook owns them all. Doesn't mean you can't
post to Facebook — right out of the wallet we've got it formatted to give to
Facebook on a silver platter, and all we ask is it has a little Tapit sign at the
top that shows it could be verified if you tap on it and go to the verification.
It propagates out, and everybody who sees it is like 'you went to the prom, no
big deal — oh, that guy OWNS his prom pictures, that's cool, not just on his
camera roll, wow,' and then grandma and grandpa sign and tag the kid, the kid
says quit it, you get the idea. It becomes an event, life moves to the next
event, the old one dials out, no one's signing it new, it becomes history you can
go back and see. And maybe later your bot — 'give me all my 37-point games and
above' — goes and finds all your attestations where you scored a bunch, and you
aggregate your best comments, the sappy ones, a filtration of comments from that
day. Sure there are files, but are we using them in a manner best for the USER,
or is it corporate rent-seeking at every level just trying to make money? Let's
make stuff humans really want and want to empower themselves with and use every
day ALONGSIDE the corporate ones — we're not trying to replace, but we are trying
to find that wedge."

THE REFINEMENTS (supersede/extend "sign the ball"):
1. THE EVENT IS THE UNIT. The core object is an EVENT (game, birthday, prom,
   recital, trip, graduation...). "Sign the ball" is ONE event-type's skin. The
   signable surface is ADAPTIVE per event type — ball for a game, birthday card
   for a birthday, etc. Naming: lead with the event; let the signable-keepsake
   metaphor shape-shift to the occasion. Don't lock the whole feature to a sports
   word.
2. THE VERIFY-BADGE GROWTH ENGINE (key new mechanism). The wallet exports a
   post-ready, silver-platter-formatted version for Facebook/etc. carrying a small
   Tapit badge at top: "verifiable — tap to check." On the incumbent platform the
   badge is a curiosity + status signal ("he OWNS these, not just a camera roll")
   that propagates organically and pulls viewers back toward Tapit. This turns the
   syndication channel into an ACQUISITION channel — the moat (ownership) becomes
   visible and enviable exactly where the crowd already is. Honest constraint: the
   badge links to a verification view; only user-chosen, non-sensitive content is
   ever exported (safety-first guardrail).
3. EVENT LIFECYCLE (hot -> cools -> history). An event is hot while people sign it,
   then naturally dials out as life moves on, then becomes searchable history.
   Design for the cool-down: no pressure to keep engagement up (no shame, no
   re-ping), the value is the permanent record, not sustained attention. This is
   the ANTI-engagement-farming stance restated — opposite of Facebook's infinite
   re-surfacing for ad time.
4. AGGREGATE-YOUR-OWN-HISTORY (bot as personal query engine). "Give me all my
   37-point games and above," "aggregate my best/sappiest comments from that day."
   The bot queries YOUR OWN attestation corpus (the typed Merkle forest) and
   filters/aggregates — retrieval over a life, not a feed someone else ranks. Ties
   directly to the double-pass router + typed-forest; this is the single-player
   payoff of having dumped it all in one sovereign place.
5. USE-ALONGSIDE, NOT REPLACE (wedge restated). Not a Facebook killer. A tool
   humans use EVERY DAY alongside the corporate ones, that empowers them and isn't
   rent-seeking. The wedge is "best for the user" vs "corporate rent-seeking at
   every level." Interop (silver-platter export + badge) is the bridge, ownership
   is the wedge.

PRODUCT CONSEQUENCES:
- Model the core object as EVENT with a type; the co-sign UI picks the signable-
  surface skin from the type. Extensible event-type registry.
- Build a syndication-export that produces a clean post + a verify badge/link;
  verification view is public-readable for a single shared attestation.
- Bot retrieval/aggregation over the owner's own corpus is a first-class
  single-player feature (Phase 3 router, but the query-your-own-life angle can
  precede full double-pass).
- Keep the no-engagement-farming stance explicit in the event lifecycle (cool-down
  is fine, no re-ping pressure).

Resurface with: "sign the ball" entry (its parent), master-synthesis-and-build-
plan, useful-for-me-first, double-pass/typed-forest. Open question to teach back:
what's the small set of launch event-types (game/birthday/trip/graduation?) and
does each need its own signable-surface skin on day one or does one generic
"sign the moment" surface ship first?

---

## 2026-06-14 — AI-generated card/invitation IS the attestation + a card-design marketplace + backfill physical cards + memory accretion
Tag: monetization / product-mechanism / family-memory / marketplace / creative
Stage: sprouting (a monetization surface + memory-accretion model)
One-line: The bot whips up a personalized invitation/card on demand (blue and
black, for Nathaniel's birthday) that IS the attestation you send to other
families; you can buy the platform card (~$4.99) or a third-party designer's card
via an API marketplace; photograph a physical Walmart card to backfill old
birthdays; and a single event accretes MANY memories over time (one card now, a
corroborating photo later, sometimes 100 photos + many voices) — past and future
entries all converging on "the way we remember it."

Operator's framing in his own voice (stitched from the riff):
"Imagine your chatbot could whip that up on demand as part of your subscription —
'Nathaniel's having a birthday party tomorrow, make an invitation I'll send to
other families, and it'll also be the attestation, make it personable, blue and
black.' They go through it and maybe buy the card from the platform for $4.99
after they love it, or buy a third-party one someone designed and made available
by API. We buy physical cards like crazy — why would people not buy digital cards
to save forever? Even take a picture of a regular card and add it in — the face
of the birthday card you bought at Walmart becomes how you backfill; you put old
cards in for those birthdays, and maybe that's the only standing memory you have
of that birthday, or later you find something else that corroborates the same
birthday and now you have two memories for it. Some memories may have 100 photos
and different people who said things — ideas through time, some past, some future,
all the same thing looking forward: the way we remember it and the stuff we chose
to log down to pass down in a way never possible before. It was only through
retelling stories; now we can coherently digitally do it — as long as it's not
just on a company, because once we die and stop logging in, they just throw our
stuff away and nobody ever reads it again."

THE MECHANISMS (new):
1. CARD/INVITATION-AS-ATTESTATION. The bot generates a personalized card or
   invitation (occasion + style prompt: "blue and black, personable") that is
   simultaneously (a) a thing you send out to other families and (b) the signed
   attestation that seeds the event's memory. Creation and memory are one act —
   sending the invite already plants the event in the vault.
2. CARD MARKETPLACE (monetization, MONETIZABLE feature). Buy the platform's
   generated card (~$4.99), OR buy a third-party designer's template exposed via
   an API marketplace and use it instead. A creative ecosystem: designers publish
   card/keepsake templates, families buy them, platform takes a cut. This is a
   clean paid-tier + marketplace revenue line that doesn't compromise sovereignty
   (you're buying a SKIN; the attestation underneath is still yours).
3. BACKFILL VIA PHOTOGRAPHED PHYSICAL CARDS. Snap the Walmart birthday card's
   face and add it as the keepsake for an old birthday — the bridge that lets a
   lifetime of pre-Tapit memories enter the vault. Reuses the camera+capture+sign
   pipeline. Honestly-marked backdating applies (created now, about then).
4. MEMORY ACCRETION (one event -> many entries over time). An event isn't a
   single record; it accretes — one card now, a corroborating photo years later,
   sometimes dozens of photos and many co-signers. Past-dated backfills and
   future additions both attach to the same event. The model must support an
   event as a growing CLUSTER of attestations (multi-entry, multi-owner,
   multi-time), not a single row.
5. WHY DIGITAL-FOREVER BEATS PHYSICAL (the pitch). People already spend freely on
   physical cards that fade and get lost; a digital card that's owned, whole,
   verifiable, and outlives you is strictly more valuable AND the same buying
   habit already exists — low resistance monetization.

STRATEGIC NOTE (the death argument, restated sharply): the entire value
evaporates if it lives on a company's servers, because the day you die and stop
logging in, they throw it away and no one reads it again. Sovereign custody is
the ONLY substrate on which a multi-generation legacy can actually survive. This
is the non-negotiable that separates Tapit from every cloud card/memory product.

Resurface with: master-synthesis-and-build-plan (add a monetization line: card
marketplace), event-as-unit refinement, useful-for-me-first, co-signed memories.
Open question to teach back: is the card marketplace an early monetization hook
(drives the creative-event use case) or a later add-on after the free
sovereign-memory floor proves itself?

---

## 2026-06-14 — Sovereign genealogy: own your family-history proofs (anti-rent-seeking) + a mergeable hash-file family tree + fire/flood/theft resilience
Tag: domain-extension / family-tree / genealogy / web-of-trust / anti-rent-seeking / resilience
Stage: sprouting (a new domain the nest extends into, on existing rails)
One-line: Families OWN their own genealogy — snap the courthouse records and the
research someone already paid for, anchor the hashes so they're tamper-evident,
and build a mergeable family tree where you can "tag onto" a relative's branch and
inherit the value they captured — believed-by-our-family is the floor,
corroboration adds weight, and nothing is lost to fire/flood/theft or to a
$199/yr subscription you stop paying.

Operator's framing in his own voice (stitched from the riff):
"How does this tie back into genealogy — going back and snapping photos of the
research you've done, or the work. A lot of companies you pay money to do the
research or access their databases; the family could start to adopt their OWN
sovereign idea of their family instead of trusting it to genealogy.com for $199 a
year or you lose your family 'certification.' The rent-seeking idea — families
would own their own proofs and the work people paid for independently. It doesn't
need to be provable to everyone else, but it's passed down and believed by our
family good enough that we want to pass it to our kids and grandkids. Records will
be better for the newer digital-age people, but going back to fill in anyone's
history — 'oh, he's my uncle, I can tag onto that genealogy' — ends up being free
because you tag onto the value someone else captured by paying a service, and you
hitch that ride; either it's true and you believe it or it's not and you don't,
that's not for anyone else to decide, but if it's enough for you it's enough for
you, and the more weight it has the better. You believe Uncle Joe did the work,
you see the pictures and files didn't change, they were from some courthouse 300-
400 miles away, and they're hash-filed on the blockchain — hard to refute, not
that you can say it's 100% accurate. I wonder how genealogy ties into the whole
hash-file family-tree attestations and backfilling data to the best of our
ability and not losing data to fires and theft and water."

THE MECHANISMS (how it ties to existing rails):
1. OWN-YOUR-PROOFS (anti-rent-seeking, the strategic core). Genealogy services
   ($199/yr Ancestry/genealogy.com-style) capture research you pay for but you
   don't OWN — stop paying and you lose access to your own family's records. The
   sovereign inversion: snap the courthouse record / the paid research / the
   physical document, sign + anchor it, and it's YOURS forever, custody not rental.
   Same own-first principle as memories, applied to lineage. Strong wedge: people
   already pay for genealogy, so the buying habit exists; we change ownership, not
   behavior.
2. ANCHORED = HARD-TO-REFUTE (honest framing). We do NOT store the photo on a
   blockchain — we anchor its HASH via OpenTimestamps to Bitcoin (already shipped:
   anchoring feature), proving the file existed UNCHANGED by a given date. So the
   courthouse-record-from-300-miles-away is tamper-evident and time-proven —
   "hard to refute," NOT "certified 100% accurate." Get this honest distinction
   right: anchoring proves integrity + existence-by-date, not truth of contents.
3. BELIEF FLOOR, WEIGHT CEILING (same as co-signed memories). A genealogy claim
   doesn't need universal proof — "believed by our family good enough to pass
   down" is the floor; corroboration (Uncle Joe's courthouse photo, a second
   relative's record, a co-sign) adds weight. Not for anyone else to adjudicate;
   if it's enough for you, it's enough. This is the useful-for-me-first principle
   in the lineage domain.
4. MERGEABLE / TAG-ONTO FAMILY TREE (web-of-trust genealogy). "He's my uncle, I
   can tag onto that genealogy" — branches connect; you inherit (hitch a ride on)
   the value a relative already captured, for free. The tree is a shared graph of
   attestations where verified branches link and corroboration accretes across
   households and generations. Builds on the connections/web-of-trust + co-sign
   substrate. Each link is believe-or-don't, per person.
5. BACKFILL TO THE BEST OF OUR ABILITY (honestly-marked). Photograph old records,
   research, certificates — created-now-about-then, marked as recollection/record-
   capture, never forged dates. Same backfill mechanic as photographed cards.
6. RESILIENCE (fire / flood / theft). Physical genealogy dies in house fires,
   floods, and theft (the shoebox of grandma's clippings). Redundant family-key-
   gated encrypted backup (the multi-cloud blob idea) preserves it — the
   sovereignty AND the durability argument fused: you can't lose it AND no one
   else can open it.

PRODUCT CONSEQUENCES:
- The family tree is a first-class structure later (a graph of person-nodes +
  relationship attestations + attached record/memory clusters), but the FIRST
  step is the same as the keystone: capture + anchor a record with honest
  backdating. Genealogy is the keystone applied to ancestors instead of events.
- "Tag onto" = a relationship attestation linking your node to a relative's
  existing node/branch; corroboration weight shown plainly (who else attests this
  link). Reuses cosigning + connections.
- Anchoring copy must be honest: "proven unchanged since [date]," never "verified
  true."
- Resilience/backup is a selling point to surface in the genealogy framing
  specifically (fire/flood/theft is visceral for family records).

Resurface with: ultimate-cut-list (genealogy = a domain on the keystone rails,
slots after the event keystone proves out), co-signed memories, useful-for-me-
first, redundant-backup idea. Open question to teach back: is the family TREE its
own cut, or does it emerge naturally once enough person+record attestations exist
and we just add the "tag onto a relative" link + a tree view?

---

## 2026-06-14 — Community memorial attestations + family-filtered (not toxic) curation + tree-merge-by-mutual-agreement + family-history-rolls-up-to-town-history + "the new family tradition"
Tag: family-memory / memorial / curation / family-tree / civic-rollup / mission / emotional-core
Stage: maturing (the emotional heart of the whole thesis, with concrete design boundaries)
One-line: When someone passes, their community leaves remembrances that accrete
into a family-OWNED, family-FILTERED memorial (warm and honest, never a toxic
open forum); siblings tag the same parent to set a tree node, the tree merges by
mutual agreement across households into one big timeline, family histories roll up
into town/community history — owned by the family for the next hundred years, not
rented or gated, a new family tradition like setting the table.

Operator's framing in his own voice (he got "sappy," honor it verbatim):
"My mother died about three or four years ago. She was the pillar of the
community, always tried to help everyone, the church lady, always making food for
people when their family died. Her whole community would have lots of nice things
to share and say — and even some people would have negative things to say, and
those would even be nice to read honestly. You could have a whole topics page for
all kinds of stuff and it has toxic stuff — that's NOT what I'm after at all, I
don't want that. Free speech is free speech, but I just think about not losing a
heritage or lineage. When me and my sister both sign up for the family wallet and
we tag in that our mother was the same mother — Pam — that ends up setting that
part of the family tree, and we both agree who her mother was and who her father
was, and one day we fill in a little deeper, and that goes to our other family
members, and it's cool, we're friends on Facebook with our family tree all the way
up. A whole mycelial network connected by this mutual agreement to leave messages
in time — even if it's representing a different time, it's just a different way to
represent that information, and you leave your little mark. One morning you write
about one branch of the tree, the next morning somebody else's branch, and a
hundred people do different things and you get different entries and different
reasons to go visit that information. Maybe it's registered through the town and
somebody says 'give me the history of Gideon's participants throughout history' —
well, this one went on to be a lawyer, this one a judge, this one a preacher, we
have all these histories filled in, and more people find those attestations and
the weight gets heavier and heavier. It's not that it ever matters that anything
negative would be said — it's just that the clearer picture comes the more people
sign up, get their key, and put their weight around filling in the timeline the
way they see it, and the timelines all merge into one big timeline. You get this
nice memorabilia to read about a person who's passed, some of their great stories,
and you could filter through and be inspired by your great-great-great-grandmother
you never met but could read what other people said about her, in one nice
family-filtered place — and the family OWNS all of it, it's not rented by me or
anybody or gated. It's just the way a family keeps and accesses their information
over the next hundred years, a tradition, like setting the family table has lived
on. It gives the power back to the people instead of the rent-shakers above us —
that's the sweet justice part."

THE MECHANISMS + DESIGN BOUNDARIES (new):
1. COMMUNITY MEMORIAL ATTESTATION. When someone passes, people who knew them
   leave remembrances + stories + photos that accrete into a memorial cluster for
   that person-node. Multi-author, accreting over years, weight grows with
   contributors. Reuses the co-signed-memory + event-cluster substrate, attached
   to a person rather than an event.
2. FAMILY-FILTERED, NOT A PUBLIC FORUM (critical curation boundary). The operator
   explicitly does NOT want a toxic open topics/comment page. Resolution: because
   the memorial is family-OWNED and key-gated and web-of-trust-scoped, the family
   controls who can contribute — it's invited/trusted-circle, not open-public.
   Honest remembrance (even gently critical/human) is welcome; toxicity is
   excluded by SCOPE (who holds keys / who's invited), not by central censorship.
   This is the design answer to the free-speech-vs-toxicity tension: sovereignty +
   curation-by-ownership, not moderation-by-platform. Design it so contribution is
   permissioned by the family, not the world.
3. TREE-MERGE BY MUTUAL AGREEMENT. Two siblings each tag "our mother = Pam" →
   that co-agreement SETS/anchors the shared node. Agreement on her parents
   extends it. The tree grows by mutual attestation, household by household,
   merging into one shared timeline. (Web-of-trust genealogy from the prior entry,
   here shown as the social/emotional act of agreeing on shared ancestors.)
4. DISTRIBUTED BACKFILL ("a hundred people, different mornings, different
   branches"). The history fills in crowd-sourced across the family — each person
   contributes the branches/mornings they care about; the union is richer than any
   one person or paid service could assemble. More contributors = clearer picture
   + heavier weight.
5. FAMILY HISTORY ROLLS UP TO TOWN/COMMUNITY HISTORY (civic bridge, concrete). "
   Give me the history of [town]'s participants" → aggregate person-attestations
   surface the lawyers/judges/preachers/etc. Family rolls become community rolls;
   the same substrate that proves your lineage proves the town's. This is the
   civic-scale pillar made tangible and emotional (and ties to "registered through
   the town").
6. MEMORABILIA / INSPIRATION RETRIEVAL. Filter a passed person's great stories;
   be inspired by an ancestor you never met by reading what others attested about
   them — in one family-filtered place. Bot-queryable over the owned corpus
   (double-pass router applied to ancestors).
7. "THE NEW FAMILY TRADITION" (mission framing, lock it). The product isn't an
   app you use, it's a way a family keeps and passes its information for the next
   hundred years — a tradition like setting the family table, enabled by the tech.
   Owned, not rented, not gated. "Power back to the people instead of the
   rent-shakers — the sweet justice part." This is the mission stated in the
   operator's most personal voice; it IS the WHY.

PRODUCT CONSEQUENCES:
- Person-node memorial cluster = event-cluster keystone attached to a person; same
  rails. Memorials are a near-natural follow-on to the event keystone.
- Contribution permissioning is a FIRST-CLASS design concern: family/trusted-
  circle-scoped contribution, never open-public posting. Bake the curation-by-
  ownership model in from the start; do NOT build an open comment surface.
- Tree-merge = mutual relationship attestation on a shared person-node; show
  corroboration weight plainly.
- Civic rollup is later (Step 9) but design person-nodes so aggregation is
  possible without re-architecting.

Resurface with: ultimate-cut-list, sovereign-genealogy, co-signed-memories,
useful-for-me-first, living-family-nest thesis. This entry is the emotional core +
the curation-boundary design decision. Honor: the WHY of this whole project is
Pam's memorial being family-owned and unloseable. Open question to teach back:
for a memorial, what's the smallest invite/contribution model that lets the
community add warmth without ever opening a public/toxic surface?

---

## 2026-06-14 — OPERATOR DIRECTIVE: "the wallet of all things" (no single centerpiece) + the handshake network IS the moat (against AI agents AND rent-seekers) + authority-by-membership
Tag: operator-directive / vision-framing / moat / defensibility / adoption / strategy
Stage: matured (a framing correction + the defensibility crux of the whole project)
One-line: Do NOT let any one idea (memorial, genealogy, memories) become THE
centerpiece — it's a multi-purpose wallet you sculpt daily across many areas; the
unbreakable value comes from the web-of-trust HANDSHAKE network that no AI agent
and no outsider can join (because no one handshakes them in), where the family
certifies its own narrative and being IN the certified circle is what gives a
claim weight — and there's no handshake/connection-agreement system out there
that isn't charging $199.

Operator's framing in his own voice (a correction — honor it):
"I don't want it to be the only thing or the centerpiece. It's one of many things
this communications/wallet/architecture can do. I want it to be the wallet of all
things — not just one individual idea, 'let's cut it, let's make a wallet.' It
needs to be very well articulated and thought out as a place you go for multiple
things, something you sculpt and work on daily in different areas and different
manners until that shape comes to life — your histories, pictures, memories,
information, certifications, attestations of all kinds stored in one nice friendly
place that also overlaps with all the other family and friends. If you've
handshaked with your Aunt Martha and she's filling in stuff about your family,
it's the same as you talking to her — it just gives her a substrate to put it
where you can find it when you want, you may not care for five years, but it's in
there because you're certified, hand-shook into that same family by the very
family creating and logging the memories. If someone signs different, you'd have
the proof and the family can say 'we're going this way.' Filling in those family
graphs and having those mycelial networks filled in is what gives us adoption AND
that unforgettable moat from any AI agent out there, because no one would
handshake with them to fill in the network. It ties into a voting system in the
future — it's the foundation so many things could be built on, because there's no
mycelial-network connection-agreement system out there to this day that's not
trying to charge you $199. We're just trying to get you to agree with your family
on what you all agree on. The Winchester name — when people who hold that key say
something about their own family, people would look; if someone else said
something it might be true but wouldn't carry weight because it's not from that
certified group around that area/hub. It follows you — to churches, organizations,
businesses — as you make attestations in different parts of your life that you're
doing for your own selfish reasons, but it ends up making a track record that
becomes so valuable and unbreakable."

THE DIRECTIVES + INSIGHTS (lock these):
1. NO SINGLE CENTERPIECE — SUBSTRATE FIRST. The product is the wallet-of-all-
   things: ONE substrate (keys + handshake/web-of-trust + attestations +
   disclosure + recovery), MANY co-equal expressions (memories, events,
   genealogy, memorials, secrets, secure channel, AI context, certifications,
   civic proof). Never frame or build as if one expression is the whole. Articulate
   it as a multi-purpose daily-sculpted place. The event/memory keystone is the
   FIRST CUT for sequencing reasons, NOT the centerpiece.
2. THE HANDSHAKE NETWORK IS THE MOAT (defensibility crux). The web-of-trust
   handshake graph is what no AI agent and no outsider can counterfeit — you can't
   fake your way into a family's network because no one handshakes you in. This is
   simultaneously (a) the adoption engine (filling in the graph with people you
   actually know), (b) the unforgettable defensibility against AI-generated fakes,
   and (c) the thing every $199 service does NOT give you (they sell access, not
   a sovereign connection-agreement system). The moat is the network, not the
   features.
3. AUTHORITY-BY-MEMBERSHIP (weight comes from inside the circle). A claim about
   the Winchester family carries weight when it's signed by certified Winchester-
   key-holders in that hub; an outsider's claim about your family carries little,
   even if true, because it's not from the certified group. Weight is
   proximity-and-membership-scoped, not global. (This is web-of-trust as
   epistemic authority — your family is the authority on your family.)
4. ASYNC SUBSTRATE, NOT A FEED. A handshake gives a trusted person a place to
   leave things you'll find WHEN YOU WANT — you may not look for five years; it's
   there because you're hand-shook in. No pressure, no feed, no engagement timer.
   The substrate holds; you visit on your own clock. (Reinforces the
   no-engagement-farming stance.)
5. SELFISH-REASONS -> UNBREAKABLE TRACK RECORD. People act for their own reasons
   (keep my memories, prove my thing, store my info), and the BYPRODUCT is a
   cross-life track record (churches, orgs, businesses, family) that compounds
   into something valuable and unbreakable. Design for the selfish single-player
   reason; the network value accrues as a byproduct. (Pairs with useful-for-me-
   first.)
6. THE FOUNDATION SCALES TO VOTING. The same connection-agreement substrate is
   the missing foundation under future civic systems (voting included). Not
   because we build voting now, but because nothing else offers a non-rent-seeking
   mycelial connection-agreement layer to build it on.

CONSEQUENCE FOR THE CUT LIST: keep the ultimate-cut-list ordering (keystone
first) BUT articulate every cut as one facet of the wallet-of-all-things, and
treat the handshake/web-of-trust network as the through-line that makes ALL
facets valuable (it's already shipped as connections + cosigning — lean on it as
the spine, surface its moat value in the framing). Do NOT let the build narrow to
"a memory app."

Resurface with: ultimate-cut-list (this amends its framing), living-family-nest
thesis, useful-for-me-first, Worldcoin-comparison (the moat contrast). This is an
operator framing directive — apply it to ALL future framing of the project.

---

## 2026-06-14 — The agreement to ENTER the tree (joining transmits the family handshake graph) + cross-handshake hyphal densification
Tag: onboarding / network-effect / web-of-trust / moat / mycelial / consent-boundary
Stage: sprouting (the bootstrap mechanic for the handshake-network moat)
One-line: The single best moment is the AGREEMENT TO ENTER the family tree —
joining doesn't drop you into an empty graph, it transmits the family's existing
handshake history to you, and then you can go directly handshake those people,
turning inherited/transitive trust into direct cross-handshakes that densify the
mycelial web. The join IS where the moat propagates and grows.

Operator's framing in his own voice:
"The agreement to enter the tree is the best part. You join the Merkle family
tree, then you get all the handshakes history of the family tree, and can go and
handshake those and have cross-handshake hyphal connections then."

THE MECHANISM:
1. JOIN = AGREEMENT TO ENTER (the consent moment). Entering the family tree is a
   mutual-agreement act (echoes tree-merge-by-mutual-agreement: two siblings
   tagging the same parent SET the node). The join is the highest-value moment
   because it's where membership — and the moat — is conferred.
2. JOINING TRANSMITS THE FAMILY HANDSHAKE GRAPH. A new member doesn't start cold:
   on entering, they inherit visibility into the family's existing handshake
   history (who's connected to whom). This solves the new-member cold-start — you
   arrive with the family's map, not a blank slate.
3. CROSS-HANDSHAKE DENSIFICATION (hyphal). With the inherited map, you go directly
   handshake the people in it, converting transitive/inherited trust into DIRECT
   cross-handshakes. Each direct handshake thickens the web (more redundant trust
   paths = a stronger, harder-to-fake mycelial network). This is the network-
   effect flywheel: every join makes the graph denser and the moat deeper.
4. WHY IT'S THE MOAT, COMPOUNDING. Ties to the handshake-network-as-moat
   directive: no AI/outsider can be transmitted into the graph because no one
   agrees to enter them. The join-transmits-graph + cross-handshake loop is how
   the uncounterfeitable web grows organically from real human agreement.

EXISTING SUBSTRATE / ROADMAP: connections feature already does in-person/remote
handshakes (Tier P/R). The 2026-06-03 captivation-and-growth-ux roadmap already
names "Phases B+ unlock transitive hops" — exactly this. So the join-transmits-
graph + cross-handshake mechanic is the concrete shape of that already-planned
transitive-hops phase. Build on connections; this is its growth surface.

HONEST CONSENT BOUNDARY (do not skip): transmitting "all the handshake history"
to a new joiner must be CONSENTED + SCOPED, not an automatic full-graph dump.
Exposing everyone's complete connection map to any new member is a privacy leak
and could re-create the surveillance shape we're fighting. Design: the family (or
each member) chooses what's shared with a newcomer — introductions are offered,
not auto-broadcast; you might inherit "here are the people willing to be
introduced to you," not "here is everyone's entire web." Same family-filtered,
permissioned-by-ownership principle as the memorial curation boundary. Get this
right or the best part becomes the worst part.

Resurface with: handshake-network-as-moat directive, tree-merge-by-mutual-
agreement, co-signed-memories, captivation-and-growth-ux roadmap (transitive
hops), Worldcoin-comparison. Open question to teach back: at join, what's the
minimum the newcomer inherits that bootstraps them WITHOUT dumping the family's
full private graph — a curated "introductions available to you" set?

---

## 2026-06-14 — CLARIFICATION: the WITNESS family tree holds deceased (witnessed) + living (connectable); seeing the tree lets you connect with the living
Tag: family-tree / memorial / witness / web-of-trust / onboarding / correction
Stage: maturing (operator clarified the prior "agreement to enter" entry — that's
substrate; this corrects the emphasis)
One-line: Two living members agree on who Grandma was and both sign stories to
her node on the WITNESS family tree — so the deceased live in the tree by being
WITNESSED (co-signed by the living, since they hold no key), and everyone signed
into the family sees the whole tree (the passed AND the living) and can CONNECT
with the living ones.

Operator's framing in his own voice (a correction of my prior over-emphasis):
"What I meant was: we both agree on who Grandma was, and both have stories to sign
to the witness family tree for Grandma, so others signed into the family see the
tree — the deceased and the living — and can connect with the live ones."

THE CORRECTION (vs the prior 'agreement to enter' entry):
- My prior capture leaned on 'inherit handshake history -> go handshake
  strangers.' The operator's actual point is narrower and warmer: the tree itself
  shows BOTH the deceased and the living; you connect with the LIVING ones. The
  deceased aren't handshake-able (they're gone) — they're WITNESSED in.

THE MECHANISM:
1. DECEASED = WITNESSED NODES (no key required). Grandma holds no wallet/key, so
   she can't sign herself. The living establish her node by MUTUAL AGREEMENT
   (two+ members agree 'this was our Grandma') and populate it by CO-SIGNING
   stories/memories ABOUT her. She lives in the tree by witness, not by
   self-attestation. Weight = how many living members agree + co-sign.
2. LIVING = CONNECTABLE NODES. Living members hold keys and are handshake-able.
   Seeing them in the tree, you can connect/handshake them directly.
3. SEEING THE TREE = THE FAMILY VIEW. Anyone signed into the family sees the whole
   shape — passed and living — which is both the memorial (read the deceased's
   witnessed stories) AND the directory (reach the living). One surface, two
   payoffs.

GROUNDING (already-supported substrate — important): the journal feature ALREADY
models 'subject as a typed label so the grandchild-from-birth scenario works
without a child wallet existing' (journal manifest). That SAME pattern is exactly
how a DECEASED person gets a witnessed node with no key — subject = 'Grandma Pam',
multiple family members sign journal/story attestations with that subject, and
co-signing (cosigning feature) lets them corroborate each other's. Custody handoff
is already a meta-kind. So 'witness a keyless person (deceased OR not-yet-born)
into the tree' is NOT new crypto — it's the subject-label + co-sign substrate,
plus a tree VIEW that groups attestations by subject-person and links living
subjects to their handshake/connection.

CONSEQUENCE FOR THE TREE CUT: the family tree view = group attestations by
person-node (subject), show deceased nodes (witnessed, story-clustered) distinctly
from living nodes (connectable, with a 'connect' affordance via connections). The
keyless-witnessed-node is the unlock that lets the tree include people who never
had a wallet — which is most ancestors. Slots after the event/memory keystone
(memorial = keystone attached to a person; tree = those person-nodes linked).

Resurface with: the prior 'agreement to enter the tree' entry (its parent),
community-memorial-attestations, co-signed-memories, sovereign-genealogy, journal
subject-as-label. Open question to teach back: does a deceased node need a single
canonical 'this is Grandma' anchor attestation (co-signed by N family) to dedupe
everyone's stories onto one person, or do stories just cluster by matching
subject label + family agreement?

---

## 2026-06-14 — Pam's node screen (grounded wireframe, LIVE vs TO-BUILD)
Tag: design / family-tree / person-node / mockup / honest-grounding
Stage: sprouting (a grounded wireframe — operator asked "help me see it, don't pretend, provide proof")
One-line: A person-node screen for a deceased family member: hero (name/dates,
"witnessed by family"), how-she-connects-to-you (relationship path), how-she-
impacted-you (the moments you signed about her, with event_date + anchor +
co-sign count), and family-who-remember-her (the living, connectable). Built as
project-memory/.../mockups/2026-06-14-pam-node-screen.html with every panel
tagged LIVE (real repo data today) or TO BUILD (honest gap).

WHAT'S LIVE TODAY (real attestation data, cited):
- Pam's name/dates + her stories ← journal/story attestations with subject="Pam"
  (subject-as-typed-label already supports keyless people; createJournalEntry).
- event_date + "recorded later" honesty line ← the Moments cut shipped today
  (momentDate.ts).
- photo integrity, "Bitcoin block N" verified badge ← anchoring +
  deriveVerificationStatus.
- "N family signed this" ← entry.signatures.length (cosigning).
- the living family as connectable people ← connections handshakes +
  displayNameOf; relationship kin labels (parent/child/sibling) already exist.

THE HONEST GAPS (TO BUILD):
1. A real keyless PERSON-NODE — today Pam is only a subject string scattered
   across entries; a node needs a canonical "this is Pam" record (likely a
   family-co-signed anchor) that dedupes everyone's stories onto one person.
2. A WITNESSED relationship EDGE to the deceased — handshakes require the other
   party to co-sign, which Pam can't; need an asserted-by-living + family-co-signed
   edge variant (no Pam signature) so "Pam → mother of → Dad" can exist.
3. Tree path-walk to her node + "who-also-signed-Pam" grouping — both are queries
   over existing data (shared subject + relationship edges); PeopleTree +
   peopleTreeLayout are the starting substrate.

This is the spec sketch for the person-node / family-tree cut, which slots after
the event/memory keystone (memorial = keystone attached to a person; tree =
person-nodes linked). Resurface with: witness-family-tree clarification,
community-memorial, sovereign-genealogy, ultimate-cut-list. Open question still
parked: does a deceased node need a single canonical co-signed anchor, or do
stories just cluster by subject + family agreement?

---

## 2026-06-14 — The editable WHOLE family tree + handshake-merge-by-overlap + memory reconciliation (spec'd)
Tag: family-tree / web-of-trust / merge / entity-resolution / reconciliation / spec
Stage: matured into a spec (see briefs/2026-06-14-editable-family-tree-and-handshake-merge-spec.md)
One-line: Fill in the whole tree as you know it (parents, siblings, grandparents,
great-grandparents, aunts, uncles, cousins — living AND deceased); handshake a
relative and your tree INHERITS theirs through the shared overlapping node ("this
connects through Pam"); memory discrepancies surface to both to reconcile or
agree-to-disagree. Not just the dead, not just the living — all of it, connected.

Operator's framing (his own voice): "I want it where I can edit the family tree
the way I see it — mom, dad, siblings, grandmas, grandpas, great-grandparents,
cousins, aunts, uncles. The handshake says 'this one connects through Pam, let's
fill in the rest.' I shook hands with someone in my family who already filled out
more of theirs, so mine inherits theirs. If there's a difference in memory the
wallet surfaces to both: there's a discrepancy in how you remember it — agree to
disagree, or yeah you're right, it was raining that day. Small details, not
national security. It checks both levels of my tree for overlap, fills in the
obvious ones, maybe fills in some great-great-great-grandpa I can now read about —
he was a WWII vet — and I get to meet new people in my family I never knew. The
whole graph, past people not left out, how the graph connects together."

Grounded substrate: peopleTreeLayout.ts (radial tree), familyUnit.ts (co-signed
family envelope w/ roles + backdated as_of; its own comment says "PeopleTree v2
will branch a family node into its members"), createHandshake.ts (relationship
edges + kin labels), journal subject-as-label (keyless people), cosigning
(merge). The spec turns the operator's vision into a 5-cut plan.

Three honest hard parts (in the spec): (H-A) keyless person-nodes for ancestors
with no wallet — the foundational unlock, a family-co-signed "this is <person>"
anchor; (H-B) extended/recursive kin via ONE primitive edge parent_of with
grandparent/aunt/cousin DERIVED by graph-walk (tiny vocabulary, composable);
(H-C) cross-tree merge by overlap = the entity-resolution problem, solved by
anchoring on the shared KEYED relative + HUMAN-confirmed merges (never silent
auto-merge on name) + family-co-signed canonical nodes. Plus consent/scope on
inheritance (no full-graph auto-absorb) and memory reconciliation that ALLOWS
divergence (web-of-trust on memory; no central arbiter).

Cut order: CUT 1 keyless nodes + editable single-player tree (start here — no
network, delivers "edit the tree the way I see it" alone), CUT 2 derived
relationships, CUT 3 handshake overlap-merge + scoped inheritance, CUT 4 memory
reconciliation, CUT 5 civic rollup. Resurface with: ultimate-cut-list (tree is
the cut after the keystone), Pam-node mockup, witness-family-tree, agreement-to-
enter-the-tree. The parked dedupe question is now ANSWERED in the spec: yes, a
canonical family-co-signed person-anchor per node.

---

## 2026-06-15 — Streamline the in-person handshake: scan once, finish over Nostr (vs the 3-QR ping-pong)
Tag: ux / handshake / mycelium / tradeoff / friction
Stage: sprouting (a friction cut with a real security tradeoff)
One-line: The in-person handshake is a 3-QR back-and-forth ONLY because it uses
no network and both wallets must end holding the same dual-signed envelope; the
auto-complete-over-Nostr loop already exists (it IS the "they're not here" path:
routeFor sends a 1-sig handshake -> receiver inbox auto-offers cosign -> sends
back -> absorb), so the streamline is to let the in-person case finish over Nostr
after a single scan — at the cost of the in-person verification tier.

Operator's framing: "Can we streamline the handshake even more — not so much
back-and-forth and confusion, just here's this, here's this, both approved, it
updates over Nostr?"

WHY THE BACK-AND-FORTH EXISTS: Tier P (in-person) is 3 QR transmissions because
with NO network you need a round trip for BOTH signatures to land in ONE envelope
(initiator shows identity -> responder scans+signs+shows -> initiator scans+
cosigns+shows -> responder scans). The 3rd hop is what makes "in person" honest:
both signatures were exchanged face-to-face, no network MITM.

WHAT ALREADY EXISTS: the remote/Nostr path (envelopeRoute.routeFor) auto-completes
with zero manual ping-pong — send a 1-sig handshake, the peer's inbox offers one
tap to approve, it cosigns + sends back, and the initiator's inbox absorbs the 2nd
signature silently. "Both approved, updates over Nostr" is already built.

THE STREAMLINE OPTIONS (the fork):
1. SCAN-ONCE-THEN-NOSTR (smallest, recommended). When both are online, the
   in-person flow becomes: scan their code ONCE to grab their key, tap send, and
   it completes over Nostr exactly like the remote path — no QR ping-pong. The 3-QR
   stays only as the pure-offline fallback. COST (honest): the record is
   verification=remote (online-verified), not the stronger in-person tier, because
   the cosignature arrives over the network, not face-to-face. Tiny code (route the
   in-person scan into the existing remote flow).
2. IN-PERSON-STRONG IN TWO SCANS. Keep the face-to-face guarantee but cut to two
   quick (near-simultaneous) scans: each scans the other once, capturing a signed
   "present with you now" nonce; each builds a 1-sig handshake + the presence proof,
   then completes over Nostr. Stays in-person-honest, half the steps. COST: a real
   protocol addition (presence nonce + verify), more work + tests.
3. JUST DEFAULT TO REMOTE WHEN ONLINE. Don't add a path; when Nostr is on, steer
   people to the already-simple remote flow and treat 3-QR as the rare offline case.
   Smallest possible change (copy/routing nudge).

RECOMMENDATION: Option 1 for the friction win now, with honest labeling that an
online-completed connection is online-verified; revisit Option 2 if in-person
proof matters enough to warrant the nonce. Resurface with the 2026-06-15 handshake
copy overhaul. Open question is the tradeoff itself — see chip.
```
Date: 2026-06-09
Tag: COOKING APP <-> TAPIT - first external Bench-app integration over Layer 2
Summary: Operator wants his daughter's cooking app to "hook into" Tapit: bring in
recipes, stamp them (sign + Bitcoin-anchor) as an "I can eat this / verified"
feature, with a recipe-card toggle that reveals "Bitcoin block N + verified" and
the hash minted to the chain. KEY GROUNDING (verified against code, not memory):
this needs ZERO new wallet code - the Layer 2 inter-app signing pathway is ALREADY
BUILT (src/features/sign-request, born 2026-05-21). External apps deep-link to
<origin>/sign?req=<base64url SignRequest>, the user approves inside the wallet,
the wallet signs+holds+queues-anchor and redirects to the app's callback with
?grant=<base64 SignGrant{envelope}> (or ?decline). The returned signed envelope IS
the stamp; <origin>/verify?p=<base64url proof> is a stateless public re-verifier
showing signature + Bitcoin block.
This is the FIRST real third-party Bench app to consume the wallet as the
key-holding hub - the thesis ("the hub every other app connects TO to get something
signed") made concrete. Recipes map to kind:'journal' (dated personal record) or
'credential' (certified). 
LOAD-BEARING HONEST CAVEATS surfaced in the hand-off prompt: (1) block number is
EVENTUALLY-consistent - the grant at approve-time is signed but anchor is pending;
Bitcoin confirmation (OTS) takes hours, so the card needs a two-state design
(Stamped->awaiting, then Verified->block N). (2) fields are FLAT string|number|
boolean only - flatten ingredient/step arrays to strings. (3) origin is an
untrusted display string; trust = user approval + verifiable sig + anchor. (4) v1
transport is deep-link only (NIP-46 specced, not built).
Deliverable: a ready-to-paste hand-off prompt at
project-memory/.../tapit-wallet/integration/cooking-app-tapit-integration-prompt.md
(<WALLET_ORIGIN> placeholder to fill with the deployed PWA origin).
Stage: sprouting -> ready to build on the cooking-app side; nothing to build on ours.
Resurface: when the daughter's app field-tests the round-trip (watch the async
block-number UX + the flat-fields flattening as the two likeliest snags), and as
the proof that Layer 2 is real - candidate to generalize into a tiny published
"connect to Tapit" snippet/SDK if a second Bench app wants in.
```

```
Date: 2026-06-11
Tag: MOM-AND-POP LODGING WEDGE - verified-stay attestations as a Bench-app GTM
Summary: Operator: small lake resorts / cabins / mom-and-pops (5-20 units) with a
simple booking page are a distribution vector. Tie the wallet to the sign-in or
guest book (simplest version), guest is directed to Tapit to "do a test" (make an
attestation), attestations accumulate into a verifiable track record. Bundle an AI
chatbot (the wallet-bot pattern) as a Trojan horse that delivers real value so the
property + guests adopt our methods. Reputation thesis: verified attestations give
a track record for validity (was the trail good, was the experience real);
accredited users with history carry more weight, a historyless one-off carries
little; people can post what they want but it gets no weight without a track
record; more independent verifiers = more legitimate.
WHY IT'S STRATEGICALLY REAL: exercises the EXACT stack already shipped - the Layer 2
sign-request pathway (same template as the cooking-app integration) emits a
SignRequest from the booking page; the check-in/review becomes a signed +
OTS-anchored attestation; web-of-trust weighting scores it. Underserved market with
a real, unsolved trust problem (fake reviews) the incumbents (Google/TripAdvisor)
can't fix because their reviews are siloed + platform-owned. A property is a Hearth;
the weighting is HEARTWOOD judge-weight doctrine; computeWeight exists in
tapit-attest (advancedWeighting throws not-implemented - the hard part is stubbed).
LOAD-BEARING HONEST CRITIQUE (don't flatter):
1. Same caveat as the financial leaf: a signed review proves WHO claimed it + WHEN,
   un-altered - NOT that the stay was real or good. Value lives almost entirely in
   the WEIGHTING + CORROBORATION layer, which is the hardest + least-built part, not
   the signing (commodity, done).
2. SYBIL is the central threat and brutal in lodging (incentive to fake glowing
   reviews of your own property, trash competitors). Naive "more verifiers = more
   legit" is gameable - spin up 50 identities to verify your own review. Defense
   requires verifiers with independent, costly-to-fake history = the SAME unsolved
   realness/independence problem as the social sig.
3. KEYSTONE FIX = issuer corroboration: the RESORT signs "this guest actually
   stayed here" with the resort's key (like a bank co-signing the financial leaf).
   That check-in attestation is hard to fake (needs the resort key) and is what
   gives a guest's later review weight. Lead with issuer-corroborated STAYS, not
   self-signed reviews + verifier-counting (Sybil bait).
4. Adoption friction: "go install a separate wallet and do a test" mid-booking will
   crush conversion. Simplest version must be near-zero-friction - attestation
   minted FOR the guest (claim later), or purely opt-in post-stay. Trojan horse
   must deliver value BEFORE asking for the wallet step or it dies at install.
5. Two-sided cold start: reputation track record only compounds across MANY
   properties; first 100 users get little reputation value. Per-property value
   (real guestbook + genuinely useful concierge bot: checkout time, dock open,
   local tips) must stand alone, independent of network size.
SMALLEST USEFUL CUT (the honest lead): resort issues a SIGNED verified-stay
attestation to the guest at checkout (issuer-corroborated, portable, self-owned,
hard to fake); guest holds it + can attach an optional review leaf; /verify shows
"stay attested by <resort key>". That alone is novel vs siloed platform reviews -
a portable verified-stay credential the traveler OWNS and carries across properties.
Weighting / accreditation / cross-property reputation + sat-staked skin-in-the-game
(SATOSHI costly-signal vs Sybil) is the north-star that follows volume.
Stage: sprouting. Resurface when scoping the first external Bench-app pilot or any
reputation/weighting work; pairs with the cooking-app integration as proof Layer 2
is a real GTM surface, not a demo.
```

```
Date: 2026-06-11 (refinement of the mom-and-pop lodging wedge, same day)
Tag: PRE-SIGNED CONTENT-BLIND WITNESS TOKEN - the issuance trick that protects
negative reviews
Maturation: sprouting -> sprouting+ (mechanism sharpened). Operator's refinement of
the issuer-corroboration keystone.
Summary: At BOOKING, the guest's key receives ONE pre-signed "chance" from the
establishment - a single-use, key-bound, CONTENT-BLIND entitlement to post exactly
one witness about this stay. The guest can then say ANYTHING (praise OR complaint);
it stays tamper-evident, anchored, and provably from a key the establishment itself
authorized before it knew what would be said. Clean verifiable chain:
establishment-key -> entitlement(guest-key, stay-id) -> guest-key -> witness(content),
all anchored.
WHAT THE TRICK ACTUALLY FIXES (real upgrade): separates the RIGHT TO SPEAK from the
CONTENT. Because the establishment commits (signs) at booking BEFORE knowing the
review, it cannot censor or withhold a negative one - it already vouched the guest
is real. And one-token-per-real-booking rate-limits Sybil at the cost of an actual
booking. So it upgrades the ISSUANCE/CENSORSHIP axis decisively.
WHAT IT DOESN'T FIX (bounce, honest - operator: "I'm sure it's gameable too"):
1. Denominator/selection: a dishonest operator routes bad stays AROUND the system -
   handles complaints off-book, refunds-for-silence, "never issued a token" for
   walk-ins/phone bookings. You only see witnesses from tokens that were issued; the
   suppressed bad experiences are invisible. Defense: issuance must be
   NON-DISCRETIONARY - the token rides the booking confirmation itself (withholding
   it = not confirming the booking). But the operator runs their own booking system,
   so it reduces to "trust the establishment to run honest auto-issuance" - weaker
   than trustless. Honest ceiling.
2. Costly-but-possible fake positives: operator self-books phantom stays, gets real
   tokens, posts verified praise. Rate-limited + COSTS a real booking (the Sybil tax,
   good) but not eliminated. WEIGHTING still required: a gushing brand-new single-use
   key << a real cross-property traveler's history.
3. Token resale / off-protocol collusion: bind the token NON-TRANSFERABLY to the
   issued key (redeemable only by it). Stops resale of the posting right; can't stop
   a guest being paid to post dictated content (unstoppable in any review system).
4. Extortion flip-side: an un-censorable, portable, un-deletable verified 1-star is
   real leverage ("pay me or it posts"). Mitigate with signed right-of-reply +
   dispute attestations; can't fully remove the leverage.
5. Provenance != truth: proves WHO + THAT-THEY-STAYED + UNTAMPERED, never that the
   words are accurate. A real guest can still lie. Trust emerges from corroboration
   density + reviewer-history weighting + right-of-reply, not from any single witness.
6. Privacy/linkability: a persistent key carrying weighty history also leaks travel
   patterns. Selective disclosure helps; pseudonymous-but-persistent key is the
   compromise. The more weight, the more linkable - honest tension.
7. Pre-sign-at-booking timing hole: token exists before check-in, so it could be
   redeemed to "review" a stay that hasn't happened. Gate redemption/validity to
   after the stay window or mark posted-during-vs-after.
BUILDABILITY: issuance + signed witness + verify chain all sit on existing primitives
(credential attestation, issuer signing, sign-request Layer 2, selective disclosure,
OTS anchor). TWO parts need real design: (a) the "one chance" uniqueness - a
nullifier / anchored spent-set so a token can't be redeemed twice (per-establishment
tracking is easy; global double-spend prevention needs an anchored registry); (b) the
weighting/accreditation math (computeWeight exists; advancedWeighting stubbed).
NET: the pre-signed content-blind token decisively wins the censorship/Sybil-rate
axis; the truth/reputation axis still rests on weighting + aggregation (the unbuilt
hard part). The token makes each witness CREDIBLY SOURCED; it does not make any one
witness TRUE. Sat-staked skin-in-the-game (SATOSHI) is the later costly-signal lever.
Resurface: when scoping the lodging pilot or any issuer-credential + reputation cut.
```

```
Date: 2026-06-11 (maturation note on the witness-token idea, same day)
Tag: AGGREGATE-TRUTH crystallization - outliers wash, integrity reduces to ONE knob
Maturation: sprouting+ -> maturing. Operator's robust-statistics argument is correct
and resolves the "provenance != truth" caveat AT THE AGGREGATE LEVEL.
Operator's point (accepted): the system is read in AGGREGATE, not per-witness. With
enough verified-honest independent samples, robust statistics converge on truth and
both extremes lose - 50 "trail 2 astonishing" vs 1 "it's rocky" correctly degrades
the complaint to a footnote (wear good shoes), and an over-the-top rave with no
corroboration from a no-history key reads as an outlier. A key corroborated by 100
shops earns measured faith calibrated to that history. The SIGNING LAYER's real job
is exactly to make the samples trustworthy inputs: real guest, untampered,
one-per-real-stay, history-tagged - so the aggregate computes over clean
independent-ish data instead of platform sludge. Correct, coherent, on-mission
(present weighted/corroborated signal, let each reader apply their own measured
faith - don't hand down one central 4.3-star verdict; that's a teaching surface).
WHAT SURVIVES THE AGGREGATE ARGUMENT (the precise residual, NOT a rebuttal):
1. THE knob: robust stats converge on truth ONLY IF samples are INDEPENDENT. Lone
   liars + cheap fakes wash out for free (operator is right). What survives is
   CORRELATED manipulation - a broker controlling many keys each with manufactured
   cross-shop history all nudging one way; if the fakes look independent and numerous
   they BECOME the mass, not an outlier. So system integrity reduces ENTIRELY to the
   COST of fabricating a key that looks like genuine independent history. That single
   number is the whole game. Levers: per-real-booking cost (already in), cross-shop
   corroboration depth, sat-stakes (SATOSHI costly-signal).
2. DENOMINATOR is orthogonal + unsolved by aggregation: stats run on reviews that
   EXIST. Suppressed bad stays (refund-for-silence, token never issued) bias the
   surviving median high no matter how good the outlier math. Needs non-discretionary
   issuance (token rides the booking confirmation); ceiling = trust the operator's
   gate where reality enters.
3. ASYMPTOTIC: wisdom-of-crowd is a large-N property. New property (3 reviews), new
   traveler (no history), obscure cabin = the weak regime, exactly where 3 fakes ARE
   the consensus. Confidence must SCALE WITH N and be SHOWN ("based on 3 stays"), not
   hidden behind a shaky median.
4. "TRUTH" is precise for OBJECTIVE physical claims (is trail 2 rocky) but for
   SUBJECTIVE ones it's robust consensus-of-those-who-showed-up - a humbler, honester
   label than "truth."
ENGINEERING REDUCTION: the design is sound and is literally HEARTWOOD judge-weight.
It reduces to (a) computeWeight/advancedWeighting (stubbed) = history+corroboration
weighting, (b) a Sybil-COST anchor on fabricating independent history, (c)
non-discretionary issuance, (d) honest confidence-vs-N display. (a)+(d) are the
buildable near-term; (b) is the deep one.
```

```
Date: 2026-06-11 (threat-model close on the witness-token arc, same day)
Tag: WALLET-AS-CAPTCHA - proof-of-personhood via non-parallelizable physical cost
Maturation: maturing -> maturing (threat model resolved to its real boundary).
Operator closes the cost-knob question I left open: the wallet+real-stay is the
CAPTCHA / proof-of-personhood gate. A bot downloads a wallet and signs an identity
for free (worthless), but CANNOT get a night's stay and convince a human owner a
real person stayed - the gate's cost is PHYSICAL and NON-PARALLELIZABLE (a click
farm can't physically stay at 100 cabins and charm 100 owners). This annihilates the
Twitter-bot mass-spam failure mode that makes open review systems worthless.
ELEGANT PROPERTY operator named: influence and stake are COUPLED. A no-crowd voice
is just an opinion, easily discarded; only a key with real cross-shop reputation can
move the needle, and such a key risks that earned reputation to post a dishonest
review - "who would risk being the first, with no crowd to stand with." The only
voice loud enough to harm a business is the voice with the most to lose. Honest
DEFAULT when data is thin: fall back to first-hand / trusted-referral (web-of-trust),
the hardest-to-fake mechanism - and making that the explicit default (not a
fake-confident score) is on-mission sovereignty literacy.
THE REAL RESIDUAL BOUNDARY (what survives BECAUSE the cheap attacks are dead - a sign
the design works, attackers forced up the cost curve):
1. TARGETED low-volume on SMALL-N: the gate kills industrial spam but not a funded
   competitor buying a FEW real-stay negatives against a NEW property that has no
   protective mass yet. The cost-gate and the aggregate-gate cover for each other
   EXCEPT in the small-N x targeted-attack cell. Defense: corroboration density +
   show-your-N + right-of-reply; honest weakness early.
2. DISHONEST OWNER: the captcha-checker is an interested party. Solves BOTS cleanly,
   solves insider gaming NOT AT ALL (selective issuance, self-booked praise). Bot
   problem != dishonest-insider problem; the gate is the former only.
3. CAPTURED/BRIBED HIGH-REP KEY: the gate concentrates trust into reputable keys,
   which raises the VALUE of subverting one (bribe a 100-shop traveler to trash a
   rival - measured-faith makes it land hard). Mitigated by anomaly-detection on
   out-of-character reviews (the key that loves everyone then savages one place looks
   off), not eliminated.
4. REFERRAL-FALLBACK depth: the web-of-trust default is only as good as its roots; a
   freshly bootstrapped region has shallow roots. Honest start = one real
   family/community (mission: "if it only works for one family it succeeded").
META: wallet-as-captcha doesn't make it unattackable; it raises the cost FLOOR so
only motivated, skilled, targeted, VISIBLE, self-limiting attacks remain - which is
the most any real trust system achieves. Goal isn't perfect; it's "expensive enough
that honest is the dominant strategy for almost everyone." That is achieved here.

```
Date: 2026-06-11 (CORRECTION to the threat-model close, same day)
Tag: PURCHASED-INFLUENCE ATTACK COLLAPSES - the residual is INSIDER, not outsider
Maturation: correction of an overstatement in the prior two entries (the "targeted
small-N" and "captured high-rep key" residuals were weaker than stated). Operator's
dichotomy is correct and I concede it.
Operator's fork (accepted): the competitor-down-the-street who wants to buy a hit
either uses LOW-rep keys (discarded - "bought nothing") or needs HIGH-rep keys (real
people who must be willing to BURN hard-earned reputation - scarce, expensive,
one-shot, self-limiting). To actually SHIFT an aggregate verdict you need a CROWD of
independent reputable voices, and THAT crowd is exactly what the personhood gate
makes unmanufacturable: low-rep keys don't count, and you can't cheaply mass-produce
high-rep keys because reputation requires real non-parallelizable stays. So a single
captured key can't fake a mass, and one high-rep negative against a real mass is just
an anomaly flagged against that key's own pattern. THIS ALSO RESOLVES the earlier
"correlated fakes become the mass" worry (2026-06-11 aggregate-truth entry):
correlated fakes can't acquire the credibility that would let them count as the mass.
The purchased-influence / outsider attack genuinely collapses under the operator's
own logic. I overstated it.
WHAT ACTUALLY SURVIVES (a DIFFERENT attacker, not the one being questioned):
1. THE INSIDER (owner), not the outsider (competitor): the owner uses REAL cooperating
   people - self / friends / family who really stay - to mint GENUINE positive tokens,
   and suppresses negatives by not issuing tokens (denominator). This doesn't need
   "bought reputation" because the reviewers and stays are real; it's insider
   self-dealing at the issuance gate, which is an interested party. Bounded: a few
   friends can't out-mass real volume, and it faces the same show-N / referral default.
2. COLD-START THINNESS (universal, not an attack): at N=0->few, ANY source honest or
   not is thin, and "discard the lone opinion" needs a crowd to discard AGAINST. The
   discount mechanism requires a denominator. Handled by the operator's own fix: show
   the N honestly + default to first-hand/referral when thin, never launder a thin
   sample as a verdict.
NET CORRECTION: system is robust against PURCHASED outside influence (operator right).
The real boundary is (a) INSIDER honesty at the issuance gate and (b) cold-start
thinness - and BOTH are handled by the same honest posture already named: show-your-N
+ referral-default. The design already contains the answer to the attacks I'd named.

```
Date: 2026-06-11 (SYNTHESIS / resting point of the witness-token arc, same day)
Tag: CHECK-IN ISSUANCE + INCENTIVE-COMPATIBILITY - honesty as the dominant strategy
Maturation: maturing -> fruiting body (the arc reached a coherent resting synthesis).
THE DENOMINATOR FIX (operator): issue the irrevocable review-key at CHECK-IN (start
of stay), before the outcome is known, as a VISIBLE BLANKET POLICY ("everyone who
stays gets one"). This converts suppression from invisible to SELF-INCRIMINATING: a
guest given no key has grounds to be loud, and an owner who publicly runs
"I cryptographically prove everyone who stayed" can't quietly withhold without
breaking his own stated policy and burning HIS OWN credibility. The owner is a keyed
participant too - influence-stake coupling now applies to the ISSUER, not just
reviewers. So the gatekeeper has skin in the game.
THE RUNNING-YOU-DOWN REFRAME (operator, correct): the system never stops detractors -
people always badmouth off-system, that's the pre-existing default and always will be.
What CHANGED is truth now has a VERIFIABLE COUNTERWEIGHT it never had: 98/100
cryptographically-proven great stays means one bad voice correctly reads as "a bad day,
world on tilt," not a verdict. You don't silence the critic; you give reality a louder,
provable signal.
THE UNIFYING THESIS (operator, = SATOSHI.md): design so that COOPERATING with the
system beats ATTACKING it - everyone does better for themselves by going along, so
honesty is the dominant strategy and gaming it just "gets you handed your ass." This is
Bitcoin's incentive compatibility, and it's the through-line under EVERYTHING in this
arc: the personhood gate, influence-stake coupling, check-in issuance, aggregate-truth
all serve making honesty the cheapest winning move. This is the correct north star.
HONEST RESIDUAL (precise, few, not manufactured):
1. THE TOOTH: the suppression VICTIM can't PROVE suppression - the un-keyed guest has
   no token precisely BECAUSE it was withheld, so "I stayed and got nothing" is
   unverifiable and falls back to word-of-mouth. Presence is provable only through the
   owner-controlled token => the owner keeps structural denominator power. MITIGATION
   (real build, not free): a PUBLIC SIGNED issuance-POLICY commitment + a grievance
   channel; BETTER - root the entitlement in the BOOKING/payment confirmation the GUEST
   independently holds, moving issuance upstream of the owner's discretionary check-in
   handout. Each step up reduces owner discretion; never fully zero (turtles).
2. Soft denominator-shaping: owner comps/fixes unhappy guests off-system before review
   so they don't post. Mild, often genuinely benign (fixing problems IS good), but
   skews the distribution positive for non-quality reasons.
3. Bootstrap to escape velocity: incentive-compatibility is the right END-STATE but not
   automatic at small-N - early on, going-along confers little benefit yet (like early
   Bitcoin mining near-worthless). Has to reach the point where cooperation pays.
4. Bitcoin-analogy precision: right in SPIRIT (incentive compatibility) but enforced
   SOCIALLY/economically (probabilistic, reputational) not by deterministic consensus
   (cryptographic finality). Bitcoin REJECTS an invalid block by math, every node, no
   judgment; this makes cheating reputationally UNPROFITABLE-in-expectation. Real and
   powerful (how reputation markets work) but softer than consensus finality - build
   the social-incentive layer DELIBERATELY, don't assume math enforces it.
ARC STATUS: resting synthesis reached. The lodging wedge is a coherent
incentive-compatible design on shipped primitives (Layer 2 sign-request + credential
issuance + selective disclosure + OTS anchor); the two unbuilt deep parts remain
weighting (computeWeight/advancedWeighting stubbed) and a Sybil/discretion-cost anchor.
Next: if piloted, build smallest = booking-rooted verified-stay credential + public
issuance-policy commitment + honest show-your-N; defer weighting math to volume.

```
Date: 2026-06-11 (extension: reciprocal signing + quality-uplift, same day)
Tag: RECIPROCAL STAY SIGNING + REVIEW-AS-MARKET-DISCIPLINE
Maturation: fruiting body (extends the resting synthesis with two new mechanisms).
RECIPROCAL SIGNING (operator): guest checks in with their cryptographic key, signs
their review, owner signs BACK; the mutual signature shows an ongoing happy
relationship start-to-finish, and many cleanly reciprocated check-in/out cycles build
a track record for BOTH parties. BUILDABLE NOW: this is literally the shipped cosigning
primitive (mergeSignatures - two sigs on one envelope by envelopeId; the handshake
co-sign pattern). A stay = a co-signed attestation.
THE DESIGN-CRITICAL FORK (don't get this wrong): the owner's countersignature can mean
two very different things - (i) "I confirm this person stayed / the stay closed
cleanly" (presence, CONTENT-BLIND, always signable), or (ii) "I endorse the CONTENT of
this review." If reciprocity means (ii), the owner only countersigns reviews he LIKES,
so negative reviews go unreciprocated and look second-class => suppression rebuilt at
the countersignature stage, undoing the check-in-issuance fix. CORRECT DESIGN: split
them. Co-sign the STAY/COMPLETION (neutral, both can always sign - "this happened, loop
closed"); keep the REVIEW as the guest's UNILATERAL signed leaf. Then "reciprocally
closed" = clean mutual completion (a real, honest dual-sided reputation signal - 50
cleanly-closed stays proves a good guest; 200 proves a clean operator) WITHOUT giving
the owner a veto over opinion. A soured stay shows as ABSENCE of countersignature -
real but low-fidelity (could be dispute, or just offline/forgot; needs a reason).
COLLUSION caveat: mutual signing proves AGREEMENT, not TRUTH - a colluding pair can
reciprocally praise each other. Provenance!=truth at the pair level; defended the same
way - aggregate across many INDEPENDENT counterparties + history weighting (a pair that
only ever praises each other with no other independent history is an anomaly).
QUALITY-UPLIFT (operator: "doesn't the threat of a review system raise quality
expectations?"): YES, directionally right and it's the symmetric incentive to the
personhood gate - the gate makes HONESTY the reviewer's dominant strategy; a verifiable
PORTABLE hard-to-game reputation makes QUALITY the owner's dominant strategy, because
reputation becomes durable CAPITAL you build and carry, not a platform score you can
flee by rebranding. Escaping your history gets expensive => longer-horizon incentive to
be good. Same Bitcoin incentive-compatibility theme; both sides pushed toward the
cooperative high-quality equilibrium. HONEST CAVEATS: (1) GOODHART - it raises MEASURED
quality on review-salient dimensions, which can be gamed or pull effort from unmeasured
things ("when a measure becomes a target it stops being a good measure"); can also
breed defensiveness/homogenization/appeasement. (2) Only bites once the system has
TEETH (reputation materially moves bookings) - "eventually" = post escape-velocity;
below that the threat is empty. (3) Sorting effect: good operators opt in to signal,
bad ones stay out to dodge accountability - opting out becomes a signal ONCE being-in
is the expected default.
NET: reciprocal signing is a near-term-buildable dual-sided reputation primitive on the
existing cosigning code IF countersignature = clean-completion not content-endorsement.
Quality-uplift is the owner-side half of the same incentive-compatibility thesis, real
but Goodhart-bounded and teeth-dependent.

```
Date: 2026-06-11 (LENS CORRECTION - operator pulled me back to the Prime Directive)
Tag: ADDITIVE VALUE, NOT SOLVE-EVERYTHING - the framing that re-reads the whole arc
Maturation: fruiting body -> the load-bearing reframe of the entire witness-token arc.
OPERATOR'S CORRECTION (accepted, and it's right): I kept escalating threat models as
if the bar were "solve trust / be attack-proof." WRONG BAR. Nobody has solved trust
(not Google, not TripAdvisor, not anyone). The goal is to ADD A VERIFIABLE LAYER OF
VALUE on top of an already-flawed system, not replace or perfect it. This is literally
the Prime Directive ("build the smallest useful version correctly") - the operator is
MORE doctrine-aligned than my escalating critique was. I drifted into boiling the ocean.
THE CHICKEN-AND-EGG DISSOLVES: I kept raising cold-start as a blocker. But you're not
hatching trust from zero - the world ALREADY runs on flawed trust (the chicken AND egg
already exist). We add a provable overlay on top. So "an attacker could still do X" is
not a refutation; it just means the new layer doesn't fix that pre-existing flaw - it
was never supposed to. The only question that matters: does it add a provable thing
that didn't exist before? YES - portable, math-verifiable, mutually-attested
interaction history, which degrades GRACEFULLY back to ordinary human judgment when
data is thin ("was it a good day? I tried it, liked it / didn't" - and no review or
thin history is NOT the end of the world, just no data).
ADOPTION PATH (operator): start with a few who love the novelty ("I can prove it - our
new guestbook"); it becomes the new norm fast; then NOT having the cryptographic chain
feels behind. Novelty -> norm -> expected-default. Legitimate and how real adoption
works.
THE ARTIFACT (concrete + buildable): a STAGED HASH-CHAIN of a relationship - booking
start -> check-in -> service stages ("bed turning was perfect") -> checkout, EACH stage
attested along the way as mutual, accreting into hundreds of positive linked proofs
over time. Maps to shipped primitives: each stage = an attestation; the chain = linked/
succession attestations (successionLink in tapit-attest); mutual = cosigning. "Cream
rises" = the visible HEAVINESS (weight) of each review; light ones default back to human
judgment. The operator already integrated the show-your-N humility I kept harping on.
RE-READS THE PRIOR ENTRIES: the "residuals" logged earlier (insider self-dealing,
captured keys, targeted small-N, Goodhart) are NOT blockers under this lens - they are
pre-existing flaws of the trust world that the additive layer simply doesn't claim to
fix. Keep them as known-limits notes, NOT as gates on shipping.
THE ONE THING THAT STAYS LOAD-BEARING (because it IS the added value, not an attack):
"verifiable by anyone OUTSIDE the system using math" must be literally TRUE - the proof
has to verify independently, off-our-domain, with standard tooling, not only inside our
own /verify page. If the proof only checks inside our app, we didn't add the
provable-to-anyone layer we're claiming - we built another walled garden with a verify
button. So independent off-domain math-verifiability is THE value prop and the cheapest
highest-leverage thing to nail. (This was prior "gap #1"; under the additive lens it's
not a residual - it's the product.)

---

Date: 2026-06-16
Tag: secrets / shamir / social-recovery / consolidation / ux / people-tab / wedge
Stage: sprouting
One-line: Collapse the three scattered secret-splitting surfaces into ONE purpose-built "secret module" that shows who holds your pieces at a glance and brings a secret back in one click.

Operator framing (his words, paraphrased from voice): "When I start a secret let's make it like a secret MODULE - a thing that looks like that's what it's made to do, not a little block of text you click on and then do something. Make it look like it belongs there and integrated. See who you sent your secrets to right off the bat and retrieve those secrets back with one click of a button, not going through five screens. Clean up the people tab and anywhere else that's like 'hey wanna store a secret?' - we've got like three of them in different places that kind of all do the same thing. Be smart about not redundant doing the same thing in different spots or looking cheap."

Grounding (from the 2026-06-16 inventory): the same Shamir chassis (splitSecret / combineShares in tapit-attest, wrapped by sharedSecret.ts splitSharedSecret / combineSharedSecret) powers three distinct UX surfaces: (1) SecretsDashboard.tsx (arbitrary user secrets - safe words, passwords) reached via the collapsible "Your secrets" card in PeopleSecretsSection.tsx on the People tab; (2) CohortEditorModal.tsx + DistributeSharesModal.tsx (split the wallet backup key K_data to a recovery cohort) reached from Settings; (3) RecoveryInitiatorModal.tsx (the lost-device recovery ceremony) reached from the locked-out screen. Shared data model already exists: secretLedger.ts (SecretRecord/PieceRecord, who-holds-what metadata, never stores the secret value unless "keep a copy" opted in), secretsLedgerStore.ts (encrypted-at-rest), secretPiece.ts (NIP-44 encrypted piece envelopes + receipts so the owner sees confirmed holders), secretPieceHeartbeat.ts (liveness pings), createShares.ts (recovery-share envelopes). The crypto and ledger are clean and reusable; the redundancy is purely at the UI/entry-point layer. Retrieval today: arbitrary secrets = paste every piece into a textarea; wallet recovery = 4-screen ceremony. No "who holds my pieces" overview at the top level; no one-click bring-back.

Design seed: one Secret module that (a) lists each secret you've made as a real card with its M-of-N status and the faces/names of who holds each piece right on the card; (b) one-click "Bring it back" that, for Tapit holders, fires the request envelopes and reconstructs as shares arrive (reusing the recovery ceremony plumbing) rather than manual paste; (c) folds the wallet-recovery cohort in as a first-class "your most important secret: this wallet" card so it's the SAME surface, not a separate Settings modal; (d) removes the cheap collapsible-paragraph entry on People and any duplicate "store a secret" CTAs, cross-linking to the one module. Open question parked for operator: own top-level "Vault/Secrets" tab vs. integrated module inside People; and whether wallet-recovery cohort fully merges in or stays linked-but-separate. Resurface: chip question asked 2026-06-16.


---

Date: 2026-06-16
Tag: key-dashboard / consolidation / social-recovery / secrets / dynasty-trust / liveness / tab-architecture
Stage: sprouting
One-line: One dedicated "dashboard for your key" tab that unifies social recovery + secrets + DynastyTrust multisig + every advanced key task, with live indicators of where your pieces are and whether your holders have been online.

Operator framing (his words, paraphrased from voice): "We're also gonna have stuff to track and deal with - DynastyTrust multisig, Tapit wallet, social recovery - and I think that needs to be all on a tab by itself. Social recovery, the DynastyTrust, the secrets, anything to do with extra stuff you can do with your key - have it in one spot where you can go and it's all 100% usable, visible, and collapsible if it needs to be. Kind of like a dashboard for your key that does other stuff - other types of signing, other types of tasks, and messages that show your pieces, where they're at, indicators of if your secrets have been online and all those visual things. We're not really tapping into the full data we can use to make the user feel like they know something about themselves in the wallet." On the merge question he chose: MERGE EVERYTHING IN (one module is the single home for all secrets including wallet-recovery, with the lost-device ceremony also staying on the locked-out screen).

Grounding: there is already a "Lattice" tab (LatticePanel.tsx) that read-only-visualizes handshakes + org memberships + the recovery cohort. Rather than add a second tab (the redundancy the operator explicitly warns against), the move is to EVOLVE the Lattice tab into the key dashboard - call it "Keychain". It should host, as collapsible dashboard sections: (1) Your secrets (the polished SecretsDashboard module, moved out of the People tab); (2) Social recovery (the cohort: who can restore this wallet, circleTrust verdict, distribute/recover entries currently siloed in Settings + the locked-out screen); (3) DynastyTrust multisig (CROSS-REPO - lives in stackingunderpressure/dynastytrust; needs its own grounding and an inter-app bridge, the Layer-2 connection pathway); (4) other key tasks / signing surfaces as they appear. The liveness layer is the under-used opportunity: secretLedger already has pieceFreshness (fresh/stale) + confirmedSummary + held/declined receipts, and secretPieceHeartbeat tracks holder liveness - surface these as visual indicators ("3 of 5 pieces healthy", "Aunt Carol's wallet last seen 12 days ago", "ready to bring back") so the user FEELS they know the state of their own sovereignty at a glance. The thesis line: make the data we already collect VISIBLE so the wallet teaches the user about themselves.

Phasing: Phase 1 (this repo) - repurpose Lattice -> Keychain dashboard; move secrets in; surface social-recovery + liveness indicators; remove the secrets module from People (consolidation). Phase 2 - pull the cohort editor + distribute + recovery ceremony out of Settings/locked-screen into the dashboard as first-class actionable sections (keeping the lost-device ceremony reachable from the locked screen too, since the app can't open then). Phase 3 (cross-repo) - DynastyTrust multisig tiles via the inter-app signing pathway. Resurface after Phase 1 ships: ask the operator which liveness indicators matter most to see first.


---

Date: 2026-06-16
Tag: family-tree / ratification / co-signature / mycelium-transport / governance
Stage: sprouting
One-line: Collect siblings' co-signatures over the network on a proposed family-detail edit, so the all-kids-must-sign rule completes for the multi-kid case.

Operator framing: "Change sign and when all registered kids sign it's completely ratified and takes all to change. If only one registered kid then they can edit at will just sign it and it changes."

Grounding: the BRAIN is already built. foldPersonEdits (personEdit.ts) enforces N-of-N: a solo controller's edits apply immediately (the "one registered kid edits at will" half — DONE), and once 2+ signers control a person every subsequent edit only applies when ALL controlling signers have signed it. PersonDetailView already surfaces this (requiresCosign banner + per-edit pending/signed badges). What's missing is the human/transport loop for the multi-kid case: when a kid proposes an edit to a co-controlled person, send that proposed-edit attestation to the other registered kids over the existing Mycelium NIP-17 transport (exactly the round-trip FamilyRatifyModal.tsx already does for family-unit envelopes), let each sibling review + append their signature, merge the co-signed edit back, and only then does foldPersonEdits flip it from pending to applied across everyone's tree. Open design question to resurface in chip form: who counts as a "registered kid / controlling signer" for a given person-node — is it the node's accumulated signers (today's model), or should it be explicitly the keyed children of that person derived from parent_of edges? That choice changes who the proposed edit gets routed to. This is the named next dedicated cut after the visible-branches + ancestor-slots slice (commit 398d808).


---

Date: 2026-06-16
Tag: family-tree / friends-circle / handshake / tree-exchange / mycelium / graph-traversal / privacy
Stage: sprouting
One-line: Pick friends into a friends circle and follow their graph up and down to see their tree too.

Operator framing: "You pick and add in a friends circle and you can follow their graph up and down to see their tree too."

Grounding: the family-tree is a blood/affinity graph (kinEdge relations are only parent_of, spouse, same_as -- no friend edge). Your social "circle" already exists separately as the handshake connections in the connections feature (HandshakeModal/createHandshake, VouchingCircleSection, FreshCrew). The pure brain for relating two people's trees across a shared person is mergeCandidates.ts, but it has NO UI and NO network yet -- so actually pulling/viewing another person's tree is the deferred handshake tree-exchange slice the family-tree manifest names. Decision-filter call already made: a "friend" should REUSE the existing handshake circle, not a new kin edge (wedge test #1 -- integrate what's already solved; friends are not blood, so they don't belong as a parent_of/spouse leaf). The real fork that needs the operator: when you "follow their graph up and down to see their tree," is it (A) a tree YOU build and hold -- you curate friends into a circle and grow/record their relatives yourself, tapping a friend re-roots the generational layout on them so you walk up to their parents and down to their kids, everything staying in your wallet, no data shared; or (B) the NETWORKED version -- a friend you're handshaked with consents to share their actual family tree and you browse their real ancestors/descendants live over Mycelium, which is the big tree-exchange/merge slice and means personal family data crosses the network under a consent model. A is the safe local wedge and a prerequisite either way; B is sovereignty-grade data-sharing that must not be assumed. Recommendation: A first, B as the named next slice.


---

Date: 2026-06-16
Tag: friends-trees / privacy / redacted-share / minimal-disclosure / safety-rail
Stage: sprouting
One-line: A privacy button so sharing never over-shares -- first names only, nothing private/personal -- and ideally minimal-by-default.

Operator framing: "some people might not want to share the last name or the place of birth or something like that so maybe we have a privacy button and it never over shares only first names and nothing private personal."

Grounding + key technical truth: a person-node is a SIGNED attestation, so you cannot quietly strip a field off the original and still have a valid signature -- the privacy path must build a FRESH, signed REDACTED PROJECTION bundle that carries only the allowed fields, not the raw attestations. Today a person-node stores displayName (one string), born (date), died (date), sex, keyedPubkey (public). There is NO separate last-name or place-of-birth field yet, so "first name only" = send only the first token of displayName and omit born/died/sex; nothing like birthplace can leak today because we don't store it. When structured fields (surname, birthplace) are added later, the privacy projection refuses them by default. Recommendation: make MINIMAL the default with an explicit "share more" opt-in (safe beats fast), and the share modal previews exactly what the friend will receive before the tap. This should ship BEFORE real-tree sharing is used in anger -- it is a rail, not a nicety.

---

Date: 2026-06-16
Tag: friends-trees / same_as-merge / tight-family / one-node-not-two-hubs / layer-toggles
Stage: sprouting
One-line: When you've handshaked a friend's parent (tight overlapping family), show that person ONCE, not as a hub wired to another hub at a different level -- with layer toggles (friends on/off, per-generation).

Operator framing: "would it show if I've hand shook with one of my friends parents because it's a tight family... it wouldn't look like a hub that's connected to another hub at a different level or only when you toggle friends on maybe or you can toggle on each layer."

Grounding: one human = one node. The same_as merge (buildKinGraph already union-finds same_as edges into one canonical node carrying aliasIds) is exactly the mechanism: when a person is both your friend's parent AND someone you've handshaked, bind the two appearances into a single node shown once, with both facts derivable (friend's-parent relationship + you-are-connected). That avoids the "hub wired to a hub at another level" look. The operator's toggle instinct is right: a Friends layer switch and per-generation-layer toggles let the user control density instead of drowning in cross-links. The consented same_as merge across trees is the already-named next slice; this idea says it is ALSO the cure for the tight-family double-hub.

---

Date: 2026-06-16
Tag: friends-trees / UX / scroll-explore / generational-navigator / polish
Stage: sprouting
One-line: A scroll-driven "speed run up and down" explorer -- scroll up and ancestors converge (narrower toward the apex), scroll down and descendants fan out wider down different legs.

Operator framing: "almost feel like you could speed run up and down the thing... the more you scroll up you go up the [tree] and then when you scroll down it gets wider and bigger you can go down different legs. That's just how I see it and it's probably not practical -- I just thought the UX needed a little polishing."

Grounding + verdict: this IS practical and it is a GOOD mental model, not a throwaway. Genealogy is literally narrow-up (ancestors converge toward an apex pair) and wide-down (descendants fan out across legs). treeLayout already assigns every node a (generation row, column) deterministically, so a scroll-driven navigator that keeps the focused generation centered, narrows as you flick up and widens as you flick down, and lets you follow one leg at a time is a UX layer on top of the layout we already compute -- no new graph math. Worth building as the explorer polish after the privacy rail + merge land.

---

Date: 2026-08-06
Tag: connections / people-tab / onboarding / camera-limitation / friction-first
Stage: sprouting
One-line: Consolidate the People tab's connect-with-someone entry points -- the "Invite by link" card and the New handshake / Scan envelope row -- into one page that leads with scan, falls back to paste/link, and explains itself well enough for a non-technical person.

Operator framing: "I feel like these two menus need to be consolidated. There's too much going on... I've got this code, I've got that code, your camera won't scan that all needs to be on one thing and not have two different toggles, but let's think it out to where it legitimately gives you all the options without overwhelming anybody and the easiest pass is a scan, but PWA won't let you use the camera so that's why we had to work around but just have it all on the one page and explain what's going on well enough that any dummy could understand that the code that I got sent I paste here, or I send them this code, however that works."

Grounding: screenshot of the People tab (list view) shows exactly the fragmentation named: a standalone "Invite someone to Tapit" card (Invite someone by link -- the remote path, no in-person scan needed) sitting above a separate List/Tree toggle row with two more buttons, "+ New handshake" (primary, green -- starts the in-person QR/paste ceremony) and "Scan envelope" (secondary -- scan/paste something someone already sent you). Three different affordances for what the operator experiences as one job, "connect with someone," each with its own mental model. The camera limitation is real and already partially solved: connections/manifest.ts's Streamline CUT A (2026-06-15) already added a default-on "scan once, finish over Nostr" remote path plus paste-fallback parity on the responder's Step 1, specifically because a home-screen PWA on iOS cannot reliably grant camera access the way a native app or full Safari tab can -- that's the origin of "your camera won't scan that" and the paste workaround the operator is recalling. The fix isn't new cryptography, it's consolidation + explanation: one "Connect with someone" entry point on the People tab that presents, in order of ease, (1) scan a code (camera, when available), (2) paste a code someone sent you, (3) share your own code/link for them to open -- with plain-language copy naming which one to use when ("got sent a code? paste it here. want to send yours? tap this."), replacing the current three-way split (Invite card / New handshake / Scan envelope) with one progressive-disclosure surface. List/Tree stays a separate, unrelated toggle (that one is about VIEWING existing connections, not making new ones, so it shouldn't be visually adjacent to the connect actions the way it is now -- part of why the screen reads as "too much going on"). Not yet scoped into a plan or built; resurface before touching PeopleTabBody.tsx / HandshakeModal.tsx / InviteShareButton.tsx.

---

Date: 2026-08-06
Tag: family-tree / cascading-cosign / web-of-trust / ratification / mycelium
Stage: sprouting
One-line: Build a family (or any group) by cascading cosigns -- person 2 agrees they're connected to person 1, person 3 agrees to and cosigns both 1 and 2, person 4 cosigns all three, and so on -- so by the end everyone has cross-verified everyone else and the whole group is provably, mutually ratified, rather than one founder declaring a family and everyone else just joining it.

Operator framing: "to add a family member, you have to start a whole new family and I want it to be where you have one person then you add one and then the third one adds that they're part of it and they agree that they're signing the other two and then the fourth one signs the three and it just keeps adding until there's no more that all agree and once everybody has cosigned back again, then it's cross verified 40 different ways by the end obviously but it's verified that I agree to group of people are connected well and have the live in this check in the family trees have our automatically merged in the background and all of that stuff."

Grounding: names a real, current gap. StartFamilyModal.tsx today is founder-centric: one person creates a family_unit envelope naming every member up front, and non-founder members ratify it by cosigning the SAME envelope FamilyRatifyModal.tsx sends them -- there is no path for an EXISTING family to grow by a later member joining and having the group re-verify around them; "add a family member" today means the founder editing and re-sending the whole roster (StartFamilyModal's `editing` prop replace-the-envelope path, founder-only, and only while the founder is still the sole signer per its own doc comment, since re-signing mints a fresh envelopeId that orphans prior ratifications). What the operator is describing is structurally close to the vouch-loop-back / vouch-witness pattern already built for org joins (connections/manifest.ts's Phase E4 cut 5, VouchWitnessModal + routeFor's vouch-witness action) generalized to family: each NEW member's join is its own small cosigned claim ("I am joining, and I agree persons 1..N-1 are who this group says they are") that gets collected from every existing member before the joiner is folded in, rather than one big envelope everyone re-signs from scratch. The "cross verified 40 different ways by the end" is the natural, honest consequence of pairwise/cascading agreement rather than a goal to engineer directly -- it falls out once each join step requires agreement from everyone already in. This is a bigger structural change than the existing Edit path (which the operator's own family-mode CRUD overhaul, 2026-05-31, deliberately scoped to pre-ratification only) -- it's closer to a NEW amendment-envelope kind that preserves prior ratifications while adding a member, which familyUnit.ts's own doc comment already names as deferred follow-up work ("post-ratification add/remove-member via a proper amendment-envelope kind that preserves existing ratifications rather than replacing the whole envelope"). "Family trees have our automatically merged in the background" likely refers to the already-separate friends-trees merge thread (see the 2026-06-16 same_as-merge idea above) rather than a new mechanism. Not yet scoped into a plan; resurface as its own dedicated design pass -- this changes the family_unit envelope's lifecycle, not just its UI.

---

Date: 2026-09-03
Tag: light-signer / sovereign-edge / downloadable / no-login / arena / beat-the-hodl
Stage: raw insight
One-line: A stripped-down "light signer" version of Tapit you download and run yourself -- just holds your key and signs -- as an alternative to logging into the hosted wallet.

Operator framing: "I think I want a version of tapit we strip down and make a light signer that you download and use yourself vs login."

Grounding: this is the maximally-sovereign edge of the same primitive the full wallet is built on. tapit-attest already IS the Wallet core object + BIP340 signing with the key hard-private (#keypair, never returned); the full wallet wraps it in login (Supabase auth), the encrypted-blob sync host, the inbox, connections, recovery, and the whole PWA surface. The light signer is that stack with everything but the Wallet + Nostr signing removed: no login, no account, no Supabase, no cloud -- a small download (ideally a single self-contained / static build, even openable offline) that generates or imports a keypair locally, holds it on-device, and signs events (move-chain moves, sign-in challenges, attestations) through the same wallet.signDigest / buildEvent seam the app already uses, so a light-signer-signed event is byte-identical to a full-wallet-signed one (one envelope standard, full interop). Connects directly to two live threads: (1) the arena's player/spectator split (2026-09-03 chat) -- a player needs a signer, a spectator needs only a relay reader; the light signer is the smallest thing that lets someone PLAY Beat the HODL Machine without adopting the whole wallet; and (2) the sovereignty spectrum named the same day -- honesty lives in the protocol (signed Nostr events + the recomputable move-chain / truthScore engine), the UI is a removable lens, and the light signer is the sovereign end of that lens. Honest tradeoff to make loud: owning the key entirely means owning the BACKUP burden entirely -- no cloud recovery, no "forgot login"; lose the device without a written/exported seed and the identity (and its chains) are gone -- so the light signer must lead with a plain export/backup step, and its audience is exactly the "download and use yourself" crowd that accepts that trade. Open questions for the resurface: is it purely a signer (feeds a separate arena/board client) or does it also render a minimal arena; single-file static build vs a small installable; and does it share code with the full wallet as a stripped Vite entry / build target in THIS repo, or ship as its own tiny artifact. Not scoped or built; resurface as its own design pass before touching build config.

---

Date: 2026-09-03
Tag: genealogy / family-tree / friends-trees / standalone / stubbed / scope
Stage: sprouting
One-line: Family-tree + friends-trees are STUBBED out of the wallet for now, and may return OR become a standalone genealogy app that interacts with a Tapit identity rather than living inside the wallet.

Operator framing: "Stub the genealogy for now. Might bring back later or make standalone that interacts with tap it."

Grounding + verdict: this came out of the 2026-09-03 wallet-wide gut check, where family-tree (3.65k lines) + friends-trees (1.4k) were flagged as ~5,000 lines, the heaviest product surface after connections and wallet-core, and the biggest wedge-or-tangent call in the repo. Sovereign, consented, cross-verified family graphs ARE a real wedge against something like Ancestry that owns your data, but that much weight for a key-holding sovereign wallet reads more like its own product than a feature. Stubbed (commit 8dee465): FamilyTabBody was the single mount for both features, so it was replaced with a placeholder that imports neither, tree-shaking both out of the bundle; the feature folders, their tests, and any saved tree data are UNTOUCHED and parked in the repo. Two bring-back paths, and the standalone one is the interesting idea: because a family-tree node is already a person-node keyed (for living members) to a wallet identity, and friends-trees already shares a signed family-tree-bundle over the SAME encrypted Mycelium transport the wallet uses, a standalone genealogy app could hold NO keys of its own and instead lean on Tapit as its signer and identity layer -- exactly the Layer-2 "other apps connect to the wallet to get something signed" thesis, the same rails the arena and DynastyTrust ride. That would make genealogy a Bench app on the Tapit hub rather than weight inside the wallet, and it would let the family graph grow as big as it wants without bloating the sovereign-identity core. Open questions for the resurface: standalone-that-signs-through-Tapit (Layer-2) vs re-mount inside the wallet; whether the standalone reuses the parked family-tree/friends-trees code as a shared package or forks it; and how a person's already-saved on-device tree data migrates to the standalone. Parked, not pruned -- the mycelial substrate is intact.

Refinement 2026-09-03 (tiered visibility): operator -- "For the standalone family tree I see it as Public view unless your family then you see deeper and more detailed info. Get verified by family, see more?" The standalone tree has a visibility LADDER keyed to your proven relationship: a stranger sees a shallow PUBLIC view; someone verified as family sees DEEPER, more detailed info; and getting "verified by family" is what unlocks the deeper tier. This maps almost one-to-one onto primitives the wallet already has, which is why it's a strong fit: selective Merkle-leaf disclosure (the same primitive behind "prove over 21 without the birthday" -- shallow leaves public, deep leaves withheld), family_unit membership + the cascading-cosign "verified by family" idea already in this file (person N is folded in only when existing members cosign), and encrypt-to-the-family (SharedSecretModal / the family safe-word / a family group key) so the deep leaves can be published as ciphertext the world can see but only family can DECRYPT -- making the gate cryptographic and sovereign, not a soft server-side UI gate. So "get verified by family, see more" = get ratified/cosigned into the family, receive the family's decryption access, and the deep leaves open. THE HONEST CATCH to design around: a truly public skeleton of LIVING people (names + who's connected to whom) is a surveillance gift -- publishing the living's relationship graph to the world is exactly the harvestable data Ancestry-style tools profit from and the sovereign version must refuse. So the public tier almost certainly must protect the living: likely deceased-ancestors + structure public, living members hidden or pseudonymous until a viewer is verified family, or a per-person opt-in for any public visibility at all. Open questions for the resurface (beyond the ones above): how many tiers (public / verified-family / close-or-explicitly-granted?); what EXACTLY the public tier exposes about living people; and whether "deeper" is cryptographic (encrypt-to-family, real) or a soft gate (weaker). Stage bumped raw -> sprouting; the access model is now concrete enough to prototype against selective-disclosure + family-unit once the standalone earns build time.

Refinement 2026-09-03 (the sovereign-profile model): operator, on what the public sees -- "this falls along the same lines as Facebook and Instagram -- you give certain people access to a lot of information; this is the more sovereign version where you don't share nearly as much for sure, and you have things that are importantly verified by a lot of people without them knowing what that is... follow the same premise as Facebook/Instagram where other people see your profile and what you're about, what you post -- you CHOSE to do that." This generalizes the family tree into a SOVEREIGN SOCIAL PROFILE for the whole identity (the tree is just one surface of it). Three load-bearing principles: (1) FAMILIAR PROFILE MENTAL MODEL -- you have a profile others can look at, and what they see is what you chose to put there, exactly like a social network, so nobody has to learn a new metaphor. (2) SHARE-LESS-BY-DEFAULT / CONSENT-FIRST -- the sovereign inversion of the ad-network default: the baseline is sparse and opt-in, you deliberately choose what becomes public rather than a platform nudging you to overshare. (3) VERIFIED-BUT-BLIND -- "verified by a lot of people without them knowing what that is": claims carry strong social proof (attested/cosigned by many people you trust) while the private CONTENT behind the verification stays yours to grant -- a stranger sees THAT you're vouched-for/real, not the underlying data. This is exactly selective Merkle-leaf disclosure (viewer sees a verified badge, not the leaf) composed with threshold / web-of-trust attestation (many cosigners = the "verified by a lot of people"), which the wallet already has. Blind-layer decision (operator, 2026-09-03, chip): MIX BY SENSITIVITY. Most facts are VIEWER-BLIND -- the public sees "verified by N" without the content, while the people who vouched DID see it when they signed; this is ordinary selective Merkle disclosure + cosigning, which the wallet already has, and is the cheap default. A FEW especially sensitive facts are FULLY BLIND -- vouchers attest without ever learning the content (zero-knowledge), a much heavier build the wallet does NOT have today. Honest build order that falls out: ship the viewer-blind path first (it reuses existing disclosure + threshold-attestation primitives end to end), and treat the fully-blind ZK tier as a later, optional capability reserved for the small set of facts that truly need it -- do not gate the whole profile on the hard cryptography. Each fact carries a sensitivity flag that picks its path.

---

Date: 2026-09-03
Tag: sovereign-trust-ecosystem / vision / web-of-trust / institutional-attestation / governed-group-key / reputation / rotation / heartwood / mycelium / arena
Stage: matured
One-line: The whole thing is ONE GIANT ECOSYSTEM OF SOVEREIGN TRUST -- you accumulate your own verified proof over time, communities and institutions sign your credentials with governed group keys, and its core strength is that a group of people who cryptographically vouch for you cannot be fought.

Operator framing (captured as faithfully as possible): "once you get enough of your own confirmation, anyone who looks at it says 'this guy's got a lot of collected verified proof, that means something to me,' and the other person may say 'that means nothing,' and that's fine. The reason you're collecting your verified fruit -- it'll be done eventually, it will be feeding something. If your town can verify and sign your [credential], you tell other people, and you can prove they signed their autograph on your credentials... if they haven't signed it then you wouldn't be able to prove that and you wouldn't be able to take it, because there's only one town signature, and that town signature is controlled by a group of the aldermen board members and the mayor, and they're the only ones that can authorize the right signature; and when they change that signature, everybody can come and get re-signed by the new one. This trading thing is just a new avenue, a new way to prove and use a person's cryptographic key to interact with Nostr in a way that uses parts that are unknown to other people to mark exact entry and exit and provide a cryptographic chain that cannot be messed with, anchored in the protocol as a hash -- I can prove everything existed and did when it did, and other people about the way they vouched. I just want it to be a giant ecosystem of sovereign trust, and not being able to fight a group of people that will vouch for you."

Grounding + how it lands on what exists:
- ACCUMULATED VERIFIED PROOF ("verified fruit"): reputation that accrues from signed attestations over time, and its value is deliberately SUBJECTIVE -- one viewer weights your collected proof heavily, another dismisses it, both fine. It is not a platform-issued score; it is a portable body of proof each viewer appraises for themselves. This IS HEARTWOOD's judge-weight / web-of-trust reputation, and "it'll be feeding something eventually" is the MYCELIUM/living-ideas frame -- old signed proof is substrate that feeds later fruit.
- INSTITUTIONAL GOVERNED-KEY ATTESTATION (the "town signature"): a community/institution has ONE authoritative signing key controlled by a governed GROUP (mayor + aldermen = a threshold/multisig authority); only that group can authorize the real signature. The institution signs a citizen's credential; the citizen can PROVE the institution signed (verify against the town's published key) and CANNOT fake it (no signature -> no proof -> can't claim it). On ROTATION -- the town changes its key (board turnover, compromise, term end) -- everyone it vouched for can "come get re-signed by the new key," a re-attestation cascade. This maps onto the governance feature (org authorization-tree / threshold join-policy), connections' org memberships, and the wallet's existing key-succession + announcement-outbox machinery (peerSuccession / announcementOutbox already do individual "my key rotated, here's the signed succession, reconcile" -- the town version is the same pattern at an institutional governed-key scale). The published town key + its succession chain is what keeps an old credential checkable and makes a rotation a clean re-sign, not a mass invalidation.
- UN-FIGHTABLE COLLECTIVE VOUCH: the ecosystem's core strength. A single claim is arguable; a GROUP of people who have each cryptographically signed that you are who you say, or that a thing happened, is not something an adversary can argue away -- the signatures are math, the vouchers are many, the proof is portable. This is why "verified by a lot of people" recurs across the family cascading-cosign idea, the sovereign-profile verified-but-blind layer, and this vision.
- THE ARENA / TRADING AS ONE AVENUE: the operator explicitly frames it as "just a new avenue" -- one more way a person's key does something provable on Nostr, here using private/blinded parts unknown to others to mark exact entry/exit as a hash-anchored chain that can't be tampered (the move-chain + truthScore work). It is a SPOKE, not the hub: the hub is the sovereign-trust ecosystem; the arena, the sovereign profile / family tree, credentials, and journal are surfaces on it.

Status: this is the founding thesis, and much of it already lives in HEARTWOOD.md (judge-weight, reputation, governance), MYCELIUM.md (the network + feeding frame), the governance + connections features (org group-keys + memberships), and the rotation/succession machinery -- captured here in one place per the operator's explicit "make sure all those are in there." The one part with the clearest unbuilt shape, when it earns time: INSTITUTIONAL governed-key attestation + rotation-cascade (a town/org signs member credentials with a threshold-controlled key, publishes the key + its succession, members prove the signature and re-sign on rotation) -- the current per-person governance/rotation primitives don't yet cover the institutional-signer scale.

Refinement 2026-09-03 (open-source ethos + the impersonation defense + the weight principle):
- OPEN SOURCE / FORKABLE BY DESIGN: the operator wants this fully open source -- the libraries (tapit-attest, move-chain, the signing method) published so anyone can FORK them and build their own avenues and lanes, collecting their own kinds of proof by signing the same way Nostr signs everything. "We invented nothing" is the whole point: commodity primitives (Schnorr, Nostr events, OpenTimestamps, threshold / web-of-trust), a novel COMPOSITION, and a new way to think about protocols and a group of people all doing the same thing -- exploring what powers that gives and doesn't. This already matches the Wedge Test ("integrate/skip the commodity, don't rebuild it") and the mission ("everything already exists, we are the bridge"). Concrete unbuilt step when it earns time: pick a permissive license (MIT / Apache-2.0) for the reusable libraries, add LICENSE files, and decide the timing of making the repos public -- a deliberate operator action, NOT done yet (repos are private today), and not something to do without an explicit go.
- WEB-OF-TRUST AS IMPERSONATION DEFENSE (the attack model): you can never stop someone from CLAIMING to be you -- anyone can claim anything, same as in the physical world. What they cannot do is PROVIDE the proof: an attacker impersonating you will have a hard time getting attestations from your town, your family, and the people around you, because those real people won't sign for the fake. Anyone to whom the proof means something says "you can't get the proof -- I know those people, I want more proof," and that is enough; the impersonator gets no attention because their chain is empty while the honest person's is full. The defense is not preventing claims, it's that the honest chain OUTRUNS the attacker's -- which is exactly the where-are-the-attack-vectors exploration (ties to the project's attack-list.md).
- WEIGHT = SKIN IN THE GAME + BREADTH OF VOUCHING: credibility scales with two dials -- how much you are willing to put behind it, and how many real people back it. The arena makes it literal: $5 to the devs is cheap and low-weight (you could have done a hundred of those), but $10,000 staked and then winning every trade to six bitcoin by the end of the bull market carries enormous weight. The web of trust is the SAME principle on identity: one voucher is light, your whole town plus family plus friends vouching is heavy. Stake and breadth are the two dials of credibility across every avenue -- the trading arena and the trust graph are the same idea wearing two hats. Note this profile model is bigger than genealogy: it's a candidate shape for how a Tapit identity presents itself to the world generally, with the family tree, credentials, and journal as surfaces on one sovereign profile. Stage: sprouting (the profile framing is a real maturation).


Refinement 2026-09-03 (town key = MAJORITY ATTESTATION + HEAVIEST CHAIN, not a group/threshold key -- prunes the FROST suggestion):
Operator framing: "Town should follow same premise. If majority attest this key it's the new town or new key, then the heavier chain carries the most weight with whoever is signed by that leaf."

This directly answers the "governed group key" gap named in this same entry and in the org-capabilities survey (2026-09-03), and it PRUNES the carpenter's proposed fix. I had proposed closing the gap by adding a real threshold/multisig (FROST-style) KEY that the board collectively holds and rotates. The operator rejected that shape: the town must follow the SAME premise as every other identity in the wallet -- accreted INDIVIDUAL attestations, no special group-held key primitive anywhere. The rules he stated:
- LEGITIMACY BY MAJORITY ATTESTATION: a key becomes "the town key" when a MAJORITY of the town's members have each individually signed an attestation naming that key as the town's. There is no shared secret and no multisig ceremony; the town's identity is just a key that enough members have vouched is the town's. This is `computeWeight` (tapit-attest/core/weighting.ts, ALREADY BUILT: sums the weight of every distinct valid signer who vouched for a subject) pointed at a "this is our town key" claim -- the subject is the candidate town key, the signers are the members, and majority = the winning weight crosses the member set's half-line.
- ROTATION IS THE SAME MOVE: when the town changes its key (board turnover, compromise, term end), the new key becomes legitimate exactly the same way -- a fresh "this is now the town key" attestation that the majority signs. "Everybody can come and get re-signed by the new one" (from the founding thesis) is then a re-attestation cascade against the NEW majority-blessed key, not a group-key rotation ceremony.
- HEAVIEST CHAIN WINS ON A FORK: if two factions each attest a DIFFERENT key as "the town" (a split, a coup, a stale board vs a new one), the tie is broken by weight -- "the heavier chain carries the most weight." Whichever candidate town key has more accumulated attestation weight behind it IS the town, and "whoever is signed by that leaf" -- everyone the winning town key has in turn vouched for -- inherits the town's authority/weight through it. This is heaviest-weight-wins consensus (the same shape as Bitcoin's heaviest-chain rule, applied to social attestation weight instead of proof-of-work), NOT a hard-coded roster gate.

Why this is the RIGHT call and a strong fit: it keeps ONE premise across the whole ecosystem (individuals, families, orgs, towns are all just accreted signatures + weight), it needs NO new cryptographic primitive the wallet lacks (computeWeight + the existing succession/announcement machinery + the governance auth-rule already compose into it), and it degrades honestly -- a contested town isn't a broken multisig, it's just two chains where the heavier one wins and observers can recompute which that is. It also means a town, a church, and a family are the SAME construct at different scales, which matches the operator's "you can turn every wallet into an organization."

The one real design question it opens (surface as chip-form next): what defines the WEIGHT that decides majority and the heavier chain? computeWeight already takes a `signerWeights` map, so BOTH are expressible -- (a) ONE-MEMBER-ONE-VOTE (every member weight 1, majority = headcount, simplest and most "town-like"), or (b) STANDING-WEIGHTED (each member's own accumulated verified proof sets their vote weight, so a long-trusted elder outweighs a day-old member, richer but recursive and gameable if bootstrapped wrong), or (c) ROLE-WEIGHTED (mayor/aldermen carry more, closest to the literal town-board framing but reintroduces named roles the current org model deliberately avoids). This is the crux of how a town resolves a contested key and should be the operator's pick before this earns build time. Stage: the ecosystem entry stays matured; this refinement makes the town-signature piece concretely buildable on EXISTING primitives (the FROST gap is pruned) -- the remaining unbuilt work is a "declare/attest the town key" + "majority resolves + heaviest-chain-wins" evaluator over computeWeight, not a new key type.

Refinement 2026-09-03 (the town key is PLACE-ANCHORED and proven by MASS IN-PERSON MUTUAL EXCHANGE -- headcount weight, hard to fake by physics not just math):
Operator framing: "The key would live in the town hall and you go up there and you can sign the QR code or whatever to attest that that key is the same key that you belong to, and they will sign yours saying that you are who you say you are after they verified your citizenship to their town in their own way -- and that's that independent verified proof that you belong to that town, and it's because you in the town agreed. If 2000 people go up to the town and sign the same QR code at the same courthouse at the same time (and same whatever) then that is proof that that is the key, and that's gonna be hard to fake -- not everybody else is gonna [attest] that they went up to the courthouse and signed the key, or up to the church and signed the church key, or wherever the key needs to live / where the QR code needs to live that everybody already agreed that that's where it lives. It's just proven that you're a part of that by the cryptographic proof of signing with those people and exchanging the signing."

This CONCRETIZES the prior "majority attestation + heaviest chain" refinement and effectively picks the WEIGHT model: it is HEADCOUNT (one-citizen-one-signature, "2000 people") -- NOT standing-weighted or role-weighted. But the load-bearing addition is that the anti-fake strength is PHYSICAL and PROCEDURAL, not purely cryptographic weight:
- PLACE-ANCHORED KEY: the town key lives at a fixed, publicly-agreed location -- the town hall / courthouse / church -- as a QR everyone already agreed is THE spot. "Where the key lives" is itself a piece of common knowledge the town establishes. The canonical location is what lets a newcomer or outsider know which key is the real one.
- MUTUAL / BIDIRECTIONAL EXCHANGE: you sign THEIR QR (attesting "this key is my town's key, I belong to it") and they sign YOURS (attesting "this citizen is who they say, we verified their citizenship OUR OWN WAY"). Both directions in one visit. This is EXACTLY the wallet's existing Tier-P in-person handshake shape (HandshakeModal's 3-QR ceremony: show code / scan their code / co-sign a mutual in-person relationship) -- the town-key version is that same mutual-cosign done between a citizen and the town key at the agreed place.
- MASS CO-PRESENCE IS THE MOAT: legitimacy of a key = the number of real citizens who physically went to the agreed place and did the exchange. Two thousand real, in-person, mutually-signed exchanges at one courthouse is hard to fake because you cannot conjure two thousand real verifiable people to a place -- the cost is in the physics of turnout, not in the cryptography. This is the "heavier chain wins" rule made concrete: the heavier chain is the one backed by more genuine in-person exchanges anchored to the agreed spot.
- CITIZENSHIP VERIFICATION STAYS A HUMAN TOWN PROCESS: "after they verified your citizenship to their town in their own way" -- the software does NOT decide who is a citizen; the town does, however it already does (records, residency, whatever). Tapit only RECORDS the resulting mutual signature. This is the honest boundary: the wallet is the ledger of the exchange, not the arbiter of citizenship.

How it lands on EXISTING primitives (this is buildable on what's here, no new crypto, FROST stays pruned): Tier-P in-person mutual handshake (HandshakeModal) = the citizen<->town exchange; a published "town key + where it lives" attestation = the agreed-place anchor (so the canonical location and current key are provable, not word-of-mouth); computeWeight with EQUAL signer weights = the 2000-headcount tally; the existing succession/announcement machinery = how a rotation is announced FROM that same agreed spot so citizens know to come re-sign the new QR. The town, church, club, and family are then the SAME construct at different scales -- a place-anchored key that many people mutually signed in person.

Remaining design question for the resurface (lighter than the pruned FROST one): should the town's canonical key-location itself be a signed, published attestation ("the Springfield town key is <pubkey>, it lives at the courthouse QR, as of <date>, and here is its succession chain") so an outsider can VERIFY which key/spot is authoritative and follow rotations -- versus the location staying purely social common-knowledge? Recommend the published-attestation version, because it's what lets the proof travel to someone who was never in that courthouse. Stage: the town-signature piece is now concretely buildable on existing primitives; the unbuilt work is (1) a "town key declaration + canonical location" attestation kind, (2) the mass mutual-exchange tally over computeWeight, and (3) rotation-announce-from-the-anchor reusing succession -- all additive, none requiring a group/threshold key.

Refinement 2026-09-03 (custody is the GROUP'S sovereign choice; recognition is EMERGENT and market-driven -- the software must not prescribe either):
Operator framing: "I think you leave that up to the group that decides to be a part of it. If it's a church, the church board decides and it stays with the secretary for the pastor, has the keys assigned; or in town maybe the treasurer or the mayor has it and they decide that's where they keep it; maybe they split it into a Shamir secret -- who cares, it's their business, they get to do what they want. And if they're a little club all of their own and nobody wants to join it, that just shows there's no support in that town for that type of verification or that type of math, and you're not gonna be able to use that as proof. But the moment a group decides to do it and gains the economic weight and proof and depth, it's gonna be hard for anyone else to prove that if they don't actually have the weight. I can see in the future that people won't even take anything serious unless it gets to a certain [depth] or a certain way -- like it's not even recognized as a verified town yet -- where it only [counts] once it gets to the threshold of what common people accept as not-fake. One company may want [it this way] and this company may want more or less -- either way, get what I'm saying."

This ANSWERS the prior "publish the key location vs word-of-mouth" question by REFUSING to let the software decide it -- and that refusal is the design principle:
- CUSTODY IS THE GROUP'S BUSINESS (do NOT prescribe): the software must NOT hardcode where a town/church/club key lives or who holds it. The group chooses -- single holder (secretary, treasurer, mayor), a board assignment, or a Shamir split (tapit-attest already has shamir.ts), published or kept private, whatever they want. Tapit provides the FLEXIBLE primitives (declare a key, record mutual signings, optionally Shamir-split, optionally publish a location attestation) and lets each group pick its own policy. This is the sovereign inversion applied to institutions: their key, their rules. So neither of the two options I posed is "the answer" -- BOTH must be POSSIBLE, and the group picks.
- LEGITIMACY IS EMERGENT, SUBJECTIVE, AND MARKET-DRIVEN (do NOT hardcode a threshold): a group with no support (a club nobody joins) simply has no usable proof -- not because the software rejects it, but because nobody recognizes it. A group that gains economic weight + proof + depth becomes hard to fake or contest precisely because that weight is real and an impostor can't manufacture it. Recognition crosses a THRESHOLD of "what common people accept as not-fake," and that threshold is SOCIAL, not a constant in the code -- different groups/companies will want it looser or stricter. This extends the already-captured "value is subjective -- one viewer weights your collected proof heavily, another dismisses it, both fine" principle (see the sovereign-trust-ecosystem entry) into a maturity/recognition dimension: a town isn't "verified" by a flag the software sets; it's verified when enough real weight has accreted that observers treat it as real, and that emerges from use.
- DESIGN CONSEQUENCE: build MECHANISM, not POLICY. The buildable pieces stay exactly as the prior refinement named -- a key-declaration attestation, a mass mutual-exchange tally over computeWeight, rotation-announce via succession, optional Shamir custody -- but the software offers them as CAPABILITIES a group composes to taste, and ships NO opinion about custody location, quorum, publish-or-not, or a "recognized" threshold. Any "is this town real enough" judgment is left to the observer's own weight appraisal (subjective, per the founding thesis), never computed as a verdict. This is the honest and sovereign choice and it's cheaper to build (no policy engine to design), which is a rare happy alignment. Stage: the town-signature model is now fully specified as flexible-mechanism-plus-emergent-recognition; nothing here needs a group key, a prescribed custody rule, or a hardcoded legitimacy threshold.

Refinement 2026-09-03 (NO new org/key primitive needed -- the existing attestation pipework + RELAY BROADCAST makes a town key verifiable to a total stranger; self-sovereign responsibility to collect your own proof):
Operator framing: "I don't think we need to build a different organization or key, as long as the pipework is there to have everybody attest that that key name and that identity, that signer that's being used at that time -- the public key -- is the one that we shared. And like we talked about, the town could have a Nostr relay and broadcast their QR, their public key, out, and maybe somebody in Florida could verify what the local town 300 miles away is and see all the economic weight behind it and know that that's the real QR code, and that someone claiming to be from there must be from there. It would be impossible to fake even though they know nobody from there. You don't have to trust-me-bro or anything -- you can verify everything on chain, and maybe that gives you something good in the place you're at, or maybe not; but you're the one responsible for collecting the proof and the relationships and the attestations that benefit you the most."

This is the CLOSING confirmation of the whole town-signature thread and it settles the build posture: DO NOT build a new organization construct or a new key type. What's needed is only that the PIPEWORK exists for everybody to attest "this public key / this identity / this signer is the one we shared," and for that shared key to be broadcastable so a stranger can verify it. Grounded against what's actually in the repo (checked 2026-09-03):
- "EVERYBODY ATTESTS THE SHARED PUBLIC KEY" -- ALREADY EXISTS. Org self-declaration (connections/createOrganization.ts: a key signs "I am this org" about itself), membership attestations, and relationship/handshake cosigning all NAME a pubkey and are individually signed; computeWeight (tapit-attest, built) tallies the distinct valid signers. So a town key accreting many citizen attestations, and anyone recomputing the weight behind it, is standing pipework -- no new primitive.
- "BROADCAST THE QR/PUBLIC KEY OVER A RELAY SO FLORIDA CAN VERIFY A TOWN 300 MILES AWAY" -- the transport CAN already broadcast public, unencrypted, world-readable events (livenessChannel TAPIT_LIVENESS_KIND 9575 and moveChannel MOVE_EVENT_KIND 9584 are exactly this pattern: buildEvent -> publish on a public kind -> anyone subscribes + verifies, key never leaves the wallet). The ONE piece not wired today is a dedicated "here is our town key + the corroborating citizen attestations behind it" public broadcast that a distant, unknown verifier subscribes to -- but it is the SAME SHAPE as moveChannel (a new public kind carrying the org self-declaration + its membership/vouch attestations), so it is ADDITIVE on proven transport, not a new capability. That broadcast is what makes the proof travel to someone who knows nobody in that town: they pull the town key, recompute the economic/attestation weight behind it on chain, and know both that the QR is real and that a person claiming that town, if their membership verifies against that key, must actually be from there -- impossible to fake without the real weight, and requiring zero trust in any claimant ("don't-trust-verify, everything on chain").
- ROTATION reachability rides announcementOutbox / peerSuccession (already built for individual key-rotation announce-and-reconcile) at the town scale.
- THE SELF-SOVEREIGN RESPONSIBILITY PRINCIPLE (worth preserving verbatim as ethos): "you're the one responsible for collecting the proof and the relationships and the attestations that benefit you the most" -- and the weight you collect "maybe gives you something good in the place you're at, or maybe not." Nobody issues you standing; you accrue it by the relationships you actually build and the attestations you actually gather, and its value is the observer's to appraise (ties straight back to the founding "value is subjective" thesis). The wallet's job is to make collecting and verifying that proof easy and trustless, never to grant or score it.

NET BUILD POSTURE for the town-signature ecosystem piece when it earns time: ZERO new key/org/threshold primitives. The only additive work is a public "town-key + its corroborating attestations" broadcast channel (a new public Nostr kind, mirroring moveChannel) so distant strangers can subscribe, pull the key, and recompute its weight on chain -- everything else (attesting the shared key, tallying weight via computeWeight, in-person mutual Tier-P exchange, Shamir-optional custody left to the group, rotation via succession) is already standing pipework. FROST/group-key: pruned and confirmed unnecessary.

Refinement 2026-09-03 (SHIP THE FRAMEWORK, not the feature -- the group runs its own thing; wrote TRUST_FRAMEWORK.md):
Operator framing: "The broadcast channel is something the town will do eventually when the time comes -- they are responsible for doing their own thing, and we can come up with the framework and put it in the repo for a town to follow, or a church, or an organization. This is what you would do, this is how you would do it, this is how you would start collecting your proof to be your town and start your attestation journey. I know it's dorky and nerdy and 0% of people are interested in anything I'm talking about, but I still like messing with it and providing it, even if it never gets adopted -- and it just might provide value somewhere that companies may fail or governments may fail to give you the validation that you need."

ACTED ON, not just logged: wrote TRUST_FRAMEWORK.md at the repo root (linked from README's thesis section). It is the forkable playbook -- "here's how you'd do it" -- for a town/church/club to form its own signature: the one principle (a group signature is accreted individual signatures + weight, no group key), then the steps (0 decide you're a group; 1 declare the group key via the existing org self-declaration; 2 custody is the group's own business incl. optional Shamir; 3 members mutually sign, in-person Tier-P strongest; 4 weight accrues by headcount, recomputable by anyone via computeWeight; 5 broadcast the key over a relay WHEN/IF the group chooses -- the group builds/forks that piece itself, pattern = moveChannel; 6 rotation via the existing succession machinery, heaviest chain wins a dispute), then the honest what-it-does/doesn't (records signatures, never grants standing, value is the observer's to appraise), and the why (validation when companies/governments fail you). Every cited code path was verified to exist before writing. This crystallizes the build posture the whole town-thread converged on: TAPIT SHIPS MECHANISM + A PLAYBOOK, THE GROUP SHIPS ITS OWN POLICY AND (WHEN READY) ITS OWN BROADCAST. Nothing new to build in the wallet for this; the doc IS the deliverable, and the one future code piece (a public town-key broadcast channel) is explicitly the group's/fork's to add, not a product feature. Ethos captured verbatim: he likes providing it even if 0% adopt it, because it might give validation where institutions fail -- that is the mission ("if it only ever works for one family it already succeeded") applied to groups. Stage: fruiting body (a real, shipped, forkable artifact came out of the idea).

Date: 2026-09-03
Tag: nostr-positioning / interop / NIP-46 / NIP-07 / NIP-05 / NIP-58 / competitors / go-to-market
Stage: sprouting
One-line: How Tapit sits next to Primal/Damus/Amethyst on Nostr -- same keys, orthogonal job (attestation layer, not a feed) -- and the concrete interop levers (be/accept a NIP-46 signer, NIP-07, NIP-05, propose the custom kinds as NIPs).

Operator framing: "Compare the Primal Nostr experience and Damus and the other masters -- how they're using Nostr and how Tapit uses Nostr private keys to do what it does. Where are they similar, where do they overlap, where does the relationship belong? How is a Nostr person who's already involved gonna view it, how does it integrate into the tools already used on Nostr and the ideas of Nostr, and is there anything else like that out there?"

Grounded comparison (Tapit side verified in code this session):
- WHAT THE SOCIAL CLIENTS DO: Primal (fast cached client + built-in wallet/zaps), Damus (iOS), Amethyst (Android) use Nostr as a censorship-resistant SOCIAL MEDIA protocol. The key (nsec/npub, BIP340/secp256k1) is your login + byline; it signs PUBLIC kind-1 notes, kind-3 follows, reactions, zaps. Product = a timeline. Nostr = decentralized Twitter substrate.
- WHAT TAPIT DOES: same keypair type, same relays, same NIP-44 v2 / NIP-17 gift-wrap crypto -- but the key signs ATTESTATIONS (facts, relationships, credentials, agreements) on a Merkle field tree, mostly ENCRYPTED + p-tag-addressed, not broadcast to a feed. Nostr = a private encrypted TRANSPORT + anchoring rail, not a timeline. Custom kinds: 9573 attestation envelope (NIP-44, addressed), 9575 liveness/duress, 9584 public move-chain; plus standard kind-0 profile + kind-1 "Share to Nostr" + NIP-17 chat (13/14/1059); NIP-46 reserved for the app-to-wallet sign pathway. Keys never leave the wallet; relays see only ciphertext for private data; default relays replaceable.
- SIMILAR: identical key crypto, identical relays, identical NIP-44/NIP-17 encryption, identical hold-your-own-keys / no-platform / censorship-resistant ethos.
- OVERLAP (already interoperable): a Tapit npub IS a real Nostr npub; Tapit imports an existing nsec, publishes kind-0/kind-1, and speaks NIP-17 DMs -- so a Damus user can follow a Tapit identity, a Shared journal note lands in their feed, and DMs cross between any NIP-17 client and Tapit. Not a walled garden; additive.
- WHERE THE RELATIONSHIP BELONGS: Tapit is NOT another feed client competing for scroll attention. It is the IDENTITY / REPUTATION / CREDENTIAL / RECOVERY layer beside or beneath the social clients. Nostr's native identity is thin -- an npub + a NIP-05 DNS handle + a follow graph; there's no native private credential, no off-platform-fact proof, no social key recovery, no selective disclosure. Tapit fills exactly that gap (private selectively-disclosed Bitcoin-anchored attestations + Shamir social recovery + being the signing hub other apps connect to). Complementary: keep scrolling in Damus, hold your verifiable life in Tapit.

How an existing Nostr person views it (honest, both sides):
- LIKELY YES: same keys I already own, bring-my-nsec, publishes standard kind-0/1 + NIP-17, keys never leave device, censorship-resistant, no new account -- and it finally adds verifiable credentials + social recovery + selective disclosure that vanilla Nostr lacks. Strong values-fit with the self-custody crowd.
- LIKELY FRICTION: (a) Supabase for the encrypted-blob sync will make a purist squint -- answer: ciphertext-only, RLS-scoped, replaceable, data portable, keys never there. (b) "Why custom kinds 9573/9575/9584 instead of NIPs?" -- some already map to standards; the custom ones are for things with no NIP yet; worth PROPOSING them as NIPs so other clients can read Tapit attestations. (c) The sharpest one: a Nostr native already has a SIGNER they trust (Amber via NIP-46, Alby/nos2x via NIP-07) and won't want Tapit to hold a SECOND key -- they'll ask to keep their key in their bunker and let Tapit be a client, or to make Tapit a bunker other apps use.

THE CONCRETE INTEROP LEVERS (the real answer to "how does it integrate"):
1. NIP-46 both directions: (a) let Tapit ACCEPT an external NIP-46/NIP-07 signer so a Nostr native keeps their key in Amber/Alby and Tapit drives it; and/or (b) make Tapit ITSELF a NIP-46 bunker other Nostr apps connect to -- Tapit's own Layer-2 SignRequest->approval->SignGrant pathway is conceptually already a private NIP-46; aligning it with the real NIP-46 wire would make Tapit a drop-in signer for the whole Nostr client ecosystem. This is the highest-leverage integration.
2. NIP-05 (already in README "next cuts"): give a Tapit identity a human-readable handle other clients recognize.
3. Publish the attestation/liveness/move kinds as NIPs (or map onto NIP-58 badges where they fit) so third-party clients can READ Tapit proofs.

Anything else like it (as of ~2026):
- ON NOSTR, adjacent but lighter/public: NIP-58 badges (issuer-signed achievements, kinds 30009/8/30008 -- coarse, public, no recovery); NIP-05 (DNS identity); Vertex / NIP-101 / trust-graph services (web-of-trust SCORING over the NIP-02 follow graph); the Nostr DID method (nostrcg did-nostr) bridging Nostr keys to W3C DIDs/Verifiable Credentials. None combine private selective disclosure + social recovery + Bitcoin anchoring + key-holding wallet-as-hub.
- OFF NOSTR (DID/VC world): SpruceID, Microsoft ION/Sidetree, Polygon ID / Iden3, cheqd, Dock, Trinsic (W3C DIDs + VCs, often enterprise/chain-anchored, heavy); proof-of-personhood/sybil (BrightID, Idena, Gitcoin Passport, Worldcoin); Keybase (proofs, mostly dormant post-Zoom). All overlap on "verifiable identity/credentials" but are heavier, chain/enterprise/token-shaped, not Nostr-native, and not a hold-your-own-key personal/family wallet with social recovery + selective disclosure.
- HONEST POSITIONING: every primitive exists somewhere (that IS Tapit's own "we invented nothing" thesis), but the specific COMPOSITION -- on Nostr keys, for an ordinary person/family, private selective-disclosure attestations + Shamir social recovery + Bitcoin anchoring + being the signing hub -- has no direct twin I know of. Closest neighbors are the Nostr WoT/badge/DID efforts (lighter, public, no recovery) and the W3C DID/VC stacks (heavier, not Nostr-native, not a family wallet).
- CUTOFF CAVEAT: ecosystem knowledge is ~Jan 2026 + a few Sept-2026 web checks; verify current project states before quoting them to anyone.

Not a build directive -- an orientation capture. If it earns build time, the NIP-46-both-directions lever is the single highest-leverage Nostr-integration cut, and proposing the custom kinds as NIPs is the credibility move with the Nostr dev crowd.
