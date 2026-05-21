# Carpenter state — for Foreman's eyes

**Format note:** This file is the Carpenter's testimony, written
for the Foreman's eyes (Frank, running in AppCommander). The
Foreman edge function fetches it from main on every call and
injects it into Frank's system prompt BEFORE peer-memory rules.
It's the bridge that lets Frank wake up on every call already
knowing what this project looks like right now.

The Carpenter overwrites this file at every `session_ended`.

**Operator-mode note:** AppCommander has been down today. The
operator has been reading the repo manually and asked the
Carpenter to keep writing comms records here AND narrate live in
chat. Both surfaces are current.

---

## WHAT-CHANGED-RECENTLY

**Phase 2 landed** as commit `c87e8a2` on both
`claude/compare-library-wallet-OW5FF` and `main`. 18 files
changed: 6 created, 12 modified. The wallet now holds its first
signed identity attestation.

The first-run flow has a new second screen: after the passphrase
prompt creates the keypair and writes the encrypted snapshot, a
display-name prompt captures the user's display name and the
wallet calls `identityAttestation` from `tapit-attest` with
`display_name`, `pubkey`, and `created_at` as leaves. The draft
is signed by the wallet's own key (self-signed, tier routine),
held on the wallet, and the snapshot is re-encrypted + re-saved.

The held attestation renders as a card on the home screen above
the IdentityCard. The card uses plain English: display name
large, friendly date string, tier label, "self-signed" wording.
Other holdings (none in v1's Phase 2) would render below.

A backup-status banner sits at the top of home when there's
something to say:
- "Cloud backup is off" — user toggled it off
- "Cloud backup pending" — first sync hasn't completed
- "Cloud backup is more than a day old" — stale > 24h
- (no banner when fresh)

**Settings is a new feature** at `src/features/settings/` with
its own `manifest.ts` (`depends_on: ['auth', 'wallet-core',
'storage']`) and a lazy-loaded route at `/settings`. Three cards:
cloud-backup toggle (default ON, persists in `prefsStore`,
re-saves immediately when flipped back on), local encrypted-backup
download (passphrase-confirmed, writes the EncryptedBlob as
indented JSON), and sign-out.

**Storage layer additions:**
- `prefsStore.ts` — new. Unencrypted user prefs keyed by
  `prefs:<ownerId>`. Shape: `{ cloudSync: boolean,
  lastRemoteSync: string | null }`.
- `walletStore.save` — modified. Reads cloudSync pref before
  remote write; records `lastRemoteSync` on success; returns a
  `SaveOutcome` shape so callers can distinguish skipped vs
  failed remote writes.

**WalletProvider state machine:**
- checking → first-login | locked → (needs-identity)? → unlocked
- Passphrase held in `useRef` across the session for save-
  without-re-prompt; cleared on sign-out via `useEffect` on
  `session.session`.

**App.tsx** now nests a `<Routes>` block inside the auth tree
so `/` → HomeScreen and `/settings` → SettingsScreen.

**PLAN.md** rewritten to match DESIGN.md's six-phase structure.
Phases 1 and 2 marked DONE. Phase 7+ explicit non-goals
enumerated (wallet bot, Mycelium, group keys, charter governance,
Nostr transport, NFC, voice, WebAuthn).

## Gates at session end

**Root:**
- typecheck: clean
- lint: 0 errors, 0 warnings
- test: 16/16 (12 persona-contract parity + 4 manifest-registry;
  registry test correctly picked up the new `settings` slug)
- build: 140 modules, 2.77s

**Bundle posture (login surface unchanged at ~110KB gzipped):**
- main bundle: 7.48KB gz 3.24KB
- react chunk: 162.19KB gz 52.95KB
- supabase chunk: 207.71KB gz 54.28KB
- attest chunk: 59.01KB gz 22.22KB (lazy, post-auth)
- WalletProvider chunk: 9.67KB gz 3.03KB (lazy)
- HomeScreen chunk: 3.38KB gz 1.39KB (lazy)
- SettingsScreen chunk: 3.95KB gz 1.63KB (lazy)

**tapit-attest:** 74 pass / 0 fail / 4 skipped (unchanged this
session).

**NOT VERIFIED:** visual rendering or end-to-end flow in a
browser — sandbox has no browser. Operator must run `npm run dev`
locally with real Supabase credentials.

## WHAT'S-PENDING

1. **Operator browser verification of Phases 1+2.** Walk: login →
   passphrase → display-name → home with identity card →
   /settings → toggle cloud-sync off (banner appears) → toggle
   back on (banner clears) → download local backup (JSON file
   downloads) → sign out → re-login → unlock → home still shows
   identity card. Any stall or surprise becomes the next
   session's first business.
2. **Phase 3 — social recovery designation + simulated cycle.**
   User designates 5+ trusted attesters by pubkey; each gets a
   shareable recovery-attestation grant letter; simulated
   end-to-end recovery from a fresh wallet with two browser
   profiles representing two attesters. ~1 session.
3. **Idle-timeout hook.** DESIGN.md §5 calls for 30-min default
   idle-timeout configurable from 5min to "never until browser
   close." Not yet implemented — passphrase ref stays in memory
   until session.session goes null. Could be a Phase 2.5 (cut
   before Phase 3) or roll into pre-launch polish. Operator's
   call.
4. **`Tap-it-Attest-main.zip`** (116KB) still at repo root.
   Operator said "I'll delete zip later." Untouched.
5. **OTS fixture restoration.** 4 skipped tests in tapit-attest
   awaiting a clean fixture. 15-min focused job, can happen any
   time, not blocking.
6. **Integration test** for the `createIdentityAttestation →
   wallet.hold → wallet.holdings → findIdentity` round-trip.
   The component parts are tested in tapit-attest but the
   end-to-end is not exercised in this repo. If browser
   verification surfaces a "wallet keeps showing display-name
   prompt after onboarding" symptom, this is the path. ~15 min
   to add.

## WHAT-TO-FLAG

**Identity-attestation round-trip is unverified at the
integration level.** Each piece (`identityAttestation`,
`wallet.sign`, `wallet.hold`, `wallet.holdings`,
`verifyEnvelope`) has unit-level coverage in tapit-attest, but
the end-to-end "create attestation → re-encrypt snapshot →
restore from blob → holdings still includes it → identity card
renders" path is not tested. Quorum-of-good `verifyEnvelope`
should handle the single-signature self-signed routine-tier
case cleanly, but worth integration-testing if anything in
browser verification looks odd.

**Mid-session security gap.** After unlock, anyone with access
to the unlocked browser session can hit `/settings` and
download an encrypted backup or toggle cloud-sync without
re-entering the passphrase. DESIGN.md §5 calls for an idle
timeout; not implemented yet. Operator should decide whether
to add it before Phase 3 or as pre-launch polish.

**Local-export file size posture.** The downloaded encrypted
blob is JSON.stringify'd with two-space indent (~800 bytes vs
~300 bytes compact). Picked indented for human readability of a
power-user's backup. Easy to flip if size matters more.

## RECOMMENDED-NEXT-MOVES

1. Operator runs `npm install && npm run dev` (or the production
   build) with real Supabase credentials and walks both phases
   end-to-end. Report back any stall, error, or surprise.
2. If everything works, Phase 3 (social recovery) is the next
   cutting session. About one session per DESIGN.md §10.
3. Optionally before Phase 3: a 15-30 minute "Phase 2.5" pass
   adding an idle-timeout hook and the integration test for the
   identity-attestation round-trip. Recommendation: cut Phase 3
   first unless the operator wants the polish first.
4. The OTS fixture restoration remains a parallel-track short
   job. Not blocking.

## OPERATOR'S-CURRENT-VIBE

Trusting and ready to ship. The Phase 2 cue was a single word
("Yes"), continuing the pattern from earlier in the day. He is
following the Carpenter's lead inside named constraints,
delegating architectural calls, and not asking for spec
ceremony. He is running manually because AppCommander is down
and has explicitly extended the dual-surface comms mode (files
plus chat narration) until otherwise. His emotional posture by
the next exchange will partly depend on whether browser
verification of Phases 1 and 2 goes clean against a real
Supabase project. If clean, expect "Phase 3" or equivalent. If
not clean, expect a specific debug request.

## Ideas ready to revisit

The 27 provisional D-decisions from the library-context design
doc remain unimported into
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
Top candidates by phase order: D24 NFC tap-context-aware (Phase 5
polish), D25 tap-to-cosign (Phase 3 polish), D26 mycelium category
defaults (post-v1), D27 transitive trust depth (post-v1), D2
group keys with FROST/MuSig2 (Phase 8+).

Standing structural observation carried from Phase 1: **the
lazy-loaded auth-vs-wallet boundary is a security pattern.**
Phase 2 preserved this — Settings is also lazy-loaded behind
auth, so an unauthenticated visitor's browser never holds the
wallet code, the settings code, or any cryptographic surface in
memory. Attack surface stays minimal during the login phase.

New observation from this session worth naming: **passphrase-in-
ref is a state-management pattern, not a security pattern.** It
solves the "save without re-prompt" problem cleanly but it does
NOT solve "user walked away from unlocked phone." Two separate
problems with two separate solutions; the second one is the
idle-timeout work above. Worth keeping this distinction crisp
when future phases tempt us to treat them as one problem.

Standing observation from the merge session: **the "documented
TODO" decay pattern** — Frank should proactively surface skipped
tests, dormant manifests, and the idle-timeout TODO during
quieter periods so they don't slide into permanent state. Current
set: 4 SKIP_CORRUPTED_FIXTURE tests, 4 dormant bot manifests,
idle-timeout TODO, identity round-trip integration-test TODO.
