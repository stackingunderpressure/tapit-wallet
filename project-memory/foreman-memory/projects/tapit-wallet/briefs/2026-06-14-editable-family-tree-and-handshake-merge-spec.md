# Spec — the editable family tree + handshake-merge + memory reconciliation

Date: 2026-06-14
Author: carpenter, from the operator's 2026-06-14 riff ("I want it where I can
edit the family tree the way I see it… I inherit all of the family tree… the
handshake says this one connects through Pam… if there's a difference in memory
the wallet surfaces it to both… not just a living graph but all of it").
Grounded against connections/peopleTreeLayout.ts + connections/familyUnit.ts +
createHandshake.ts on this date. Smallest-useful-first per the Prime Directive.
Slots after the event/memory keystone in the ultimate cut list.

---

## THE VISION (operator, one breath)
One editable family graph that holds the WHOLE family — living and deceased,
immediate and distant — that I fill in as I know it (mom, dad, siblings,
grandparents, great-grandparents, aunts, uncles, cousins), and that GROWS when I
handshake a relative: the wallet sees we overlap through a shared person ("this
connects through Pam"), merges what they've already filled in, and now I inherit
branches I never had — a great-great-grandpa who was a WWII vet I get to read
about and "meet." When two of us remember a detail differently, the wallet
surfaces the discrepancy to both and we agree, or agree to disagree. Not just
when someone dies, not just the living — all of it, and how it connects.

## WHAT ALREADY EXISTS (build on, cited)
- connections/peopleTreeLayout.ts — radial PeopleTree layout: operator at center,
  handshake peers on a ring, classified by relationship category (family/friend/
  …), deterministic positions. The visualization substrate.
- connections/familyUnit.ts — a multi-party CO-SIGNED family-unit envelope:
  members carry {pubkey, name, role, as_of} where role ∈ {dad,mom,parent,spouse,
  child,sibling} and as_of is a backdated join date. The whole family co-signs ONE
  envelope so EVERY member's wallet holds the full unit — "PeopleTree v2 will
  branch a family node into its members" is already the stated next step.
- createHandshake.ts — relationship attestations (Tier P/R), kin labels
  (spouse/child/parent/sibling/family), isFamilyRelationship, readHandshake,
  displayNameOf. The living-edge substrate.
- journal subject-as-typed-label — lets an entry be ABOUT a keyless person (built
  for the grandchild-from-birth case; works identically for ancestors).
- cosigning/mergeSignatures — multi-party co-sign; the merge primitive.

## THE THREE HONEST HARD PARTS (name them up front)
H-A. KEYLESS PERSON-NODES. Grandpa/Pam hold no wallet and never will. familyUnit
   members are keyed (pubkey-per-member). A tree of ancestors needs a person-node
   that exists WITHOUT a key — a witnessed node (asserted by the living, family-
   co-signed). Same gap as the Pam-node mockup. This is the foundational unlock;
   nothing else works without it.
H-B. EXTENDED + RECURSIVE KIN. Today's role vocab is immediate-family only
   (dad/mom/parent/spouse/child/sibling). The tree needs grandparent, great-
   grandparent (×N), aunt, uncle, cousin — i.e. a RELATIONAL/RECURSIVE structure
   (edges between person-nodes), not a flat member list. Cleanest model: store
   PARENT-OF edges between nodes; derive grandparent/aunt/cousin from graph walks
   rather than enumerating every label. (parent-of is the one primitive edge;
   everything else is computed.)
H-C. CROSS-TREE MERGE BY OVERLAP (the entity-resolution problem). When I handshake
   my aunt, how does the wallet know HER "Grandma Pam" node is the SAME node as
   MY "Grandma Pam"? The anchor is the SHARED KEYED PERSON — my aunt is a keyed
   node in both trees — plus explicit confirmation on the keyless overlaps. You
   cannot auto-merge keyless nodes on name alone (two "John Smith"s aren't one).
   The honest design: the handshake establishes the keyed link; then the wallet
   PROPOSES candidate overlaps ("you both descend from a 'Pam' via your shared
   link — same person?") and a human CONFIRMS the merge. Confirmed merges can be
   family-co-signed so the canonical node accretes weight. No silent auto-merge.

## DATA MODEL (smallest correct shape)
- PersonNode: a witnessed person record. {node_id, display_name, birth?, death?,
  keyed_pubkey? (present iff they have a wallet), notes-as-attestations}. Keyless
  ancestors have no keyed_pubkey; living members do. A node is established by a
  family-co-signed "this is <person>" anchor attestation (answers the parked
  dedupe question: YES, a canonical co-signed anchor per person so stories +
  edges attach to ONE id).
- KinEdge: ONE primitive — parent_of(a, b) — as a relationship-kind attestation
  asserted by the author and (for keyless endpoints) family-co-signable. All
  other relationships (grandparent, sibling-via-shared-parent, aunt, cousin) are
  DERIVED by walking parent_of edges. Keeps the vocabulary tiny and the graph
  composable. (Spouse stays its own edge; siblings derive from shared parent.)
- Stories/impact attach to a node_id (journal subject becomes node_id, not a bare
  label) so "how she impacted you" clusters correctly.

## THE MERGE-ON-HANDSHAKE FLOW (the magic, made safe)
1. You handshake a relative (existing Tier P/R handshake).
2. Both wallets already hold their own trees. The wallet computes OVERLAP
   CANDIDATES: keyless nodes reachable from the shared keyed person on both sides
   with compatible names/dates.
3. The wallet PROPOSES each candidate to a human: "You both have a 'Pam
   Winchester (1949–2022)' above your shared link — are these the same person?"
4. On confirm, the two node_ids are bound (a family-co-signed merge attestation),
   and YOUR tree INHERITS the other side's branches hanging off the merged node —
   you gain the great-great-grandpa you never had, with his stories.
5. CONSENT/SCOPE boundary (do not skip): inheritance is offered and scoped, not a
   silent full-graph absorb. You pull in branches you accept; the other side
   chooses what's shareable. Same permissioned-by-ownership rule as the memorial
   and the join-the-tree entries.

## MEMORY RECONCILIATION (discrepancy surfacing)
When two co-authored nodes/stories disagree on a detail (date, place, "was it
raining"), the wallet surfaces "you two remember this differently" to both, with
each version + who attested it. Resolutions: (a) agree — co-sign a reconciled
version; (b) agree to disagree — both versions persist, each signed by who
believes it, weight shown. Low-stakes by design ("not national security"); the
point is the conversation + the honest record, never a forced single truth. This
is web-of-trust applied to memory: divergent signed claims coexist, weight is
visible, no central arbiter.

## CUT ORDER (each independently shippable; smallest first)
- CUT 1 — Keyless person-nodes + the editable tree (SINGLE-PLAYER, no merge).
  Add witnessed PersonNode + parent_of edges; an editor to fill in mom/dad/
  siblings/grandparents/great-grandparents/aunts/uncles/cousins that I know;
  render via PeopleTree (extend peopleTreeLayout to ancestor rings). Stories
  attach to node_ids. Delivers the whole "edit the tree the way I see it" on day
  one, alone — no network, no merge. This is H-A + H-B. START HERE.
- CUT 2 — Derived relationships + tree walks. Compute grandparent/aunt/cousin
  from parent_of; the tree view labels them. Pure graph logic + tests.
- CUT 3 — Handshake overlap proposal + confirmed merge (H-C) + inheritance with
  the consent/scope boundary. The flywheel: shake a relative, inherit their
  branches on confirm.
- CUT 4 — Memory reconciliation (discrepancy surfacing + agree / agree-to-disagree).
- CUT 5 — Civic/extended rollup (later): the same graph feeds town/community
  history (per the memorial + civic-rollup ideas).

## NON-GOALS / GUARDRAILS
- No silent auto-merge of keyless nodes (name collisions). Human-confirmed only.
- No forced single truth on memories (divergence is allowed + weighted).
- No full-graph auto-absorb on handshake (consent + scope).
- Honest backdating throughout (as_of / birth / death are claims; the signing
  date is never forged — same boundary as the Moments cut).

## NORTH-STAR CHECK
Edit-the-tree (CUT 1) makes the family want to come home (you build your people)
AND leaves you more sovereign (you own the graph, keyless ancestors included).
The merge (CUT 3) is the warmth+moat flywheel. Passes the two-jobs test.

---

## OPERATOR REFINEMENTS (confirmed at cut-start, 2026-06-14)
- LOCAL-NEIGHBORHOOD EDITING; the tree SELF-ASSEMBLES. You only ever edit your
  OWN adjacent layer — your parents, your siblings, your kids ("only my next
  stage above me," easily liable to get right). The deep multi-generation tree is
  NOT authored by one person; it EMERGES by merging many people's local
  neighborhoods through handshakes. CUT 1 is therefore explicitly the
  edit-your-adjacent-layer editor, nothing grander.
- CORRECTION-ON-HANDSHAKE is the everyday face of merge: "you spelled Mom's name
  wrong" → you fix yours, she fixes hers, you both sign you're siblings with the
  same mother → the shared parent node binds and the two graphs share from there.
  Reconciliation isn't a heavy ceremony; it's two relatives agreeing on Mom.
- AFFINITY EDGES + RELATIONSHIP NAMING (not just blood). Sister marries husband;
  their kids are descendants connected to you ONLY THROUGH your sister — the graph
  shows the path and NAMES it. Someone who marries in three generations down is
  "third cousins" by the walk even though it's not by blood. So the namer must
  handle consanguinity (blood, via common ancestor — cousin Nth, M-removed) AND
  affinity (in-law / by-marriage). The relationshipLabel engine is the centerpiece
  of CUT 1's foundation.
- NEW MEMBERS ONBOARD INTO THE GRAPH. People born later get added and start
  accruing their own attestations + a permanent record held by the family AND by
  the individual they represent — never by a company. The keyless-child node
  becomes a keyed node when they get their own wallet (the journal subject-label
  → wallet handoff pattern already anticipated by custody handoff).
- THE MOAT, STARK (operator's words): "unforgettable, you cannot fake that — that
  family would not let you in. If you belong to no family you belong nowhere;
  either someone adopts you or you start your own family." Belonging is conferred
  by family acceptance (handshake + co-sign), which is exactly why it can't be
  faked. Implication: ADOPT (be witnessed/handshaken into a family) and START YOUR
  OWN (found a family unit) are both first-class entry paths — already partly
  present as familyUnit + StartFamilyModal; the tree makes them legible.

## FIRST CODE CUT (CUT 1 foundation — what's being built now)
The pure, testable graph core (no UI, no signing-pipeline, no network — same
draft-builder discipline as buildHandshakeDraft / buildSelfMembershipDraft):
- personNode.ts — buildPersonNodeDraft({displayName, born?, died?, keyedPubkey?})
  → unsigned credential-kind draft (credential_type 'person_node'); a WITNESSED
  person, keyless unless keyedPubkey present. + isPersonNode + readPersonNode.
- kinEdge.ts — buildParentEdgeDraft(parentNodeId, childNodeId) +
  buildSpouseEdgeDraft(aNodeId, bNodeId) → unsigned relationship-kind drafts
  (relation 'parent_of' / 'spouse'). + isKinEdge + readKinEdge.
- kinGraph.ts — buildKinGraph(holdings) reads person-nodes + kin-edges into a pure
  graph; relationshipLabel(graph, fromId, toId) names the tie via common-ancestor
  consanguinity (parent/grandparent/great^N, sibling, aunt/uncle, cousin Nth
  M-removed) + affinity (spouse / in-law). The centerpiece.
- Full unit tests for each. manifest.ts + registry entry. Gates green.
Follow-on slices (later turns): the editor UI, PeopleTree ancestor-ring render,
the sign/hold/anchor wiring, then CUT 3 handshake-merge.
