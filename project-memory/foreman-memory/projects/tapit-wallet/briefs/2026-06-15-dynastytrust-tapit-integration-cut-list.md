# DynastyTrust x Tapit integration -- Tapit-side cut list (2026-06-15)

> Status: SKETCH for operator review. The Tapit half of a cross-repo build
> plan worked out with the operator on 2026-06-15. The master map + all three
> repos' cut lists live in the DynastyTrust repo at
> `docs/build-map-and-cut-lists.md` and the grounded design discussion at
> `docs/sovereignty-education-bot.md` (sections 11-11e). This brief mirrors the
> Tapit-side cuts here so this repo carries its own marching orders.
>
> Companion to `2026-05-25-frost-first-and-charter-governance-roadmap.md`
> (FROST direction already operator-locked), the transport feature manifest
> (Nostr inbox + sign-request, already shipped), and
> `2026-06-04-sovereign-conditional-release-inheritance-roadmap.md` (the parked
> Lightning-preimage bearer-secret idea).

## The integration in one paragraph

DynastyTrust is the Bitcoin vault + governance app; Tapit Wallet is the
sovereign identity + key + transport hub. The operator's design ties them
together so a DynastyTrust vault uses Tapit for sign-in (an attestation), for
multi-party signing coordination (the encrypted Nostr inbox + sign-request
approval screen that already exist here), for the large social-recovery quorum
(FROST, collapsing many people to one on-chain aggregate key), and -- at the
frontier -- for paying rescue witnesses off-chain by releasing a bearer secret
(a Lightning preimage). The crucial discipline: an attestation/coordination
event never moves a coin; only a Bitcoin tapscript signature does. Tapit holds
the keys and runs the ceremonies; DynastyTrust compiles and enforces the script.

## What already exists here (no rebuild)

The encrypted Nostr transport (NIP-44 envelopes on kind 9573, NIP-17 gift-wrap
chat on 1059, relays see only ciphertext, the wallet key is the Nostr identity),
the silent-absorb inbox (`inboxEnvelopeHandler` auto-merges arriving signatures),
the sign-request approval screen ("the screen IS the product", plain-English
banner, `cosign-existing` intent that adds a signature to a handed-over envelope),
the OpenTimestamps anchoring, NIP-44/NIP-17 crypto, and the nonce-bearing
recovery request/response in tapit-attest. Most of the operator's "envelope
travels on Nostr, wallet auto-digests, tap behind the banners" vision is these
features already shipped.

## Tapit-side cut list

tapit-attest (the vendored substrate):
- **TA-1 -- Sign-in challenge attestation.** EXTEND. A `challenge`/`sign-in`
  builder reusing the recovery-nonce pattern (random nonce, Schnorr-sign a tagged
  digest, verify echo + sig). Backs DynastyTrust login-by-attestation.
- **TA-2 -- FROST-Secp256k1 (RFC 9591) DKG + signing.** NEW. Vendor a vetted
  Rust-via-WASM FROST build per the FROST-first roadmap's operator-locked decision
  1; expose DKG-round + signing-round messages as typed objects that ride the
  envelope/inbox. Biggest new primitive; gates the social-leg story.
- **TA-3 -- FROST resharing / proactive secret sharing.** FRONTIER. Re-deal shares
  to a new roster/threshold while preserving the aggregate pubkey -- the
  fixed-descriptor, rotating-membership engine. Vetted construction only.
- **TA-4 -- Adaptor signatures + PTLC point primitives.** FRONTIER. Schnorr
  adaptor sign/verify/extract (completing a signature reveals a secret scalar) +
  PTLC point math. Gates atomic Lightning witness payment.

tapit-wallet (identity + transport + UX):
- **TW-1 -- Education content module + ExplainChip + dial.** NEW. `literacy.ts`
  (rungs 0-9, consequence/why/crypto layers, jargon-guard test) + the
  `ExplainChip`/`WhyThis` inline explainer + the Express/Rabbit-Hole speed dial.
  Generalizes the existing `secretLiteracy`/teaching-system specs. The Dynasty
  bot consumes the same curriculum.
- **TW-2 -- App-to-wallet sign over Nostr (NIP-46 seam).** EXTEND. The reserved
  transport so DynastyTrust shoots a sign-request/PSBT to the wallet over the
  existing encrypted inbox and collects the signed envelope back; the approval
  screen already renders the banner. Files: `src/features/sign-request/*`,
  `src/features/transport/*`.
- **TW-3 -- FROST ceremony UX.** NEW. DKG + signing rounds surfaced as inbox taps
  (operator-locked pattern), OTS-block-anchored deadlines, and an **abortable**
  session on a duress/withdraw signal. Deps: TA-2, transport.
- **TW-4 -- FROST resharing UX.** FRONTIER. Rotate-a-member ceremony as taps;
  reflect "membership changed, address unchanged" plainly. Deps: TA-3, TW-3.
- **TW-5 -- Lightning preimage release on signing.** FRONTIER. On a verified
  witness signature, release the bearer secret that pays them (plain invoice
  first; adaptor/PTLC atomic later). Aligns with the parked conditional-release
  brief. Deps: TA-4 for the atomic form.
- **TW-6 -- Sign-in attestation kept + queryable.** EXTEND. Persist each signed
  sign-in attestation; let the user show when they signed in. Deps: TA-1.

## Sequencing (matches the master spine)

Phase 1: TW-1 (education) + TW-2 (Nostr sign bridge) + TA-1/TW-6 (sign-in).
Phase 2: TA-2 + TW-3 (FROST signing, social leg as one aggregate key).
Phase 3: TA-3 + TW-4 (resharing -- fixed descriptor, rotating membership).
Phase 4: TA-4 + TW-5 (atomic Lightning witness payments).
Small quorums + small amounts on existing primitives first; climb as trust and
value grow.

## Honest lines (the same risk register the bot teaches)

An attestation digest is domain-separated and never a BIP341 sighash, so
coordination never moves a coin. Big social quorums belong off-chain as a FROST
aggregate, not a giant on-chain thresh. FROST resharing and PTLC/adaptor payments
are frontier -- vetted constructions only, never hand-rolled. A FROST/PSBT session
must be abortable mid-flight under a duress signal, with fresh nonces always. The
sign-request banner shows the meaning, never just the hex. The wallet never
surrenders a key and never commits a value without a human tap. Pay witnesses with
value (a Lightning preimage), never with a piece of the vault's spending control.
