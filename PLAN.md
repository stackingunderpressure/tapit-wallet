# Tapit Wallet — build plan

> Phased work order matching `DESIGN.md`'s six-phase architecture.
> `DESIGN.md` is the authoritative spec; this file mirrors its
> phasing in a tighter format and tracks status.

## What Tapit Wallet is (and is not)

It IS a person's sovereign identity wallet: a standalone app that
generates and holds the user's keypair and is the Merkle holder
of their signed attestations. It is the only place keys live, and
the hub other apps connect to.

It is NOT a cryptocurrency wallet, not a chatbot, not a feature
embedded inside another app. It does not hold coins; it holds
identity and reputation — signed attestations.

## Prime Directive

Build the smallest useful version correctly. The user's keys
never leave the wallet unencrypted — that rule outranks
everything. Clarity beats cleverness. A wallet a non-technical
person cannot use is a wallet that does not exist.

## v1 launch scope

v1 ships when a non-technical user can install the PWA, log in by
email magic link, create an identity backed by a signed identity
attestation, see what they hold, back it up (cloud + local +
designated social recovery), selectively disclose a single field
to a verifier without leaking the rest, approve a signing request
from one other app, and (for parents) create custodial child
keypairs that hand off cleanly. The Mycelium peer network (Layer
3) and the wallet bot (Layer 4) are explicitly NOT in v1.

## Layer 1 — already built

The `Wallet` core object — keypair, succession, attestation
holder, sign-both-ways, encrypted backup, sync, peer recovery —
lives in `tapit-attest`, consumed as a `file:` dependency. This
app is built *around* that object; do not rebuild it. Wallet-side
patch landed: sign-poisoning fix in `verifyEnvelope`, bundled
version bumped to `0.1.1-wallet.0`.

## Phase 1 — PWA shell + email auth + key generation [DONE]

- Vite + React 18 + TypeScript + Tailwind project shell.
- `tapit-attest` wired as `file:` dependency.
- Supabase magic-link auth.
- PWA manifest + hand-rolled service worker.
- On first login: passphrase prompt → `generateKeypair()` →
  encrypted snapshot → IndexedDB + Supabase `wallet_blobs`.
- Home screen with the user's public key displayed.
- All four gates green. Browser verification pending operator.

## Phase 2 — Identity attestation + backup posture [DONE]

- First-run display-name flow → self-signed `identityAttestation`
  with display name + creation date + pubkey on the Merkle tree.
- Attestation card renders on the home screen.
- Settings screen: cloud-sync toggle (default ON), local
  encrypted-backup download, sign-out.
- Backup-status banner on home (stale > 24h, off, pending).
- All four gates green.

## Phase 3 — Social recovery designation + simulated recovery

- User designates 5+ trusted attesters by pubkey.
- Each gets a recovery-attestation grant letter shareable
  out-of-band.
- Simulated end-to-end recovery: fresh wallet broadcasts a
  recovery request, designated attesters sign meta-attestations,
  N-of-M binds the new key into the succession chain, identity
  continuity confirmed in a verifier view.
- **Proof:** full social-recovery cycle in dev with two browser
  profiles representing two attesters.
- **Effort:** ~1 session.

## Phase 4 — Selective leaf disclosure

- Implement `disclosureProof` in `tapit-attest`'s
  `core/field-tree.ts` (the v1.1 slot the library was designed
  for).
- "Share Proof" button on the identity card. Picker for which
  leaf to prove. Output: a copyable proof string + QR code.
- A companion `/verify` route in the same PWA that validates a
  pasted proof against a known signer pubkey.
- **Proof:** "prove I'm over 21" proof generated in one browser,
  validated in another.
- **Effort:** ~1 session.

## Phase 5 — Inter-app sign request via deeplink

- Third-party app constructs a `tapit://sign?...` deeplink (or
  `https://<wallet-host>/sign?...` for web).
- Wallet renders a plain-English approval screen — who, what,
  what is being signed.
- Approve → wallet signs, returns via callback URL. Decline →
  structured decline message.
- Nostr NIP-46 transport sits behind a feature flag, OFF in v1.
- **Proof:** stub third-party demo page constructs a sign
  request, wallet handles it end-to-end.
- **Effort:** ~1-2 sessions.

## Phase 6 — Family-mode custody

- "Add child" flow under Settings. Parent enters child's name +
  birth date.
- Wallet generates a child keypair, stores it encrypted under the
  parent's passphrase.
- Parent can sign attestations about the child (birth,
  vaccination, school enrollment).
- Child's attestations appear as a separate card cluster on home,
  labelled by name.
- "Hand off to child" exports child's seed + history as an
  encrypted package + a printable recovery card.
- Receive-handoff flow on a fresh wallet install.
- **Proof:** parent creates a child, signs a birth attestation,
  hands off to a fresh wallet instance, child wallet shows the
  inherited identity and attestation history.
- **Effort:** ~1-2 sessions.

## Phase 7+ — explicit non-goals for v1

- Wallet bot (conversational guide). Dormant scaffolding is
  preserved in `src/features/{persona,snapshot-builder,suggested-questions,temporal}/`
  with `pause_safe: true` manifests, awaiting this launch.
- Mycelium peer network (Layer 3).
- Group keys with FROST / MuSig2 quorums.
- Charter governance, silent-objection admission.
- Nostr NIP-46 transport (deeplink only in v1).
- NFC tap-to-cosign and tap-to-bump-for-recovery (D24, D25).
- Voice input/output.
- WebAuthn / biometric unlock.

## Honest estimate

Phases 3-6: roughly 4-6 focused sessions to a launchable v1.
Phase 7+ is post-launch.

## Do NOT

- Do NOT re-implement anything in `tapit-attest` — inherit it.
- Do NOT put a private key anywhere but the user's wallet,
  encrypted. Not an env var, not a log, not a commit.
- Do NOT build Layer 3 before `MYCELIUM_NETWORK_SPEC.md` exists.
- Do NOT treat the approval screen as plumbing — it is the
  product.
- Do NOT add features beyond the manifests in
  `src/features-registry.ts` without a decision logged in
  `project-memory/.../decisions.md` and a matching `manifest.ts`.

## Recommended first move after Phase 2

Operator verifies Phases 1+2 end-to-end in a browser against a
real Supabase project. If the magic-link round-trip,
key-generation, encrypted-snapshot persistence, identity-attestation
creation, settings toggle, and local-export download all work
cleanly, Phase 3 (social recovery) is the next cutting session.
