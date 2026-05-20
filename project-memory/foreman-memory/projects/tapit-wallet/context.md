# Tapit Wallet — project context

```
Date: 2026-05-18
Section: context
Entry: Tapit Wallet is a person's sovereign identity wallet. It
generates and holds the user's keypair and is the Merkle holder
of the signed attestations that make up their verifiable life —
identity, relationships, credentials, agreements.
Context: Today a person's identity is rows in other companies'
databases — rented, not owned. Tapit Wallet inverts that: keys
and attestations the user holds, encrypted, portable, theirs. No
company in the loop. The keystone made holdable.
Feature: wallet-core
```

```
Date: 2026-05-18
Section: context
Entry: The wallet is a STANDALONE app in its own repo. It is the
only place a user's private keys live. Every other app connects
TO it over the Layer 2 signing pathway; every other wallet
connects peer-to-peer over Layer 3.
Context: The MetaMask model done for attestations instead of
transactions — one identity per person, every app routes through
it, every wallet reachable by every other.
Feature: app-connections
```

```
Date: 2026-05-18
Section: context
Entry: Built on tapit-attest, inherited from the chassis. The
Wallet core object (Layer 1) is already built and tested inside
tapit-attest. This app is built AROUND it.
Context: tapit-attest is the signed-attestation primitive — one
envelope, six kinds, three tiers, BIP340 Schnorr. The compat
guarantee is single-library inheritance: every app and wallet
uses the same tapit-attest, never re-implemented.
Feature: wallet-core
```

```
Date: 2026-05-18
Section: context
Entry: Four layers, built bottom-up. Layer 1 the Wallet core
(built); Layer 2 the inter-app connection pathway; Layer 3 the
Mycelium peer network (deferred to its own spec); Layer 4 the
frictionless surface + the wallet bot.
Context: Governing spec is AppCommander's TAPIT_WALLET_SPEC.md.
The phased build is in this repo's PLAN.md.
Feature: core
```
