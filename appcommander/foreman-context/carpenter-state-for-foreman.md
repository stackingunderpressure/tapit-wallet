# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active. v1 is shipped. Operator is on iOS.

---

## WHAT-CHANGED-RECENTLY

Branch `claude/compare-library-wallet-OW5FF`; branch and main in
sync as of `9588fea` (the latest commits `7d4bcaa` / `dbd6ce6`
are branch-only — small decision-recording, push to main with
the next code cut). Recent arc:

- **Phase 5a — in-person handshake** (`6e206aa`).
- **Verified-badge fix** (`b2260f9`).
- **Recovery woven into spec §12** (`4e30f34`).
- **Phase 5b — organizations + membership** (`85d6a51`).
- **Org-key governance + Phase 5f + Phase 5c sketch**
  (`c655526`).
- **Phase 5c design questions resolved — D-11** (`7d4bcaa`,
  `dbd6ce6`): the operator answered the two genuine chips —
  relays are a default, replaceable set; the in-person handshake
  bootstraps the remote channel. The two technical questions
  were settled from doctrine — custom encrypted Nostr event
  kinds carry the tapit-attest envelope; the wallet key is
  reused as the Nostr identity. Phase 5c is now fully designed.

## Gates at session end

No gates run — documentation only. Gates last green at `85d6a51`
(Phase 5b). tapit-attest unchanged 82/78/0/4.

## WHAT'S-PENDING

1. **Cut Phase 5c-i — NEXT CODE CUT.** The transport-agnostic
   interface + a minimal Nostr client + encrypted async peer
   delivery. Design fully locked (D-11; sketch
   briefs/2026-05-22-phase-5c-nostr-transport-sketch.md). One
   build-architecture choice to make when cutting: a minimal
   hand-rolled Nostr transport reusing tapit-attest keys vs a
   Nostr library — lean minimal, since the protocol is small and
   the crypto is already owned. 5c-i is plumbing — no immediate
   visible surface.
2. **Operator field-tests 5a + 5b** with two devices —
   build-verified only.
3. **Phase 5c-ii** (remote Tier R handshakes), **5c-iii**
   (connection sync), then **5d** (device-verified presence),
   **5e** (hyphal lattice + recovery), **5f** (quorum org keys).
4. **Capture Bridge Tier 1b** — photo/file capture (Android).
5. **v1.5:** native shell + App Store + iOS share extension.

## WHAT-TO-FLAG

**Phase 5c is fully designed.** All four design questions are
resolved (D-11). The next cut, 5c-i, is the first genuine
networking infrastructure in the wallet — and the first cut that
is plumbing rather than a visible feature. The encrypt-
everything-on-relays rule is non-negotiable: a relay must never
see a plaintext connection.

**Chip discipline held.** Of the four Phase 5c questions, only
two cost the operator a tap; the other two were decided from
doctrine. That is the operator's own "chip only where genuinely
needed" rule, applied.

**5a/5b remain build-verified only** — two-device field test
pending before later increments lean hard on them.

## RECOMMENDED-NEXT-MOVES

1. Cut Phase 5c-i (transport interface + encrypted async
   delivery).
2. Operator field-tests handshake + membership (two devices).
3. Then 5c-ii / 5c-iii, 5d, 5e, 5f in sequence.

## OPERATOR'S-CURRENT-VIBE

High-trust, high-momentum, decisive. Asked for the Phase 5c
sketch read back as bullets (listens via TTS) and the open
questions as chips, answered both chips fast, and wants to keep
moving — "we'll just get this right on down the road." The
operator extends real autonomy and expects the Carpenter to
filter chips, ground, and cut. Expect a go on Phase 5c-i.

## Ideas ready to revisit

All earlier entries hold. Org-key governance is in spec §6
(phased 5f); "the slime" recovery framing is in §12; Phase 5c is
designed (D-11). The Mycelium People-network vision is fruiting —
5a and 5b built, 5c designed. The 2026-05-22 set otherwise
stands: capture bridge (Tier 1 shipped), web-proof authenticity,
situations layer, records vault, agent/Donna bridge. Full
entries in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
