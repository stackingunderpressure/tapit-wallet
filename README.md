# Tapit Wallet

A person's sovereign identity wallet. It generates and holds the user's
keypair, and it is the Merkle holder of the signed attestations that make up
their verifiable life — identity, relationships, credentials, agreements. It
is the one place a person's private keys ever live, and the hub every other
app connects *to* in order to get something signed.

The keys never leave the wallet unencrypted. That rule outranks every other.

## We invented nothing — and that's the point

Everything under the hood already exists in the world: Schnorr signatures,
Merkle trees, Shamir secret sharing, OpenTimestamps anchoring, web-of-trust
cosigning, threshold schemes, the Nostr relay transport. This project's job
is not to invent cryptography. It is to **package these proven primitives so
an ordinary person can do something they never could have done before** —
hold their own keys, split a secret among the people they trust, prove a
moment happened and can't be tampered with, recover what they'd otherwise
lose forever — *without having to understand the cryptography first*.

The product is the bridge **and the education**. Using it teaches you what
you're doing and why it matters for your own sovereignty, in plain,
non-biased language, the way the calculator handed people arithmetic they
could never have done by hand. Built for one family first — if it only ever
works for one family, it already succeeded — and offered as a gift to anyone
who hits the same walls.

## The forkable libraries

The interesting parts are meant to be lifted out and reused. They are MIT
licensed, dependency-light, and have no dependency on this app.

- **`tapit-attest/`** — a standalone signed-attestation primitive. One
  envelope shape carries six kinds of attestation across three trust tiers:
  BIP340 Schnorr over secp256k1, a Merkle field tree for selective
  disclosure, optional OpenTimestamps anchoring, NIP-44 encryption, Shamir
  recovery, succession hash-chains, and the `Wallet` core object that holds a
  keypair hard-private and signs. Zero Bitcoin-script dependency. Its own
  test suite is green on its own.
- **`bip341-psbt-signer/`** — a small, focused BIP341 Taproot / PSBT signer
  built on `@noble/curves`. The wallet holds the key and signs; it never
  signs inside another app.

The wallet composes these behind a mobile-first React surface, plus a Nostr
transport seam (hand-rolled over `@noble` — not `nostr-tools`) so signed
attestations and move-chains can be broadcast and verified across relays with
no central server in the path.

## The bigger thesis — a sovereign-trust ecosystem

A single signed attestation is a fact you can prove. A lot of them, vouched
for by the people and institutions around you, become something an attacker
with a bigger budget still cannot fake: accumulated verified proof. The moat
is not one clever signature — it's that an honest person with their whole
town, family, and friends genuinely vouching for them carries more weight
than an attacker who spent ten thousand dollars to manufacture a lie, and no
amount of money buys a real web of relationships. The trading game (Beat the
HODL Machine — a signed, alternating move-chain broadcast live over Nostr) is
just one early avenue onto that same ecosystem: prove your moves, let the
math tell the truth, and let the stake be a credibility signal rather than a
gate. Anyone plays free; weight scales with what you're willing to put behind
your word.

`TRUST_FRAMEWORK.md` is the forkable playbook for the other half of that
thesis: how a town, a church, or any small group forms its own signature and
starts vouching for its own people — no group key, no permission, just
accreted signatures anyone can verify.

## Build and test

Requires Node >= 20.

```bash
npm install            # installs deps + the two file: libraries
npm run dev            # Vite dev server
npm run build          # prebuilds the vendored libs, then tsc + vite + bundle budget
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src
npm test               # vitest run
npm run verify         # typecheck + lint + test + build + baseline + doctrine gates
```

The four gates — typecheck, lint, test, build — are the floor. Nothing is
"done" until they are green or honestly marked unverified.

## License

MIT. See `LICENSE`. The vendored `tapit-attest/` and `bip341-psbt-signer/`
libraries carry their own copies of the same license. Fork them, use them,
build your own bridge — that's what they're for.
