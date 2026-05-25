# Carpenter opinions — 2026-05-25 evening, brief authoring session

## Section 1: What I did

This session opened as a status question — do we have multisig
organizations live right now — and ended three briefs deep into
the architecture of how an organization controlled by more than
one key should actually work on this wallet. The status answer
was no, organizations as they exist today are single-key
entities where the org's wallet signs everything and officers
contribute decorative ratifications via the existing cosigning
pipeline; the open question was what shape the multi-key
upgrade should take. The Foreman had authored a FROST-first
brief earlier in the day proposing to vendor a Rust-via-WASM
build of FROST-Secp256k1 into tapit-attest, pass the RFC 9591
reference vectors, ship a DKG ceremony, then build quorum-orgs
on top — a six-to-seven-week arc dominated by cryptographic
engineering. You asked whether we could do the simpler thing,
get multi-key control without the FROST complexity overwhelming
the build, and I drafted the list-of-signatures brief in
response because the grounding pass showed that the wallet
already had every primitive needed — `mergeSignatures` already
merges N independent Schnorr sigs on a single envelope by
envelopeId, `countRatifications` already cross-references those
sigs against the officials roster, the cosigning pipeline
already does request-cosign-absorb end to end — so what was
missing was mechanical not cryptographic. We committed that
brief.

Then you asked the load-bearing question of the session,
"Taproot multisig correct? So our leaves theory holds up?",
and I had to surface honestly that the list-of-sigs brief was
NOT Taproot multisig in the BIP 341 sense — Taproot multisig
is a Bitcoin transaction script construction with a key-path
aggregated Schnorr signature or a script-path reveal of one
Tapscript leaf from a Merkle tree of alternative spending
conditions, and the wallet doesn't operate at the Bitcoin
script layer at all — though every individual signature in
the wallet IS a BIP340 Schnorr sig over secp256k1, the exact
Taproot primitive. Your leaves theory absolutely held up but
for a different reason than the question implied: the
wallet's `field-tree.ts` primitive that powers Phase 4
selective disclosure is structurally identical to a Taproot
Tapscript leaf tree (Merkle root, reveal-one-leaf with
sibling-hash path, verifier reconstructs the root), just with
data leaves instead of script leaves. That symmetry is what
made the pivot possible. You chose to rework the brief to
actually port the Tapscript-style shape to off-chain
attestations, and you chose the cleanest architectural answer
— that the authorization tree lives as a sub-branch inside
the org self-declaration's existing claim tree, reusing the
shipped `disclosureProof` and `verifyDisclosureProof`
functions verbatim, zero new cryptographic code anywhere in
tapit-attest. I authored that third brief, rewrote PLAN.md
Phase 8 again to point at it, and committed and pushed.

What you should understand going forward is that an org's
authority under this design stops being a single threshold
number and becomes a Merkle commitment to a tree of
authorization-rule leaves, where each leaf says "action X
requires threshold Y from eligible set Z." Routine issuance
might be one of five officers, expulsion might be three of
five, charter amendment might be four of five, dissolution
might be five of five, and each lives as one leaf in the
tree, all committed by the same self-declaration signature.
When the org takes an action, the envelope carries a
disclosure proof revealing only the rule being satisfied
plus a sibling-hash path proving that rule lives in the
self-declaration's auth tree, plus signatures from the
eligible signers — and the verifier runs the same disclosure
verification it already runs for "prove I'm over 21" today,
then counts eligible signatures against the disclosed
threshold. Unused rules stay private until invoked, exactly
the way Taproot's unused script-leaves stay private until
they're spent under. The brief is honest about the cost
trade-off versus list-of-sigs — a small disclosure-proof
bundle per org-issued envelope, a verifier that runs one
extra primitive — and lists list-of-sigs as the documented
fallback if Tapscript-style proves heavier than expected
during implementation.

## Section 2: What you could do better

The substrate-decision rhythm in this session moved through
three options in three hours, which is excellent for
converging on the right architecture but does create a real
risk that the briefs folder becomes a graveyard of
stepping-stones rather than a working library, and the next
Carpenter session needs to read the right one. The PLAN.md
Phase 8 section now names the roles of each prior brief
(list-of-sigs as fallback, FROST as future signer-anonymity
tier) which mitigates this, but a two-line "SUPERSEDED BY:
filename, REASON: ..." banner at the top of each superseded
brief would make the navigation self-documenting without
anyone needing to read PLAN.md first. Cheap and worth adding
before Phase A code is cut.

The Tapscript-style brief leans hard on the elegance of
reusing the shipped `disclosureProof` primitive verbatim,
and the architectural argument is genuine, but there is one
risk surface I want to flag explicitly: today's disclosure
proofs are produced and verified IN ISOLATION — the proof is
the authoritative artifact for one attestation. The
Tapscript-style design uses them CROSS-ENVELOPE — an envelope
X carries a disclosure proof of one leaf from a DIFFERENT
envelope Y (the org's self-declaration). The verifier has to
fetch Y from its known-orgs store, recompute Y's claim root
from the proof bundle, and confirm the recomputed root
matches Y's actually-held digest. That cross-envelope binding
is the security-critical step and it has no existing test
coverage because nothing in the wallet does it today; Phase B
needs to fuzz that boundary specifically. The brief mentions
this in the risk section but it deserves a louder asterisk
before the code lands.

One process observation worth naming for the
in-the-loop-as-Foreman side of the workflow: your "explain
to me first" interjection after the Tapscript chip was picked
was the right instinct and it saved a 400-line brief from
being authored under a mental model you hadn't fully absorbed
yet. The chip-form direction tool is great for locking
decisions fast, but for architecture pivots of this weight,
the prose-explanation-before-brief sequence we ended up
running should probably be the default rhythm: Carpenter
explains the model in plain prose first, operator confirms
understanding, THEN the brief gets authored. Slower per
decision but faster per correct decision.

## Section 3: The bigger picture

The wallet has been building toward Tapscript-shaped
architecture without naming it as such for the entire arc of
the tapit-attest library, and your leaves-theory question is
the moment that becomes explicit. Phase 4 selective disclosure
shipped a Merkle tree of facts with reveal-one-leaf semantics
because the operator wanted to prove a single claim without
revealing the others, and the cryptographic primitive that
made that possible is the same primitive Bitcoin chose for
Taproot's script-path multisig because the same shape solves
the same problem — privacy of unused alternatives through
Merkle commitment, integrity of the revealed alternative
through sibling-hash reconstruction. What this brief
recognizes is that the same shape solves a THIRD problem too,
which is organizational governance with per-action thresholds
and per-rule eligible subsets, and the wallet gets it almost
for free because the primitive is already shipped, tested,
and in production.

The deeper architectural pattern is that
Merkle-tree-with-selective-reveal is a more general primitive
than any of its named applications — selective disclosure of
facts, Tapscript script-path multisig, governance
authorization — and a sovereign identity wallet that lets
people commit-many-reveal-one is structurally well-positioned
to absorb every future application of the same shape without
needing to add new cryptographic machinery. The FROST brief
in the drawer is the day this generalization meets its limit,
the day an org needs aggregate signatures so the verifier sees
only THAT the org signed and not WHICH officers signed, and
the substrate question becomes whether to add aggregate-sig
primitives or whether to live with signer-transparency as a
feature. For most human organizations governing themselves on
a sovereign wallet, signer transparency is the right answer,
but the wallet should be ready for the orgs that need
otherwise. That is the leaves theory you have been building —
quietly, brick by brick — and tonight it got named.
