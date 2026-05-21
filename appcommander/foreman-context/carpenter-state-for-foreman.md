# Carpenter state — for Foreman's eyes

**Format note:** This file is the Carpenter's testimony, written
for the Foreman's eyes (Frank, running in AppCommander). The
Foreman edge function fetches it from main on every call and
injects it into Frank's system prompt BEFORE peer-memory rules.
It's the bridge that lets Frank wake up on every call already
knowing what this project looks like right now.

The Carpenter overwrites this file at every `session_ended`.

**Operator-mode note:** AppCommander has been down today. Dual-
surface comms remains active — files plus live chat narration.

---

## WHAT-CHANGED-RECENTLY

**Phase 2.5 landed** as commit `f299c7d` on branch + main. 27
files changed: 4 library files modified, 13 new wallet files
across 2 new features (journal, anchoring) + media store, plus
updates to WalletProvider, HomeScreen, App, registry. The diary
wedge is shipped end-to-end.

**Library additions (tapit-attest):**
- `AttestationKind` union now 7 members with `journal` added
- `journalAttestation` builder exported
- `KINDS` whitelist in `envelope.ts` updated
- `builders.test.mjs` iterates over all 7 kinds
- Library version stays `0.1.1-wallet.0` (additive change)
- Tests: 74 pass / 0 fail / 4 skipped (corrupted OTS fixture
  unchanged)

**Wallet additions (src/features/journal/):**
- `manifest.ts` — depends on wallet-core, storage, anchoring
- `categories.ts` — Diary, Family, Medical, Marriage, Witness
  suggested + free-form custom
- `createJournalEntry.ts` — text + subject + category + photo →
  signed journal-kind attestation + held + queued for anchoring +
  wallet re-encrypted + persisted
- `JournalComposer.tsx` — single React form, capture="environment"
  on the photo input so mobile pops the camera
- `JournalCard.tsx` — live anchor-status badge via useAnchorStatus
- `JournalTabs.tsx` — dynamic tabs from distinct categories the
  user has used; "All" tab plus per-category
- `JournalDetail.tsx` — full entry view at /entry/:digest with
  photo + signers + anchor status + "Save to my files"
- `downloadEntry.ts` — envelope JSON + photo bytes as two
  separate downloads (no zip; cleaner)

**Wallet additions (src/features/anchoring/):**
- `manifest.ts` — depends on wallet-core, storage
- `anchorProvider.ts` — singleton wrapping tapit-attest's
  OpenTimestampsProvider (already fetch-based, no npm dep — the
  brief's "port from AppCommander" recommendation predated the
  library's current state)
- `anchorQueue.ts` — IDB-backed, keyed by attestation digest,
  states queued/pending/confirmed/failed
- `anchorWorker.ts` — on-mount scan + 5-min interval + online-event
  listener, MAX_PARALLEL=4. Deliberately no exponential backoff
  (calendar outages are the dominant failure mode; retry freely).
- `useAnchorStatus.ts` — per-digest live row subscription
- `useAnchorWorker.ts` — context accessor
- `hex.ts` — local hex helpers (tapit-attest doesn't export its
  internals)

**Wallet additions/changes elsewhere:**
- `src/features/storage/mediaStore.ts` — encrypted photo bytes
  in IDB keyed by SHA-256 (same hash that becomes a leaf in the
  attestation claim — tamper-evident)
- `WalletContext.ts` — added `passphrase`, `anchorWorker`
- `WalletProvider.tsx` — passphrase in state (was useRef +
  passphraseTick — simplified), anchor worker start/stop keyed
  on unlock state, save() now also refreshes holdings
- `HomeScreen.tsx` — JournalTabs + floating "+ New entry" button
- `App.tsx` — `/entry/:digest` route lazy-loading JournalDetail
- `features-registry.ts` — registered journal + anchoring slugs

## Gates at session end

**Root:**
- typecheck: clean
- lint: 0 errors, 0 warnings
- test: 16/16 (registry test picked up 2 new slugs without change)
- build: 160 modules in 3.07s

**Bundle posture (login surface unchanged at ~110KB gzipped):**
- main bundle: 7.78KB gz 3.35KB
- react chunk: 162.28KB gz 52.97KB
- supabase chunk: 207.71KB gz 54.28KB
- attest chunk: 66.66KB gz 25.17KB (lazy, post-auth) — grew to
  carry journal builder export
- WalletProvider chunk: 10.96KB gz 3.54KB (lazy)
- HomeScreen chunk: 10.75KB gz 3.69KB (lazy) — grew to host tabs +
  composer modal
- SettingsScreen chunk: 3.95KB gz 1.63KB (lazy)
- JournalDetail chunk: 3.39KB gz 1.61KB (lazy)
- useAnchorStatus chunk: 5.66KB gz 2.83KB (lazy)
- anchorQueue chunk: 1.58KB gz 0.77KB (lazy)

**tapit-attest:** 74 pass / 0 fail / 4 skipped (journal-kind
round-trip test passes; corrupted OTS fixture unchanged).

**NOT VERIFIED:** end-to-end against a real OpenTimestamps
calendar — sandbox has no browser, no live network for OTS
calendars. Operator must walk the flow locally to confirm the
queued→pending→confirmed cycle works against
`a.pool.opentimestamps.org`.

## WHAT'S-PENDING

1. **Operator browser-verifies Phase 2.5.** Walk: sign in → home →
   "+ New entry" → text + subject (Someone else → "Grandson Tom Jr"
   or similar) + category (Family) + photo → "Sign this entry" →
   card appears with "Anchor queued" → leave app open, wait for
   "Anchored — waiting on Bitcoin confirmation" → wait for Bitcoin
   block → "Confirmed at Bitcoin block NNN" → tap card → detail
   view shows photo + signers + status → "Save to my files" →
   downloads two files (envelope JSON + photo). Any stall or
   surprise is the next session's first business.
2. **Phase 2.6 — multi-witness co-signing + custody-handoff.**
   In-person QR exchange so spouse + relatives can sign each
   other's entries. Custody-handoff `meta`-attestation flow so
   the grandchild's thread can be handed off from grandparent
   to parents (eventually to grandchild). One session.
3. **Phase 2.7 — documents.** Same hash-on-chain bytes-in-
   encrypted-IDB pattern as photos, just different MIME types.
   Reuses mediaStore + composer pattern. One session.
4. **Idle-timeout hook** (DESIGN.md §5). The passphrase exposure
   window risk got bigger this session because passphrase is now
   in WalletContext (was useRef). Recommended pre-launch.
5. **Anchor-worker exponential backoff.** Failed rows retry every
   5 min today. Polite-citizen risk grows with user count.
   `min(5 min × 2^attempts, 1 hour)` would solve it. ~15 min job.
6. **HEIC/WebP photo re-encode.** iOS HEIC and Android WebP photos
   don't render on all viewing devices. Re-encode to JPEG in the
   composer via `canvas.toBlob` for portability. Phase 2.5.5
   polish, not blocking.
7. **Browser verification of Phase 1+2** still pending operator.
8. **Standing follow-ups:** OTS fixture restoration (4 skipped
   library tests), `Tap-it-Attest-main.zip` cleanup at repo root.

## WHAT-TO-FLAG

The OpenTimestamps "port from AppCommander" recommendation in the
diary-first brief turned out to be already done in the library —
`tapit-attest/src/core/anchoring.ts` already uses `fetch` directly
with no `opentimestamps` npm dep. The brief was working from an
outdated picture. Saved the session from doing work that did not
need doing; documented in the in-flight note for the session.

The anchor worker's retry-without-backoff is deliberate but is the
single biggest "if this scales, fix this first" item. The Carpenter
recommends adding exponential backoff before user count exceeds the
operator's own family.

The passphrase moved from useRef to useState + context exposure
this session — necessary because the composer and the detail view
both need it for media encryption/decryption, but it widens the
DevTools-readable surface. The idle-timeout hook from DESIGN.md §5
is now higher-priority pre-launch than it was before.

The grandchild scenario landed solo-signed (just the operator's
signature). Multi-witness co-signing is Phase 2.6 work. The
operator can write the entry today; co-signing layered on later
via in-person QR exchange.

## RECOMMENDED-NEXT-MOVES

1. Operator runs `npm install && npm run dev` against real
   Supabase credentials, walks the full Phase 1+2+2.5 flow, and
   verifies the OTS round-trip against a real calendar.
2. If clean → Phase 2.6 (multi-witness co-signing via in-person
   QR + custody-handoff `meta`-attestation) next session.
3. Phase 2.7 (documents) follows Phase 2.6; reuses photo path.
4. Idle-timeout hook + anchor-worker exponential backoff are
   small pre-launch polish that should land before any external
   user touches the wallet.
5. Standing parallel-track items: OTS fixture restoration, zip
   cleanup, browser-verify-Phase-1+2.

## OPERATOR'S-CURRENT-VIBE

Active design partner. The Phase 2.5 cut came together fast
because the operator's direction in this session was concrete and
named the specific user (grandchild), the specific media (photo
plus text), the specific anchoring (OTS), the specific storage
posture (user-sovereign by default, paid hosted later), and the
specific helper concern (time-delay lifecycle). The operator is
running manually because AppCommander has been down; dual-surface
comms remains explicitly active. Expect the next exchange to be
either a browser-verification report ("it works" or "it stalls at
X") or a Phase 2.6 greenlight. The operator's family clock is the
real schedule pressure: "my grandchild is gonna be born soon" was
in the previous message, so the wallet should be browser-verified
and ready for that first signed birth entry before the birth.

## Ideas ready to revisit

All 16 idea entries from earlier sessions remain stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
The two new ones likely to come up next:
- Multi-witness co-signing via in-person QR (Phase 2.6 work)
- Custody-handoff `meta`-attestation flow (Phase 2.6, three-shape
  succession chain — grandparent → parents → grandchild)

Standing observations from prior sessions still hold:
- The "documented TODO" decay pattern. Current set: 4
  SKIP_CORRUPTED_FIXTURE library tests, idle-timeout TODO, anchor
  worker backoff TODO, HEIC/WebP re-encode TODO, identity round-
  trip integration-test TODO. Frank should surface during quiet
  periods.
- The lazy-loaded auth-vs-wallet boundary as a security pattern
  (still holds — Phase 2.5 preserved it).
- The passphrase-in-ref vs passphrase-in-state distinction —
  this session moved to state for functional reasons; the
  mid-session-abandonment risk remains real and is the idle-
  timeout work above.
- Origin can move under the Carpenter when AppCommander is
  involved. (No surprises this session, but worth holding.)

New observation this session: **the OTS lifecycle worker pattern
generalizes.** Anything that has a "submit now, confirm later
via a separate network query" shape — Nostr message acknowledgment
for Phase 3, Shamir share collection for Phase 5, peer recovery
responses — can reuse the queue + worker + on-mount scan + polling
+ online-event pattern. The anchoring/ folder is a template for
"async-confirm" UX more broadly. Worth keeping the pattern crisp
when future phases add similar lifecycle shapes.
