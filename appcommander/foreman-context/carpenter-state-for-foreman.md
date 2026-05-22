# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

## WHAT-CHANGED-RECENTLY

Five sub-cuts landed in one session this round, closing the full remote co-sign loop end-to-end and verifying NIP-44 interop.

**5c-i-ε — auto-routing (`19e2e90`)**: Optional `incoming?: Attestation` prop added to `AbsorbCosignModal` and `CosignAsWitnessModal`. The inbox panel grew routing logic (1-sig handshake → cosign-witness; 2-sig handshake → absorb-cosign) and an Open button per row. `HomeScreen` tracks routing state and mounts a second instance of each modal that takes the incoming envelope.

**NIP-44 reference vectors (`a4c8f23`)**: Snapshotted the upstream `paulmillr/nip44` v2 vectors to `tapit-attest/test/fixtures/nip44-v2-vectors.json` and added a test that runs every encrypt_decrypt vector through `decryptFrom`. 10/10 pass — tapit-attest's NIP-44 v2 implementation is spec-conformant for cross-implementation interop.

**5c-i-ζ — Send-back-via-Nostr (`b4642a2`)**: `WalletContext` exposes `sendEnvelope(recipientPubkey, envelope)`. `WalletProvider` holds the live transport in a ref so `sendEnvelope` can reach it from outside the connect effect, and dynamically imports the inbox helper to keep code-split benefits. `InboxPanel` passes the `senderPubkey` through the routing chain; `CosignAsWitnessModal` takes an `incomingSender` prop and renders a Send-back-via-Nostr button on the signed step. Same session also tightened the round-trip-test `flush()` race (4 macrotask cycles instead of 1; 3/3 clean).

**5c-i-η — Send-via-Nostr in CosignRequestModal (`88bc6f1`)**: Outbound initiation. Modal gains a Send-via-Mycelium section (hidden when toggle is off) with a recipient pubkey input + Send button calling `sendEnvelope`. The full Alice→Bob→Alice remote co-sign loop now runs without copy-paste.

**5c-i-θ — peer picker (`d18c317`)**: New shared component `connections/PeerPicker` walks holdings, recovers peer pubkeys from handshake leaves, renders one-tap recipients with a manual-paste fallback. `CosignRequestModal`'s Send-via-Mycelium block swaps its raw input for `<PeerPicker>`. The picker is exported for the future membership-issue and remote-handshake flows.

All eight gates green at every cut. tapit-attest 98/98 (4 skipped network-deps, now includes the new vector test). Wallet 31/31 (3/3 clean across consecutive runs). Bundle-budget grew named entries for `encryptedInbox helper`, `AbsorbCosignModal`, `createHandshake helpers`; `WalletProvider` budget bumped 5.5 → 7 KB gz for headroom.

## WHAT'S-PENDING

Branch is now **11 commits ahead of main** with the complete 5c-i slice plus the NIP-44 interop proof. All commits are pure additions, each independently safe and tested. Ready to land on main as one coherent slice when the operator says the word.

Next-cut candidates on the queue:
- **5c-i-ι — membership auto-receive**: when an inbox envelope is a credential with `credential_type=membership`, hold + save + anchor without operator paste. Parallel to handshake auto-routing.
- **5c-i-κ — Send-via-Nostr in MembershipModal**: organization issues a membership remotely instead of via QR. Can reuse `PeerPicker`.
- **5c-ii — remote handshakes (Tier R)**: the first genuinely new feature beyond 5c-i; a handshake conducted entirely over the network, labelled Tier R per D-09.
- **Settings UI for custom relay list**: replace the hard-coded `DEFAULT_RELAYS` with an operator-editable preference. Sovereign-user move per D-11a.
- **Delivery confirmation layer (5c-iii adjacent)**: today the Send button flips to "Sent" once the local publish resolves; the Nostr OK frame is observed and discarded. Real delivery-ack arrives with 5c-iii.

Operator field test of the full remote loop with two real devices is the natural next smoke test — possible now that the toggle, the routing, the send/respond paths, and the spec interop are all in place.

## WHAT-TO-FLAG

Two things to keep visible.

The Send-via-Nostr UI in `CosignRequestModal` sits below the textarea + QR-show; on phone screens operators might not scroll. A polish cut could promote it above the manual share/copy block when the toggle is on. Today it works; tomorrow it could be more discoverable.

Today's sent-state UX flips to "Sent" once the local publish call resolves — that confirms dispatch to the WebSocket, not relay acceptance. The Nostr OK frame is currently observed and discarded. Real delivery ack is a 5c-iii concern.

`current.json` at confidence 90. Uncertainty: full remote loop unit-tested via fake transport + injected fake WebSocket, but not yet exercised against real public relays. Two-device field test is the first real-world evidence.

## RECOMMENDED-NEXT-MOVES

Two-step recommendation:
1. **Operator authorizes push to main** — 11 commits is meaningful surface; one push closes the branch-divergence cleanly. The slice is self-contained and reversible via `git revert <range>` if anything surprises in field test.
2. **Operator picks the next cut**: 5c-i-ι (membership auto-receive) and 5c-i-κ (membership send) round out the same routing template the cosign flow now uses. 5c-ii (remote handshakes) opens the next genuinely new feature. Settings UI for custom relays is the smallest of the three and sets up the privacy-conscious "swap-in your own relays" move D-11a promised.

The Carpenter's vote between (b)-(c)-(d): 5c-i-ι followed by 5c-ii. Reusing the routing template once more keeps the code surface coherent, and then 5c-ii becomes a feature cut that builds on a known pattern rather than inventing a new one.

## OPERATOR'S-CURRENT-VIBE

Last operator message: "Continue on and if you need anything for me, give me a couple of chips if not continue on re-grounding and until we run out of things to do or you need me to do something physically." Maximum-trust, momentum-protecting authorization. Has been paying off — five cuts in one session, no operator intervention required, every gate green, every commit a complete unit.

The operator is at the moment when their wallet's network functionality is real but they have not yet flipped the switch in their own use. The next natural piece of physical-world feedback is a two-device field test. That requires them physically — both phones, both connected to relays, both with the toggle on, and one initiating a co-sign that the other receives. That smoke test is what unblocks operator confidence in the entire 5c-i slice.

## Ideas ready to revisit

NIP-44 reference-vector verification — **DONE this session**. 10/10 vectors spec-conformant. Cross-the-implementation-boundary confidence is real now.

Sign-in-with-existing-Nostr-account — the natural moment to surface is 5c-ii's remote handshake, when "your Nostr identity" framing becomes user-visible UX. Still in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.

Wallet as a hardware-backed object — the architecture is still ready. The Wallet class owns the keypair as JS `#private` and exposes signing methods rather than the key. A future hardware backend (secure element, passkey-derived) slots in behind the same interface. Not urgent; worth keeping on the long horizon.

Connection-picker UI — **DONE this session** (PeerPicker). Reusable in future Send-via-Nostr flows.

Delivery confirmation — NEW idea worth logging. Today's Sent state confirms WebSocket dispatch, not relay acceptance or recipient pull. A real delivery-ack layer arrives with 5c-iii but worth thinking about UI shape now (pending / dispatched / acknowledged / read).
