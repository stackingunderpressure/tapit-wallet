# Spec — the teaching system: sovereignty literacy through use (2026-06-06)

*Operator: "Ready to fill it. How do we teach it." This specs HOW the wallet
teaches a normal person sovereignty/web-of-trust/proof as they use it — the
one piece of the algorithmic-choice landscape (see the 2026-06-06 research,
§8) that nobody else builds. Generalizes the secrets-scoped
2026-06-05-sovereignty-literacy-education-spec into a reusable whole-wallet
teaching layer. Hand-off-ready for a cutting carpenter.*

> Goal / the test of success: after using it for a week, the person could
> explain to their mom WHY no single person can leak the safe word, or WHY a
> stamped photo can't be changed. If they can teach it back, we taught it.
> (Mirrors the LIVING-IDEAS teach-back rule.)

---

## The pedagogy (principles the build encodes)

1. **Just-in-time, not just-in-case.** Teach a concept at the exact moment it
   bears on a decision the person is making — never upfront, never in a help
   section nobody opens.
2. **Show the consequence, not the mechanism.** Never "Shamir," always "even
   if three of your people are unreachable, you still get it back." Teach what
   it does FOR them, in their words. Zero jargon on the surface (tested).
3. **Progressive disclosure.** Surface = the plain action. One tap deeper =
   "why this works" in plain language. One more = the actual crypto, for the
   curious. Nobody is forced down; the curious can always go.
4. **Question-first (Socratic).** A plain question the person can answer IS
   the lesson — "does it hurt if someone SEES it, or only if you LOSE it?"
   Answering it teaches the distinction by making them think it through. Use
   chip-form (PFOR-019).
5. **Enact at low stakes, then name it.** The person does a small REAL action
   (vouch for mom, stamp a photo, split the Wi-Fi password, run a recovery
   drill), and the app names what they just did and why it's powerful — so the
   capability and the understanding arrive together, earned by doing.
6. **Aha-moments — design the visceral demo.** Some concepts install in one
   felt beat: the first time you verify a stamped photo and SEE the Bitcoin
   block, you get "tamper-proof" in a way no paragraph delivers. Instrument
   the first-time moments for the "whoa."
7. **Reflect their own data back.** The best teacher is the person's own graph
   and record — "here's your web of trust; here's who could bring you back;
   here's what you've proven." Concrete-to-them beats abstract.
8. **Name the pain before the cure.** Surface the problem they already have
   ("what happens to your accounts if you lose your phone?") then show the tool
   as the answer. People learn what they feel they need.
9. **Analogy to the familiar.** Bridge the new from the known — a spare key
   with a neighbor, a box that needs two keys, "ask my smart friend."
10. **Honest milestones, never gamified.** Mark the moment a capability was
    acquired ("you just set up your first recovery circle — here's what you
    can never lose now"), framed as readiness, not a streak-guilt hook.
11. **The Sage tutor as backstop.** A patient, plain-language, non-biased
    in-app explainer (the wallet bot) that answers "what is this / why does it
    matter" on demand, contextual to what you're doing, and never makes you
    feel dumb. This is the LLM-collapses-the-UX-wall bet made literal.

Non-negotiable per CLAUDE.md Mission: plain language, **non-biased** (teach the
capability and the tradeoff, never a conclusion; for the individual's benefit
above any group's), no course/quiz gate, no condescension.

---

## Buildable architecture (one teaching primitive, many mounts)

1. **`ExplainChip` / `WhyThis` — ONE reusable inline explainer component.** A
   tappable "?" or one-line note that expands plain-language depth layers
   (consequence → why-it-works → the-crypto). Mounted at every concept/decision
   point. Same principle as the camera: one teaching component, many mounts —
   never re-explain ad hoc.
2. **`literacy.ts` — the content module.** Plain-language lessons keyed by
   concept: web-of-trust, vouch, anchor/timestamp, recovery, threshold,
   leak-vs-loss, filter/curation, keys/custody, witness/corroboration. Each
   has: a one-line "what it does for you," an optional plain "why it works,"
   an optional "the crypto" layer, and which aha-trigger (if any) it owns. A
   **jargon-guard test** (no Shamir/threshold/descriptor on the surface layer)
   like secretTemplates.test. Generalizes secretLiteracy.ts.
3. **The just-in-time trigger map.** Fire the right explainer/aha at the right
   moment — first vouch, first stamp, **first verify (aha: surface the Bitcoin
   block)**, first secret (leak-vs-loss question), first recovery setup, the
   recovery drill, first filter/curation choice.
4. **The recovery DRILL — enacted teaching.** A safe practice run that teaches
   recovery by doing it (also the circle-liveness/readiness feature). You learn
   what recovery IS by enacting it in a calm moment.
5. **Honest milestone acknowledgments** at capability-acquired moments.
6. **(Later) Sage contextual tutor** — the wallet bot answering literacy
   questions in plain non-biased language on demand.

---

## Cut order (each independently shippable)

- **Cut 1 (foundation):** the `ExplainChip` primitive + the `literacy.ts`
  content module + jargon-guard test, mounted at 2–3 highest-value points: the
  first vouch ("you just signed that you trust them — worth more than a like,
  because it's yours and it's permanent"), the **first verify aha** (show the
  block: "nobody can change this now, not even us"), and the secret
  leak-vs-loss question. Everything else mounts on this.
- **Cut 2:** the full just-in-time trigger map + honest milestones.
- **Cut 3:** the recovery drill (enacted teaching + circle-liveness readiness).
- **Cut 4:** the Sage contextual tutor (on-demand plain-language explainer).

## Non-goals
No academy/course gate, no quizzes, no streak-guilt, no jargon on the surface,
no biased conclusions. The teaching serves the individual's understanding so
they could teach it back — full stop.
