# DESIGN.md — Tapit Wallet v1

**Status:** working design, derived from the operator conversation on
2026-05-21. This document supersedes the provisional 27-decision design
doc that was authored in the `tapit-attest` library repo under wrong
context. Where this conflicts with `DISCOVERY.md` or `PLAN.md`, this
wins; `PLAN.md` phases will be updated in the same session that lands
Phase 1 code.

---

## 1. The thesis (carried, sharpened)

Identity is not a row in someone else's database. It is a keypair on
the user's device plus the growing collection of signed attestations
they hold about themselves. The wallet is the Merkle holder. Math, not
trust, makes the attestations verifiable. One identity per person,
owned by them; every other app connects *to* the wallet to get
something signed.

The thesis enrichment from this session: **the user is the main
beneficiary of holding their own attestations.** Medical records,
identity, witness records from third grade kept by their parents, a
coach who saw them grow up — all of it stored as signed leaves the
user owns. Each leaf is a different domain of life; together they
form a taproot, and many taproots fit together into the mycelial
network of mutually-attesting wallets. The wallet is the soil this
grows in.

## 2. The reframe — identity is the attestations, not the key

The load-bearing design insight from this session: **the user's
identity is not the keypair, it is the chain of attestations.** Keys
can rotate; attestations persist. If a user loses their key but their
attestation history still exists in the network, their close friends
sign a "this is the new me" meta-attestation. The new keypair joins
the succession chain. To the outside world, identity is continuous;
only insiders know the key changed.

This makes traditional crypto-wallet panic ("I lost my seed and now I
am erased") into a manageable inconvenience. The wallet is not a
single point of failure — the network of attestations is. A wallet
that loses its key still has the user's identity intact, because the
identity lives in what other people have signed about that person.

## 3. v1 scope

A non-technical person installs the PWA, logs in with email magic
link, the wallet generates their keypair, they create their first
identity attestation, they back it up (cloud by default, local export
available, social recovery designated), they can selectively disclose
a single field (e.g., "over 21") to a verifier without revealing the
rest of their identity, and they can approve one signing request from
one other app. A parent can create custodial child keypairs from the
same wallet and hand them off to the child later.

**Out of v1:** the wallet bot, the Mycelium peer network (Layer 3),
group keys with FROST/MuSig2 quorums, charter governance,
silent-objection admission, Nostr NIP-46 (deeplink only in v1), voice
in/out, repudiation flow, per-field merge sync, recency decay /
transitive trust weighting.

## 4. Architecture

PWA-first. React 18 + Vite + TypeScript + Tailwind. Supabase for
magic-link auth and encrypted-blob sync — Supabase only ever holds
ciphertext; it cannot decrypt the user's wallet. Netlify hosting.
`tapit-attest` as a `file:` dependency at the repo root. The wallet
consumes the library; it never re-implements it.

Mobile-first, 375px design width, 44px tap targets. Service worker
for installability and offline-capable home screen. Feature-first
folder structure under `src/features/<slug>/` with a `manifest.ts`
per feature (per CLAUDE.md doctrine).

## 5. Auth and key generation

**Login:** Supabase magic link to the user's email. No password
forms. The user's password manager is not even involved — there is
no password to manage. The magic link establishes an authenticated
session.

**Key generation:** on first login after install, the wallet calls
`generateKeypair()` from `tapit-attest`, prompts the user for a
short passphrase (the only secret they must remember; can be as
simple as a memorable phrase), derives a key from passphrase +
per-wallet salt via PBKDF2, encrypts the wallet snapshot, stores the
ciphertext both locally (IndexedDB) and to Supabase (default ON).

**Lock model:** the wallet stays unlocked for the session once the
passphrase has been entered. Re-prompt for the passphrase on a fresh
browser session or after an idle timeout (default 30 minutes,
configurable). Biometric / WebAuthn unlock is a Phase 7+ nicety.

## 6. Backup and recovery — three layers

The user is forgetful by default. Recovery has to be layered.

### Layer 1 — Cloud-encrypted blob (default ON)

Supabase stores the ciphertext of the wallet snapshot keyed by user
ID. Encryption key is derived from the user's passphrase via
PBKDF2-SHA256 (library default). Supabase has the ciphertext + salt,
never the key. Cloud sync is the default because most people are
forgetful and a cloud copy is the cheapest insurance. User can turn
cloud sync OFF for a fully sovereign setup.

### Layer 2 — Local encrypted export

User can download an encrypted backup file at any time from
Settings. Same encryption scheme. Survives Supabase being gone or
the user moving off the cloud.

### Layer 3 — Social recovery via attesters

At onboarding, the user designates 5+ "close attesters" — pubkeys
of family and trusted friends. If the user loses both their key
*and* their backups, the recovery flow:

1. User opens a fresh wallet install and generates a new keypair.
2. New wallet broadcasts a signed recovery request: "this new key
   claims to be the same person as previous identity X."
3. Each designated attester receives the request (in v1, via an
   out-of-band link the user shares with them; later, via Mycelium
   network discovery, NFC bump per D24/D25, or push notification).
4. Each attester reviews and signs a `meta` attestation declaring
   "this new key belongs to the same person I knew as X."
5. Once N of M (e.g., 3 of 5, 5 of 20 — user configurable, sensible
   defaults shipped) signed approvals are collected, the wallet
   composes a multi-signed succession link binding the new key to
   the previous identity.
6. The succession chain absorbs the new key. To verifiers checking
   the chain, identity is continuous. The lost key is dead; the
   new key is the same person.

This is the operator's "bump with five of your closest friends and
get your identity back" recovery, made concrete. The NFC bump is a
post-v1 refinement of step 3, not a v1 requirement — in v1, social
recovery works over the open web with a shareable link.

**Default user posture:** cloud ON + local export available + social
recovery designated at onboarding. Most users will only ever touch
Layer 1. Layer 3 is the safety net for the worst day of someone's
life.

### A note on passphrase loss

Cloud backup is useless without the passphrase. So passphrase loss
triggers the same Layer 3 flow as key loss: social recovery
re-establishes identity, the user picks a new passphrase, the cloud
blob is re-encrypted under the new key. The user does not need to
remember the passphrase forever; they need to remember it OR have
attesters who know them.

## 7. Family mode

A parent wallet can create custodial child keypairs at any time. The
child's keypair sits inside the parent's wallet, encrypted under the
parent's passphrase. Every attestation about the child is signed by
the parent's key (or co-signed by both parents if both have wallets)
until the handoff moment.

**The family tree is just a tree of keys.** The parent is the root
node, the children are leaves, and the family as a whole fits into
the larger mycelial network the same way any other cluster does.
Family is not a special kind in the protocol — it is just a
naturally-occurring shape of attestations between custodian and
custodied keys.

**The child's attestation history starts at birth.** A birth
attestation signed by the parents lives in the parent's wallet under
the child's subject key. School enrollment, vaccinations, witnessed
milestones — every event in the child's life can be attested as
they go, the way a parent already keeps a baby book, but signed and
verifiable. By the time the child is old enough to want their own
wallet, they inherit a real provenance instead of starting at zero.

**Handoff** is a deliberate moment. Parent navigates to the child's
identity in the wallet, taps "Hand off to child," confirms. The
wallet exports the child's keypair + their attestation history as an
encrypted package the child imports into their own wallet on their
own device. The succession chain captures the handoff. The child's
identity is continuous from birth.

**The child's later choice.** Upon handoff, the child decides how
much to share with the network. They can carry all parental
attestations forward, or selectively inherit only the leaves they
want to keep. They can also fork — generate a fresh key with a
succession link to the inherited key, so verifiers walking the chain
still see the unbroken history but the child is operating from a
fresh keypair they chose themselves.

In v1 we ship: parent custody, parent-signed attestations about the
child, the handoff action, and the receive-handoff flow on the
child's wallet. Group keys with FROST quorums and silent-objection
charters are NOT v1 — those are Phase 8+.

## 8. Private by design — selective leaf disclosure

The library's Merkle field tree was designed for this from day one;
the `disclosureProof` slot in `core/field-tree.ts` is the v1.1 hook
the library already accommodates. The wallet implements the slot.

**The model:** every attestation is a Merkle tree of fields. When a
verifier asks for one attribute — "are you over 21," "is this your
medical license number," "are you the parent of this child" — the
wallet generates a proof that reveals only that leaf plus the sibling
hashes needed to verify it against the signed Merkle root. The
verifier checks the proof against the original signer's pubkey and
is satisfied; they never see the rest of the tree.

**v1 ships one concrete flow:** "prove I'm over 21" without
revealing birthday. The user taps a "Share Proof" button on their
identity card, picks "age over 21," and the wallet generates a
disclosure proof rendered as a copyable string and a QR code. This
proves the model. Every other "prove X without revealing Y" flow
inherits the same plumbing.

**The leaves the user accumulates over time** — birth year, address,
medical records, employer letters, witness attestations, agreements
— are all just leaves on different attestation trees rooted at the
user's identity. Sharing is always a deliberate, narrow act: pick
the leaf, generate the proof, hand it to the verifier. The whole
tree never leaves the wallet.

## 9. UI principles — zero friction, zero complexity

1. **One-tap install.** PWA installable from the browser. No app
   store. Works offline after first load.
2. **Email magic link.** No password forms. Supabase handles it.
3. **One home screen.** The entire surface in v1 is one scrollable
   home. No tab bar, no drawer, no nested navigation. An identity
   card at the top, attestation cards below, a "+" floating action
   button to add attestations. Settings is a single screen reached
   from a gear icon in the corner.
4. **Cards, not chrome.** Every attestation is a card. The user
   sees their stuff, not menus.
5. **Plain English everywhere.** Sign requests render as "Acme
   Insurance is asking you to confirm you are over 21" — never a
   JSON dump or a hex string.
6. **Approval screens with two buttons.** Approve or Decline. No
   third option, no "advanced" toggle, no JSON inspector.
7. **No bot in v1.** Onboarding is a four-screen guided tour with
   skip-to-end. Inline help text where needed. The bot is a Phase
   8+ nicety we will reconsider once v1 is in users' hands.

## 10. Build phases

### Phase 1 — PWA shell + email auth + key generation (1 session)

- Vite + React + TypeScript + Tailwind project shell.
- Supabase magic-link auth (`@supabase/supabase-js`).
- `tapit-attest` wired as `file:` dependency.
- PWA manifest + service worker for installability.
- On first login: prompt for passphrase, call `generateKeypair()`,
  encrypt snapshot, store locally (IndexedDB) and remotely (Supabase
  encrypted blob).
- Home screen: empty identity card with the user's pubkey
  displayed.
- Gates green (typecheck, lint, test, build).
- **Proof:** install the PWA, log in via magic link, see your pubkey
  on the home screen, reload — wallet decrypts from local store
  with passphrase, you are back.

### Phase 2 — Identity attestation + backup posture (1 session)

- First-run flow: user enters display name → wallet creates a
  self-signed `identityAttestation` with display name + creation
  date + pubkey as leaves.
- Attestation appears as a card on the home screen.
- Settings screen: cloud-backup toggle (default ON), local export
  button (downloads encrypted blob), backup status banner on home
  screen if backup is stale.
- **Proof:** create an identity, see it on home, toggle cloud OFF
  and back ON, download a local backup file.

### Phase 3 — Social recovery designation + simulated recovery (1 session)

- User designates 5+ trusted attesters by pubkey (in v1, typed-in;
  Mycelium-driven contact discovery is later).
- Each designated attester gets a recovery-attestation grant
  letter the user can share out-of-band.
- Simulated end-to-end recovery flow: from a fresh wallet
  instance, broadcast a recovery request, collect N of M `meta`
  approvals from designated attesters, succession-link the new key
  into the chain, confirm identity continuity in a verifier view.
- **Proof:** complete a full social recovery cycle in a dev
  environment with two browser profiles representing two
  attesters.

### Phase 4 — Selective leaf disclosure (1 session)

- Implement `disclosureProof` in `tapit-attest`'s
  `core/field-tree.ts` (the v1.1 slot the library was designed
  for). Add to the wallet's bundled library copy.
- "Share Proof" button on the identity card. Picker for which
  leaf to prove. Output: a copyable proof string + QR code.
- A companion `/verify` route in the same PWA that validates a
  pasted proof against a known signer pubkey.
- **Proof:** generate a "prove I'm over 21" proof, paste it into
  `/verify` in another browser, see it validate.

### Phase 5 — Inter-app sign request via deeplink (1-2 sessions)

- A third-party app constructs a `tapit://sign?...` deeplink (or
  `https://<wallet-host>/sign?...` for web).
- Wallet renders a plain-English approval screen showing what is
  being signed, what fields are involved, who is asking.
- Approve → wallet signs, returns the signature via a callback URL
  the requesting app supplied.
- Decline → wallet returns a structured decline message.
- Nostr NIP-46 transport sits behind a feature flag, OFF in v1.
- **Proof:** a stub third-party demo page constructs a sign
  request, the wallet handles it end-to-end.

### Phase 6 — Family-mode custody (1-2 sessions)

- "Add child" flow under Settings. Parent enters child's name +
  birth date.
- Wallet generates a child keypair, stores it encrypted under the
  parent's passphrase.
- Parent can sign attestations about the child (birth, vaccination,
  school enrollment) — each lists the child as subject and the
  parent as signer.
- Child's attestations appear as a separate card cluster on the
  home screen labelled with the child's name.
- "Hand off to child" button: exports the child's seed +
  attestation history as an encrypted package, with a confirmation
  step and a printable recovery card.
- A receive-handoff flow on a fresh wallet install that imports an
  encrypted handoff package.
- **Proof:** parent creates a child, signs a birth attestation,
  hands off to a fresh wallet instance, child wallet shows the
  inherited identity and attestation history.

### Phase 7+ — explicit non-goals for v1

- Wallet bot (conversational guide).
- Mycelium peer network (Layer 3) — wallet-to-wallet contact
  discovery, transitive trust weighting.
- Group keys with FROST / MuSig2 quorums.
- Charter governance, silent-objection admission.
- Nostr NIP-46 transport (deeplink only in v1).
- NFC tap-to-cosign and tap-to-bump-for-recovery (D24, D25).
- Voice input/output.
- WebAuthn / biometric unlock.

## 11. Library cherry-pick (one-time, before Phase 1)

Apply the upstream zero-point-one-point-one sign-poisoning fix to
`tapit-attest/src/core/keys.ts` `verifyEnvelope`. Change semantics:
valid if at least one signature verifies; invalid signatures are
reported but ignored. Adjust the existing tests and add a regression
test for the relayed-junk-signature case. Bump the wallet's bundled
library version to `0.1.1-wallet.0` to mark the divergence.

This is the one piece of code worth cherry-picking out of the
uploaded zip — every other change in the upstream timeline has been
superseded by work already in the wallet's bundled copy.

## 12. Open questions to revisit as they bite

- **Social recovery N-of-M defaults.** Lean: 3 of 5 as the shipped
  default with a slider for user configuration up to 5 of 20.
- **Co-parent co-signature on child attestations.** Lean: optional
  in Phase 6; both parents can sign but a single-parent signature
  is also accepted. A future "high-stakes child events require
  both parents" toggle is a polish slot.
- **Verifier surface.** Lean: the wallet PWA ships a `/verify`
  route as a companion, no separate app in v1.
- **Idle timeout default.** Lean: 30 minutes, user configurable
  from 5 min to "never until browser close."
- **Recovery request transport in v1.** Lean: a shareable web link
  the user sends to attesters via whatever channel they already
  use (text, email, in person showing a QR). Out-of-band in v1,
  Mycelium-discovered in Phase 8+.

## 13. Carried provisional notes from the library-context design doc

The 27 D-decisions authored in the library repo are treated as
**provisional context**, not locked decisions. Several remain
relevant to v1 and inform this design (D5 PWA-first, D7 no Bitcoin
script, D23 deterministic key derivation for child custody, D26
opinionated mycelium category defaults). Several are explicitly
deferred (D2 group keys, D14–D22 group governance, D8 relay
pointers). All of them get revisited in their proper place once v1
is in users' hands and the wallet has its own ground-truth
experience to argue from.

The full provisional context lives in the uploaded zip under
`SESSION_HANDOFF.md` and the larger DESIGN/DATA_MODEL docs. We are
not importing those verbatim. Specific entities (`WalletIdentity`,
`KeystoreRef`, `InboxItem`) will be re-derived in this wallet repo
as the phases that need them land, with the library-context spec as
one input among several.
