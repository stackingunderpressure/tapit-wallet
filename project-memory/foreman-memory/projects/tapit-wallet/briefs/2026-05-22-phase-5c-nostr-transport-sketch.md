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

## Open questions for the operator

1. **Relays.** Ship a default relay set, or require the operator
   to configure their own? A default set is easier; operator-run
   relays are more sovereign. Probably: a default set the
   operator can replace.
2. **Event shapes.** D-06 names NIP-46 for the Layer 2 sign
   pathway. For connection/membership exchange — reuse NIP-46
   shapes, or define custom encrypted event kinds carrying
   tapit-attest envelopes? Leaning custom kinds for the network
   layer; NIP-46 stays for the app-to-wallet sign pathway.
3. **Addressing.** A remote handshake needs the peer's address
   (an npub / relay hint). How is that first shared — still QR
   or out-of-band paste, then everything after is remote?
4. **Identity-org reuse.** Because wallet keys are secp256k1 /
   BIP340 (D-06), a wallet identity is already a Nostr identity.
   Confirm we lean on that rather than minting anything new.

## Honest risks

- Relay reliability and reachability — the cold-start problem.
- The encryption discipline must hold on every path; a relay
  must never see a plaintext connection.
- This is a genuinely large phase; expect it to slice into the
  5c-i / 5c-ii / 5c-iii increments above rather than land in one
  cut.

---

*Next: operator reviews and blesses (or redirects) the slicing
and the four open questions; then 5c-i is the first cut.*
