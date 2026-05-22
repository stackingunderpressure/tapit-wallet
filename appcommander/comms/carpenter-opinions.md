# Carpenter opinions — tapit-wallet

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-22 — the verified-badge fix.
> Mode: dual-surface comms — files plus live chat — because
> AppCommander is down.

## What I did

You reported that an entry would show verified and then come back
not verified, like the wallet kept trying to re-verify it. You
were seeing a real bug, and the fix is in commit `b2260f9`.

Here is what was actually happening. There are two separate
places the verified state can live. One is the anchor queue — a
device-local IndexedDB worklist the background worker uses to
track which entries still need stamping. The other is the
attestation itself: when an entry's OpenTimestamps anchor
confirms, the WalletProvider attaches that confirmed anchor onto
the held attestation, and that attestation rides your encrypted
wallet backup. The attestation's anchor is the durable, permanent
record. The queue is just a scratch list.

The bug was that the verified badge — on both the entry card and
the entry detail screen — was reading only the scratch list. So
the moment that device-local queue did not have the row — and it
will not have it after a fresh browser session, a re-unlock, or
the wallet restored on another device — the screen fell back to
"Time-verifying," even though the entry was genuinely, durably
verified, with the Bitcoin anchor sitting right there on the
attestation. The wallet was not re-verifying anything; the worker
already skips confirmed entries. It was purely the screen looking
in the wrong drawer. The fix is exactly what you asked for: both
views now read the anchor off the attestation first, and only use
the queue as a fallback for entries that genuinely have not
confirmed yet. Once an entry is verified it stays verified — the
badge is sticky, because the truth it reflects was always
persisted; the screen just was not honoring it. All four gates
green.

## What you could do better

Nothing on your side — this was our bug, and your instinct about
it was exactly right, including the part where you said the math
should stay re-checkable but there is no sense in re-trying. That
is precisely the shape of the fix: the verified state is a fact
recorded on the attestation, re-derivable any time from the
anchor and the Bitcoin chain, but not something to anxiously
recompute. I did not add a literal "re-check the math" button,
because you framed that as optional and the sticky badge was the
real ask — the smallest correct fix. If you ever want that button,
it is a small follow-on; say so and it is yours.

One honest note: like every UI change this stretch, this is
build-verified, not pixel-verified by me. The real confirmation
is you, on the live deploy, opening an entry you know was
verified, reloading, and watching the badge hold. The cause is
well understood and the change is six lines of logic, so I am
confident — but your eyes close the loop.

## The bigger picture

This was a small fix with a worthwhile lesson sitting underneath
it. The wallet has, by design, a durable layer and a scratch
layer — the attestation that rides the backup, and the
device-local worklist that helps the background worker do its
job. That separation is correct and healthy. The bug was simply
that a screen trusted the scratch layer when it should have
trusted the durable one. It is the same principle that runs
through this whole project: the fruiting body is temporary, the
mycelium underneath is what persists, and anything that matters
has to be read from the part that lasts. A verified badge is a
claim about something permanent — an event hashed into Bitcoin —
so it should never have depended on a cache that any reload can
empty. Now it depends on the attestation, and the attestation is
forever. The wallet tells the truth a little more honestly than
it did this morning.
