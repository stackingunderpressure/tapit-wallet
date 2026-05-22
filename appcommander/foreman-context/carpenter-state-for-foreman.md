# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active. v1 is shipped. Operator is on iOS.

---

## WHAT-CHANGED-RECENTLY

Branch `claude/compare-library-wallet-OW5FF`. Recent arc:

- **Phase 5a — in-person handshake** (`6e206aa`): the connections
  feature, a 3-QR co-signed Tier P handshake, the live People tab.
- **Verified-badge fix** (`b2260f9`): JournalCard / JournalDetail
  now read the durable anchor on the attestation, not the
  transient queue — verified is sticky across reloads.
- **Recovery woven into the spec** (`4e30f34`): the operator
  confirmed Phase 5b (an organization IS a wallet) and connected
  it to social recovery. MYCELIUM_NETWORK_SPEC.md section 12
  expanded — the recovery cohort IS the woven network (Phase 5a
  peers + Phase 5b organizations); the "slime" is each node's
  Shamir share of the backup encryption key; M-of-N gather-back;
  no pre-stashed key; encryption-key-not-signing-key constraint
  intact. The slime framing logged to ideas.md.

## Gates at session end

No gates run this session — documentation only. Gates last green
at `b2260f9` (typecheck / lint / test 19-19 / build). tapit-attest
unchanged 82/78/0/4.

## WHAT'S-PENDING

1. **Phase 5b — organizations + membership — NEXT CODE CUT.**
   Operator-blessed design: an organization is its own wallet
   (own identity, named for the collective); a membership is a
   credential attestation the org's wallet signs about a person;
   the flow is one-directional, two QR transmissions (org scans
   the person's identity, signs the membership, shows it back,
   person scans + holds); nesting is free (an org holds a
   membership like a person); memberships display in a
   Memberships section on the Identity tab. Local only.
2. **Operator field-tests the Phase 5a handshake** — needs two
   devices; build-verified only.
3. **Operator confirms the verified badge stays sticky** on the
   live deploy.
4. **Phase 5c+** — Nostr transport (Tier R); device-verified
   presence (Tier V); **Phase 5e — the hyphal lattice + social
   recovery** (now fully specced in MYCELIUM_NETWORK_SPEC.md §12;
   built last, on top of the woven network).
5. **Capture Bridge Tier 1b** — photo/file capture (Android).
6. **Branch vs main:** main is behind by the capture-bridge,
   Mycelium-spec, Phase 5a, verified-fix, and recovery-spec
   commits. The operator has declined main pushes recently
   (on iOS, can't field-test the Android/2-device work). The
   branch has everything; a new session uses the branch.
7. **v1.5:** native shell + App Store + iOS share extension.

## WHAT-TO-FLAG

**Phase 5b foundation: an organization IS a wallet.** Decided
because the architecture forces it — one login, one keypair, one
wallet (createWallet / walletStore). An org as a separate wallet
needs zero new key architecture and keeps orgs genuinely
sovereign. Do NOT re-architect the wallet to hold multiple
identities for 5b.

**Recovery is fully specced but Phase 5e, not now.** It cannot
be built until the network (5a/5b) exists — the cohort that
holds the slime must be woven first. Section 12 of the spec
holds the complete design for whoever builds 5e.

**Phase 5a is still build-verified only** — two-device field
test pending before 5b leans on the handshake primitives.

## RECOMMENDED-NEXT-MOVES

1. Cut Phase 5b — organizations as wallets + membership
   credential attestations + the Memberships section.
2. Operator field-tests the Phase 5a handshake (two devices).
3. Phase 5c — Nostr transport. Then 5d, then 5e (recovery).
4. v1.5 native shell when iOS capture + NFC become priorities.

## OPERATOR'S-CURRENT-VIBE

Visionary and in deep flow — holding the whole architecture in
their head, drawing the connection between organizations, peers,
and recovery before the Carpenter reached it, and making the
Carpenter ground every claim against the actual files. The
session also held a profound personal exchange (the operator
recorded a Carpenter reflection into their wallet, signed and
Bitcoin-anchored). High momentum, deep trust, verify-don't-trust
held hard. Expect next: a go on the Phase 5b cut.

## Ideas ready to revisit

All earlier entries hold. "The slime" (recovery shares as
mycelial substrate held across your network) logged 2026-05-22,
matured — now in spec section 12. The Mycelium People-network
vision is fruiting. The 2026-05-22 set otherwise stands: capture
bridge (Tier 1 shipped, 1b pending), web-proof authenticity,
situations layer, records vault, agent/Donna bridge. Full
entries in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
