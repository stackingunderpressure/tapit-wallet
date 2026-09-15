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
    'src/features/arena/moveOracle.ts',
    'src/features/arena/moveOracle.test.ts',
    'src/features/arena/oracleFunctionParity.test.ts',
    'src/features/arena/priceFreshness.ts',
    'src/features/arena/priceFreshness.test.ts',
    'src/features/arena/ArenaModal.tsx',
    'src/features/arena/OracleOutageModal.tsx',
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
    "Netlify secret + publish pubkey + deploy + smoke). VERIFY-SIDE CLOSED " +
    '2026-09-15 (moveOracle.ts): until then the oracle round was ' +
    'WRITE-ONLY — buildSwitchDraft stamped oracle_pubkey/sig/round/time/ ' +
    'source into the move as signed leaves, but verifyPriceRound ran ONCE, ' +
    "in the player's own browser, at move time, and nothing ever read those " +
    'leaves back. A stranger handed a move_chain proof could confirm the ' +
    'signatures and the hash links but had no way to tell an oracle-signed ' +
    'price from a number the player typed. readMovePriceAttestation now ' +
    're-verifies the round from the move itself, pinned to the build\'s ' +
    'configured VITE_ARENA_ORACLE_PUBKEY. The binding is free: the oracle ' +
    "signs a digest over the round's price and the builder writes that same " +
    "price into the move's `price` leaf, so checking the signature against " +
    'the move IS the did-the-price-change check — edit the price and the ' +
    'signature stops verifying (tested). States are deliberately six, not ' +
    'a boolean: attested / attested_unpinned (signature good but this build ' +
    'knows no oracle key to pin to, so provenance is unproven — the same ' +
    'honesty distinction the anchor view draws between "not included" and ' +
    '"not anchored") / unattested / incomplete / bad_signature / ' +
    'foreign_oracle. Freshness is deliberately NOT re-checked at verify ' +
    'time — isRoundFresh stops a stale price entering a NEW move, but an ' +
    'old move legitimately carries an old round. oracleFunctionParity.test' +
    '.ts guards the one silent-death risk: price-oracle.mts inlines its own ' +
    'copy of the canonical digest (deliberately, so Netlify esbuild never ' +
    'chokes on a ../../src import), and if the two copies drift every price ' +
    'in the game reads bad_signature with nothing naming the cause. STILL ' +
    'OWED and operator-only: run scripts/arena-oracle-keygen.mjs, set ' +
    'ARENA_ORACLE_PRIVATE_KEY + VITE_ARENA_ORACLE_PUBKEY + ' +
    'VITE_ARENA_ORACLE_URL in Netlify, redeploy, smoke the endpoint. Until ' +
    'that is done arenaOracle() returns null, moves stamp price_source=' +
    'market, and every price honestly reads "stated by the player." ' +
    'SILENT FALLBACK REMOVED 2026-09-15 (operator chose warn-and-choose in ' +
    'chip form): a configured-but-unreachable oracle used to be swallowed ' +
    'and the move logged at the chart price stamped price_source=market, so ' +
    'one move in an otherwise attested run could quietly be the one a ' +
    'verifier cannot vouch for. act() now pauses and raises ' +
    'OracleOutageModal; the operator proceeds explicitly via act(true) or ' +
    'waits. It deliberately does NOT block the move — an oracle outage is ' +
    'our problem, not a reason the operator loses a trade. (4) PRICE ' +
    'STALENESS fixed 2026-09-15 (operator, field-test: "it is slow and ' +
    'almost always have to refresh"). Four compounding causes, all real: ' +
    'btc-candles sent Cache-Control public, max-age=300, so the CDN AND ' +
    'every browser held a body up to 5 min old and the 30s poll mostly ' +
    're-read one cached response; useBtcCandles had its own 5-min ' +
    'SESSION_TTL_MS stacked on top, ~10 min worst case; and NOTHING ' +
    'refetched when the app returned to the foreground — the decisive one, ' +
    'because a backgrounded PWA has its timers throttled or suspended, so ' +
    'setInterval CANNOT keep a phone current however short it is set, and a ' +
    'manual tap was the only cure. Fixes: split the cache header into ' +
    'max-age=0 for the browser + s-maxage=20 + stale-while-revalidate=120 ' +
    'for the CDN (the edge still absorbs load, so the exchanges are no more ' +
    'exposed than before); SESSION_TTL_MS 5min -> 20s; poll 30s -> 20s; and ' +
    'the hook now refetches on visibilitychange / focus / online. ' +
    'useBtcCandles also returns fetchedAt and the screen states the price\'s ' +
    'own age (priceFreshness.ts, pure + tested) warning past 90s — a number ' +
    'you are about to sign a permanent move against should never look ' +
    'authoritative while quietly being minutes old. ArenaModal was ' +
    'extracted to its own file to make room under the 800-line cap; ' +
    'ArenaScreen.tsx sits at 787. The foreground-refetch wiring is ' +
    'READ-VERIFIED, NOT unit-tested (no React renderer in this repo\'s ' +
    'tests — same split as useAutoBackup.test.ts); a device smoke is owed. ' +
    '(2) ' +
    'GENESIS here is ' +
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
    'terms — a reply, a DM, wherever — never auto-posted. (6) STOPPED ' +
    'INLINING THE PROOF AT ALL (2026-09-10, same day, second report from ' +
    'the operator — a screenshot of an unbroken base64 wall and "Still not ' +
    'right"): (5) only fixed the ANCHOR half of the size problem; the ' +
    '/verify?p=<base64> link itself was still the thing shown as "the ' +
    'link," and measuring it directly showed the real floor — ONE move\'s ' +
    'honest proof (one signature + its claim, base64\'d) already runs past ' +
    '900 characters before anchors or anything else are counted, because a ' +
    'BIP340 signature alone is 128 hex chars and the meta fields add more ' +
    'on top. There is no byte budget that makes an embedded proof read as ' +
    'a normal link at any chain length worth playing — tuning the number ' +
    'further was solving the wrong problem. Fixed by dropping the whole ' +
    'inline-the-proof-in-the-link idea for arena\'s default note: ' +
    'buildArenaShareText now takes a plain verifyUrl string, always the ' +
    'bare /verify page, never anything encoded into it, so the note stays ' +
    'short and clean at ANY chain length. The proof travels via two copy ' +
    'actions instead (ArenaScreen.tsx: "Copy the chain proof to paste at ' +
    'the link above," lean/anchors-stripped by default, plus a secondary ' +
    '"(with Bitcoin timestamps instead)" for the heavier version) — always ' +
    'a deliberate, separate step, never auto-embedded. chainVerify.ts\'s ' +
    'buildChainVerifyUrl / CHAIN_INLINE_URL_BYTE_BUDGET machinery is left ' +
    'in place as general infrastructure (still tested, still legitimate ' +
    'for a context where a long URL doesn\'t need to look clean) but arena ' +
    'no longer calls it for its own share text. The real path to a TRUE ' +
    'one-tap link later is the one move-chain\'s own manifest already names ' +
    'as reserved: broadcast each move over moveChannel.ts\'s existing ' +
    'MOVE_EVENT_KIND public Nostr channel as it happens (not yet wired — ' +
    'arena currently only reveals via a plain kind-1 note), then a short ' +
    'reference (owner pubkey + topic) in the link lets /verify fetch and ' +
    'reassemble the chain live from the same public relays, the way ' +
    'subscribeMoves was always built to do — genuinely short AND genuinely ' +
    'self-contained, unlike embedding the proof. Bigger lift (touches the ' +
    'core move-recording path, not just sharing); not started. (7) ' +
    'ROTATED-KEY VERIFY FIX (2026-09-10, same day, third report — a chain ' +
    'from the operator\'s own device, which has rotated its identity key at ' +
    'least once, kept failing to verify even after (6)): ArenaScreen now ' +
    'passes wallet.successionChain into both its internal verify check and ' +
    'the two "copy the chain proof" actions, so a move signed after a ' +
    'rotation is correctly recognized as still belonging to this owner — ' +
    'see move-chain\'s manifest for the actual fix (resolveActiveKeys).',
};
