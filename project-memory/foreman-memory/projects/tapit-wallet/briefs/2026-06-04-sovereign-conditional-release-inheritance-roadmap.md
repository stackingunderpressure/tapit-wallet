# Sovereign Conditional-Release / Inheritance Engine — roadmap brief

*Written 2026-06-04 by Carpenter with the operator. Supersedes the
narrow "family safe word" framing. The safe word is one cell of this
matrix; this brief names the matrix and the honest build path.*

Status: VISION CAPTURED + honestly grounded. No code yet. Smallest-useful
first cut named at the end, awaiting the operator's template pick.

---

## 1. The realization

We did not build "a safe word." We built the first cell of a **sovereign
conditional-disclosure / conditional-release engine**: the thing that
decides who can learn *what*, *when*, on *what condition*, with a trusted
circle as the threshold and the wallet as the sovereign key-holder. It
has four knobs, not one:

- **Payload** — a word, a file/pic (envelope-encrypt the blob, Shamir the
  key — the K_data pattern we already have), a **hash** (don't reveal —
  *commit*, prove-later, anchor), or a **bearer secret** (a Lightning
  preimage — revealing it *moves value*). What "reveal" means changes per
  type: read / decrypt-content / prove-without-revealing / move-money.
- **Custody vs access** — "hold it and give it back to me later" (holders
  carry a piece they *cannot read*; only the owner/designated key
  reconstructs — the recovery-cohort pattern) versus "we jointly hold it"
  (at threshold the holders themselves can open it — the school word).
  Same Shamir math, opposite trust model. The wallet already contains
  both faces; we never exposed them as one deliberate choice.
- **Who may open it / to whom revealed** — the gatherer, a named
  beneficiary, the owner only, or everyone-together.
- **Release condition** — on demand, on a timelock, on a dead-man's
  switch, on a consensus of the circle, on a payment — **all
  configurable**, with opinionated templates over a general rule-builder.

The product range, in the operator's words: "Might be a Netflix password
or a missile code." Same engine, the entire stakes spectrum.

---

## 2. The operator's vision (preserved framing, 2026-06-04)

> "All configurations. For Bitcoin it can be the last key of a tapscript.
> After a long timelock your peers can come together to assemble the key.
> Pointless if still alive. Every 5 years you need less peers. If you're
> alive you can rotate any secret you want among as many people as you
> want and set any rule you want. But we provide the obvious templates for
> obvious uses. And leave it open to use however. Might be a Netflix
> password or a missile code."

Decoded into design primitives:

1. **Policy is configurable, not hardcoded.** The engine supports every
   trigger model; the operator (or a template) sets the rule.
2. **Tapscript-enforced dead-man's switch (north star).** A Taproot
   spend tree where one leaf is the owner's key (spend/rotate anytime)
   and other leaves are `timelock + peer-threshold` paths. The chain
   itself enforces "peers cannot act before the timelock; the owner
   always can." "Pointless if still alive" — a living owner spends/rotates
   before maturity, so the peer path never activates.
3. **Decaying thresholds.** Nested timelock tiers, each at a longer
   locktime with a *lower* required quorum (5-of-7 now → 4-of-7 at +5y →
   3-of-7 at +10y …). Solves the "decades later some holders have died
   too" problem gracefully.
4. **Liveness = rotation.** Being alive is demonstrated by rotating the
   secret / re-issuing the policy, which resets the timelocks. No separate
   "proof-of-life" daemon needed — the veto *is* the rotation.
5. **Templates over a general engine.** Ship opinionated presets for the
   obvious uses; leave the rule-builder open underneath.

---

## 3. Honest grounding — chassis reality vs the vision

### Reusable today (the pipes)

- **Shamir custody** — shares encrypted to each holder, held, decrypted,
  recombined (`recovery/createShares.ts`, `createCohort.ts`). The
  blind-custody "give it back to me" face is here.
- **Recovery ceremony** — request → respond → collect-to-threshold →
  reconstruct → succession, over the existing transport
  (`createRecoveryRequest.ts`, `RecoveryInitiator/ResponderModal`,
  `createRecoverySuccession.ts`).
- **Policy engine (item 11)** — a signed `release_gate_policy` leaf
  (eligible set, M-of-N threshold, **freshness horizon**), a verifier
  (`verifyGatedRelease.ts`) that yields released/refused with an
  injectable `now`, and a **stranger-verifiable bundle**
  (`gatedReleaseBundle.ts`). This is a real declarative-policy +
  threshold + time-window engine, currently pointed at "approve a claim."
- **Envelope encryption / split-the-key** — backups already encrypt the
  blob with K_data and Shamir-split K_data. Arbitrary files/pics are
  reachable by splitting the key, not the data.
- **Bitcoin clock** — OpenTimestamps anchoring + `verifyProofAnchor.ts`
  reads the confirming block. SATOSHI.md: "the chain is a public clock,
  not a database." A timelock measured in block height is the doctrine-
  perfect, un-fast-forwardable timer.

### Missing (the valve, the timer, the authorization)

- **No Bitcoin wallet / tapscript / on-chain spend paths.** The
  trustless, chain-enforced version is the **north star and is blocked**
  on the Bitcoin-wallet layer SATOSHI.md names as "the largest single
  block of remaining work." Not buildable on the current chassis.
- **No time-scheduled / decaying-threshold policy.** Item 11 has a
  freshness *horizon* (gets stricter with age); inheritance needs the
  inverse — tiers that get *more permissive* past locktimes, with
  stepped-down thresholds.
- **No beneficiary declaration** (who *receives*, separate from who
  *holds*) and **no heir-initiated release** — today the ceremony is
  owner-initiated and gated on "is this really the owner?"
- **No liveness-as-rotation wiring** as the dead-man's mechanism.
- **No templates / rule-builder UI.**

---

## 4. The two-backend design (the honest bridge)

Model the policy as a **declarative structure** with two enforcement
backends behind one interface:

- **Backend A — attestation-enforced (buildable now).** The policy is a
  signed leaf (tiers of `{after: blockheight, threshold, beneficiaries}`,
  liveness-by-rotation, freshness). Custody + the heir-claim ceremony run
  at the attestation/Shamir layer over the existing transport; the
  OTS/Bitcoin clock supplies time. Ships real value on today's chassis and
  reuses the item-11 policy engine + the recovery ceremony.
- **Backend B — tapscript-enforced (north star, later).** The *same*
  policy object compiles to a Taproot spend tree once the Bitcoin-wallet
  layer lands. Math, not social contract, enforces the timelock.

**The honest caveat that must ride on every screen:** at Backend A the
timelock is enforced by the signed policy + the tooling + the social
contract of your trusted circle — a determined colluding M *could*
reconstruct early because plain Shamir doesn't physically stop them. For
"your people, best interest" + Netflix-password + family-inheritance
cases (the operator's own framing: "you know all those people are best
interest"), that is the correct and sufficient model. For adversarial-
holder / missile-code cases you need Backend B's chain enforcement. Same
policy, two guarantees; the UI states which one is in force.

This is the doctrine-honest path: ship the useful thing now, forward-
compatible with the trustless thing when the Satoshi layer is built.

---

## 5. Policy data model (sketch)

```
ReleasePolicy {
  secretRef            // which shared secret this governs
  beneficiaries[]      // who it releases TO (pubkeys; may differ from holders)
  holders[]            // who guards the pieces (the cohort)
  tiers: [             // decaying-threshold schedule, evaluated against the Bitcoin clock
    { afterBlocks: N0, threshold: M0 },   // e.g. +6 months, 5-of-7
    { afterBlocks: N1, threshold: M1 },   // e.g. +5 years,   4-of-7
    { afterBlocks: N2, threshold: M2 },   // e.g. +10 years,  3-of-7
  ]
  livenessResetsOnRotation: true   // owner re-issue bumps the epoch, restarting the clock
  enforcement: 'attestation' | 'tapscript'
}
```

Owner-anytime is implicit (the owner holds the secret / can always
re-issue). Heir claim succeeds only when the current block height passes a
tier's `afterBlocks` AND a fresh `threshold` of holders respond AND no
fresher owner re-issue has superseded the policy.

---

## 6. Staged build order

- **Cut 1 (smallest useful, Backend A):** one template — recommend "the
  letter" / inheritance — with a **single timelock tier** (no decay yet),
  beneficiary declaration, liveness-by-rotation, and the heir claim
  reusing the recovery request/respond/collect ceremony gated on the
  policy's timelock + threshold. Honest enforcement caveat on-screen.
  Ships the inheritance flow end-to-end at the attestation layer.
- **Cut 2:** decaying-threshold tiers (the every-5-years-fewer-peers
  schedule) + a second template (shared password / Netflix).
- **Cut 3:** the general rule-builder UI behind the templates.
- **Cut 4:** commit-and-prove (hash) payload face — seal a commitment,
  anchor it, prove-later. Smallest crypto lift (OTS exists).
- **Cut N (north star):** Backend B — compile the policy to a Taproot
  tapscript once the Bitcoin-wallet layer exists. Trustless enforcement.
  Lightning-preimage payload → socially-gated sovereign money.

---

## 7. Risks / open questions

- **Catastrophic in both directions.** Release too eagerly → a living
  owner's whole digital life is exposed. Release too reluctantly → heirs
  locked out forever. The owner-veto-by-rotation + threshold + timelock
  triad must make premature release require *both* the timer to mature
  *and* the trusted threshold to act, while a single owner rotation always
  cancels.
- **Time granularity.** OTS confirmation is ~hours; fine for month/year
  timelocks, useless for short windows. Inheritance timelocks are long, so
  this is acceptable.
- **The enforcement caveat is a trust statement, not a math statement, at
  Backend A.** It must never be overclaimed as trustless. This is the one
  place the honest-scope doctrine is load-bearing.
- **Beneficiary key rotation over decades** — heirs' keys may change
  across the very long timelocks; the claim must tolerate key history.

---

## 8. Doctrine fit

- **SATOSHI** — the chain as a public clock (timelocks), and the north-
  star Lightning-preimage payload is the socially-gated-money substrate.
- **MYCELIUM** — every holder needs a wallet, so each inheritance secret
  pulls more people onto the network; the circle becomes load-bearing for
  the heaviest human stakes (death, money, legacy) → honest retention,
  not slot-machine retention.
- **THE_THESIS** — sovereign over rented: this is the anti-extractive
  replacement for the entire category of SaaS (password managers, escrow
  agents, "digital legacy" services, inactive-account managers) that
  exists only because someone central has to be trusted to hold the thing.
  Here nobody central holds it; your people do, and the math (eventually
  the chain) enforces it.
- **Sleep-at-night ethics** — the honest enforcement caveat, stated
  plainly per use case, is what keeps this from overclaiming.
