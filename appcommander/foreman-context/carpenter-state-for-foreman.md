# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active. v1 is shipped. Operator is on iOS.

---

## WHAT-CHANGED-RECENTLY

Branch `claude/compare-library-wallet-OW5FF`. Recent arc:

- **Phase 5a — in-person handshake** (`6e206aa`): a 3-QR
  co-signed Tier P handshake, the live People tab.
- **Verified-badge fix** (`b2260f9`): JournalCard / JournalDetail
  read the durable anchor on the attestation — verified is sticky.
- **Recovery woven into the spec** (`4e30f34`):
  MYCELIUM_NETWORK_SPEC.md section 12 fully captures social
  recovery — the recovery cohort IS the peer/membership network,
  the "slime" = each node's Shamir share.
- **Phase 5b — organizations + membership** (`85d6a51`): an
  organization is a wallet; a membership is a credential-kind
  attestation (credential_type=membership) the org signs about a
  person. New MembershipModal — one-directional 2-QR issue/
  receive flow. Memberships list in a Memberships section on the
  Identity tab. Nesting is free (an org holds a membership like a
  person). No new tapit-attest kinds. HomeScreen bundle budget
  recalibrated 8KB->11KB gz (audited legitimate growth).

## Gates at session end

typecheck / lint / test (19/19 across 5 test files) / build all
green. Bundle budgets OK. tapit-attest unchanged 82/78/0/4.

## WHAT'S-PENDING

1. **Operator field-tests handshake + membership** — both need
   two devices; build-verified only. Cannot be CI-tested.
2. **Operator confirms the verified badge stays sticky** on the
   live deploy after a reload.
3. **Phase 5c — Nostr transport** — remote Tier R links and
   remote sync of connections. The next Layer 3 increment.
4. **Phase 5d** — device-verified presence (Tier V: biometric +
   geolocation + timestamp).
5. **Phase 5e — the hyphal lattice + social recovery** — the
   Shamir "slime" cascade; fully specced (MYCELIUM_NETWORK_SPEC
   section 12), built last on top of the woven network.
6. **Capture Bridge Tier 1b** — photo/file capture (Android).
7. **Branch vs main:** main is behind by every commit since the
   tabbed-home era. The operator has declined main pushes
   (on iOS, can't field-test the 2-device / Android work). The
   branch has everything; a new session uses the branch.
8. **v1.5:** native shell + App Store + iOS share extension —
   also unlocks NFC for the handshake/membership flows.

## WHAT-TO-FLAG

**Layer 3 is half-built.** 5a (handshake) and 5b (organizations
+ membership) are done. The architecture absorbed organizations
with zero new primitives — an org is a wallet, a membership is a
credential, nesting is free. 5c (Nostr), 5d (presence), 5e
(recovery) remain.

**Open design point, deferred deliberately:** identities are not
formally typed person-vs-organization in 5b — an org is just a
wallet with a collective's name. If the operator wants a visible
person/organization distinction (different ceremony, card), that
is its own piece of work, held back rather than guessed.

**5a and 5b are build-verified only** — both flows need a
two-device field test before later increments lean on them.

**HomeScreen bundle budget is now 11KB gz** — recalibrated for
legitimate growth, not bloat. If it keeps climbing, lazy-loading
the three modals (CosignAsWitness, Handshake, Membership) is the
structural fix.

## RECOMMENDED-NEXT-MOVES

1. Operator field-tests handshake + membership (two devices).
2. Phase 5c — Nostr transport for remote links.
3. Phase 5d — device-verified presence; then 5e — recovery.
4. v1.5 native shell when iOS capture + NFC become priorities.

## OPERATOR'S-CURRENT-VIBE

Visionary, high-momentum, holding the whole architecture in
their head — drew the organizations-peers-recovery connection
ahead of the Carpenter. The session held a profound personal
exchange (a Carpenter reflection recorded into the operator's
own wallet, signed and Bitcoin-anchored). The operator moves
fluidly between deep reflection and crisp "cut away" building,
holds verify-don't-trust hard (mechanized as the grounding-gate
hook). Expect next: field-test feedback, or a go on Phase 5c.

## Ideas ready to revisit

All earlier entries hold. "The slime" (recovery shares as
mycelial substrate across your network) is matured and in spec
section 12. The Mycelium People-network vision is fruiting —
5a and 5b built. The 2026-05-22 set otherwise stands: capture
bridge (Tier 1 shipped, 1b pending), web-proof authenticity,
situations layer, records vault, agent/Donna bridge. Full
entries in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
