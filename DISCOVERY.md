# DISCOVERY.md — tapit-wallet

> The discovery gate. `bootstrap-project` requires this file at
> the skeleton root before it will spawn the repo. It is the
> app's DNA — a Carpenter reading it understands what to build
> and why. Derived from AppCommander's
> `project-memory/TAPIT_WALLET_SPEC.md` (the spec of record) and
> the operator design conversations of 2026-05-18. The web +
> Nostr architecture below is the operator's confirmed direction;
> the anchoring feature and the OpenTimestamps-provider note in
> "Honest notes" were salvaged from a parallel local-first
> discovery draft of the same date.

## App understanding

**App name:** Tapit Wallet.

**One-sentence purpose:** a person's sovereign identity wallet —
it generates and holds their keypair and is the Merkle holder of
the signed attestations that make up their verifiable life.

**The problem:** today a person's identity and reputation are
rows in other companies' databases. Your professional standing
is rented from LinkedIn, your customer history is scattered
across CRMs you cannot read, your community standing sits on a
platform that can suspend you. You do not own any of it.

**The inversion:** Tapit Wallet makes identity a thing a person
*holds* — a keypair they generated and a growing collection of
self-verifying signed attestations they carry, encrypted,
portable, theirs. No company is in the loop, and no company can
be. Lose the device and the wallet rebuilds from peers; the host
that syncs it only ever stores ciphertext.

**Core promise:** one identity per person, owned by them, that
every app can request signatures from and every other wallet can
verify — without anyone trusting a platform.

## Core user

A person who wants to own their identity and reputation. v1 ships
to users of the AppCommander fleet's apps — when a fleet app
needs a signature, it sends the user's Tapit Wallet a request.
The wallet is mobile-first; many users are non-technical, which
is why the wallet bot (Layer 4) exists.

"operator" = Thomas, who builds and deploys the wallet app.
"user" = the person who installs and owns a wallet.

## MVP outcome

A non-technical user can install the wallet, create an identity,
see what they hold, back it up and restore it, and approve a
signing request from one other app — guided by the wallet bot if
they get stuck. The peer network (Layer 3) is explicitly out of
the MVP.

## P0 features

- **wallet-core** — generate/hold the keypair, the stable
  identity, key rotation via a succession chain, and the Merkle
  holder of attestations (`hold` / `holdings` / `aboutMe` /
  `issuedByMe`). Load-bearing — this is the product.
- **auth** — login and session for the wallet app account.
- **backup-recovery** — encrypted client-side backup
  (`exportEncrypted` / `restore`) and peer-rebuild recovery.
- **app-connections** — Layer 2: an app sends a `SignRequest`,
  the user sees and approves it on a legible screen, the wallet
  returns a signed attestation.
- **wallet-bot** — Layer 4: a conversational guide for the scary
  moments (make keys, back them up, approve this, recover).

## P1 / later

- Attestation anchoring — OpenTimestamps proofs over Bitcoin for
  held attestations, surfacing pending → confirmed (with block
  height) status, so an attestation is tamper-evident in time and
  not only signature-valid. Built on `tapit-attest`'s
  `OtsProvider` interface — see "Honest notes" for the provider
  caveat that must be resolved before this ships.
- The Mycelium peer network (Layer 3) — wallet-to-wallet
  discovery and mutual verification. Its own spec
  (`MYCELIUM_NETWORK_SPEC.md`) before any code.
- Hardware-wallet signing (the air-gapped QR path).

## Anti-features

- NOT a cryptocurrency wallet — it holds identity and reputation,
  not coins.
- NOT a chatbot.
- NOT an embedded module inside another app — it is standalone.
- The wallet never re-implements `tapit-attest`; it inherits it.

## Data model

The wallet's substance is the `Wallet` snapshot from
`tapit-attest`: the keypair, the succession chain, and the held
attestations. That lives on the user's device first.

Supabase tables (for auth + encrypted sync, scoped by RLS to the
owner):
- `profiles` — the wallet app account (auth user, display name).
- `wallet_blobs` — the client-side-**encrypted** wallet snapshot
  for sync/backup. The host stores ciphertext only; it never
  sees a key. Columns: `owner_id`, `blob` (the `EncryptedBlob`
  JSON), `updated_at`.
- `connection_requests` — pending Layer 2 `SignRequest` /
  `HoldRequest` records awaiting the user's approval.

No table ever stores a private key or a decrypted snapshot.

## Architecture overview

- **Frontend:** React 18 + Vite + TypeScript + Tailwind.
  Mobile-first, 375px design target.
- **Backend:** Supabase — auth, the `wallet_blobs` /
  `connection_requests` tables with RLS, and edge functions
  (the wallet bot runs on the `assistant-bot` part's bot runtime).
- **Hosting:** Netlify.
- **The core:** `tapit-attest`, inherited via the `attestation`
  part of the `_chassis/` parts library — it lands at the repo
  root as `tapit-attest/`, consumed as a `file:` dependency. The
  `Wallet` class (Layer 1) is already built.
- **Inherited parts:** this skeleton's `parts.json` declares
  `attestation` (the `tapit-attest` library) and `assistant-bot`
  (the bot runtime + persona, for the wallet bot) — and nothing
  else. No multi-tenant SaaS schema, no intake runner: the wallet
  is not a business-vertical app and does not inherit one's
  structure. The dispatch comms scripts arrive with every spawn
  as the universal kit, not as a declared part.
- **Four layers:** Layer 1 the Wallet core (built); Layer 2 the
  inter-app pathway; Layer 3 the peer network (deferred); Layer 4
  the surface + bot. Build bottom-up. See `PLAN.md`.

## Integration surface

- The `tapit-attest` library (the `attestation` part) — the
  envelope, signing, the `Wallet` object.
- The `assistant-bot` part's bot runtime — for the wallet bot.
- Other fleet apps — they connect *to* this wallet over Layer 2;
  the wallet does not call out to them.

## Open questions / deferred decisions

- Layer 2 transport is Nostr NIP-46 — decided (D-06), not open;
  the wallet is key-pair compatible with Nostr by construction.
  The `SignRequest` / `SignGrant` / `HoldRequest` message shapes
  still stay transport-agnostic in the shared library as
  insurance, but Phase 3 builds against Nostr.
- Layer 3 networking — deferred to `MYCELIUM_NETWORK_SPEC.md`;
  Nostr relays + discovery are a candidate substrate.
- Whether the encrypted-sync host stays Supabase or becomes
  pluggable — the `tapit-attest` sync interface is already
  storage-agnostic, so this is a later, low-cost choice.

## Honest notes carried into the build

- **OpenTimestamps — port the proven protocol, do not ship the
  npm wrapper.** `tapit-attest`'s `OpenTimestampsProvider`
  (`src/core/anchoring.ts`) wraps the `opentimestamps` npm package
  — an optional dependency, and the one piece of the library that
  shipped UNVERIFIED: its own code comment notes the anchor flow
  is verified only against `MockOtsProvider`. When attestation
  anchoring (P1) is built, write a new `tapit-attest` OTS provider
  behind the existing `OtsProvider` interface that ports
  AppCommander's proven, dependency-free protocol from the
  `ots-stamp` / `verify-ots-stamp` edge functions (see
  `HOW_TO_TIMESTAMP.md`): STAMP posts the raw 32-byte SHA-256 to a
  calendar server and assembles the `.ots`; UPGRADE re-posts the
  hash and, once Bitcoin-confirmed, reads the block height from
  the calendar's attestation. No npm OTS package. One move:
  anchoring runs on a protocol AppCommander already trusts in
  production, and the provider stops being an unverified
  dependency surface.
- **Encrypted, zero-knowledge sync is non-negotiable.** Every
  wallet snapshot is encrypted client-side before it reaches
  `wallet_blobs`; Supabase stores ciphertext only and never sees a
  key. A backend that could read a user's attestation graph would
  betray the self-sovereign premise. The backup surface is
  layered — the device, an encrypted export the user keeps in
  their own cloud, the encrypted Supabase mirror, and (Layer 3)
  peer rebuild — and no single holder, ours included, can read
  the contents or is a sole point of failure.
