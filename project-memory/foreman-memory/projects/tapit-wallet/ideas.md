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
