# Open-joining and configurable membership-policy roadmap (2026-05-25, deep evening)

> Status: SKETCH for operator review. Companion to
> `MYCELIUM_NETWORK_SPEC.md` §6 (organizations and membership) and
> `2026-05-25-tapscript-style-org-authorization-tree-roadmap.md`
> (the canonical org-control substrate, Phase A shipped tonight on
> commit 4eaeba8).
>
> Authored 2026-05-25 deep evening after the operator surfaced a
> new product direction: anyone can start an org with no separate
> login, and anyone can JOIN an org without the org having to
> issue per-member credentials. The roster shows who was original,
> who joined later, in chronological order. The Mycelium spec's
> §6 names the org-issuance model explicitly ("an organization
> does one new thing: it issues membership attestations"), so
> this brief extends §6 with a NEW dimension: member-initiated
> joining, gated by a per-org configurable join-policy that lives
> in the auth tree we just shipped.

## What this finishes

Three product properties the operator named in chat that the
current shipped wallet does not yet support:

1. **Anyone can join an org** without the org's wallet having to
   sign per-joiner. Today's `createMembership` is org-issued —
   the org's signature on the credential is what makes a member
   a member. Open-joining flips that direction: the JOINER signs
   a self-claim membership, and the org's join-policy in its
   auth tree decides whether that self-claim is valid.

2. **Chronological roster — original member, then who came
   later** — auditable from the join attestations' own Bitcoin
   anchor heights (`btcHeight` on each envelope's anchor field),
   so the "who came first" property is provable from the existing
   anchoring substrate without any new clock.

3. **No separate login for orgs unless wanted.** Already true:
   any existing wallet can declare itself an org via
   `selfDeclareOrganization` (Settings → "Declare this wallet as
   an organization"), AND any operator can spin up a fresh
   Supabase email-signup that produces a fresh wallet which then
   declares itself an org from scratch. Two paths, both shipped.
   This brief does NOT change the auth model.

The configurable-per-org abuse-resistance posture lets each org
declare its own join-rule at creation time — fully open,
require-a-handshake-with-an-existing-member, allow-list,
deny-list, require-credential-X, etc. — and the rule lives in
the auth tree as an additional `{action: "join", ...}` leaf
alongside the existing `routine_issuance`, `expulsion`,
`charter_amendment` rules.

## Operator-locked decisions (2026-05-25 deep evening chip session)

1. **Per-org configurable join-policy.** Each org declares its
   own join-rule at creation time and may amend it later via
   the charter-amendment path (Phase D of the canonical Tapscript
   brief). Different orgs can have different policies in the
   same wallet on the same network.

2. **Join-rule lives in the auth tree.** The substrate is the
   Tapscript-style authorization tree shipped in Phase A. A
   `join` action joins the existing rule set (routine_issuance,
   expulsion, charter_amendment, dissolution) — the verifier
   reads the org's auth tree at verify time, finds the join
   rule, and applies it to incoming self-claim memberships.

3. **Substrate decision deferred.** Three options (below) for
   HOW the self-claim joining actually flows; operator will pick
   via chip after reading this brief. All three are compatible
   with the configurable-policy framing.

4. **No new auth model.** Personal wallet → declares-an-org and
   fresh-Supabase-signup → declares-an-org both continue to work
   exactly as shipped. No special "org account" type.

## The three substrate options (DEFERRED — operator picks after brief)

### Option 1: Org auto-publishes a roster

**Flow.** Joiner signs a credential-kind attestation:
`subject = joiner, fields = { credential_type: "self_membership",
org_id, joined_at, requested_at }`, signed by the JOINER's
wallet. Sends it over Mycelium to the org's wallet's inbox. The
org's wallet auto-evaluates the request against its declared
join-rule (handled in the inbox routing the same way Phase 5c-i-ε
auto-routes handshakes / memberships / recovery shares today).
If the join-rule says yes, the org's wallet adds the joiner to a
running roster and periodically republishes a roster envelope
listing every accepted member in chronological join order. The
roster envelope itself is anchored to Bitcoin; the verifier
reads the latest roster as the canonical membership list.

**Cost.** The org's wallet needs to be online occasionally to
process joins and republish the roster. Practical for orgs with
a human founder running a device; awkward for "leaderless" orgs.

**Win.** Single auditable artifact per roster snapshot. Easy
verifier UX — just hold the latest roster envelope, walk the
member list. Naturally chronological because each roster
snapshot orders by joined_at and is anchored as one envelope.
Honest about acceptance — the org SAID yes by publishing.

### Option 2: Org pre-signs an open-membership policy

**Flow.** Org's auth tree at creation time includes a rule like
`{ action: "join", threshold: 0, eligible: ["*"] }` — wildcard
eligible, zero-threshold (no per-join org signature needed).
Joiner signs a self-membership attestation locally and just
HOLDS it; no message to the org needed. When the joiner wants
to PROVE membership later, the proof bundle carries: the
self-membership credential + a disclosure proof of the org's
`join` rule from its auth tree + the org's self-declaration
itself. Verifier reconstructs the auth-tree root from the
disclosure proof, confirms the join rule says open, and accepts
the self-signed membership.

**Cost.** Verifier does more work — walks the auth tree, reads
the rule, applies it. The wallet needs to hold the org's
self-declaration to verify any open-joined member. Roster is
NOT a single artifact — it's the SET of self-memberships in the
wild, which is harder to enumerate ("how many members does the
American Legion have" is unanswerable without a directory).

**Win.** Truly leaderless. The org's wallet never has to be
online for anyone to join. Spam-resistance lives in the join-rule
itself (allow-list, credential-required, etc.) rather than at
the org's gatekeeping action. Maximally decentralized.

### Option 3: Hybrid — both proofs valid

**Flow.** Joiner self-signs (same as Option 2). Joiner ships
the self-membership to the org's wallet over Mycelium (same as
Option 1). If the org is online and the join-rule auto-accepts,
the org adds the joiner to its next roster snapshot. If the org
is offline (or never publishes a roster), the self-membership
still verifies against the auth-tree open-membership rule
(Option 2 path). Both proofs are valid; the verifier accepts
whichever it can construct.

**Cost.** Two parallel verification paths to test against. More
test discipline; more abuse surface (a joiner might be on the
roster AND have a self-claim, both proofs disagreeing — verifier
must define precedence).

**Win.** Best UX. The org's online-presence becomes a
performance optimization (rosters consolidate; verifiers prefer
one envelope to many) rather than a correctness requirement.
The org can choose to be "leaderless when offline, authoritative
when online" without losing the membership integrity either way.

## How the join-rule slots into the Tapscript auth tree

The join-rule is an additional rule leaf in the auth tree we
just shipped. Its shape extends `AuthRule` to carry a
**joiner-side** specification rather than the **signer-side**
threshold the existing rules carry. The cleanest expression is
a discriminated union:

```ts
// Existing — for org actions (issuance, expulsion, amendment)
interface AuthRuleForOrgAction {
  action: 'routine_issuance' | 'expulsion' | 'charter_amendment' | string;
  threshold: number;       // signatures required FROM ELIGIBLE
  eligible: readonly string[]; // pubkeys whose sigs count
}

// New — for member-initiated joining
interface AuthRuleForJoin {
  action: 'join';
  policy:
    | { kind: 'open' }                            // anyone with a wallet
    | { kind: 'allow_list'; pubkeys: string[] }   // pre-approved
    | { kind: 'deny_list'; pubkeys: string[] }    // anyone except these
    | { kind: 'requires_handshake'; with_any_of: string[] } // must hold a Tier P / R handshake with at least one of these pubkeys
    | { kind: 'requires_credential'; credential_type: string; issuer?: string } // must hold a specific credential
    | { kind: 'requires_vouch'; from_any_member_count: number }; // existing members can vouch via cosig
}
```

The on-disk encoding remains a single field-tree leaf per rule
(canonical JSON of the rule body, action as the leaf name) so
`disclosureProof` and `verifyDisclosureProof` still work
unchanged. The discriminated-union shape only matters at the
type level; at the substrate level, it's still
`{action, ...payload}` as JSON.

The Phase A code in `createOrganization.ts` will need
extension to recognize the join-rule shape during
`encodeAuthRuleValue` / `decodeAuthRuleValue`, but the field
tree itself stays uniform.

## Roster chronology mechanism

Both Option 1 and Option 2 surface the same "who came first"
property via Bitcoin anchor heights:

- Each self-membership envelope and (under Option 1) each
  roster snapshot envelope is anchored to Bitcoin via the
  existing OpenTimestamps worker (`anchorQueue` + the worker
  feeding it).
- A verifier ordering members by their self-membership
  envelope's `anchor.btcHeight` gets the canonical chronological
  order — provable, sovereign, no central clock.
- Under Option 1, the roster snapshot itself imposes an
  EXPLICIT order via the order-of-members in the canonical-JSON
  members list. The org's wallet sorts by `joined_at` at
  publication time, and the canonical-JSON encoding of the
  sorted list is what gets hashed into the Merkle root.

The founder (the wallet that issued the self-declaration) is
always "member #0" — their declared_at is earliest, their
anchor block is earliest, every subsequent join is by definition
later.

## The dual-account model — confirmed unchanged

Two paths to "be an org" exist today and stay unchanged:

1. **Your existing personal wallet hosts the org.** Open the
   app on your existing Supabase login, declare your wallet
   an organization via the Settings form. Your personal identity
   and your org identity share a keypair. The simpler path; the
   org's signature IS your signature.

2. **Fresh signup hosts a dedicated org wallet.** Sign up with a
   fresh email, get a fresh wallet, declare it as the org from
   scratch. The org has its own keypair, separate from any
   founder's personal identity. The more sovereign path; useful
   when the org should outlive the founder or be transferred.

Neither path requires special "org account" plumbing. The wallet
is wallet-shaped regardless of whether its self-declaration
names it an organization. This brief does not change that.

## The four phases (in order)

Phase E follows the existing Phase A–D arc of the Tapscript-style
brief. Depends on Phase A (shipped) and Phase B (verifier — not
yet shipped). Can run in parallel with Phase C / D.

### Phase E1 — Join-rule shape in the auth tree

Extends `AuthRule` to the discriminated-union shape above.
Updates `encodeAuthRuleValue` / `decodeAuthRuleValue` /
`buildAuthSubtree` to recognize the new rule kinds without
breaking the existing org-action rules. Tests for each policy
kind round-trip. No verifier yet, no UI yet — just the data
model.

About one session.

### Phase E2 — Joiner-side self-membership + transport

New helper in `createMembership.ts` (or a new
`createSelfMembership.ts` sibling — file-size headroom decides):
`buildSelfMembershipDraft(joiner, orgId, orgName)` that produces
an unsigned credential-kind attestation with
`credential_type: "self_membership"`. Joiner signs it locally.
The wallet ships it to the org's inbox over Mycelium when
Mycelium transport is on; otherwise it sits in local holdings
as a "pending" self-membership.

Phase 5c-i-ε inbox routing extended to recognize incoming
self-membership envelopes and route them to a new acceptor
handler.

About one session.

### Phase E3 — Org-side acceptor + roster publication (Option 1
substrate work, or skipped if Option 2 is chosen)

Org wallet's inbox handler evaluates each incoming
self-membership against the declared join-rule. If accepted, the
envelope is added to a pending-roster buffer. The wallet's
periodic roster-publish job (new — or triggered manually via a
"publish roster" UI button) sorts the buffer by `joined_at`,
canonical-encodes the member list, signs and anchors a new
roster envelope. Latest-by-issuedAt wins, same pattern as
officials-roster today.

If the operator picks Option 2, this phase is largely SKIPPED —
the verifier-side work (Phase E4) carries the full weight.

About one to two sessions for Option 1.

### Phase E4 — Verifier + UI

Verifier helper:
`verifyOpenJoinedMembership(envelope, orgSelfDecl, currentRoster?)`
that reconstructs the org's join-rule from the auth tree (via
the Phase A `findAuthRule` helper), applies the rule to the
self-claimed envelope, and returns valid/invalid + reason. Under
Option 1, the verifier ALSO consults the latest roster envelope
and confirms the joiner is listed. Under Option 2, the verifier
relies purely on the rule + the self-claim. Under Option 3, the
verifier accepts whichever proof checks out.

UI:
- Org creation form gains a "membership policy" picker (open,
  allow-list, requires-handshake, requires-credential, etc.).
- Org-mode home gains a "Members" view that renders the
  chronological roster — founder first, joiners after, sorted
  by anchor height. Already-built `MembershipCard` reused.
- Any-wallet's profile gains a "Join an org" flow: paste org
  pubkey or scan QR, see the org's declared join-policy, click
  Join, the self-membership envelope is signed and shipped (or
  held, depending on substrate).

About two to three sessions.

## What is NOT in this roadmap

- **Per-member-tier roles (admin vs regular member).** The
  Mycelium spec's officials-roster already covers the
  "officers" tier. Open-joining ships the regular-member tier;
  layering additional tiers (board members, founding members,
  honorary members) is deferred.
- **Cross-org invitations / federation.** "American Legion
  invites the local VFW chapter to join the parent org" — same
  shape as a single-person join but the joiner is itself an
  org-wallet. Mechanically the same envelope type; the multi-org
  UX is a follow-on.
- **Revocation of self-memberships by the org.** If a member
  misbehaves, the existing `expulsion` rule (from the canonical
  Tapscript brief Phase D) handles this — the org publishes an
  expulsion envelope that the verifier honors. NOT a new
  mechanism here.
- **Membership without anchoring.** Every self-membership
  envelope goes through the existing OpenTimestamps anchoring
  worker. A self-membership not yet anchored is "pending"; the
  chronology property holds at confirmed-only.
- **Sybil resistance at the substrate.** The "Configurable per
  org" decision locked tonight pushes Sybil resistance into the
  join-rule, where it belongs. An org that wants Sybil
  resistance picks a join-rule that requires it
  (`requires_handshake`, `requires_credential`, `requires_vouch`).
  The substrate itself stays neutral.

## Prerequisites + risk surface

- **Phase B verifier (canonical Tapscript brief) is a
  prerequisite.** Phase E4's
  `verifyOpenJoinedMembership` calls into the same
  `verifyOrgAuthorization` primitive Phase B ships. Building
  Phase E without Phase B means duplicating verifier logic;
  recommend Phase B lands first.
- **The dual-substrate decision (Option 1 vs Option 2 vs
  Option 3) shapes Phase E3.** If Option 2 is chosen, Phase E3
  is mostly skipped and Phase E4 grows. If Option 1, Phase E3
  is heavier. If Option 3, both phases happen but with shared
  helpers. The brief is honest about this; the operator picks.
- **Roster snapshots and Bitcoin anchoring.** Under Option 1,
  the roster envelope itself anchors to Bitcoin. Each roster
  publication is one anchoring event. Frequent roster updates
  mean frequent anchor events; this is fine for the existing
  worker but worth noting for orgs that expect rapid growth.
- **Verifier correctness on cross-envelope binding.** The same
  Phase B risk surface flagged in the canonical Tapscript brief
  applies here — the join-rule disclosure proof is a
  cross-envelope artifact (envelope X carries a proof of one
  leaf from attestation Y) and the four forgery classes
  (leaf-value, wrong-org-binding, tampered-path, tampered-meta)
  all apply. The fuzz tests written for Phase B cover Phase E.
- **No new cryptography.** Every primitive this brief needs is
  already shipped or scheduled to ship in Phase A/B of the
  canonical Tapscript brief. Zero new tapit-attest code, zero
  new dependencies.

## Estimated calendar

| Phase | Sessions | Calendar |
| --- | --- | --- |
| E1 — Join-rule shape in auth tree | 1 | 1-2 days |
| E2 — Joiner self-membership + transport | 1 | 2-3 days |
| E3 — Org-side acceptor + roster publication (only if Option 1 or 3) | 1-2 | 3-5 days |
| E4 — Verifier + UI | 2-3 | 1-2 weeks |
| **Total arc** | **5-7 sessions** | **~2-3 weeks** |

Calendar overlaps with the existing Tapscript A–D arc; some
phases can run in parallel (E1 alongside B; E2 alongside C; E4
alongside D). The realistic total post–Phase A landing is
around 3-4 weeks for the full open-joining + auth-tree + charter
arc combined.

## Approval gate

Operator picks the substrate (Option 1 / 2 / 3) via chip after
reading this brief. Substrate choice locks Phase E3's scope.
Then I cut Phase E1 in the next dispatch (1-2 days, no
substrate dependency — the join-rule shape extension works
regardless of Option 1 / 2 / 3). The
`2026-05-25-tapscript-style-org-authorization-tree-roadmap.md`
brief stays canonical for the org-control axis; this brief
becomes canonical for the membership-acquisition axis. Both
briefs live side-by-side in the briefs folder, neither
superseding the other.
