# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual
against live Netlify + Supabase deploy. v1 shipped. Operator on iOS,
listens via TTS. SessionStart drift hook is active on this branch.

**Branch:** `claude/next-steps-xzmdk`. Four cuts pushed this session
on top of the prior session's lattice work: 1429faa Lattice screen,
52e317f v2 backup migration, 367e909 K_data preservation primitives,
6b52e3c K_data preservation through the save loop. Branch is ahead
of origin/main by 16 commits now; merge timing is the operator's
call from the cockpit.

## WHAT-CHANGED-RECENTLY

**Cut 5e-iv — Lattice screen (read-only)** at `/lattice`. Three
sections in the order the operator cares about when they open it:
Recovery cohort first (threshold + members + Cohort badge per
member); People (handshakes sorted newest-first with Tier P / Tier R
counts and a Cohort badge overlaid on any ConnectionCard whose peer
is also a cohort member); Organizations (memberships with the
existing chain-walk sheet for nested orgs). Read-only — every empty
state routes to where the action lives.

**Cut 5e-iii-b-2 — wallet flips to v2 recoverable backup format.**
The Phase 5e library half (`encryptRecoverable` +
`decryptRecoverableWith*`) was already shipped at `84ebbc2`; this cut
wires it in. Three new Wallet methods (exportRecoverable,
restoreFromRecoverable, restoreFromKData). The WalletBlob union
threads v1 EncryptedBlob and v2 RecoverableEncryptedBlob through
localStore + walletStore + remoteStore. createWallet + saveWallet +
downloadEncryptedBackup mint v2 from this branch onward. unlockWallet
dispatches on `blob.v` — v1 blobs unlock via the existing path; the
first save after that automatically migrates the on-disk blob to v2.
No separate migration step.

**Cut 5e-iii-c-α — K_data preservation primitives (library half).**
Without this, every save would mint fresh K_data and instantly
invalidate every Shamir share a cohort holds — recovery would only
restore the snapshot from cohort-publish time, not the latest. Two
new exports in encryption.ts: `unwrapKData(blob, passphrase) →
Uint8Array` and `encryptRecoverableWithKData(plaintext, passphrase,
kData, options?) → blob`. Plus a Wallet wrapper
`exportRecoverableWithKData(passphrase, kData)` for symmetry. Nine
new tests cover round-trip, wrong-passphrase rejection, v1
rejection, fresh-salt-per-call, length enforcement, empty-passphrase
rejection, and the end-to-end save loop (unwrap → re-encrypt →
unwrap yields the same K_data).

**Cut 5e-iii-c-β — K_data preservation through the wallet save
loop.** The library cut in action. unlockWallet and createWallet now
return `{wallet, kData}`; saveWallet takes kData as an input and
returns it as an output so callers can thread it. WalletProvider
holds K_data in a ref alongside the passphrase, threaded through all
four save call sites (self-CC auto-hold, post-anchor-attach
debounced save, onCreateIdentity, and the save() context callback).
Idle-lock and sign-out clear it with the passphrase. The
keys-never-leave audit gained `kData` in SECRET_NAMES so a stray
console.log(kData) fails the gate; defense-in-depth for a value as
sensitive as the passphrase.

**One small refactor along the way.** `createCustodyHandoff` was the
only helper that bundled saveWallet inside itself (the others —
publishCohort, selfDeclareOrganization, etc. — sign+hold+queue and
let the modal call save() via WalletContext). I matched the pattern
so the K_data plumbing stays in one place. CustodyHandoffModal calls
`await save()` after createCustodyHandoff returns.

## Gates at session end

Across all four cuts, every gate ran green on the first try:

- typecheck ✓
- lint ✓
- wallet test ✓ — 36/36
- tapit-attest test ✓ — 146/150 with 4 skipped network-deps (13 new
  tests pass: 4 in wallet.test.mjs for v2 round-trips, 9 in
  encryption-recoverable.test.mjs for K_data preservation)
- build ✓ — bundle budgets all green; tapit-attest vendor 29.14 KB
  gz (under 35 KB), WalletProvider 6.33 KB gz (under 7 KB),
  LatticeScreen 2.12 KB gz (under 5 KB)

## WHAT'S-PENDING

1. **Phase 5e-iii-c-γ — cohort-publish share distribution.** This is
   the cut that turns the K_data plumbing into actually-distributed
   shares. The CohortEditorModal currently calls publishCohort which
   signs + holds + anchors a cohort credential. γ adds on top of
   that: split the current in-memory K_data via splitSecret into N
   shares, build N recovery-share credentials (one per cohort
   member, subject = member.pubkey, signer = operator, leaves
   include operator_identity + share_index + share_bytes_hex +
   threshold + total_shares + cohort_digest + declared_at), send
   each via the WalletContext.sendEnvelope path (NIP-44 to the
   peer). The peer side adds an inbox auto-route: recovery-share
   envelopes verify + hold without a UI confirmation step (they are
   routine inbound credentials about being-held-as-cohort-member).
   The single architectural question to settle in the next session's
   brief: what happens on cohort RE-PUBLISH? Recommended answer:
   mint fresh K_data, re-encrypt the wallet's current blob with it,
   re-distribute new shares to every cohort member, the new K_data
   becomes current — old shares are now useless. Old cohort members
   removed by the re-publish keep their now-useless old share and
   the credential history shows they were removed. Spec-aligned;
   simple to implement.

2. **Phase 5e-iii-c-δ — recovery-request envelope shape.** The new
   device's claim to be the operator. Small library cut: new
   envelope helpers in recovery feature for a `recovery-request`
   credential (subject = old identity, signer = fresh new-device
   keypair, leaves: new_pubkey + requested_at). The signer not
   matching the subject is intentional and is what the cohort peer
   uses as the visible evidence that "X (old identity) is asking
   from a new device Y."

3. **Phase 5e-v / -vi / -vii — the recovery ceremony.** Initiator +
   responder + recovery-succession event. The brief sizes these at
   1-2 weeks each because the state machine is real protocol work.
   Brief-first per the prior session's [FEEDBACK→Foreman]; sub-cuts
   per ceremony phase are likely the right shape.

4. **Operator field tests open.** Wife-test of the polished
   `/verify`; two-device 5c stack against real relays; the new
   Lattice screen on a real device (see WHAT-TO-FLAG below for the
   one absolute-positioning concern); and crucially the v1→v2
   migration on a copy of the operator's deployed cloud-blob row
   before this branch lands on main.

## WHAT-TO-FLAG

**v1→v2 migration is automatic but irreversible.** The first save
after this branch deploys will overwrite the operator's v1
EncryptedBlob with a v2 RecoverableEncryptedBlob. Reverting to a
pre-5e-iii-b-2 branch after that point requires a manual rollback
of the cloud-blob row (and the local IndexedDB). Recommend the
operator either (a) test on a fresh Supabase identity first, or
(b) back up the existing wallet_blobs row before the next save
under this branch. The v1 read path stays intact for the unlock
direction; the migration only flows v1 → v2, not back.

**The Cohort badge on ConnectionCard uses absolute positioning** —
unchanged from last session's flag, repeating it because the
operator hasn't walked the Lattice screen yet. Fixed right offset
of 16 puts it beside the Tier P / Tier R badge. Fine at 375px with
short names; long names may overlap. The clean fix is restructuring
ConnectionCard to accept an optional badges array prop. Not done
this session; lives in the next-session backlog.

**The K_data architecture is the design crux that fell out of this
session.** K_data is preserved across saves (the seam that makes
cohort shares stay valid); K_data is rotated only on explicit
cohort re-publish (the operator's signal that the cohort membership
or threshold has changed). This is documented inline in
encryption.ts and saveWallet.ts but worth re-stating: rotation is
explicit, never implicit. Subsequent cuts must honor that or the
cascade breaks.

**WalletProvider grew to 482 lines** — over the 400-line soft warn,
under the 800-line hard limit. The four save call sites with
K_data plumbing are the main growth. Worth a structural review
before it hits 600 lines; candidates for extraction are the
transport effect (lines ~115-180) and the post-anchor-attach
effect (lines ~225-295), both of which are self-contained enough
to live in dedicated hook files.

## RECOMMENDED-NEXT-MOVES

1. **Operator walks the Lattice screen** on a real device to
   validate the visual and confirm the cohort cross-reference badge
   does what it should.
2. **Operator backs up their cloud-blob row** before the next save
   under this branch, or tests the migration on a fresh Supabase
   identity. Strongly recommended.
3. **Brief-refresh for Phase 5e-iii-c-γ.** Settle the cohort-
   re-publish question (recommended: fresh K_data + redistribute).
   Sketch the recovery-share credential leaves. Sized at one
   session.
4. **Cut 5e-iii-c-γ.** Adds createShare.ts + cohort-publish
   distribution + peer inbox auto-routing. Real visible payoff —
   shares actually move.
5. **Cut 5e-iii-c-δ — recovery-request envelope** as a small
   follow-on, then brief-first for 5e-v initiator.
6. **Wife-test of the verify-page** and two-device field test —
   independent of the 5e arc; the most actionable adoption signal
   at hand.

## OPERATOR'S-CURRENT-VIBE

Operator stayed in execution-flow mode all session: two terse
prompts, broad autonomy, no clarifying questions needed. "Knock out
what you can as long as you see the line" then "continue on and
pick off the road map pieces." Trust is high; expects the carpenter
to ground, see the locked sequence, and cut. Quality matters more
than quantity by the doctrine, but the line was clear enough this
session that four sequenced cuts landed cleanly with all gates green
on the first try and no architectural surprises that needed
escalation. The K_data preservation crux did surface during
re-grounding; it was named and resolved inline because the design
question was tractable. The 5e-iii-c-γ cohort re-publish question is
the next one that benefits from explicit operator framing before
code lands.

## Ideas ready to revisit

- **CohortSummaryCard extraction with variant prop** — pressure
  rises when γ adds a third rendering site (the cohort-publish
  status surface).
- **ConnectionCard badges array prop** — refactor enabling multiple
  badges on the top-right corner without absolute positioning. Worth
  doing if the Lattice screen's Cohort badge overlap surfaces as a
  real problem.
- **Friend-of-friend transitive paths on the Lattice screen** —
  named as a deferred increment in the v1 surface itself. Natural
  follow-on after the recovery ceremony arc closes.
- **WalletProvider extraction** — the transport effect and the
  post-anchor-attach effect both live in WalletProvider today but
  are self-contained enough to slide into hook files. Pre-emptive
  refactor before the file crosses 600 lines.
- **NEW 2026-05-24 — K_data preservation architecture** — the
  design that fell out of this session's re-grounding. Cohort
  rotation = explicit fresh-K_data + redistribute; normal saves =
  preserve K_data. Documented inline; worth a doctrine entry so
  future cuts honor it.
- **NEW 2026-05-24 — cohort re-publish semantics** — the operator-
  framing question 5e-iii-c-γ needs before code lands. Add a
  member: re-distribute shares to ALL members (because share
  indices may have changed). Remove a member: re-distribute to
  remaining members with new K_data; old member's share becomes
  useless. Change threshold: same as add/remove. The simplest model
  is "re-publish always rotates K_data," at the cost of one extra
  re-encrypt per cohort change. Spec-aligned and easy to reason
  about; recommended for v1.

Full entries belong in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`; this session did not write to that file — the new entries above are flagged here for the next session to fold in.
