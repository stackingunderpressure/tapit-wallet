# Hyphal lattice + Shamir cascade recovery — Phase 5e roadmap (2026-05-24)

> Status: MOSTLY SHIPPED as of 2026-05-24 close-out. Phase 5e-v
> (cohort cascade recovery) is fully end-to-end on the wallet side
> across both Mycelium and in-person QR transports. Phase 5e-vii's
> library + self-signed half landed; peer co-sign UI remains the
> last open piece. Paper-K_data export+import shipped as the
> unconditional last-resort fallback. The first writing of this
> brief was a sketch for operator review; what follows below is
> the original spec, kept as-written for archival continuity.
> Anyone using this brief as a roadmap going forward should consult
> the current foreman handoff at `appcommander/foreman-context/
> carpenter-state-for-foreman.md` for live state — the open items
> there supersede this brief's "next moves" section.
>
> Shipped through this roadmap's intent (commit refs):
>   - 5e-iii-a cohort declaration: 34ad1a8
>   - 5e-iii-b library + wallet halves: 84ebbc2 / 8ea9393
>   - 5e-iii-b-2 share distribution + receive: 806c45e / 71c9dc6
>   - 5e-iv lattice viz: b976169
>   - 5e-v library primitive + ceremony modal: 57bd569 / fa55c57
>   - 5e-v latent threshold-leaf fix: 8547175
>   - 5e blended distribute / ceremony halves / request side: eaadcde / 56938e5 / 73db6cc
>   - Paper-K_data export+import: 304d839
>   - 5e-vii library: d0bfdef
>   - 5e-vii self-signed auto-emit on recovery: 1089e1f
>   - Rotation UI + resilience cut 1: f8df997 / a287717
>   - IdentityCeremony Bind-Face-ID: d2c98d4
>
> Remaining from the spirit of this brief:
>   - 5e-vii peer co-sign UI (RecoverySuccessionModal initiator + peer-side responder + envelopeRoute entry)
>   - Rotation resilience cuts 2 + 3 (announcement broadcast + peer-side share-refresh)
>   - Wallet-side K_data-stable integration test
>
> Companion to `MYCELIUM_NETWORK_SPEC.md` §12 and `PLAN.md` Phase 5.

## What this delivers

Phase 5e is the recovery half of Phase 5. It turns the network
the wallet has already woven — handshakes (5a), memberships
(5b), Mycelium transport (5c) — into the substrate that puts the
operator back together when a device is lost. The spec calls it
"the slime": the encryption key for the cloud-mirrored backup
blob is split by Shamir Secret Sharing into N shares, each piece
held by a trusted node in the operator's web (a peer who
handshaked, an organization with a membership). M of N
together can reconstruct the key and unlock the backup. No
single holder learns anything; an M-of-N collusion at worst
decrypts ONE backup snapshot — they cannot become the operator,
because **the Shamir split is over the backup encryption key,
never over the signing keypair**. Signing authority transfers
only through a peer-witnessed succession event the recovered
wallet itself produces.

Phase 5e also delivers the **hyphal lattice** view named in §10
— the transitive trust paths through the woven web, surfaced as
something the operator can see and reason about. Recovery is
what the lattice does when the operator needs it back; the
lattice itself is the thing that exists between recoveries.

## The load-bearing constraints (must hold throughout)

1. **The Shamir split is over the backup encryption key, never
   the signing keypair.** D-03 stays. M-of-N collusion at most
   decrypts one snapshot; identity is not capturable.
2. **No pre-stashed key.** Per the 2026-05-21 sharpening: peers
   do NOT hold a recoverable share to the operator's CURRENT
   key. The recovery flow generates a FRESH keypair on the new
   device first; peers then encrypt their shares to that fresh
   key. Until the operator initiates a recovery, no peer holds
   anything decryptable on its own.
3. **Peer-witnessed succession is the only way authority moves.**
   M peers co-sign a recovery-succession event that names the
   new key as authoritative — the three-shape chain from
   tapit-attest's existing succession primitive (self-rotation,
   dual-signed transition, peer-witnessed recovery) gets its
   third shape here.
4. **Out-of-band identity check is part of the protocol.** M
   peers must independently verify it really is the operator
   asking (in person, video call, voice they know) BEFORE
   encrypting their shares. The protocol UI surfaces this as a
   required step, not an afterthought.

## The seven cuts (in order)

### Cut 5e-i — Library decision: Shamir + SLIP-0039 (no code)

Pick the Shamir implementation. Options:

1. **Adopt a maintained TypeScript Shamir / SLIP-0039 library**
   — `@scure/slip39` (paulmillr's track, audited family with
   the rest of our noble stack) is the obvious candidate if it
   exists or can be added. Best fleet-alignment.
2. **Vendor a Rust → WASM build** of `shamir-ssr` or similar.
   Higher assurance, higher operational cost.
3. **Implement Shamir against `@noble/hashes` ourselves.** Plain
   GF(256) Shamir is small (under 200 lines) BUT SLIP-0039 is
   not — share-encoding, mnemonics, group thresholds, share
   verification. Rejected as primary; possible as a thin Shamir
   layer atop noble while SLIP-0039 is deferred.

The spec names SLIP-0039 specifically because share-encoding +
human-readable mnemonics matter for the recovery UX. **First
recommendation:** confirm `@scure/slip39` availability; if it
exists, adopt it. If not, ship plain GF(256) Shamir first
(library cut 5e-ii) and defer SLIP-0039's mnemonic-encoding
layer to a follow-on. Document the choice in `decisions.md`
before code starts.

### Cut 5e-ii — `tapit-attest` gains the share primitives

Pure library cut. New `tapit-attest/src/core/shamir.ts`:
- `splitSecret(secret: Uint8Array, M: number, N: number) → Share[]`
- `combineShares(shares: Share[]) → Uint8Array`
- `Share = { index: number, bytes: Uint8Array }` (or SLIP-0039
  mnemonic form if 5e-i adopted SLIP-0039)
- Tested against published test vectors for whichever library
  shape we adopted. Round-trip + threshold checks +
  insufficient-shares-throws.

The wallet's existing encryption is PBKDF2-derived; the Shamir
split is over the **derived encryption key** for the cloud
backup blob, NOT over the passphrase. That separation lets
recovery hand back a decryptable blob without ever revealing
the operator's passphrase. New backup-format version (`v: 2`)
records both the PBKDF2-derived path (legacy unlock) AND the
Shamir-recoverable path (encryption-key split into shares).

### Cut 5e-iii — Recovery-cohort definition + share-issuance UI

Wallet UI. The operator picks the cohort — which peers from
handshakes, which organizations from memberships — and the
share-split parameters (N total holders, M threshold). Defaults
proposed: small operator-grade cohort at N=5, M=3; spec-grade
at N=7, M=4. Each holder is named by pubkey and listed in a
new `recovery-cohort` credential — subject = own identity,
credential_type = 'recovery-cohort', leaves: cohort_members
(array of {pubkey, name}), share_M, share_N, issued_at.

**Per the no-pre-stashed-key constraint, this cut does NOT
distribute shares yet.** It only RECORDS the cohort and the
threshold rule. Shares are generated freshly at recovery time
against a freshly-generated key, see 5e-v.

### Cut 5e-iv — Lattice visualization (read-only)

A new "Lattice" tab or section that walks the operator's web
visually: handshakes (Tier P + Tier R), memberships (and their
nested chains), the declared recovery cohort. This is the
hyphal lattice §10 names — the transitive trust paths surfaced
in one place. Read-only; the editing happens through the
already-shipped handshake / membership / officials flows.

Why this cut sits inside Phase 5e: the recovery cohort UI
(5e-iii) and the lattice view share most of their rendering
logic. Building them together amortizes the code.

### Cut 5e-v — Recovery ceremony (initiator side)

The big one. UI + protocol for the operator on a NEW device
trying to recover:

1. Operator installs the wallet on the new device. First-run
   detects "no local wallet, but cloud-backup blob exists for
   this Supabase identity." Offers recovery flow as alternative
   to first-time setup.
2. Operator confirms cohort identities they remember (proves
   they are who they claim to be — soft check).
3. New device generates a fresh keypair locally.
4. New device publishes a **recovery request** through Mycelium
   transport, addressed to each cohort member's pubkey, naming
   the new keypair's pubkey and asking peers to verify
   out-of-band before encrypting their shares.
5. Each cohort peer's wallet receives the request in their
   inbox, auto-routes (new route type: `recovery-request-receive`)
   to a "Help X recover their wallet" confirmation modal.

### Cut 5e-vi — Recovery ceremony (responder side)

Cohort peer's wallet:

1. Modal surfaces the request: "X is trying to recover from a
   new device. Their handshake is on file. They named you in
   their recovery cohort. Have you verified with them in
   person, by video, or by voice that this is really them?"
2. If yes → peer's wallet computes the share **at this moment**
   from the operator's most-recent cloud-backup encryption key
   (which the peer has access to via... see decision 3 below),
   encrypts the share to the requesting wallet's fresh pubkey
   using NIP-44, and sends it via Mycelium.
3. If no → modal explicitly invites the peer to verify, then
   return.
4. The operator's new device collects M shares, combines, gets
   the encryption key, downloads + decrypts the cloud backup,
   reconstitutes the Wallet via existing `Wallet.restore`.

### Cut 5e-vii — Recovery-succession event

After reassembly:

1. The new device requests M cohort peers co-sign a
   `recovery-succession` attestation: subject = the operator's
   identity, leaves: previous_key, new_key, recovered_at,
   cohort_M_witnesses (the M signers).
2. Each peer reviews the succession event and signs (existing
   co-sign machinery).
3. M signatures attached, the succession event is held in the
   new wallet — joining the existing self-rotation and
   dual-signed-transition shapes as the third shape of the
   succession chain (per `tapit-attest/src/core/succession.ts`).
4. The new key is now authoritative for the operator's
   identity going forward. Held attestations recovered from the
   backup carry their old signatures by older keys; the
   succession chain proves continuity.

## What this brief is NOT solving

- **Recovery from total cohort loss.** If the entire cohort is
  unreachable (death, exit, all-devices-lost), there is no
  recovery. The operator should either maintain cohort
  redundancy (N > M by a real margin) or keep a self-custody
  emergency backup (paper seed, hardware wallet — out of scope
  for Phase 5e).
- **Anonymous recovery.** The cohort knows the operator's
  identity; recovery is a known-peer flow by design. Anonymous
  / pseudonymous recovery is a different threat model the spec
  does not promise.
- **MAST policies on the recovery cohort.** Quorum-controlled
  ORG keys (Phase 5f) use MAST + threshold-Schnorr; recovery
  cohorts use Shamir secret-sharing on a symmetric key. Same
  M-of-N idea, different cryptographic primitive.

## Prerequisites (honest ordering)

- **5c-i, 5c-ii, 5c-iii** (transport) — DONE on main. Recovery
  ceremony runs over Mycelium.
- **5c-iii-a delivery acks** — DONE. The interactive ceremony
  benefits from honest sent-vs-acked status.
- **5c-iii-b multi-device sync** — DONE. The recovered wallet
  on the new device picks up subsequent activity through the
  same syncEnvelope substrate.
- **5d Tier V** — DONE. Optional cohort verification: a Tier V
  event from the operator's old device shortly before the
  recovery initiation strengthens the peer's out-of-band check.

Recommended cut order: **5e-i → 5e-ii → 5e-iii → 5e-iv → 5e-v →
5e-vi → 5e-vii.** After all seven, Phase 5f (quorum org keys)
opens cleanly — both phases share the same M-of-N intuition
and reuse the recovery cohort UI patterns.

## Decisions to resolve before code lands

1. **Library:** `@scure/slip39` (if available, preferred),
   alternative TypeScript SLIP-0039, Rust → WASM, or plain
   GF(256) Shamir without mnemonic-encoding (the
   simplest-first option). Document in `decisions.md`.
2. **Backup format version bump.** v1 is PBKDF2 → AES-GCM
   directly. v2 adds a Shamir-recoverable path alongside (the
   AES-GCM key gets Shamir-split BEFORE PBKDF2 wrapping). Both
   paths share the same ciphertext, so legacy unlock still
   works.
3. **How does a peer compute its share at recovery time?** Two
   models: (a) **Peer holds an encrypted share blob** the
   operator distributed at cohort-creation time (5e-iii), and
   the peer just re-encrypts it to the new key on demand —
   simpler protocol, but the peer is holding something
   per-operator forever. (b) **Peer re-derives its share at
   recovery time** from a deterministic derivation rooted in
   the peer's relationship to the operator — no per-operator
   storage on the peer, but the protocol is more involved and
   the math more delicate. **Model (a) recommended for v1**;
   model (b) as a possible 5e-viii hardening cut.
4. **Cohort default (M, N).** Operator-grade vs spec-grade
   defaults. Recommend N=5 M=3 as the operator-grade default
   and surface the trade-off in UI prose.
5. **Out-of-band verification gating.** Strict: the responder
   modal cannot send the share until the operator explicitly
   confirms they verified by voice/video/in-person. Lenient:
   the modal asks but does not enforce. **Strict recommended**
   — the verification step is the entire security model below
   the cryptography; a lenient UI undoes the protocol.
6. **Recovery-cohort visibility.** The cohort credential is
   self-issued (subject = own identity). Does the OPERATOR
   know who their cohort is at any moment? Almost certainly
   yes (the Lattice tab from 5e-iv). Does each PEER know they
   are in the operator's cohort? Spec is silent; the simplest
   model is yes (the peer's own wallet receives a
   `cohort-membership` credential when they are added,
   addressed to them via Mycelium).

## Honest sizing

- **5e-i** — 1 session of decision work, no code, $-figure for
  audit if a vendored library is chosen.
- **5e-ii** — 1-2 weeks of careful crypto work, ~12 new tests
  against library reference vectors, no UI.
- **5e-iii** — 1 week of UI (cohort picker + recovery-cohort
  credential builder), reuses PeerPicker.
- **5e-iv** — 3-5 days. Mostly rendering, no protocol.
- **5e-v** — 1-2 weeks. Initiator UI + protocol state machine.
- **5e-vi** — 1-2 weeks. Responder UI + verification gating.
- **5e-vii** — 3-5 days. New attestation kind on the
  succession surface + UI for the co-sign.

**Total Phase 5e:** 6-10 weeks plus audit calendar. Comparable
in size to Phase 5c-i. The recovery ceremony is the heaviest
piece because two interactive parties with multi-step
verification means real protocol-state-machine engineering.

## What this unlocks

After 5e-iii: the operator can declare their cohort and see
the lattice. After 5e-vii: a real recovery loop runs end-to-end
— a person who lost their phone can install the wallet on a
new device, ask 3 of their 5 trusted peers to verify them,
collect shares, decrypt the backup, get a peer-witnessed
succession event signed, and walk away with their entire
verifiable life back. No platform involved. No company holding
keys. The web that proved who they were is the web that
restores them when the device is gone. That is the operator's
"the slime," realized.

---

*Roadmap drafted 2026-05-24. Awaiting decisions.md entry before
any code is cut.*
