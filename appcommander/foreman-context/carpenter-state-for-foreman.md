# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active. v1 is shipped. Operator is on iOS.

---

## WHAT-CHANGED-RECENTLY

Branch `claude/compare-library-wallet-OW5FF`. Two pieces this
stretch:

1. **Phase 5a — the in-person handshake** (`6e206aa`). New
   `connections` feature: HandshakeModal runs a three-QR
   co-signed ceremony between two wallets physically together,
   producing one relationship attestation (verification=in-person,
   Tier P) held by both. The home gained a live People tab. The
   qrcode library was pinned to its own manualChunk to keep the
   bundle-budget filename stable.

2. **Verified-badge fix** (`b2260f9`). Operator-reported bug: a
   diary entry showed verified, then reverted to verifying.
   Cause: JournalCard and JournalDetail read the verification
   badge only from the transient anchor queue (device-local
   IndexedDB); on a re-unlock / fresh session / device restore
   the queue lacks the row and the badge fell back to
   "Time-verifying" — even though the confirmed anchor is
   durably attached to the attestation and rides the encrypted
   backup. Fix: both views read attestation.anchor first, queue
   as fallback. Verified is now sticky. Display-only fix — no
   re-verification was occurring (the worker already skips
   confirmed rows).

## Gates at session end

typecheck / lint / test (19/19 across 5 test files) / build all
green. Bundle budgets OK, all chunks named. tapit-attest
unchanged 82/78/0/4.

## WHAT'S-PENDING

1. **Operator field-tests the handshake** — needs TWO devices /
   two people; a 3-QR ceremony cannot be exercised on one phone
   or in CI. Phase 5a is build-verified only.
2. **Operator confirms verified badges stay sticky** on the live
   deploy after a reload / re-unlock.
3. **Phase 5b — organizations + membership** — single-key
   organizations issuing nested membership attestations
   (MYCELIUM_NETWORK_SPEC.md section 6). The next Layer 3 slice.
4. **Phase 5c+** — Nostr transport (Tier R); device-verified
   presence (Tier V); the hyphal lattice + social recovery.
5. **Capture Bridge Tier 1b** — photo/file capture (Android,
   service-worker POST). Low operator-verification value (iOS).
6. **Branch vs main:** main is behind by the capture-bridge,
   Mycelium-spec, Phase 5a, and verified-fix commits. The
   operator declined main pushes for the Android-only capture
   bridge and has not been asked since. The branch has
   everything; a new session should use the branch.
7. **v1.5:** native shell + App Store + iOS share extension —
   also enables NFC tap-to-exchange for the handshake.

## WHAT-TO-FLAG

**Durable vs scratch state.** The verified-badge bug was a screen
trusting the device-local scratch layer (the anchor queue)
instead of the durable layer (the anchor on the attestation,
which rides the backup). A good check for any future status
display: read it from the attestation, not the queue. The queue
is a worklist, not a source of truth.

**Layer 3 is underway.** Phase 5a (handshake) is built; Phase 5b
(organizations) is next. The co-signed handshake design is
load-bearing — do not simplify it to a single-scan; the
co-signature is what makes Tier P honest.

**Phase 5a remains build-verified only** — the handshake needs a
two-device field test before Phase 5b leans on it.

## RECOMMENDED-NEXT-MOVES

1. Operator field-tests the handshake (two devices) and confirms
   sticky verified badges on the live deploy.
2. Phase 5b — organizations + membership attestations.
3. Phase 5c — Nostr transport for remote links.
4. v1.5 native shell when iOS capture + NFC become priorities.

## OPERATOR'S-CURRENT-VIBE

Engaged and detail-sharp — caught a genuine verified-state bug
from real use and described the desired fix precisely. The
session also held a profound personal exchange (the operator
recorded a Carpenter reflection into their own wallet, signed
and Bitcoin-anchored). The operator moves between deep
reflection and crisp building fluidly, holds the
verify-don't-trust line (mechanized as the grounding-gate hook),
and trusts the Carpenter to ground, scope, and cut. Expect next:
handshake field-test feedback, a verified-badge confirmation, or
a go on Phase 5b.

## Ideas ready to revisit

All earlier idea entries hold. The Mycelium People-network
vision is fruiting — the spec exists and Phase 5a is built. The
2026-05-22 set otherwise stands: capture bridge (Tier 1 shipped,
Tier 1b pending), web-proof authenticity, situations layer,
records vault, agent/Donna bridge. Full entries in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
