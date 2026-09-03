# Trust Framework — how a town, a church, or any group forms its own signature

> A playbook, not a product. This is *"here's how you would do it"* — the
> steps a small group follows to start vouching for its own people with
> cryptographic proof anyone can verify. Tapit gives you the tools and this
> guide; **your group runs its own thing.** Fork it, ignore it, or make it
> yours.

It is dorky and niche and most people will never care. That's fine. It
exists so that the moment a company or a government fails to give you the
validation you need, there is another way to prove who you are and where you
belong — one nobody grants you and nobody can take away, because you built it
yourself out of real relationships.

---

## The one principle

**A group's signature is not a special key. It is its members' individual
signatures, piled up, plus the weight behind them.**

There is no board-held master key, no threshold ceremony, no new kind of
identity to mint. A "town key" is just an ordinary public key that enough
real citizens have each personally signed a statement about: *"this key is my
town's key, and I belong to it."* The proof that it is real is the weight of
everyone who signed it. The proof that *you* belong is that the town signed
you back.

That's the whole thing. Everything below is just how you do it in practice
and what already exists to help.

---

## The steps

### 0. Decide you are a group

Three people or three thousand. A hunting club, a church, a town, a family, a
trade guild. You don't register with anyone. You just decide, together, that
you are a group and that you'll vouch for each other.

### 1. Create the group's key

One member's wallet declares the group — it signs a plain statement: *"This
public key is the Springfield town key."* No new software: a wallet already
declares an organization about itself with a single signature (see
`src/features/connections/createOrganization.ts`). The key can be a fresh one
you generate for the group, or an existing wallet acting as the group's seat.

### 2. Decide custody yourselves — this is your business

Who holds the group's key, and where, is entirely your call. The church board
may leave it with the pastor's secretary. A town may keep it with the
treasurer or the mayor. A careful group may **split it with Shamir's Secret
Sharing** so no one person holds it alone and any three of five can act
(`tapit-attest/src/core/shamir.ts` already does this). Publish where it lives
or keep it word-of-mouth — your choice. Tapit ships **no opinion** here. It
gives you the pieces; you set the rules.

### 3. Members sign each other — in person is strongest

Each member goes to the agreed place — the courthouse, the church hall,
wherever your group already agrees the key lives — and does a **two-way
exchange**: they sign the group's key to say *"this is my group's key, I
belong to it,"* and the group signs them back to say *"we checked this person
our own way, and they're one of us."* That mutual, face-to-face signing is
exactly the in-person handshake the wallet already does (the show-and-scan QR
ceremony in `HandshakeModal`). Remote signing over a relay works too, but a
room full of real people signing the same key at the same place at the same
time is the hardest thing in the world to fake — you cannot conjure two
thousand real people to a courthouse.

**Tapit records the signature. It does not decide who is a citizen — you do,
however your group already does that.** The wallet is the honest ledger of the
agreement, never the judge of it.

### 4. Weight accrues — and anyone can recompute it

Every citizen who signs adds their weight to the group's key. The default is
the plainest one: **one member, one signature** — headcount. The wallet
already sums it (`computeWeight` in `tapit-attest/src/core/weighting.ts`
totals every distinct valid signer behind a subject), and because it's
recomputable, *anyone* can check the weight for themselves. Nobody has to
trust your claim about how big your town is; they add it up on chain.

### 5. Broadcast the key — when you're ready, if you ever are

When your group wants its proof to travel — so someone three hundred miles
away can verify your town without knowing a soul in it — you broadcast the
group's key and the citizen signatures behind it over a public Nostr relay.
Anyone can subscribe, pull the key, recompute the weight, and know both that
the key is real and that a person claiming your town must actually verify
against it. No trust required; everything checks on chain.

This broadcast is the one piece a group builds (or forks) for itself when the
time comes — it is deliberately *not* a built-in product feature, because a
group is responsible for its own thing. The pattern already exists to copy:
the public, world-readable move-broadcast channel
(`src/features/transport/moveChannel.ts`) shows exactly how to publish a
signed thing on its own public event kind and let anyone verify it. A town's
broadcast is the same shape carrying the group key and its vouches instead of
a trade.

### 6. Rotation — when leadership changes

The board turns over, a term ends, a key is compromised. The group publishes a
new key the same way it made the first one: a fresh *"this is now the town
key"* statement that the majority signs, and members come re-sign against it —
the same announce-and-reconcile machinery a single wallet already uses for its
own key rotation (`useAnnouncementOutboxWorker`, `peerSuccession`). If two
factions ever both claim to be the town, the tie breaks by weight: **the
heavier chain — more real signatures behind it — is the real town**, and
everyone that winning key has in turn vouched for carries the town's authority
through it. Heaviest chain wins, the same idea as Bitcoin's longest chain,
measured in genuine attestation weight instead of hashpower.

---

## What this does — and what it deliberately does not

**It does:** let a group vouch for its own people with signatures anyone can
verify; make the weight behind a group's key recomputable by a total stranger;
make impersonation cost the one thing money can't buy — real people who will
actually sign for you; keep working when the key holder rotates.

**It does not:** grant anyone standing. Nobody issues you a score. A club
nobody joins simply has no weight, and that's honest, not a bug — it just
shows there's no support behind it. A group with real depth becomes hard to
fake precisely because that depth is real. **The value of any proof is the
observer's to appraise** — your town's signature may open a door where you
are, or it may mean nothing to the person looking; both are fine. You are the
one responsible for collecting the proof, the relationships, and the
attestations that benefit you the most.

---

## Why bother

Because sometimes the institutions that are supposed to validate you don't. A
company fails you, a government won't recognize you, a record gets lost. This
is a way to carry proof that doesn't depend on any of them — proof made of the
people who actually know you, that you hold yourself, that anyone can verify
without trusting your word. Almost nobody will want that. But it's here, it's
open, it's forkable, and the day someone needs it, it works.

*We invented none of the cryptography under this — Schnorr signatures, Merkle
trees, Shamir sharing, Nostr relays, web-of-trust all already existed. The
only new thing is composing them so an ordinary group can do this without
having to understand any of it first.*
