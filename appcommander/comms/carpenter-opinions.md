# Carpenter opinions — tapit-wallet

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-22 — Phase 5b, organizations and membership.
> Mode: dual-surface comms — files plus live chat — because
> AppCommander is down.

## What I did

This session cut Phase 5b — organizations and membership — at
commit `85d6a51`. It is the second slice of Layer 3, and it sits
on the decision you blessed: an organization is not a special
new construct, it is simply a wallet. A town, a church, the
American Legion installs the same app, creates an identity named
for itself, and that identity is the organization. The code
proves the decision was right by how little it needed: zero new
key architecture, zero new attestation kinds, zero new storage
model. An organization issuing a membership is just a wallet
signing an attestation, which wallets already do.

A membership is a credential-kind attestation the organization's
wallet signs about a person — it carries a credential_type leaf
of "membership" so the home can find it, plus both parties' ids
and names. The new `MembershipModal` runs the flow, and it is
deliberately lighter than the handshake: where a handshake is
co-signed and takes three QR transmissions, a membership is
one-directional and takes two — the recipient shows their
identity, the organization scans it and signs the membership and
shows it back, and the recipient scans it and holds it. Only the
organization signs, because only the organization is vouching;
the person is receiving, not asserting. Held memberships now
list in a Memberships section on the Identity tab, which is the
right home — a membership is a credential about you, so it
belongs next to your identity card. And the nesting you wanted
falls out for free: an organization joins a larger organization
by holding a membership exactly the way a person does, because
the organization is a wallet too. The Legion is a member of the
Town with no special code at all.

One honest gate note. The bundle-budget check flagged the
HomeScreen chunk two hundred and eighty-four bytes over its
limit. I looked before I touched it: the growth is real and
intentional — HomeScreen now carries four tabs and launches
three modals — so this was the script's "audit and recalibrate"
case, not the "you bloated something" case. I raised the budget
from eight to eleven kilobytes gzipped with a comment explaining
exactly why, so the check still guards against accidental
growth but stops being startled by legitimate growth. All four
gates green.

## What you could do better

The honest caveat, same as the handshake: I cannot field-test
this. Issuing a membership is a two-QR exchange between two
devices, and no gate and no single phone can walk it. It is
build-verified — it compiles, lints, tests, and builds — and the
real proof is two wallets in two hands. When you get a second
device on it, the thing to watch is the role split: one person
taps "Issue a membership," the other taps "Receive," and they
have to pick correctly, the same coordination the handshake
needs. If that proves confusing in practice, it is worth
telling me.

One design choice I made and want you to see plainly: I did not
formally mark an identity as "a person" versus "an organization."
In Phase 5b an organization is just a wallet with a collective's
name, and a membership is meaningful because of who signed it,
not because of a type flag. That keeps 5b small and honest. If
you later want the wallet to visibly distinguish a person from
an organization — different founding ceremony, a different card
— that is a real and reasonable want, but it is its own piece of
work, and I held it back rather than guess.

## The bigger picture

Phase 5a gave the wallet its first connection between two
people. Phase 5b gives it the other shape a human life is made
of — belonging. A person is not just a set of one-to-one
friendships; they are a member of things, and those things are
members of bigger things, all the way up to the town and beyond.
What is quietly remarkable is that the architecture absorbed
that entire idea without growing a new primitive. An
organization is a wallet. A membership is a credential. Nesting
is just an organization holding a credential. The same handful
of pieces — a keypair, a signed attestation, a QR exchange —
composed into the whole social structure of belonging. That is
what a good primitive does: it was specified once, carefully, in
`tapit-attest`, and now the network of a human life is being
built out of it without inventing anything new. The wallet is
no longer a vault, and no longer just a web of friends — it is
starting to hold the shape of a society.
