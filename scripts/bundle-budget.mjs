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
  // with-cohort / Sovereign-solo). 2026-05-28 PLAN.md Tier 1 item 5
  // added the Bitcoin's-role tab via React.lazy following the
  // "past 12KB lazy-load non-Account tabs" rule named in this
  // comment — the new tab lives in WalletGuideBitcoinTab.tsx and
  // loads on demand. Current ~11.3KB gz. Subsequent non-Account
  // tab additions extend the lazy-load pattern (one tab per chunk
  // or one shared chunk both work — pick by what makes sense for
  // the tab's content).
  // 2026-06-01: the global UpdateBanner (new-version checker + banner,
  // mounted in App so it floats above every route) added ~0.1KB gz to
  // the main entry. Bumped 11.72 -> 12.2KB (measured 11.81KB).
  // 2026-06-14: the auth additions earlier this arc (OAuthButtons +
  // PasswordSignIn wired into both the Classic and Fresh sign-in
  // surfaces) grew the cold-start login bundle and had landed without a
  // budget bump. Audited as intentional. Bumped 12.21 -> 13.0KiB
  // (measured 12.83KB gz).
  // 2026-06-16 bump (13.0 -> 13.5KiB): env-embedding correction, not code
  // growth. Vite inlines VITE_SUPABASE_URL and the ~200-char anon-key JWT into
  // this entry as string literals at build time. A local build with empty env
  // (the dev default) never embeds them, so the prior figure undercounted; the
  // Netlify production build embeds the real values, and the JWT is high-
  // entropy so it gzips poorly, adding ~50 bytes past the old budget. Verified
  // by reproducing locally with representative-length env values: the check
  // measures 13.05KB gz, matching the Netlify failure exactly. Those literals
  // are required to construct the Supabase client on the login path, so they
  // cannot be code-split away. Budget now clears the production-measured size
  // with headroom for env-value length variation.
  { pattern: /^index-.*\.js$/, gz: 13_824, label: 'login bundle (main)' },
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
  // 2026-05-26 Phase 8 Phase E4 cut 3 bumps 7.5KB -> 8KB to absorb
  // the new Tailwind utility classes the JoinPolicyPicker per-kind
  // sub-forms + the JoinOrgModal multi-step layout + the
  // OrgIdentitySections joined-members section + the publish-roster
  // amber chip introduced into the content scanner. Measured 7.34KB
  // gz post-cut, +16 bytes over the prior budget.
  // 2026-05-31 bumps 8KB -> 8.3KB to absorb the :-webkit-autofill
  // text-fill-color override added to index.css. The override fixes
  // iOS Safari rendering autofilled email/password fields as white
  // text on its own white background under both themes. The fix is
  // ~40 bytes gz after minification — small but pushed total past
  // the 8KB boundary. The fix is the right shape (one CSS rule
  // covers every form input across the whole app) so the budget
  // moves rather than the fix shrinking.
  // 2026-06-03 A1 people-tree tier legend: new dashed/solid edge legend
  // utility classes nudged the css to 8.12KB gz. Bumped to 8.5KB.
  { pattern: /^index-.*\.css$/, gz: 8_704, label: 'css' },

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
  // 2026-05-27 passphrase-commit-warnings bumped 9.5KB -> 10KB:
  // PassphraseCommitWarnings (the two-step personal-and-memorable
  // plus irrecoverable-consequence gate the operator asked for) is
  // imported eagerly by PassphrasePrompt because the gate runs on
  // the first-login critical path — code-splitting a security
  // acknowledgment behind Suspense would add a loading flash at
  // the exact moment the operator needs the warning to be
  // unambiguous. The component is small (~150 lines, ~600 bytes
  // gz including the variant-fresh branch only PassphrasePrompt
  // does not consume — that branch tree-shakes when Vite is
  // confident, but the import edge from WalletProvider catches it
  // here).
  // 2026-05-29 import-existing-nsec (PLAN.md Tier 1 item 9) bumped
  // 10KB -> 10.5KB: the onImport callback + createWalletFromImport
  // helper added ~150 bytes gz to the WalletProvider chunk. The
  // heavy components (ImportNostrIdentityPrompt, the inline bech32
  // codec) are React.lazy'd via PassphrasePrompt so they ship in
  // their own chunk and only load when the operator taps the
  // import link.
  // 2026-06-01: Show/Hide passphrase toggle on the Unlock screen
  // (showPass state + inline button) nudged the chunk to 10.26KB gz.
  // Bumped 10.25 -> 10.5KB.
  // 2026-06-03: adopt-existing-Nostr-key ("Switch to my existing key")
  // added the adoptExistingKey import edge + the adoptKey context
  // callback to WalletProvider's static graph, pushing the chunk to
  // 10.86KB gz. The succession-link assembly lives in adoptExistingKey
  // (small, leans on chassis primitives already in the attest chunk),
  // and the paste/confirm UI (AdoptExistingKeySection) ships in the
  // SettingsScreen chunk, not here. Bumped 10.5 -> 11.25KB.
  // 2026-06-03 recovery-hardening: the post-setup SecureWalletPrompt
  // (recovery-key reveal right after the ceremony) + the two extracted
  // WalletSplash screens + the useAutoBackup edge are statically in the
  // provider graph, pushing it to 11.90KB gz. These are load-bearing
  // recovery UX a nontechnical user can't reach any other way; the cost
  // is justified. Bumped 11.25 -> 12.25KB.
  // 2026-06-16 friends-trees (consented family-tree share): the inbox
  // dispatch point (inboxEnvelopeHandler, statically in the provider graph)
  // gained a silent friend-tree-share absorb branch mirroring the existing
  // secret-piece-receipt branch. The branch's routing predicate
  // (isFamilyTreeBundle) plus the bundle reader + foreignTreesStore absorb
  // code are static here the same way the secret-piece branch's
  // secretsLedgerStore is — the handler dispatches synchronously on every
  // arrival, so the predicate cannot be deferred, and a dynamic-import of the
  // absorb half measured LARGER (chunk-loader glue) than the static edge. The
  // heavy UI (ShareTreeModal / FriendTreesView) is React.lazy and ships in its
  // own chunks, not here. Net cost ~60 bytes gz. Bumped 12.25 -> 12.5KB.
  { pattern: /^WalletProvider-.*\.js$/, gz: 12_800, label: 'WalletProvider' },
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
  // 2026-05-26 Phase 8 Phase E4 cut 3 (UI wiring) bumped 18.5KB ->
  // 19.5KB to absorb the openMemberRoster static imports
  // (acceptedSelfMemberships + pendingSelfMemberships +
  // publishOpenMemberRoster) feeding the Identity-tab Members view +
  // publish-roster button, plus the joined-members + pending-delta
  // useMemos + handlePublishRoster callback, plus the JoinOrgModal
  // React.lazy declaration. The modal itself is lazy-loaded so its
  // body is not in this chunk; only the trigger button + the
  // openMemberRoster helpers land statically.
  // 2026-05-27 IdentityChip rollout bumped 19.5KB -> 19.7KB to absorb
  // the IdentityChip primitive landing in the HomeScreen import graph
  // via OrgIdentitySections (officials + joined-members lists render
  // identicon + name + short-key chips instead of bare truncated hex).
  // The chip itself plus its identityChipHelpers sibling add ~90 bytes
  // gz to this chunk; the same primitive is reused on the Settings
  // OrgRulesEditor + Officials editor + CosignRequestModal eligible-
  // signer surfaces with no additional cost to HomeScreen.
  // 2026-05-27 PeopleTree first-version (operator's mycelium-tree
  // vision) bumped 19.7KB -> 20.0KB to absorb the holdings +
  // myDisplayName pass-through props on PeopleTabBody — the tree
  // component itself is React.lazy and ships in its own chunk
  // (~1.7KB gz, PeopleTree-prefix), so only the prop wiring +
  // PeopleTabBody view-toggle state lands statically here.
  // 2026-05-27 unholdEnvelope wiring + handshake-dedup filter +
  // useEffect cleanup bumped 20.0KB -> 20.5KB to absorb the new
  // WalletContext field, findCompletedHandshakeWith helper landing
  // in the HomeScreen import graph via PeopleTabBody, and the
  // useEffect that dismisses relay-replayed handshake duplicates.
  // 2026-05-27 StartFamilyModal + FamilyIdentitySections bumped
  // 20.5KB -> 22.0KB to absorb the family-unit static imports
  // (findFamilyUnitsForMember + readFamilyUnit +
  // familySignatureProgress + the FAMILY_ROLES vocab indirectly via
  // FamilyIdentitySections) and the dedupeHandshakesByPeer +
  // handshake-completed helpers. The StartFamilyModal itself is
  // React.lazy and ships in its own chunk (~2.8KB gz,
  // StartFamilyModal-prefix), so only the section render + button
  // wiring lands statically.
  // 2026-05-27 member-side family-ratify cut bumped 22.0KB -> 22.5KB
  // to absorb the useInboxRouting hook extraction (the inbox-routed
  // modal stack moved out of HomeScreen, but useInboxRouting itself
  // lands in HomeScreen's static graph as it consumes useWallet and
  // useInboxAccepts) plus the new family-ratify route case in
  // envelopeRoute.ts. The FamilyRatifyModal itself is React.lazy and
  // ships in its own chunk (FamilyRatifyModal- prefix); the hook
  // wraps the lazy import alongside VouchWitnessModal and
  // RecoveryResponderModal which already shipped as their own chunks.
  // 2026-05-31 backup-failure hardening bumped 22.5KB -> 22.75KB to
  // absorb the red Retry banner branch in HomeScreen's backup-health
  // block — the error-tone styling plus the Retry button that re-runs
  // save() so a persistent Supabase rejection is loud and actionable
  // rather than lurking behind only the soft local-newer note.
  // 2026-05-31 family CRUD overhaul bumped 22.75KB -> 23.5KB: the
  // decked-out FamilyIdentitySections (Founder/Member badges, founded
  // date, per-member badges, inline Delete/Leave confirm, Edit gating)
  // is statically imported by HomeScreen, plus the editFamily state +
  // second StartFamilyModal mount in edit mode. Measured 22.91KB gz.
  // 2026-05-31 invite-by-link cut bumped 23.5KB -> 24.5KB: the People
  // tab gained the InviteShareButton card + the useAcceptPendingInvite
  // hook (auto-completes a /join-accepted invite via remote handshake)
  // in HomeScreen's static graph. Measured 23.96KB gz.
  // 2026-06-03 item-11 D2: useInboxRouting (static in HomeScreen) gained
  // the release-authority-respond route + envelopeRoute now imports the
  // identity-gate request typeguard, measured 24.92KB gz. The responder
  // MODAL itself is React.lazy so only its routing edge rides here.
  // Bumped 24.5 -> 25.5KB.
  // 2026-06-14 Moments cut (family-nest first visible cut): JournalComposer
  // (static in HomeScreen's graph) gained the optional "When did this
  // happen?" event_date input + the momentDate helper import, ~0.2KB gz.
  // HEAD was already a touch over 25.5 from prior arc growth; audited as
  // intentional. Bumped 25.5 -> 26.25KiB (measured 25.93KB gz).
  // 2026-06-15 handshake copy overhaul (clearer step language + numbered
  // instructions, accordion removed) net +~0.05KB; bumped 26.25 -> 26.5KiB
  // (measured 26.30KB gz).
  // 2026-06-15 handshake streamline (scan-once-then-Nostr + self-attest
  // checkbox, RelationshipChips extracted) net +~0.18KB; bumped 26.5 ->
  // 27.0KiB (measured 26.68KB gz).
  // 2026-06-16 diary tags: JournalComposer tag picker + JournalTabs tag
  // filter ride HomeScreen's graph. Measured 27.23KB gz; bumped 27.0 ->
  // 27.5KiB.
  // 2026-06-16 Family tab: the family tree is promoted to its own top-level
  // tab and imported EAGERLY (operator: "not lazy — I want the visual to
  // scream"), so the whole family-tree feature (FamilyTreeEditor + canvas +
  // treeLayout + personEdit signed-correction model + PersonDetailView +
  // createJournalEntry) now rides HomeScreen's static graph instead of a
  // lazy chunk. Measured 37.62KB gz; bumped 27.5 -> 40KiB.
  { pattern: /^HomeScreen-.*\.js$/, gz: 40_960, label: 'HomeScreen' },
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
  // 2026-05-26 Phase 8 Phase E4 cut 3 bumps 10.5KB -> 11KB to absorb
  // the OrgDeclarationSection extraction landing in SettingsScreen's
  // static import graph (the form moved out of SettingsScreen but the
  // JoinPolicyPicker-lazy wrapper + the rule-count-with-join-policy
  // prose + the new Suspense boundary all ride this chunk). Measured
  // 10.31KB gz post-extraction, +57 bytes over the prior budget.
  // 2026-06-03: AdoptExistingKeySection ("Switch to my existing Nostr
  // key") mounted statically under RotateKeySection adds the paste +
  // confirm + honest-disclosure UI (and a parseNostrPrivateKey import
  // edge) to this chunk, measured 11.90KB gz. The cryptographic work is
  // in adoptExistingKey (WalletProvider chunk), not here. Bumped
  // 11 -> 12.25KB.
  // 2026-06-15 peer-rotation fix cut 2: RotateKeySection broadcasts a
  // key-succession announcement to peers on rotate (imports peerSuccession
  // + handshake reader). Measured 12.31KB gz; bumped 12.25 -> 12.6KiB.
  { pattern: /^SettingsScreen-.*\.js$/, gz: 12_902, label: 'SettingsScreen' },
  { pattern: /^SignApprovalScreen-.*\.js$/, gz: 4_000, label: 'SignApprovalScreen' },
  // 2026-06-03: verify page now re-verifies + displays a proof's Bitcoin
  // anchor (verifyProofAnchor + the "Bitcoin timestamp" block-explorer
  // panel + the gated-release-bundle verdict from item 11 D4), measured
  // 5.04KB gz. Bumped 5 -> 5.5KB. Portable-verify cut 2026-06-11 added the
  // "verify this without this page" export block (copy proof + download a
  // standard .ots + show the digest) so a proof can be re-checked off our
  // domain — measured 5.69KB gz. Bumped 5.5 -> 5.9KB.
  { pattern: /^VerifyProofScreen-.*\.js$/, gz: 6_042, label: 'VerifyProofScreen' },
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
  // 2026-06-16: the journal everyday-life tags feature (journalTags.ts, a
  // shared helper imported by JournalComposer, JournalTabs, JournalDetail,
  // FreshTodayCarousel, and createJournalEntry) is hoisted by Rollup into its
  // own post-auth chunk and had landed under the 3KB catch-all without a named
  // budget. Verified clean -- it carries only tag logic; react/supabase/
  // tapit-attest are correctly split elsewhere. It lives on the journal route,
  // not the login path, and is already a shared chunk, so further code-
  // splitting buys nothing; the named budget is the right move. ~3.54KB gz today.
  { pattern: /^journalTags-.*\.js$/, gz: 4_500, label: 'journalTags' },
  // 2026-06-16 bump (1_500 -> 4_000): mediaStore grew from a local-only
  // IndexedDB store into a local IDB store PLUS a Supabase remote-mirror
  // cloud-sync path (remoteMediaStore, the new-device restore). The chunk
  // is verified clean -- it carries only the two store modules' own logic;
  // encrypt/decrypt/sha256/supabase are correctly split into their own
  // chunks, nothing heavy is fused in. Code-splitting the 67-line
  // remoteMediaStore would inject an async boundary into the local-first/
  // remote-fallback get() path for ~1KB, so the honest fix is this budget.
  // ~3.05KB gz today.
  { pattern: /^mediaStore-.*\.js$/, gz: 4_000, label: 'mediaStore' },
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
  // StartFamilyModal — named budget added 2026-05-31 when the family
  // CRUD overhaul gave it an edit mode (pre-fill from an existing
  // envelope, hold-new-then-unhold-old replace, auto-send-on-create
  // loop) and pushed it past the 3KB catch-all to ~3.2KB gz. Its own
  // React.lazy chunk; only the section render lands statically in
  // HomeScreen.
  { pattern: /^StartFamilyModal-.*\.js$/, gz: 4_000, label: 'StartFamilyModal' },
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
  // 2026-06-15 circle-trust gating: circleTrust + the warning banner /
  // ack-gate ride this lazy chunk. Measured 4.40KB gz; bumped 3.91 -> 4.5KiB.
  { pattern: /^CohortEditorModal-.*\.js$/, gz: 4_608, label: 'CohortEditorModal' },
  // 5e-iii-a createCohort helpers get hoisted once both
  // CohortEditorModal and LatticePanel import from the same file.
  // 2026-06-03: the recovery-hardening home-screen backup nudge calls
  // findLatestCohort from HomeScreen (eagerly, not lazy) to decide
  // whether the operator has any recovery path yet, pulling the cohort
  // helpers into the home graph and nudging the chunk to 3.20KB gz.
  // Bumped 2.93 -> 3.5KB. The helper is small and read-only; the cost
  // buys the one nudge a nontechnical user who never opens Settings
  // would otherwise never see.
  { pattern: /^createCohort-.*\.js$/, gz: 3_584, label: 'createCohort helpers' },
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
  // 2026-06-05 CameraCaptureModal — the reusable in-app camera, React.lazy
  // from the journal composer (and other surfaces). Live getUserMedia preview
  // + front/back toggle + shutter, degrading to the native capture input on
  // iOS PWA. Small: no decode libs, just stream lifecycle + a canvas grab.
  { pattern: /^CameraCaptureModal-.*\.js$/, gz: 3_000, label: 'CameraCaptureModal' },
  // 2026-06-03 SharedSecretModal — the family "safe word" create/recover
  // UI, React.lazy from the SharedSecretSection launcher on the Identity
  // tab. Carries the split/combine form + the encoded-share list with a
  // lazy QrShow per piece.
  // 2026-06-04 "more seamless and nostr" bump 3.5KB -> 5KB: the per-piece
  // "Send over chat" path pulls in findVouchingCircleCandidates and its
  // handshake/family/cohort leaf readers to list the circle picker, plus
  // useWallet + sendChatMessage wiring. Measured 4.27KB gz; the growth is
  // the circle-finder + readers, inherent to the DM-a-piece feature, not a
  // leak (those readers are also shared with the connections chunks).
  // 2026-06-04 "cut version 1" bump 5KB -> 5.6KB: the "your secrets" v1 adds
  // the plain-language scenario-template picker (pick -> create -> recover
  // flow) over the same Shamir core. Measured 4.90KB gz; the growth is the
  // template-pick UI + generalized copy, inherent to the experience layer.
  // 2026-06-05 "track where/why you sent secrets" bump 5.6KB -> 8KB: the
  // distribution ledger adds a managed list landing (SecretsLedgerList), a
  // per-secret detail view (SecretDetail), the secretLedger record helpers,
  // the encrypted secretsLedgerStore, and the per-piece tag/assign UI in the
  // make view. Measured 7.14KB gz; this is the whole tracking surface the
  // operator asked for ("all bells and whistles"), folded into the one lazy
  // chunk that only loads when the panel opens — classic users pay nothing.
  // 2026-06-05 "secrets condo in People": the old SharedSecretModal body was
  // extracted into SecretsDashboard (inline, no modal chrome) so it can live
  // as a collapsible panel in the People tab next to List/Tree. The lazy
  // chunk renamed SharedSecretModal -> SecretsDashboard and gained a Share
  // button over the Web Share API (AirDrop / Messages / Mail) alongside the
  // existing chat / Copy / QR channels. Budget held at 8.5KB for the added
  // share wiring; only loads when the operator expands the secrets panel.
  // 2026-06-14: the secrets opt-in work earlier this arc (keepCopy +
  // secretLiteracy imports + token-hash tracking) grew this lazy chunk
  // past 8.5KB without a budget bump. Audited as intentional; still
  // loads only when the secrets panel is expanded. Bumped 8.30 ->
  // 8.75KiB (measured 8.56KB gz).
  // 2026-06-16 secret-module pass (operator: "make it a real module, see who
  // holds your pieces right off the bat, bring it back in one tap"): the ledger
  // cards now render holder chips + held badges + a per-card one-tap bring-back,
  // and the recover view shows who-to-ask (with ask-over-chat) for the targeted
  // secret. Measured 9.60KB gz; bumped 8.75 -> 10.5KiB.
  { pattern: /^SecretsDashboard-.*\.js$/, gz: 10_752, label: 'SecretsDashboard' },
  // 2026-06-14 family-tree CUT 1 editor — FamilyTreeEditor is the
  // edit-your-adjacent-layer modal (add parent/child/spouse/sibling as
  // witnessed person-nodes + kin edges, list your people with their
  // derived relationship). React.lazy from PeopleTabBody's Tree view, so
  // its chunk only loads when the operator opens the editor; the pure
  // graph core (personNode/kinEdge/kinGraph/createFamilyTree) rides in
  // here too. 2026-06-15 render slice added the generation-grouped view
  // (generationOf + treeGenerations) so the tree reads as a shape, not a
  // flat list. Measured 4.05KB gz; bumped 4.0 -> 4.5KiB. 2026-06-15
  // node-detail slice (tap a person -> their stories via storiesAbout)
  // measured 4.72KB gz; bumped 4.5 -> 5.0KiB. 2026-06-15 add-a-moment
  // inline composer (createJournalEntry + subject_node link) measured
  // 5.25KB gz; bumped 5.0 -> 5.5KiB. 2026-06-15 merge-core: kinGraph
  // gained same_as union-find (canonical-node fusion) which rides in this
  // chunk; measured 5.67KB gz; bumped 5.5 -> 6.0KiB.
  // 2026-06-15 polish + kin-education pass: avatars (identicon), relation
  // chips, motion, inline kin explanations + kinEducation glossary. Measured
  // 7.04KB gz; bumped 6.0 -> 7.5KiB.
  // 2026-06-16 gendered-naming slice (operator field report: could not say
  // mother vs father, grandma vs grandpa): optional person sex + the
  // relation-aware Mother/Father toggle + gender.ts label mapping ride in
  // this chunk. Measured 7.75KB gz; bumped 7.5 -> 8.25KiB.
  // 2026-06-16 connected-tree slice (operator: "not a Merkle-looking tree"):
  // the pure treeLayout engine (generation rows + barycenter column ordering)
  // and the FamilyTreeCanvas SVG node-link renderer replace the flat
  // generation-row list and ride in this lazy chunk. Measured 8.83KB gz;
  // bumped 8.25 -> 9.5KiB.
  // 2026-06-16 Family-tab promotion retires this lazy chunk: FamilyTreeEditor
  // is now imported EAGERLY by HomeScreen (its own Family tab), so it no
  // longer code-splits into a FamilyTreeEditor-*.js chunk — its cost moved
  // into the HomeScreen budget above. Entry kept (matches nothing now) only
  // as the historical record of this feature's chunk lineage.
  // 2026-05-29 VouchingCircleSection (Tier 1 item 11 sub-cuts A + C.2)
  // — React.lazy from HomeScreen Identity tab. Carries the
  // candidate-finder helper (reads family / cohort / handshake from
  // holdings), the identity-leaf credential primitive
  // (buildVouchingCircleLeafDraft + readVouchingCircleLeaf +
  // findLatestVouchingCircleLeaf + publishVouchingCircleLeaf), and
  // the picker UI with sign-on-save. ~3.5KB gz with reasonable
  // headroom for the gate-policy composition that lands in
  // subsequent sub-cuts and may also flow through this surface.
  { pattern: /^VouchingCircleSection-.*\.js$/, gz: 4_500, label: 'VouchingCircleSection' },
  // Item 11 D0-D3 — GatedLeafSection (designate gates + request vouches +
  // live resolve display). Lazy from IdentityGateSections. D3 pulled in
  // verifyReleaseAuthorityBundle for the per-gate collected/threshold
  // tally, measured 3.45KB gz. RequestVouchesModal + the responder are
  // their own lazy chunks. Budget 4KB.
  { pattern: /^GatedLeafSection-.*\.js$/, gz: 4_096, label: 'GatedLeafSection' },
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
  // 2026-05-29 import-existing-nsec (PLAN.md Tier 1 item 9) bumped
  // 5.5KB -> 6KB: ImportDiscloseStep + ImportEnterStep + the
  // parseNostrPrivateKey bech32 codec + the publicKeyFromPrivate
  // edge added ~90 bytes gz to the FreshLoginShell chunk. The steps
  // live in freshOnboardingSteps.tsx alongside the existing seven
  // step components; lazy-loading just the import sub-steps would
  // add Suspense flicker mid-flow and the steps run on the import
  // critical path once selected, so the audit-and-bump is right.
  { pattern: /^FreshLoginShell-.*\.js$/, gz: 6_000, label: 'FreshLoginShell (lazy)' },

  // Vendor chunks split via vite.config.ts manualChunks.
  { pattern: /^attest-.*\.js$/, gz: 35_000, label: 'tapit-attest vendor' },
  { pattern: /^react-.*\.js$/, gz: 60_000, label: 'react vendor' },
  { pattern: /^supabase-.*\.js$/, gz: 60_000, label: 'supabase vendor' },
  { pattern: /^qrcode-.*\.js$/, gz: 15_000, label: 'qrcode vendor' },

  // PeerThread is the per-peer chat surface (sub-cut 2b + 2c).
  // 2026-05-25 sub-cut 2c brought it to ~3KB gz with the
  // PromoteMenu, useLongPress hook, and bubble long-press wiring.
  // 2026-06-01: "Add to family" header button + state + lazy
  // Suspense mount bumped it to 4.25KB gz. The AddToFamilyModal body
  // is React.lazy in its own chunk; only the button + mount wiring
  // lands here. Bumped 4.0KB -> 4.5KB.
  { pattern: /^PeerThread-.*\.js$/, gz: 4_500, label: 'PeerThread' },

  // OrgRulesEditor (Phase 8 Phase C cut 2) is the multi-rule org
  // creation UI lazy-loaded from SettingsScreen when the operator
  // opens the org-declaration form. Self-contained component with
  // rule list rendering, add-rule mini-form, and validation. ~1.9KB
  // gz today. Past 3KB the next move is to extract the eligible-
  // signers picker into its own sub-component (a peer-roster
  // multi-picker would be the natural polish).
  { pattern: /^OrgRulesEditor-.*\.js$/, gz: 3_000, label: 'OrgRulesEditor' },

  // JoinPolicyPicker (Phase 8 Phase E4 cut 3) — sibling to
  // OrgRulesEditor in the same SettingsScreen lazy-load pattern. Owns
  // the join-policy half of the org's auth tree (kind-tagged policy
  // payload, six policy kinds with per-kind sub-forms). Self-contained;
  // only imports the JoinPolicy type from governance/authRule. Past
  // 3KB the natural polish is per-kind sub-component extraction.
  { pattern: /^JoinPolicyPicker-.*\.js$/, gz: 3_000, label: 'JoinPolicyPicker' },

  // openMemberRoster (Phase 8 Phase E3 cut 2 + Phase E4 cut 3) — the
  // org-side roster substrate (acceptedSelfMemberships +
  // pendingSelfMemberships + publishOpenMemberRoster +
  // findLatestOpenMemberRoster + readOpenMemberRoster). Hoists into
  // its own chunk once HomeScreen statically imports the producer
  // helpers alongside OrgIdentitySections rendering the consumer
  // side. Tight budget because the file is pure substrate (no UI).
  { pattern: /^openMemberRoster-.*\.js$/, gz: 2_500, label: 'openMemberRoster helpers' },

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

  // authRule — governance helpers (Phase 8 Phase A/B/E1) hoisted into
  // their own chunk once multiple consumers (createOrganization,
  // CosignRequestModal, MembershipModal, OrgRulesEditor, SettingsScreen,
  // RatificationsBadge) import from them. ~1.4KB gz at Phase E1 cut;
  // budget carries headroom for the Phase E2 self-membership decoder
  // and Phase D charter-amendment helpers that will join the file.
  { pattern: /^authRule-.*\.js$/, gz: 3_000, label: 'authRule (governance helpers)' },

  // MembershipModal — org-issuance modal React.lazy from HomeScreen
  // (Phase 8 Phase C close-out: HomeScreen was three lines from the
  // 800-line hard limit, so lazying this off the cold path frees
  // headroom for Phase D/E surface still to come). Pulls in
  // findOwnOrgDeclaration + findAuthRule + buildAuthorizedByPayload
  // from governance plus its own lazy CosignRequestModal import. The
  // chunk only loads when the operator taps "+ Membership" or
  // "+ Admit member" on the Identity tab.
  { pattern: /^MembershipModal-.*\.js$/, gz: 4_000, label: 'MembershipModal' },

  // JoinOrgModal (Phase 8 Phase E4 cut 3) — the any-wallet join-an-org
  // flow React.lazy from HomeScreen Identity tab. Owns paste-or-scan
  // of an org's self-declaration, plain-language policy rendering,
  // proof-picker step (requires_handshake / requires_credential),
  // self-membership envelope signing, and QR + Mycelium delivery.
  // The novel piece of cut 3 because it introduces a new
  // disclosure-proof-construction UI flow at the joiner's end.
  // Pulls QrShow + QrScanModal + parseEnvelope + disclosureProof
  // (the last shared with QuickShareModal / ShareProofModal so it
  // tree-shares into existing chunks) plus buildSelfMembershipDraft
  // + the proof-picker helpers. Past 6KB the natural polish is
  // extracting the policy-description renderer + the per-kind step
  // bodies into sub-components.
  { pattern: /^JoinOrgModal-.*\.js$/, gz: 6_000, label: 'JoinOrgModal' },

  // 2026-05-26 bundle-budget hygiene sweep — every chunk that was
  // previously bucketed under the catch-all gets an explicit named
  // budget so growth is monitored per-chunk rather than averaged
  // away. Headroom is ~40-50% above the current measured size; tight
  // budgets where the chunk is structurally small (tiny constants,
  // single-export helpers) and looser where the chunk has feature
  // surface that may grow with polish. Phase E4 UI work landing the
  // membership-policy picker, Members view, publish-roster button,
  // and join-an-org flow will emerge under their own named budgets
  // alongside these entries rather than disappearing into the
  // catch-all.

  // Fresh theme surface chunks — React.lazy from FreshLoginShell /
  // FreshHomeShell so the Classic surface never pays for them.
  // FreshComposeFAB sits on the Today tab as the floating compose
  // button; FreshCrew is the People-tab Fresh treatment that swaps
  // out the Classic ConnectionCard layout; FreshMemoriesStrip and
  // FreshStreakIndicator are tiny Today-tab Fresh embellishments
  // gated by the appearance-tab Fresh-extras toggle; FreshTodayCarousel
  // is the biggest of the bunch — a swipe-paginated Today-tab card
  // stack rendering the latest journal entries with Fresh tokens.
  { pattern: /^FreshComposeFAB-.*\.js$/, gz: 1_500, label: 'FreshComposeFAB' },
  { pattern: /^FreshCrew-.*\.js$/, gz: 3_000, label: 'FreshCrew' },
  { pattern: /^FreshMemoriesStrip-.*\.js$/, gz: 2_000, label: 'FreshMemoriesStrip' },
  { pattern: /^FreshStreakIndicator-.*\.js$/, gz: 1_500, label: 'FreshStreakIndicator' },
  { pattern: /^FreshTodayCarousel-.*\.js$/, gz: 4_000, label: 'FreshTodayCarousel' },

  // QuickShareModal — React.lazy from HomeScreen Identity tab; opens
  // the over-18 / over-21 / quick-share-preset flow that emits a
  // ProofForShare envelope. Carries the preset enumeration + the
  // disclosure-proof builder import. Past 3.5KB the natural polish
  // is extracting the preset list into its own data module.
  { pattern: /^QuickShareModal-.*\.js$/, gz: 3_500, label: 'QuickShareModal' },

  // ShareProofModal — React.lazy from JournalDetail / PromoteRouter
  // when the operator chooses to share an envelope as a disclosure
  // proof rather than send it directly. Renders the proof preview
  // and the QR/copy-to-clipboard surface.
  { pattern: /^ShareProofModal-.*\.js$/, gz: 3_500, label: 'ShareProofModal' },

  // createPresence — Tier V (5d) helper hoisted into its own chunk
  // once MarkPresenceModal and HomeScreen both import predicate +
  // builder. ~0.85KB gz today.
  { pattern: /^createPresence-.*\.js$/, gz: 1_500, label: 'createPresence helpers' },

  // normalizeImage — image-scaling helper hoisted once both the
  // journal composer and the capture bridge import it. Single
  // single-function module that downsamples + re-encodes to JPEG.
  { pattern: /^normalizeImage-.*\.js$/, gz: 1_000, label: 'normalizeImage helper' },

  // pendingOnboarding — tiny holder constant for the Fresh
  // onboarding-bundle handoff between LoginPage and WalletProvider.
  // Stays under 0.5KB; growth here would mean the holder grew API
  // surface and needs scrutiny.
  { pattern: /^pendingOnboarding-.*\.js$/, gz: 500, label: 'pendingOnboarding holder' },

  // webauthn — Face ID / passkey helper hoisted once Tier V
  // presence flow and the identity-ceremony enrollment both import
  // create + assert wrappers around navigator.credentials. ~0.85KB
  // gz today; budget carries headroom for the recovery-flow
  // passkey-bind cut still pending.
  { pattern: /^webauthn-.*\.js$/, gz: 1_500, label: 'webauthn helpers' },

  // backupBanner — the post-setup "set up a way back in" nudge logic shared
  // across the HomeScreen surfaces. Previously bucketed into a neighbour chunk
  // under the catch-all; the 2026-06-16 friends-trees HomeScreen import-graph
  // change (the Family tab body moved into its own FamilyTabBody component,
  // shifting how rollup co-locates the remaining HomeScreen helpers) re-split
  // this into its own chunk at ~3.02KB gz, a hair over the 3KB catch-all. The
  // module's own content is unchanged — only the chunk boundary moved — so it
  // earns an explicit named budget with headroom rather than inflating the
  // generic catch-all. ~3.02KB gz today.
  { pattern: /^backupBanner-.*\.js$/, gz: 3_500, label: 'backupBanner' },

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
