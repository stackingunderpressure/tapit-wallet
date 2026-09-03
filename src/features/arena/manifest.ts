import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'arena',
  born: '2026-09-03',
  purpose:
    'Beat the HODL Machine — the in-wallet prototype of the honest ' +
    'trading game (ARENA_SPEC.md). You hold one whole coin, sell-all and ' +
    'buy-all-back at a price, and the tested truth scorer races your coin ' +
    'count against the HODL ball fixed at 1.0 after friction. Each move is ' +
    'a real signed move-chain attestation, held and queued for a Bitcoin ' +
    'anchor. Reachable at /arena via the Settings > More launcher.',
  touches: [
    'src/features/arena/arenaChain.ts',
    'src/features/arena/arenaChain.test.ts',
    'src/features/arena/ArenaScreen.tsx',
    'src/features/arena/manifest.ts',
    'src/App.tsx',
    'src/features/settings/SettingsScreen.tsx',
  ],
  depends_on: ['move-chain', 'transport', 'wallet-core', 'anchoring'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    'Prototype surface, mounted as a standalone /arena route (not a main ' +
    'tab — HomeScreen is at the 800-line cap) with a launcher in Settings ' +
    '> More. PROTOTYPE SEAMS, both parallel work, neither a blocker: (1) ' +
    'PRICE is entered by hand and stamped price_source=manual; the signed ' +
    'price oracle (ARENA_SPEC.md) replaces the input with a verified round ' +
    '— research 2026-09-03 found NO reliable public Nostr oracle, so the ' +
    'likely path is a tiny self-signed Nostr-shaped round verified with ' +
    "@noble. (2) GENESIS here is a local start move; the real genesis is a " +
    'public on-chain donation to an open-source charity whose txid roots ' +
    'the trail (charity_txid is an optional field so the flow is playable ' +
    'now). The live per-move Bitcoin anchor IS wired (anchorQueue, same ' +
    'path the journal uses). moveChannel stays reserved for the standalone ' +
    "app's structured reveal; this prototype reveals via a plain kind-1 " +
    'note (publishPublicNote) to prove the relay round-trip. NOT ' +
    'browser-tested from the sandbox — a device smoke of start/sell/buy, ' +
    'the scoreboard reading in coins, persistence across reload, and the ' +
    'Nostr publish is owed.',
};
