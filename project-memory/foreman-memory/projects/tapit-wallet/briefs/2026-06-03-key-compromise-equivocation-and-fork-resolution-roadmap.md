# Key-compromise equivocation & fork resolution — roadmap (2026-06-03)

> Status: RAW / NOT STARTED as of 2026-06-03. Written in response to
> the operator's self-custody threat-model probe: "even if an attacker
> had my key, I'd denounce it, my friends would re-attach to my new
> key, I could redo it ten times until the attacker tired — long-term
> zero damage, only short-term control, and I'd have control back. Are
> there gaps in our theory we cannot provide that proof?" The honest
> answer, grounded in `tapit-attest/src/core/succession.ts`: the social
> backstop is real and the theory holds AGAINST THE OPERATOR'S OWN
> CIRCLE, but there is a genuine cryptographic gap for STRANGERS that
> this brief exists to close. Companion to `PLAN.md` Tier 1 item 11
> (peer-mediated identity substrate), the doctrine in
> `project-memory/foreman-memory/core/HEARTWOOD.md` (judge-weight
> reputation), and `SATOSHI.md` (Bitcoin as public clock). Idea logged
> in `ideas.md` 2026-06-03.

## The threat being modeled

The attacker holds the operator's private key (phishing, device theft
with passphrase coercion, malware — the "even if they had it" case).
The operator's recovery theory is correct in spirit: denounce, have the
social graph re-attach to a fresh key, repeat until the attacker gives
up. The question is whether the SOFTWARE can prove the operator's branch
is the real one, or whether it relies entirely on out-of-band human
trust.

## What the code actually does today (grounded)

- `createSuccessionLink` signs each link with the **retiring** key
  (`fromPrivateKey`). Whoever holds the compromised key can sign a
  rotation — so the attacker can rotate too.
- `verifySuccessionChain` validates a SINGLE chain in isolation: every
  link signed by its retiring key, hash-linked, `fromKey` ===
  prior `toKey`. It returns that chain's `currentKey`. It does NOT take
  two chains and adjudicate between them.
- There is **no fork-resolution logic anywhere** (no longest-chain, no
  equivocation detection, no conflict adjudication). Confirmed by grep.
- Succession links are **not Bitcoin-anchored** (confirmed empty in
  succession.ts) — no objective "mine came first."
- There is **no automatic rotation-announcement broadcast** (confirmed
  empty) — the "my friends re-attach" step is entirely manual / out of
  band today.
- `createRevocation` exists (revocation.ts) — a `meta` attestation
  revoking a target envelopeId. It is after-the-fact cleanup of things
  the attacker signed, not prevention.
- The `imposter_signal` and release-authority envelope KINDS exist as
  primitives in `identity-gate/releaseAuthorityEnvelopes.ts`, but the
  live machinery that consumes them at verification time is not wired.

## The gap, stated precisely

After a key compromise, the operator and attacker can each fork a valid
succession chain from the same key: `K → K_operator` and
`K → K_attacker`. Both pass `verifySuccessionChain`. Resolution between
them today is **100% social and out-of-band**:

- **Against the operator's own circle: the operator wins every round,
  indefinitely.** Each re-attach resolves on a human verification (voice,
  video, in person) the attacker cannot forge — they cannot BE the
  operator to people who know them. The "ten times until they tire"
  model holds socially. This is the real, strong backstop and it should
  be stated to users as the genuine guarantee it is.
- **Against strangers: unresolved.** A cold verifier with no out-of-band
  channel sees two validly-signed chains and the math alone cannot say
  which is the real person. **This is the proof we cannot currently
  provide.**

Two further honest limits inside the compromise window: (1) signatures
the attacker makes while holding the key are permanent and attributed to
the operator until explicitly revoked; (2) rotating forward does not
invalidate the attacker's copy of the old key, so they can keep forking
each round — they are defeated by the circle ignoring their branch, not
by the rotation itself.

## What closes it — the cuts, in dependency order

### Cut 1 — Bitcoin-anchor succession links (objective time-order)
Anchor each succession link's record hash via the existing
OpenTimestamps worker, exactly as identity/journal attestations are
anchored. Gives every link a `btcHeight` once confirmed. This alone does
NOT resolve a fork (an attacker can also anchor), but it establishes
objective ordering — "the operator's legitimate rotation was anchored at
block N, the attacker's fork appeared at block N+M" — which is an input
to resolution and to human judgment. Smallest, most self-contained cut;
touches the chassis (succession record + Anchor) so it wants its own
careful PR. NOTE: the disclosure/verify bundle also does not yet carry
the anchor (see the 2026-06-03 verification-teaching idea) — these share
plumbing.

### Cut 2 — Fork DETECTION at verify time
When the wallet (or the public verifier path) sees two links with the
same `fromKey` but different `toKey`, surface it: "this identity has a
competing key-succession — it may be compromised or contested." Detection
is cheap and honest; it converts a silent ambiguity into a visible
warning. Requires a place to observe multiple chains (relay-sourced, or
a verifier given both). Pairs with the imposter_signal primitive already
in identity-gate.

### Cut 3 — Judge-weighted fork RESOLUTION (the real fix)
This is where HEARTWOOD judge-weight does the work. A stranger resolves
the fork by: "the peers/judges whose weight counts all vouch
(release-authority / re-attach attestations) for `K_operator`, and none
vouch for `K_attacker`." This turns the social resolution the operator
already relies on into something cryptographically checkable WITHOUT an
out-of-band channel — the verifier trusts the weighted graph, not their
own phone call. Composes the same release-authority + judge-weight
machinery as item 11's release ceremony, pointed at the question "which
branch does the trusted graph endorse" instead of "may this leaf be
released." This is the cut that lets us answer "yes, we can prove it" for
strangers.

### Cut 4 — Rotation-announcement broadcast
A signed, optionally-anchored "I rotated to K_new" event the wallet
publishes to the operator's peers on a legitimate switch (also closes
the known adopt-key / rotation gap where peers don't learn of a switch).
Peers' wallets surface "X says they moved to a new key — re-attach?"
with the out-of-band verification prompt. Automates the manual re-attach
step the operator described, and feeds the vouch attestations Cut 3
resolves on.

## Sequencing & estimate

Cut 2 (detection) is shippable first and cheaply — it's honest UX over
existing data and needs no chassis change. Cut 1 (anchoring) and Cut 4
(announcement) are independent mid-size cuts. Cut 3 (judge-weighted
resolution) is the keystone and should land AFTER or ALONGSIDE item
11's release-ceremony UX, since it reuses that machinery — doing item 11
first means Cut 3 is composition, not new mechanism. Rough order:
Cut 2 → Cut 4 → Cut 1 → Cut 3. Total is a multi-session arc; none of it
is blocked, but Cut 3's leverage depends on item 11 being real.

## What to tell users in the meantime (honest framing)

Do not oversell. The truthful statement today is: "If your key is
compromised, the people who know you can always re-establish which key
is really you, as many times as needed — the attacker can never be you
to your circle. What is still maturing is letting a STRANGER verify that
automatically; until then, identity contests resolve through the people
who know you." That is both honest and genuinely reassuring, and it is
the operator's own theory stated with its real boundary intact.
