# BRIEF — Diary-First Wedge + Mycelial Recovery Design

**For:** Tapit Wallet Carpenter (stackingunderpressure/tapit-wallet)
**From:** Operator + AppCommander session (Tom + Claude), 2026-05-21
**Companion to:** `CLAUDE.md` (thesis-style root doctrine for this
wallet), `DISCOVERY.md` (the app's DNA), `PLAN.md` (the phased
roadmap), `tapit-attest/README.md` (the crypto core, 76 tests green).
**Status:** Feature brief — suggestions, not job orders. The wallet
Carpenter decides how and when to ship each piece.

This brief synthesizes a long operator session covering: the
diary-first reframing of the wallet's wedge, the Mycelium 5-layer
identity model, the six attestation kinds and three trust tiers,
what AI impersonation defenses the architecture provides and what
it does not, the "no better plan" competitive landscape, the
Shamir-based mycelial recovery design (including the operator's own
sharpening that removed the need for any pre-stashed recovery key),
the OpenTimestamps anchoring story, the honest caveats, and how it
all maps onto the existing PLAN.md phases.

---

## 1 — The thesis reset (read this first)

Earlier doctrine framed Tapit Wallet as a sovereign identity wallet
that competes with platforms. That framing is correct long-term but
wrong as the wedge. The wedge is much smaller, much more selfish,
and much more inevitable: **the wallet is a cryptographically
signed, time-anchored personal diary that gets quietly corroborated
by the people who matter in your life**. Nothing more on day one.

When is keeping a private encrypted diary ever a bad idea? Never.
When is keeping that diary in a tamper-evident chain anchored to
Bitcoin's clock ever a bad idea? Never. The diary is silent by
default and weaponizable only at the moments you choose to surface
a specific receipt. Ten years from now you can wield exactly the
record you need, and the rest of the collection stays private. If
a record is in your favor, you have proof. If a record is not in
your favor, you stay silent and nobody can compel you to disclose
what no one knows exists.

The selfish use case spreads on its own. **We are not making money;
we are starting the mycelium spores.** Every adopter has their own
private reason to use the tool, and every adopter becomes a carrier
for the network without anyone needing to evangelize it.

**The Bitcoin parallel from 2010** is the template here. Bitcoin's
original thesis was never "let us overthrow fiat." That came later.
The original thesis was "weird internet money I can use to tip a
forum user," and a thousand small selfish uses became a substrate.
This wallet's thesis on the same template is "weird private diary
I can use to remember what I said and when," and a thousand small
selfish uses become Mycelium.

**Implications for the wallet Carpenter:**
1. **Frictionless is the only criterion.** A diary harder to use
   than Apple Notes will not spread. UX outranks every other product
   virtue. If a non-technical user cannot make their first signed
   entry inside two minutes, the wedge fails.
2. **Solo-use first, social-use second.** The wallet must be useful
   on day one with zero peers. Personal diary entries, signed and
   anchored, are the day-one product. Peer attestations and the
   mycorrhizal layer are layer-two bonus value that accrues over
   time, not preconditions.
3. **The doctrine in CLAUDE.md stands.** Smallest useful thing
   correctly, one vertical slice end to end, gates green before
   claiming done. Stay loyal to that harder than to the doctrine
   when the two pull apart.

---

## 2 — The Mycelium frame (five identity layers)

The Mycelium is the network of wallets, called Hearths in the
doctrine. There is no central server, no Tapit Incorporated.
Identity grows like a tree's root system in five layers:

1. **Taproot — your keypair.** The secp256k1/Schnorr keypair the
   wallet generates on first run. By construction Nostr-compatible
   (same curve). At this layer the operator could claim to be
   anyone; the substrate does not police self-claims because no
   one else can either. **The diary works at this layer alone** —
   day-one value with no network needed.
2. **Mycorrhizal partnerships — the five-to-twenty.** People who
   actually know you in real life sign attestations confirming
   your key is your key. PGP's web-of-trust idea, but with the
   wallet handling the crypto plumbing silently so the operator
   only has to add a friend.
3. **Hyphal lattice — transitive trust.** If A trusts B and B
   trusts C, the math shows you a verified path A→C at appropriately
   discounted confidence. Multiple independent paths agreeing is
   stronger than one. Each wallet maintains its own local view of
   the lattice; no master view exists.
4. **Anchoring rings — growth rings.** Every meaningful action
   produces a signed receipt. Receipts get batched and stamped
   into Bitcoin via OpenTimestamps, creating a tamper-evident
   public clock. Over years, your wallet's anchored history becomes
   durable like tree rings — auditable without trusting the
   originator.
5. **Forest consensus — soft societal agreement.** After enough
   years of layer four, the network as a whole reaches a soft
   consensus that you are who you say you are, not because any
   authority blessed you but because thousands of independent
   verifiable receipts agree. Emerges from sustained operation;
   not shippable on day one.

The wallet's diary feature lives at **layer one** (anchored
personal entries) and **layer four** (every entry gets anchored
into Bitcoin's clock). Mycorrhizal partnerships (layer two) and
the recovery cascade (layer three) accrue over time as users add
peers.

---

## 3 — What the architecture is and is not

### The six attestation kinds (one envelope, six meanings)

Every attestation in tapit-attest fits the same envelope shape:

| Kind | Meaning | Day-1 wallet use |
|------|---------|------------------|
| `identity` | A public key belongs to a real person with a name | Peer add ("Bree's key is X") |
| `relationship` | Repeated signed acknowledgment two people know each other over time | Auto-emitted as peer interactions accumulate |
| `credential` | Something earned or completed (degree, license) | Operator records a personal credential they were issued |
| `prediction` | A future claim, anchored before the event | Operator commits to a future prediction privately |
| `agreement` | A multi-party contract co-signed | Marriage agreement, contractor contract, kid-pickup authorization |
| `meta` | Repudiation / revocation / key-succession / private diary entries | The default kind for personal diary entries |

The kind is a label, not a code path. **One envelope shape carries
all six.** Add a `journal` kind if the operator's UX needs cleaner
semantics for diary entries; otherwise reuse `meta`.

### The three trust tiers (dials, not branches)

`routine`, `notable`, `high_stakes` are configuration dials on the
same envelope, never separate code paths:
- `requiredSigners` — minimum distinct signatures
- `minSignerWeight` — minimum summed signer weight
- `finalityWindowMs` — how long an attestation stays pending before
  becoming final
- `requireCoSign` — whether a lone signer is ever enough

`evaluateTier` runs identical logic for all three tiers. If a tier
needs its own branch, that is a bug. **Important crossover detail:**
the three tiers also map cleanly onto three recovery schemes (see
section 7). The dial that names how trusted a record is doubles as
the dial that names how recoverable it is.

### The Merkle field tree (selective disclosure)

The claim inside every attestation is laid out as a Merkle field
tree, which lets a future verifier prove ONE field of the claim
without revealing any others. The proof is mathematically anchored
to the original signature. This is the feature that makes the diary
truly weaponizable on operator's terms — surface exactly the
receipt you need, prove the specific field you want, the rest of
the entry stays sealed.

Example: a medical record could live in this envelope and the
operator could prove they are over 21 at a bar without revealing
their name, address, or birthday. The bar verifies the signature
against the Merkle root containing the age field; everything else
is sibling-hashes that hide content while preserving the proof.

### Math, not trust (the third thesis principle)

Other wallets and apps verify a Tapit attestation by checking
signatures, not by trusting a platform. The platform layer is
removed from the trust equation. **This is the deepest claim the
architecture makes.** The wallet's job is to produce signed records;
the math is what makes them defensible.

### "Nostr is the wire, not the brain"

Nostr (Notes and Other Stuff Transmitted by Relays) is the chosen
transport for Layer 2 inter-app signing, Layer 3 peer messaging,
and recovery cascades. Same secp256k1 curve as tapit-attest, so
the wallet's existing keypair IS a valid Nostr identity by
construction — no new identity layer to wire.

But Nostr contributes none of the cryptography (that is
tapit-attest's, ported from decades-mature standards), none of the
trust model (that is Mycelium's, the five-layer design), none of
the anchoring (that runs on Bitcoin via OpenTimestamps), none of
the peer-recovery rebuild protocol, and none of the selective
disclosure. **Strip Nostr out tomorrow and replace it with a
different transport, and every cryptographic guarantee in the
architecture keeps working.** That is why the SignRequest /
SignGrant / HoldRequest message shapes stay transport-agnostic in
the shared library — Nostr is today's wire, not the only one.

The architecture's defensive primitives are all in tapit-attest.
The architecture's communication primitives ride on Nostr in v1.
That separation is load-bearing and the wallet Carpenter should
preserve it in every module boundary.

---

## 4 — What AI impersonation defenses the architecture provides and does NOT

This deserves a clear-eyed section because it will come up.

### What the architecture closes

- **Forged signatures in your name.** A Schnorr signature over your
  content cannot be produced without your private key. AI can write
  text that sounds like you; it cannot produce the signature that
  makes the text count. When a verifier checks, AI-generated text
  without your signature fails the math, full stop.
- **Backdated forgeries.** OpenTimestamps anchoring binds an
  attestation to a Bitcoin block height. AI generating fake content
  today cannot produce a year-old anchored receipt because the
  Bitcoin block at that height does not contain its hash.
- **Forged credentials.** A claim that "Tom has a Stanford PhD"
  only matters if Stanford signed the Merkle root containing that
  field. AI cannot fake Stanford's signature.
- **Reputation forgery by fresh keypairs.** AI signing valid
  content with a fresh keypair produces a key with zero
  mycorrhizal partnerships, zero anchored history. The hyphal
  lattice's transitive discounting means small fake networks of
  mutually-signing AI wallets do not produce strong-confidence
  paths to anyone real.
- **Post-theft impersonation.** If your key is stolen and the
  attacker starts signing as you, the meta-kind revocation +
  succession-chain primitive lets you publish a revocation and
  successor-chain to a new key. Every verifier sees old signatures
  are post-revocation and weights them at zero.

### What the architecture does NOT close (be honest about this)

- **Unverified channels.** AI can write a fake quote from you and
  post it to a news site, a tweet, a Wikipedia citation, a Slack
  channel — and none of those surfaces verify signatures today.
  The wallet defends people who are LOOKING for a signature; it
  does not force the world to look. This is the largest residual
  gap.
- **The cold-start gap.** A brand-new wallet on day one has no
  partnerships and no history. An AI-generated fake-Tom wallet
  looks roughly the same as real-Tom on day one. Defense only
  hardens once real relationships have been signed.
- **Sybil resistance.** AI can spin up infinite wallets cheaply.
  The architecture has no proof-of-personhood mechanism, does not
  biometrically link a wallet to a human, does not solve "is this
  key behind a real person." Layer five forest consensus might
  harden over years but is not deployed.
- **AI content INSIDE a real signed attestation.** If the operator
  signs "I read this article and endorse it" and the article is
  AI-generated, the signature is valid but the underlying content
  is synthetic. The architecture certifies you endorsed it, not
  that you understood it or that it reflects reality.
- **Coercion.** A gun-to-head signing is mathematically valid. The
  plain-English approval screen helps against accidental coerced
  signing but a determined attacker with physical access defeats it.
  Succession-chain helps recover; nothing prevents in the moment.
- **Key theft from a compromised device.** Malware that extracts
  the encrypted wallet plus the password is outside the wallet's
  scope.
- **Truth itself.** Math proves who signed, not whether what was
  signed is true. A signed prediction that the Earth is flat is a
  cryptographically valid record of you having said that. Truth is
  downstream of speech; the architecture is about speech.

**Honest framing for the user:** "This wallet does not stop AI
from generating content in your name. It gives the rest of the
world a way to tell the difference when they decide they want to
know." The bet is that as AI-generated content becomes the default
and verification becomes scarce, the people who care about being
real will want a way to prove they are the source.

---

## 5 — The "no better plan" competitive landscape

The operator's correct rhetorical move: **does anyone have a
better plan that preserves the first principle (you own your
identity, no platform)?**

| Alternative | What it does better | What it costs |
|-------------|---------------------|---------------|
| Apple / Google hardware attestation | Secure enclave makes key theft genuinely harder | Walled garden; identity stops at the platform boundary |
| Worldcoin | Iris-scan proof-of-personhood, real sybil resistance | Global biometric database; privacy + accessibility nightmares |
| Government ID | Sybil + legal identity solved | Centralizes around states; defeats the premise |
| W3C verifiable credentials | Standardized envelope | Stuck in enterprise pilots for a decade; never reached a phone |
| Sovrin / uPort / SSI | First-principles compatible | Same place we are starting from; no consumer adoption |
| Bluesky AT Protocol | Pushes in the right direction | Narrower scope (one social product), still platform-shaped |
| Trezor / hardware wallets | Genuinely better key isolation | Optional layer the wallet COULD adopt without changing thesis |

**The architecture is choosing correctly on the meta-problem and
accepting being weaker on the sub-problems.** The sub-problems can
be ameliorated over time inside the architecture (hardware
attestation as an optional layer; proof-of-personhood as a
high-confidence attestation kind; duress mechanisms inspired by
hardware wallets). The centralized alternatives cannot be
ameliorated inside theirs without ripping out the centralization,
which is what they ARE.

**The right answer to every gap is: that gap is real, the
centralized alternatives that close it close it by becoming the
thing we exist to replace, so closing the gap their way costs the
first principle. We would rather keep the first principle, ship
the imperfect answer, and let the network grow into the gap over
years.** Anyone who has a better plan that keeps the first
principle should publish it tomorrow and the world will adopt it.
Until they do, this plan IS the better plan.

---

## 6 — Feature suggestions, organized by wallet layer

### Layer 1 — Wallet core (already built in tapit-attest)

The `Wallet` class with keypair, succession chain, encrypted
backup, sync, peer recovery, and the six attestation kinds is
proven (76 tests green). Nothing to rebuild. **Consume it cleanly,
never re-implement.**

### Layer 2 — The diary surface (the wedge)

**Personal-diary feature suggestions:**

- **One-tap signed entry.** A "new entry" composer that takes
  free-text plus optional structured fields and produces a signed
  attestation with the operator as both signer and subject.
  Default kind: `meta` (private note) or a new `journal` kind if
  cleaner. Default tier: `routine`.
- **Anchoring as a background detail.** Each entry gets queued for
  OpenTimestamps anchoring; the UI shows a small pending →
  confirmed badge with eventual Bitcoin block height. The operator
  never has to think about anchoring.
- **Selective recall.** A "show me a specific receipt" surface
  where the operator can search their own attestation history by
  date, kind, peer, or free-text keyword, then export a single
  attestation with a Merkle sibling-hash proof for selective
  disclosure. Surface one receipt at a time; never dump the archive.
- **Plain-English approval on every signed envelope.** Before any
  attestation is signed, the wallet shows the operator a
  plain-English rendering of what the signature commits them to.
  No raw JSON, no cryptographic jargon. "You are signing: 'I had
  dinner with Bree on May 20, 2026 at her house.' Hold-to-sign."
- **The approval screen is the product.** PLAN.md explicitly tells
  the Carpenter not to treat the approval screen as plumbing. If
  the user does not understand what they are about to sign, the
  wallet is unsafe even if the math is perfect. Iterate on this
  screen with real users in front of you.

**Inter-app signing (PLAN.md Phase 3):**

- **Nostr NIP-46 transport.** Decision D-06 already named this.
  The wallet listens on relays for SignRequest events, presents
  them to the operator with a plain-English summary, returns a
  SignGrant on approval.
- **Transport-agnostic message shapes.** Keep the SignRequest /
  SignGrant / HoldRequest types in tapit-attest as
  transport-agnostic types so a different wire can replace Nostr
  in five years if needed.
- **Multiple relays by default.** Connect to a healthy set out of
  the box; let the operator add more. Relay availability +
  relay-censorship resistance comes from plurality.

### Layer 3 — The Mycelium peer layer

**Mycorrhizal partnership feature suggestions:**

- **Add a peer in one tap.** Operator scans a QR code or enters a
  Nostr public key, the wallet sends an identity-kind attestation
  proposal, the peer's wallet accepts and counter-signs, both
  wallets now hold the relationship attestation. The operator
  never sees a public key fingerprint unless they ask.
- **The peer holds what they touched, automatically.** Every
  attestation involving a peer (subject, signer, or co-signer)
  lands in their wallet's holdings on creation. The tapit-attest
  envelope already supports this; the wallet just has to expose it.
- **Recovery surface scales with the network.** Each peer becomes
  a potential Shamir-share holder for the operator's recovery
  scheme. See section 7.

### Layer 4 — The wallet bot

**Conversational guide suggestions:**

- **Bot reads attestations on the operator's behalf** and
  summarizes them in plain English for approval. It does NOT sign
  anything autonomously — the operator's hold-to-sign gesture is
  the only thing that can produce a signature.
- **Bot guides the first-entry ceremony** — a one-minute
  walkthrough that produces the operator's first signed diary
  entry and proves end-to-end that the wallet works. This is the
  conversion moment; it has to feel inevitable.
- **Bot prompts re-sharing moments** at the right times (peer
  added, peer rotated out, stakes growing).
- **Bot is not the security primitive.** The math is. The bot is
  friction layered on top of the math to add verification surface
  during ceremonies. If the bot is compromised or hallucinates,
  the plain-English approval screen is the last line of defense.

---

## 7 — The recovery design (read this carefully)

The deepest piece of the conversation and the most important
single design decision the wallet has not yet made. This design
goes through several refinements; the final shape (the operator's
own) is at the bottom.

### The asymmetry that makes this work

- **Day 3 loss:** zero history yet, zero peer network yet, zero
  cost. Operator spawns a new wallet, picks up where they were.
- **Year 5 loss:** large history, but large peer network too. The
  same network that earned the operator their reputation also
  carries the recovery surface. Bigger trail of "snail slime" =
  bigger recovery network. **Anti-fragile by construction.**
- **The middle zone does not exist.** Attestations only accumulate
  through peer interactions. You cannot have substantial history
  without also having peers. The two grow in lockstep.

### Shamir's Secret Sharing as the recovery primitive

Use **Shamir's Secret Sharing (SLIP-0039, Trezor's production
implementation)** as the recovery primitive. The math splits a
secret S into N shares with threshold K. Any K shares reconstruct
S. Any K-minus-one or fewer reveal nothing — mathematically zero
information. Each peer holds one share, blind, without
understanding what they hold.

Three axes the operator can scale on as their stakes grow:
- **N** (total shares distributed): start small (3-5 peers),
  grow to the size of the operator's mycorrhizal lattice.
- **K** (reconstruction threshold): security / coordination dial.
  Higher K resists coercion; lower K is easier to recover.
- **Multiple parallel schemes per trust tier.** The three trust
  tiers already in tapit-attest map cleanly onto three different
  Shamir splits. Routine: K=2 of N=5. Notable: K=4 of N=10.
  High-stakes: K=7 of N=15. **The dial that names how trusted a
  record is doubles as the dial that names how recoverable it is.**

Use **hierarchical groups (SLIP-0039 groups)** to mirror real
social topology — family group, friends group, professional group,
any M of these groups can recover, where each group internally
requires its own internal K.

Support **re-sharing** so the share set can evolve over time
without changing the underlying secret. Adding a peer, removing a
peer, increasing K — all handled cleanly by the math primitive.
The OLD shares become mathematically useless after re-sharing
(this is mathematically enforced).

**Practical ceiling:** K has a coordination ceiling, not a
mathematical one. Getting 11 peers coordinated within a week is
achievable; getting 47 is asking for a coordination event that may
never converge. The right N and K are bounded by the operator's
actual social capacity to mobilize peers in a recovery moment, not
by the math. Marginal value drops fast past about 15 peers.

### The cascade recovery flow (operator's own design)

This is the operator's sharpening that **removes the need for any
pre-stashed recovery key**. No paper backup, no metal etching, no
safe-deposit-box artifact. The trust anchor moves from "a piece of
paper outside the system" to "the mycorrhizal network itself."

The flow:

1. **Setup time.** Wallet generates a recovery descriptor naming
   M (initiation threshold), N peers, K (reconstruction threshold),
   and the Nostr relays the recovery cascade will use. Descriptor
   is signed by the operator's active key and propagated to all N
   peers. M is independent of K — M small (2 or 3) for low recovery
   friction; K higher for share security.
2. **Loss event.** Operator's phone is gone. Operator obtains a
   new device and generates a fresh keypair on it.
3. **Stage 1 — initiation.** Operator walks to peer A in person,
   shows their face, shows the new public key. Peer A's wallet
   signs a "stage one" event vouching for the new key. Event is
   published to the recovery descriptor's relays but the cascade
   does not fire yet.
4. **Stage 2 — threshold.** Operator walks to peer B (in person,
   or via video, or peer B sees the stage-one event and reaches
   out). Peer B independently verifies the operator's face and
   signs the same recovery attestation. Repeat until M signatures
   are gathered.
5. **Cascade.** Once M signatures are on the recovery event, every
   peer subscribed to the operator's public key sees the event,
   verifies cryptographically that M valid signatures from peers
   on the recovery list are attached, encrypts their Shamir share
   to the operator's NEW public key, and pushes the encrypted
   share to the recovery descriptor's relays.
6. **Reassembly.** Operator's new device polls the relays, collects
   K shares, the math reconstructs the master key, the master key
   decrypts the operator's attestation history. Operator is back.
7. **Recovery-succession event.** The M peers who vouched also
   collectively sign a recovery-succession link, appended to the
   operator's succession chain. Every future verifier of the
   operator's identity sees the chain "original key → ... →
   recovery succession signed by M peers → current key." **The
   network knows the new key represents the same identity.**

**Three shapes of succession the wallet must support:**
1. Self-signed succession (planned rotation): old key signs that
   new key represents the same identity.
2. Transitional dual-signed succession: old key + new key both
   sign during a rotation window.
3. Peer-witnessed recovery succession: M peers collectively sign
   that the new key represents the same identity after a loss event.

All three resolve to "the public key currently representing this
identity," with different evidence shapes.

### Defenses against fraudulent recovery

- **M-of-N initiation threshold.** A single hostile peer cannot
  forge a recovery alone. They would need to forge M peers'
  private keys, which is approximately as hard as forging the
  operator's original key.
- **Veto channel.** If the operator is still alive and active when
  a fraudulent recovery is initiated, their active wallet sees the
  stage-one event and can publish a veto. Other peers' wallets
  see the veto and refuse to send shares.
- **Time-bounded expiry.** Recovery initiation events carry a 48-72
  hour expiry. After the window closes, peers' wallets reject
  follow-on share requests.
- **Bot-prompted verification.** During peer signing ceremonies,
  the wallet bot surfaces verification prompts to the signing peer
  ("when did you and Tom last meet? where? what did you discuss?")
  that an impostor cannot fluently answer.
- **Cryptographic detection.** A fraudulent recovery with forged
  signatures fails the M-signature check at every peer's wallet
  automatically. A fraudulent recovery with a real impostor leaves
  a permanently signed, publicly auditable record of which peers
  vouched — accountability preserved even when prevention fails.
- **Hostile-peer share refusal.** A peer who refuses to return their
  share causes partial denial of service, not corruption. They
  cannot fabricate a fake share because that would require the
  operator's key. Lose a handful of records, not the whole history.

### Solo-attestation edge case (covered by encrypted blob)

Diary entries with no peer party (true solo entries) need the
**encrypted personal cloud blob** as their backup, since no peer
holds a mirror by definition. The wallet should make this as
automatic as iMessage backup — encrypted client-side with a key
derived from the operator's password, stored in the operator's
own iCloud / Dropbox / personal cloud, host sees ciphertext only.
The Shamir-recovered master key unlocks the blob during recovery.

### Recovery is a marketing moment

**Every recovery event is implicit evidence to the M peers that
running a wallet was worth it.** They just helped a friend retrieve
their cryptographic life; they will think about that the next time
someone asks them what the tool is for. Recovery is not a degraded
mode. **Recovery is one of the strongest organic network-effect
surfaces the architecture has.**

---

## 8 — OpenTimestamps: port the proven protocol, do NOT ship the npm wrapper

From `DISCOVERY.md`'s "Honest notes carried into the build":

`tapit-attest`'s `OpenTimestampsProvider` (`src/core/anchoring.ts`)
currently wraps the `opentimestamps` npm package — an optional
dependency, and the **one piece of the library that shipped
UNVERIFIED**. Its own code comment notes the anchor flow is verified
only against `MockOtsProvider`.

**When attestation anchoring (PLAN.md P1) is built, write a new
`tapit-attest` OTS provider behind the existing `OtsProvider`
interface that ports AppCommander's proven, dependency-free protocol
from the `ots-stamp` / `verify-ots-stamp` edge functions** (see
`HOW_TO_TIMESTAMP.md` in AppCommander):

- STAMP posts the raw 32-byte SHA-256 to a calendar server and
  assembles the `.ots` file.
- UPGRADE re-posts the hash and, once Bitcoin-confirmed, reads the
  block height from the calendar's attestation.
- No npm OTS package.

**One move accomplishes two things:** anchoring runs on a protocol
AppCommander already trusts in production, and the provider stops
being an unverified dependency surface.

This is 1-2 sessions of work whenever P1 anchoring becomes the
front of the queue. v1 launch does not need it because v1 launch
is identity + holdings + backup + one-app signing, not anchored
growth rings. But anchored entries are core to the diary thesis,
so this work should land in Phase 2 or early Phase 3.

---

## 9 — The five honest caveats

Naming these so the wallet Carpenter is not blindsided. They are
risks worth watching, not objections to ship.

1. **Network effect is the dragon.** Layers four and five of the
   Mycelium only become powerful at thousands of wallets running
   for years. The diary-first wedge largely sidesteps this because
   the wallet is useful at layer one alone — but the architecture's
   long-term thesis depends on getting to layer four.
2. **Wallet UX is everything.** If signing a kid-pickup attestation
   feels harder than a Google login, the wallet dies. This is a
   design and product problem, not a crypto problem. Most of the
   wallet Carpenter's time should go here.
3. **Key loss survival.** Phones get lost in lakes. The wallet has
   to survive a non-technical user dropping their phone in a lake
   on day three of ownership. The recovery design in section 7 is
   the answer; ship it carefully.
4. **Regulatory translation.** Selective disclosure of identity
   attestations bumps into KYC, AML, and child-protection rules in
   finance and school contexts. Math cleaner than regulator's
   mental model means patient translation work, not avoidance.
5. **Cathedral before congregation.** The doctrine is beautiful
   and long. Risk: building the cathedral before any congregation
   arrives. The CLAUDE.md discipline (smallest useful thing, one
   vertical slice, gates green) is the antidote. **Stay loyal to
   that discipline harder than to the doctrine when the two pull
   apart.**

---

## 10 — Phase mapping (where each item slots in PLAN.md)

- **Phase 1 — app shell + auth.** No change. Ship as written.
  Wire `tapit-attest` as `file:` dependency. Empty wallet home.
- **Phase 2 — wallet core: identity + holdings.** **Add the
  personal-diary surface as the first user-facing feature.**
  One-tap signed entry, anchoring queue (start with mock OTS, port
  AppCommander's real OTS provider in late Phase 2), selective
  recall, plain-English approval, encrypted backup + restore. The
  diary IS the Phase 2 vertical slice.
- **Phase 3 — Layer 2 inter-app pathway.** No change to the Nostr
  NIP-46 plan. Same wire will carry recovery cascades in a later
  phase, so the Nostr client work compounds.
- **Phase 4 — wallet bot.** Bot guides first-entry ceremony +
  approval prompts + plain-English summaries + recovery-ceremony
  verification prompts.
- **Phase 5 (was Layer 3 Mycelium peer network, deferred).** **This
  brief promotes recovery to a first-class Phase 5 concern.**
  Layer 3 peer-network and Shamir recovery share the same Nostr
  substrate, so they ship together as one phase.
  `MYCELIUM_NETWORK_SPEC.md` has to land first per existing
  doctrine; this brief is input to that spec.

---

## 11 — Audit findings (from AppCommander's comms-surface audit) that affect the wallet

The 30-finding comms audit in
`project-memory/COMMS_AUDIT_2026-05-20.md` was scoped to
AppCommander itself but several findings affect ANY wallet that
inherits the chassis. The wallet Carpenter should at minimum read:

- **F-001 / F-002 / F-003** — the half-finished multi-tenancy in
  the token-routing layer. If the wallet ever uses the chassis SQL
  / deploy paths for ITS spawned environments later (unlikely in
  v1 but possible), it inherits these.
- **F-004** — the "(target may already exist)" createRepo error
  wrapper that misled the operator on description-too-long. Wallet
  is unaffected directly but worth knowing the pattern.
- **F-005 — closed by 053a7e7 + 9b7a3f8.** Non-resumable
  provisioning is now resumable on AppCommander; the wallet
  doesn't provision sub-projects, so this is mostly informational.
- **F-006** — the per-component-instance latch can be defeated by
  component unmount. If the wallet has any analogous in-flight
  state, ensure the latch lives at a higher level (context,
  zustand store) than a single component.
- **F-007 (webhook delivery race), F-009 (dispatch TOCTOU),
  F-012 (fleet-push-notify auth bypass)** — relevant if the wallet
  ever exposes its own webhook surface or push-notification path.

---

## 12 — Open questions for the wallet Carpenter

1. **Should the diary be its own `journal` attestation kind, or
   reuse `meta`?** Argument for new kind: clearer semantics in the
   envelope and easier filtering. Argument for reusing meta:
   smaller library surface change.
2. **What is the right default M and K for first-time setup?**
   Default determines whether operators complete recovery setup or
   skip it. Suggestion: M=2 of N=3 with friends-or-family for the
   routine tier; require the operator to actively configure higher
   tiers themselves so they understand the trade-off.
3. **Where does the recovery descriptor live?** It has to be
   discoverable by peers (they need to know they hold a share for
   you) but tamper-evident (a hostile party cannot substitute a
   different descriptor). Candidate: publish the descriptor as a
   signed attestation to the recovery relays at setup time; sign
   updates with the current active key.
4. **How does the bot handle the verification-ceremony when peers
   are remote?** Video call, voice call, in-person — all valid,
   each carries different verification weight. Worth a small
   thinking pass before Phase 4.
5. **Default relay set.** Which Nostr relays does the wallet ship
   with on first install? Should be plural, healthy, and the
   operator should be able to add more.
6. **When the wallet bot summarizes an attestation in plain
   English, who writes the summary template?** Auto-generated from
   the field tree? Operator-customized per kind? Important UX
   decision; the summary IS the security boundary for
   non-technical users.
7. **Inheritance of CLAUDE_ROOT.md as the wallet's root CLAUDE.md.**
   The wallet should have BOTH the skeleton's operational
   CLAUDE.md (the Carpenter rulebook) AND CLAUDE_ROOT.md (the
   thesis-style orienting doctrine) at the repo root. The operator
   has already pasted the latter into the wallet repo at this
   conversation.

---

## 13 — The two pieces that close the picture

Two honest additions from the conversation that complete the
diary-first framing:

1. **A cryptographically anchored diary is admissible evidence in
   both directions.** The wallet protects you from being denied
   that you wrote what you did write. It does NOT protect you from
   things you wrote that hurt your own case. So **writing well, not
   just writing often, becomes the actual product virtue**.
2. **Peer recovery has to genuinely work for non-technical users
   by day three** or the diary is one phone-in-a-lake away from a
   decade of receipts gone. The cascade design in section 7
   addresses this; ship it with the same care the signing flow
   gets.

---

## 14 — Closing

The wallet is the spore. The diary is the wedge. The math is
mature. The thesis is that one person at a time decides to keep
their own records, and the rest is biology. **Make it frictionless,
ship it small, and let the network grow from real relationships
rather than launching a network and hoping people show up.**

The architecture is choosing correctly on the meta-problem
(decentralization, ownership, no platform) and accepting being
weaker on specific sub-problems (sybil resistance, ubiquitous
verification, coercion-resistance) that can be ameliorated inside
the architecture over time. Anyone who has a better plan that
keeps the first principle should publish it tomorrow and the
world will adopt it. Until they do, this plan IS the better plan.

— Operator + Claude (AppCommander session, 2026-05-21)

---

## Carpenter response — 2026-05-21 evening

Filed verbatim into the repo on the wallet Carpenter's side. Initial
engagement in chat:

**On the diary-first reframe.** Right move. Phase 2 as I shipped it
ended with one identity attestation + settings = the structural
shape of a setup wizard, not a tool used daily. A diary entry every
day is a wedge; an identity attestation is a checkbox. Bitcoin 2010
analogy lands because it names the failure mode every identity-
wallet project before this one fell into — pitching the meta-problem
as the wedge and discovering nobody installs a tool whose value is
"the network we don't have yet."

**On `journal` vs `meta`.** Lean `journal`. Cost is one line in
`tapit-attest`'s `AttestationKind` union plus one builder export.
The `meta` kind is the control-plane kind (revocation / succession /
death-declaration); mixing daily content into it means "show me my
diary" becomes "show me my meta records minus the events that
aren't really diary" — inverse-filter smell of a missed type. The
library was designed for one envelope + six kinds, and the kind
label was built to absorb a seventh.

**On the recovery cascade — technical clarification for Phase 5.**
The Shamir split has to be over a secret that does NOT let M-of-N
collusion = total identity capture. Splitting the signing keypair
directly: bad — M coordinated peers can sign as the operator
forever. Splitting an encryption key that unlocks the cloud-mirrored
backup blob: better — M coordinated peers get one snapshot at
decryption time but cannot keep signing in the operator's name
unless the recovery-succession event explicitly hands authority to
the new keypair. The design assumes the latter implicitly; just
naming it explicitly so Phase 5 cuts it right.

**On phase mapping.** Add a Phase 2.5 (the diary surface — `journal`
kind, composer, entry cards on home, selective-recall view, mocked
anchor). Phase 2.75 or early Phase 3 = port AppCommander's OTS
provider to replace the unverified npm wrapper. Phase 3 stays
inter-app NIP-46. Phase 5 stays Mycelium-peer + Shamir-recovery as
one. Reason: ship the wedge first so a user journaling daily by
week two is much more motivated to do recovery setup in week three
than a user who only ever made one identity attestation.

**Push-back on "recovery is a marketing moment."** True and useful
but design recovery to work invisibly first and look inspiring
second. The temptation if we design FOR the marketing moment is to
dramatize the ceremony in ways that add friction for a real user
sweating about a decade of receipts. Recovery should feel like the
wallet catching the user gracefully, not a theater production.
Marketing benefit is downstream of the experience working, never
upstream of it.

**Push-back on the bot's role.** It summarizes and prompts, never
signs. The plain-English approval screen is the last line of
defense if the bot is compromised or hallucinates. Phase 4 must
hold that line even when the bot's UX would feel smoother if it
could sign on behalf.

**Status notes:** `CLAUDE_ROOT.md` was confirmed missing during the
initial Carpenter response, but landed on `origin/main` via an
AppCommander bootstrap commit (`f61cf2d`) between the Carpenter's
local fetch and the push. Merged into the wallet branch as the
Carpenter integrated this brief; both `CLAUDE.md` (operational
rulebook) and `CLAUDE_ROOT.md` (thesis-style orienting doctrine)
now sit at the repo root.
