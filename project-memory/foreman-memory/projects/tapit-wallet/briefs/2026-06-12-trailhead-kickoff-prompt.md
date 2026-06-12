# Trailhead — new-repo kickoff prompt

> Paste this into the first Claude Code / AppCommander session of a NEW,
> SEPARATE repo (`trailhead`). It is the spawn brief. It is written to be
> self-contained; it references the Tapit Wallet integration contract as it
> actually exists today (the wallet's `sign-request` feature), so the two apps
> line up without guesswork.

---

## Mission

Trailhead is an AI concierge for independent lodging operators — cabins,
marinas, B&Bs — that lives on the **owner's own website**. A guest asks it
real questions ("where do I kayak near here, what time is checkout, is the boat
ramp open"), and over time the answers become **human-verified and provable**
rather than re-guessed. Its second job is to turn a stay into a **mutual,
tamper-evident proof-of-presence**: the guest confirms their stay, and the
business countersigns the same record. It is the first wedge of a larger
verified-knowledge commons.

## The one hard constraint (read first)

**Trailhead holds NO cryptographic keys, ever.** Keys live only in the user's
Tapit Wallet (a separate app/repo). Trailhead is a *keyless client*: it
**requests signatures** from a wallet over a deep-link, and it **verifies and
stores the public signed results**. Attestations are public by construction —
there is no secret in them — so holding them is safe. If you ever find yourself
generating, storing, or transmitting a private key in this repo, stop: that is
the wallet's job, not yours.

## Stack (mirror the fleet)

- React 18 + Vite + TypeScript + Tailwind
- Supabase (Postgres + Auth) for Trailhead's OWN app data: listings, bookings,
  the concierge knowledge base, the cache of received attestations
- Anthropic (Claude) as the concierge AI brain
- `tapit-attest` as a dependency (the shared signed-attestation engine) — used
  ONLY to verify and read envelopes (`verifyEnvelope`, `verifyMultiDisclosureProof`,
  envelope readers). Never to hold a key.
- Hosting: the owner's site embeds a widget; Trailhead also hosts an owner
  dashboard.

## How Trailhead connects to the Tapit Wallet (the real contract)

The wallet exposes a Layer-2 **deep-link signing pathway** at the route `/sign`.
Trailhead builds a `SignRequest`, base64url-encodes it, and opens
`https://<wallet-origin>/sign?req=<base64url(JSON(SignRequest))>`. The wallet
shows the user a plain-language approval card; on approve it redirects to your
`callback` URL with `?grant=<base64(JSON(SignGrant))>`, on decline with
`?decline=<base64(JSON(SignDecline))>`. **No keys cross the wire — only public
signed envelopes.**

### Message shapes (copy these types; keep them in lockstep with the wallet)

```ts
// SignRequest is a discriminated union on `intent`.
type SignRequest = AttestSignRequest | CosignSignRequest;

interface Base { v: 1; origin: string; callback: string; nonce?: string }

// Wallet creates and signs a NEW attestation from these fields.
interface AttestSignRequest extends Base {
  intent: 'attest';
  kind: 'identity'|'relationship'|'credential'|'prediction'|'agreement'|'journal'|'meta';
  tier: 'routine'|'notable'|'high_stakes';
  subject: string;                       // who/what the claim is about
  fields: Record<string, string|number|boolean>;
}

// Wallet ADDS its signature to an envelope you hand over, returns the merged
// multi-signature envelope. The claim is untouched, so envelopeId is identical.
interface CosignSignRequest extends Base {
  intent: 'cosign-existing';
  envelope: Attestation;                 // an already-signed envelope
}

interface SignGrant { v: 1; nonce?: string; envelope: Attestation } // success
interface SignDecline {
  v: 1; nonce?: string;
  reason: 'user_declined'|'invalid_request'|'unsupported_intent'
        |'unknown_kind'|'unknown_tier'|'invalid_envelope';
  detail?: string;
}
```

`origin` is what YOU claim to be (untrusted display); the wallet also shows the
`callback` host so the user can sanity-check. Always set a random `nonce` and
match it on the grant.

### Flow 1 — Sign in with Tapit (SSO). NO new wallet code needed.

Request an `attest` of a `meta` attestation:
`subject` = the user's pubkey; `fields` = `{ purpose:'session', app:'Trailhead',
nonce:<random>, issued_at:<ISO>, expires_at:<ISO> }`; `tier:'routine'`. On the
grant, Trailhead:
1. verifies the returned envelope's signature against the user's pubkey (`verifyEnvelope`),
2. confirms the `nonce` matches and `expires_at` is in the future,
3. treats that as a valid, short-lived, wallet-signed session. The wallet does
   NOT enforce expiry — Trailhead does.

### Flow 2 — Proof-of-presence (the wedge). Uses `cosign-existing`.

1. Guest taps "confirm my stay." Trailhead sends the GUEST's wallet an `attest`
   request for an `agreement` (or `relationship`) attestation: subject = a stay
   id, fields = `{ what:'confirmed stay', property:'Cedar Lodge', dates:'…' }`.
2. The guest approves; the grant returns the **guest-signed** envelope.
3. Trailhead sends the BUSINESS's wallet a `cosign-existing` request carrying
   that exact envelope. The business approves; the grant returns the **merged
   two-signature** envelope (same envelopeId, now guest + business).
4. Trailhead verifies it (`verifyEnvelope`, two signatures present) and stores
   it. That is a mutual, anchored-over-time proof the stay happened. Both the
   guest's and the business's wallets also hold a copy.

Over a season these accumulate into the business's verifiable reputation, and
the same `cosign-existing` "a witness co-signed this" primitive is what the
verified-knowledge / concierge-answer layer is built on later.

## Organization identity (know the seam)

A business ("Cedar Lodge") is itself a Tapit wallet — its own pubkey. Trailhead
only needs that **pubkey** to address co-sign requests to it; it never manages
the key. NOTE the current wallet reality: an org today is the owner's same key
self-declaring into org-mode; a separate-org-keypair-bound-to-owner with a
frictionless person↔org switch is a planned WALLET-side feature, not Trailhead's
to build. Design Trailhead to address a business by pubkey so it works under
either model.

## Smallest first slice to build FIRST

1. The deep-link client: build/encode a `SignRequest`, open `/sign`, parse the
   `grant`/`decline` from the callback, verify against the contract above.
2. Sign-in with Tapit (Flow 1) for the owner.
3. ONE end-to-end proof-of-presence round-trip (Flow 2): guest sign → business
   co-sign → verify → store.
Everything else (concierge AI content, the answer-verification commons, reviews,
reputation scoring) layers on after this round-trip works.

## Deferred / not in the first slice

- Push notifications ("a guest is waiting for your co-signature") — the wallet
  has no push yet; the co-sign request only surfaces when the business wallet is
  open. Plan a later native-shell or web-push path.
- The verified-answer knowledge commons (canonical questions, witness-signed
  answers, per-topic reputation) — the big follow-on; same `cosign-existing`
  atom underneath.
- FROST threshold org keys, NIP-46 transport — wallet-side roadmap.

## Doctrine echoes (carry these)

- The approval card in the wallet IS the product for the signing moment; on
  Trailhead's side, the guest must feel none of the crypto — a tap, a biometric,
  a friendly card.
- Verify, don't trust: re-run the math on every envelope you receive; never
  trust `origin` or a claimed pubkey without checking the signature.
- Keys never in this repo. Said twice on purpose.
