# Master synthesis — the sovereign family nest: what it is, is it worth it, how we build it

Date: 2026-06-14
Author: carpenter, synthesizing the 2026-06-14 operator riff series (game-night
→ story-attestation → double-pass overlay → typed Merkle forest → ownership-vs-
custody → "give me your whole rundown so it doesn't evaporate").
Status: north-star synthesis + honest build plan. Grounded against the actual
repo state (features-registry.ts) on this date. This is the capture the operator
asked for so the thinking doesn't evaporate. Build specs are the linked veins.

Companion docs (same body): 2026-06-14-the-living-family-nest-thesis.md,
2026-06-14-sovereign-family-nest-landscape-research.md, and the ideas.md entries
dated 2026-06-14 (family-hearth host-bot; story-attestation; double-pass overlay
+ swappable substrate; typed Merkle forest + router; ownership-vs-custody +
compromise-gate).

---

## 1. WHAT IT IS (one breath)
A sovereign family nest each member holds in their own wallet, where the everyday
warmth (host-bot games, "how was your day," claps and hugs, Grandma's stories) is
the same surface that quietly carries the serious load — the secure channel, the
family-owned AI context, the can't-be-locked-out secrets, and a verifiable family
memory that outlives everyone — all encrypted to each member, provable forever,
swappable down to the AI provider and the network, and built so a detected
compromise makes it fail silent, not leak.

## 2. IS IT WORTH DOING? — VERDICT: YES, with eyes open
Worth it because three things line up that rarely line up at once:
- The whitespace is real and confirmed (landscape research 2026-06-14): the
  integrated daily-use family nest that is ALSO secure channel + family AI
  context + social-recovery secrets + scales-to-civic does not exist anywhere.
  Every brick exists siloed; the union is open.
- The demand is proven and rising (crowded family-hub category; documented
  SSN-breach climate; AI-fakes-everything pressure that makes verified history
  load-bearing, not sentimental).
- We are NOT starting from zero. The hardest cryptographic substrate is already
  built and shipping in this repo (see §3). The remaining work is mostly
  activation + wiring + UX, not inventing primitives.
The honest caveats (the two hard problems every sovereign project shares):
- COLD START / adoption. A nest is worth more with more of the family in it.
  Mitigant: the operator's own rule — "if it only ever works for one family it
  already succeeded." Build for one family first; the host-bot's everyday gravity
  is the adoption engine.
- THE CLOUD BOUNDARY is real, not magic. A remote model sees the plaintext you
  send it. Sovereignty here = minimize + de-identify + no-train/short-retention
  terms + swappable + local-where-possible, NOT zero-knowledge to the provider.
  Be honest about this in the product, never oversell it.
Net: the wedge is real, the substrate is mostly built, the differentiation is
unmatched (nobody has more than one of our pillars). Worth doing.

## 3. WHAT ALREADY EXISTS (the substrate — grounded in features-registry.ts)
Built and shipping today:
- Keys + signed attestations + the Wallet core (tapit-attest, wallet-core).
- The MERKLE FIELD TREE + SELECTIVE DISCLOSURE (disclosure feature +
  tapit-attest/field-tree.ts): single- and multi-leaf disclosure proofs already
  let you reveal exactly N leaves and collapse everything else to hashes. This IS
  the "knows nothing about me when it doesn't need to" machine — already real.
- SOCIAL RECOVERY: Shamir split/combine, held-pieces (B-1), heartbeat/liveness
  (B-2), recall-brake (delay+veto) — the can't-be-locked-out + compromise-signal
  machinery (recovery feature).
- TRANSPORT: Nostr relay DMs, handshake/connections, per-peer chat (transport,
  connections, messaging), warmed-up frictionless copy.
- CAPTURE pipeline: in-app camera → normalizeImage → sign → anchor → stamp
  (camera, capture, journal, anchoring) — the rails a story-attestation rides.
- TIME anchoring: OpenTimestamps (anchoring, temporal).
- HOST-GATE auth (Supabase, ciphertext-only sync), settings, theme, onboarding.
- Layer-2 inter-app signing (sign-request, cosigning) — the SSO/cosign pathway.
Dormant but ALREADY SCAFFOLDED (waiting on the "Phase 7+ wallet-bot launch"):
- persona (bot persona + supabase/functions/_shared/persona.ts under the
  PFOR-027 parity contract), snapshot-builder, suggested-questions, temporal.
This is the single most important planning fact: the AI brain has a chassis
already in the repo. Bringing the family AI online is an ACTIVATION, not a
greenfield build.

## 4. THE MAJOR ADVANCEMENT HURDLES (honest list)
H1. The family-context RETRIEVAL ROUTER does not exist yet. This is the new core
    engine: classify a query, pick the right typed tree(s), walk to the right
    leaves, build a multi-disclosure bundle, hand the model ONLY that. New build,
    but sits on top of the existing disclosure primitive.
H2. The TYPED MEMORY FOREST. Today attestations exist but there's no "dump
    anything here" memory surface, no typing into memories/facts/heritage/places/
    preferences trees, and no frictionless capture that makes "March 15" actually
    get recorded. Needs a low-friction local note that can be PROMOTED to a
    signed attestation when it matters.
H3. The CLOUD-BOUNDARY discipline, productized. Wiring the bot to call a provider
    while enforcing minimize/de-identify/no-train-terms/swappable, and ideally a
    LOCAL small-model pass for sensitive work. Provider abstraction so swap is
    real, not a slogan.
H4. The COMPROMISE GATE. Wire the AI-disclosure layer to the social-wallet
    integrity state so a heartbeat/recall compromise signal makes the bot clam up
    (fail silent). Reuses recovery machinery; needs the gate plumbed into the
    router.
H5. The HOST-BOT persona + everyday-engagement loop. Activate persona; build the
    warm no-shame host (games, "how was your day," milestone claps/hugs), with
    the firewall that the fun layer NEVER surveils silence (only the safety layer
    treats cessation as signal).
H6. STORY-ATTESTATION capture + replay UX. Bot-prompted-from-settings story
    capture (voice/video/text) → typed attestation → vault → replay with "verify
    it's still the same file" surfaced to a non-technical family member.
H7. The PER-MEMBER → FAMILY graph. Each member's wallet + the family as a web of
    trust across them; shared family context vs per-person private context
    boundaries; group-vs-individual addressing for the bot.
H8. ADOPTION / cold-start (non-technical hurdle, but the real one). The everyday
    gravity has to be strong enough that the family opens it without being told.
H9. CIVIC SCALE (later). Family membership proofs → church/library/town/voting.
    Greenfield, deferred; the nest must exist first.

## 5. HOW WE BUILD IT — phased action plan (smallest useful version correctly)
Prime Directive governs: smallest useful version, clarity over cleverness, safe
over fast, keys never leave unencrypted. Each phase is independently shippable
and leaves the family more sovereign.

PHASE 0 — Foundation already done. Keys, Merkle disclosure, social recovery,
transport, capture, anchoring, Layer-2 signing. (No work; this is the floor.)

PHASE 1 — THE DUMP SURFACE (typed memory forest, local-first). Build H2: a
frictionless "put it here" capture that writes typed local notes
(memories/facts/heritage/places/preferences), each promotable to a signed
attestation. No AI yet. Value alone: the sovereign 20-year place to dump ideas
(the operator is living the pain of lost ideas right now). This is the soil
everything else grows from.

PHASE 2 — THE STORY-ATTESTATION (keystone, emotional proof). Build H6 on the
existing capture+sign+anchor rails + Phase 1's heritage tree. Bot-prompted-from-
settings is light at first (even a manual prompt list), capture → typed
attestation → vault → verifiable replay. This is the sharpest demo of "warmth
and sovereignty are one act" and it makes something the family refuses to lose.
Recommended FIRST visible cut because it reuses the most existing infra for the
most emotional payoff.

PHASE 3 — ACTIVATE THE BOT + THE ROUTER (the brain). Bring persona/snapshot-
builder/suggested-questions online (H5 chassis already there). Build H1 the
retrieval router and H3 the cloud-boundary discipline: double-pass (generic +
family-context), minimize via multi-disclosure, provider abstraction for swap,
and the local-small-model pass for sensitive work. Now "you're 35 miles from
Aunt Martha's ranch" works, provably and privately.

PHASE 4 — THE COMPROMISE GATE (fail-safe). Build H4: wire the router's
disclosure to the recovery integrity state so a compromise signal makes the bot
clam up until social recovery restores the rightful state. Small once the router
exists; large in trust value.

PHASE 5 — THE EVERYDAY HOST LOOP (adoption engine). Full H5: games, "how was
your day," milestone claps/hugs, group-vs-individual addressing (H7), no-shame
firewall. This is the daily gravity that drives adoption (H8).

PHASE 6 — SECURE CHANNEL polish + family-graph hardening. Productize the
sensitive-share (adopt the Psst!/Secure-Link expiring/view-limited shape) as a
first-class everyday channel on the same surface.

PHASE 7 — CIVIC SCALE (H9). Family membership proofs → church/library/town/
voting. Only after the nest is lived-in.

## 6. SEQUENCING RECOMMENDATION (the one call to make)
Lead with PHASE 1 + PHASE 2 (dump surface + story-attestation). Rationale: they
reuse the most existing substrate, they need no cloud boundary yet (so no honesty
debt), they solve a pain the operator is literally feeling (lost ideas / lost
stories), and Phase 2 is the most emotionally undeniable proof of the whole
thesis — the thing you show one family to make them never want to leave. The AI
brain (Phase 3) is more exciting but heavier and carries the cloud-boundary
caveat; build it once there's a memory worth retrieving. Decide Phase-1-vs-Phase-2
ordering and scope with the operator via chips when ready to cut code.

## 7. THE TEST EVERY CUT MUST PASS
Does it make the family want to come home to the nest (warmth) AND leave them
more sovereign — more their own, more permanent, more impossible to be locked out
of (sovereignty)? A cut that does only one is half done. That is the mission's
two-jobs rule, and it is the filter for everything above.
