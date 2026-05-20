# HEARTH_SPEC.md — what a hub is, and what it has to do

*Companion to THE_THESIS.md. This is the technical specification for the hub layer of the operator's vision. First-draft stub written 2026-05-09. Grows with each product that lands on the network. Naming is provisional — the substrate may end up called Hearth, Folk, The Commons, Loom, or something else. The shape underneath the name is what this document describes.*

---

## What a hub is

A **hub** is the unit of personal AI sovereignty. One hub belongs to one person, one family, one community, or one organization — whoever owns it gets to decide. A hub is a small server (cloud, home box, friend's box, doesn't matter) running five layers in a stack, federated to other hubs through trust.

A phone, a laptop, a tablet, a smart speaker — none of those are hubs. Those are **windows** into a hub. The hub holds the data, runs the engine, owns the identity. The window is whatever screen + microphone + speaker is closest to the person at the moment.

This separation is the architectural move that makes everything else possible. Compute decouples from device. Identity decouples from platform. Distribution decouples from app store.

---

## The five required layers

A hub MUST implement all five. The interface between layers is what other builders plug into. Implementations are pluggable; the interface is the standard.

### 1. Identity

Every hub has a public/private key pair. The public key is the hub's identifier in the network. Signatures over recipes, comms records, and federation messages prove provenance.

Operator profile lives here, in three tiers per [THE_THESIS.md]:

- `public/` — voice, style, expertise, anything safe to hand to a remote AI
- `project/` — current projects, doctrines, scoped to specific working contexts
- `sensitive/` — financial, health, family, never leaves the hub without explicit deliberate export

Profile schema is markdown with a small frontmatter header. Existing AppCommander pattern: `appcommander/foreman/operator-profile.md` plus tiered memory in `project-memory/foreman-memory/core/`. The schema is intentionally low-formality so humans can read and write it with no tooling.

**Required operations:**
- `identity.publicKey()` — return the hub's public key
- `identity.sign(bytes)` — sign with private key
- `identity.verify(bytes, signature, publicKey)` — verify a peer's signature
- `identity.profile(tier)` — return the named profile tier as markdown

### 2. Storage

The bench. Where memory, history, recipes, generated apps, comms records live. Storage is owned by the hub operator and must be portable — they can move to a different storage backend without losing anything.

Reference implementation: Supabase (relational + RLS + auth). Alternative implementations welcome: SQLite-on-Pi for fully local hubs, S3-compatible blob storage for static recipe stores, IPFS for content-addressed shared recipes.

The interface is roughly REST-ish CRUD over a small set of resources:

- `recipes/<id>` — signed manifests describing apps/features
- `apps/<id>` — generated app artifacts (code bundles)
- `memory/<layer>/<section>` — markdown memory files (per AppCommander's existing memory tier pattern)
- `comms/<session_id>` — comms protocol records (per AppCommander's existing comms doctrine)
- `peers/<publicKey>` — known peer hubs the operator has connected to

**Required operations:**
- `storage.read(path)`
- `storage.write(path, bytes)`
- `storage.list(prefix)`
- `storage.delete(path)`

### 3. Engine

Frank + Carpenter. The conversational orchestrator and the code-generating worker. Frank knows the operator (reads their profile + memory). Carpenter does the work (generates apps from recipes, ships output, reports back via comms).

The engine is **LLM-agnostic by design.** Reference implementation uses Anthropic Claude (Sonnet for routing, Opus for hard decisions). Alternative implementations are welcome: OpenAI GPT, local LLaMA, Mistral, anyone. The engine's contract is what a hub depends on — not which model implements it.

**Required operations:**
- `engine.ask(message, context)` — Frank-shaped: conversational, uses operator profile + memory, returns a structured reply
- `engine.generate(recipeManifest, context)` — Carpenter-shaped: takes a recipe + operator's profile/guardrails, generates an app/feature, returns artifact + receipts
- `engine.summarize(text, voice)` — used by Comm Filter and similar tools; rewrite text in operator's voice within hard guardrails

Engine implementations should report telemetry (tokens, latency, model) so the operator can see and understand cost.

### 4. Recipes

A **recipe** is a signed manifest describing an app, a feature, or a flow. Recipes are the unit of sharing. They are NOT the running app; they are the description from which any compatible engine can rebuild the app, personalized to the receiving operator.

Recipe format (working draft):

```yaml
v: 1
id: <uuid>
name: <human-readable name>
created_by: <originator-public-key>
created_at: <ISO-8601>
signature: <ed25519 signature of all fields above + the body below>
description: |
  Plain-English description of what this recipe does, why it exists,
  who it's for. Markdown allowed. This is the FIRST thing any
  receiver's engine reads to decide whether to re-personalize.
intent: |
  The original prompt or design statement that generated this recipe.
  Written so any LLM can read it as a working brief.
guardrails:
  - <hard rule the originator wants preserved across re-personalization>
  - <another hard rule>
parameters:
  - name: <variable the receiver's engine substitutes>
    type: string | number | boolean | enum
    description: <what this parameter customizes>
    default: <reasonable default>
artifacts:
  - kind: ui-module | function | data-schema | doctrine
    target: <file path or interface name>
    template: |
      <the actual content, with parameter substitution markers>
```

**Why recipes are not running apps**: receiving a running app means inheriting the originator's data, the originator's deployment, the originator's choices. That's the App Store model. The recipe model is different — receiver's engine reads the recipe, applies the receiver's profile + guardrails, generates the receiver's version. The IDEA travels; the deployment is local. **This is the boundaries doctrine from CLAUDE.md generalized to the network layer.**

**Required operations:**
- `recipes.export(appId)` — turn an app on the bench into a signed recipe manifest
- `recipes.import(manifest, peerPublicKey)` — verify signature, hand to engine.generate, write the resulting artifacts to storage
- `recipes.list()` — list recipes available on this hub
- `recipes.publish(recipeId, audience)` — make a recipe available to the named peers (or "all federated peers" if the operator opts in)

### 5. Federation

How hubs find and trust each other. Federation is the layer that turns isolated hubs into a network.

Federation has three sub-protocols:

**Discovery** — how a hub finds peers. v1 is **manual**: operator shares a hub URL with a friend over any out-of-band channel (text, email, in person). The friend's hub fetches the URL, retrieves the public key, adds to peers. Future versions can layer in friend-of-friend discovery, signed introduction messages, and (much later) reputation-based directories. **Don't try to solve discovery on day one. Manual sharing is fine for the first thousand hubs.**

**Trust** — how a hub decides whether to accept a recipe from a peer. v1 is **direct trust list**: each hub has a list of peers it has explicitly added. Recipes from listed peers are accepted; recipes from unlisted peers are rejected. Future versions can layer in transitive trust ("my friend trusted them, so I do") and reputation scoring. PGP's web-of-trust failed because it asked humans to do too much; learn from that and stay simple.

**Recipe propagation** — how recipes move between hubs. Two patterns:

- **Pull**: receiver fetches a recipe URL the originator shared.
- **Push**: originator's hub announces "I just published recipe X" to its trusted peers' hubs; their hubs fetch it.

Both work; both should be supported. Pull is simpler; push is friendlier.

**Required operations:**
- `federation.addPeer(publicKey, hubUrl)` — register a trusted peer
- `federation.removePeer(publicKey)` — drop a peer
- `federation.fetchRecipe(peerPublicKey, recipeId)` — pull a recipe from a peer
- `federation.announce(recipeId, audience)` — push announcement to trusted peers
- `federation.listAnnouncements()` — see what peers have announced lately

---

## What a hub is NOT required to do

A hub is allowed to be tiny. Folk scale means a hub can run on a Raspberry Pi for a single family of four. A hub does NOT have to:

- Implement every layer in code-perfect form. Stub layers are fine if the operator doesn't use them yet. A hub that skips federation entirely is still a hub — it just doesn't talk to peers.
- Use the reference implementation. Alternative implementations of any layer are explicitly welcome and encouraged.
- Stay always-on. A hub can be laptop-on-and-online-when-needed. Async federation handles intermittent uptime.
- Run AppCommander. AppCommander is the reference Bench, not the only one. Anyone can build a different Bench that implements the same hub interface.

---

## Reference implementation: AppCommander as the first hub

As of 2026-05-09, AppCommander already implements (in some form) all five layers:

- **Identity** — Supabase auth + the operator's profile + tiered memory tier
- **Storage** — Supabase (RLS-scoped per project) + GitHub repo per project for durable artifacts
- **Engine** — Foreman edge function (Frank) + dispatch-carpenter edge function (Carpenter) + Anthropic Claude
- **Recipes** — Frank skeletons in `appcommander/frank-skeletons/` are the proto-recipes; bootstrap-project edge function is the proto-import
- **Federation** — not yet implemented; current AppCommander is single-operator. This is the next big build.

The work to elevate AppCommander into a proper reference implementation is mostly already done. Naming the layers, formalizing the recipe format, exposing federation endpoints, and documenting the contract is what turns AppCommander into a hub-spec-compliant implementation. **That's a deliberate ship target.**

---

## Open questions worth tracking

Each of these is a real research/design question, not a decision yet:

1. **Recipe versioning.** When a recipe gets re-personalized into 100 different deployments and the originator updates the recipe, do the deployments auto-update? Probably not — they're owned by the receivers — but a "recipe v2 is available" signal might be useful.
2. **Cross-engine compatibility.** A recipe built by an Anthropic-Claude engine might not be perfectly receivable by a local-LLaMA engine. How do recipes declare their engine assumptions, and how does an engine decide whether it can faithfully re-personalize?
3. **Recipe revocation.** If an originator wants to retract a recipe (security issue, ethics revision, factual error), does the network honor that? Probably yes for security; probably no for ethics; "honor but mark deprecated" might be the middle path.
4. **Hub-to-hub LLM conversation.** The operator hinted at "backdoor handshakes" — engines on different hubs talking to each other to negotiate compatibility, ask clarifying questions on behalf of the receiver, etc. This is novel territory but doable. Worth experimenting with once the basic pipeline works.
5. **What counts as a hub?** A single PWA running entirely in browser localStorage with no server is *a* hub for *one* person. Is that allowed? Probably yes for personal-use; probably no for the federation layer (peers need a stable endpoint to talk to). The spec should be tolerant of "browser-only personal hubs" as a valid mode.

---

## How other builders plug in

Three explicit invitations:

- **Build an alternative Bench.** AppCommander is the reference; another builder might want a different UI, a different feature set, a different app domain. As long as it implements the five-layer interface, it's a valid hub. The network doesn't care which Bench an operator runs.
- **Build a layer.** Don't want to build a whole hub? Pick a layer (storage, engine, federation) and ship a polished implementation. Operators can swap your layer into their hub. Layer-level competition is healthy and the architecture invites it.
- **Build a tool.** Things that aren't hubs themselves but plug INTO hubs: profile editors, recipe browsers, federation visualizers, trust-graph monitors, hub-health dashboards. The hub interface gives you everything you need.

The expectation is that within a year of THE_THESIS.md being public, multiple alternative implementations of every layer will exist. The operator does not want to be the only builder. Anyone reading this and wanting to plug in: do so.

---

## How to grow this document

This file is **append-as-decided**. Don't edit prior decisions in place; add new sections, mark prior sections as superseded if they need replacing, link forward. Same discipline as the foreman-memory append-only pattern. Future versions of this spec can be HEARTH_SPEC_V2.md or similar; this file stays as the v1 record of what was decided 2026-05-09.

The operator's stated intent: **let other builders shape this alongside them.** Pull requests against this document, from anyone implementing a hub or a layer, are explicitly welcome. The architect-and-steward role means holding the doctrine open without letting it drift into incoherence.

---

*— Stub written 2026-05-09 by Claude Code. Companion to THE_THESIS.md. Version 1, intentionally incomplete, expects to grow.*
