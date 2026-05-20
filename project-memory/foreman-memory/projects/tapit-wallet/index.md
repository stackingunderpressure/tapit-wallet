# Tapit Wallet — foreman-memory index

This is the project-scoped foreman-memory for tapit-wallet. The
Foreman reads these files when answering operator questions about
tapit-wallet specifically.

## Files

- `context.md` — what Tapit Wallet is, who it's for, why it
  exists, the four-layer architecture
- `decisions.md` — locked decisions (D-01 standalone app, D-02
  inherit tapit-attest never re-implement, D-03 keys never leave
  unencrypted, D-04 Layer 3 needs its own spec, D-05 wallet bot
  on the chassis runtime, D-06 Nostr NIP-46 the transport +
  discovery substrate)
- `ideas.md` — ideas not yet committed (hardware-wallet signing,
  paid encrypted sync, the bot teaching attestation history back,
  OpenTimestamps attestation anchoring)
- `index.md` — this file

## Related, outside this folder

- `project-memory/foreman-memory/core/` — the bundled fleet
  doctrine (THE_THESIS, MYCELIUM, HEARTH_SPEC, HEARTWOOD,
  SATOSHI). Operator identity is NOT in this repo — it travels
  with the operator; the Foreman fetches operator
  voice/preferences from AppCommander on-demand.
- `DISCOVERY.md` (repo root) — the app's DNA.
- `PLAN.md` (repo root) — the phased build roadmap.
- AppCommander's `project-memory/TAPIT_WALLET_SPEC.md` — the
  governing spec of record for the wallet.
