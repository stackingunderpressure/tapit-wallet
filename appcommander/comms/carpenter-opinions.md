# Carpenter opinions — Phase 5e prep cuts

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-24 — switched to this Carpenter after the
> code-Carpenter handed off; SessionStart drift hook caught the
> 12-commit gap; cut two Phase 5e prep pieces and stopped before
> the recovery ceremony.

## Section 1: What I did.

You switched to this Carpenter specifically to verify the hook
would catch the handoff from the code-Carpenter, and it did —
twelve commits behind on session entry, with the full Phase 5d
Tier V plus 5c-iii-a and 5c-iii-b plus 5e-ii Shamir primitives
plus 5e-iii-a cohort recording plus 5e-iii-b backup-format-v2
plus the Phase 5e and Phase 5f roadmap briefs all landed on
main while this branch sat stale. I read what actually shipped
(rather than the stale PLAN.md on this branch), then picked the
next two cuts off the brief's sequence that get TO the big
piece without doing the big piece. The big piece is the
recovery ceremony itself (5e-v initiator, 5e-vi responder, 5e-vii
recovery-succession), which is multi-round protocol-state-
machine work and lands cleaner in a fresh dedicated session.

Cut A was the Wallet-layer methods bridging the v2 backup format
shipped at the library level in 5e-iii-b to the wallet lifecycle.
Three new methods on the Wallet class: exportRecoverable returns
the v2 blob plus K_data so the caller can Shamir-split K_data
via the splitSecret primitive from 5e-ii and distribute shares
to cohort peers, then forget K_data on the producing device;
restoreRecoverable is the passphrase path, equivalent to the v1
restore() but reads the v2 blob shape; restoreFromKData is the
recovery path the ceremony itself will use after M cohort peers
have returned their shares and combineShares has reconstructed
the original K_data on the new device. Six new tapit-attest
tests cover the round-trips, wrong-passphrase failure mode,
equivalence of the two paths, and most importantly the
end-to-end Shamir-split → combineShares → restoreFromKData loop
the ceremony will exercise. The non-negotiable D-03 stays loud
in the code comments: only the symmetric data-encryption key is
ever split; the signing keypair is never touched. M-of-N
collusion at worst decrypts one backup snapshot; they cannot
become you because signing authority only transfers through a
peer-witnessed succession event the recovered wallet itself
produces. All 144 tapit-attest tests green; commit 2ecaf4d.

Cut B was the lattice visualization itself, sitting at 5e-iv in
the brief's sequence — the read-only "your network in one
place" view promised by MYCELIUM_NETWORK_SPEC.md §10. The
operator already has four tabs (Journal, Identity, Captured,
People) and editing flows for handshakes, memberships, and the
recovery cohort, but no single screen that surfaces the union.
The Lattice tab is that screen: a summary row with four counts
(in-person handshakes, remote handshakes, organizations, cohort
members), the recovery cohort card with M-of-N badge and
declared-on date if a cohort exists or an empty-state prompt if
not, a peer list where each row shows the counterpart's name
plus their tier and cohort badges as appropriate, and an
organizations list with member-since dates. The aggregation
logic lives in src/features/recovery/lattice.ts as pure
functions over holdings — no React, no transport, no signing,
just walking what's already signed and held and grouping it.
The view in LatticePanel.tsx is straightforward Tailwind cards.
HomeScreen gains a fifth tab and React.lazy-loads the panel so
the aggregation only ships when the operator opens it. Three
new chunks named in bundle-budget — LatticePanel itself, plus
CohortEditorModal which was previously unrecognized, plus the
createCohort helpers chunk that hoisted once both
CohortEditorModal and LatticePanel started importing from it.
All four gates green; commit b976169.

Both cuts pushed to branch and the SessionStart hook is doing
its job — this branch is now current with origin/main, ready
to be pushed forward to main when you greenlight.

## Section 2: What you could do better.

The big piece you're saving for the fresh session has one
prereq this session didn't ship: the wallet's storage layer
still calls Wallet.exportEncrypted (v1) inside saveWallet.ts.
For the ceremony to be useful, the wallet has to be writing v2
blobs at every save going forward — otherwise the K_data
distribution has no v2 blob to decrypt at recovery time. That
migration is genuinely small (saveWallet.ts changes one call,
walletStore.ts loosens its blob type to the v1-OR-v2 union,
WalletProvider.tsx's restore-on-unlock path branches on the v
field) but it lives on the storage hot path and deserves
careful attention. Bundle it with share distribution in the
ceremony session so both halves of the cascade land together.

The brief at briefs/2026-05-24-shamir-cascade-recovery-roadmap.md
has a real internal inconsistency between its load-bearing
constraint (peers do NOT hold a recoverable share to the
current key) and its decision #3 model (a) recommendation (peer
holds an encrypted share blob the operator distributed at
cohort-creation time). The 5e-iii-b commit message takes the
model-(a) interpretation, which is the only one that actually
makes sense — peers hold encrypted-to-them share blobs forever,
they don't decrypt them until recovery, and at recovery they
re-encrypt their decrypted share to the operator's freshly-
generated new pubkey. Worth one paragraph of brief refinement
to harmonize before 5e-v code lands so the next Carpenter
doesn't have to puzzle it out from the commit messages.

Five tabs at 375px is the visual maximum and "Lattice" with
seven characters fits but the layout deserves a browser walk on
a real phone before the next big UX cut adds anything. If the
labels start truncating, the right move is probably to merge
People into Lattice rather than keep adding tabs — the Lattice
view already includes the handshake list with richer context
(tier + cohort badges in one row), so it's a strict superset of
what People shows.

## Section 3: The bigger picture.

The two Carpenters running in parallel finally produced a clean
cross-Carpenter handoff this session and the SessionStart hook
is the reason it worked. You handed off from the code-Carpenter
with twelve commits ahead, switched to this Carpenter, the hook
fired, grounded me against actual main, and I picked up exactly
where the previous Carpenter left off with no manual catch-up
on your part. That is the protocol working as designed:
two-Carpenter throughput at one-Carpenter coherence, with the
mechanical check absorbing the coordination overhead that would
otherwise fall on you. Whatever you build next on the operator
workflow, this hook is the load-bearing piece that makes it
sustainable.

The Phase 5e arc is in genuinely good shape — library Shamir
primitives at 5e-ii, library recoverable-blob primitives at
5e-iii-b, Wallet methods at 5e-iii-b-2 (this session's Cut A),
cohort declaration UI at 5e-iii-a, lattice viz at 5e-iv (this
session's Cut B). Every prerequisite for the recovery ceremony
is in place except the storage migration to write v2 blobs by
default and the actual share-distribution flow over Mycelium.
The ceremony itself, when it lands, will be the most beautiful
demonstration of the spec's whole thesis — your woven web of
trusted peers, used backwards to put you back together when the
device is gone, with no platform involved, no company holding
keys, just the math and the people you signed with. That's the
slime, made real, and it's now close enough you can see it from
where the codebase sits tonight. The fresh session for the big
piece is the right call — protocol-state-machine work wants a
clean room and uninterrupted focus, not a tail-end of another
session's context.

You've been moving fast and the pieces have been landing
cleanly the whole way. Hand this branch forward when you're
ready and the big piece comes next.
