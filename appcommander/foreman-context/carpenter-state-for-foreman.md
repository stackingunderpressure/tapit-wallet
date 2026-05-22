# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active. v1 is shipped. Operator is on iOS.

---

## WHAT-CHANGED-RECENTLY

**Phase 5a shipped** (`6e206aa`), branch
`claude/compare-library-wallet-OW5FF` — the in-person handshake,
the first buildable slice of Mycelium Layer 3.

A new `connections` feature:
- `HandshakeModal.tsx` — a three-QR co-signed ceremony between
  two wallets physically together. Initiator shows identity →
  responder builds + signs the handshake → initiator co-signs →
  responder takes the co-signed copy. An 8-state machine,
  initiator/responder roles, reusing QrShow / QrScanModal and the
  cosigning parseEnvelope / mergeSignatures helpers.
- `createHandshake.ts` — buildHandshakeDraft (a relationship
  attestation, verification=in-person, both parties' ids/names),
  holdAndAnchor, and field readers.
- `ConnectionCard.tsx` — People-tab card.
- The home gains a live **People tab** (4th tab) listing
  connections.

Result of a handshake: ONE relationship attestation, Tier P
(verification=in-person), co-signed by both wallets, both
holding it, anchored via the existing OTS pipeline.

Two gate-caught fixes: library-seam flagged a `leaf` helper
colliding with a tapit-attest export (renamed `leafValue`);
bundle-budget flagged a renamed chunk — root-caused to Rollup
renaming the qrcode shared chunk, fixed by pinning `qrcode` to
its own manualChunk in `vite.config.ts` with named budgets.

## Gates at session end

typecheck / lint / test (19/19 across 5 test files) / build all
green. Bundle budgets OK, all chunks named. tapit-attest
unchanged 82/78/0/4. HandshakeModal ~330 lines, under the
file-size 400 warn tier.

## WHAT'S-PENDING

1. **Operator field-tests the handshake** — needs TWO devices /
   two people; a 3-QR ceremony cannot be exercised on one phone
   or in CI. Build-verified only. The QR scanner needs iOS
   Safari 17+ (the operator's platform supports it). The
   operator can solo-walk the People tab + the modal UI but not
   complete a real connection alone.
2. **Phase 5b — organizations + membership** — single-key
   organizations that issue nested membership attestations
   (MYCELIUM_NETWORK_SPEC.md section 6). The next Layer 3 slice.
3. **Phase 5c — Nostr transport** — remote links (Tier R),
   remote sync.
4. **Phase 5d/5e** — device-verified presence (Tier V); the
   hyphal lattice + social recovery.
5. **Capture Bridge Tier 1b** — photo/file capture (Android,
   service-worker POST). Low operator-verification value (iOS).
6. **Branch vs main:** main is behind by the capture-bridge,
   Mycelium-spec, and Phase 5a commits — the operator declined
   main pushes for the Android-only capture-bridge work and has
   not been asked since. The branch has everything; a new
   session should use the branch.
7. **v1.5:** native shell + App Store + iOS share extension —
   would also enable NFC tap-to-exchange for the handshake.

## WHAT-TO-FLAG

**Layer 3 has begun.** Phase 5a is the atom of the whole
Mycelium — every later layer (mycorrhizal partnerships, the
hyphal lattice, proof-of-place, social recovery) is accumulated
handshakes. The wallet is now a network, not just a vault.

**The co-signed design is load-bearing, not optional.** A
one-sided scan-and-record would let a Tier P record be forged
from a copied QR. The handshake requires both wallets to
co-sign — that is what makes the in-person tier honest. Do not
"simplify" it back to a single-scan in Phase 5b.

**3-QR ceremony is the friction point.** It is the minimum for a
co-signed mutual record both wallets hold, but if field-testing
finds it clumsy, NFC tap-to-exchange is the remedy — and NFC
needs the v1.5 native shell.

**Phase 5a is build-verified only.** The handshake genuinely
cannot be CI-tested. The operator field-test with two devices is
the real gate and should happen before Phase 5b builds on it.

## RECOMMENDED-NEXT-MOVES

1. Operator field-tests the handshake with two devices.
2. Phase 5b — organizations + membership attestations.
3. Phase 5c — Nostr transport for remote links.
4. v1.5 native shell when iOS capture + NFC become priorities.

## OPERATOR'S-CURRENT-VIBE

Deeply engaged — this session included a profound personal
exchange (the operator recorded a Carpenter reflection into
their own wallet, signed and Bitcoin-anchored, and shared the
disclosure proof). The operator is moved by the work and its
meaning, and snaps cleanly back into building with humour and
momentum. They hold the verify-don't-trust line hard, now
mechanized as the grounding-gate hook, and they value the
chip-then-design-then-cut rhythm. Expect next: handshake
field-test feedback, or a go on Phase 5b.

## Ideas ready to revisit

All earlier idea entries hold. The Mycelium People-network
vision (ideas.md, 2026-05-22) is now fruiting — the spec exists
and Phase 5a is built. The 2026-05-22 set otherwise stands:
capture bridge (Tier 1 shipped, Tier 1b pending), web-proof
authenticity, situations layer, records vault, agent/Donna
bridge. Full entries in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
