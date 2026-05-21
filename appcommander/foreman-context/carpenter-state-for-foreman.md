# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active.

---

## WHAT-CHANGED-RECENTLY

**Post-deploy punch list completed** under operator's
verify-don't-trust re-grounding directive. Four cuts shipped
across two sessions; three landed in this block. Branch and
main at `701d39f`.

1. **Cut 1 — photo capture fix** (`05fcd1c`, previous turn).
   Dropped `capture="environment"` (iOS PWA standalone
   interaction was unreliable). Added HEIC→JPEG normalization
   via canvas. Visible "Reading photo…" state during the async
   normalize.

2. **Cut 2 — Supabase Storage for media when cloud-sync ON**
   (`49dbb09`). New SQL migration `20260522000001_create_wallet_media_bucket.sql`
   creates the wallet_media bucket + four owner-scoped RLS
   policies on storage.objects keyed by
   `(storage.foldername(name))[1] = auth.uid()::text`. Path:
   `<owner_id>/<sha256-hex>.json`. New `remoteMediaStore.ts`
   handles upload/download with upsert + 404 handling.
   `mediaStore.ts` refactored to local+remote coordinator (same
   shape as walletStore): encrypts once, IDB always, Storage if
   cloudSync; get tries local first, falls back to remote on
   miss with local-cache on hit (no re-encrypt under possibly-
   different passphrase). `createJournalEntry` signature gained
   cloudSync boolean; `JournalComposer` threads it from
   prefs.cloudSync.

3. **Cut 3 — Web Share API for AirDrop** (`ba04481`). New
   `src/shared/lib/share.ts` wraps `navigator.share` with
   feature-detect + clipboard fallback + AbortError-as-cancelled.
   Wired into all four producer modals (CosignRequest,
   CosignAsWitness signed step, CustodyHandoff signed step,
   ShareProof generated step) as a primary "Share via AirDrop /
   Messages / …" button alongside Copy. iOS surfaces the system
   share sheet — AirDrop, Messages, Mail, anything installed.

4. **Cut 4 — QR encode + scan** (`701d39f`). Encode via
   `qrcode` npm package (^1.5.4, ~10KB gz tree-shaken, SVG
   output, low error correction). Decode via native
   `window.BarcodeDetector` API (Chrome / Edge / iPhone Safari
   17+; Firefox shows "use Paste or Share" fallback). New
   `src/features/qr/` feature with manifest, encodeQr,
   barcodeDetector helpers, QrShow (async-rendered SVG with
   friendly too-large message), QrScanModal (camera stream +
   rAF detect loop + cleanup on unmount). Producer modals got
   "Show as QR code" toggle; receiver modals (AbsorbCosign,
   CosignAsWitness paste step, VerifyProofScreen) got "Scan QR"
   button.

**Pre-commit catches this block (verify-don't-trust working):**
- Typecheck on `QrScanModal`: detector could be null inside
  start() async closure. Fixed by capturing in non-null local.
- Lint on `QrShow`: unused react/no-danger eslint-disable
  directive. Removed.
- Mid-session: shell cwd persisted from earlier `cd tapit-attest`,
  caught when gates output showed wrong package. Explicitly
  `cd /home/user/tapit-wallet` before re-running.
- Library-seam audit ran clean on every commit — no new wallet
  function names collided with tapit-attest exports.

## Gates at session end

**Root:** typecheck / lint / test (17/17) / build all green.
Manifest-registry auto-picked up the new `qr` slug.

**tapit-attest:** 82 total / 78 pass / 0 fail / 4 skipped
(corrupted-fixture baseline unchanged).

**Bundle posture (login surface unchanged at ~110KB gz):**
- main: 8.34KB gz 3.49KB
- react: 162.87KB gz 53.19KB
- supabase: 207.71KB gz 54.28KB
- attest (lazy): 71.10KB gz 26.40KB
- WalletProvider (lazy): 11.90KB gz 3.90KB
- HomeScreen (lazy): 17.28KB gz 5.37KB
- JournalDetail (lazy): 18.75KB gz 5.29KB
- SettingsScreen (lazy): ~3.95KB gz 1.63KB
- SignApprovalScreen (lazy): 8.28KB gz 2.86KB
- VerifyProofScreen (lazy): ~5KB gz est
- QrShow (lazy, new): 29.19KB gz 11.62KB — qrcode library
- share-* (lazy): 8.77KB gz 4.14KB

Post-auth surface trending monotonic. Bundle-budget audit
remains on follow-up list; a mechanical chunk-size assertion in
vitest is the next mechanism-over-prose candidate.

**Keys-never-leave audit clean.** Cut 2 encrypts client-side
before any Storage upload; Cut 3 and Cut 4 only surface public
envelope/proof JSON the clipboard already exposes; the private
key never appears in any payload at any layer.

**File-size rule** (CLAUDE_ROOT.md 400-line warn): satisfied.
QrScanModal is the largest new file at ~140 lines.

## WHAT'S-PENDING

1. **Operator browser-verifies all four cuts** against the
   live Netlify + Supabase deploy.
   - Cut 1: photo capture flow works with the standard file
     picker; HEIC photo from iPhone renders correctly in detail
     view (canvas-converted to JPEG).
   - Cut 2: sign-entry-with-photo + cloud-sync-ON → sign out →
     clear IndexedDB → sign back in → photo still loads in
     detail view (remote fallback works).
   - Cut 3: Share button on any signed envelope surfaces iOS
     share sheet including AirDrop.
   - Cut 4: Show QR renders; another device's Scan QR reads it
     and fills the textarea.
2. **Operator-side: run the new SQL migration** in Supabase
   SQL editor BEFORE redeploying. Without it, Cut 2's photo
   upload throws (caught + logged, local save still works, but
   no cloud mirror until the bucket exists).
3. **Five non-blocking follow-ups** (all logged):
   - Multi-tab worker coordination (BroadcastChannel).
   - Bundle-budget audit + dynamic-import the qrcode library.
   - OTS fixture restoration (4 skipped library tests).
   - `Tap-it-Attest-main.zip` cleanup at repo root.
   - Backfill remote media for entries created before Cut 2.
4. **NFC remains the documented platform-gap** — Safari iOS
   doesn't implement WebNFC. Not v1.
5. **Phase 5 — Mycelium + Shamir recovery** still waits for
   `MYCELIUM_NETWORK_SPEC.md`.
6. **Phase 6 — Full-keypair family custody** optional now.

## WHAT-TO-FLAG

**The doctrine continues to select tasks deterministically.**
This block was the operator's punch list — every item had a
clear "why" tied to a specific user-observable behavior. The
mechanical-check pattern from CLAUDE_ROOT.md non-negotiable #5
caught three would-be bugs across this block plus the previous
one. The next mechanism candidate I can see: a bundle-size
assertion. The post-auth chunks are trending monotonic and
there's currently no check that fails when they cross a
budget. Vitest can read dist sizes post-build and assert; that
converts "watch the trend" into a test-fails-on-regression.

**Cut 2 operator-side migration is the only deploy-blocking
step** for the punch list to be visible to users. The wallet
code doesn't crash without the bucket — uploads fail gracefully
— but the cloud-sync promise isn't real until the bucket
exists.

**Cut 4 BarcodeDetector API is iOS Safari 17+ / Chrome / Edge
only.** Firefox families get the friendly fallback. If the
operator's family includes any Firefox-on-Android users, set
expectations.

**The bundle-bloat trend is now actively meaningful.** Login
surface still holds at ~110KB gz but post-auth chunks crossed
into substantial territory this block. Next feature work
should be preceded by a budget audit.

## RECOMMENDED-NEXT-MOVES

1. Operator runs the new SQL migration in Supabase.
2. Operator redeploys via Netlify (auto-deploys from main).
3. Operator walks the four-cut verify checklist above.
4. If clean: ship. If any stall: report the specific failure.
5. The five non-blocking follow-ups available for any quiet
   slot; highest-leverage is the bundle-budget audit (preventive
   before more features land).

## OPERATOR'S-CURRENT-VIBE

Disciplined, focused, post-deploy mode. The verify-don't-trust
re-grounding directive was sharp — "do not trust anyone else's
word go back to the source" — and the Carpenter took it
seriously, re-reading both doctrine files fresh and re-verifying
the prior photo fix via grep rather than trusting written notes.
The operator is doing real testing work in parallel on Netlify;
the Carpenter has now cleared the four-item punch list that
came from that testing. Next exchange will be either a
browser-verify outcome on the now-shipped cuts or a new
direction.

## Ideas ready to revisit

All earlier idea entries hold. New observation worth naming:

- **Bundle-size assertion as the next mechanism candidate.**
  Post-auth lazy chunks are trending monotonic; CLAUDE_ROOT.md
  has a 400-line file-size mechanism but no chunk-size one.
  vitest can read post-build dist sizes and assert against a
  budget. Catches the next bundle-bloat regression without
  operator-attention cost.

- **The dynamic-import-on-toggle pattern is the right next
  optimization for QrShow.** Currently QrShow's parent (e.g.,
  CosignRequestModal) pulls the qrcode library when the modal
  mounts. Wrapping QrShow in a React.lazy that only resolves
  when the Show-as-QR toggle fires would defer the 11.6KB gz
  cost until first use. Small refactor, big savings for users
  who never tap Show as QR.

The 16+ earlier idea entries are stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
