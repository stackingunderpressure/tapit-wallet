# Audit — the three "your circle + a threshold" surfaces (2026-06-05)

*Operator asked: audit how Shamir protects the wallet key + recovery, and
where the three surfaces that "kind of do the same thing" overlap, combine,
and individually add strength. Grounded against the code this session.*

---

## 0. The headline fact about the wallet key

The wallet's **signing key / seed is NEVER Shamir-split.** What's split is
**K_data** — a fresh 32-byte random AES key that *encrypts the wallet
backup snapshot* (which is what actually contains the keypair, succession
chain, retired keys, and holdings). The chain is:

```
private key/seed  ──lives encrypted under──▶  K_data
K_data            ──Shamir-split M-of-N──▶    cohort peers (each share NIP-44'd to one peer)
M peers respond   ──reassemble──▶             K_data on the NEW device
K_data            ──decrypts──▶               backup snapshot ──▶ wallet restored
```

Consequence (the security win): a colluding M-of-N of your cohort can
decrypt at most **one backup snapshot**; they never hold your live signing
identity, and they can't *become* you (recovery also emits a
recovery-succession credential witnessed by the cohort). `K_data` is also
wrapped a second, independent way under your passphrase (PBKDF2, 210k
iterations), so the Shamir path is an *alternative* unlock, not the only
one. `saveWallet` must REUSE K_data on every save once shares are out, or
distributed shares silently die.

Files: `tapit-attest/src/core/encryption.ts` (K_data, RecoverableEncryptedBlob v2),
`recovery/createShares.ts` (splits K_data, "signing keypair is NEVER
split"), `tapit-attest/src/core/shamir.ts` (splitSecret/combineShares,
threshold floor 2, GF(256) cap 255), `recovery/createRecoveryRequest.ts`
(request→share-response→combine), `recovery/createRecoverySuccession.ts`.

---

## 1. The three surfaces, side by side

| | **Recovery cohort** | **Your secrets** | **Approvals from your circle** |
|---|---|---|---|
| Mechanism | Shamir over **K_data** | Shamir over an **arbitrary string** | **M-of-N signed vouches** (NOT Shamir) |
| What's split | the 32-byte backup key | the user's secret word/note | nothing |
| What's reconstructed | K_data → the wallet | the secret plaintext | **nothing — signatures are counted** |
| Reassembled on | the owner's NEW device | whoever gathers M pieces | nobody (verifier just counts) |
| Threshold means | M shares rebuild K_data | M shares rebuild the secret | M distinct fresh eligible signers |
| Output | a restored wallet | the revealed secret | a "released/refused" verdict + a stranger-verifiable bundle |
| Core security | single-point-of-assembly is on YOUR device; peers get ≤ one snapshot | co-access (any M holders can read it); magic-marker integrity; metadata-only ledger | coercion-resistant freshness, revocation, two operator-signed anchors; no secret to leak |
| Files | recovery/createCohort, createShares, createRecoveryRequest | recovery/sharedSecret, secretLedger | identity-gate/releaseAuthorityEnvelopes, verifyGatedRelease, gatedReleaseBundle |

The crucial distinction the operator felt: **two of the three reconstruct a
secret (recovery, your-secrets); the third never reconstructs anything — it
counts signatures and emits a proof.** "Hold a secret" vs "approve an
action."

---

## 2. Where they OVERLAP (shared strength)

- **The Shamir primitive** (`shamir.ts` splitSecret/combineShares, floor
  ≥2) is shared by **recovery + your-secrets**. Approvals does not touch it.
- **The circle source** is the real common substrate. `connections/
  findVouchingCircleCandidates.ts` unifies family-unit + recovery-cohort +
  handshake peers into one "people who could vouch" pool, and **all three
  draw their people from it**: the recovery cohort is one of its inputs, the
  approvals eligible-set is a subset of the vouching circle (same pool), and
  the your-secrets chat distribution picks from it too. Curate your circle
  once → all three get stronger.
- **The request→respond→collect ceremony shape** is shared between recovery
  and approvals (both ride signed credential envelopes over the Mycelium
  transport), though the envelope kinds are distinct.

## 3. Where each INDIVIDUALLY strengthens (distinct value)

- **Recovery** is the only one that gets you back into the *wallet itself*,
  and it's careful: you reassemble on your own device, peers never hold the
  signing key, collusion yields ≤ one snapshot.
- **Your secrets** protects *anything that isn't the wallet* with the same
  math, co-access so any M holders can read it, with magic-marker integrity
  and a metadata-only ledger (the secret/tokens are never stored).
- **Approvals** is the only one that produces a *proof instead of a secret*
  — a verdict plus a bundle a stranger can verify with math — and adds
  properties the Shamir surfaces can't: revocation, coercion-resistant
  freshness (the operator's policy window overrides the attester's), and an
  eligible-set bounded by the operator's own signed vouching circle.

## 4. Where they COMBINE (the reinforcing move)

The approvals presets literally include **"getting back into this wallet."**
That means approvals can **gate** recovery: recovery supplies the mechanism
(rebuild K_data from the cohort), approvals adds a human-consent gate that
must clear *first* — even someone with your key can't trigger the recovery
path without your real circle signing off. That is the two-consensus-layers
idea (peer consensus in front of the mechanism) expressed inside the app.

## 5. Honest architectural note (the "three places" smell)

The operator's instinct that three surfaces "kind of do the same thing" is
correct and worth acting on — but the right consolidation is **the people,
not the mechanisms.** Today the same trusted humans are selected in three
separate places (cohort declaration, vouching-circle save, ad-hoc secret
distribution), each with its own threshold UI. The strength to capture is a
single curated circle + a shared threshold-picker UX feeding all three. The
thing to NOT collapse is the mechanism: split-K_data, split-a-string, and
count-signatures genuinely protect different things and must stay distinct.
A future cut could unify the *selection + threshold* surface while keeping
three backends behind it — exactly the "experience layer over swappable
primitives" pattern the rest of the secrets arc follows.

## 6. Wording fix shipped alongside this audit

The Approvals and Your-secrets cards sit adjacent and read alike, so each
got a one-line contrast subtitle: "Your circle approves an action — they
sign off, they don't hold a secret" vs "Your circle holds a secret for you
— pieces they keep, not approvals."
