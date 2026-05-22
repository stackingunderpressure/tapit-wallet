# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active. v1 is shipped. Operator is on iOS. Operator
stepped away mid-session and granted autonomy to continue.

---

## WHAT-CHANGED-RECENTLY

Branch `claude/compare-library-wallet-OW5FF`; **branch and main
are in sync** as of this session (operator asked for a main
push). Recent arc:

- **Phase 5a — in-person handshake** (`6e206aa`).
- **Verified-badge fix** (`b2260f9`).
- **Recovery woven into spec §12** (`4e30f34`).
- **Phase 5b — organizations + membership** (`85d6a51`).
- **Org-key governance + Phase 5f + Phase 5c sketch**
  (`c655526`): MYCELIUM_NETWORK_SPEC.md §6 gained the
  organization-key governance model (everyday issuance = fast
  sign-now-ratify-later co-signing; constitutional acts = M-of-N
  threshold; in the quorum model there is no single org key to
  steal). §14 gained Phase 5f (quorum-controlled org keys);
  PLAN.md updated to 5a-5f. A Phase 5c (Nostr transport) design
  sketch was written —
  `briefs/2026-05-22-phase-5c-nostr-transport-sketch.md`.

## Gates at session end

No gates run — documentation only. Gates last green at
`85d6a51` (Phase 5b: typecheck / lint / test 19-19 / build).
tapit-attest unchanged 82/78/0/4.

## WHAT'S-PENDING

1. **Operator reviews the Phase 5c sketch** — it carries four
   open questions (relays; event shapes / NIP-46 vs custom
   kinds; addressing; identity reuse) and a 5c-i/ii/iii slicing.
   Phase 5c was sketched, not solo-built, because Nostr
   transport has genuine forks and the operator was away.
2. **Cut Phase 5c-i** once the sketch is blessed — the transport
   interface + a Nostr client + encrypted async peer delivery.
3. **Operator field-tests 5a + 5b** with two devices —
   build-verified only; cannot be CI-tested.
4. **Phase 5d** (device-verified presence), **5e** (hyphal
   lattice + recovery), **5f** (quorum org keys) follow.
5. **Capture Bridge Tier 1b** — photo/file capture (Android).
6. **v1.5:** native shell + App Store + iOS share extension.

## WHAT-TO-FLAG

**Branch and main are in sync** as of `c655526` — the operator
asked for the main push this session after declining several
earlier ones.

**Phase 5c is the forkiest remaining phase.** It was
deliberately sketched, not built, while the operator was away —
solo-cutting a networking feature with four open forks is the
un-grounded move the discipline guards against. The sketch is
ready to bless.

**Org governance is fully specced (§6, Phase 5f) but not
built.** Phase 5b shipped single-key organizations; the quorum
model is 5f. The everyday-issuance half (sign-now-ratify-later)
needs no new cryptography — it is the existing co-sign
machinery; only the M-of-N constitutional half needs FROST /
MuSig2.

**5a/5b remain build-verified only** — two-device field test
pending.

## RECOMMENDED-NEXT-MOVES

1. Operator reviews + blesses the Phase 5c sketch.
2. Cut Phase 5c-i (transport interface + async peer delivery).
3. Operator field-tests handshake + membership (two devices).
4. Then 5c-ii/iii, 5d, 5e, 5f in sequence.

## OPERATOR'S-CURRENT-VIBE

Visionary, high-trust, in flow. Asked a deep organization-key
governance question, got the answer, told the Carpenter to spec
it and continue autonomously while they attended to something
else — "I'll check again after." This is the operator extending
real autonomy. The Carpenter spent it conservatively: the
approved spec work plus a sketch of the forky next phase, not a
solo big build. Expect the operator to return, review the 5c
sketch, and either bless it or adjust the autonomy latitude.

## Ideas ready to revisit

All earlier entries hold. Org-key governance (the issuance/
constitutional split) is now in spec §6 and phased as 5f. "The
slime" recovery framing is in §12. The Mycelium People-network
vision is fruiting — 5a and 5b built, 5c sketched. The
2026-05-22 set otherwise stands: capture bridge (Tier 1
shipped), web-proof authenticity, situations layer, records
vault, agent/Donna bridge. Full entries in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
