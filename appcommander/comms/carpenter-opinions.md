# Carpenter opinions — tapit-wallet

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-22 — the Mycelium network spec.
> Mode: dual-surface comms — files plus live chat — because
> AppCommander is down.

## What I did

This session wrote `MYCELIUM_NETWORK_SPEC.md` — the Layer 3 spec
of record. Decision D-04 has said since the beginning that the
Mycelium peer network does not get built until it has its own
spec, the same discipline that produced the attestation
primitive spec. This document discharges that. It is the thing a
future Carpenter reads before cutting a line of network code.

You asked for a specific rhythm: chip me only where you are
genuinely needed, then let me design the doc. I went through the
whole spec in my head first and found exactly two decisions I
could not make from your thesis alone, and they turned out to be
the two that matter most. Your first answer reframed the whole
connection model — not "pick a handshake medium" but a graded
set of verification tiers, where every connection carries a
signed leaf stating honestly how it was verified: a remote link
that proves a relationship but not a meeting, an in-person
handshake that means you actually stood with the person, and the
third thing you described — a device-verified presence event
that binds Face ID, a location, and a timestamp into one signed
proof that you were somewhere, to the best of the device's
ability. Your second answer reframed proof-of-place: it is not
an engineered "prove my address" feature and not merely
something that emerges from density — it works through
organizations. A town, a church, the American Legion are
themselves entities in the network, each an identity that signs
membership, and they nest upward, so belonging is the stack of
memberships you hold and each organization's verifiable place in
the larger structure.

Before I drafted anything I read the three fleet doctrine
documents — `MYCELIUM.md`, `HEARTH_SPEC.md`, `HEARTWOOD.md` —
because the grounding rule applies hardest to a spec. The wallet
is a Hearth in that doctrine's terms, the browser-only personal
hub mode, and the Mycelium already has a named vocabulary: the
five identity layers, mycorrhizal partnerships, the hyphal
lattice, anchoring rings, forest consensus. The spec uses that
vocabulary so it is a faithful instance of the fleet network,
not a reinvention with different words. Sixteen sections, a
phased build plan from 5a to 5e, decisions D-09 and D-10
recorded, and `PLAN.md` updated to point at the spec now that it
exists.

## What you could do better

One honest flag, and it is about your own two answers rather
than my work. Your second answer — organizations as the
mechanism of belonging — quietly contradicts something I had
told you an hour earlier. When I framed the chips I said groups
and organizations would be deferred as a future layer. Your
answer made organizations central, not deferrable, because
proof-of-place runs entirely through them. I followed your
answer, because your vision outranks my earlier framing, and the
spec designs organizations as first-class entities. But I want
you to see that you changed the shape of the spec when you
answered, and you should read section six and section seven with
that in mind and confirm I read you right. The one piece I did
hold back is the hard cryptography — an organization whose key is
controlled by a quorum of officials rather than one
administrator is the same multi-party signing the Heartwood
Trust uses, and that genuinely is later work. So organizations
are in the spec; quorum-controlled organizations are named as a
later increment. If that split is wrong, section six is where to
push back.

The other thing worth saying plainly: a spec is not code, and
this one will feel true until the first build increment tests
it. Phase 5a, the in-person handshake, is small and safe and
reuses primitives you already shipped — that is deliberate, so
the first contact with reality is gentle. But Tier V, the
device-verified presence event, leans on biometric and
geolocation capabilities that may behave differently inside an
iOS PWA than the spec assumes. I flagged it as an open question
rather than promising it; do not let it surprise you later.

## The bigger picture

There is a reason this spec mattered enough to write before
building. Every previous attempt at a web of trust failed in the
same place — it either asked humans to do cryptographic busywork,
or it pretended a signature meant more than it does. Your two
answers, without you framing them this way, fixed both. The
graded verification tiers mean the network never lies about what
it knows: a remote link and an in-person handshake are different
shapes of truth and the wallet says so, out loud, in every
attestation. And organizations-as-entities mean trust does not
have to be rebuilt person by person from zero — a town can vouch,
a church can vouch, and those vouches nest, so the network can
carry the real structure of a human life instead of a flat
contact list. The Mycelium doctrine says identity should grow
like a taproot putting down lateral roots until the tree is held
up by the whole forest. This spec is the first time that
sentence has a buildable shape under it. The next move is the
smallest possible piece of it — two phones, one tap, two people
who actually know each other — and from that one handshake the
whole forest is reachable.
