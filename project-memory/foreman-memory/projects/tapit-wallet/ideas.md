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
