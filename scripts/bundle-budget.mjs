// Bundle-budget audit. Reads every emitted asset under dist/
// after `vite build`, gzips each, and exits non-zero if any
// asset exceeds its per-pattern budget. Converts the verbal
// "watch the post-auth chunk-bloat trend" pattern into a
// mechanical check per CLAUDE_ROOT.md non-negotiable #5
// ("Mechanism over prose. When a rule keeps getting missed,
// the fix is a check that fails — not another paragraph in
// this file.").
//
// Wired into the `build` script in package.json so the build
// gate fails when budgets are exceeded. The fix when a chunk
// grows past its budget is one of three things:
//   1. Code-split: move heavy code behind a React.lazy or a
//      dynamic import that only loads on demand.
//   2. Audit: a library upgrade or dep addition crossed the
//      threshold — verify the new size is intentional, then
//      raise the budget here with a comment justifying the
//      bump.
//   3. Refactor: a feature got bigger than it should be —
//      split the feature.
//
// Patterns match Vite's content-hashed filenames (e.g.,
// `WalletProvider-abc123.js`). Order matters: the first matching
// budget wins. The catch-all at the end protects against new
// unnamed chunks emerging unmonitored.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(here, '..', 'dist', 'assets');

// Budgets in gzipped bytes. Headroom of roughly 20-40% above
// the current measured size; tighter for small chunks where
// surprises matter, looser for vendors with known bulk.
const BUDGETS = [
  // Login surface — must stay tiny. ~3.5KB today; cap at 5KB.
  { pattern: /^index-.*\.js$/, gz: 5_000, label: 'login bundle (main)' },
  // CSS — single sheet, mostly Tailwind. ~3KB today; cap at 6KB.
  { pattern: /^index-.*\.css$/, gz: 6_000, label: 'css' },

  // Wallet-domain post-auth chunks (route-level + heavy modals).
  // 5c-i-ζ added sendEnvelope + a transport ref to WalletProvider;
  // current is ~5.5KB gz, bumped to 7KB to carry headroom for the
  // remaining 5c-i / 5c-ii / 5c-iii additions before code-splitting
  // becomes the better option.
  { pattern: /^WalletProvider-.*\.js$/, gz: 7_000, label: 'WalletProvider' },
  // HomeScreen is the post-auth main surface — four tabs plus a
  // growing set of modal launchers. Each phase adds a section here:
  // org-mode (5b-org-i..iv), Tier V presence list (5d). MarkPresence
  // Modal itself is React.lazy so the WebAuthn + geolocation code
  // does not load until the operator opens the flow; the static
  // imports remaining are the presence list-section helpers
  // (isPresenceEvent + readPresence). Current ~13.6KB gz. Headroom
  // raised to 14.5KB before another structural rethink is needed.
  { pattern: /^HomeScreen-.*\.js$/, gz: 14_500, label: 'HomeScreen' },
  { pattern: /^JournalDetail-.*\.js$/, gz: 8_000, label: 'JournalDetail' },
  // SettingsScreen grew through org-mode declaration (5b-org-i),
  // custom-relay editor (5c-i-λ), and now the recovery-cohort
  // section (5e-iii-a). The cohort editor itself is React.lazy so
  // only the section display + button is in the main chunk;
  // current ~4.8KB gz. Headroom raised to 6KB before another
  // structural rethink (split Settings into tabs?) is needed.
  { pattern: /^SettingsScreen-.*\.js$/, gz: 6_000, label: 'SettingsScreen' },
  { pattern: /^SignApprovalScreen-.*\.js$/, gz: 4_000, label: 'SignApprovalScreen' },
  { pattern: /^VerifyProofScreen-.*\.js$/, gz: 5_000, label: 'VerifyProofScreen' },
  // Capture bridge screen (Phase 4.5) — kept minimal; ~1.4KB gz today.
  { pattern: /^CaptureScreen-.*\.js$/, gz: 2_000, label: 'CaptureScreen' },

  // QR feature carries the qrcode library — known heavy.
  { pattern: /^QrShow-.*\.js$/, gz: 15_000, label: 'QrShow (qrcode lib)' },
  { pattern: /^QrScanModal-.*\.js$/, gz: 3_000, label: 'QrScanModal' },

  // Shared chunks Vite hoists across multiple importers. Some of
  // these only appear when the import graph hoists them; others
  // get inlined into the consumer chunk. Patterns kept so a future
  // hoist appears under its own budget.
  { pattern: /^share-.*\.js$/, gz: 5_000, label: 'share helper' },
  { pattern: /^EnvelopePreview-.*\.js$/, gz: 5_000, label: 'EnvelopePreview' },

  // Small hoisted helpers — context, hooks, single-export modules.
  // Budgets are tight because these should stay tiny by design.
  { pattern: /^WalletContext-.*\.js$/, gz: 500, label: 'WalletContext' },
  { pattern: /^useWallet-.*\.js$/, gz: 500, label: 'useWallet hook' },
  { pattern: /^useAnchorWorker-.*\.js$/, gz: 500, label: 'useAnchorWorker hook' },
  { pattern: /^useAnchorStatus-.*\.js$/, gz: 4_000, label: 'useAnchorStatus hook' },
  { pattern: /^anchorQueue-.*\.js$/, gz: 1_500, label: 'anchorQueue' },
  { pattern: /^saveWallet-.*\.js$/, gz: 2_000, label: 'saveWallet' },
  // Hoisted into shared chunks once the capture bridge began sharing
  // the journal pipeline with the composer. ~0.5KB / ~0.9KB gz today.
  { pattern: /^createJournalEntry-.*\.js$/, gz: 1_000, label: 'createJournalEntry' },
  { pattern: /^mediaStore-.*\.js$/, gz: 1_500, label: 'mediaStore' },
  // Cosigning helpers (parseEnvelope + mergeSignatures) hoisted into
  // a shared chunk once the connections feature began reusing them.
  // ~1.9KB gz today.
  { pattern: /^mergeSignatures-.*\.js$/, gz: 3_000, label: 'cosigning helpers' },
  // Tiny envelope-parse helper. Hoisted by Rollup when shared
  // between cosigning, connections, and transport. ~0.3KB gz today.
  { pattern: /^parseEnvelope-.*\.js$/, gz: 800, label: 'parseEnvelope helper' },
  // The absorb-cosign modal is hoisted into its own chunk once both
  // JournalDetail and HomeScreen import it (5c-i-ε inbox routing).
  // ~2.8KB gz today.
  { pattern: /^AbsorbCosignModal-.*\.js$/, gz: 4_000, label: 'AbsorbCosignModal' },
  // The handshake helpers (createHandshake + leafValue +
  // displayNameOf + isHandshake + readHandshake) get hoisted once
  // PeerPicker (5c-i-θ) joins HandshakeModal as an importer.
  // ~3KB gz today.
  { pattern: /^createHandshake-.*\.js$/, gz: 4_000, label: 'createHandshake helpers' },
  // PeerPicker hoisted into its own chunk once both CosignRequestModal
  // and HandshakeModal import it (5c-ii — remote handshakes reuse the
  // same picker). ~3.6KB gz today.
  { pattern: /^PeerPicker-.*\.js$/, gz: 5_000, label: 'PeerPicker' },
  // 5d Tier V — MarkPresenceModal is React.lazy from HomeScreen so
  // the WebAuthn + geolocation surface only loads when the operator
  // opens the flow. ~3KB gz today.
  { pattern: /^MarkPresenceModal-.*\.js$/, gz: 5_000, label: 'MarkPresenceModal' },
  // 5b-org-i createOrganization helpers get hoisted once HomeScreen,
  // SettingsScreen, OfficialsEditorModal, and MembershipChainSheet
  // all import from the same file. ~1.5KB gz today.
  { pattern: /^createOrganization-.*\.js$/, gz: 3_000, label: 'createOrganization helpers' },
  // 5e-iii-a CohortEditorModal is React.lazy from SettingsScreen so
  // the cohort-picker UI only loads when the operator opens it.
  { pattern: /^CohortEditorModal-.*\.js$/, gz: 4_000, label: 'CohortEditorModal' },
  // 5e-iii-a createCohort helpers get hoisted once both
  // CohortEditorModal and LatticePanel import from the same file.
  { pattern: /^createCohort-.*\.js$/, gz: 3_000, label: 'createCohort helpers' },
  // 5e-iv LatticePanel — React.lazy from HomeScreen, only loads
  // when the operator opens the Lattice tab. Aggregates handshakes,
  // memberships, and recovery cohort into one read-only view.
  { pattern: /^LatticePanel-.*\.js$/, gz: 4_000, label: 'LatticePanel' },
  // 5e-iii-b-2 createShares helpers — share-envelope builders +
  // decrypt + hold; hoisted once both CohortEditorModal's
  // DistributeSharesModal and the HomeScreen receive-route handler
  // import isRecoveryShare / holdRecoveryShare.
  { pattern: /^createShares-.*\.js$/, gz: 3_000, label: 'createShares helpers' },
  // 5e-vi RecoveryResponderModal — React.lazy from HomeScreen;
  // loads when an incoming recovery-request envelope opens it.
  { pattern: /^RecoveryResponderModal-.*\.js$/, gz: 5_000, label: 'RecoveryResponderModal' },
  // 5e-v RecoveryInitiatorModal — React.lazy from UnlockPrompt;
  // loads when the operator hits "Lost passphrase? Start recovery"
  // on the locked screen. Heavier than the responder because it
  // owns the form, the ceremony state machine, the per-peer
  // progress surface, and the new-passphrase save flow.
  { pattern: /^RecoveryInitiatorModal-.*\.js$/, gz: 6_000, label: 'RecoveryInitiatorModal' },
  // 5c-iii-a publishStatus helper — summarizePublish hoisted once
  // multiple modals depend on it (now includes DistributeSharesModal).
  { pattern: /^publishStatus-.*\.js$/, gz: 1_500, label: 'publishStatus helper' },
  // walletStore helper hoisted once both WalletProvider and the
  // recovery distribute modal import it directly.
  { pattern: /^walletStore-.*\.js$/, gz: 2_000, label: 'walletStore helper' },

  // Phase 5c-i-δ peer-transport chunk, dynamically imported by
  // WalletProvider only when the operator opts into the Mycelium
  // network. Bundles the Nostr WebSocket client, NIP-44 encryption
  // surface, default relays, and the connectWallet entry point.
  // ~1.6KB gz today; budget carries headroom for 5c-ii/-iii growth.
  { pattern: /^connectWallet-.*\.js$/, gz: 5_000, label: 'transport (Mycelium opt-in)' },
  // The encryptedInbox helper hoisted into its own chunk once
  // WalletProvider's sendEnvelope dynamically imports it (5c-i-ζ).
  // Tiny — under 1KB gz today.
  { pattern: /^encryptedInbox-.*\.js$/, gz: 2_000, label: 'encryptedInbox helper' },
  // DEFAULT_RELAYS constant hoisted once both prefsStore (default
  // value) and SettingsScreen (restore-defaults button) import it.
  // ~140 bytes gz — should stay tiny.
  { pattern: /^defaultRelays-.*\.js$/, gz: 500, label: 'defaultRelays constant' },

  // Vendor chunks split via vite.config.ts manualChunks.
  { pattern: /^attest-.*\.js$/, gz: 35_000, label: 'tapit-attest vendor' },
  { pattern: /^react-.*\.js$/, gz: 60_000, label: 'react vendor' },
  { pattern: /^supabase-.*\.js$/, gz: 60_000, label: 'supabase vendor' },
  { pattern: /^qrcode-.*\.js$/, gz: 15_000, label: 'qrcode vendor' },

  // Catch-all for new unrecognized JS chunks. Tight (3KB gz) so
  // anything larger than a trivial helper surfaces immediately
  // and prompts adding an explicit named budget above.
  { pattern: /\.js$/, gz: 3_000, label: '(unrecognized js chunk — add a named budget)' },
];

function formatBytes(n) {
  return `${(n / 1024).toFixed(2)}KB`;
}

const failures = [];
const matched = new Map();

let entries;
try {
  entries = readdirSync(ASSETS_DIR);
} catch (err) {
  console.error(`bundle-budget: cannot read ${ASSETS_DIR}`);
  console.error(`  Did you run \`vite build\` first?`);
  console.error(`  Error: ${err.message}`);
  process.exit(1);
}

for (const entry of entries) {
  const full = join(ASSETS_DIR, entry);
  const s = statSync(full);
  if (!s.isFile()) continue;
  if (!/\.(js|css)$/.test(entry)) continue;

  const raw = readFileSync(full);
  const gz = gzipSync(raw).length;

  const budget = BUDGETS.find((b) => b.pattern.test(entry));
  if (!budget) {
    failures.push({
      entry,
      gz,
      detail: 'no budget matched (this is a bug — the catch-all should cover everything)',
    });
    continue;
  }
  matched.set(budget.label, (matched.get(budget.label) ?? 0) + 1);
  if (gz > budget.gz) {
    failures.push({
      entry,
      gz,
      detail: `${formatBytes(gz)} gz exceeds budget ${formatBytes(budget.gz)} for "${budget.label}"`,
    });
  }
}

if (failures.length > 0) {
  console.error('Bundle budget exceeded:');
  for (const f of failures) {
    console.error(`  - ${f.entry}: ${f.detail}`);
  }
  console.error('');
  console.error('Fixes, in order of preference:');
  console.error('  1. Code-split — React.lazy or dynamic import to defer the heavy code.');
  console.error('  2. Audit — confirm the size growth is intentional and bump the budget');
  console.error('     in scripts/bundle-budget.mjs with a comment explaining why.');
  console.error('  3. Refactor — split the feature if it has grown too big.');
  process.exit(1);
}

console.log('Bundle budgets OK:');
for (const [label, count] of matched.entries()) {
  console.log(`  ${count}× ${label}`);
}
