# Spec — Sovereignty literacy: education through use (2026-06-05)

*Operator directive: the app's real product is teaching a person to be
sovereign as they use it, in plain non-biased language built for the
individual's benefit. This specs what that education looks like and how to
build it. Hand-off-ready for a cutting carpenter. Grounded against the
current secrets feature (templates + ledger, co-access Shamir).*

> The principle, one line: **education is a property of the configuration,
> not a separate manual.** No academy, no course, no quiz, no streaks. The
> choices a person makes teach them their consequences in the moment they
> make them.

---

## The two teaching levers (the whole curriculum, distilled)

Almost all of personal-sovereignty literacy for this surface reduces to two
questions an ordinary person can answer, and the app should teach by asking
them and acting on the answer.

### Lever 1 — "Does it hurt if someone SEES it, or only if you LOSE it?"
This is the first and most important fork, and the current feature skips it
(it splits everything). The honest truth:
- **Leak-hurts** (a password, a key, a private note): you need a *threshold*
  so no single person — or a thief with your phone — can ever reconstruct it.
- **Loss-only-hurts** (the Wi-Fi password, a door code nobody cares is
  shared): you do **not** need a gate at all. You need *redundancy* — it
  saved somewhere your people can always reach. Splitting it adds friction
  for zero real protection. "You don't need launch codes for your Wi-Fi."
- **Both hurt** (a Bitcoin key, an inheritance packet): threshold for the
  leak, enough reachable holders for the loss.

Teaching this one distinction is the single highest-value piece of literacy
in the product, because it tells the user whether they even need the
ceremony. It also requires a real product change: a **loss-only path** that
does NOT split (today everything splits).

### Lever 2 — the availability-vs-security tradeoff (taught in the moment)
The thing nobody intuits until it bites: **more people required makes it
safer from any one of them, but easier for YOU to get locked out**, because
recovery fails not only from attack but from *unavailability* — holders move,
lose phones, fall out, or die. People understand "more locks is safer"; they
do not understand that more locks can lock *them* out. The threshold dial is
a choice on that curve, and the right spot depends on: the stakes, how
reachable these specific people are, how often you'll need to gather them,
and the medium you'll reach them through (a daily-need secret recoverable
only by snail mail is broken).

The app teaches this by **explaining the consequence of the actual numbers
the user picked**, in plain words, right at the selector — not in a help doc.

---

## What it looks like (UX)

1. **Lead the create flow with Lever 1.** Before (or folded into) the
   template pick, one plain question: "If a person you trust saw this, would
   that be a problem — or would the only problem be *losing* it?" Two answers
   route two ways: leak → the split/threshold path we have; loss-only → a
   lighter "keep-it-safe-with-your-people" redundancy path (no threshold; the
   secret is held so any of them can return it, optimizing for never-lost).
2. **In-the-moment micro-explainers at each choice**, generated from the
   live values, e.g. under the threshold selector: *"You picked 4 of 7. Even
   if 3 of your people are unreachable, you still get it back — but you'll
   need to reach 4, so pick 7 you can actually get to."* Plain, specific,
   tied to the chosen numbers. This is the core of the whole spec.
3. **A reachability prompt** feeding a recommendation + a warning: "How often
   will you need this, and how easily can you reach these people?" When
   need-frequency outpaces reachability, warn honestly ("you said you need
   this weekly but only see these people a few times a year — consider fewer,
   closer holders, or a lighter setup").
4. **Optional "why this works" reveal per concept** (progressive disclosure):
   a small, tap-to-expand plain-language explanation behind any term, never
   shown by default, never jargon, never selling a coin/product/group.
5. **Keep crypto words off the surface** — already a tested invariant in
   secretTemplates; extend it to all new copy.

Education through use, NOT a separate "Sovereignty 101" screen. If a
standalone primer ever exists, it's a destination people *can* reach, never
a gate they must pass.

---

## How to build it (implementation)

- **`secretLiteracy.ts`** (pure, testable): the content + logic.
  - A small keyed map of plain-language lessons per concept (leak-vs-loss,
    threshold, availability, reachability, medium). Non-biased copy, no
    jargon — a jargon-guard test like `secretTemplates.test.ts` already has.
  - Pure functions: `explainThreshold(total, threshold) -> string`,
    `recommendConfig({ leakHurts, lossHurts, needFrequency, reachability })
    -> { split: boolean, total, threshold, note }`, `reachabilityWarning(...)`.
    All pure → unit-tested, deterministic copy.
- **Inline explainer component(s)** in the secrets create flow that render
  `explainThreshold(...)` live under the selectors, and the tap-to-expand
  concept reveal.
- **The leak-vs-loss branch** in `SharedSecretModal`'s create flow, plus the
  loss-only redundancy path. The loss-only path is the one genuinely new
  *mechanism* (today everything Shamir-splits) — scope it carefully; simplest
  honest version is "give a copy to each of your people, tracked in the
  ledger, no threshold," distinct from the split path.
- **Reachability input** (a 1-tap "daily / often / rarely" + "easy to reach /
  hard to reach") feeding `recommendConfig`.
- Reuse the existing template + ledger structures; the ledger already records
  who-holds-what, which is itself part of the literacy (you can see your own
  exposure).

---

## Suggested cut order (each independently shippable)

- **Cut 1 (smallest, highest value):** the in-the-moment threshold explainer
  + the Lever-1 leak-vs-loss question framing in the create flow, copy-only
  where possible. Teaches the two ideas with minimal new mechanism. (If the
  loss-only path is too big for cut 1, ship the *question* and the explainer
  first, route loss-only to the existing split with an honest note, and add
  the true no-split redundancy path in cut 2.)
- **Cut 2:** the real loss-only redundancy path (no threshold) + the
  reachability input and recommendation/warning.
- **Cut 3:** the optional tap-to-expand concept library ("learn as you go").

## Non-goals (hold the line)
No course/academy gate, no quizzes, no streaks or gamification, no
attention-farming, no copy that steers toward any specific coin, product, or
group. The education serves the individual's understanding, full stop — per
the Mission block in CLAUDE.md.
