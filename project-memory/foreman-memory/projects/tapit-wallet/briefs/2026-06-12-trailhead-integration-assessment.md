# Trailhead ↔ Tapit Wallet — Integration Assessment

Date: 2026-06-12
Status: ASSESSMENT ONLY (no code cut; grounded against the wallet repo as of HEAD ffb82d9)
Author: Carpenter (Tapit Wallet repo)

## Why this exists
Trailhead — an AI concierge for independent lodging operators, built on the
same `tapit-attest` engine — needs to integrate with the user's Tapit Wallet
via a "sign in with Tapit" / request-a-signature pattern. This brief records
what the wallet actually supports today (file:line grounded), what's missing,
and the operator's locked decisions on the first slice and the org model.

## What Trailhead needs (recap)
1. SSO: authenticate a user via the wallet, get a short-lived verifiable
   session (a signed assertion verified against the user's pubkey, no callback
   server required).
2. Proof-of-presence: guest taps "confirm my stay," guest wallet signs, the
   BUSINESS wallet CO-SIGNS — a mutual two-party attestation.
3. Organization identities: a business ("Cedar Cabin") is its own sovereign
   wallet, distinct from the owner person-wallet; communities are group
   identities. Person is default; "become an organization" is deliberate.
4. Vetting credentials (community-signed "verified local," "trusted guest").
5. Later: FROST so a business/community signs as ONE durable key surviving
   membership change.

## Grounded findings — per surface

### A. SIGN-IN / SSO — ACHIEVABLE TODAY BY CONVENTION (no new wallet code)
There is no dedicated session-assertion route, and `src/features/auth/`
(`useSession.ts`) is Supabase app-login, not wallet SSO. BUT the existing
deep-link signing channel already mints a verifiable, callback-light session
assertion:
- `parseSignRequest.ts:10-19` accepts `kind:'meta'` and tier `routine`.
- `:64` accepts any non-empty `subject` (= the user's pubkey).
- `:84-93` accepts arbitrary string/number/boolean `fields`.
- `approveRequest.ts:27-32` signs via `wallet.attest({kind,tier,subject,fields})`
  and `:47-54` returns a `SignGrant{ envelope }` to the app's callback.
Recipe: Trailhead sends a `SignRequest` with `kind:'meta'`, `subject:<userPubkey>`,
`fields:{ purpose:'session', app:'Trailhead', nonce, issued_at, expires_at }`.
The wallet signs; Trailhead verifies the envelope signature against the pubkey,
matches the nonce, and enforces `expires_at` itself. That IS a short-lived,
wallet-signed, verifiable session assertion. Expiry is a claim Trailhead
checks (the wallet does not enforce it). No wallet build required for v1 SSO.

### B. SIGNATURE-REQUEST TRANSPORT — READY (deep-link v1)
`src/features/sign-request/` is the Layer-2 inter-app signing channel.
Request: `/sign?req=<base64url(JSON(SignRequest))>` where SignRequest =
`{v:1, origin, intent:'attest', kind, tier, subject, fields, callback, nonce?}`
(`types.ts:15-38`). Wallet decodes (`parseSignRequest.ts`), shows an approval
card, signs (`approveRequest.ts`), and redirects to `callback` with
`?grant=<base64url(SignGrant)>` or `?decline=<base64url(SignDecline)>`. NIP-46
remote-signer transport is reserved/planned, not shipped — deep-link only.
Verdict: the ready spine. Trailhead can use it now.

### C. KINDS / SINGLE-PARTY SIGN — READY; MUTUAL CO-SIGN VIA DEEP-LINK — MISSING
All seven kinds (`identity, relationship, credential, prediction, agreement,
journal, meta`) and three tiers are accepted (`parseSignRequest.ts:10-19`).
Single-party signing of an app-supplied draft: production-ready. Two-party
co-sign EXISTS in-app via `cosigning/mergeSignatures.ts` (merge by envelopeId,
dedupe by (signer,sig), verify) — but only over QR/paste/inbox, NOT through
the deep-link: `parseSignRequest.ts:58-60` hard-rejects any `intent` other than
`'attest'`, and `approveRequest.ts` always mints a NEW envelope. So mutual
proof-of-presence through the app needs a new `cosign-existing` intent.

### D. PERSON vs ORG — THE REAL GAP
An "organization" today is NOT a separate keypair. `createOrganization.ts:146`
`selfDeclareOrganization()` has the SAME person-wallet sign a credential whose
`subject === issuer === own pubkey` and `credential_type:'organization'`
(`isOrganizationSelfDeclaration` checks `subject === leafValue(att,'pubkey')`,
`:64-70`). It flips that one key into org-mode UI. There is one keypair per
Supabase `ownerId` and no in-app person↔org identity switching. So "Cedar Cabin
is its own wallet separate from the owner" is not met today — you'd run a
separate wallet/login, or build multi-identity (see Decisions).

### E. MULTI-SIGNER / FROST — PARTIAL
Two-party merge: ready (`mergeSignatures.ts`). Org threshold RULES exist as
data + POST-FACTO verification: `verifyOrgAuthorization()`
(`createOrganization.ts:193-282`) counts how many of an envelope's signatures
fall in a rule's `eligible` set against `rule.threshold`. FROST
single-aggregate-key threshold signing is NOT built — "sign as one durable key
surviving membership change" is future (FROST brief 2026-05-25). Today a
threshold is N sigs merged + verified, not one aggregate signature.

### F. DISCOVERY / GUEST PROVISIONING — PARTIAL
No email/pubkey directory lookup. Invite-link → new-wallet flow is READY
(`connections/inviteLink.ts`, `/join?i=` route, FreshOnboarding). WebAuthn
passkey enroll/assert primitives exist (`presence/webauthn.ts`) but are not
wired to one-tap guest provisioning. A brand-new guest can get a wallet via an
invite link today; a one-tap passkey light-wallet needs UI + onboarding wiring.

### G. NOTIFICATION / INBOX — INBOX READY, PUSH MISSING
Inbox surfacing + routing is live when the app is open: `transport/InboxPanel.tsx`
+ `encryptedInbox` subscription + `envelopeRoute.ts`/`inboxEnvelopeHandler.ts`
route incoming envelopes to the right modal. NO push notifications (no service
worker / Web Push) — deferred to a native shell. So "a guest is waiting for
your co-signature" only surfaces with the app open + Mycelium connected.

### H. SHARED STORE / SYNC — PARTIAL
Holdings live in local IndexedDB mirrored to a per-`ownerId` encrypted Supabase
blob, last-write-wins on `updated_at` (`storage/walletStore.ts`,
`localStore.ts`, `remoteStore.ts`). There is no cross-app shared store; apps
exchange attestations over the Mycelium transport or the deep-link, not a shared
DB. No attestation querying API (flat holdings array).

## DECISIONS (operator, chip-form, 2026-06-12)

### First slice = SSO (by convention) + MUTUAL proof-of-presence co-sign
Operator chose "add mutual co-sign too" — proof-of-presence must be genuinely
two-party, not a unilateral guest claim. So v1 is:
1. SSO by convention on the existing `/sign` deep-link (no wallet code).
2. Guest signs a proof-of-presence draft via `intent:'attest'` (ready).
3. NEW: `intent:'cosign-existing'` so the BUSINESS wallet adds its signature to
   the guest's envelope and returns the two-signature envelope.

New wallet code for the slice (small, on ready substrate):
- `types.ts`: a `SignRequest` variant `{v:1, origin, intent:'cosign-existing',
  envelope: Attestation, callback, nonce?}`.
- `parseSignRequest.ts`: accept `cosign-existing`, validate the embedded
  envelope shape (don't hard-reject non-`attest`).
- A co-sign approve path: `wallet.sign(envelope)` → `mergeSignatures` (dedupe +
  verify) → `wallet.hold` → return merged envelope in `SignGrant`.
- A co-sign approval screen — reuse `cosigning/EnvelopePreview` to show what's
  being co-signed before the business approves.
Push is out of scope (G): the co-sign request surfaces when the business app is
open; a later native-shell push closes that gap.

### Org model = own keypair, owner-bound by signature, frictionless switch
Operator's target: each business/community is its OWN keypair (a real sovereign
identity), TIED to the owner by the owner SIGNING a binding to it, with a
frictionless switch between the person and one-or-more org identities depending
on activity. This is the strategic follow-on (NOT v1). Sub-pieces:
- Hold MULTIPLE keypairs in one wallet (today: one keypair per `ownerId`). Core
  new capability — generate/store N identities encrypted under the same vault.
- A person→org BINDING attestation: the owner's person-key signs a meta/credential
  linking the org pubkey to the owner (provenance/control). The org also
  self-declares with its OWN key (evolves `selfDeclareOrganization` from
  same-key to a distinct org key + an owner binding).
- An ACTIVE-IDENTITY switcher, activity-aware: acting inside a Trailhead business
  context auto-selects the business identity; default is the person.
- Later: FROST so the org key survives membership change (E) — same request/sign
  UX, threshold underneath.

## Recommended approach (summary)
Deep-link transport (no NIP-46 for v1). SSO by `meta`-assertion convention on
the existing `/sign` channel. Add `cosign-existing` for mutual proof-of-presence
— the only new wallet code in the first slice, sitting on the ready
`mergeSignatures` substrate. Treat separate-org-keypair-with-owner-binding-and-
frictionless-switch as the headline follow-on (the biggest real build), and
push notifications + FROST as later cuts. Single biggest blocker for the FULL
vision is multi-identity (D); for the FIRST slice there is no blocker — it ships
on what exists plus the small `cosign-existing` intent.
