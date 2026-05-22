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

```
Date: 2026-05-22
Section: decisions
Entry: D-07 — The Capture Bridge ships PWA-first. Tier 1 (Web
Share Target — pure-PWA, Android one-tap capture from any app)
is built now. Tier 2 (native share extension + App Store, the
only path to one-tap capture on iOS) and Tier 3 (desktop
browser extension) are deferred to v1.5 — "coming soon". The
native shell and the App Store listing are one effort: the
native share extension both requires the shell and clears Apple
guideline 4.2.
Context: Operator 2026-05-22 — "Pwa now and all others coming
soon." Sketch of record:
briefs/2026-05-22-capture-bridge-phase-sketch.md. App Store
assessment: no money, no exchange, no money transmission, so no
high-risk rejection category applies; worth taking at v1.5 for
the legitimacy signal and the iOS capture path.
Feature: sign-request
```

```
Date: 2026-05-22
Section: decisions
Entry: D-08 — Tabbed information architecture as a broad
organizing principle — "different tabs for different things all
around", not only the diary's life-layer category tabs. The home
surface gains top-level tabs separating the kinds of things the
wallet holds (e.g. Journal, Identity, People, Captured). The
concrete tab structure is proposed and operator-approved before
implementation.
Context: Operator 2026-05-22 — "Maybe different tabs for
different things all around." Builds on the life-layer category
tabs idea (logged 2026-05-21). The Captured tab arrives with
Capture Bridge Tier 1.
Feature: wallet-core
```

```
Date: 2026-05-22
Section: decisions
Entry: D-09 — Mycelium connections carry graded verification
tiers, each a signed leaf stating how the connection was
verified. Tier R (remote link — a relationship exists, physical
meeting NOT proven; the honest level for "I saw their post").
Tier P (in-person handshake — two phones together, QR/NFC, the
sybil-resistant tier). Tier V (device-verified presence —
biometric auth + geolocation + timestamp, signed; proves the
authenticated owner's device reported being at a place and time,
to the best of the device's ability). A verifier always sees the
tier and weighs accordingly; a weak link never masquerades as a
strong one.
Context: Operator 2026-05-22 chip answer — "I know this person,
I saw them" is a different attestation than a remote signature.
Recorded in MYCELIUM_NETWORK_SPEC.md section 4.
Feature: app-connections
```

```
Date: 2026-05-22
Section: decisions
Entry: D-10 — Proof of place works through organizations. An
organization (a town, a church, the American Legion) is a
first-class network entity — an identity that issues membership
attestations ("this person is a member of this organization").
Organizations nest: a person in the Legion, the Legion in the
Town, the Town in the County. Belonging is the set of membership
attestations held plus each issuing organization's verifiable
position upward. Single-key organizations ship first;
quorum-controlled organization keys (FROST/MuSig2 — the HEARTWOOD
MAST pattern) are a later increment. The wallet does NOT build an
authoritative residency-proof feature — that would be a dual-use
surveillance surface; it offers tier-labeled evidence a person
chooses to present. Supersedes the earlier "organizations fully
deferred" framing — organizations are core to proof-of-place.
Context: Operator 2026-05-22 chip answer. Recorded in
MYCELIUM_NETWORK_SPEC.md sections 6-7.
Feature: app-connections
```

```
Date: 2026-05-22
Section: decisions
Entry: D-11 — Phase 5c (Nostr transport) decisions. (a) Relays:
the wallet ships a default, replaceable relay set — works out of
the box, sovereign users swap their own. (b) The in-person
handshake also bootstraps a remote channel — meeting someone
exchanges relay info so the woven network is reachable remotely
(and can hold and return recovery shares); all relay traffic
stays encrypted, a peer can send but never see. (c) Event shapes:
each tapit-attest envelope travels inside a custom encrypted
Nostr event; NIP-46 stays reserved for the app-to-wallet sign
pathway. (d) Identity: the wallet key is already a Nostr identity
by construction (D-06) — nothing new minted.
Context: Operator chips plus Carpenter doctrine calls,
2026-05-22. (a) and (b) were operator chip answers; (c) and (d)
were settled from D-06 and the envelope-is-the-standard rule.
Sketch of record: briefs/2026-05-22-phase-5c-nostr-transport-sketch.md.
Build order: 5c-i transport + async delivery, 5c-ii remote
handshakes, 5c-iii connection sync.
Feature: app-connections
```
