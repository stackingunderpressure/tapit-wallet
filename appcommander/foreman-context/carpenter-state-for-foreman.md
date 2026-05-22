# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active. v1 is shipped.

---

## WHAT-CHANGED-RECENTLY

**Capture Bridge Tier 1 shipped** (`66e9beb`), branch
`claude/compare-library-wallet-OW5FF` — the second piece of
Phase 4.5.

A new `capture` feature: a GET `share_target` in
`public/manifest.webmanifest` registers the installed wallet as
an OS share destination; a `/capture` route + `CaptureScreen`
composes shared title/text/url into an editable body and on
confirm signs + OTS-anchors a journal-kind attestation carrying
a `source=capture` leaf, reusing `createJournalEntry`. The home
Captured tab is now live — it shows captures (or an instructive
empty state); the Journal tab filters captures out via the
`source` leaf so diary and captures are separate.

Grounding caught a real constraint: the hand-rolled Phase 1
service worker only intercepts GET, so a GET text/link share
target needs zero SW change — but photo/file capture needs a
POST the SW must intercept, deferred to **Tier 1b**. Three
Vite-hoisted shared chunks (CaptureScreen, createJournalEntry,
mediaStore) were given named bundle budgets.

Files: `src/features/capture/CaptureScreen.tsx` (new),
`src/features/capture/manifest.ts` (new),
`public/manifest.webmanifest`, `src/App.tsx`,
`src/features/journal/createJournalEntry.ts` (added optional
`source` to JournalInput), `src/features-registry.ts`,
`src/features/wallet-core/HomeScreen.tsx`,
`scripts/bundle-budget.mjs`.

## Gates at session end

typecheck / lint / test (19/19 across 5 test files) / build all
green. Bundle budgets OK, all chunks named. tapit-attest
unchanged 82/78/0/4. CaptureScreen 1.35KB gz; HomeScreen
~190 lines; all under the file-size warn tier.

## WHAT'S-PENDING

1. **Operator verifies the capture bridge** on the live deploy
   (after a push to main): reinstall/refresh the PWA so the OS
   re-reads the manifest, then from another Android app use
   Share → Tapit Wallet and confirm the capture lands signed in
   the Captured tab. NOTE: iOS does not support Web Share Target
   into a PWA — on iPhone /capture works only when navigated to
   directly; the iOS share-sheet path is Tier 1b + the native
   shell.
2. **Capture Bridge Tier 1b** — photo/file capture. Needs a
   POST share_target and the hand-rolled service worker taught
   to intercept the POST to /capture and hand the files to the
   page. Real SW surgery — treat the offline/caching code as
   review surface.
3. **MYCELIUM_NETWORK_SPEC.md** — needs writing; the operator's
   People-network vision (ideas.md, 2026-05-22) is its heart.
   Once it exists the People tab can be designed.
4. **v1.5:** native shell + App Store + iOS share extension
   (D-07) — also the iOS path for the capture bridge.
5. **Non-blocking follow-ups** unchanged: multi-tab worker
   coordination, OTS fixture restoration, Tap-it-Attest-main.zip
   cleanup, backfill remote media for pre-Cut-2 entries.

## WHAT-TO-FLAG

**The capture bridge cannot be CI-verified.** The Web Share
Target needs a real Android device with the PWA reinstalled.
Build-verified only. The operator must field-test it.

**iOS limitation is structural, not a bug.** Apple does not
implement Web Share Target for installed PWAs. The /capture
route still works when reached directly; the share-sheet entry
on iOS waits for the native shell (v1.5). Expectation set with
the operator in this session.

**The grounding-gate hook is working.** This session it caught
the service-worker-only-GET constraint on the re-read, which set
honest scope (Tier 1 = text/links; Tier 1b = files) before any
code was cut.

**Phase 4.5 is nearly complete.** Tabbed home done; capture
bridge Tier 1 done. Tier 1b (files) is the remaining Phase 4.5
piece, and it is gated on service-worker work.

## RECOMMENDED-NEXT-MOVES

1. Operator pushes 66e9beb to main and field-tests the capture
   bridge on Android.
2. Capture Bridge Tier 1b — photo/file capture via a POST
   share_target + service-worker interception.
3. Write MYCELIUM_NETWORK_SPEC.md from the logged vision.
4. v1.5: native shell + App Store + iOS share extension.

## OPERATOR'S-CURRENT-VIBE

Steady forward momentum, shipping piece by piece — v1 done,
tabbed home done, capture bridge Tier 1 done, each as a clean
gated commit. The operator confirmed v1 and immediately moved to
the next phase. Trusts the Carpenter to ground and scope but
holds the verify-don't-trust line (now mechanized as the hook).
Expect next: capture-bridge field-test feedback from a phone, or
a go on Tier 1b or the Mycelium spec.

## Ideas ready to revisit

All earlier idea entries hold. The 2026-05-22 set — capture
bridge (now Tier 1 shipped), web-proof authenticity, situations
layer, records vault, agent/Donna bridge, and the Mycelium
People-network vision — all stand. The Mycelium vision is the
load-bearing one and should mature into MYCELIUM_NETWORK_SPEC.md.
Tier 1b (file capture) is the next capture-bridge increment.
Full entries are stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
