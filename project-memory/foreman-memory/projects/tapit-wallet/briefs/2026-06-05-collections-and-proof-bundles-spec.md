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

## 5. Streak reminders — HANDLE WITH CARE (the one honesty constraint)

Streaks already compute/display. The operator wants reminders "thrown back
up at me." This is the ONE place this feature can drift across the line the
operator himself drew and the Mission block in CLAUDE.md states: **we do not
mesmerize users or farm attention.** A streak has an honest form and a
manipulative form, and they look similar:

- **Honest (build this):** the streak is a mirror of the operator's OWN
  chosen practice, like a runner's logbook. Reminders are opt-in, user-set
  time-of-day, encouraging, and gentle. The frame is "here's your practice,
  you're on day 14." It serves the user's commitment.
- **Manipulative (do NOT build):** manufactured loss-aversion — "Don't break
  your streak!" guilt, red-alert badges, off-hours nags, escalating
  notifications engineered to pull the user back for an engagement metric.
  This is the exact dopamine/attention-farm the whole product is built
  against. There is no ad model and no engagement KPI here to justify it.

Implementation: opt-in reminder with a user-chosen time, calm copy, easy off
switch, no guilt framing, no off-hours pings. If in doubt, lean gentler. The
streak celebrates the practice; it never weaponizes the fear of losing it.

---

## Suggested cut order (each independently shippable)

- **Cut 1:** Collections draft layer (local) + organize UX (multi-select →
  add to collection; collections list/detail). No new crypto. Smallest.
- **Cut 2:** Multi-entry share-proof bundle (select collection → one verify
  page) + the sealed `collection` attestation minted on share/publish.
- **Cut 3:** Publish surfaces + opt-in gentle streak reminders (per the
  honesty constraint above).

## Non-goals
No engagement-farming streak mechanics, no guilt notifications, no off-hours
nags; collections private by default; publishing always a deliberate act.
The feature serves the operator's own joy and his record, not a metric.
