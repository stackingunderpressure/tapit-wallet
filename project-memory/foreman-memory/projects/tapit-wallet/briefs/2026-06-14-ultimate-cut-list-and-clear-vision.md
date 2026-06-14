# The Ultimate Cut List — one coherent vision, keep/defer, and the order we build

Date: 2026-06-14
Author: carpenter, reconciling the canonical PLAN.md + all 28 briefs + the
features-registry against the 2026-06-14 family-nest thesis series.
Method: full doc inventory (read, not inferred) + reconciliation. This is the
"put it all together, decide what we keep, name the ultimate cut list, draw a
clear division and a clear vision before we go there" deliverable the operator
asked for.
Status: DECISION DOC. One open fork for the operator (the wedge order) is raised
at the end via chips; everything else is reconciled here.

---

## 0. THE ONE THING TO UNDERSTAND FIRST
There are TWO coherent strategies in this repo, and they SHARE ONE SUBSTRATE but
point at TWO AUDIENCES with TWO near-term cut orders. Until now they've been
braided together in PLAN.md. The clarity you asked for is: name them, see that
the crypto core serves both, and choose which one LEADS the next stretch.

- STRATEGY A — "Freedom-tech community first" (the current PLAN.md). Audience:
  Bitcoin / Nostr / sovereignty-literate early adopters. Near-term artifacts: the
  Tier-1 "embarrassment gap" list, the peer-mediated key-release substrate (item
  11) as architectural core, import-nsec / NIP-05 / "why no Lightning" framing,
  and the Matt Odell tribute as the inaugural public demo. This is a credibility-
  with-the-nerdy-few launch.

- STRATEGY B — "Sovereign family nest first" (the 2026-06-14 thesis series).
  Audience: ordinary families, the operator's family first. Near-term artifacts:
  the dump surface, event/story/memory attestations, "sign the moment" co-signing,
  the verify-badge syndication, and the family bot. This is an adoption-through-
  warmth launch — the calculator-handed-people-math wedge.

They are NOT in conflict at the substrate: keys, signed attestations, selective
disclosure, social recovery, transport, capture, anchoring all serve both. They
DIVERGE only in (a) who we build the next visible surface for, and (b) what gets
deferred. This doc keeps the shared substrate, defers the org-governance tangle
that serves neither near-term wedge, and stages the family-nest work on top of
what's already built.

## 1. THE CLEAR VISION (the destination, one breath)
A sovereign family nest each member holds in their own wallet: the everyday warmth
(host-bot, games, "how was your day," signing each other's moments, the elders'
stories) is the same surface that carries the serious load (secure channel,
family-owned AI context, can't-be-locked-out secrets, verifiable memory that
outlives everyone) — useful to one person on day one, more valuable with each
member who joins, owned not rented, provable as a bonus not a precondition,
swappable down to the AI and the network, fails silent when attacked, and
interoperates with the corporate world (silver-platter export + verify-badge)
instead of asking anyone to abandon it. It scales, much later, to civic proof.
The north-star test for every cut: does it make the family want to come home AND
leave them more sovereign? Half-credit if only one.

## 2. KEEP — already built, directly serves the nest (no new work to "keep")
These shipped features ARE the family-nest substrate. Keep, lean on, don't touch
except to wire:
- recovery (Shamir social recovery, cohort, ceremony) — the can't-be-locked-out
  spine. KEEP. (Hardening item below.)
- resendable-pieces / held receipts / heartbeat (B-1/B-2, recall-brake) — held
  custody + liveness + fail-safe. KEEP. Already built this session-arc.
- disclosure (single + multi-leaf selective disclosure) — "knows nothing it
  doesn't need to." KEEP — this is the router's foundation.
- journal + camera + capture + anchoring — the capture→sign→anchor→stamp rails
  every memory/story/card rides. KEEP.
- messaging + transport + connections (warm-voice peerCopy, handshake, copy-code)
  — the family chat + frictionless connect. KEEP.
- cosigning — multi-party signature merge — the engine under "sign the moment" /
  co-signed memories. KEEP.
- sign-request (Layer 2 deeplink) + cosign-existing atom — inter-app pathway
  (Trailhead, future apps). KEEP, parallel track.
- governance (org declaration/members) — light version useful for "the family" as
  a group; KEEP the simple part, DEFER the heavy part (see §4).
- DORMANT bot chassis (persona, snapshot-builder, suggested-questions, temporal +
  supabase persona side-pair) — this IS the family bot. KEEP; ACTIVATE in the bot
  phase. Bringing the AI online is activation, not greenfield.

## 3. KEEP — written specs that ARE the nest (activate these, don't rewrite)
Several existing briefs already spec large parts of the family nest. Reuse them:
- 2026-06-05-collections-and-proof-bundles-spec.md — user-named collections of
  entries + a sealed collection attestation + multi-entry disclosure bundles.
  THIS IS the "event = a growing CLUSTER of attestations" model the operator
  described (one card now, photos later, many signers). Promote to the event
  model. HIGH KEEP.
- 2026-06-04-sovereign-conditional-release-inheritance-roadmap.md — the
  configurable release engine = the legacy / after-I'm-gone / pass-it-down
  mechanism. KEEP for the legacy phase.
- 2026-06-06-teaching-system-spec.md + 2026-06-05-sovereignty-literacy-education-
  spec.md — education-through-use, the mission's second job. KEEP as cross-cutting
  (the bot is the "Sage" tutor named here).
- 2026-06-05-capture-makeover-spec.md (Cut 1) — mount the existing camera into a
  "stamp anything" capture hub. Ship-ready, directly serves memory capture. KEEP,
  near-term.
- 2026-06-03-captivation-and-growth-ux-roadmap.md — adoption/delight on the social
  graph. KEEP for the host-loop/adoption phase.
- 2026-05-24-fresh-young-adult-theme-roadmap.md — the bubbly youth-friendly
  surface the operator asked for. KEEP, folds into the host-loop UI.
- 2026-05-21-diary-first-wedge.md — the founding framing; the family nest is its
  maturation, not a replacement. KEEP as lineage.

## 4. DEFER — coherent, but NOT on the family-nest critical path (the cut list)
These are real and may matter at CIVIC scale, but they serve neither near-term
wedge and several are a self-superseding tangle. Park them, explicitly, so they
stop competing for attention:
- THE ORG-GOVERNANCE TANGLE (defer as a block, resolve later):
  2026-05-23-quorum-org-keys (already SUPERSEDED), 2026-05-25-frost-first,
  2026-05-25-simple-multisig-orgs, 2026-05-25-tapscript-style-org-authorization-
  tree. Four briefs each superseding the last; all deferred to Phase 5f+. A family
  does NOT need FROST DKG or tapscript authorization trees to share memories. When
  civic scale arrives, pick ONE of these and kill the other three. Until then:
  DEFER ALL, decide nothing.
- 2026-05-25-open-joining-and-configurable-membership-policy — org-scale join
  policies. DEFER to civic.
- 2026-06-03-key-compromise-equivocation-and-fork-resolution — advanced
  succession/fork threat model. DEFER (the lighter "compromise-gate / fail-silent"
  idea from this session covers the family need; full fork-adjudication is civic).
- 2026-05-22 capture-bridge + phase-5c-nostr-transport sketches — superseded/
  absorbed by shipped transport + capture. DEFER/ARCHIVE.
- 2026-05-23-org-mode-roadmap Cuts 2-4 (officials/ratifications/nested-org) —
  DEFER to civic; Cut 1 (declaration/members) already shipped and is enough for
  "the family" as a light group.

## 5. PARALLEL TRACK (not cut, not on the family path — runs beside)
- Trailhead (2026-06-12 assessment + kickoff) — separate repo, separate project.
  The cosign-existing atom that serves it is already built here. Leave it parallel;
  it neither blocks nor is blocked by the family nest.

## 6. THE ULTIMATE ORDERED CUT LIST (one list — Strategy B leading, A folded in)
Smallest-useful-first; each step ships independently and passes the north-star
test. This assumes the operator chooses family-nest-first (the fork in §8); if A
leads instead, steps 0/1 stay and 2+ reorder toward the Tier-1 demo path.

STEP 0 (shared hardening — needed under EITHER strategy):
- Tier-1 item 1: social recovery end-to-end across two physical devices, actually
  tested. It's the can't-be-locked-out promise; today it's UNVERIFIED and is the
  one genuine demo blocker. Do this regardless.
- (Opportunistic) Tier-1 items 2-3: extract FreshOnboarding / RecoveryInitiator
  (both ~800-line files) when touched — hygiene, not a feature.

STEP 1 — THE DUMP SURFACE (single-player floor, no network, no cloud). Typed
local-first capture you can "put anything here," each item promotable to a signed
attestation. Delivers the sovereign 20-year place to keep things on day one,
alone. (Family-nest build-plan Phase 1.)

STEP 2 — EVENT / STORY / MEMORY ATTESTATION (the keystone, reuses the most). On
the capture+sign+anchor rails + the collections spec: an EVENT as a growing
cluster of attestations, with a felt note ("say a few words"), honestly-marked
backfill (photograph the old card), and verifiable replay. This is the most
emotional proof of the whole thesis and the strongest first VISIBLE cut.
(Phase 2 + collections spec.)

STEP 3 — "SIGN THE MOMENT" CO-SIGNING + VERIFY-BADGE EXPORT. Family/others sign an
event (adaptive keepsake skin per occasion); silver-platter export to Facebook/etc.
carrying a tap-to-verify badge (the growth engine). Reuses cosigning + warm
peerCopy voice. (Co-signed-memories + event-unit + verify-badge ideas.)

STEP 4 — ACTIVATE THE FAMILY BOT + RETRIEVAL ROUTER. Bring the dormant chassis
online; build the typed-forest retrieval router + double-pass + cloud-boundary
discipline (minimize / de-identify / no-train terms / swappable / local-where-
possible). Now "you're 35 miles from Aunt Martha's" and "give me all my 37-point
games" work, privately and provably. (Phase 3.)

STEP 5 — COMPROMISE GATE (fail-silent). Wire the router's disclosure to the
recovery integrity state so a detected compromise makes the bot clam up until
social recovery restores the rightful state. (Phase 4.)

STEP 6 — EVERYDAY HOST LOOP + CALENDAR CLOSE-THE-LOOP. Warm no-shame host (games,
"how was your day," milestone claps/hugs), per-person + group bot voices,
cross-generational calendar that closes into co-signed memories. The daily-gravity
adoption engine. (Phase 5 + captivation-ux + fresh theme.)

STEP 7 — SECURE CHANNEL + CARD MARKETPLACE (monetization). Productize sensitive
sharing (Psst!/Secure-Link shape) + the card/invitation marketplace (buy a skin,
own the attestation). First real revenue line. (Phase 6 + card-marketplace idea.)

STEP 8 — LEGACY / CONDITIONAL RELEASE. The after-I'm-gone pass-it-down engine
(conditional-release spec) — recipes, principles, the powwow, released to the next
generation on the family's terms. (Conditional-release roadmap.)

STEP 9 — CIVIC SCALE (much later). Family membership → church/library/town/voting.
Now (and only now) resolve the org-governance tangle: pick ONE of FROST / multisig
/ tapscript, kill the rest, add personhood as an OPTIONAL consumed primitive.

## 7. WHAT THIS BUYS US
- One vision, one ordered list, no competing roadmaps.
- The org-governance tangle stops eating attention (deferred as a block).
- Every near-term step reuses shipped substrate or an existing spec — low new-build
  risk, fast to a visible, emotional, single-player-valuable cut.
- The Bitcoin-community work (Strategy A) is preserved, not deleted — it becomes a
  later/parallel credibility lane, not the thing that gates family value.

## 8. THE ONE DECISION FOR THE OPERATOR (raised via chips)
Which wedge LEADS the next stretch: family-nest-first (Strategy B, steps above),
freedom-tech-community-first (Strategy A, the existing PLAN.md Tier-1 + Matt Odell
demo), or a deliberate blend (Step 0 hardening, then one visible cut from EACH).
Everything else in this doc holds regardless of the answer; this only sets the
order of the next few cuts.
