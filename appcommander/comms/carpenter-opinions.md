# Carpenter opinions — tapit-wallet

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-22 — Phase 5a, the in-person handshake.
> Mode: dual-surface comms — files plus live chat — because
> AppCommander is down.

## What I did

This session cut Phase 5a — the in-person handshake, the first
real piece of Layer 3, the Mycelium peer network. Commit
`6e206aa`. After weeks of building a wallet for one person, this
is the first line of code where one wallet reaches another.

The build is a new `connections` feature. Its heart is the
`HandshakeModal` — a guided ceremony between two phones that are
physically together. Three QR transmissions: the initiator shows
their identity, the responder's wallet builds and signs a
handshake record, the initiator scans that and co-signs it, and
the responder takes the finished co-signed copy back. Both
wallets end holding one relationship attestation, signed by both
of them, marked verification equals in-person, anchored to
Bitcoin like everything else. The home screen gains a fourth tab,
People, which was deliberately empty until now because there was
no people-data to put in it — and now there is.

I want to name one decision that mattered, because it is the
spine of why Phase 5a is shaped the way it is. The easy version
of a handshake would be: scan the other person's identity QR,
record "I met them." I built it the harder way — both wallets
must co-sign one shared record — and the reason is honesty. If a
Tier P "in person" record could be created by one wallet alone
scanning a QR, then anyone could scan a copy of your identity
code found online and forge an in-person meeting that never
happened. The co-signature is the thing that makes "in person"
mean what it says: a record can only carry both signatures if
both wallets were actually there. The whole verification-tier
idea from the spec would be hollow without it.

Two gates earned their keep this session, and I want you to see
both because they are exactly the kind of quiet save the
mechanism-over-prose doctrine is for. The library-seam test
caught that I had named a little helper `leaf` — and `leaf` is
already a tapit-attest export. The test cannot tell whether I
re-implemented a library primitive from memory or just picked a
colliding name; it fails either way and makes me look. I had
just picked a colliding name; I renamed it to `leafValue`. And
the bundle-budget check failed on a chunk that looked alarming
until I dug in: an 11-kilobyte chunk named after a tiny file. The
truth was that Rollup had quietly renamed the qrcode-library
chunk because the modules sitting next to it changed. Not new
bloat — the same library that always shipped, wearing a
different filename. I fixed the root cause rather than the
symptom: the qrcode library is now pinned to its own
deterministic chunk in the Vite config, the way react and
supabase and tapit-attest already are, so its filename will stop
moving and the budget check will stop being startled by it.

## What you could do better

The honest limit, and it is a real one this time: I cannot test
this. A handshake is a three-QR ceremony between two physical
devices, and there is no version of CI, and no version of you on
a single phone, that can walk it end to end. The state machine,
the QR round-trips, the co-sign, the merge — they are sound in
the code and they pass every gate, but a gate cannot hold two
phones up to each other. So this ships build-verified and
field-unverified, and the field test genuinely needs two wallets
and two people. You can do part of it solo — open the People
tab, tap New handshake, watch the role screen and the QR appear,
confirm the camera scanner opens — but the real proof is two
devices, and that is the next thing to actually do before Phase
5b leans on this.

One design thing worth your eye when you do test it: three QR
transmissions is a real amount of back-and-forth for two people
standing together. I believe it is the minimum a co-signed
mutual record can cost — you cannot get both signatures onto one
envelope, in both wallets, with fewer hops — but if it feels
clumsy in the hand, that is worth telling me, because the
remedy would be NFC tap-to-exchange, and NFC is exactly the kind
of thing the v1.5 native shell unlocks that the PWA cannot.

## The bigger picture

For its whole life so far this wallet has been a solitary
object — one person, their keys, their diary, their record. Real
and valuable, but alone. Phase 5a is the first crack of light
between two of them. A handshake is a small thing, two phones
and three taps, but it is the atom the entire Mycelium is built
from: the spec's mycorrhizal partnerships, the hyphal lattice,
proof of place through nested organizations, social recovery —
every one of those is just handshakes, accumulated. None of it
can exist until the first one does, and now the first one can.
The wallet stopped being a vault this session and started
becoming a network. It still only knows how to do the most
local, most physical version of that — two people who chose to
stand in the same room — and that is exactly right, because
that is the version that is honest, and honesty is the only
foundation the rest of the forest can grow on.
