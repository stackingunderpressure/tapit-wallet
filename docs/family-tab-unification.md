# Family-tab unification — household ↔ tree, the de-dup plan

> Follow-on to the 2026-06-26 "one super Family tab" relocation (commit
> on branch `claude/unfinished-work-branches-8dwbby`). That cut put both
> family models under one tab. This doc plans the deeper fix: stop making
> a person exist *twice*. Grounded in the real envelope models; no code
> shipped yet.

## The two models, precisely

| | **Household** (family unit) | **Tree** (genealogy) |
|---|---|---|
| Code | `connections/familyUnit.ts`, `FamilyIdentitySections` | `family-tree/*`, `FamilyTreeEditor` |
| Envelope | one `credential` kind, `credential_type=family_unit` | many `personNode` + `kinEdge` envelopes |
| "Who" is stored as | a single JSON leaf: `members[]` of `{pubkey, name, role, as_of}` | one envelope per person; graph identity is `envelopeId` |
| Requires a wallet? | **Yes** — every member has a 64-hex `pubkey` and co-signs | **No** — most ancestors are keyless; `keyed_pubkey` is optional |
| Unique value | a **multi-party ratified agreement** (N-of-M signed "we are a household") | a **navigable map** (lineage, derived relationship names, keyless ancestors, stories) |

They are not duplicates — one is an *agreement*, one is a *map*. The
redundancy is that **a keyed living person you put in both must be
entered twice**, and the two entries never reconcile.

## The key finding — the join already exists

Both models key a *keyed* person by the **same value**: the genesis
wallet pubkey, lowercased.

- Household: `member.pubkey` = `wallet.identity.toLowerCase()` (and peers'
  genesis identities from connections) — see `StartFamilyModal.tsx`.
- Tree: `personNode.keyed_pubkey` = that person's wallet pubkey,
  lowercased — see `personNode.ts`.

So **a household member and their tree node can be matched today, with no
format change, by `member.pubkey === node.keyedPubkey`.** This is the same
join the app already trusts for key-alias resolution, and it is stable
across key rotation because both sides anchor on the genesis identity
(the household already threads `keyHistory` aliases for signature checks).

This lowers the risk I flagged in the relocation commit: the first and
biggest chunk of the de-dup needs **zero** changes to any signed envelope.

## Three tiers, cheapest first

### Tier 1 — read-side join + cross-surface (NO format change) ← recommended next

Pure rendering/affordance work on top of data that already exists.

1. A pure helper `joinHouseholdToTree(familyUnits, personNodes)` that, for
   each household member, finds the person-node whose `keyedPubkey`
   matches `member.pubkey` (or `undefined` if the person isn't in the tree
   yet). Unit-tested, no I/O.
2. **Household sub-view:** each member row gets an "In your tree ✓" badge
   when matched, or an "+ Add to tree" action when not — which calls the
   existing `createPersonNode` (keyed to that pubkey) so they appear in the
   tree without re-typing anything.
3. **Tree person detail:** a keyed node that matches a household member
   shows a "Household: <family name> · <role>" line, linking back.
4. **Shared add path:** when you add a keyed living person in either place,
   offer (don't force) to mirror them into the other. One picker, two
   models, no double entry.

Kills the double-*entry* friction — the thing that actually annoys — while
both envelopes keep their current bytes. Smallest useful correct cut.

### Tier 2 — additive `node_id` link leaf (backward-compatible)

Add an **optional** `nodeId` (the person-node `envelopeId`) to
`FamilyMember`. Because the member list is already a single JSON-encoded
leaf, adding an optional field is additive: old signed family units still
parse and still verify (their leaf bytes are unchanged); only newly signed
units carry it. This is the exact backward-compatible pattern the journal
already used when `subject_node` was added (see family-tree manifest).

Why bother beyond Tier 1's pubkey match? Two edge cases: (a) binding a
household member to a *specific* node when a person was first witnessed in
keyless and later got a wallet (the keyless→keyed transition the
person-node model explicitly anticipates), and (b) surviving a future where
a household could name someone who has a tree node but no wallet. Lower
priority than Tier 1; do it only if those cases show up in field use.

### Tier 3 — one source of truth (the real merge, deferred)

The household stops storing member `name` (and maybe `role`) inline and
instead references tree `node_id`s, deriving display from the node. The
agreement envelope then carries only: the node references, the roles, the
`as_of` dates, and the ratification signatures. This is the true
single-source design, but it is a genuine redesign of the family-unit
shape and its ratification flow (keyless nodes can't sign, so a household
is structurally the *keyed subset* of the tree). It needs its own cut with
explicit format versioning and a migration story for existing ratified
units. Not now — named so it isn't lost.

## Recommendation

Build **Tier 1** as the next family cut: it removes the double-entry pain,
touches no signed format, no migration, and is fully testable as pure
helpers plus UI. Hold Tier 2 until a keyless→keyed case actually appears.
Treat Tier 3 as a deliberate future redesign, not a quiet edit.

## Wedge check

Already-solved? No — generic apps store "family" once and flat; nobody
reconciles a *co-signed household agreement* against a *sovereign
genealogy* a person holds themselves. Wedge or plumbing? Wedge — it's the
"your family, entered once, true in both the agreement you signed and the
map you keep" experience. A dime tomorrow? No — this is specific to our
two-model design. Human value + brand gap? High — it's the difference
between two confusing lists and one coherent family the user owns.
