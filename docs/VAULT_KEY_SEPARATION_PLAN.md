# Separate vault keys from the Nostr identity — plan

Status: PLAN only (operator: "write the plan", 2026-11-23). No code. Money-
touching: nothing here is built without an explicit go on this document.
Read from tapit-wallet at 5d2fac2 and DynastyTrust apps/web on 2026-11-23.

## 1. The problem

Tapit's wallet has one flat keypair with no chain code (`tapit-attest`
Wallet; DynastyTrust `keystore.ts` `importTapitPubkey`: "Tapit's identity key
has no BIP32 derivation at all"). That one key is:

- the wallet's Nostr identity (who sends and receives on relays), and
- the key DynastyTrust puts into vault scripts (`02` + the x-only key).

So a vault spent through a script path writes the wallet's Nostr identity
onto the Bitcoin chain, and every vault the wallet is in shares the same key,
so the vaults are linkable to each other and to the person's Nostr life.

## 2. The change

The wallet derives a separate key for each vault from its own secret, so:

- a vault key is unrelated to the Nostr identity to anyone without the secret;
- two vaults never share a key;
- the key is recomputable from the wallet alone, so a backup file or the
  recovery key brings vault keys back with everything else.

Proposed derivation (to be reviewed, then fixed with test vectors before any
real coins touch it): `vault_secret(i) = taggedHash("TapitVaultKey/v1",
identity_secret ‖ uint32_be(i)) mod n`, rejecting zero; `i` = 0, 1, 2… per
vault. Signing never exports the secret: it stays inside `tapit-attest`'s
Wallet, as today (`signDigestAs`).

## 3. What stays the same

- Every existing vault keeps working on the key it was built with. The
  wallet's existing `keyHistory` signing path is untouched.
- Nostr identity, attestations, messages, Face ID, backups: unchanged.
- DynastyTrust's Legacy Recovery reads keys from the descriptor; unaffected.

## 4. Blast radius (read from the code)

tapit-attest (vendored byte-identical into several repos, guarded by
`scripts/check-integrity.mjs` + `INTEGRITY.sha256` — change in the canonical
copy here, re-hash, re-sync every copy):
- `src/core/wallet.ts`: `deriveVaultKey(i)` (public key out), signing with a
  derived key, the snapshot remembering which indices are in use.

Tapit:
- `src/features/settings/PublicKeySection.tsx` (the "give an app my key"
  screen) and the sign-in handoff: hand out the next vault key, not the
  identity key.
- `src/features/sign-request/signPsbtCosign.ts`: today matches the PSBT's
  leaf keys against `wallet.keyHistory` (line ~81); must also match derived
  vault keys, scanning a bounded index range as a safety net if the record
  of used indices were ever lost.
- `acceptVaultMembership.ts`, `vaultTrail.ts`: the membership record names
  which vault key the wallet contributed.

DynastyTrust:
- `apps/web/src/lib/keystore.ts` (`importTapitPubkey`, `tapitXOnlyPubkey`),
  `pages/KeyManager.tsx`, `VaultWizard.tsx`, `InviteClaimPath.tsx`: accept a
  per-vault key from Tapit instead of reusing one identity key everywhere.
- `tapit-profile-lookup.ts`: a vault key no longer resolves to a Nostr
  profile; names come from the encrypted acknowledgement (metadata plan,
  Phase 3), which must ship first.

## 5. Risks and how each is closed

- **Wrong derivation = unspendable coins.** Fixed test vectors checked in
  both repos; signet vault built, funded and spent on every path before any
  mainnet use.
- **Lost index record.** Signing scans indices 0..N against the PSBT's leaf
  keys; the backup file carries the record anyway.
- **Copies of tapit-attest drifting.** The integrity gate fails CI until every
  copy matches.

## 6. Decisions for the operator

1. One new key per vault (recommended) or one shared vault key separate from
   the identity (simpler; vaults stay linkable to each other, not to Nostr).
2. Existing vaults: leave on their current key (recommended), or move funds to
   a recompiled vault later, by hand, per vault.

## 7. Order

After the metadata plan's Phase 3 (names without profiles). Then: tapit-attest
derivation + vectors → Tapit signing and key handoff → DynastyTrust import →
signet end-to-end spend on every path → only then real coins.

## 8. Left out

BIP32/xpub export for Tapit keys, hardware-wallet import of Tapit keys, and
moving existing vaults automatically.
