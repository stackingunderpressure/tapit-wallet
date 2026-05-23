# Org-mode UI roadmap — sketch (2026-05-23)

> Status: SKETCH + first cut. The brief names the four UI cuts that
> surface the organizations-and-governance picture
> `MYCELIUM_NETWORK_SPEC.md` §6 promises. Cut one (this session)
> ships org-mode declaration + an issued-memberships view; cuts
> two, three, four are queued.
> Companion to `MYCELIUM_NETWORK_SPEC.md` §6–7.

## What this surfaces

Today the wallet's UI treats every wallet as a person. The math
under it already supports organizations as first-class identities
(D-10) — an org is just a wallet — but nothing in the surface
lets the operator say "this wallet IS the hunting club" or read
the structures that follow from that declaration (officials,
ratifications, nested federations). This brief breaks the gap
into four discrete UI cuts, each reusing existing primitives,
no new tapit-attest cryptography required for cuts one through
three. Cut four is the quorum increment from §6 and stays
deferred to a later phase consistent with the spec.

## The four cuts

### Cut 1 — Org-mode declaration + Members view (this session)

A wallet self-declares as an organization by signing one
credential-kind attestation about itself: subject = own identity,
credential_type = 'organization', org_name = the display name.
HomeScreen reads the operator's holdings, detects the
self-declaration, and renders an "Organization" header on the
Identity tab plus a Members section listing every membership
this wallet has issued (the reverse view of the existing
Identity > Memberships, which lists memberships received). A
Settings action declares the wallet as an organization (one-way,
confirm-gated, signed). No re-key, no migration — an existing
wallet can become an organization any time the operator decides.

### Cut 2 — Officials roster

The organization publishes a credential-kind attestation about
itself naming its current officials by pubkey. A separate
"Officials" section on the org's home renders the list, with
add / remove flows that produce a new officials roster
attestation (the latest by issued-at wins; older rosters are
superseded). Other wallets read the roster when verifying
ratifications. Reuses the existing credential builder pattern.

### Cut 3 — Ratifications view

When the clerk has signed a membership envelope and other
officials co-sign later (sign-now-ratify-later per §6), the
MembershipCard renders "ratified by N of M officials" with the
known names. The math already supports this — envelopes carry
multi-signatures, the existing co-sign machinery merges them in
— what is missing is the card reading the signatures, cross-
referencing the officials roster, and rendering the count.
Inbox auto-routing for incoming ratification envelopes reuses
the existing AbsorbCosignModal path.

### Cut 4 — Nested-org chain view

Tapping a MembershipCard opens a sheet showing the chain
upward: "Hunting Club ← Hunting Club is a member of State
Federation ← State Federation is a member of National
Body." Each link is an ordinary membership attestation; the
chain renders by walking from the issuing org's holdings to
the membership IT holds, transitively. Verification of the
chain runs through verifyEnvelope at every step. This is
read-only and reusable from any context that wants to walk
the structure.

## What is NOT in this roadmap (intentionally)

- **Quorum org keys (FROST / MuSig2 with MAST).** The
  cryptographic upgrade where the org's authority lives across
  the officials' wallets and no single org private key exists.
  Named in §6 as the HEARTWOOD pattern and explicitly deferred
  to a later increment (consistent with `PLAN.md`'s Phase 5f
  framing). The sign-now-ratify-later flow from cuts two and
  three buys most of the trust property without the heavier
  multi-party-signing protocol.
- **Centralized org directory.** No search, no recommender, no
  global registry of organizations (§11 keeps discovery
  manual).
- **Mandatory org declaration.** An operator can keep using
  their wallet as a person and never declare; org-mode is a
  one-way opt-in.

## Why this order

Each cut produces operator-visible value standalone. Cut one
makes the wallet say "you are an organization" and shows the
people you have admitted. Cut two surfaces the governance
group. Cut three makes ratification visible (the practical
half of M-of-N without the new crypto). Cut four lets a
verifier walk the structure. Quorum keys come last because
they are the largest cut and their value is amplified by the
first three already being there.

## Decisions resolved before code lands

- **Org declaration shape:** credential-kind self-signed
  attestation with `credential_type='organization'` and
  `org_name` leaf. Operator-blessed inline above; the spec
  already calls org = wallet, and this attestation just makes
  the wallet self-aware of its role.
- **Identity tab vs new tab:** Members view lives under the
  Identity tab as an additional section (the simpler shape).
  Promoting Members to a top-level tab is reserved for a
  future polish if the section grows.
- **One-way declaration:** an org cannot un-declare into a
  person in this cut. If needed later, revocation is a
  meta-kind attestation; not in scope today.

---

*Cut one shipping this session against this brief.*
