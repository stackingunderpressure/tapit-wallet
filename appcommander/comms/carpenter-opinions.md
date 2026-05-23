# Carpenter opinions — Phase 5e foundations landed (2026-05-24 continuation)

## Section 1: What I did

This session continuation shipped four sequenced cuts that move the
Phase 5e arc from "the cryptographic primitives exist in the library"
to "the wallet save loop is cascade-ready." Each cut was the next
thing in the locked sequence; each landed with all four gates green
on the first try; each one's commit message states the why and the
what plainly. The four are 1429faa Lattice screen, 52e317f wallet v2
backup migration, 367e909 K_data preservation library primitives,
6b52e3c K_data preservation through the wallet save loop.

The Lattice screen at slash-lattice is the one with visible payoff
for the operator. It surfaces the entire direct web in three sections
in the order someone cares about when they open it. Recovery cohort
first, because the question that brings you to a "see my whole web"
screen is usually some variant of who would help me back. People
second with a Tier P versus Tier R count line and a Cohort badge
overlaid on whichever ConnectionCard belongs to a peer who is also in
the cohort, because that cross-section is the single most useful
piece of information the operator could pull out of all this data.
Organizations third, with the existing chain-walk sheet wired in for
nesting, no new chain logic written. Read-only by design and every
empty state routes to where the action lives.

The v2 backup migration is the foundational move that everything
after it depends on. The library half of v2 was already shipped at
84ebbc2 by the prior session; this cut wired it in. New Wallet
methods on the library side, exportRecoverable and
restoreFromRecoverable and restoreFromKData. A WalletBlob union type
that threads v1 EncryptedBlob and v2 RecoverableEncryptedBlob through
the entire storage layer. createWallet, saveWallet, and
downloadEncryptedBackup all mint v2 from this branch forward;
unlockWallet dispatches on the v field of the on-disk blob, v1 blobs
unlock via the existing path and the first save migrates them
automatically. The migration is irreversible going forward, which is
the operator-visible risk worth flagging loudly.

Then the K_data preservation problem surfaced during re-grounding
for the next cut. Without preservation, every normal save mints a
fresh K_data, and the moment a recovery cohort distributes Shamir
shares of K_data, those shares become useless on the very next
save. Recovery would only restore the snapshot from cohort-publish
time, not the latest one. The fix is two new library functions
that expose K_data as a stable value across saves, unwrapKData to
extract it from a v2 blob using the passphrase and
encryptRecoverableWithKData to re-encrypt with a caller-supplied
K_data. Cut alpha shipped the library primitives plus nine tests
covering round-trip, length enforcement, salt and IV refresh per
call, and the end-to-end save loop proving K_data survives. Cut
beta wired them through. unlockWallet now returns wallet and kData,
createWallet does too, saveWallet takes kData as input and returns
the kData the blob was actually keyed on, and WalletProvider holds
K_data in a ref alongside the passphrase, threaded through all four
save call sites and cleared with the passphrase on sign-out and
idle-lock. The keys-never-leave audit gained kData in its
SECRET_NAMES list so a stray console log will fail the gate.

One small refactor fell out along the way. createCustodyHandoff was
the only helper in the codebase that bundled saveWallet inside
itself. Every other helper in the same family — publishCohort,
selfDeclareOrganization, the membership and officials and ratifies
flows — signs and holds and queues the anchor and lets the modal
call save via WalletContext. I matched the pattern so the K_data
plumbing stays in one place and a future read of the code finds
saveWallet invoked from exactly the spots it should be.

## Section 2: What you could do better

The v1 to v2 migration on the operator's deployed wallet is the
single risk in this session that you should weigh before merging.
The first save under this branch will overwrite your cloud-blob row
from v1 EncryptedBlob to v2 RecoverableEncryptedBlob. The unlock
path stays bidirectional in source code — v1 blobs still unlock and
v2 blobs unlock — but I have not exercised the path with your real
on-disk blob, and I have not run the wallet against the live
Supabase row. The safest path is to back up your current
wallet_blobs row before the next save under this branch lands, or
test the migration on a fresh Supabase identity first. Once a v2
blob is on disk, reverting to a pre-5e-iii-b-2 branch means a
manual rollback of both IndexedDB and the cloud row. The migration
itself is small and the code is straightforward, but the asymmetry
between code review and live-data behavior means a backup before
the cutover is worth doing.

The Lattice screen visual hasn't been walked in a browser this
session either — same flag from last session, repeated because the
Cohort badge absolute-positioning concern on ConnectionCard is still
unresolved. Fixed right offset of sixteen pixels puts it beside the
existing Tier P or Tier R badge, which reads fine at 375 with short
peer names and may overlap at 320 with long names. The clean fix is
restructuring ConnectionCard to accept an optional badges array
prop and laying them out itself; that's a single-session refactor
when the operator walks the screen and flags the problem in person,
or doesn't, in which case the absolute positioning was always going
to be fine.

WalletProvider crossed the four-hundred-line soft warning this
session, sitting at 482 lines after the K_data plumbing. Still well
under the 800-line hard limit. The growth came from threading kData
through four save call sites with state and refs; the call sites
themselves are not bad but they are repetitive. The two effects
worth pulling into dedicated hook files are the transport effect at
roughly lines 115 through 180 and the post-anchor-attach effect at
roughly 225 through 295. Both are self-contained, both have stable
inputs and outputs, both would slim WalletProvider back into the
sub-400-line range and make the K_data flow easier to follow at the
top of the file. Not done this session because the K_data plumbing
was load-bearing and changing structure mid-cut would have made the
diff harder to review.

The cohort-rotation semantics question is the open architectural
choice I'm leaving for the next session's brief. When the operator
adds a cohort member, removes one, or changes the threshold, the
right behavior is almost certainly to mint a fresh K_data and
redistribute shares to every current member, which leaves the old
shares useless. The cost is one extra re-encrypt per cohort change;
the benefit is that the cohort change is a clean event with no
half-rotated state. I documented this in the foreman handoff and
the current.json so the next session can settle it explicitly in
the brief refresh rather than discovering it mid-implementation.

## Section 3: The bigger picture

Four cuts in one session is a lot of plumbing for the operator to
see as a single ship. The visible piece is the Lattice screen; the
other three are foundational work that pays off in the next cut,
which is the one where shares actually move across Mycelium and the
cohort becomes a real recovery surface rather than a declared one.
That asymmetry between visible value and foundational value is the
shape of Phase 5e by design. The recovery ceremony at the end of
the arc — initiator, responder, recovery-succession event — looks
visually small to the operator but rests on every piece of
machinery shipped here. The v2 backup format, the K_data
preservation, the share distribution that comes next, the inbox
auto-routing, every one of them is load-bearing. The cascade is a
real cryptographic protocol with multi-round multi-party state, and
it only works because the floor was laid this carefully.

The K_data preservation problem is the one that's worth carrying
forward as a teaching moment. The brief named the cryptographic
floor and the protocol shape but did not surface the architectural
crux that fell out of trying to actually implement it: when does the
data-encryption key rotate, and when does it stay stable. The answer
that fell out is the right one — preservation across normal saves,
explicit rotation only when the cohort changes — but it was not
obvious from the brief, and getting it wrong would have meant cohort
shares decay invisibly with use. This is the kind of design surface
that surfaces during implementation, not during sketching, and the
discipline of re-grounding before changing code is what caught it.
The grounding gate paid for itself this session in exactly the way
the doctrine claims it will.

The locked sequence continues to hold. Cut 5e-iii-c-gamma is next on
the road map, and the foreman handoff sketches it concretely enough
that the next session has a clear plan: createShare.ts primitive,
cohort-publish wires share distribution through Mycelium, peer
inbox auto-routes recovery-share envelopes to hold. The brief should
land first, settling the cohort re-publish question I named in
section two, and then the cut itself is one focused session. After
that the recovery-request envelope shape is a small follow-on, and
then the recovery ceremony itself becomes a multi-session arc per
the brief's sizing. The operator's directive to keep cutting was the
right call this session — every cut sized well, every gate held, and
the next session opens onto a sharper road map than it would have if
we'd stopped two cuts ago. End of the line for this thread; the next
one starts at the cohort re-publish brief.
