# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

## WHAT-CHANGED-RECENTLY

Phase 5c is structurally complete. Branch and main both at `93afbc4`. Across this session ten cuts + a polish landed:

- **5c-i-ε** auto-routing — inbox routes a 1-sig handshake to cosign-witness, a 2-sig to absorb-cosign
- **NIP-44 reference vectors** — 10/10 upstream spec vectors round-trip through `decryptFrom`; cross-implementation interop proved
- **5c-i-ζ** Send-back-via-Nostr — CosignAsWitnessModal signs and ships the counter-signed envelope back to the original sender
- **5c-i-η** Send-via-Nostr in CosignRequestModal — outbound initiation of the co-sign loop
- **5c-i-θ** PeerPicker — shared component that surfaces handshake peers from holdings with a manual-paste fallback
- **5c-i-ι** Membership auto-receive — incoming membership credential addressed to the operator gets an Accept button that runs verify-and-hold inline
- **5c-i-κ** Send-via-Nostr in MembershipModal's issue-show step — organization can issue a membership remotely (recipient pubkey lives in the signed memberId leaf)
- **5c-i-λ** Custom relay list in Settings — operator-editable preference, takes effect immediately on the next reconnect (memoized stable dep key on the transport effect)
- **5c-ii** Tier R remote handshakes — initiator builds + signs + sends via Nostr; responder's wallet auto-routes via 5c-i; both wallets converge on the dual-signed Tier R envelope; ConnectionCard renders the tier badge honestly
- **Auto-dismiss polish** — successful absorb or Send-back dismisses the matching inbox row; cancellation paths don't

The full remote co-sign loop (Alice initiates from CosignRequestModal → Bob's wallet auto-routes → Bob signs and Send-backs → Alice's wallet auto-routes to absorb) now runs end-to-end without copy-paste. Same for membership issue/receive. Same for Tier R handshake.

All eight gates green at every checkpoint. tapit-attest 98/98 (4 skipped network-deps). Wallet 31/31. Bundle budgets named the new hoisted chunks: `encryptedInbox helper`, `AbsorbCosignModal`, `createHandshake helpers`, `defaultRelays constant`, `PeerPicker`; `WalletProvider` bumped 5.5 → 7 KB gz to carry the sendEnvelope plumbing with headroom.

## WHAT'S-PENDING

Phase 5c has one piece left:

**5c-iii — multi-device connection sync + delivery acks.** Two things bundled: (a) the wallet's other devices stay current with each other over the Mycelium transport (today they only sync through Supabase's encrypted blob); (b) the Sent state stops flipping on local-dispatch and waits for the relay OK frame, so the operator knows their message actually landed.

After 5c-iii, Phase 5 has the bigger pieces queued:

- **Phase 5d** Tier V device-verified presence — biometric (WebAuthn / passkey) + geolocation + timestamp, signed
- **Phase 5e/5f** quorum org-key governance (MAST / MuSig2 / FROST) and recovery-share workflows

## WHAT-TO-FLAG

Three things worth keeping visible.

**Real-relay round-trip is the open question.** Every remote loop has been unit-tested through FakeTransport + injected fake WebSocket. The first two-device field test against `wss://relay.damus.io` (or any default relay) is the first real evidence. Likely surprises if any: a relay rejecting custom event-kind 9573, or iOS Safari blocking WebSocket connections in PWA mode. Both are recoverable; both inform the next cut.

**Tier R responder name is operator-supplied today.** PeerPicker covers the natural case (extending Tier R to someone you already handshook with in person). For pasting a stranger's pubkey, the operator types the name and that name lands in the signed envelope. Honest about the tier, but a future polish could fetch the responder's identity attestation over Nostr before signing.

**Sent ≠ delivered today.** The current Sent state means "dispatched to the WebSocket." A delivery-ack layer arrives with 5c-iii (relay OK frame is currently observed and discarded by NostrTransport). The auto-dismiss polish is honest about this — the inbox row goes away because the operator finished their part, not because the recipient has accepted.

`current.json` at confidence 90. Bundle budget on WalletProvider is now generous; further additions there should be fine without another bump until 5c-iii's delivery-ack layer adds state.

## RECOMMENDED-NEXT-MOVES

Three paths, in order of likely value:

1. **Field test the full 5c stack with two devices.** Open Settings, flip the Mycelium toggle on both phones, do a Tier P handshake in person (so each has the other's pubkey + name in their People tab), then walk to different rooms and exercise: Alice tap Request-a-co-sign on a journal entry, pick Bob, Send via Nostr; Bob sees Accept in his inbox, reviews, signs, taps Send-back; Alice sees Absorb in her inbox, taps Absorb. Repeat for membership and Tier R handshake. The first such test produces real-relay evidence and informs whether 5c-iii is urgent.

2. **Cut 5c-iii.** Multi-device sync + delivery acks. Smaller than it sounds — the Nostr OK frame is already observed and discarded, so wiring it into a delivery state takes one cut. Multi-device sync is the bigger half.

3. **Cut Phase 5d Tier V.** Bigger new feature. Needs WebAuthn integration and Geolocation API; honest tier label, signed envelope per D-09.

The Carpenter's vote: option 1 (operator runs the field test), then option 2 if the field test reveals delivery-ack gaps, then option 3 as the next major increment.

## OPERATOR'S-CURRENT-VIBE

Last operator message: "Continue on and if you need anything for me, give me a couple of chips if not continue on re-grounding and until we run out of things to do or you need me to do something physically." Maximum-trust, momentum-protecting authorization. The chips check-in halfway through gave them control over the slice-to-main and the next-cut choice; they picked 5c-i-ι, then 5c-ii, and let everything else run on the momentum. Result: Phase 5c is essentially done in one session.

The wallet they wanted, the operator now has. The remaining honest unknown is what real relays do with our traffic — only physical-device testing answers that. That is genuinely the next thing the operator needs to do that the Carpenter cannot do remotely.

## Ideas ready to revisit

- **NIP-44 reference vectors** — DONE this session. 10/10 spec vectors round-trip clean. Cross-implementation interop proved.
- **Sign-in-with-existing-Nostr-account** — natural moment is now or just after the first field test, since "your Nostr identity" framing is increasingly visible.
- **Delivery confirmation UI** — flagged this session, becomes the 5c-iii cut.
- **Tier R responder identity fetch** — polish for after field test; today's name-as-typed is honest about the tier.
- **Wallet as hardware-backed object** — architecture still ready (Wallet class owns `#keypair`; the day a secure-element / passkey backend lands, it slots in behind the same interface). Long horizon; not actionable today.
