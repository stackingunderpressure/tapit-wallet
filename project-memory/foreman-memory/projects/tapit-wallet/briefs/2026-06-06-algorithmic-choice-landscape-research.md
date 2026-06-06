# Research — the algorithmic-choice / custom-feed landscape (2026-06-06)

*Operator question: are there platforms that let you customize your news-feed
algorithm, or other custom-algo businesses? Deep-research pass, five angles,
cross-verified. Sources dated; recency caveats flagged. The strategic point
for Tapit is in §7 (the unclaimed ground).*

> **Bottom line:** Algorithmic choice is real and shipping — but almost only
> on the **non-captured** open protocols, because choice is only possible
> where the data isn't locked to the algorithm. The captured giants offer
> tuning knobs, never a swappable algorithm. The clearest funded business is
> **Graze** (Bluesky feeds). The biggest gap — nobody is doing it — is feed
> choice rooted in your **own signed web-of-trust and identity, portable
> across networks, with institutions in the graph, taught through use.** That
> gap is Tapit's exact thesis.

---

## 1. Where algorithmic choice ACTUALLY ships (open protocols)

**Bluesky / AT Protocol — the proof it works.**
- Custom feeds (feed generators): external services that return a ranked post
  list; users subscribe to feeds as pinnable tabs. Seeded with ~6 by the team,
  now overwhelmingly third-party. (bsky.social/about/blog/7-27-2023-custom-feeds;
  docs.bsky.app/docs/starter-templates/custom-feeds)
- Composable / stackable moderation via **Ozone** (launched 2024-03-12): run a
  third-party labeling service; users subscribe to **up to ~20 labelers** on
  top of Bluesky's baseline, network-wide across atproto. Examples: Blacksky.
  (bsky.social/about/blog/03-12-2024-stackable-moderation; techcrunch 2024-03-12)
- Scale: Bluesky ~**40M+ registered** (Jan 2026), DAU est. ~3.5–4.5M — *moves
  ~monthly, verify*. (backlinko.com/bluesky-statistics; socialmediatoday)

**Nostr — same idea, pay-with-sats flavor, earlier/thinner.**
- Data Vending Machines (DVMs, NIP-90): broadcast a job + willingness to pay,
  competing providers fulfill; **kind 5300 = algorithmic "content discovery"
  feeds**; payment via Lightning/zaps (sats). (github.com/nostr-protocol/nips/blob/master/90.md)
- Client support: **Amethyst** (DVM feed picker), **Primal** (own server feeds +
  Lightning), **Coracle** (web-of-trust ranking). Traction real but small/early.
- Portable curation primitives: NIP-51 lists / "follow packs", NIP-32 labels —
  curation authored under your key, subscribable across clients.

**Farcaster — funded, but choice concentrated in one client.**
- Channels + client-level feeds, but Warpcast (rebranded "Farcaster" May 2025)
  reportedly ~100% of activity, so choice is theoretical. Raised **$150M Series
  A (2024, $1B valuation, Paradigm/a16z), ~$180M total**; usage reportedly
  declined ~40% from peak by late 2025. (techcrunch 2024-05-21; blockeden 2025-10-28)

**Mastodon / fediverse — least mature.** Chronological by default; third-party
experiments only (FediFeed user-customizable algorithm; braids.social slider;
Mammoth "For You"). No first-party feed marketplace.

## 2. The funded businesses building on this

- **Graze** — the clearest private company. Bluesky feed-builder + ad
  monetization; powers ~4,500 feeds / ~3,000 builders, "hundreds of thousands
  of daily users." **$1M pre-seed (Apr 2025), Betaworks + Salesforce Ventures**
  (+ Mozilla/Protocol Labs angels). Alive, shipping. (techcrunch 2025-04-16)
- **Free Our Feeds** — philanthropic campaign (Jan 2025), **$30M/3yr target
  ($4M immediate)** to build independent AT-Protocol infra (a second relay) so
  the network survives even if Bluesky-the-company is captured. Custodians from
  Mozilla Foundation, Social Web Foundation, New_ Public; backers incl. Ruffalo,
  Wales, Doctorow. (techcrunch 2025-01-13) *End-2025 milestones unverified.*
- **Surf — by FLIPBOARD, not Mozilla** *(correction to the original framing).*
  A "browser for the open social web": one composable feed across Bluesky +
  Mastodon + RSS + podcasts + YouTube, user-curated. Beta Dec 2024, broader GA
  ~2025–2026. (niemanlab; about.flipboard.com)
- **Attie** — Bluesky's own AI feed-builder ("vibe-code your feed" in natural
  language), beta 2026, built on Anthropic's Claude. (techcrunch 2026-03-28)
- **SkyFeed** — open-source visual feed builder (community, not a company).

## 3. Adjacent: bias-transparency / perspective news (user-facing)

- **Ground News** — compare a story across left/center/right with bias,
  factuality, ownership labels; founded 2020 (Harleen Kaur). Funding small
  (~$1M reported, low-confidence); huge distribution — the single most common
  YouTube sponsor in a 2025 Axios sample. Alive. (wikipedia/Ground_News; axios 2025)
- **Improve the News / Verity** — *closest analog to user-tuned feeds*: free,
  nonprofit (Max Tegmark, 2020) with **left–right + "nuance" + "establishment"
  sliders** to tune coverage across 5,000+ sources. (improvethenews.org)
- **Tangle** — multi-perspective politics newsletter (left/right/my-take),
  ~470K subs / ~70K paying, ~$4M revenue 2025, bootstrapped. Editorial, not
  algorithmic. (pressgazette 2025)
- **Particle** — AI multi-source news reader, ex-Twitter founders, **~$15.3M
  raised** (Kindred, Lightspeed). AI-curated more than user-curated.
- **Artifact — DEAD.** Instagram founders' AI news reader, shut down Jan 2024
  ("market opportunity isn't big enough"), tech sold to Yahoo. (techcrunch 2024-01-12)

## 4. Feed-reader renaissance (compose-your-own across sources)

Tapestry (Iconfactory; Kickstarter $178K, 2024–25), Reeder (2024 rebuild),
**feeeed** (lets you pick the feed algorithm — explicit user control), Surf
(above), NetNewsWire (free/open), Readwise Reader (premium; won consolidation
as Omnivore + Pocket died 2024–25). All user-curated, mostly indie/no-VC.

## 5. B2B recommendation-as-a-service (NOT user choice — the opposite)

Algolia (~$335M raised, ~$2.25B val), Recombee (bootstrapped), Shaped (~$8M,
Madrona/YC), Trieve (acquired by Mintlify 2025). These sell ranking **to
companies for their own apps**; the end user gets no choice. Important to not
confuse with "choose your feed."

## 6. The captured incumbents + regulation

- **None of Meta / TikTok / X / YouTube let a user or third party install or
  swap the ranking algorithm.** They ship tuning knobs: chronological/Following
  toggles, "not interested," non-personalized modes, reset buttons. X
  open-sourced its recsys code (2023) = **transparency, not swappability** (no
  weights, no install path). Threads federates *content* via ActivityPub (a
  separate, unranked, opt-in fediverse feed) — not a swappable home algorithm.
- **EU DSA Art. 38** forces VLOPs to offer **at least one non-profiling feed
  option** (in force; Meta since Feb 2024) — a non-profiling *option*, NOT
  third-party algorithms. Enforcement live: EU preliminary breach findings vs
  TikTok + Meta (Oct 2025); a Dutch court dinged Meta for auto-resetting the
  chronological choice.
- **DMA interoperability = messaging only** (WhatsApp/Messenger); no feed
  interoperability mandate; a social-networking interop *review* is expected
  2026. US ACCESS Act (portability/interop) reintroduced 2023, **never enacted**.

## 7. The middleware thesis (the intellectual backbone)

Fukuyama / Stanford (2021): unbundle curation from hosting so competing
**third-party "middleware"** lets users pick external ranking — First-Amendment-
safe, pro-competition. Carried forward by Renée DiResta (2024 Stanford
workshop/report). Critiqued by **Daphne Keller's four problems**: feasibility at
platform scale, who pays, who bears moderation cost/liability, friends'-data
privacy. Roots in Mike Masnick's "Protocols, Not Platforms" (2019). **Status:
alive as policy/academic agenda; the vision largely materialized through
Bluesky/AT-Proto, not through the incumbents.** "Marketplace of algorithms" was
later Bluesky framing, not literally the 2019 announcement. (journalofdemocracy 2021;
mdi.georgetown.edu 2024; knightcolumbia 2019)

## 8. THE UNCLAIMED GROUND (why this matters for Tapit)

Every web-of-trust feed system today infers trust from **follows/mutes** — a
weak, noisy signal — not from deliberate **signed vouches**. Closest to
identity-rooted feed choice is the **Nostr stack**: **Vertex** ("Web of Trust
as a Service" — personalized PageRank seeded from *your* pubkey, MIT-licensed),
**NIP-85 Trusted Assertions** (merged Jan 2026 — you declare which trust
providers shape your feed), Coracle's WoT ranking, and **Pubky** (Synonym/Tether
— curation rooted in user-held keys, but its own pkarr keys + own network).
Bluesky has the best mass UX (social-graph feeds + subscribable labelers) but
the curation isn't rooted in a user-held signing key.

What **nobody** has shipped, and what maps onto tapit-attest exactly:

1. **Trust from explicit signed attestations/vouches**, not noisy follow graphs.
2. **Institutions in the graph** — "the church/boss/org I vouched for shapes
   what reaches me." Today's WoT is person-to-person follow graphs only.
3. **Portability across networks** — one web-of-trust filter spanning Nostr +
   Bluesky + the open web, not siloed per app.
4. **"Subscribe to / pay a curator or community as your filter," rooted in your
   key** — the rails (zaps, Cashu, DVM pay-per-query) and the curation
   primitives both exist; nobody fused them into a product.
5. **Sovereignty-literacy-through-use** — every project here assumes a
   crypto-savvy user; none teach the person what a web of trust *is* while they
   use it. That bridge is Tapit's distinct edge.

## 9. Honest caveats
- "Surf by Mozilla" was wrong in the prompt — it's **Flipboard's** Surf.
- Funding/valuation/user figures from aggregators (Crunchbase/PitchBook/Growjo)
  and counts that move monthly (Bluesky, Farcaster) are approximate.
- Several primary pages returned HTTP 403 to the fetcher; those claims rest on
  search snippets + secondary sources (flagged in the raw findings).
- TBD/Web5 "wound down," Free Our Feeds end-2025 milestones, Surf GA date, and
  the Vertex launch month are reported-but-not-independently-confirmed.
- The "pay-your-curator product gap" is an inference from absence (moderate
  confidence) — this subfield moves fast; re-check before betting on it.
