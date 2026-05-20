# Tapit Wallet — decisions

```
Date: 2026-05-18
Section: decisions
Entry: D-01 — The wallet is a standalone app in its own repo,
not a module embedded in other apps.
Context: Revised from an earlier embedded-first lean. Standalone
is the only shape that gives one true identity per person rather
than a siloed wallet inside each app. Other apps connect to it
over Layer 2. See TAPIT_WALLET_SPEC.md §2 and §9 decision 2.
Feature: core
```

```
Date: 2026-05-18
Section: decisions
Entry: D-02 — The wallet is built on tapit-attest and NEVER
re-implements it. One library, one envelope standard, inherited
from the chassis.
Context: Compatibility across every app and every wallet is a
property of single-library inheritance, not integration work.
Re-implementation is the thousand-incompatible-islands failure
mode (MYCELIUM.md). The Wallet core object (Layer 1) already
exists inside tapit-attest.
Feature: wallet-core
```

```
Date: 2026-05-18
Section: decisions
Entry: D-03 — The private key never leaves the wallet
unencrypted. Not an env var, not a log, not a commit, not a
plaintext payload to a host. Backup and sync move ciphertext
only.
Context: This rule outranks every other constraint. The host
(Supabase) is dumb storage — it stores the EncryptedBlob and
cannot read it.
Feature: backup-recovery
```

```
Date: 2026-05-18
Section: decisions
Entry: D-04 — Layer 3 (the Mycelium peer network) is not built
until it has its own spec of record, MYCELIUM_NETWORK_SPEC.md.
Context: Layer 3 is a protocol-design project on the order of
the attestation primitive itself. Improvising it under a build
deadline would produce a liability. Same discipline that
produced ATTESTATION_PRIMITIVE_SPEC.md.
Feature: core
```

```
Date: 2026-05-18
Section: decisions
Entry: D-05 — The wallet bot is built on the chassis bot runtime,
not a new bot stack.
Context: The chassis ships _shared/botRuntime.ts + a persona
module. The wallet bot (Layer 4) is a persona + a tool catalog
on top of that — composing what the chassis already inherits.
Feature: wallet-bot
```

```
Date: 2026-05-18
Section: decisions
Entry: D-06 — Nostr is the decided transport + discovery
substrate. The wallet is key-pair compatible with Nostr by
construction (same secp256k1 / BIP340 Schnorr / x-only keys);
it imports/exports nsec so wallet identity = Nostr identity.
NIP-46 is the Layer 2 transport; relays are a sync host; Nostr
discovery can carry Layer 3.
Context: Adopted behind storage-/transport-agnostic interfaces,
never a hard dependency. The tapit-attest envelope stays the
standard — Nostr is transport, not envelope. See
TAPIT_WALLET_SPEC.md §6.
Feature: app-connections
```
