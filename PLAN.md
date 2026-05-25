# Tapit Wallet — build plan

> Phased work order. `DESIGN.md` is the authoritative spec; this
> file mirrors its phasing in a tighter format and tracks status.
> Refreshed 2026-05-21 to reflect Phase 2.5 / 2.6 / 2.7 / 3 / 4 +
> the verify-pass fixes + security polish having shipped.

## What Tapit Wallet is (and is not)

It IS a person's sovereign identity wallet: a standalone app that
generates and holds the user's keypair and is the Merkle holder
of their signed attestations. It is the only place keys live, and
the hub other apps connect to.

It is NOT a cryptocurrency wallet, not a chatbot, not a feature
embedded inside another app. It does not hold coins; it holds
identity and reputation — signed attestations.

## Prime Directive

Build the smallest useful version correctly. The user's keys
never leave the wallet unencrypted — that rule outranks
everything. Clarity beats cleverness. A wallet a non-technical
person cannot use is a wallet that does not exist.

## v1 launch scope

v1 ships when a non-technical user can install the PWA, log in by
email magic link, create an identity backed by a signed identity
attestation, write diary entries with text and photos/documents
that get OpenTimestamps-anchored to Bitcoin, witness-co-sign other
family members' entries via in-person paste-flow, hand off
custody of a long-running subject thread, selectively disclose
one field of an attestation without leaking the rest, and approve
inter-app sign requests via deeplink. The Mycelium peer network
(Layer 3) and the wallet bot (Layer 4) are explicitly NOT in v1.

## Layer 1 — already built

The `Wallet` core object — keypair, succession, attestation
holder, sign-both-ways, encrypted backup, sync, peer recovery —
lives in `tapit-attest`, consumed as a `file:` dependency. This
app is built *around* that object; do not rebuild it. Wallet-side
patches landed: sign-poisoning fix in `verifyEnvelope`,
`journal` AttestationKind added, `metaHash` exported,
`disclosureProof` + `verifyDisclosureProof` implemented (replacing
the v1.1 stub). Bundled version `0.1.1-wallet.0`.

## Phase 1 — PWA shell + email auth + key generation [DONE]

Vite + React 18 + TypeScript + Tailwind project shell.
`tapit-attest` wired as `file:` dependency. Supabase magic-link
auth. PWA manifest + hand-rolled service worker. On first login:
passphrase prompt → `generateKeypair()` → encrypted snapshot →
IndexedDB + Supabase `wallet_blobs`. Home screen with the user's
public key displayed.

## Phase 2 — Identity attestation + backup posture [DONE]

First-run display-name flow → self-signed `identityAttestation`
with display name + creation date + pubkey on the Merkle tree.
Attestation card renders on the home screen. Settings screen:
cloud-sync toggle (default ON), local encrypted-backup download,
sign-out. Backup-status banner on home (stale > 24h, off,
pending).

## Phase 2.5 — Diary wedge [DONE]

The operator's reframe from earlier: the wallet's day-one product
is a cryptographically signed time-anchored personal diary that
gets quietly corroborated by peers over time. Composer with text,
subject picker (Me / Someone-else label), category picker (Diary,
Family, Medical, Marriage, Witness plus free-form), optional
attachment. Each entry signed by the wallet, queued for
OpenTimestamps anchoring, rendered as a card on the home screen
grouped by category tab. Detail view per entry with anchor status,
signers, save-to-files download.

## Phase 2.6 — Witness co-signing + custody handoff [DONE]

Manual envelope-JSON paste-flow between operator and witness via
any channel. CosignRequestModal (originator), CosignAsWitnessModal
(witness paste → preview → sign), AbsorbCosignModal (originator
absorbs). CustodyHandoffModal for the grandchild-thread custody
arc (grandparent → parents → eventually the child themselves)
via meta-kind attestation co-signed by both custodians.

## Phase 2.7 — Generic attachments [DONE]

Claim leaves renamed `photo_*` → `attachment_*` plus
`attachment_name`. Composer has separate 📷 Photo (camera shortcut
preserved) and 📄 Document (broad MIME picker) buttons.

## Verify pass + security polish [DONE]

Adversarial code review found two real bugs: entry-digest used
non-canonical JSON.stringify hash (fixed to `envelopeId`), and
confirmed anchors never attached to held attestations (lost
Bitcoin block heights on backup-restore; fixed with subscribing
to the worker and attaching anchors on confirm).

Idle-timeout hook (DESIGN.md §5) — default 30 min, configurable
in Settings, re-prompts for passphrase on activity-timeout.
Closes the mid-session-abandonment window the passphrase-in-
context move from Phase 2.5 widened.

Anchor-worker polish: 30s fetch timeout via wrapped OtsTransport
with AbortController; exponential backoff for failed rows
(`min(5min × 2^attempts, 1hr)`).

## Phase 3 — Layer 2 inter-app deeplink pathway [DONE]

Third-party apps construct a URL pointing at `/sign` with a
base64url-encoded SignRequest. The wallet decodes, validates,
renders a plain-English approval screen showing the claimed
origin + the actual callback host + the content being signed.
On approve, builds the attestation via `wallet.attest`, signs,
holds, queues anchoring, redirects with a SignGrant. On decline,
redirects with a structured SignDecline. Per-kind plain-English
template surfaces prominent fields by name. Intent='attest' only
in v1; NIP-46 transport is a future swap of the deeplink layer
for the same SignRequest/SignGrant message shapes.

## Phase 4 — Selective leaf disclosure [DONE]

The "math, not trust" demonstration most legible to a
non-technical user. From any entry's detail page, the operator
picks one leaf of the claim tree and the wallet produces a
DisclosureProofBundle they hand to a verifier. The companion
`/verify` route lives outside `AuthGate` so the verifier
(third-party context) can paste and check the proof without a
wallet of their own. Library work: `disclosureProof` +
`verifyDisclosureProof` in `tapit-attest/src/core/field-tree.ts`;
`metaHash` exported from `envelope.ts` so the verifier uses the
same canonical hashing the signer used.

## Phase 4.5 — Tabbed home + capture bridge (PWA-first) [DONE]

Decided 2026-05-22 (D-07, D-08). Two post-v1 pieces, both
independent of Phase 5 and buildable now. Both shipped — status
reconciled 2026-05-25 after the section had drifted to [NEXT]
while the actual code landed.

**Tabbed home:** shipped. `HomeScreen.tsx` renders four top-level
tabs (Journal, Identity, Captured, People). `JournalTabs.tsx` +
`JournalTabRouter.tsx` host the diary's life-layer category tabs
nested under Journal. The Captured tab filters journal entries by
`source=capture` so capture-bridge entries surface apart from the
diary.

**Capture bridge (Tier 1):** shipped. `public/manifest.webmanifest`
registers a `share_target` with `action: /capture, method: GET,
params: {title, text, url}`. `src/App.tsx` lazy-mounts
`CaptureScreen.tsx` at `/capture` inside the WalletProvider tree.
A capture reuses the journal `createJournalEntry` pipeline; the
data-model addition is the optional `source` leaf on JournalInput.
Tier 2 (native share extension / iOS App Store) and Tier 3
(desktop browser extension) remain deferred to v1.5. Sketch of
record: `briefs/2026-05-22-capture-bridge-phase-sketch.md`.

## Phase 5 — Social recovery + Mycelium peer network

The spec of record now exists — `MYCELIUM_NETWORK_SPEC.md`
(written 2026-05-22) — which discharges D-04 and breaks Layer 3
into increments 5a–5f: the in-person handshake, organizations +
membership, Nostr transport, device-verified presence, the
hyphal lattice + social recovery, then quorum-controlled
organization keys. 5a and 5b are built; 5c is next. The brief
of 2026-05-21 promoted Shamir-based cascade recovery to this
phase per the operator's no-pre-stashed-key sharpening: M-of-N
peers initiate, every subscribed peer encrypts their share to
the new keypair, reassembly happens on the new device, M peers
co-sign a recovery-succession event that handoff signing
authority to the new key. Technical note carried in
`carpenter-state-for-foreman.md`: the Shamir split must be over
the encryption key for the cloud-mirrored backup blob, NOT over
the signing keypair, so M-of-N collusion does not equal total
identity capture forever.

## Phase 6 — Family-mode custody (full keypair)

The original DESIGN.md Phase 6 generates a real child keypair at
birth and stores it under the parent's passphrase. The operator's
2026-05-21 message refined the model to "identity by attestation
not by key" — the grandchild's identity is a typed-label subject
that accumulates signed attestations from custodians, and the
grandchild eventually absorbs the thread into their own keypair
when they get one. That lighter model already ships in Phase 2.6.
Full-keypair custody is now optional, not required for v1.

## Phase 8 — Tapscript-style org authorization tree + charter governance [PLANNED]

Promoted from Phase 7+ non-goal through three iterations on
2026-05-25 — FROST-first morning brief, list-of-sigs evening
brief, then this Tapscript-style late-evening brief — after the
operator asked whether what was being briefed actually was
"Taproot multisig" and whether the wallet's leaves theory held
up. The honest answer surfaced that the wallet's existing
leaf-tree primitive (Phase 4 selective disclosure) is the EXACT
cryptographic shape needed to port Taproot's script-path
Merkle-tree-of-conditions model to off-chain attestation
envelopes, and the operator chose to pivot to that substrate.

Brief of record:
`project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-25-tapscript-style-org-authorization-tree-roadmap.md`.
Supersedes all three prior briefs:

- `2026-05-23-quorum-org-keys-roadmap.md` (MuSig2-first)
- `2026-05-25-frost-first-and-charter-governance-roadmap.md` (FROST-first)
- `2026-05-25-simple-multisig-orgs-roadmap.md` (list-of-Schnorr-signatures)

All three stay in the briefs folder. List-of-sigs is preserved
as the simpler fallback if Tapscript-style proves heavier than
expected during implementation; FROST is preserved as the
upgrade path for the day an org specifically needs
signer-anonymity.

Substrate: an org's authority is a Merkle commitment to a tree
of authorization-rule leaves
(`{action, threshold, eligible}` tuples), implemented as a
sub-branch in the org's self-declaration claim tree. An
org-issued envelope carries a disclosure proof of one rule leaf
(via the shipped `disclosureProof` /
`verifyDisclosureProof` from `tapit-attest/src/core/field-tree.ts`)
plus signatures from the eligible signers named in that leaf.
Zero new cryptographic code; the entire arc is wallet-side
plumbing on a primitive already in production for selective
disclosure of facts (Phase 4), now generalized to selective
disclosure of authorization rules.

Four phases:

- **Phase A** — `AuthRule` type + `selfDeclareOrganization`
  gains `authRules` parameter; rules become a sub-branch of
  the claim tree; `proveAuthorization(org, action)` wraps
  the shipped `disclosureProof`. Default rule preserves
  existing-shape declarations. About one session.
- **Phase B** — Authorized envelope shape:
  `authorized_by` leaf carries the disclosure proof bundle;
  `verifyOrgAuthorization(envelope, knownOrgs)` reconstructs
  the org's auth-root, checks the disclosed rule, counts
  eligible-signer signatures against threshold. About one
  session.
- **Phase C** — Multi-rule org creation UI + per-action
  signing flow. `RatificationsBadge` extended to render the
  rule name inline. About one to two sessions.
- **Phase D** — Charter amendment chain
  (`walkCharterChain` / `findActiveCharter`) + dissolution
  endpoint. Each new self-declaration must be authorized by
  the prior charter's `charter_amendment` rule. About one to
  two sessions.
- **Phase E** — Open-joining + per-org configurable
  membership-policy. Member-initiated self-membership
  attestations gated by a `join` rule in the org's auth tree
  (open / allow-list / requires-handshake / requires-credential
  / requires-vouch). Roster shows founder first, then joiners
  in chronological order via Bitcoin anchor heights. Three
  substrate options (org auto-publishes roster / org pre-signs
  open policy / hybrid) deferred to a substrate-decision chip
  after operator reads the dedicated brief. Brief of record:
  `project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-25-open-joining-and-configurable-membership-policy-roadmap.md`.
  Depends on Phase A (shipped) and Phase B (verifier).
  About 5-7 sessions, ~2-3 weeks.

Phase E extends the canonical Tapscript brief along the
membership-acquisition axis (how do people become members)
while Phases A–D handle the org-control axis (who can authorize
org actions). Both briefs live side-by-side; neither supersedes
the other.

Operator-locked decisions (2026-05-25 evening + late-evening
+ deep-evening chip sessions): Tapscript-style substrate over
list-of-sigs and FROST, auth-tree as sub-branch of the claim
tree (reuses shipped disclosure primitive verbatim), no FROST,
no MuSig2, no DKG, no tapit-attest version bump. Phase E
adds: per-org configurable membership-policy via a `join` rule
in the auth tree, abuse-resistance posture configurable per org
(not at the substrate), member-initiated self-membership
attestations as a NEW dimension extending MYCELIUM_NETWORK_SPEC
§6 along the membership-acquisition axis. Open-joining substrate
choice (org auto-publishes roster / org pre-signs open policy /
hybrid) deferred to a follow-up chip after operator reads the
Phase E brief.

Estimated calendar: 4-6 sessions, ~1.5-3 weeks. Similar to the
list-of-sigs calendar because most of the work is wallet-side
UI plumbing on a cryptographic primitive
(`disclosureProof` / `verifyDisclosureProof`) already in
production. The structural payoff over list-of-sigs is
per-action thresholds with per-rule eligible subsets, plus
privacy of unused rules until invoked — properties that mirror
Bitcoin Taproot's script-path multisig at the SHAPE level
(while remaining off-chain attestation signing, not Bitcoin
script execution).

## Phase 9+ — explicit non-goals for v1

- Wallet bot (conversational guide). Dormant scaffolding is
  preserved in `src/features/{persona,snapshot-builder,suggested-questions,temporal}/`
  with `pause_safe: true` manifests, awaiting this launch.
- Mycelium peer network (Layer 3) — wallet-to-wallet contact
  discovery, transitive trust weighting. Spec-first.
- Nostr NIP-46 transport (deeplink only in v1; NIP-46 swaps in
  the same SignRequest/SignGrant shapes when it lands).
- NFC tap-to-cosign and tap-to-bump-for-recovery (D24, D25).
- Voice input/output.
- WebAuthn / biometric unlock.
- QR-as-transport for co-signing (paste-flow ships in v1; QR is
  later UX polish on the same primitives).

## Known follow-ups (logged, not blocking)

- Multi-tab worker coordination (BroadcastChannel leader election).
- HEIC/WebP photo re-encode in composer for cross-device
  portability (`canvas.toBlob`).
- Pre-commit library-seam audit script — convert the verbal
  pre-push pattern that caught the digest + anchor-attach bugs
  into a mechanical check.
- Bundle-budget audit before the next phase that meaningfully
  enlarges the post-auth chunks.
- OTS fixture restoration (4 skipped tests in `tapit-attest`).
- `Tap-it-Attest-main.zip` cleanup at repo root.

## Do NOT

- Do NOT re-implement anything in `tapit-attest` — inherit it.
- Do NOT put a private key anywhere but the user's wallet,
  encrypted. Not an env var, not a log, not a commit.
- Do NOT build Layer 3 before `MYCELIUM_NETWORK_SPEC.md` exists.
- Do NOT treat the approval screen as plumbing — it is the
  product.
- Do NOT add features beyond the manifests in
  `src/features-registry.ts` without a decision logged in
  `project-memory/.../decisions.md` and a matching `manifest.ts`.

## Recommended first move after Phase 4

Operator browser-verifies the full Phase 1+2+2.5+2.6+2.7+3+4
stack against the live Netlify+Supabase deploy. Walk: login →
passphrase → display-name → home with identity card → New entry
with photo → wait for Time-verified · block N → Hand a co-sign
request to a family device → witness signs → absorb → home shows
multi-signer count → /entry/:digest → Share a proof of one field
→ paste into /verify in another tab → confirms math → /sign with
a constructed test request → approve → callback host received
the grant. If any step stalls, that's the next session's first
business.
