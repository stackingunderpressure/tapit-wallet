# Carpenter opinions — tapit-wallet

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-22 — resolving the Phase 5c design questions.
> Mode: dual-surface comms — files plus live chat — because
> AppCommander is down.

## What I did

A short, clean session. You asked for the Phase 5c sketch read
back to you as bullets so you could listen to exactly what it
is, and for the open questions handed to you as chips. I gave
you the bulleted sketch, and then I did the thing you taught me
to do with chips — I filtered. Of the four open questions, two
were genuinely yours to call and two I could settle from your
own thesis and decision D-06, so I only spent two of your taps.
You chose default-but-replaceable relays — the wallet works out
of the box, a sovereign user swaps in their own — and you chose
to have the in-person handshake bootstrap the remote channel, so
the network you weave face to face becomes reachable later,
which is exactly what makes your peers able to hold and return
your recovery slime. The two I decided: each tapit-attest
envelope rides inside a custom encrypted Nostr event, and your
wallet key is reused as your Nostr identity because it already
is one. All four are recorded as D-11, and the Phase 5c sketch
now shows resolved decisions instead of open questions. Phase 5c
is fully designed.

One honest note on process: my first attempt to update the
sketch failed because I wrote the find-text from memory and it
did not match the file. The grounding gate exists for exactly
that — I re-read the actual file, copied the real text, and the
edit went through. A small thing, but it is the rule working,
even on me, even on a documentation edit.

## What you could do better

Nothing this session — it was a decision session and the
decisions are clean. The one thing worth flagging is about the
next cut, not this one. Phase 5c-i, the transport, is a
different kind of build than everything so far. The capture
bridge, the handshake, the membership — those were all things
you could see and touch on a screen. 5c-i is plumbing: a Nostr
client, an encrypted pipe between wallets, with no immediate
visible surface of its own. That is normal and necessary —
infrastructure has to exist before the things that ride it — but
it means the cut will not produce a screenshot to admire, only
a foundation. I want that expectation set before I cut it, so
its quietness does not read as nothing-happened.

## The bigger picture

This session was small but it closed something. With D-11, every
design question in front of Layer 3's networking phase is now
answered — the relays, the privacy rule, the addressing, the
identity, the event shapes. There is a discipline in the project
that is easy to miss because it is quiet: nothing gets built
until the decisions in front of it are made and written down,
and the decisions get made by the right party — you for the ones
that are genuinely yours, the doctrine for the ones it already
settles. That is why this build has not thrashed. Six phases of
a peer network, a recovery model, an organization-governance
model, all specced before a wrong line of code could be written.
The mycelium grows slowly on purpose. The next thing to grow is
the transport — the underground threads themselves — and it is
ready to be cut whenever you are.
