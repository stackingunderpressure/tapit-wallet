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
    'anchor. A main bottom-nav tab ("Beat HODL") as of 2026-09-04; /arena ' +
    'redirects to /?tab=arena for old links.',
  touches: [
    'src/features/arena/arenaChain.ts',
    'src/features/arena/arenaChain.test.ts',
    'src/features/arena/ArenaScreen.tsx',
    'src/features/arena/arenaShare.ts',
    'src/features/arena/ArenaChart.tsx',
    'src/features/arena/useBtcCandles.ts',
    'netlify/functions/btc-candles.mts',
    'src/features/arena/priceRound.ts',
    'src/features/arena/priceRound.test.ts',
    'src/features/arena/priceRoundCanonical.ts',
    'src/features/arena/manifest.ts',
    'src/App.tsx',
    'src/features/wallet-core/HomeScreen.tsx',
    'src/features/settings/SettingsScreen.tsx',
    'src/shared/lib/env.ts',
    'netlify/functions/price-oracle.mts',
    'netlify.toml',
    'scripts/arena-oracle-keygen.mjs',
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
    'oracle is NOW BUILT as a tiny self-signed Nostr-shaped round verified ' +
    'with tapit-attest Schnorr (priceRound.ts + netlify/functions/' +
    'price-oracle; wired behind VITE_ARENA_ORACLE_URL/PUBKEY; owed: key + ' +
    "Netlify secret + publish pubkey + deploy + smoke). (2) GENESIS here is " +
    'a local start move; the real genesis is a ' +
    'public on-chain donation to an open-source charity whose txid roots ' +
    'the trail (charity_txid is an optional field so the flow is playable ' +
    'now). The live per-move Bitcoin anchor IS wired (anchorQueue, same ' +
    'path the journal uses). moveChannel stays reserved for the standalone ' +
    "app's structured reveal; this prototype reveals via a plain kind-1 " +
    'note (publishPublicNote) to prove the relay round-trip. NOT ' +
    'browser-tested from the sandbox — a device smoke of start/sell/buy, ' +
    'the scoreboard reading in coins, persistence across reload, and the ' +
    'Nostr publish is owed. (3) SHARE TEXT (2026-09-10): buildArenaShareText ' +
    '(arenaShare.ts, split out of ArenaScreen.tsx to stay under the 800-line ' +
    'cap) turns the note from one dry stat line into a real narrative — a ' +
    'start date, per-move prices and dates, an honest mid-cycle "in ' +
    'progress" status instead of a bare live number, and an opt-in ' +
    '(off-by-default) toggle to disclose the genesis donation txid / stake. ' +
    'Deliberately narrates ONLY moves already executed and signed — the next ' +
    'move is never mentioned, since disclosing an undecided buy-back target ' +
    'is the one thing that would let a reader copy-trade instead of just ' +
    'verify the record after the fact; sharing is safe at any point because ' +
    'only sunk, already-signed moves are ever in the text. Not yet built: a ' +
    'way to pick an earlier point in your own history to publish about — ' +
    'today it always narrates the current live state. (4) WHOLE-CHAIN ' +
    'VERIFY LINK (2026-09-10, superseding the 2026-09-10 head-only version): ' +
    'the share text ends with a /verify?p=<proof> link built from ' +
    'move-chain\'s buildChainVerifyUrl (chainVerify.ts) against the FULL ' +
    'chain, genesis through the latest move, not just the head — the ' +
    'operator wanted the whole thing checkable and legible ("genesis and ' +
    'each one built on the last hash"). Unlike a disclosure proof, nothing ' +
    'is pruned (a move has nothing sensitive to hide), so the bundle is the ' +
    'full signed attestations; the /verify page (disclosure feature) ' +
    'detects the move_chain bundle kind, runs verifyMoveChain for the ' +
    'trusted verdict, and renders ChainVerifyResult — a step-by-step ' +
    'per-move breakdown (signature check, link-to-prior-move check, anchor ' +
    'status) plus a plain-language "how does one link prove the whole ' +
    'chain" explainer, so a reader learns the mechanism, not just a ' +
    'pass/fail badge. Inline-URL budget is 5KB (vs disclosure\'s 1.8KB, ' +
    'sized for QR/iMessage) — this rides in a Nostr note instead. Minting ' +
    'can fail (an empty chain); the share degrades gracefully and just ' +
    'omits the link rather than blocking. No longer depends on the ' +
    'disclosure feature. (5) ANCHOR-STRIP FIX (2026-09-10, same day, after ' +
    'the operator screenshotted the live share and said "This is the share ' +
    'now" over a wall of raw hex): the first cut of (4) carried every ' +
    "move's full Bitcoin-anchor data (anchor.proof — an opaque OTS blob " +
    'that commonly dwarfs everything else about a move) into the default ' +
    'link, which blew straight past the 5KB budget and fell back to ' +
    'appending the ENTIRE raw proof JSON into the Nostr note itself — ugly, ' +
    'and a real risk of the note getting rejected outright by relays with ' +
    'tighter size limits. Fixed at the root: buildChainVerifyUrl now strips ' +
    'every move\'s anchor by default (chainVerify.ts\'s includeAnchors ' +
    'option, off unless explicitly requested), which the note\'s own ' +
    '"signed and anchored to Bitcoin" line is already true independent of ' +
    '— the anchor blobs were never needed to prove the chain, only to show ' +
    'the timestamp inline. The append-raw-JSON-to-the-note fallback was ' +
    'removed entirely; when even the anchor-free proof cannot fit inline, ' +
    'the note now says so plainly and points at a bare /verify link instead ' +
    'of dumping noise. A separate "Copy the full chain proof (with Bitcoin ' +
    'timestamps)" action (ArenaScreen.tsx, includeAnchors: true) lets the ' +
    'operator hand someone the heavier, fully-anchored proof on their own ' +
    'terms — a reply, a DM, wherever — never auto-posted.',
};
