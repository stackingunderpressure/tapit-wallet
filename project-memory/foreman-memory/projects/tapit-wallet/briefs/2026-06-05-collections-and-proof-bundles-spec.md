# Spec — Collections + multi-proof bundles + honest streak reminders (2026-06-05)

*Operator direction: organize signed journal moments into curated
collections of his choosing ("a Merkle tree of my choosing"), select many
and share proof of all of them at once, publish if he wants, and keep the
daily-post streaks with gentle reminders. Hand-off-ready for the cutting
carpenter. Grounded against the current journal + disclosure features.*

---

## What already exists (build on, don't rebuild)

- `journal/categories.ts` — entries already carry a category (Diary, etc.).
  That's a fixed grouping axis; collections are the **user-named, arbitrary,
  many-membership** version on top.
- `journal/computeStreak.ts` + `FreshStreakIndicator.tsx` — streaks are
  already computed and shown. The new ask there is **reminders**, plus an
  honesty constraint (below).
- `journal/findMemoryEntries.ts` + `FreshMemoriesStrip` — a "memories"
  surface already resurfaces past entries.
- `disclosure/ShareProofModal`, `QuickShareModal`, `parseDisclosureProof`,
  `buildVerifyUrl`, `VerifyProofScreen` — single-entry verifiable
  share-proof already works. The gap is **proof of MANY at once**.
- Every journal entry is already a signed Merkle field-tree with a root
  (envelopeId) + Bitcoin anchor.

So the genuinely new work is: collections, the multi-entry proof bundle,
and gentle streak reminders.

---

## 1. Collections (the "Merkle tree of your choosing")

A collection is a **named, user-curated set of journal entries** — "Moments
that unlocked something," "Made me cry," "Lessons." An entry can live in
several. Two layers, mirroring patterns already in the repo:

- **Draft layer (local, mutable):** like the secrets ledger, a local
  encrypted-at-rest list of `{ id, name, description, memberEnvelopeIds[],
  createdAt }`. Add/remove/reorder freely while you arrange. (Reuse the
  `secretsLedgerStore` encrypt/decrypt-over-idb pattern.)
- **Sealed layer (signed + anchored, on share/publish):** when the operator
  shares proof of a collection or publishes it, MINT a `collection`
  attestation — a small signed envelope whose leaves are the name,
  description, and the **member envelopeIds** (the roots of the entries it
  references) + created date — signed by the wallet and anchored. Now the
  *curation itself* is provable and timestamped: "Tom gathered these twelve
  moments into this set on this date," un-tamperable. This is the recurring
  shape — a small signed envelope that references durable proofs — a
  tree-of-trees over the entry roots.

Drafting is mutable; sharing/publishing seals a snapshot. Re-share = new
snapshot.

## 2. Multi-entry share-proof bundle

Select many entries (a whole collection, or ad-hoc multi-select) → produce
ONE disclosure bundle a reader can verify: each entry's disclosed leaves +
signature + anchor, readable as a sequence, behind one verify link/page.
Extend the existing single-entry disclosure (`parseDisclosureProof`,
`buildVerifyUrl`, `VerifyProofScreen`) to an array; `VerifyProofScreen`
renders the set so "someone could read through those" and check each one's
math. Optionally include the sealed `collection` attestation as the bundle's
header so the curation + the date are themselves verified.

## 3. Organize UX

- A **select mode** in the journal: multi-select entries → "Add to
  collection" / "New collection."
- A **Collections** view: list of your collections; open one to reorder,
  remove, "Share proof of all," and "Publish."
- Keep it fun and light — this is meant to be a pleasure, the operator's
  words: "fun to do and share and anchor in time."

## 4. Publish (optional, always deliberate)

Share the bundle via the system sheet, a verify URL to the whole collection,
or (opt-in) public kind-1 notes. Private by default; publishing is always an
explicit act, never automatic.

## 5. Engagement + streak reminders (operator correction 2026-06-05)

The carpenter's first draft of this section over-cautioned. The operator
corrected it, and he's right: **engagement here is GOOD, because it keeps the
data fresh and the circle warm — it is operational readiness, not vanity.**
In a circle-based sovereign wallet the failure mode is real: if your
recovery holders, secret-keepers, and vouchers haven't opened the app in a
year, then at the moment you actually need them they're cold — forgotten
passphrase, lost device, app deleted, can't find their login — and your
safety net is decorative instead of functional. An untested backup is not a
backup; a circle that never exercises can't catch you when you fall. So
regular light touch is a SAFETY FEATURE, like checking the smoke-detector
battery.

The honest line is therefore NOT "streak yes/no" — it's **purpose**: does
the open serve the USER's own functioning, or a platform metric? We have no
ads and no engagement KPI, so we have only the first kind to serve, which is
exactly what makes driving engagement honest here.

- **Build (honest, user-serving):** streaks as a mirror of your own
  practice; opt-in reminders at a user-chosen time; and — higher value —
  reminders tied to real readiness ("it's been 8 months since Mom opened her
  recovery piece; a quick hello keeps your recovery working", "your backup
  hasn't been tested in a year — run a drill?"). The payoff accrues to the
  user's own safety.
- **Don't build (dishonest):** content-less manufactured anxiety that drives
  opens for opens' sake with NO readiness payoff — guilt badges and
  escalating off-hours nags engineered for a metric the user doesn't benefit
  from. Only this narrow case is off-limits.

### 5b. Circle liveness — the engagement that matters most

The operator is already engaged (posting daily); the real risk is the
CIRCLE going cold. So the highest-value engagement feature isn't keeping the
owner posting, it's keeping the people who hold his keys/secrets/shares warm
enough to help when it counts. Worth spec/ing as a sibling: a "your safety
net's readiness" view (who in your circle has gone quiet, whose share may be
at risk), gentle nudges to ping cold holders, and a periodic recovery DRILL
that exercises the scheme so you find out it's broken in a calm moment
instead of an emergency. This is engagement as honest safety-monitoring, and
it's directly load-bearing for whether the whole sovereignty model works at
the moment of need (it's the maintenance discipline — "protected through all
time is a discipline you maintain" — turned into a feature).

---

## Suggested cut order (each independently shippable)

- **Cut 1:** Collections draft layer (local) + organize UX (multi-select →
  add to collection; collections list/detail). No new crypto. Smallest.
- **Cut 2:** Multi-entry share-proof bundle (select collection → one verify
  page) + the sealed `collection` attestation minted on share/publish.
- **Cut 3:** Publish surfaces + streak reminders + circle-liveness readiness
  (per section 5/5b — engagement framed as readiness, not vanity).

## Non-goals
The ONE off-limit (narrow): content-less manufactured-anxiety mechanics that
drive opens for a metric with no readiness payoff to the user. Everything
that keeps the user's data fresh and circle warm is in-scope and good.
Collections private by default; publishing always a deliberate act. The
feature serves the user's own functioning and record — and engagement that
serves THAT is honest, per the operator's correction.
