# Tapit Wallet — consolidated status & direction

**Audit date: 2026-06-03.** Run against the actual repo at HEAD, not
from memory. This document is the single reconciliation the operator
asked for — where we are, where we're going, what's shipped, what's
next — rolling together PLAN.md, the project ideas file, the doctrine
quintet, and the manifest reality. PLAN.md remains the canonical
roadmap with full rationale per item; this is the higher-altitude map
that says which of those items are done and what the live priorities
are. When they disagree, trust the repo (this doc cites it); PLAN.md's
"Where we are today" section was last audited 2026-05-28 and is now
stale on the counts (it says 23 folders / 335 tests; reality is 24
folders / 531 tests).

## What this wallet is, in one breath

A person's sovereign identity wallet: it generates and holds their
keypair, it is the Merkle holder of the signed attestations that make
up their verifiable life, and it is the one place a private key ever
lives unencrypted-in-memory-only. The same BIP340 pubkey is both the
wallet identity AND the Nostr identity (D-11d) — one secret, one chain
of custody. Publishing to Nostr is one mode of selective disclosure
alongside peer-addressed encrypted chat and verifier-addressed proofs.
The wallet is NOT a Nostr feed reader. Built on the `tapit-attest`
primitive, never re-implementing it.

## Where we actually are (verified against the repo)

24 feature folders, 531 tests green, four-gate floor holding
(typecheck, lint, test, build). Roughly: Doctrine Layer 1 (identity)
majority shipped, Layer 2 (inter-app signing via deeplink) shipped with
NIP-46 transport swap deferred, Layer 3 (peer network) substantially
shipped, Layer 4 (wallet bot) deferred by design — its scaffolding
(`persona`, `suggested-questions`, `snapshot-builder`) sits dormant as
manifest+types stubs awaiting a Phase 7+ launch session.

Shipped and working end-to-end:

- Passphrase key-generation behind the double-warn gate; identity
  attestation + OpenTimestamps Bitcoin anchoring via the passive
  poll-based worker with exponential backoff.
- Peer relationship attestations (in-person 3-QR and remote-over-Nostr),
  typed by relationship leaf.
- NIP-17 gift-wrapped per-peer encrypted chat (kind 1059), rotation-safe
  on both send and receive (keyHistory subscription +
  nip44DecryptFromAnyKey).
- Organization declaration + six-kind join-policy substrate; family-unit
  envelopes with member-ratification, rendered as a Tree ring; full
  family-unit CRUD.
- Selective-leaf disclosure proofs (multi-leaf + single-leaf) with the
  verifier path running OUTSIDE AuthGate — a wallet-less visitor can
  verify at `/verify` without downloading anything. **(This is the
  surface the operator's 2026-06-03 verification-page idea attaches to —
  see Direction below.)**
- Shamir-split social recovery substrate (cohort declaration, share
  distribution scaffolding, recovery ceremony). **Cross-device run still
  UNTESTED on hardware — PLAN.md Tier 1 item 1, operator-owned.**
- Journal/diary primitive with categories, attachments, anchoring.
- Layer 2 inter-app sign pathway via deeplink (SignRequest →
  plain-English approval → SignGrant/SignDecline).
- **Nostr substrate (PLAN Tier 1 items 7 & 8, shipped 2026-06-01):**
  kind-0 profile metadata auto-published on connect; kind-1 "Share to
  Nostr" on journal entries.
- **Import-existing-nsec at onboarding (item 9)** AND **adopt-existing-key
  in an already-built wallet (2026-06-03, "Switch to my existing Nostr
  key")** — both non-destructive via the succession chain. The wallet now
  supports N-to-N growth: bring your Nostr identity in when you start, OR
  adopt it after you've built on Tapit, without losing holdings.
- **Peer-mediated key-release substrate (item 11, the architectural
  core) — substrate landed:** `identity-gate/` holds
  identityLeafCredential, releaseAuthorityEnvelopes, verifyGatedRelease,
  verifyReleaseAuthorityBundle (sub-cuts A–E per prior comms). The
  cryptographic primitives exist; the full release-ceremony UX + peer
  ping/liveness layer is the remaining surface.

Recent reliability fixes (2026-06-03 field-test session): cloud-backup
Retry now surfaces its outcome instead of swallowing it; the wallet now
auto-retries a stale/failed/never-synced cloud backup once on unlock so
the backup banner clears itself; the service worker no longer pollutes
its cache with the update-probe's nonce'd requests.

## Where we're going — live priorities, ordered

1. **Operator hardware field-tests (operator-owned, highest real risk).**
   Three threads need a physical device, not a unit test: (a) social
   recovery cross-device run (Tier 1 item 1 — the one load-bearing demo
   story still unproven end-to-end); (b) the adopt-existing-key flow
   round-trip (paste old nsec → confirm npub → verify holdings survive,
   posts appear under the old npub, chat keeps receiving); (c) confirm
   the auto-backup-on-unlock fix actually clears the day-old banner.

2. **Finish Tier 1 item 11 (the architectural core) — the release
   ceremony UX.** The envelope kinds, identity-leaf credential, and
   verifier wrappers are ALL shipped + tested in `identity-gate/`;
   vouching-circle sign-on-save (C.2) is mounted. Confirmed gap: zero UI
   consumes the release-authority builders — the ceremony is unbuilt.
   **Sub-cut plan written 2026-06-03
   (`briefs/2026-06-03-item11-release-ceremony-ux-subcut-plan.md`):**
   D1 operator request surface (start here) → D2 peer respond modal →
   D3 collect+compose to M-of-N → D4 present gated release to a verifier,
   with the imposter-signal sideband (F) and revocation folded in. Mirrors
   the proven recovery-ceremony transport pattern (sendEnvelopeTo +
   routeInbox + per-type responder modal). ~4–6 sessions; each sub-cut
   independently gate-green. Highest-leverage cut — every downstream
   custody story + fork-resolution composes against it.

3. **Tier 1 item 10 — NIP-05 verification surface.** The last unshipped
   Nostr-substrate item; smaller than item 11.

4. **The verification page as a teaching surface (NEW, 2026-06-03 operator
   idea — see ideas.md).** Make `/verify` TEACH a wallet-less visitor how
   to know the math is real — walk them through hash, Merkle path,
   signature, and the linked Bitcoin block in plain language — instead of
   just flashing "valid ✓." This is the Matt-Odell-lens thesis rendered
   as the one public artifact a sovereignty-curious stranger sees. Near-
   term, high-thesis, small: a drop-in expansion of the existing
   VerifyProofScreen. **Its larger second arc — a witnessed-correctness
   ledger where independent verifiers attest the proof/code/math is sound
   and judge-weight (HEARTWOOD) gives those attestations weight — wants
   its own roadmap brief before it's cut; sybil-resistance via
   judge-weight is non-optional there.**

5. **Tier 3 — the Matt Odell tribute attestation (inaugural public
   demonstration).** Substrate-ready now that items 7 & 8 shipped: sign a
   journal entry, profile the identity with kind-0, publish it as a
   kind-1 note referencing the signed envelope. The narrative loop-close.

6. **Key-compromise equivocation & fork resolution (NEW, 2026-06-03
   threat-model probe — see the brief + ideas.md).** After a key
   compromise the operator and attacker can each fork a valid succession
   chain; today resolution is 100% social/out-of-band — which wins
   against the operator's own circle indefinitely but cannot be proven to
   a STRANGER. The arc: Bitcoin-anchor succession links (time-order),
   fork detection at verify time, judge-weighted fork resolution (the
   keystone — reuses item 11's machinery), and rotation-announcement
   broadcast. Cut 3 depends on item 11 being real; Cut 2 (detection) is
   shippable cheaply first.

7. **Captivation & growth — UX (NEW, 2026-06-03 — see the growth brief +
   ideas.md).** The adoption thesis: the graph is the toy, the connecting
   gesture IS the security primitive, and the in-person "close the loop"
   upgrade is the deferred emotional payoff. Phase A (cheap, all data
   present, start here): A1 render verification tier on the graph
   (remote faint / in-person bold), A2 in-person upgrade gesture, A3
   weight in-person heavier, A4 local discovery cards. Phase B deferred +
   heavy (sovereign multi-hop graph, native app for NFC-tap). Phase C is
   the trust backbone (graph-interlock weighting, honesty guardrails) and
   follows item 11. Phase D the five-front-doors onboarding (parallel to
   A). First real cut: A1.

8. **Tier 2 polish backlog** (none block a credible demo): tap-for-detail
   on family-ring nodes, add-birthday-now backdated credential, over-18/21
   quick-share presets, succession-proof leaf for cosigning members, and
   the accumulated field-test copy/UX threads.

## Deferred by design (not debt)

Layer 4 wallet bot — the trusted-knowledge propagator: a substrate query
layer constrained to attestation-signed claims with verifiable
provenance, judge-weight reputation applied to knowledge, Lightning (per
SATOSHI.md) as the payment substrate so it's never rented through
corporate billing. Its folders are stubbed and dormant. NIP-46/NIP-07
inter-app signing transports. Hub layer (Hearth-spec Layer 0). Hardware-
wallet air-gapped QR signing path (tapit-attest keeps it open by using
BIP340). These are answers to "why doesn't it do X yet," confidently
framed, not apologized for.

## The through-line

Everything composes the same primitive: identity is the genesis key, the
active key is whatever the verifiable succession chain resolves to, and
every claim is a signed envelope on a Merkle field tree, optionally
Bitcoin-anchored. That one abstraction is why key rotation, identity
adoption, disclosure proofs, recovery, org auth, and the coming
release-gate all fall out as composition rather than new mechanism — and
why the verification-page idea, the bot, and judge-weight reputation can
all be built on the substrate that already exists rather than invented
fresh. The wallet's job for v1 is to make that substrate real, legible,
and trustworthy-without-trusting-us; the growth path is the existing
Nostr network, entered from either temporal direction.
