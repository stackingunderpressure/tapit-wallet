# Phase 5c — Nostr transport — design sketch

> Status: SKETCH for operator review. Not a committed build.
> Written 2026-05-22 while the operator was away, so the next
> Layer 3 increment is ready to bless on return.
> Companion to `MYCELIUM_NETWORK_SPEC.md` (especially §11).
> If greenlit, needs a decisions.md entry before code is cut.

## What Phase 5c is

Layer 3 so far is **local only.** A handshake (5a) and a
membership (5b) both need the two wallets physically together,
trading QR codes. Phase 5c is the transport — the increment
where the network stops being local and wallets can reach each
other across distance. It is the largest remaining Layer 3
phase, and the forkiest, which is why this is a sketch and not
a cut.

## What it adds

- **Async peer delivery.** A peer can send you something — a
  co-sign request, a membership, a handshake — without you both
  being present at the same moment. It arrives when your wallet
  next connects.
- **Remote links (Tier R).** A handshake done over the network
  rather than face to face. Honestly weaker than Tier P, and
  labelled so (D-09): it proves a relationship between two keys,
  not a physical meeting.
- **A transport layer** behind a transport-agnostic interface,
  so the network substrate is swappable and never a hard
  dependency (D-06).

## What it does NOT change

- **Discovery stays manual** (§11). You share your address out
  of band; there is no directory, no search, no recommender.
- **Tier P stays in-person.** Remote handshakes are Tier R. The
  network does not let a remote link claim physical presence.
- **In-person flows are untouched.** 5a and 5b keep working
  exactly as built; 5c is an additional path, not a replacement.

## The non-negotiable constraint

The social graph is private (§9). **Everything that crosses a
relay is encrypted — relays see ciphertext only.** A Nostr relay
is dumb transport, exactly as the Supabase host is dumb storage.
Connection and membership envelopes are encrypted to the
recipient before they ever touch a relay. This is the same
keys-and-content-never-leave-in-the-clear rule (D-03), applied to
the transport.

## Transport: Nostr (D-06)

Nostr is the decided substrate. A wallet opens websocket
connections to relays, publishes encrypted events, and
subscribes for events addressed to it. The tapit-attest envelope
stays the standard — Nostr carries it, it is not replaced.

## Suggested build slicing

- **5c-i — async delivery of what already works.** The
  transport interface + a Nostr client + encrypted inbox/outbox,
  so an existing in-person flow (a co-sign, a membership) can
  also travel remotely. Smallest useful: the things that work
  gain a remote path.
- **5c-ii — remote handshakes (Tier R).** A handshake conducted
  entirely over the transport, labelled Tier R.
- **5c-iii — connection sync.** A wallet's web reaches its other
  devices and stays current.

## Decisions (resolved 2026-05-22 — see D-11)

1. **Relays — default set, replaceable.** The wallet ships with
   a working relay set so it works out of the box; a sovereign
   user can swap in their own. (Operator chip.)
2. **Event shapes — custom encrypted kinds.** Each tapit-attest
   envelope travels inside a custom encrypted Nostr event;
   NIP-46 stays reserved for the separate app-to-wallet sign
   pathway. The envelope is the standard, Nostr is only
   transport (D-06). (Carpenter, from doctrine.)
3. **Addressing — the in-person handshake bootstraps the remote
   channel.** Meeting someone in person also exchanges relay
   info, so the woven network is reachable remotely afterward —
   which is what lets peers hold and return recovery shares.
   Messages stay encrypted; a peer can send, never see.
   (Operator chip.)
4. **Identity — reuse the wallet key.** A wallet identity is
   already a Nostr identity by construction (secp256k1 / BIP340,
   D-06); nothing new is minted. (Carpenter, from doctrine.)

## Honest risks

- Relay reliability and reachability — the cold-start problem.
- The encryption discipline must hold on every path; a relay
  must never see a plaintext connection.
- This is a genuinely large phase; expect it to slice into the
  5c-i / 5c-ii / 5c-iii increments above rather than land in one
  cut.

---

*All four design questions are resolved (D-11). The next cut is
5c-i — the transport interface plus encrypted async delivery.*
