# Beat the HODL Machine — proof-of-moment spec

> The build contract for the arena. Not marketing — the exact mechanism, the
> data shapes, the verification math, and the ripples onto what already
> exists. Decisions locked in the 2026-09-03 design pass are marked **LOCKED**;
> open items are marked **OPEN**.

## The soul (non-negotiable)

BTC **count** is the only score, never dollars. You start holding one whole
coin; your moves are sell-all and buy-all-back; your coin count now, after real
friction, races the do-nothing HODL baseline fixed at 1.0. The product's entire
value is that **nobody can lie about when they moved, at what price, or how they
did** — so every design choice below serves one goal: a claim the math either
verifies or refutes, with no trust in the player, the arena, or us.

## The four locked decisions

1. **Genesis = a donation to an open-source charity.** **LOCKED.** The start of
   every trail is a real, public, on-chain Bitcoin donation to a neutral
   open-source charity address. The sats are genuinely gone — no escrow, no
   return, the recipient may spend them immediately. Its only job is to be an
   unfakeable, timestamped, paid-for **starting point** that legitimizes the
   eventual claim. Bigger stake = more credibility (skin in the game). Because
   the sats can be spent the instant they land, **nothing downstream may ever
   depend on them still existing** — by the time it matters whether you won,
   the donation is long spent, and that is fine.

2. **The price source = a signed price oracle.** **LOCKED.** The public datum a
   move binds to is a cryptographically **signed** price reading (the Bitcoin
   DLC-oracle pattern): the oracle publishes `{price, time, source, round}`
   signed by its own well-known key, on a fixed cadence. Verification is then
   pure math against the oracle's pubkey — no "trust the chart." The oracle
   cadence is effectively the game's tick: a move binds to the nearest oracle
   round, so move-price granularity = oracle round frequency.

3. **The anti-hindsight fence = a live per-move Bitcoin anchor.** **LOCKED.**
   The moment a move is made, its hash is anchored to Bitcoin via
   OpenTimestamps. This proves the **latest** bound — the move existed by that
   block — which is what stops a player from constructing a perfect chain in
   hindsight from prices that already happened. Paired with the oracle's signed
   timestamp (the **earliest** bound — you could not have signed before that
   price printed), the two fences pin the moment: earliest is precise (oracle
   time), latest is block-coarse (~an hour to full confirmation), and together
   they are sufficient. Accepted tradeoff: the anchor is a public mark at the
   time of a move, so a determined watcher monitoring OTS calendar servers could
   infer that *someone* acted — but it is aggregated with everyone's timestamps,
   is not a followed feed, and reveals nothing about **what** the move was. The
   operator chose this over a decoy heartbeat (more complex) and over an
   earliest-only honest-limit v1 (not hindsight-proof).

4. **Home = prototype in the wallet, then export.** **LOCKED.** A thin arena
   screen is built inside `tapit-wallet` first — it plugs into live signing and
   transport and proves the real relay round-trip fastest — then the portable
   engine (`move-chain` + `truthScore` + the transport seam) exports to a
   standalone Beat-the-HODL site that signs through Tapit over the Layer-2
   connect pathway. The engine is already dependency-light and portable, so
   choosing the forever-home later costs nothing now.

## The sequence, with dependencies

1. **Donate → genesis.** Player sends the charity donation. Its txid, once
   broadcast, is the trail's root. *Depends on: nothing. Blocks: the genesis
   move.*
2. **Sign the genesis move.** Wallet signs move 0 = `{seq:0, prev:'', kind:'start',
   charityTxid, stakeSats}` with the player's key. *Depends on: the donation
   txid. Blocks: every trading move.*
3. **Trade → sign a move.** Each move = the player's signature over
   `{seq, prev: <hash of previous move>, side: 'sell'|'buy', price: <oracle
   round: price, time, source, round, oracleSig>}`. *Depends on: the previous
   move's hash and a fresh oracle round. Blocks: this move's anchor.*
4. **Anchor the move live.** The move's content hash (`envelopeId`) is submitted
   to OpenTimestamps immediately; the pending proof upgrades to a Bitcoin block
   height on confirmation. *Depends on: the signed move. This is the latest-time
   fence.*
5. **Collect privately.** The signed, anchored chain is held by the player on
   their own device. **No move content is broadcast live.** *Depends on: nothing
   public. The scorer runs here, locally, so the player always sees their honest
   coin-count-vs-1.0 before anyone else sees anything.*
6. **Reveal — optional, terminal.** To make the claim, the player publishes the
   whole chain (rooted to the public charity txid, every move carrying its
   oracle datum and its OTS proof). A loser can simply never reveal. *Depends
   on: the full chain existing.*
7. **Verify — trustless.** Anyone re-runs the checks below against the revealed
   chain and the public genesis tx. *Depends on: the reveal + public data only.*

## Verification checklist (what the math checks)

A revealed chain is valid iff **all** hold, all-or-nothing:

- **Genesis is real:** the `charityTxid` is a confirmed on-chain payment to the
  known charity address, and it precedes move 0.
- **Every price is real:** each move's oracle datum carries a valid signature
  from the oracle's known pubkey over `{price, time, source, round}`.
- **Every move is the player's:** each signature verifies against the player's
  own identity (the same identity as move 0 — one chain, one owner).
- **The chain is unbroken:** `seq` is 0,1,2,… and each `prev` equals the real
  hash of the move before it (this is `verifyMoveChain`, already built).
- **No hindsight:** each move's OTS proof anchors its hash to a Bitcoin block,
  and each move's oracle time ≤ its anchor time — you signed after the price
  printed and committed by that block, so you could not have backfilled.
- **The score is honest:** `simulateWholeCoin` recomputes the same coin count,
  friction, and coin-vs-1.0 edge the player claims (already built).

## Ripples onto what already exists

- **`moveChannel` (kind 9584) changes role.** It was built to broadcast full
  moves live. Under this spec the live public act is the **OTS anchor of the
  hash**, not a live Nostr move. So `moveChannel` becomes the **reveal**
  channel — it publishes the finished chain at reveal time — or is dropped in
  favor of publishing the revealed chain as a normal attestation. It is NOT how
  moves go out in the moment. *(No code deleted yet; role note only.)*
- **`move-chain` gains an oracle-datum field.** `buildMoveDraftInput`'s move
  payload must carry the signed oracle round `{price, time, source, round,
  oracleSig}`; `verifyMoveChain` gains an oracle-signature check and the
  oracle-time ≤ anchor-time check. Additive; the existing seq/prev/owner checks
  stand.
- **Anchoring is already proven.** The journal feature already anchors
  attestations to Bitcoin via `tapit-attest`'s OTS primitives
  (`assembleProof`, `bitcoinHeight`, `pendingAttestations`, `AnchorVerification`)
  and the wallet's anchor worker. A per-move anchor rides that exact path.
- **`truthScore` is unchanged.** It reads the verified chain and computes the
  score; it does not care how the chain was transported or anchored.

## Open items

- **RESOLVED + BUILT — the oracle (2026-09-03).** Research found NO reliable
  public Nostr-native BTC/USD oracle in 2026 (NIP-88 is stalled/unmerged with no
  live publisher; Suredbits is dead), so the operator chose **our own tiny signed
  round**. Built: `netlify/functions/price-oracle.mts` fetches a real exchange
  price (Coinbase, Kraken fallback) and signs a canonical round with the oracle's
  BIP340 key (`ARENA_ORACLE_PRIVATE_KEY`, Netlify-env secret, never committed);
  `src/features/arena/priceRound.ts` verifies a round in-browser with the SAME
  tapit-attest Schnorr primitives (no new crypto), and `priceRoundCanonical.ts`
  single-sources the exact signed bytes so signer and verifier can't drift
  (pinned by a test). The output is Nostr-event-shaped so a real NIP-88 oracle
  drops in later with no client change. Wired into ArenaScreen behind
  `VITE_ARENA_ORACLE_URL` + `VITE_ARENA_ORACLE_PUBKEY` (absent → the manual price
  path stays); a verified round stamps `oracle_pubkey/sig/round/time/source` into
  the move so the price is re-verifiable. STILL OWED: generate the oracle key,
  set the secret in Netlify, publish the pubkey, deploy, and smoke the endpoint —
  the function is unsmoked from the build sandbox.
- **OPEN — the charity address.** Pick the open-source charity and its
  verifiable donation address; publish it so the genesis recipient is
  common knowledge.
- **OPEN — anchor cost/cadence.** OTS is free and aggregated, so per-move
  anchoring is cheap, but confirmation is block-coarse; confirm that block-level
  latest-bound granularity is acceptable (it is, given the oracle gives precise
  earliest-bound).
- **NEXT CUT — the arena screen.** In-wallet, on the live transport: mint the
  genesis move, mint sell/buy moves bound to the latest oracle round, anchor
  each, run `simulateWholeCoin` for the sats-vs-1.0 scoreboard with friction and
  the beat-the-HODL threshold. The screen, the engine, and the scoreboard do not
  depend on the oracle/anchor wiring — only the move-build and verify steps do —
  so the playable surface can be built now and the oracle/anchor wired as they
  land.

## Honest limits

- The latest-bound is block-coarse (~10 min–1 hr), not second-precise; the
  oracle's signed time carries the precise earliest-bound.
- The live anchor is mildly observable (OTS calendar servers), so "someone
  acted" is weakly inferable even though the move content is not. Accepted.
- The oracle is a trusted third party for *price*, though its signatures make
  that trust verifiable and swappable; the player's honesty about moves is NOT
  trusted — that is what the anchoring and chain math remove.
