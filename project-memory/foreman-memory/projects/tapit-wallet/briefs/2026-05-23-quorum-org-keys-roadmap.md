# Quorum-controlled org keys — Phase 5f roadmap (2026-05-23)

> Status: SKETCH for operator review. Names six sequenced cuts plus
> the load-bearing decisions that gate them. MuSig2 first, FROST as
> the follow-on. Companion to `MYCELIUM_NETWORK_SPEC.md` §6 and
> `project-memory/foreman-memory/core/HEARTWOOD.md`. If greenlit
> needs a `decisions.md` entry before any code is cut.

## What this finishes

`MYCELIUM_NETWORK_SPEC.md` §6 promised two halves: **everyday
issuance** (high-volume, low-stakes, fast — the clerk signs and
other officials ratify later) and **constitutional acts** (rare,
high-stakes, true M-of-N threshold). The first half is functionally
done as of cuts 5b-org-i through 5b-org-iii — declaration, officials
roster, ratifications view, all reusing the existing co-sign
machinery. This roadmap finishes the second half. It also delivers
one property nothing currently ships: **no org private key sitting
on any single device.** Today even with the ratifications view, the
clerk's wallet IS the org's wallet — one keypair, one device, one
steal-and-you've-taken-the-club. After Phase 5f the org's authority
is reconstituted only when a quorum cooperates; the org is
genuinely controlled by the leaves of its own tree.

## The library question (load-bearing — must resolve first)

Threshold-Schnorr is the heaviest cryptography this project has
ever shipped. We do not implement it from scratch. The choices:

1. **Wait for `@noble/curves` MuSig2.** paulmillr's track has
   hinted at it but no released package exists today. Best-case
   long-term shape (audited, maintained, fleet-aligned with
   tapit-attest's existing noble stack); worst-case timeline
   uncertain.
2. **Adopt `@cmdcode/musig2`** or similar TS implementation,
   audit it ourselves, vendor it into `tapit-attest`. Faster
   than waiting; carries the maintenance burden.
3. **Commission a Rust → WASM build** of `libsecp256k1-zkp`'s
   MuSig2. Highest assurance (reference implementation),
   highest cost (audit + WASM packaging + maintenance).
4. **Implement MuSig2 against `@noble/curves` primitives
   ourselves.** Rejected on first principles — too risky for
   the consequences of any bug.

**Recommendation:** start with #1 — write to paulmillr asking
the timeline question, and if it is more than ~3 months,
fall back to #2 with a documented audit pass before any user
keys depend on it. Commit to a single library and treat it as
load-bearing forever; do not let multiple paths fork the
codebase.

BIP-327 (MuSig2 for secp256k1 BIP340) is the canonical spec; any
library we adopt must round-trip the BIP-327 reference vectors
before we ship.

## The six cuts (in order)

### Cut 5f-i — Library decision + audit budget (no code)

Pick the library per the recommendation above. Document the
choice as a `decisions.md` entry. Allocate audit calendar time
if option 2 or 3. This is a real gate; we do not start 5f-ii
until 5f-i has a name attached.

### Cut 5f-ii — `tapit-attest` gains MuSig2 primitives

Pure library cut. New file `tapit-attest/src/core/musig2.ts`
exporting:
- `aggregatePubkeys(pubkeys[]) → AggregatePubkey` — N pubkeys to
  the joint pubkey + the per-signer tweak
- `nonceGen(secretKey, sessionId) → SecretNonce + PublicNonce`
- `nonceAgg(publicNonces[]) → AggregateNonce`
- `partialSign(secretNonce, secretKey, aggregate, message) →
  PartialSignature`
- `partialSigVerify(partialSig, publicNonce, pubkey, ...) → bool`
- `partialSigAgg(partialSigs[], session) → BIP340 Signature`

Tested against the BIP-327 reference vectors. The aggregate
signature that comes out is a normal 64-byte BIP340 Schnorr
signature — `verifySignature` in `keys.ts` works as-is. That is
the magic of MuSig2: the aggregate looks identical to a
single-key signature.

### Cut 5f-iii — Wallet adds the MuSig2 ceremony for org creation

UI + protocol cut. A new `QuorumCeremonyModal` walks N
officials through:
1. Pick officials via `PeerPicker`. The wallet creating the org
   is the initiator; it knows the others by handshake.
2. Each official's wallet generates their nonce contribution
   on demand and ships it through Mycelium transport.
3. Initiator aggregates pubkeys to derive the org's aggregate
   pubkey. That aggregate IS the org's identity — born from
   the ceremony, never recorded as a private key anywhere.
4. The org's self-declaration attestation (from cut
   5b-org-i) is signed by the aggregate — first constitutional
   act, signed cooperatively by the founders.
5. Each official's wallet holds its share + the aggregate
   pubkey + the officials roster as one bundle (a new
   `quorum-charter` credential).

### Cut 5f-iv — Constitutional-act flow

UI cut. A `ProposeConstitutionalActModal` on the org wallet
(any official can initiate). Walks:
1. Pick the act: add official, remove official, rotate the
   org's key, join a parent federation, dissolve.
2. The proposal travels via Mycelium to each official's inbox
   (reuse 5c-i-ε auto-routing pattern — new route type).
3. Round 1: each official's wallet contributes a nonce
   commitment back.
4. Round 2: each official's wallet contributes a partial
   signature.
5. Initiator aggregates, publishes the resulting envelope
   (signed by the org's aggregate pubkey).
6. The envelope ratifies the act; downstream verifiers see
   one Schnorr signature from the org and trust it because the
   math says the threshold was met.

The progress UI mirrors the ratifications view: a count of
"3 of 5 officials have contributed nonces, awaiting 2 more"
that updates as inbox events arrive.

### Cut 5f-v — Migrate single-key orgs to MuSig2

UI cut. Existing single-key orgs (anyone who ran 5b-org-i)
get a "Convert to quorum-controlled" path in Settings. The
conversion itself IS a constitutional act under the old
single key — last act before the single key retires. After
conversion, no device holds the org's private key; only
shares.

### Cut 5f-vi — FROST follow-on (true M-of-N threshold)

Deferred to its own decision after 5f-i through -v are
running in production. FROST adds true M-of-N (any subset of
size M can sign), where MuSig2 is N-of-N (all signers must
cooperate). For founding boards of 5-11 trustees N-of-N is
often workable; for larger or geographically-distributed
groups FROST's threshold property becomes essential. Adds:
- Distributed key generation ceremony (replaces simple
  aggregation in 5f-iii)
- Share refresh / rotation
- Recovery for missing shares (one official's lost device)

FROST library maturity in TypeScript lags MuSig2; the audit
calculus changes when 5f-vi comes up.

## What is NOT in this roadmap

- **MAST policy trees (Bitcoin Taproot specific).** HEARTWOOD's
  on-chain governance uses MAST to encode different thresholds
  for different decisions; this wallet's org governance does
  NOT need MAST because we are not minting Bitcoin outputs.
  Different thresholds for different acts are encoded as
  different `quorum-charter` rules read at signing time, not
  as on-chain MAST leaves.
- **On-chain Bitcoin signing.** Phase 5f delivers cooperative
  signing of tapit-attest envelopes. Anchoring those envelopes
  to Bitcoin via OpenTimestamps is already shipped; the
  cooperative signature is the new piece, not the anchoring.
- **Recovery of an entire compromised quorum.** Phase 5e
  Shamir cascade is the recovery story for a quorum that
  cannot reach threshold; Phase 5f assumes Phase 5e is also
  in the toolbox.

## Prerequisites (honest ordering)

- **5c-iii (delivery acks)** — both ceremony cuts (5f-iii and
  5f-iv) are interactive multi-round protocols over Mycelium.
  Sent-but-unacknowledged messages are a real failure mode;
  the delivery-ack layer 5c-iii ships matters here more than
  anywhere else.
- **5e (hyphal lattice + Shamir cascade recovery)** — the
  recovery story for a single lost share leans on the same
  peer-network primitives.

Recommended cut order across the remaining phases:
**5c-iii → 5d Tier V → 5e (incl. Shamir cascade) → 5f-i (library
decision) → 5f-ii (library) → 5f-iii (ceremony) → 5f-iv
(constitutional acts) → 5f-v (migration) → 5f-vi (FROST).**
That sequence respects every prerequisite, ships every cut as
a complete unit, and arrives at the full quorum increment with
the supporting infrastructure already in place.

## Decisions to resolve before code lands

1. **Library:** noble (wait timeline), `@cmdcode/musig2`
   (audit pass cost), or commission Rust→WASM (full audit
   cost). The single most important choice in this phase.
2. **N upper bound v1:** start at 5? 7? 11? `MYCELIUM` §6
   names Heartwood-pattern numbers around 7-15. Begin at
   smaller, scale with confidence.
3. **First-ceremony venue:** require an in-person DKG
   ceremony for the founders (security high, UX clunky) or
   allow remote-only over Mycelium (UX clean, demands more
   of the transport)?
4. **Threshold-policy storage:** different acts have different
   threshold rules per HEARTWOOD (60-70% routine, 80%
   doctrine, supermajority for trustee changes). Where does
   the rule table live — in the org's self-declaration leaves?
   In a separate `quorum-charter` credential? Each option has
   tradeoffs for governance audit.
5. **Lost-share story:** for a single official who loses their
   device pre-5f-vi (no FROST refresh), do remaining officials
   issue a new aggregate immediately (constitutional act under
   the old quorum minus one), or wait for the recovery
   process? Both work; UX shape differs.

## Honest sizing

- **5f-i** — 1 session of decision work, no code, $-figure for
  audit if option 2 or 3.
- **5f-ii** — 1-2 weeks of careful crypto work, ~10 new tests
  against BIP-327 vectors, no UI.
- **5f-iii** — 1-2 weeks of UI + protocol state-machine work,
  comparable to 5c-i ceremony in scope.
- **5f-iv** — 1-2 weeks; similar shape to 5f-iii but driven by
  constitutional-act semantics.
- **5f-v** — small cut, 1-2 days, gated on 5f-iv shipping.
- **5f-vi** — separate large phase, FROST library + DKG +
  refresh + recovery — comparable to all of 5f-i through -v
  combined.

**Total Phase 5f (excluding 5f-vi):** 4-6 weeks of focused
work plus audit calendar. With FROST included: 8-12 weeks. The
spec is honest that this is the heaviest single increment left
after 5d; this brief does not soften that.

## What this unlocks

After 5f-v: any org-mode wallet can be controlled by a quorum
with no single-device private key. The hunting club at
n-of-n, the small association at majority-of-five, the
Heartwood Dynasty Trust (if/when it forms) at the HEARTWOOD
thresholds (60-70% routine, 80% doctrine, supermajority for
trustee changes). Every constitutional act produces a single
ordinary BIP340 Schnorr signature that downstream verifiers
trust because they trust the math, not the operator. After
5f-vi: true threshold signing, recovery for lost shares, the
full HEARTWOOD posture available to any operator-level org
that wants it.

---

*Roadmap drafted 2026-05-23. Awaiting decisions.md entry
before any code is cut.*
