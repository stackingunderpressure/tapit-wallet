# MYCELIUM_NETWORK_SPEC.md — Tapit Wallet Layer 3

> Spec-of-record for the Tapit Wallet peer network. Decision D-04
> requires this document to exist before any Layer 3 code is cut;
> this discharges that requirement.
>
> Companion to `DESIGN.md` and `PLAN.md`. Consistent with the
> fleet doctrine in `project-memory/foreman-memory/core/`:
> `MYCELIUM.md`, `HEARTH_SPEC.md`, `HEARTWOOD.md`.
>
> Status: v1 draft, written 2026-05-22 from the operator's
> People-network vision and two design decisions (D-09, D-10).
> Append-as-decided — do not rewrite prior sections in place.

---

## 1. What this is

Layer 3 of Tapit Wallet — the **Mycelium peer network**, the
People layer. Layers 1, 2, and the diary already exist: the
Wallet core object, the inter-app sign pathway, and the signed
time-anchored record of a life. Layer 3 is the layer where one
person's wallet connects to another's, and to the organizations
they belong to, until the wallet holds a verifiable map of the
person's real place in the world.

The Tapit Wallet is a **Hearth** in the fleet-wide sense of
`HEARTH_SPEC.md` — specifically the "browser-only personal hub"
mode named in that document's open question 5. This spec covers
the **identity and attestation** network among wallet-Hearths:
person-to-person and person-to-organization. It does **not**
cover recipe propagation — recipes-as-spores are the Bench /
AppCommander concern, not the wallet's.

## 2. Non-negotiables this spec inherits

- **Keys never leave the wallet unencrypted** (D-03). No part of
  the network changes this. Connections move signed envelopes
  and ciphertext, never a private key.
- **`tapit-attest` is the envelope standard** (D-02), never
  re-implemented. Keys are secp256k1 / BIP340 Schnorr (D-06).
  Where the older `MYCELIUM.md` says Ed25519, the wallet
  instance uses its own established crypto — that is a correct
  divergence, not a conflict.
- **Nostr is the transport and discovery substrate** (D-06),
  adopted behind a transport-agnostic interface.
- **The host stores only ciphertext.** The social graph is never
  handed to a server in readable form.
- **Privacy is in what you do not anchor** (`MYCELIUM.md`):
  anchor the hash of a fact, never the fact.
- **Smallest useful version first.** The network ships in
  increments that are each valuable alone — the diary-wedge
  discipline applied to Layer 3.

## 3. The vision (teach-back)

In the operator's own framing, preserved: you never type a
contact in. You find people in the real world, in the wild, and
some of them already live in your home. You absorb them the way
mycelium absorbs spores — you accept the identity their wallet
chooses to share, they accept yours, and that mutual handshake
fixes you as a leaf in their tree and them as a leaf in yours.
Organizations — a town, a church, the American Legion — are
themselves entities in the network; the town signs your key as
a leaf of the town, and the hairdresser and the church and the
Legion are themselves members of the town, and it nests upward.
The more you discover, the more of the town, the state, the
country resolves inside your wallet, until your tree mirrors the
world the way you actually live in it — and your woven-in place
becomes proof of where you belong and where you are.

## 4. The connection model — graded verification tiers (D-09)

The core honesty principle of Layer 3: **every connection
states how it was verified.** A signature alone proves a key
signed something; it does not prove the signer met the subject.
So every connection and presence attestation carries a signed
`verification` leaf naming its tier. A verifier — a person, an
organization, a court — always sees which tier a link is and
weighs it accordingly. The wallet never lets a weak link
masquerade as a strong one.

**Tier R — remote link.** "I am connected to this key." Formed
remotely, over the network. It proves a relationship exists
between two keys; it does **not** prove the parties physically
met. This is the honest level for "I saw this person's Facebook
post and signed that I saw it" — you can attest the content
existed, you cannot attest it was truly them. Weakest tier;
useful, but labeled.

**Tier P — in-person handshake.** "I physically met this person
and signed their identity face to face." Formed with two phones
together — a QR scan or an NFC tap. It carries the operator's
distinction: *I know this person, I saw them.* This is the
sybil-resistant tier, because physical presence is expensive to
fake at scale.

**Tier V — device-verified presence.** The operator's third
thing: a signed event binding three facts together — a device
biometric authentication (Face ID / passkey — proves the wallet
owner, not just the device, authenticated in that moment), a
geolocation reading (where the device reported being), and a
timestamp. Signed, it proves "the authenticated wallet owner's
device reported being at this place at this time." A Tier V
event can stand alone (proof you were somewhere) or strengthen a
handshake — two people each producing a Tier V event at the
same place and time is strong evidence they were together. It is
honest about its limits: geolocation can be spoofed and biometric
proves device-owner-authenticated, not unspoofable presence — so
the spec frames it as "to the best of the device's ability,"
exactly as the operator put it.

## 5. The handshake

A handshake is **mutual by design.** Each party's wallet signs a
`relationship`-kind attestation about the other, carrying: the
counterpart's shared identity (the identity attestation *they*
chose to present — they control what they reveal), the
`verification` tier from §4, and a timestamp. Each wallet holds
the attestation the other signed. The pair of held attestations
is the connection; either party holds proof the other consented.

Tier P handshakes reuse exactly the in-person primitives the
wallet already shipped for Phase 2.6 witness co-signing — QR
exchange between two phones — and the `relationship` attestation
kind already in `tapit-attest`. A person, in your wallet, is
their public key, plus whatever identity they shared, plus an
optional private nickname only you see. The wallet has no
concept of a name for someone that the other person did not
choose to give.

A connection can be revoked unilaterally via a `meta`-kind
revocation; sovereignty means you control your own wallet's
view. Connections resolve through the counterpart's succession
chain, so a peer rotating their key does not break the link.

## 6. Organizations and membership (D-10)

An **organization** — a town, a church, the American Legion — is
a first-class network entity: an **identity** (a keypair) that
represents a collective rather than a person. An organization
does one new thing: it issues **membership attestations** —
signed claims of the shape "this person is a member of this
organization." A person proves they belong by holding a
membership attestation the organization signed.

Organizations **nest.** A person is a member of the American
Legion; the American Legion is itself a member of the Town; the
Town is part of the County; the County of the State. Each link
in that chain is an ordinary membership attestation. Belonging
is therefore not a single flag — it is the set of membership
attestations a person holds, plus the verifiable position of
each issuing organization in the larger structure.

Membership reuses existing primitives — an organization is an
identity, a membership claim is an attestation, signing is
signing. **The simple version ships first:** an organization is
a single-key identity, administered by whoever runs it (the
operator's "the town set up that organization on our wallet, or
on their own interconnect software"). **The complex version is
deferred:** an organization whose key is controlled by a quorum
— several officials who must jointly sign — is the same
multi-party-key pattern the `HEARTWOOD.md` Trust uses (Bitcoin
Taproot / MAST threshold signing), and the same FROST / MuSig2
work `PLAN.md` already lists as a Phase 7+ non-goal. The spec
names quorum-controlled organizations as a later increment, not
a v1 deliverable.

Note: the organizations of this section are everyday human
communities. They are distinct from the Heartwood Dynasty Trust,
which governs the canonical *architecture*. Different scope,
related cryptographic shape.

## 7. Proof of place and belonging (D-09 / D-10)

Proving where you live and where you are is **neither a separate
engineered feature nor merely emergent** — it works through the
pieces above:

- **Membership** — you hold a membership attestation signed by
  an organization rooted in a place (your Town), and that
  organization's position nests verifiably upward.
- **The in-person web** — a dense lattice of Tier P handshakes
  with other members of that place is itself costly-to-fake
  evidence of presence in it.
- **Device-verified presence** — Tier V events bind you to
  specific places and times.

Together these let the wallet prove belonging and presence **to
the best of its ability** — the operator's phrase, kept because
it is the honest one. The spec deliberately does **not** promise
unspoofable residency proof: an engineered, authoritative
"prove my address" system would be a dual-use surveillance and
fraud surface, the opposite of what this wallet is for. What the
wallet offers is a verifiable, tier-labeled body of evidence
that a person can choose to present; the weight of that evidence
is for the verifier to judge, in the open, from the math.

## 8. The five identity layers

This spec is the wallet's implementation of the five identity
layers of `MYCELIUM.md`:

1. **Taproot** — the wallet's keypair. Already shipped (Layer 1).
2. **Mycorrhizal partnerships** — your Tier P handshakes, the
   five-to-twenty people who actually know you. This spec's
   first build.
3. **Hyphal lattice** — transitive trust: if you are linked to
   B and B to C, you can reach C along a verified, confidence-
   discounted path. A later increment.
4. **Anchoring rings** — OpenTimestamps receipts. Already
   shipped; handshake and membership attestations anchor through
   the existing pipeline.
5. **Forest consensus** — the years-deep soft agreement that you
   are real and consistent. Not built; it emerges from layers
   1-4 running for years.

## 9. Privacy and the social graph

The social graph — who knows whom, who belongs where — is the
most sensitive object a person carries. It is **private by
default.** Connection and membership attestations are stored
encrypted (host sees ciphertext only), held in both endpoints,
and never broadcast. Revealing a single connection, or proving
one membership without exposing the rest of the graph, uses the
**selective disclosure** primitive already shipped in Phase 4.
The wallet never publishes the graph; the person discloses one
leaf at a time, on purpose.

## 10. Sybil resistance — the honest treatment

The hardest problem. The defense is not a wall; it is **honest
tiering plus cost plus anchoring.** Tier P handshakes require
physical presence, which is expensive to fabricate at scale.
Tier R links are explicitly labeled weak. OTS anchoring prevents
backdating a fabricated history. A verifier always sees the tier
mix behind a claim and can refuse to weight Tier R as Tier P.
What the spec does **not** claim: it does not stop a determined
actor from staging in-person handshakes, and it does not by
itself stop a fabricated organization. Those residual gaps are
named here, not hidden, and the transitive-lattice geometry of
§8 layer 3 — multiple independent paths agreeing — is the
longer-term mitigation.

## 11. Transport and discovery

Transport is **Nostr** (D-06), behind a transport-agnostic
interface so it is never a hard dependency. Following
`MYCELIUM.md`: **discovery is manual first** — you exchange
identities in person or share an address out of band; there is
no directory, no search, no recommender in v1. **Trust is a
direct list first** — your wallet holds the peers and
organizations you explicitly connected with. Friend-of-friend
introduction and transitive scoring are later increments. The
first networks will be families and towns who already know each
other; that is enough.

## 12. Social recovery rides on the network

Phase 5 was always "Mycelium + social recovery," and the
operator's framing makes the connection exact: **your recovery
network is not a separate thing you set up — it IS the network
you have already woven.** The peers you handshaked in Phase 5a
and the organizations you joined in Phase 5b are precisely the
people and entities who can put you back together. The bar where
you are a member, the church you belong to, the workplace, the
handful of people whose wallets hold a Tier P handshake with
yours — every one of those is both a leaf in your tree and a
potential holder of a piece of your recovery. Any one of them
can help; enough of them together can fully restore you.

**The slime.** Mycelium leaves a substrate behind it everywhere
it grows. In the operator's words, as you live and interact
through your network you leave your "slime" across it.
Concretely: the encryption key to your cloud-mirrored backup
blob is split by Shamir Secret Sharing (SLIP-0039) into shares,
and each share — each piece of slime — is held by a trusted node
in your web: a peer, or an organization you belong to. No single
holder can do anything with one share. But gather **M of your N**
shares back and the key reconstructs, the backup decrypts, and
your whole verifiable life is yours again.

**The mechanism, with no pre-stashed key.** Recovery is
initiated by M-of-N peers who verify it is really you — in
person or over video, your face against the person they know.
Each subscribed peer's wallet then encrypts its share to your
**new** keypair, generated fresh on the new device, and pushes
it to a recovery relay. The new device reassembles the M shares,
decrypts the backup, and M peers co-sign a **recovery-succession
event** — the peer-witnessed shape of the three-shape succession
chain (self-signed rotation / dual-signed transition /
peer-witnessed recovery) — which makes the new key authoritative
for your identity going forward.

**The load-bearing constraint, unchanged.** The Shamir split is
over the **encryption key of the backup blob — never over the
signing keypair.** A colluding M-of-N can at worst decrypt one
backup snapshot; they cannot become you, because signing
authority only ever transfers through a succession event your
recovered wallet itself produces. M-of-N collusion is not
identity capture.

Recovery is a later Phase 5 increment (5e), built on top of the
handshakes (5a) and memberships (5b) that create the cohort in
the first place. It needs no separate spec — it is the network
of this document, used backwards: the same web that proves who
you are is the web that restores you when the device is gone.

## 13. The honest meaning of "the whole world in your tree"

The operator's vision says the wallet's tree comes to mirror the
whole world. The honest precision: **no wallet holds the world.**
What a wallet holds is its own leaves — the handshakes and
memberships it made — and the cryptographic **proofs of
connection** that let it reach further. The town, the state, the
country are *reachable* through chains of membership and
handshake attestations; they are not *stored* locally. "The
whole world the way you see it" is true as an experience and
false as a database, and the spec keeps that line clear so the
build never tries to download humanity.

## 14. Build phasing

Each increment is valuable on its own.

- **Phase 5a — the in-person handshake.** Two wallets exchange
  identities via QR/NFC; each holds the other as a Tier P leaf.
  Local only, no networking. The smallest useful slice and the
  first thing to knock out.
- **Phase 5b — organizations and membership.** Single-key
  organizations; membership attestations; nested membership.
- **Phase 5c — Nostr transport.** Remote links (Tier R), remote
  sync of connections.
- **Phase 5d — device-verified presence.** Tier V events —
  biometric (WebAuthn / passkey) plus geolocation plus
  timestamp.
- **Phase 5e — the hyphal lattice and social recovery.**
  Transitive trust paths; the Shamir cascade recovery of §12.
- **Later** — quorum-controlled organizations (FROST / MuSig2);
  forest-consensus surfacing.

## 15. Open questions

1. Does membership want its own `tapit-attest` attestation kind,
   or does it reuse `relationship` with the organization as
   issuer? Leaning reuse; a dedicated `membership` kind is a
   small library addition if wanted.
2. How is a Tier V geolocation reading obtained on iOS in a PWA
   — and is the precision worth the privacy cost of asking? May
   interact with the native-shell decision (v1.5).
3. How does an organization first come into being — does anyone
   make one, or is there a lightweight claim-and-vouch step so
   the network is not flooded with fabricated "towns"?
4. Transitive trust scoring (§8 layer 3): what discount per hop,
   and how many independent paths constitute confidence? Deep
   design, deferred to Phase 5e.

## 16. What this document is for, and how to grow it

This is the spec a future Carpenter reads before cutting any
Layer 3 code. It is **append-as-decided** — like the fleet
doctrine, do not rewrite prior sections; add new ones, mark
superseded ones, link forward. When the operator or a future
session sharpens a decision, it lands here as a new section with
a date.

The operator's compass for the whole Mycelium, preserved from
`MYCELIUM.md`: *I just wanna do it because it is the right thing
to do. The mycelium grows accordingly.*
