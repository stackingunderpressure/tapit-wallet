# Carpenter opinions — tapit-wallet

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-22 — weaving social recovery into the spec.
> Mode: dual-surface comms — files plus live chat — because
> AppCommander is down.

## What I did

You confirmed the Phase 5b design — an organization is its own
wallet, issuing membership attestations, nesting upward — and
then you did something better than approve it: you connected it
to recovery and told me to go read the recovery design already
in the repo and work it all in. So I did. I re-read the
2026-05-21 recovery entries in `ideas.md` and the existing
section 12 of the Mycelium spec, and then I expanded section 12
from a one-paragraph by-reference note into a full treatment.
Commit `4e30f34`.

The thing your framing added, the thing that was not yet written
down clearly, is the connection. The recovery design was already
in the repo — the Shamir cascade, M-of-N peers, the
encryption-key-not-signing-key constraint. What was missing was
the sentence that makes it click: your recovery network is not a
thing you set up separately. It IS the network you have already
woven. The peers you handshake in Phase 5a and the organizations
you join in Phase 5b are, with no extra step, the holders of
your recovery. The bar, the church, the workplace, the five
people who know you — each of them holds a piece of your slime,
and slime is exactly the right word for it, because that is what
a Shamir share is: a smear of substrate you leave across your
network as you live, meaningless alone, and enough of it
together is the whole of you. Section 12 now says that plainly,
keeps every piece of the technical design intact — the split is
over the backup's encryption key, never the signing keypair, so
a colluding quorum can read one snapshot but can never become
you — and logs "the slime" into the ideas file as your framing,
in your words.

## What you could do better

Nothing this session — you were doing my job for me, and well.
You held the picture in your head, you knew it was in the repo,
and you made me go verify it against the file instead of
trusting my memory of it. That is the grounding discipline
working in the other direction, you keeping me honest, and it is
exactly right. The one thing worth saying plainly so the scope
stays clear: recovery is now fully captured but it is not built.
It is Phase 5e — it genuinely cannot exist until the network
exists, because the cohort that holds your slime has to be woven
first. So the order stands: Phase 5b next, the organizations and
memberships, then 5c and 5d, and recovery is 5e, built last,
on top of all of it. The spec now makes sure that when a future
session reaches 5e, the whole design and your framing are
waiting there intact.

## The bigger picture

There is a quiet symmetry in what got written down today. This
whole wallet is built on a single hard fact — that you, and only
you, hold your keys, and if the device is gone the keys are gone.
That is the price of real sovereignty, and most systems answer
it by quietly keeping a copy somewhere you do not control, which
is not sovereignty at all. Your answer is better and it is the
mycelial answer: you do not keep a copy, you leave a slime. You
scatter pieces of your recoverability across the exact web of
people and organizations that already know you are real, and no
piece is worth anything alone, and the network that vouches for
who you are is the same network that brings you back. The wallet
proved this morning that it can hold a life. Section 12 is the
promise that it can also return one. Same web, used backwards.
