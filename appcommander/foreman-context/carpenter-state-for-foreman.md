# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

**Two-Carpenter workflow note:** Two parallel Claude sessions, main is the handshake point. `SessionStart` hook in `.claude/settings.json` continues to catch drift cleanly across handoffs.

**Session-shape note for 2026-05-24:** Twenty-four commits shipped between the prior formal close-out at `1f252c9` and this one at `b2397f8` across an extended operator-led arc. Mini-sessions ended individually in in-flight.jsonl but the carpenter-opinions / carpenter-state / current.json living artifacts were not refreshed until this close-out. The arc was operator-driven Q&A leading to small targeted cuts rather than a single named mission, so the per-cut commits are the canonical record; this handoff aggregates them.

## WHAT-CHANGED-RECENTLY

**iOS polish + Netlify reliability arc (commits `66fd292` → `9722951`)**

- `66fd292` Fix iOS modal off-center bug — extend zoom-prevention to textarea + select.
- `e238e90` Add Nostr live indicator to the HomeScreen header (Transport gains `relayStatus()` + `subscribeStatus(handler)`; WalletProvider subscribes; new `NostrIndicator` pill with green-pulse/amber/grey states; hides when Mycelium off).
- `348ae83` Fix iOS zoom fix — `!important` on font-size to beat Tailwind class selectors. Specificity correction; the prior commit's bare element selectors lost to Tailwind's class selectors so auto-zoom kept firing.
- `db0ff1f` Fix Netlify deploys — explicit `prebuild` script in package.json that builds `tapit-attest/dist` before the wallet's tsc + vite. Netlify's `npm ci` doesn't reliably fire the `prepare` script on file: deps, leaving dist/ empty.
- `9722951` Bump login-bundle budget to 5.5KB after RelayStatus type surface pulled the entry chunk.

**QR usability + paper-recovery + WalletGuide arc (commits `ca61fca` → `f2a6a3c`)**

- `ca61fca` QR paste fallback + Known Limitations section in Settings. iPhone PWA standalone detected; modal opens directly in paste mode for that case.
- `304d839` Paper-K_data export + import — unconditional last-resort lazy-operator fallback. Settings → Local backup → Recovery key reveal (passphrase-gated, 8-char-group display). Lock-screen "Or use your written-down recovery key" link opens RecoveryKeyImportModal.
- `d0bfdef` Phase 5e-vii library — `createRecoverySuccession.ts` with the peer-witnessed succession credential builder, predicates, readers, M-of-N witness math, 5 new wallet tests. No UI yet; library checkpoint.
- `265f587` WalletGuide — tabbed reference surface, single component, two entry points (LoginPage Account-first / `/about` Why-first). Four tabs originally (Why & Who / What it holds / Recovery / Account).
- `4c1611a` WalletGuide — credit OpenTimestamps section (Peter Todd / aggregation calendar / why this beats empty time claims). Login bundle budget bumped 9 → 10KB.
- `f2a6a3c` Bump text-xs + text-sm globally — `.text-xs` 12→14px, `.text-sm` 14→15px with `!important` + proportional leading. Single rule lifts every body-prose tier across the app.

**Tier V depth + sovereignty + integrity arc (commits `fbb73ba` → `1089e1f`)**

- `fbb73ba` Tappable Tier V presence cards + full PresenceDetailModal (When / Where with OpenStreetMap link / Face ID block / Wallet signature with anchor status / collapsible Cryptographic details).
- `cc5a3da` Sovereignty tab (fifth tab in WalletGuide) + Sovereignty preamble at top of Settings. Names the four gradations (Connected / Connected-private / Sovereign-with-cohort / Sovereign-solo).
- `0788942` File integrity verify — JournalDetail gets a "Verify file integrity" button that re-hashes the attachment bytes via mediaStore and compares to the signed-and-anchored SHA-256, three result states (match/mismatch/missing).
- `a5da33a` Sovereign-confirm step — cloud backup default ON unchanged, but turning it OFF now requires explicit checkbox acknowledgment via an inline amber panel with three concrete implications. KnownLimitationsSection extracted to its own file to stay under the 800-line hard limit.
- `1089e1f` Narrow two Known Limitations gaps — QR Pick-a-photo button (decodes static image via BarcodeDetector; works in PWA standalone where live video doesn't) + RecoveryInitiatorModal auto-emits 5e-vii self-signed succession credential on successful recovery.

**Key rotation + identity polish arc (commits `5caa284` → `c4cc3ff`)**

- `5caa284` UX prune pass 1 — drop gratuitous crypto names from user-facing copy (WalletGuide ledes, PresenceDetailModal wallet-signature card, CustodyHandoffModal pubkey placeholder). Schnorr / Merkle / secp256k1 invisible plumbing renamed to "wallet signature" / "tamper-evident structure" / "64-character hex" in user surfaces. Kept where they do real work (OpenTimestamps Merkle aggregation block).
- `f8df997` Self-signed key rotation UI — new RotateKeySection in Settings wires `Wallet.rotate()` + `verifyKeyHistory()` with confirmation flow listing four honest implications + acknowledgment checkbox.
- `65598dd` Fix IdentityCard labeling — show genesis identity (never changes), surface active key in a "Currently signing with" subsection only when it differs from identity. Pre-rotation no visual change; post-rotation honest about both facts.
- `a287717` Rotation resilience cut 1 — auto-rebuild Mycelium subscription on key rotation. WalletProvider's transport effect now reads `phase.wallet.publicKey` per-render via a derived `activeKey` value so the subscription tears down and rebuilds on the new pubkey after rotation. RotateKeySection warning updated to soften the inbox-disconnect message accordingly.
- `cf270bf` Brief — Fresh: young-adult-friendly theme + IA roadmap. Lives at `project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-24-fresh-young-adult-theme-roadmap.md`. Spec-only; no code.
- `d2c98d4` IdentityCeremony — optional Bind-Face-ID step at first-run. Was 3 steps (Welcome → Name → Declaration), now 4 (Welcome → Name → Bind your Face ID → Declaration → Signing). Calls existing `enrollPasskey` + `holdDevicePasskey` primitives; the device-passkey credential lands as a sibling envelope to the identity attestation at the same signing moment.
- `c4cc3ff` Handshake-flow audit — names everywhere, kill the pubkey leaks. New `peerNamesByPubkey` helper builds `Map<pubkey, name>` from handshakes + identity attestations. InboxPanel resolves sender pubkey to name when known. EnvelopePreview gains a handshake-specific render with the parties' names front and center instead of the generic subject-shortkey.

**Presence anchoring polish (commit `b2397f8`)**

- `b2397f8` PresenceDetailModal reads live anchor state via `useAnchorStatus` instead of the static `presence.anchor` field that stays null until the worker confirms hours later. Four honest status states surface (confirmed-with-block / failed / time-verifying / not-queued).

## Gates at session end

- typecheck ✓ (every commit)
- lint ✓ (every commit)
- test ✓ — wallet 48/48 (5 new tests in `d0bfdef` for 5e-vii library; rest carry forward), tapit-attest 154 total (150 pass + 4 skipped network; unchanged across this arc)
- build ✓ — multiple budget bumps documented inline; all current chunks within budget

## WHAT'S-PENDING

1. **Phase 5e-vii UI cuts — peer co-signs over Mycelium.** The library is shipped at `d0bfdef`, the self-signed half auto-emits on recovery at `1089e1f`. Remaining: a RecoverySuccessionModal initiator surface (collects M peer co-signs over Mycelium AND in-person QR — design blended-transport from cut 1 per the doctrine), a peer-side responder modal that opens when a peer receives a draft, an `envelopeRoute.ts` entry for `recovery-succession` envelopes. Multi-modal protocol work; its own session.

2. **Rotation resilience cuts 2 + 3.** Cut 1 shipped at `a287717` (auto-rebuild subscription). Cut 2 = rotation-announcement envelope broadcast over Mycelium to known peers carrying the new succession link. Cut 3 = receive side — peers who learn another peer rotated, re-encrypt any held recovery shares to the new pubkey. Together these close the cohort-shares-and-live-connection-go-stale-on-rotation gap. The current RotateKeySection's confirmation panel names this honestly as the manual workaround until those cuts ship.

3. **Fresh theme — Cut 1 onward** per the brief at `2026-05-24-fresh-young-adult-theme-roadmap.md`. Nine sized cuts. Cut 1 (Tailwind tokens + `useTheme` hook + `prefs.theme` field + Settings → Appearance toggle) is the foundation; foundational only, no visual change yet. Cuts 2-9 layer onto it.

4. **Document signing for medical/legal — hash-attestation flow.** Operator surfaced the friction earlier in the session: doctor needs to see the doc to sign meaningfully, but co-signing today ships the envelope only, not the attachment bytes. Smallest cut: a "send for hash-signature" mode in the co-sign flow that frames the protocol as "the signer attests to the hash, not to what the wallet shows about the file" — needs zero new crypto. Bigger cut later: re-encrypted-attachment sharing over Mycelium.

5. **Operator field tests still load-bearing.**
   - Wife-test of `/verify` (verify-page polish shipped at `530e946` previously).
   - Two-device 5c stack against real Nostr relays.
   - Two-device blended distribute + recovery covering all four blend cells (Nostr/QR × distribute/recover).
   - Tier V presence on a real device — now with the new tappable detail modal + live anchor status surfaced honestly.
   - First real-device key rotation walking the entire post-rotation flow (auto-rebuild subscription should make this less painful).

6. **Wallet-side K_data-stable integration test.** Library coverage exists; wallet-side dispatch in `saveWallet.ts` still needs `fake-indexeddb` or `vi.mock`-pattern integration test. Flagged in every prior handoff; not blocking.

7. **Latent items unchanged from prior handoffs.**
   - Cohort-peer key-rotation NIP-44 verification (more relevant now that rotation UI ships — does `decryptHeldShare` work after a peer rotates? operator's wallet warns about it in the rotation confirm; mechanical proof still pending).
   - HEIC/WebP photo re-encode in journal composer for cross-device portability.
   - OTS fixture restoration (4 skipped network-dependent tests in tapit-attest).
   - `Tap-it-Attest-main.zip` cleanup at repo root.

## WHAT-TO-FLAG

**The Fresh brief is now the longest-horizon roadmap on the queue.** Nine cuts each Carpenter can ship independently with a clear sequence. Cut 1 (foundational tokens + theme toggle) is the natural first move — no visual change, just infrastructure. The operator should be the one writing Sage's voice (the brief specifies the shape; the words come from the operator) so a Carpenter session that lands the bot activation should leave the persona content as fill-in-the-blanks for the operator to author. Don't manufacture personality.

**Rotation resilience cuts 2-3 are the next-most-actionable.** Cut 1 closed the operator's-own-wallet side of post-rotation disconnect; peers still don't know about the rotation. Building the broadcast + receive flow on top of the existing Mycelium transport plus the cohort recovery share-distribution pattern is the natural next move. Two new envelope shapes (rotation-announcement + share-refresh) plus the corresponding peer-side modal. Medium-sized cut.

**The hash-attestation document-signing flow** is the operator-named feature that closes the medical/legal/notary use case. Smallest first cut needs no new cryptography — just a UX mode that frames the co-sign request as "attest to the hash, not what's shown" and shows the hash prominently to both parties. Half a session of work.

**File-size discipline is operating at the edge.** Three files at or near the 800-line hard limit through this arc — RecoveryInitiatorModal (799), HomeScreen (798), SettingsScreen (738 after extraction). Future cuts that touch these files need to extract subcomponents proactively rather than appending. The KnownLimitationsSection extraction and the RotateKeySection extraction set the pattern.

**Login bundle budget grew across this arc.** 5KB → 5.5KB → 9KB → 10KB → 12KB. The growth is operator-requested (WalletGuide + OTS section + Sovereignty tab all live in the entry chunk). Past 12KB the next move is to lazy-load the non-Account tabs of WalletGuide as separate chunks so the cold-start landing stays tight. Flagged in the bundle-budget.mjs comment.

**The handshake-name audit's `peerNamesByPubkey` helper is reusable.** Any future surface that shows a sender or party pubkey should reach for the same helper rather than re-rolling a lookup. It's exported from `connections/createHandshake.ts`.

## RECOMMENDED-NEXT-MOVES

In order of value-per-effort:

1. **Phase 5e-vii peer co-sign UI** — closes Phase 5e fully. The math is shipped; only the choreography is left. One full session.
2. **Rotation resilience cuts 2 + 3** — closes the cohort-disconnect-on-rotation gap. One full session.
3. **Hash-attestation document-signing flow** — closes the medical/legal/notary use case the operator surfaced. Half a session.
4. **Fresh theme cut 1** — foundational tokens + theme toggle. No visual change yet but unblocks cuts 2-9 of the Fresh brief. Half a session.
5. **Operator field tests** — wife-test of /verify, two-device blended distribute + recovery, real-device rotation walk. Operator-owned; the wallet is ready.
6. **Smaller follow-ons** — wallet-side K_data invariant test, cohort-peer rotation verification, HEIC/WebP re-encode.

## OPERATOR'S-CURRENT-VIBE

Maximally engaged Socratic Q&A mode tipping into rapid-cut execution. The arc was characterized by sharp diagnostic questions ("Old stuff shows in new identity like nothing happened?", "When you capture a presence somewhere, it does not anchor into the bitcoin block chain it says not done yet") that each surfaced a real bug or missing surface that got fixed within the same turn. The operator is reading the actual app, not the spec; what they don't see in the UI doesn't exist to them, regardless of what the math is doing. Operator listens via TTS and copy-alls; keep replies tight.

## Ideas ready to revisit

All prior entries hold.

- **2026-05-24 — Fresh theme cuts 1-9**: codified in the brief. Operator authorizes Carpenter sessions to pick them up in order.
- **2026-05-24 — Rotation announcement broadcast (resilience cut 2)**: design as a new envelope kind that rides Mycelium; peers' wallets update pubkey pointers on receipt.
- **2026-05-24 — Share-refresh workflow (resilience cut 3)**: when a peer learns another peer rotated, offer a one-tap "refresh their share to their new pubkey" via Mycelium re-encrypt.
- **2026-05-24 — Hash-attestation co-sign mode**: smallest cut that addresses the medical/legal/notary doc-signing friction. No new crypto.
- **2026-05-24 — Custom OpenTimestamps calendar URLs**: operator named this during sovereign-mode exploration; lets sovereign operators run the full anchor loop against their own bitcoind. Real spec-extension work.
- **2026-05-24 — Custom remote-backup endpoint**: HTTP shape spec'd so an operator running their own server can point the wallet at it instead of Supabase. Bigger lift; pairs with sovereign-mode roadmap.
- **2026-05-24 — Sage persona authoring**: when the bot activation cut lands, operator writes the actual voice; Carpenter wires the shape.

Full entries in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
