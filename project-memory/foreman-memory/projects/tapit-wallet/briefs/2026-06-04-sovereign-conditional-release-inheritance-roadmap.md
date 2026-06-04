# Sovereign Conditional-Release engine — roadmap brief

*Written 2026-06-04 by Carpenter with the operator. Supersedes the
narrow "family safe word" framing. v2 of this brief — see the CORRECTION
note below; the v1 draft wrongly put a timelock on the Tapit side.*

Status: VISION CAPTURED + honestly grounded. No code yet. Re-scoped
2026-06-04 after operator correction. Smallest-useful first cut named at
the end.

---

## 0. CORRECTION 2026-06-04 (operator) — read this first

The first draft of this brief made the classic mistake the operator
called out: it drilled into ONE case (inheritance) with ONE mechanism (a
timelock on the Tapit side) and missed the forest. Corrected
understanding, in the operator's framing:

- **There is NO timelock on the Tapit side.** On this side, release
  happens when the circle *knows* the triggering event occurred (a death,
  an emergency, whatever the situation is — human, out-of-band knowledge)
  and a **threshold of them decides together** to release. The trigger is
  knowledge + consensus, not a clock.
- **The timelock lives only on Bitcoin.** The tapscript layer is where
  "the one key all the peers control can be assembled once the chain says
  the date has come" (maybe 10 years out), with the owner having told the
  circle out-of-band what to do. That is a separate, complementary,
  trustless layer for a different situation — NOT a knob on this engine.
- **This is a general configurable engine + a template library, not an
  inheritance feature.** "All situations are different — you're not going
  to build something for every single thing." It might be you holding one
  friend's secret as a 1-of-2, or ten friends holding a club secret, or a
  care circle's break-glass packet, or a hundred other arrangements. The
  job is the configurable primitive plus opinionated templates over it.
- **Don't get hung up on one case or one way of seeing it.** Forest, not
  trees.

Everything below is rewritten to honor this.

---

## 1. The primitive

A **sovereign conditional-disclosure / release engine**: a circle holds a
secret, and a threshold of them release it under a condition. Knobs:

- **Payload** — a word, a file/pic (envelope-encrypt the blob, Shamir the
  key — the K_data pattern we already have), a hash (commit / prove-later
  / anchor), or a bearer secret (a Lightning preimage — revealing it moves
  value). What "reveal" means changes per type.
- **Custody vs access** — "hold it and give it back later" (holders carry
  a piece they cannot read; reconstructs to a claimant — the recovery-
  cohort pattern) versus "we jointly hold it" (at threshold the holders
  themselves can open it — the safe word). Same Shamir math, opposite
  trust model. Both faces already exist in the wallet.
- **The circle** — any size, any arrangement: 1-of-2 (you keep a friend's
  secret), N friends, a care circle, a club. Fully configurable.
- **Threshold** — M-of-N, the operator's choice per secret.
- **Released to whom** — holder-judgment is the primary model (the circle
  decides, at release time, to reconstruct to whoever is claiming).
  Named-beneficiary and both-named-and-threshold are possible later
  configurations, not cut-1 requirements.
- **Release trigger (THIS side)** — the circle knows the event happened
  and a threshold consents. No timer. (Bitcoin tapscript timelock is the
  separate layer, section 4.)

The product range, in the operator's words: "Might be a Netflix password
or a missile code." Same engine, the whole stakes spectrum, expressed as
templates.

---

## 2. The operator's vision (preserved framing, 2026-06-04)

> "The time lock is on the bitcoin side. We do not have a time lock on
> this one. This one is just when we know that the friend is dead or dad
> or whoever it is then that's when we all decide. We can release the keys
> when the time lock of the bitcoin is up and he will have told us that
> the person would have let those know what to do. All situations are
> different you are not gonna be able to build something for every single
> thing... might just be you and a friend keeps a secret and you keep it
> for the other person or there's 10 friends or there's just a whole
> boatload of things to configure and time lock is not one of them... The
> one key that all of the peers control can be assembled once they know
> that that date has come... don't get too hung up on one single thing or
> one single case or one single way of looking at something."

---

## 3. Honest grounding — we're closer than it looked

Once the timelock comes off this side, the Tapit-side release model is
"a circle holds a secret and a threshold decides to release it to a
claimant" — which is most of what we already have:

- **Safe word / sharedSecret** — holders gather pieces and reconstruct
  (co-access face). Built.
- **Recovery ceremony** — holders release their shares to a requester's
  pubkey over the transport; requester combines to threshold (custody
  face, reconstruct-to-an-arbitrary-key). Built (`createRecoveryRequest`,
  `RecoveryInitiator/ResponderModal`).
- **Policy engine (item 11)** — a signed policy leaf (eligible set,
  threshold) + a released/refused verifier + a stranger-verifiable
  bundle. Built; pointed at "approve a claim," reusable for "release a
  secret."
- **Envelope encryption** — backups split K_data, not the blob; files are
  reachable by splitting the key.

So the real work is NOT a timelock engine. It is: (a) generalize the
existing custody + consensus-release into ONE configurable primitive;
(b) add the claimant-by-consensus release path (holders agree → release to
the claimant); (c) build the template library over it; (d) keep the
honest enforcement caveat. No clock on this side.

### Honest enforcement caveat (load-bearing)

On the Tapit side the gate is the circle's judgment + a signed policy +
the tooling — NOT math that physically stops a colluding threshold from
reconstructing early. For "your people, best interest" cases that is the
right and sufficient model. For adversarial-holder cases you want the
Bitcoin tapscript layer. Never overclaim this side as trustless.

---

## 4. The Bitcoin tapscript layer (separate, north star)

A Taproot spend tree where one leaf is the owner's key (spend/rotate
anytime — liveness is rotation) and other leaves are timelock paths a
peer-threshold can assemble once the chain reaches the locktime, with
thresholds that can decay over time (fewer peers needed every few years).
The chain enforces the timer trustlessly. This is **blocked** on the
Bitcoin-wallet layer SATOSHI.md names as "the largest single block of
remaining work" — there is no Bitcoin wallet / tapscript / UTXO handling
in this app today. It is a complementary layer for the long-horizon /
adversarial case, NOT part of the Tapit-side engine, and NOT cut 1.

---

## 5. Templates (the actual product surface)

The engine is general; the product is the template library. Examples the
operator named or implied — none hardcoded, all thin configs over the
engine:

- Hold-a-friend's-secret (1-of-2): you and a friend each keep the other's
  secret; either can return it.
- Family break-glass / ICE packet released by any 2 of a care circle.
- A club / clique secret held by N friends, few needed to use it.
- The letter / inheritance-by-consensus: the circle releases to the heirs
  when they know it's time and agree.
- Shared household password (Netflix) held by the family.
- ... open rule-builder underneath for everything else.

---

## 6. Build order (re-scoped, no timelock on this side)

- **Cut 1 (smallest useful):** the pure configurable release-policy +
  consensus-release evaluation core — given a policy (holders, threshold,
  custody-vs-access, claimant model) and a set of holder responses, decide
  releasable-or-not and to whom — plus full tests. No timer, no UI, no
  transport. Mirrors how `sharedSecret.ts` was built before any modal.
  Reuses item-11 policy patterns + the Shamir core.
- **Cut 2:** wire the consensus-release ceremony (holders agree → release
  to claimant) over the existing recovery request/respond/collect
  transport; minimal author + claim UI; honest enforcement caveat
  on-screen.
- **Cut 3:** the template library + a general rule-builder behind it.
- **Cut 4:** commit-and-prove (hash) payload face — anchor a commitment,
  prove-later. Smallest crypto lift (OTS exists).
- **Cut N (north star, blocked):** the Bitcoin tapscript layer +
  decaying-threshold timelocks + Lightning-preimage money face, once the
  Bitcoin-wallet substrate exists.

---

## 7. Invariants

- A fresher owner re-issue always supersedes a prior policy (the owner
  stays in control while alive).
- Release requires a threshold of holders to actively consent — never one.
- The holder/eligible set is bounded by the owner's own signed leaf
  (mirror item 11's subset rule) so a tampered policy can't widen the
  circle.
- Enforcement on this side is the circle's judgment, never overclaimed as
  trustless. The Bitcoin layer is where trustless lives.

---

## 8. Doctrine fit

- **MYCELIUM** — every holder needs a wallet, so each secret pulls more
  people onto the network; the circle becomes load-bearing → honest
  retention.
- **THE_THESIS** — sovereign over rented: the anti-extractive replacement
  for the whole category of SaaS (password managers, escrow agents,
  digital-legacy services) that exists only because someone central is
  trusted to hold the thing. Here your people hold it.
- **SATOSHI** — the tapscript/timelock + Lightning-preimage layer is the
  trustless, money-bearing extension, kept honestly separate.
- **Sleep-at-night ethics** — the enforcement caveat, stated per template,
  keeps it from overclaiming.
