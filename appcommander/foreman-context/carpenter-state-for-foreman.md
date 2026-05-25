# carpenter-state-for-foreman — org multisig substrate decision locked (Tapscript-style leaf tree)

> PFOR-012 structured operational state. Written 2026-05-25 late evening immediately after committing 9e58108 on `claude/multisig-orgs-status-jiLwm`. Branch sits two commits ahead of `origin/main` (and ahead of any other live branch); both commits are brief + PLAN.md doc-only work, no code changes, no gate runs needed.

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS. The session was triggered by the operator asking whether multisig organizations are live right now, and ended with a substrate decision for the multi-key org upgrade plus a brief authored against that substrate.

## WHAT-CHANGED-RECENTLY

Two commits on the dispatch branch tonight, both doc-only.

Commit 0eab0e8 — "Brief — simple-multisig orgs supersede FROST-first" — authored `project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-25-simple-multisig-orgs-roadmap.md` and rewrote PLAN.md Phase 8 to pivot from the FROST-first arc to a list-of-Schnorr-signatures substrate using the already-shipped `mergeSignatures` + `countRatifications` + cosigning pipeline. Operator asked for this after the FROST brief surfaced as too heavy for the actual product need ("regular multisig and not a complicated frost where the complexity is overwhelming us").

Commit 9e58108 — "Brief — Tapscript-style org authorization tree supersedes all prior" — authored `project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-25-tapscript-style-org-authorization-tree-roadmap.md` and rewrote PLAN.md Phase 8 AGAIN after the operator asked whether the list-of-sigs brief was actually Taproot multisig (it was not) and whether the wallet's leaves theory held up (it did — for a structurally adjacent reason). The new brief ports Bitcoin Taproot's script-path Merkle-tree-of-conditions shape to off-chain attestations by treating the org's authorization rules as field-tree leaves inside the self-declaration's claim tree, then using the shipped `disclosureProof` / `verifyDisclosureProof` primitives from `tapit-attest/src/core/field-tree.ts` to prove the satisfied rule at action time. Zero new cryptographic code in tapit-attest; no library version bump.

PLAN.md Phase 8 now cites the Tapscript-style brief as the canonical reference and names the role each prior brief now plays — list-of-sigs as documented fallback if Tapscript-style proves too heavy in practice, FROST as the future signer-anonymity upgrade tier. All three superseded briefs are preserved in the briefs folder.

## WHAT'S-PENDING

Phase A of the Tapscript-style roadmap is ready to cut. The brief itself names the work: introduce an `AuthRule = { action, threshold, eligible }` type in `src/features/connections/createOrganization.ts` (or a new `src/features/governance/authRule.ts` sibling — file-size headroom decides at cut time), extend `selfDeclareOrganization` to accept `authRules` and emit them as a sub-branch named `auth` inside the claim tree, add `findAuthRule` and `proveAuthorization` helpers that wrap the shipped `disclosureProof`, and ship tests covering default-rules-shape preservation, multi-rule disclosure-proof round-trip, non-existent-action returns null, duplicate-action rejection. One session of estimated work, zero tapit-attest changes.

Operator has not yet authorized Phase A code. The session ended on the brief-authored gate; the natural next chip is whether to cut Phase A in the next dispatch or whether to let the brief sit for a day of operator reflection before any code lands.

## WHAT-TO-FLAG

One process observation worth carrying forward: the substrate decision moved through three options in three hours (FROST → list-of-sigs → Tapscript-style), each as a separate brief on disk. The briefs folder now contains three superseded org-control briefs plus one canonical brief, all dated within 24 hours. The PLAN.md Phase 8 section names the role of each, but the navigation is still implicit — the next Carpenter session has to read PLAN.md to know which brief is canonical. The carpenter-opinions file flagged a cheap mitigation: add a two-line "SUPERSEDED BY: ..., REASON: ..." banner at the top of each superseded brief so the navigation is self-documenting. Foreman might want to add that as a future-session task or absorb it into the Phase A cut.

One technical risk worth carrying into Phase B planning: the shipped `disclosureProof` / `verifyDisclosureProof` primitive has been exercised extensively for single-attestation selective disclosure (the discloser produces a proof FROM attestation X, the verifier verifies the proof IS attestation X). The Tapscript-style design uses the same primitive CROSS-ENVELOPE — envelope Y carries a disclosure proof of one leaf from attestation X (the org's self-declaration), and the verifier has to look up X in its known-orgs store, reconstruct X's claim root from the proof bundle, and confirm the reconstructed root matches X's actually-held digest. That cross-envelope binding is the security-critical step and has no existing test coverage. Phase B's test suite must fuzz that boundary specifically; recommend explicit chip-form check-in with the operator at Phase B cut time to confirm test-discipline scope before any production envelopes start carrying authorization proofs.

## RECOMMENDED-NEXT-MOVES

For the operator: read the Tapscript-style brief end to end on a desktop (not just iOS — the table comparing Taproot script-path vs tapit-attest selective disclosure is the load-bearing exposition and reads better at width) and decide whether to authorize Phase A code or hold for further reflection. The brief is comprehensive enough that Phase A could be cut without further design work, but the multi-rule UI and amendment-chain UX (Phase C/D) each have a real design surface that warrants chip-form check-ins during the cut.

For the Foreman: the natural follow-up brief if Phase A proceeds is a Phase B test-discipline outline specifically covering the cross-envelope binding risk surface flagged above. Could be authored proactively to be ready when Phase A finishes; doesn't need operator direction first because the test scope is constrained by the substrate decision already locked.

For both: the FROST brief in the drawer is now framed as "the upgrade path the day an org needs signer-anonymity." If the operator can name a concrete use case where signer-anonymity matters (dissident orgs, whistleblower committees, certain attorney-client constructions), that's worth logging as a living-ideas entry under the new ideas doctrine — it gives the FROST brief a concrete reason to exist beyond completeness.

## OPERATOR'S-CURRENT-VIBE

Engaged and architecturally sharp. The operator's "Taproot multisig correct? So our leave's theory holds up?" question was the load-bearing intervention of the session and demonstrated that they have absorbed the wallet's cryptographic architecture deeply enough to spot when a brief's framing doesn't match the actual substrate — they were thinking in Taproot terms while the brief was thinking in plain-list-of-sigs terms, and the conversation that exposed the mismatch produced a better architectural answer than either party had at the start of the session. The chip-form decisions came fast and clean once the model was on the table. The operator is in a high-leverage thinking mode and Phase A code should land into that energy soon rather than letting the brief age out.
