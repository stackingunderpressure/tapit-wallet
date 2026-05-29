# Tapit Wallet — roadmap

> **This document supersedes everything.** Prior phase-by-phase
> planning lived in this file too; that structure is retired.
> Manifest notes still carry tribal knowledge about WHY individual
> features are shaped the way they are (historical record), and the
> briefs under `project-memory/foreman-memory/projects/tapit-wallet/briefs/`
> still carry technical design depth for the items they cover. But
> the "what's next, in what order, why" answer is this file.
>
> The lens: **would a serious Bitcoin / Nostr / freedom-tech person
> open this wallet today without us being embarrassed for them.**
> Specifically the kind of person who has spent a decade arguing for
> self-custody, on-device key generation, Bitcoin-anchored proofs,
> Nostr-native identity, and no third-party identity middleware —
> Matt Odell shorthand for that audience. They are the first
> community to evaluate it because they will accept the philosophy
> we built on; everyone else is downstream of that acceptance.

## What this wallet IS (and is NOT)

It IS a person's sovereign Nostr identity wallet. It generates
and holds the user's keypair on their device — the SAME BIP340
pubkey is both the wallet's identity and its Nostr identity per
D-11d, one secret, one cryptographic chain of custody. It signs
attestations about their perception of reality — their identity,
their relationships, their life events, their organizations,
their families. It anchors those attestations to Bitcoin via
OpenTimestamps so they carry a tamper-evident clock. It publishes
signed records to the Nostr relay set when the operator chooses
to disclose them publicly — selective disclosure to the public
audience is just one mode of the substrate's selective-disclosure
primitive, sitting alongside selective disclosure to a peer
(NIP-17 chat, NIP-44 envelope) and selective disclosure to a
verifier (multi-leaf disclosure proof). The user's keys never
leave the wallet unencrypted, ever.

It is NOT a Bitcoin financial wallet (no UTXOs, no Lightning, no
zaps — those are deliberate scope choices, see "Out of v1" below).
It is NOT a Nostr social feed READER — operators continue to use
Damus or Amethyst or Primal to scroll their existing follows and
read their inbox; this wallet's posture is identity-substrate-first
not feed-first, it publishes and signs, it does not read. It is
NOT a chatbot or an LLM frontend or a feature embedded inside
another app. It is the identity layer of the Hearth product
family, and the substrate other apps (including existing Nostr
clients via future NIP-07 / NIP-46) will connect TO when they
need something signed.

The reframing rationale: the previous PLAN.md (2026-05-28 morning)
drew a line at "no public Nostr feed posting" framing the wallet
as attestation-holder not social-feed-publisher. That line was
structurally inconsistent with Tier 3 (the Matt Odell tribute
attestation), which explicitly involves posting a public Nostr
note, and with the wallet's growth story — Bitcoin / Nostr /
freedom-tech are the audience that cares about keys and privacy,
and a wallet that signs but does not publish has no substrate
flow through the Nostr mycelium. The line was retired 2026-05-29
on the operator's directive: make this a Nostr-enhanced identity
wallet, let the substrate grow from the roots up through the only
audience that gives a damn about keys and privacy.

## Standing protections — these never lapse

1. The user's keys never leave the wallet unencrypted. Not in an
   env var, not in a log, not in a commit, not on the network in
   the clear. This rule outranks every other rule in this file.
2. Never re-implement `tapit-attest`. The library holds the
   cryptographic primitives; the wallet consumes them. Zero
   re-implementations have happened to date and that record stands.
3. Build the smallest useful thing correctly. Clarity beats
   cleverness; safety beats speed.
4. Four gates green before push: typecheck, lint, test, build.
   Unverified is honest; claimed-green-when-not is not.

## Where we are today

The audit ran 2026-05-28 against the actual repo, not from memory.
23 feature folders, doctrine quintet present at
`project-memory/foreman-memory/core/`, 335 tests green, four-gate
floor holding.

Working end-to-end:
- Passphrase-based key generation behind the double-warn gate
  (personal-and-memorable check + irrecoverable-consequence check).
- Identity attestation creation + Bitcoin anchoring via passive
  OpenTimestamps poll-based worker with exponential backoff.
- Peer relationship attestations — Tier P (in-person, 3 QR
  exchanges) and Tier R (remote, over Nostr) — typed by
  relationship leaf (family / friend / coworker / acquaintance /
  other).
- NIP-17 gift-wrapped per-peer encrypted chat (kind 1059, three
  layers, ephemeral outer signature so relays never see the real
  sender). Migrated from custom kind 9574 on 2026-05-26 because
  public relays were accept-but-not-persist on the custom kind.
- Organization declaration + six-kind join-policy substrate
  (open / allow-list / deny-list / requires-handshake /
  requires-credential / requires-vouch). Phases A, B, C, E1, E2,
  E3, E4 cuts 1-6 complete.
- Selective-leaf disclosure proofs (multi-leaf + legacy single-leaf)
  with the verifier path running outside `AuthGate` so external
  parties can verify without a wallet of their own.
- Shamir-split social recovery substrate — cohort declaration,
  share distribution scaffolding, recovery ceremony modal.
  **(End-to-end cross-device run UNTESTED — see Tier 1.)**
- Family-unit envelopes — multi-party named groups with
  member-ratification by cosignature, rendered on the People tab
  Tree view as a third ring around the operator's identity.
- Journal entries — diary primitive with categories, photo +
  document attachments, OpenTimestamps anchoring, subject picker
  for about-me vs about-someone-else.
- Layer 2 inter-app sign pathway via deeplink — third-party apps
  construct a SignRequest URL, the wallet renders a plain-English
  approval screen, callback delivers a SignGrant or SignDecline.
- Wallet uses the same BIP340 pubkey for identity AND Nostr
  (D-11d). One secret, one cryptographic chain of custody, not a
  wallet with one identity and a Nostr handle on the side.

Roughly 60-70% of Doctrine Layer 1 (identity) shipped, 50% of
Layer 3 (peer network) shipped. Layer 2 (inter-app signing via
deeplink) shipped; NIP-46 transport swap deferred. Layer 4
(wallet bot) deferred per design intent.

## Tier 1 — Close the embarrassment gap

These are the cuts that must land before the Bitcoin community
sees this wallet. They are ordered by gap-severity, not by
technical difficulty. The first one is load-bearing for the whole
demo story.

### 1. Social recovery end-to-end across two physical devices

The single biggest credibility blocker. Bitcoin people trust
math but demand the demo loop close on actual hardware. Recovery
ceremony code exists; cross-device run is untested. Open the
wallet on phone A, name a cohort, distribute shares to phone B
+ phone C, simulate loss of phone A by clearing its blob,
initiate recovery on a fresh device, collect M-of-N shares,
reconstitute the wallet, verify the keypair recovers, verify
prior attestations still verify against the recovered identity.
Document what works, surface what breaks, fix it. Until this
closes, the demo story has a hole exactly where a serious
evaluator will press hardest.

### 2. Extract `RecoveryInitiatorModal.tsx` pre-emptively

799 of 800 lines. The next addition to this file breaches the
hard limit. The recovery cross-device test in (1) will surface
fixes that need to land here; extracting first gives those fixes
headroom. Natural extraction candidates: the share-collection
sub-flow, the ceremony-wallet lifecycle, the share-combine path.

### 3. Extract `FreshOnboarding.tsx` pre-emptively

794 of 800 lines. Same logic — the next addition breaches.
Natural extraction candidates: each step component (Splash,
Compose, Name, Passphrase, Recovery, Email, Code) is already a
sub-component but the parent state machine is fat. Extract the
state machine itself or pull the step components into their own
file.

### 4. OpenTimestamps calendar-unavailable end-state in the anchor worker

Today the worker retries failed anchors forever with exponential
backoff. If the OpenTimestamps calendar goes dark, the operator
sees no surface signal — the envelope just stays unanchored
silently. Surface a "calendar unreachable" state in the journal
entry card after N-consecutive-failures, so the operator can SEE
the case rather than have it lurk. Not a fix for the underlying
calendar dependency; an honest UX surface.

### 5. WalletGuide "why no Lightning" framing tab

Bitcoin people will ask why a wallet anchored to Bitcoin doesn't
do Lightning. The answer is in SATOSHI.md — Bitcoin is the public
clock for tamper-evident timestamps, not the financial layer of
this wallet. Write that framing into the WalletGuide tabs so the
answer is in the wallet itself when the question lands. Proactive
framing, not defensive apology.

### 6. Multi-device sync honest UX

Today multi-device sync via Nostr is fire-and-forget with
last-write-wins on the snapshot blob. This works for one-device-
at-a-time use; it breaks if the operator opens the wallet on
iPad mid-iPhone session. Either (a) add a basic "sync state"
indicator that shows when the local snapshot is newer than the
cloud blob, or (b) document the single-active-device assumption
in the wallet guide. Pick one; do not let the assumption stay
silent.

### 7. kind-0 Nostr profile metadata

Added 2026-05-29 doctrine reframing. The wallet's BIP340 pubkey
IS its Nostr identity per D-11d, but today that identity has no
kind-0 metadata published anywhere — followers who click through
from a kind-1 note (item 8) or a NIP-17 DM see a naked pubkey
with no display name, no picture, no NIP-05 handle. Publish a
kind-0 metadata event seeded from the operator's identity
attestation (display name from `name`, picture from
`attachment_*` if present) on first connect, re-publish when the
operator edits their identity. Without this the published Nostr
identity is structurally incomplete.

### 8. kind-1 publish helper + "Share to Nostr" affordance

The substrate primitive plus the visible surface. A
`NostrTransport.publish` helper that wraps a kind-1 event built
from a journal entry (or any shareable record) with optional
NIP-19 references back to the signed envelope so anyone can fetch
the bytes and verify the math; a "Share to Nostr" button on the
journal-entry detail surface; the source entry gets stamped with
the published event id so the operator can see what's already
been shared. Publishing rides the existing NostrTransport — same
key, same relay set, same encryption-free model that kind-1 uses.

### 9. Import-existing-nsec flow

For operators bringing an existing Nostr identity (Primal,
Damus, Amethyst, snort, etc.) — Tapit grows an "I already have
a Nostr nsec, import it" path that takes over management of
that identity so the operator's existing follows, profile, and
post history come with them. Honest disclosure required: the
nsec already exists outside Tapit (in Primal's secure enclave,
in an nsec-bunker, in whichever client they were using), so the
keys-never-leave-the-wallet-unencrypted discipline becomes more
nuanced for imported identities. The operator who explicitly
imports is making an informed choice rather than having the
discipline silently weakened — the import surface names the
tradeoff plainly.

### 10. NIP-05 verification surface

Map a human-readable handle (e.g. `tom@dynastytrust.org`) to
the wallet's pubkey via DNS, the Nostr-community-standard
identity-verification path. Many Bitcoin-community Nostr users
already have NIP-05 handles; matching that surface makes the
wallet identity legible inside existing clients (Damus shows a
verified checkmark, Primal renders the handle, etc.). Lower
priority than items 7-9 because publishing works without it —
but the wallet's identity reads naked-pubkey-shaped without it.

## Tier 2 — Polish and substrate maturation

These are the named-pending threads from the prior session
handoffs and manifest notes. They are real work but they are not
embarrassment-gap items — none of them block a credible
community demo.

- **Tap-for-detail on family-ring nodes.** Open
  `FamilyIdentitySections` in view-mode when a family node is
  tapped on the Tree view.
- **Add-birthday-now backdated credential.** Operator's own
  missing-birthday pain point. Same supplement-credential pattern
  the family-unit substrate established — a credential signed
  today carrying a backdated `as_of` leaf.
- **Quick-share over-18 / over-21 age-gate presets.** Depends on
  the birthday leaf landing in (the add-birthday-now cut). Two
  presets become buildable once the leaf exists.
- **Succession-proof leaf for cosigning members** (the rotated-key
  bridge fix). Today `keyAliases` accepts the operator's own
  rotation chain but never remote members'. Proper fix: embed a
  succession-proof leaf in the cosigned envelope at sign time so
  rotation by remote members is detectable on the founder's side.
- **WalletProvider extraction continued.** Natural next candidates
  are `usePeerOps` (sendEnvelope / syncEnvelope /
  removePeerConnection / unholdEnvelope cluster) or
  `useInboxSubscription` (the Mycelium subscription + inbox
  handler wiring). Not structurally forced; pull before the next
  transport-layer cut forces it under pressure.
- **Phase D org charter-amendment chain.** Charter governance per
  HEARTWOOD doctrine. `walkCharterChain` + `findActiveCharter`
  helpers plus dissolution endpoint. Each new self-declaration
  must be authorized by the prior charter's `charter_amendment`
  rule.
- **Phase 5e-iii-b recovery share distribution.** Backup-format v2
  distribution + actual share transport. Adjacent to the Tier 1
  cross-device test; some of this work will likely land as part
  of (1) and what remains becomes a follow-up cut.
- **WebAuthn assertion verification (verifier-side).** Phase 5d
  cleanup — wallet currently does device-passkey enrollment but
  defers signature-verification to the verifier flow.
- **Persistent offline outbox + sync resume for Nostr.** Phase
  5c-iii. Lets messages and envelopes queue locally and publish
  when connectivity returns.
- **Photo / file capture Tier 1b.** Capture-bridge today handles
  text and links; photo and file post-capture deferred.
- **Tightknit-group toggleable chat.** The family-unit substrate
  already supports arbitrary tight-knit named groups (kids' friend
  group, chosen family, Sunday hike crew, etc.). A per-member
  per-family local-preference toggle lights up a group chat
  scoped to that family-unit's member list. Operator chat-design
  thread from 2026-05-28. Compose with the events toggle on the
  same axis (each operator picks chat-only, events-only, both,
  or neither for each family).
- **Threshold-gated Hearth chat for teens.** Builds on the
  tightknit-group toggleable chat above. Existing vouch-loop
  cryptography already does the threshold-join gate; missing
  layer is the moderation surface and the teen-grade UX that
  makes the multisig ceremony invisible. Operator strategy
  thread from 2026-05-28 — kid-safety angle is a strong product
  hook this wallet can credibly own because the identity layer
  is verified, not pseudonymous.

## Tier 3 — Inaugural demonstration

### The Matt Odell tribute attestation

When Tier 1 is closed and the wallet is field-tested honestly,
the inaugural outbound act of this wallet is a signed attestation
acknowledging Matt Odell as a foundational influence on the
information-and-sovereignty philosophy the wallet is built on.
Operator strategy thread from 2026-05-28.

Shape: a journal entry with the about-someone-else field set to
Matt's verified Nostr pubkey (verify the npub from a trusted
source — his published handle, his podcast feed, OpenSats — not
from any in-wallet directory), a brief prose body naming the
specific lineage (Citadel Dispatch, Rabbit Hole Recap,
OpenSats, the years of broadcasting that Bitcoin self-custody
and Nostr-native identity are the foundation of digital
sovereignty), no expectation of countersignature, anchored to
Bitcoin via the standard OpenTimestamps path.

Delivery: a private NIP-17 DM to Matt carrying the envelope id
plus a brief courtesy note, and a public Nostr note (kind 1)
tagging his pubkey with the signed envelope linked or hashed in
the body so anyone can fetch the bytes and verify against the
wallet's pubkey.

Why this is the inaugural moment: it is the substrate enacting
itself in public. One small outbound gesture uses Layer 1
(signed envelope), Layer 2 (deeplink-equivalent inter-app
signing context — the journal flow), the SATOSHI substrate
(Bitcoin OpenTimestamps anchor), the MYCELIUM transport (Nostr
NIP-17 DM + public note), and demonstrates the wallet's whole
thesis in a single act. If the cross-device recovery test in
Tier 1 is the technical loop-close, this is the narrative
loop-close. It does not require Matt's response to count; the
attestation stands on its own.

## Out of v1 — confidently framed, not apologized for

These are deliberate scope choices grounded in doctrine, not
gaps in execution. When asked by serious evaluators, the answer
is the doctrine — not "we'll add it later."

- **Lightning / BOLT12 / zaps / merchant payments.** SATOSHI.md:
  Bitcoin in this wallet is the public clock for tamper-evident
  timestamps, not the financial layer. A different bet than
  every other Bitcoin wallet, and a defensible one.
- **Nostr social feed READING.** This wallet is not a Damus /
  Amethyst / Primal replacement. Operators continue to use their
  existing Nostr client to scroll their follows and read their
  inbox. The wallet's posture is identity-substrate-first not
  feed-first — it publishes and signs (Tier 1 items 7-10), it
  does not read. (Reframed 2026-05-29 — the prior PLAN.md line
  retired kind-1 posting and NIP-05 as out-of-v1, which was the
  wrong line and is now retired itself; kind-1 publishing and
  kind-0 profile metadata and NIP-05 verification are all in
  scope per Tier 1 items 7-10.)
- **Hardware-wallet support for the encryption key.** The
  wallet's keypair IS the secret. Not an HD seed that could ride
  a Trezor. Hardware support would be a structurally different
  product.
- **NIP-46 / NIP-07 inter-app signing transports.** Layer 2
  ships as a deeplink today; NIP-46 (remote signer over Nostr)
  and NIP-07 (browser extension API) become the natural inter-
  app pathways once Tier 1 items 7-10 close and the wallet's
  Nostr-identity-substrate is fully established. Existing Nostr
  web apps (nostrudel, snort, etc.) ask the wallet to sign
  events via NIP-07; remote services ask via NIP-46. Both swap
  in at the same SignRequest / SignGrant message shapes the
  deeplink path uses today.
- **Voice input / output, NFC tap-to-cosign, QR-as-transport for
  cosigning.** UX polish on existing primitives. Paste-flow
  works; the rest is later.
- **Multi-tab worker coordination (BroadcastChannel leader
  election).** Single-tab assumption holds today.
- **HEIC / WebP photo re-encode for cross-device portability.**
  Native format ships; re-encode deferred.

## Deferred — substrate exists, scope choice or sequencing

These are honest items that the substrate already anticipates,
but they sit behind the Tier 1 / Tier 2 work. They get pulled
forward only when (a) the embarrassment gap is closed and (b) a
specific use case demands them.

- **Wallet bot (Layer 4).** Dormant scaffolding preserved in
  `src/features/{persona,snapshot-builder,suggested-questions,temporal}/`
  with `pause_safe: true` manifests. Activated by the Phase 7+
  wallet-bot launch session.
- **Mycelium peer-network discovery (Phase 8+).** Transitive trust
  lattice, gossip-relay discovery. Waiting on
  `MYCELIUM_NETWORK_SPEC.md` finalization beyond what's currently
  written.
- **Hub layer (Hearth-spec Layer 0 — the server piece).** The
  doctrine quintet's HEARTH_SPEC.md names a personal hub that
  hosts identity + storage + engine + recipe registry +
  federation endpoints. Not started; this wallet is the identity
  piece of that future hub.

## How to use this document

The carpenter consults this file as the canonical "what's next."
Tier 1 items are the cuts that close the embarrassment gap before
community demo. Tier 2 items get cut in the order the operator
picks via the standard chip-form chooser, after Tier 1 closes.
Tier 3 is the inaugural symbolic moment that closes the loop.
Out-of-v1 and Deferred items are the answers to "why doesn't it
do X" and the things to NOT cut without an explicit operator
directive.

Manifest notes still carry tribal knowledge — read them when
working on a specific feature. The briefs under
`project-memory/foreman-memory/projects/tapit-wallet/briefs/`
still carry technical design depth for the substrate they cover.
But the order, the priority, and the lens come from here.

## Footer

Roadmap written 2026-05-28 by the Matt-Odell-lens audit + the
operator's framing call. Supersedes the prior phase-by-phase
PLAN.md. When this roadmap itself needs revising, the operator
calls it; the carpenter does not retire items unilaterally.
