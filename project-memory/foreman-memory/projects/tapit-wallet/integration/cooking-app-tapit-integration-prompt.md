# Hand-off prompt — integrate the cooking app with Tapit Wallet

Give the block below to whoever (or whatever Claude Code / dev session) is
building the cooking app. It is written so the receiving assistant understands
both the GOAL and the exact wire protocol, and can implement it without ever
touching the wallet's code. Nothing needs to change on the Tapit side — the
pathway it describes is already built and live.

One thing to fill in before you send it: replace `<WALLET_ORIGIN>` with the
URL the Tapit Wallet is actually deployed at (the PWA's https origin). Everything
else is ready to paste.

---

## BEGIN PROMPT — paste this to the cooking-app builder

You are adding a "stamp this recipe" feature to a cooking app. Stamping means:
the user's own Tapit Wallet cryptographically signs the recipe and timestamps it
into the Bitcoin blockchain, so the recipe becomes a tamper-evident, independently
verifiable record — "this exact recipe existed, signed by me, as of this date,
provable against a Bitcoin block." On each recipe card we want a toggle that, when
on, shows a "Verified · Bitcoin block N" line and a one-tap link anyone can use to
re-check the proof. The user keeps the experience inside our app; the wallet is
just the thing that holds their key and does the signing.

### What Tapit Wallet is (the part you integrate with)

Tapit Wallet is a separate app (a web/PWA at `<WALLET_ORIGIN>`) that holds the
user's private signing key. **Private keys NEVER leave the wallet** — your app
never sees one. You hand the wallet a request describing what to attest, the user
approves it inside the wallet, and the wallet hands you back a signed, public
"envelope" (an attestation). That envelope is the stamp. This is the wallet's
"Layer 2 inter-app signing pathway," and in v1 it is a plain browser deep-link
round-trip — no SDK, no auth handshake, no library required.

### The flow (4 steps)

**Step 1 — Build a SignRequest.** A flat JSON object describing the attestation:

```json
{
  "v": 1,
  "origin": "Sofia's Kitchen",
  "intent": "attest",
  "kind": "journal",
  "tier": "routine",
  "subject": "Grandma's Sunday Sauce",
  "fields": {
    "title": "Grandma's Sunday Sauce",
    "ingredients": "tomatoes; garlic; basil; olive oil; salt",
    "steps": "1. Crush tomatoes. 2. Saute garlic. 3. Simmer 2h.",
    "yield": "4 servings",
    "recipeHash": "9f2c...e1"
  },
  "callback": "https://sofias-kitchen.app/tapit/return",
  "nonce": "a1b2c3-random-id"
}
```

Field rules (these are enforced by the wallet's strict parser — get them wrong and
the request is declined with a typed reason):
- `v` must be exactly `1`.
- `origin` — your app's display name. The wallet SHOWS it to the user on the
  approval screen but does NOT trust it; trust comes from the user approving and
  from the signature being verifiable afterward.
- `intent` must be `"attest"` (the only intent in v1).
- `kind` must be one of: `identity`, `relationship`, `credential`, `prediction`,
  `agreement`, `journal`, `meta`. Recipes have no native kind. Use `"journal"`
  for "I made / recorded this recipe on this date" (a dated personal record), or
  `"credential"` if you mean "I certify this as my recipe." Default to `journal`.
- `tier` must be one of: `routine`, `notable`, `high_stakes`. A recipe is
  `routine`. (Tier just flags stakes; it does not change the cryptography.)
- `subject` — non-empty string, the recipe name.
- `fields` — a FLAT object whose values are ONLY string, number, or boolean. No
  nested objects, no arrays. So flatten the recipe before sending: join the
  ingredient list and steps into strings (e.g. `"; "`-joined). Optionally include
  a `recipeHash` (a SHA-256 hex of your canonical recipe text) so the card can
  later show "this exact text is what's stamped."
- `callback` — a valid absolute URL the wallet will redirect the browser back to
  with the result. For a native app, use a universal / app link.
- `nonce` — optional but recommended: a random id you generate so you can match
  the response back to the request you sent.

**Step 2 — Open the wallet.** Base64url-encode the JSON and send the browser to:

```
<WALLET_ORIGIN>/sign?req=<base64url(JSON)>
```

(`window.location.href = ...` or `window.open` from a user tap.) The wallet opens
its approval screen showing your app name, the recipe fields laid out, and the
host of your callback URL so the user can sanity-check the destination. The user
taps Approve.

**Step 3 — Handle the callback.** The wallet signs the recipe (BIP340 Schnorr),
stores it, queues Bitcoin anchoring, then redirects the browser to your
`callback` URL with one of two query params:

- On approve: `?grant=<base64(JSON)>` where the JSON is
  `{ "v": 1, "nonce": "...", "envelope": <Attestation> }`.
- On decline: `?decline=<base64(JSON)>` where the JSON is
  `{ "v": 1, "nonce": "...", "reason": "...", "detail": "..." }` and `reason` is
  one of `user_declined`, `invalid_request`, `unsupported_intent`, `unknown_kind`,
  `unknown_tier`. Branch on `reason`; don't parse `detail`.

Decode the param with base64 + `JSON.parse`. (The grant uses standard base64 via
`btoa`; accept both base64 and base64url to be safe.) Check the `nonce` matches.

**Step 4 — Store the envelope on the recipe.** The `envelope` is the stamp. Persist
it next to the recipe. Its shape:

```ts
{
  v: 1,
  kind: "journal",
  tier: "routine",
  subject: "Grandma's Sunday Sauce",
  issuedAt: "2026-06-09T...Z",
  claim: { /* Merkle field-tree of your fields */ },
  signatures: [ { signer: "<user-pubkey-hex>", sig: "<schnorr-hex>" } ],
  anchor?: {                 // appears once anchoring is attached
    provider: "opentimestamps",
    digest: "<hex>",
    proof: "<hex>",
    status: "pending" | "confirmed",
    stampedAt: "...",
    confirmedAt?: "...",
    btcHeight?: 873123       // the Bitcoin block number — only when confirmed
  }
}
```

### The recipe-card toggle ("Verified · Bitcoin block N")

The toggle just shows or hides a proof line built from the stored envelope. Two
honest realities to build around:

1. **The block number is eventually-consistent, not instant.** At approve-time the
   envelope is already SIGNED (you can prove the user's key signed this recipe
   immediately), but the Bitcoin anchor is queued and confirms LATER — Bitcoin
   timestamping via OpenTimestamps typically takes a few hours. So the `grant` you
   receive will usually have `anchor` absent or `status: "pending"` with no
   `btcHeight` yet. Design the card for two states: "Stamped · awaiting Bitcoin
   confirmation" right after signing, then "Verified · Bitcoin block 873,123" once
   `anchor.status === "confirmed"` and `btcHeight` is present. To pick up the block
   number you re-check the proof later (see below) — the wallet attaches the block
   to its own copy automatically once Bitcoin confirms.

2. **Make "Verified" mean something — actually re-check, don't just trust the
   label.** Two ways:
   - **Link out (zero dependencies):** the wallet has a stateless public verifier
     page. Build a verify URL by base64url-encoding the envelope (or a disclosure
     proof of it) and linking to `<WALLET_ORIGIN>/verify?p=<base64url>`. Anyone —
     no login, no wallet — opens it and sees the signature checked and the Bitcoin
     block re-derived from the proof. This is the easiest "anyone can verify this
     recipe" affordance and is what the card's one-tap link should point to.
   - **Verify in-app (stronger, a dependency):** install the `tapit-attest`
     package and call `verifyEnvelope(envelope)` to confirm the signature locally,
     and `verifyAnchor(envelope, provider)` to re-derive the Bitcoin block height
     from the OTS proof. Use this if you want the badge state computed inside your
     app rather than by linking out.

The "hash minted in the chain" framing is literally true: your recipe's fields are
hashed into the attestation's digest, and that digest is exactly what
OpenTimestamps commits into a Bitcoin block. So "the hash of this recipe is in
Bitcoin block N" is an accurate, provable statement once confirmed — the toggle
just reveals that proof line.

### Hard constraints (don't fight these)

- Private keys never leave the wallet. You only ever get a public signed envelope.
- v1 transport is the browser deep-link round-trip only. (A Nostr NIP-46
  remote-signing transport is specced for later and would reuse these exact
  request/grant shapes, but it is not built yet — build against the deep-link.)
- `fields` are flat string/number/boolean only. Flatten arrays/objects to strings.
- `origin` is a display string, not a trust anchor. Trust = user approval + a
  verifiable signature + the Bitcoin anchor.
- Anchoring is asynchronous; treat the block number as eventually-consistent.

### Minimal reference code (request out, grant in)

```ts
// --- build & open ---
function b64url(s: string): string {
  const utf8 = unescape(encodeURIComponent(s));
  return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function stampRecipe(recipe: { title: string; ingredients: string[]; steps: string[]; yield?: string }) {
  const nonce = crypto.randomUUID();
  sessionStorage.setItem("tapit_nonce", nonce);
  const req = {
    v: 1,
    origin: "Sofia's Kitchen",
    intent: "attest",
    kind: "journal",
    tier: "routine",
    subject: recipe.title,
    fields: {
      title: recipe.title,
      ingredients: recipe.ingredients.join("; "),
      steps: recipe.steps.map((s, i) => `${i + 1}. ${s}`).join(" "),
      ...(recipe.yield ? { yield: recipe.yield } : {}),
    },
    callback: "https://sofias-kitchen.app/tapit/return",
    nonce,
  };
  window.location.href = `<WALLET_ORIGIN>/sign?req=${b64url(JSON.stringify(req))}`;
}

// --- handle the return on /tapit/return ---
function b64decode(s: string): string {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  return atob(t);
}
function handleReturn() {
  const q = new URLSearchParams(location.search);
  const granted = q.get("grant");
  const declined = q.get("decline");
  const expected = sessionStorage.getItem("tapit_nonce");
  if (declined) {
    const d = JSON.parse(b64decode(declined));
    return { ok: false, reason: d.reason as string };
  }
  if (granted) {
    const g = JSON.parse(b64decode(granted));
    if (g.nonce !== expected) return { ok: false, reason: "nonce_mismatch" };
    // g.envelope is the stamp — persist it on the recipe.
    return { ok: true, envelope: g.envelope };
  }
  return { ok: false, reason: "no_result" };
}
```

That's the whole integration. Build the request, open `/sign`, store the envelope
you get back, and let the recipe card show the signature now and the Bitcoin block
once it confirms — with a `<WALLET_ORIGIN>/verify?p=...` link so anyone can check it.

## END PROMPT
