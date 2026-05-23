# Carpenter opinions — Phase 5e substrate + distribution

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-24 — "see where we are and let's cut." Three
> substantial cuts shipping the Phase 5e substrate, stopping at the
> ceremony boundary.

## Section 1: What I did.

This was the cut-the-substrate session. The SessionStart hook
confirmed no drift on entry; the prior session's foreman handoff
named the big piece as the recovery ceremony bundled with the
storage migration and share distribution; the operator said "let's
cut" and I shipped three layered cuts that get every prerequisite
in place without doing the ceremony state machine itself.

Cut 1 (commit 8ea9393) was the storage migration to v2 with K_data
reuse, which is more subtle than it sounds. The v2 backup format
shipped at the library level in 5e-iii-b separates the symmetric
data-encryption key K_data from the passphrase — K_data is freshly
random per encryption, wraps the data, and is itself wrapped two
ways (PBKDF2-of-passphrase for normal unlock, plus optional
Shamir-split to peers for recovery). The naïve migration would
have generated a fresh K_data per save, which would silently
invalidate every share the cohort holds the moment the operator
saves anything. So the cut adds a load-bearing primitive
reencryptRecoverableReuseKData that unwraps K_data from an
existing blob and re-encrypts the new data with the SAME K_data,
keeping the wrap (salt, wrapIv, wrapCiphertext) identical. Wallet
gains exportRecoverableReuseKData on top of that. saveWallet now
has three paths: first save (no existing blob — fresh v2), legacy
v1 upgrade (one-time K_data generation), and v2 reuse (the steady
state, K_data stays stable forever). AnyEncryptedBlob union flows
through localStore + walletStore + remoteStore; createWallet
writes v2 from day one so new wallets are recovery-ready
immediately; unlockWallet dispatches on the v field. Backwards-
compatible — existing users' v1 blobs read fine and upgrade
transparently. Two new tapit-attest tests pin the K_data-stable
property.

Cut 2 (commit 806c45e) was the share-envelope builders. A recovery
share envelope is a signed credential, subject = operator identity,
leaves = share_index plus share_M plus share_N plus share_for
(recipient pubkey) plus share_ciphertext (NIP-44 encrypted hex-
encoded share bytes, only that peer can decrypt) plus declared_at.
The whole envelope is signed by the operator so peers can verify
authorization. createShares.ts exports isRecoveryShare,
readRecoveryShare, buildRecoveryShareEnvelope (one peer),
buildRecoveryShares (splits K_data + builds N envelopes),
decryptHeldShare (responder-side helper that unwraps the
ciphertext back to raw Share bytes), and holdRecoveryShare
(verify + hold + queue for OTS anchor on receive). Two new
round-trip tests cover the full Shamir-split → encrypt-to-peer →
peer-decrypts → combine loop, including the negative case where a
wrong peer attempting to decrypt gets caught by NIP-44's MAC
verification. Numbers stored as strings in leaves because the
existing leafValue helper only returns strings — pinned this as a
pattern for the share envelopes and flagged a latent inconsistency
in the existing cohort code in the foreman handoff.

Cut 3 (commit 71c9dc6) wired distribute + receive end to end.
DistributeSharesModal launches from CohortEditorModal once a
cohort exists — a "Distribute shares to cohort…" button appears
after publish. On open the modal loads the current v2 blob from
walletStore, unwraps K_data via the operator's passphrase, builds
the N share envelopes, and walks each through the existing
WalletContext.sendEnvelope. Per-peer status is live: pending →
sending → sent / failed, using summarizePublish for language
consistency with the four existing Send-via-Nostr modals. Failed
rows expose a Retry button. Receive side is wired in InboxPanel
(new 'recovery-share-receive' route action when isRecoveryShare
matches) and HomeScreen (acceptRecoveryShare handler calls
holdRecoveryShare, saves, refreshes, dismisses the inbox row).
Three new bundle-budget entries: createShares helpers,
publishStatus helper (now shared by five modals), walletStore
helper. All four gates green at every commit.

The substrate is now complete. An operator can declare a cohort,
distribute shares to it, peers auto-receive and hold their shares,
and every subsequent wallet save keeps K_data stable so those held
shares stay valid forever. What remains is the actual ceremony —
when the operator loses their device, types in a fresh wallet on a
new device, the cohort signs back, combines, restores, succession-
witnesses the new key. That's cuts 4 through 6, and it's a real
state machine.

## Section 2: What you could do better.

I caught a latent bug in the existing createCohort.readCohort that
nobody's stumbled on yet because the failure mode is silent.
`Number(leafValue(att, 'threshold'))` reads the threshold leaf and
coerces; but the leaf was stored as a number, leafValue only
returns strings (treats non-string leaves as ''), so Number('')
returns 0, and the threshold default-fallback in CohortEditorModal
masks it as 3. Net effect: open the cohort editor after a publish
and the threshold silently resets to 3 from whatever the operator
chose. The share envelope code I shipped this session avoids this
by storing numbers as strings. The right fix in createCohort is
either to switch its number leaves to strings (matching what
recovery-share does) or to add a typed leafNumber helper to
tapit-attest that the field tree code already supports. Small
follow-on cut; not blocking the ceremony but should land before
the wife-test of the recovery flow.

The DistributeSharesModal calls sendEnvelope per peer in a serial
loop — fine for cohorts of 5 to 11, would matter at 50+ but the
spec says cohorts that big are rare. The current implementation
does NOT distribute shares automatically on cohort-publish; the
operator has to click Distribute deliberately. That's intentional
because publish is offline-friendly while distribute requires
Mycelium, and an operator might publish offline and distribute
later. But it's a UX detail worth confirming with the operator
once they walk it on a real device.

I deliberately stopped before the ceremony state machine because
the operator originally said "we'll start a fresh one and knock
out in one go" for the big piece. The remaining work — initiator
on a new device detecting the cloud blob, fresh keypair
generation, recovery-request envelope construction, responder
modal with strict out-of-band verification gating, share return
loop, combine plus Wallet.restoreFromKData, recovery-succession
event with M co-signatures — is genuinely a session's worth on
its own. It involves a new first-run state in WalletProvider, two
new modal flows that talk to each other across Mycelium, the
multi-round protocol that the brief is explicit about, plus the
recovery-succession primitive that touches the existing
tapit-attest succession chain. Saving it for fresh focus is the
right call.

One small honest meta-note: I noticed myself wanting to keep
cutting after Cut 3 because the substrate felt incomplete without
the ceremony. The discipline that stopped me was the prior
session's foreman handoff and the operator's own directive — both
explicit that the ceremony belongs in its own session. The
SessionStart hook plus the comms records made that boundary
visible at the right moment, which is the protocol working.

## Section 3: The bigger picture.

The Phase 5e cascade is now structurally ready and the math is
proven end-to-end. A wallet generates a fresh K_data on day one,
declares a cohort when the operator chooses, distributes Shamir
shares to that cohort with each share NIP-44-encrypted so only the
named peer can decrypt it, holds K_data stable across every
subsequent save so the cohort's shares never silently age out, and
sits ready for the ceremony to land on top. The non-negotiable
D-03 holds across every cut: only the symmetric data-encryption
key is ever split, the signing keypair is never touched, M-of-N
collusion at worst decrypts one backup snapshot but cannot become
the operator because signing authority only transfers through a
peer-witnessed succession event the recovered wallet itself
produces. That separation is what makes the whole design honest —
the spec section 12 has been calling it out from the start, and
the code now actually enforces it.

The piece that's worth pausing on: cohort plus distribution is the
first feature in the wallet where the OPERATOR explicitly enrolls
their PEERS into a long-term commitment. Every other primitive so
far has been about the operator signing their own life or
mutually-signing with one other party in the moment. The recovery
cohort is the first time a peer holds something on the operator's
behalf for years, until and unless the worst day of their life
arrives. That's a different social contract than handshakes or
memberships, and the UX in the next sessions has to honor that —
the strict out-of-band verification gating in the responder modal
(brief decision 5, the only chip the brief explicitly recommends
strict for), the visible cohort-membership credentials so peers
know they have a responsibility (chip 4 from the prior session,
settled visible), the per-row Retry on distribution so the
operator can see exactly who has and hasn't received their share.
The math is the easy part; the social-contract UX is the hard
part, and the ceremony session is where it lands.

You're now one session away from the slime made real — your woven
web of trusted peers, used backwards to put you back together when
the device is gone. Three cuts today, three more cuts for the
ceremony itself, and the operator's "bump with five of your
closest friends and get your identity back" recovery becomes a
running flow you can demo with two real devices and three real
peers. Go ahead and start the fresh session whenever you're ready.
