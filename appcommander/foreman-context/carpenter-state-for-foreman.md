# carpenter-state-for-foreman — Open-joining brief authored (Phase E added to PLAN Phase 8)

> PFOR-012 structured operational state. Written 2026-05-25 deep evening immediately after committing eab7743 on `claude/multisig-orgs-status-jiLwm`. Branch sits five commits ahead of `origin/main`: 0eab0e8 (list-of-sigs brief), 9e58108 (Tapscript-style brief), 7d76cbd (close-out for brief session), 4eaeba8 (Phase A code), eea0542 (close-out for Phase A), and now eab7743 (open-joining brief). All gates remain green from the Phase A landing; this session's commit is doc-only so no new gate runs needed.

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS. This session was triggered by the operator surfacing a new product direction in chat — "Can we make where any one can start an org and anyone can join one no need email required" — which turned into a chip-form decision session that locked configurable-per-org as the abuse-resistance posture and deferred the substrate decision to brief-then-decide.

## WHAT-CHANGED-RECENTLY

Commit eab7743 — "Brief — open-joining + per-org configurable membership policy" — three files touched:

`project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-25-open-joining-and-configurable-membership-policy-roadmap.md` (new, 431 lines): Authored the canonical brief for the membership-acquisition axis. Extends `MYCELIUM_NETWORK_SPEC.md` §6 with member-initiated joining (the spec today names only org-issued memberships). Per-org configurable join-policy expressed as a `join` rule in the Tapscript-style auth tree shipped in Phase A. Three substrate options laid out side by side (org auto-publishes roster / org pre-signs open policy / hybrid) without locking one — operator will pick via chip after reading. Phase E1-E4 implementation arc, 5-7 sessions, ~2-3 weeks total.

`PLAN.md` (modified): Extended the Phase 8 section with a new Phase E description naming the open-joining axis. Updated the operator-locked decisions paragraph to include the deep-evening session's locks (per-org configurable policy, substrate deferred).

`appcommander/comms/in-flight.jsonl` (modified): logged session_started + two file_touched events.

## WHAT'S-PENDING

Two parallel decision tracks waiting on the operator:

Track 1 — Phase B of the Tapscript brief (verifier). Needs to ship before any Phase E verifier work (E4) can land, otherwise we end up with two verifier implementations and the cross-envelope binding risk surface flagged repeatedly in prior opinions. Phase B is one session, no substrate dependency, ready to cut on operator authorization.

Track 2 — Open-joining substrate choice (Option 1 / 2 / 3) from the newly-authored brief. Operator should read the brief on a desktop and pick the substrate via chip. The choice gates Phase E3's scope: Option 1 makes E3 heavy, Option 2 makes E3 mostly skippable, Option 3 keeps both with shared helpers.

Phase E1 (join-rule shape extension in the auth tree) is independent of both tracks — it could be cut anytime after Phase A landed and adds no new verifier surface. It's the smallest discrete piece of forward progress available right now if the operator wants something concrete to land without resolving either track first.

## WHAT-TO-FLAG

Brief navigation is genuinely getting hard. The briefs folder now contains five 2026-05-25-dated org-governance briefs:

- 2026-05-23-quorum-org-keys-roadmap.md — MuSig2-first, historical
- 2026-05-25-frost-first-and-charter-governance-roadmap.md — FROST-first, future signer-anonymity tier
- 2026-05-25-simple-multisig-orgs-roadmap.md — list-of-sigs, simpler fallback
- 2026-05-25-tapscript-style-org-authorization-tree-roadmap.md — canonical for org-control axis
- 2026-05-25-open-joining-and-configurable-membership-policy-roadmap.md — canonical for membership-acquisition axis

PLAN.md Phase 8 names the role of each, but a future Carpenter opening the folder cold has to read PLAN to navigate. The "SUPERSEDED BY" banner recommendation from the prior opinions still applies and is now even more important. Recommend adding the banners across all three superseded briefs in one pass before any Phase B or Phase E1 code lands; it's a five-minute job that saves real navigation cost long-term.

Phase E1 versus Phase B sequencing risk: Phase E1 extends the `AuthRule` discriminated union with a new kind for join rules. If Phase E1 is cut FIRST (before B), the verifier in Phase B then has to handle BOTH the org-action rule shape AND the join rule shape, which doubles the test matrix at exactly the security-critical layer. If Phase B is cut FIRST, Phase E1 inherits the verifier's discipline and just adds a new rule kind to an already-tested machine. Recommend Phase B before Phase E1 even though E1 is technically independent — the test-discipline cost is much lower in that order.

Verifier UX under Option 2 (truly-leaderless open-membership policy) is non-trivial. The brief mentions it but it deserves chip-form check-in when Phase E4 lands. Specifically: an open-joined org has no canonical roster envelope to fetch, so "show me the members of the American Legion" is unanswerable without a directory layer that the substrate does not provide. This is a real UX problem that Phase E4 will have to confront if Option 2 or 3 is chosen.

## RECOMMENDED-NEXT-MOVES

For the operator: read the open-joining brief on a desktop (the substrate-comparison and the discriminated-union type sketch are the load-bearing exposition and read better at width than on iOS). After reading, pick the substrate via chip. In parallel or beforehand, decide whether to authorize Phase B as the next code cut.

For the Foreman: the SUPERSEDED-BY banner pass across the three historical briefs is a tractable proactive task that doesn't need operator direction. If you have an autonomous cycle to spend, that's the cheapest high-value use of it tonight. Alternative: a Phase B test-discipline pre-brief covering the four forgery classes (leaf-value, wrong-org-binding, tampered-path, tampered-meta) so the eventual Phase B dispatch opens with a clear test target.

For both: the FROST brief in the drawer remains framed as "the upgrade path the day an org needs signer-anonymity." Nothing in tonight's session changed that, but the open-joining direction does suggest a future-trigger: an org with an open-membership policy might want signer-anonymity for SENSITIVE actions even while it's open to joining. That's a real intersection worth a living-ideas entry per the new doctrine.

## OPERATOR'S-CURRENT-VIBE

Architecturally generative. Three substrate decisions in one night (list-of-sigs → Tapscript-style → open-joining policy axis), each one pushing the wallet's governance vocabulary further toward "constitutional substrate" rather than "feature folder." The pace feels sustainable; the operator's questions keep being the right architectural questions ("Taproot multisig correct? So our leaves theory holds up?") and the chips keep producing better answers than either party had at the start of each round. Recommend the operator sleep on this — three briefs and one code commit in one night is a lot of architectural work to absorb. Phase B and Phase E1 are both ready to cut fresh tomorrow. Phase A is on disk and verified by 15 passing tests.
