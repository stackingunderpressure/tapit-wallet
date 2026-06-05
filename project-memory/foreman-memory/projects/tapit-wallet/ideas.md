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
