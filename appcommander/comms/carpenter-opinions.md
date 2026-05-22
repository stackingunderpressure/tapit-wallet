# Carpenter opinions — tapit-wallet

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-22 — organization key governance + a Phase 5c
> sketch.
> Mode: dual-surface comms — files plus live chat — because
> AppCommander is down.

## What I did

You asked the deep question — how does an organization's signing
key actually work, is it the clerk, is it twenty people, is it
sign-now-and-ratify-later — and then told me to write the answer
into the spec, put it in the sequence, push to main, and keep
going. Commit `c655526`.

The answer, now living in section 6 of the Mycelium spec, is
that it is not one model, it is a split, because an organization
key does two different jobs. Everyday issuance — signing
memberships, vouching — has to stay fast, so a clerk signs and
the membership is valid the instant they do; other officials
co-sign it later, at their own pace, and because the
tapit-attest envelope is multi-signature by nature each added
signature is a ratification that only accumulates. Nothing is
redone, nothing is revoked — that was your instinct, option
three, and it turned out to need no new cryptography at all,
because it is the co-sign machinery already shipped, pointed at
governance. Constitutional acts — changing who the officials
are, rotating the key, the organization joining a bigger one,
dissolving it — are rare and heavy, so those take a true M-of-N
threshold, the Heartwood principle of harder locks for heavier
decisions. And the deeper thing you were reaching for: in the
full quorum model there stops being a single organization key at
all. The authority is spread across the officials' wallets, so
there is nothing in one drawer to steal, and the organization is
genuinely controlled by the leaves of its own tree. I slotted
that work into the phasing as Phase 5f and updated PLAN.md to
read 5a through 5f.

Then you said continue, and you were stepping away. So I made a
deliberate choice about what "continue" should mean with you not
here to answer a fork. The honest next build, Phase 5c, is Nostr
transport — the largest and forkiest piece left, with real
decisions in it about relays and event shapes. Cutting a big
networking feature solo, with no way to surface a fork to you,
is exactly the un-grounded move the whole discipline guards
against. So instead of guessing, I wrote a Phase 5c design
sketch — what it adds, the encrypt-everything-on-relays
constraint, a three-slice build order, and four open questions
that genuinely need you. It is in the briefs folder, ready to
bless. Branch and main are both pushed.

## What you could do better

Nothing this session — but I want to be transparent about the
judgment call, because you handed me real autonomy and you
should know how I spent it. I did not build code while you were
gone. I built the spec section you explicitly approved, and a
sketch of the next phase, and I pushed everything. I held back
from solo-cutting Phase 5c not out of caution for its own sake
but because Nostr transport has four genuine forks in it, and a
wrong fork chosen alone is a costly rework. If you would rather
I take bigger swings autonomously — pick a fork myself and cut,
accepting that you might redirect it — tell me and I will. My
read of your culture is that you would rather come back to a
sharp sketch you can bless in two minutes than to a thousand
lines built on a guess. The sketch is the bet that I read you
right.

## The bigger picture

There is a pattern worth naming in how the organization-key
answer came out. You asked the question with three guesses in
it, and the resolution was not to pick one — it was to notice
that two of your guesses were each correct for a different job,
and that the wallet already had the machinery for the hard one.
That keeps happening on this project. The capture bridge was a
journal entry wearing one leaf. A membership was a credential.
Organization governance turned out to be the co-sign feature
again. None of it needed new primitives, because the primitives
underneath — a keypair, a signed multi-signature envelope, a
Merkle leaf — were chosen well enough, once, that the whole
social and institutional structure of a human life keeps
folding out of them. A town that signs, ratifies, and is
controlled by its own people is, underneath, the same three
nouns as a person writing a diary entry. That is not a
coincidence. It is what it looks like when the foundation was
laid honestly.
