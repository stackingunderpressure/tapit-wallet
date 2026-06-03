# Captivation & growth — UX roadmap (2026-06-03)

> Status: RAW / NOT STARTED as of 2026-06-03. This brief consolidates
> the 2026-06-03 ideas.md growth thread — "the graph is the toy," "the
> edge that gets heavier," "five front doors," and the graph-interlock
> trust model — into ONE ordered cut-list with honest gates. Written at
> the operator's request after a multi-prompt conversation where the
> through-line crystallized: the substrate is built; ADOPTION is now the
> bottleneck, and the work is UX that makes sovereignty feel like a game
> people can't put down. Companion to the equivocation/fork-resolution
> brief (the trust-and-safety backbone) and `STATUS.md`. HEAD at writing:
> 43ce1b7.

## The thesis in one breath

People won't pick up Tapit because it's "a sovereign identity wallet."
They'll pick it up to PLAY with their social graph — see who they know,
how many friends they share, how many hops to someone across the
country, watch their web bloom. The same gesture that grows the toy
(connecting to a person) IS the security primitive (a signed handshake).
Once they're playing, whatever shiny thing fits THAT person — diary,
family tree, proof-of-existence, governance, Nostr, sovereign medical
records — is the door they walk through. Sell the FEELING ("the
receipts": I was here, I knew these people, nobody can erase it or charge
me), not the noun.

## What already exists (grounded against the repo)

- **The graph is half-built.** `PeopleTree.tsx` (344 lines) renders the
  operator at center, handshake peers on an inner ring colored by
  relationship category, orgs + family-units on outer rings.
  `peopleTreeLayout.ts` computes deterministic radial angles
  (FNV-1a hash of pubkey, shared with the identicon palette).
- **Two verification tiers already signed.** `createHandshake.ts` signs
  `verification: 'in-person'` (Tier P, the 3-QR exchange) and
  `verification: 'remote'` (Tier R, `buildRemoteHandshakeDraft`). Both
  are real attestations TODAY. **But `TreePeer` carries only
  `category` + `angle` — NOT the verification tier — so the layout
  cannot yet show the difference.** (Confirmed: peopleTreeLayout has no
  verification field.)
- **Multi-source overlap seed.** `findVouchingCircleCandidates.ts` already
  ranks peers by appearing across family + cohort + handshake sources.
- **Trust-weight primitive.** `weighting.ts` `computeWeight` sums distinct
  signer weight; `advancedWeighting()` is a reserved v1.1 stub whose
  stated job is recency decay + corroboration-graph centrality.
- **Distribution channel.** Share-to-Nostr (kind-1, item 8) ships — every
  published proof is an ad to the audience that already cares.

So: the data for the first delightful cuts already exists. What's missing
is rendering it, weighting it, and one new gesture.

## The cuts, in recommended order

### Phase A — make the existing data delightful (no new crypto, no server)
These run on one-hop data already in the wallet. Highest
captivation-per-hour; lowest risk. Start here.

- **A1. Visual verification tier on the graph.** Thread the
  `verification` leaf through `TreePeer` into `PeopleTree`. Render remote
  edges thin/faint/dashed, in-person edges bold/solid/glowing. Pure
  visual; every byte already present. THIS is the cheapest cut that
  proves "the graph is the toy" on screen — the map stops being a flat
  diagram and starts showing who you've actually looked in the eye.
  **First cut. Do this one first.**
- **A2. In-person UPGRADE gesture.** At a meetup, add an in-person
  attestation ON TOP of an existing remote handshake, keeping both. The
  remote edge stays ("known online since March"); the in-person layers
  on ("verified face to face in October"). The edge accumulates history
  + weight. This is the emotional payoff moment — deferred from signup to
  the meetup, which is inherently meaningful and unfakeable. Reuses the
  3-QR in-person flow; the new part is "attach to existing peer" rather
  than "create new peer."
- **A3. Weight in-person > remote.** A multiplier in the weighting path
  so in-person edges carry more trust than remote. Small, composes the
  existing `computeWeight` / reserved `advancedWeighting` slot. Makes the
  upgrade in A2 mean something numerically.
- **A4. First discovery cards.** Background-compute the surprising facts
  from one-hop holdings and surface them like fitness-app streak cards:
  "4 friends in common with Sarah," "your family ring just closed a
  loop," "you've verified 3 people in person this month." The honest,
  sovereign, local-only version of the People-You-May-Know mirror — data
  never leaves the device.

### Phase B — the genuinely hard, architecturally-heavy pieces
These gate the FULL dream (multi-hop, "Alaska 5 hops away," circles
fusing across the country, native tap). Do NOT start here — they're
expensive and each carries a real design tension. Named so they don't
ambush us.

- **B1. Multi-hop graph data.** "Someone in Alaska 5 hops away" needs the
  wallet to gather edges beyond immediate handshakes. THE TENSION: doing
  this sovereignly — without a server that sees everyone's web — is hard;
  the cheap way to build the addictive version is exactly the
  surveillance model we're replacing. Discipline: compute locally /
  peer-to-peer even when harder. This is a research-flavored cut, not a
  weekend one.
- **B2. Native app (App Store / Play).** The satisfying phone-to-phone
  NFC tap + rich haptics that make first-connection magical CANNOT happen
  on a PWA. On web today the in-person path is the 3-QR scan — real and
  working, but a scan-and-show dance, not a tap. App Store is a real
  growth MILESTONE, not a someday. Interim: make the QR exchange feel
  ceremonial now (A-phase polish). Copy-paste is the weakest gesture —
  keep it the remote FALLBACK, never the headline.

### Phase C — trust-and-safety backbone (before exposing the graph to strangers)
The graph judging "who's real" must be honest before it's public-facing.
This is the equivocation/fork-resolution brief's territory — same engine.

- **C1. Graph-interlock weighting** (the `advancedWeighting` v1.1 spec):
  weight vouches by interlock, discount self-referential islands, ALWAYS
  per-verifier (never a global score). See the fork-resolution brief.
- **C2. Fork detection + judge-weighted resolution**, and the
  flag → must-prove-itself transition. The cut that lets a STRANGER
  resolve "which key is really you."
- **C3. The honesty guardrails** that must ship WITH any public trust
  surface: "I can't see enough to judge this" must look completely
  different from "I judged this and it's bad" — conflating unknown with
  untrusted would brand every new honest user as a spammer. No global
  trust number ever shown; show the PATH and the HUMANS ("vouched for by
  Alice, Bob, Carol — who also know each other") instead of a percentage.

### Phase D — the five front doors (onboarding framing, parallel to A)
One substrate, five emotional entry points, each leading the same place
(holding a sovereign key without being asked to care about crypto):
Bitcoiner → the keys; new parent → the baby-memory vault (diary + BTC
anchor = permanent, private, provably-yours memory); prepper → the family
recovery web; genealogy nerd → a cryptographically-TRUE family tree;
privacy person → "no corporation in the middle." Per-persona onboarding
copy + a "what brings you here?" first-run fork. Mostly copy + routing,
can land alongside Phase A.

## Recommended sequence & honest gates

1. **Operator field-tests first** (only the operator can retire this):
   adopt-key round-trip, backup banner, recovery paths on real hardware.
   Untested-on-device is the standing risk.
2. **A1 (visual tier)** as the first real growth code — cheapest, all
   data present, proves the thesis on screen.
3. **A2 → A3 → A4** in order — each makes the map more alive on existing
   data.
4. **D (front doors)** can run in parallel with A (copy/routing work).
5. **B and C are deliberately deferred** — B is architecturally heavy
   (sovereign multi-hop, native app); C gates public-facing trust and
   reuses the fork-resolution machinery, so it should follow PLAN.md item
   11's release-ceremony work rather than precede it.

The discipline: bank captivation-per-hour with the four cheap Phase-A
visual cuts before spending on the expensive multi-hop / native / trust
pieces. The toy has to be fun on one hop before the deep graph is worth
gathering.
