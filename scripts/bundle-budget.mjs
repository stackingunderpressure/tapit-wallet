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
  // Login surface — must stay tiny. 2026-05-23 lifted across three
  // operator-requested expansions: WalletGuide tabs surface, OTS
  // anchoring explanation, and the Sovereignty tab covering the
  // four-gradation spectrum (Connected / Connected-private / Sovereign-
  // with-cohort / Sovereign-solo). Current ~10.2KB gz. Past 12KB the
  // honest next move is to lazy-load the non-Account tabs as separate
  // chunks so the cold-start landing still ships tight.
  { pattern: /^index-.*\.js$/, gz: 12_000, label: 'login bundle (main)' },
  // CSS — single sheet, mostly Tailwind. ~3KB pre-Fresh; the Fresh
  // roadmap (Cuts 1-2) added the :root + [data-theme='fresh']
  // variable blocks plus the aurora-drift keyframes + background.
  // Bumped 6KB -> 7KB to absorb the Fresh tokens; remaining
  // headroom carries Cuts 3-9 (Fresh-specific component classes
  // emit only when those components actually mount in source, since
  // Tailwind's content scanner sees the new files). Past 7KB the
  // honest next move is to consider CSS code-splitting via Vite's
  // per-entry stylesheets, which would only be earned once the Fresh
  // surface ships more than the foundation.
  // 2026-05-24 polish: bumped 7KB -> 7.5KB to absorb the
  // cross-cutting Fresh overrides sweep (every Classic bg-white /
  // bg-paper / border-ink / text-ink surface routed through one
  // rule set) plus the accent dial-up (body radial bloom, lavender
  // edge tint, h2 dot prefix, plum-tinted elevation shadow).
  { pattern: /^index-.*\.css$/, gz: 7_500, label: 'css' },

  // Wallet-domain post-auth chunks (route-level + heavy modals).
  // 5c-i-ζ added sendEnvelope + a transport ref to WalletProvider;
  // current is ~5.5KB gz, bumped to 7KB to carry headroom for the
  // remaining 5c-i / 5c-ii / 5c-iii additions before code-splitting
  // becomes the better option. 2026-05-24 Fresh-Cut-1 bumped to
  // 7.5KB to absorb the useTheme hook + applyTheme helper inlined
  // into WalletProvider as a foundational dependency every later
  // Fresh cut consumes. Hook is tiny (~200 bytes gz) and a hook
  // cannot be React.lazy-loaded — the audit-and-bump path is the
  // correct one here. 2026-05-24 Fresh-Cut-5 bumped 7.5KB -> 8KB
  // to absorb the onboarding-setup phase + the consume-bundle
  // effect + the Fresh-styled setup overlay render branch. The
  // pendingOnboarding holder and applyOnboardingBundle helper
  // sit inside the WalletProvider chunk because the consumer
  // path runs at first-login and cannot reasonably defer.
  // 2026-05-25 per-peer-chat sub-cut 2b bumped 8KB -> 8.5KB to
  // absorb chatThreadsByPeer state + sendChatMessage callback +
  // the chat-kind subscription block running alongside the
  // existing inbox subscription on the same transport handle.
  // 2026-05-25 chat-persistence bug fix bumped 8.5KB -> 9KB to
  // absorb useChatPersistence hook import + call (IDB load on
  // unlock + debounce-save on update). messagesStore lives in
  // the storage chunk; this bump covers only the hook surface.
  // 2026-05-25 race-fix bumped 9KB -> 9.5KB: hasLoaded gate
  // added to useChatPersistence to stop the 400 ms debounce from
  // overwriting disk before the PBKDF2 decrypt resolves. Extra
  // useState plus the load-resolution path settles past the prior
  // budget by ~150 bytes.
  { pattern: /^WalletProvider-.*\.js$/, gz: 9_500, label: 'WalletProvider' },
  // HomeScreen is the post-auth main surface — four tabs plus a
  // growing set of modal launchers. Each phase adds a section here:
  // org-mode (5b-org-i..iv), Tier V presence list (5d). MarkPresence
  // Modal itself is React.lazy so the WebAuthn + geolocation code
  // does not load until the operator opens the flow; the static
  // imports remaining are the presence list-section helpers
  // (isPresenceEvent + readPresence). 2026-05-23: NostrIndicator
  // inlined into the header lifted current to ~14.5KB gz; headroom
  // raised to 15KB. 2026-05-24 polish bumped to 16KB to absorb the
  // theme-aware tab strip + the InboxPanel/ConnectionCard Fresh
  // colourway branches inlined into HomeScreen's import graph;
  // structural rethink (extract per-tab sections) is the next move
  // past 16KB.
  // 2026-05-25 per-peer-chat sub-cut 2b bumped 16KB -> 16.5KB
  // (effective overage was 0.02KB — extracted PeopleTabBody into
  // wallet-core to keep HomeScreen under the 800-line file-size
  // limit; the new component sits in the HomeScreen import graph).
  // 2026-05-25 identity-leaves bumped 16.5KB -> 17KB: birthday +
  // location threading from identity attestation + sticky-chrome
  // touch-ups + promote-handler refactor put us at 16.17KB.
  // 2026-05-25 promote-to-envelope cuts 3-5: HomeScreen statically
  // imports PromoteRouter which statically imports HeldEnvelopePicker
  // (+ lazy CosignRequestModal + ShareProofModal in their own chunks).
  // Bumped 17KB -> 18KB to absorb the router + picker. Past 18KB the
  // honest next move is to lazy-load PromoteRouter itself.
  // 2026-05-25 Phase 8 Phase C cut 1 (RatificationsBadge rule-name
  // decoration): bumped 18KB -> 18.5KB to absorb decodeAuthorizedBy
  // from governance/authRule.ts landing in the badge's import graph.
  // The badge now appends "(rule: <action>)" when an envelope carries
  // a Phase B authorized_by leaf, surfacing the Tapscript-style
  // auth-tree branch a credential was issued under. Tree-shaking
  // keeps the rest of governance/authRule out of this chunk; the
  // ~22-byte gz delta is just the decode function + its type guard.
  { pattern: /^HomeScreen-.*\.js$/, gz: 18_500, label: 'HomeScreen' },
  { pattern: /^JournalDetail-.*\.js$/, gz: 8_000, label: 'JournalDetail' },
  // SettingsScreen grew through org-mode declaration (5b-org-i),
  // custom-relay editor (5c-i-λ), and now the recovery-cohort
  // section (5e-iii-a). The cohort editor itself is React.lazy so
  // only the section display + button is in the main chunk;
  // current ~4.8KB gz. Headroom raised to 6KB before another
  // structural rethink (split Settings into tabs?) is needed.
  // SettingsScreen accumulator. Bumped across the Known Limitations
  // section, Recovery key reveal flow, Sovereign-confirm panel, QR
  // and succession copy updates, and the RotateKeySection. Current
  // ~8KB gz; KnownLimitations and RotateKey both extracted to their
  // own files but inlined into SettingsScreen at import time so the
  // bytes ride this chunk. 2026-05-24 Fresh-Cut-9 bumped 9KB -> 10KB
  // to absorb the AppearanceSection growth: theme radio + Fresh
  // extras toggle group (Memories + Streaks). Past 10KB the honest
  // next move is to lazy-load AppearanceSection itself.
  // 2026-05-25 birthday-leaf cut bumps 10KB -> 10.5KB to absorb
  // the new over-18 / over-21 enumerator branches in
  // quickSharePresets that QuickShareSection imports into Settings.
  { pattern: /^SettingsScreen-.*\.js$/, gz: 10_500, label: 'SettingsScreen' },
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
  // 2026-05-24 bump: holds the small EnrollResult re-export pulled
  // through the WalletContext consumer chain after identity-ceremony
  // gained Face ID binding.
  { pattern: /^WalletContext-.*\.js$/, gz: 700, label: 'WalletContext' },
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
  // 2026-05-23 PresenceDetailModal — React.lazy from HomeScreen
  // Identity tab. Opens when the operator taps an existing Tier V
  // presence card to see the full envelope detail (when, where,
  // Face ID assertion materials, wallet signature, Bitcoin anchor).
  { pattern: /^PresenceDetailModal-.*\.js$/, gz: 3_000, label: 'PresenceDetailModal' },
  // 2026-05-23 RecoveryKeyImportModal — React.lazy from UnlockPrompt
  // alongside RecoveryInitiatorModal. Lazy because most operators
  // never need it; small because it's just a hex input + new-pass
  // form running restoreFromKData + exportRecoverableWithKData.
  { pattern: /^RecoveryKeyImportModal-.*\.js$/, gz: 2_500, label: 'RecoveryKeyImportModal' },
  // 5e-v RecoveryInitiatorModal — React.lazy from UnlockPrompt;
  // loads when the operator hits "Lost passphrase? Start recovery"
  // on the locked screen. Heavier than the responder because it
  // owns the form, the ceremony state machine, the per-peer
  // progress surface, and the new-passphrase save flow.
  { pattern: /^RecoveryInitiatorModal-.*\.js$/, gz: 6_000, label: 'RecoveryInitiatorModal' },
  // 5e-v/-vi envelope helpers hoisted once both the initiator and
  // responder modals depend on createRecoveryRequest.ts (read +
  // build for both directions).
  { pattern: /^createRecoveryRequest-.*\.js$/, gz: 1_500, label: 'createRecoveryRequest helpers' },
  // 2026-05-23 blended-recovery — generic scan-tapit-envelope
  // surface. React.lazy from HomeScreen's People tab; opens the
  // camera, parses the scanned QR via parseEnvelope, dispatches
  // via the shared envelopeRoute so a scanned recovery-share,
  // recovery-request, or handshake hits the same modal an arrival
  // over Mycelium would.
  { pattern: /^ScanEnvelopeModal-.*\.js$/, gz: 2_000, label: 'ScanEnvelopeModal' },
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

  // 2026-05-24 Fresh-Cut-5 — FreshLoginShell is React.lazy from
  // LoginPage so the cold-start login bundle Classic operators land
  // on stays tight. The chunk carries the FreshLoginShell shell +
  // the FreshOnboarding 90-second state machine + the seven step
  // components. ~4.3KB gz today; budget carries headroom for the
  // Cut 6 Sage activation hook-in if it lands as a sibling import
  // before a more granular split is earned.
  { pattern: /^FreshLoginShell-.*\.js$/, gz: 5_500, label: 'FreshLoginShell (lazy)' },

  // Vendor chunks split via vite.config.ts manualChunks.
  { pattern: /^attest-.*\.js$/, gz: 35_000, label: 'tapit-attest vendor' },
  { pattern: /^react-.*\.js$/, gz: 60_000, label: 'react vendor' },
  { pattern: /^supabase-.*\.js$/, gz: 60_000, label: 'supabase vendor' },
  { pattern: /^qrcode-.*\.js$/, gz: 15_000, label: 'qrcode vendor' },

  // PeerThread is the per-peer chat surface (sub-cut 2b + 2c).
  // 2026-05-25 sub-cut 2c brought it to ~3KB gz with the
  // PromoteMenu, useLongPress hook, and bubble long-press wiring.
  // Headroom to 4KB covers the remaining promote targets that
  // will plug into the same data-driven menu in later cuts.
  { pattern: /^PeerThread-.*\.js$/, gz: 4_000, label: 'PeerThread' },

  // OrgRulesEditor (Phase 8 Phase C cut 2) is the multi-rule org
  // creation UI lazy-loaded from SettingsScreen when the operator
  // opens the org-declaration form. Self-contained component with
  // rule list rendering, add-rule mini-form, and validation. ~1.9KB
  // gz today. Past 3KB the next move is to extract the eligible-
  // signers picker into its own sub-component (a peer-roster
  // multi-picker would be the natural polish).
  { pattern: /^OrgRulesEditor-.*\.js$/, gz: 3_000, label: 'OrgRulesEditor' },

  // CosignRequestModal — co-sign request UI lazy-loaded from
  // JournalDetail and PromoteRouter. Phase 8 Phase C cut 3 added
  // optional org-action mode: when orgContext is provided the modal
  // looks up the auth rule via findAuthRule, shows a banner with
  // action/threshold/eligible-count, and renders an eligible-signers
  // picker instead of the general PeerPicker. ~2.3KB gz today. Past
  // 4KB the natural polish is multi-fanout (one-tap send-to-all-
  // eligible with per-recipient send status) which would justify a
  // bump and a sub-component extraction.
  { pattern: /^CosignRequestModal-.*\.js$/, gz: 4_000, label: 'CosignRequestModal' },

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
