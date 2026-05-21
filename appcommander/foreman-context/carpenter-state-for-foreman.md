# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander still down. Operator
continuing Netlify + Supabase wire-up in parallel. Dual-surface
comms remains active.

---

## WHAT-CHANGED-RECENTLY

**Library-seam audit converted from verbal pattern to mechanical
check** at commit `66637f1` on branch + main. Per CLAUDE_ROOT.md
non-negotiable #5 ("Mechanism over prose. When a rule keeps
getting missed, the fix is a check that fails — not another
paragraph in this file") and the gate fence's "tapit-attest
integrity: no re-implementation" rule.

New `src/library-seam.test.ts`:
- Walks every `.ts`/`.tsx` file under `src/features/` (excludes
  test files).
- Extracts function definitions, class definitions, and
  const-arrow-or-function-assignment names via three regex
  patterns.
- Fails the test if any name overlaps `Object.keys(tapitAttest)` —
  the runtime export surface of the library.
- `ALLOWLIST` exists for intentional coincidences but is empty
  by design — every existing wallet name is distinct.

**Verified mechanically**: injected a canary file
`src/features/journal/__canary.ts` exporting `function
envelopeId()` (a name that's already a tapit-attest export). Test
failed loudly with the exact file path, the colliding name, and
a helpful error message pointing at `ALLOWLIST` as the fix path.
Removed canary, re-ran, back to 17/17 clean. "Don't trust, verify"
applied to the check itself.

What it catches:
- Name collisions where the Carpenter accidentally defines a
  function or class whose name shadows a library primitive.
- The three real bugs caught by the verbal pattern this week
  (entry-digest, anchor-attachment, useWalletIdentity reference)
  were all in this class.

What it does NOT catch:
- Semantic collisions where the Carpenter re-implements a
  library primitive under a different name. Still needs eyes on
  the diff. The next refinement would be a heuristic flag on
  wallet code that imports library-internal building blocks
  (`taggedHash`, `concatBytes`, etc.) — but those aren't in the
  public surface so the wallet shouldn't have those imports
  anyway.

Runtime cost: ~13ms. Lives in `npm test` so fires on every gate
cycle. No bundle impact (test files excluded from build).

## Gates at session end

**Root:** typecheck / lint / test (17/17 — 12 persona-contract +
4 manifest-registry + 1 new library-seam) / build all green.

**tapit-attest:** unchanged at 82 / 78 / 0 / 4.

**Keys-never-leave audit:** clean (doctrine-only commit, no
runtime surface touched).

**File-size rule:** satisfied.

## WHAT'S-PENDING

1. **Operator browser-verifies the full v1 stack** against the
   live Netlify + Supabase deploy when it lands. PLAN.md's
   closing section has the walk.
2. **Five non-blocking follow-ups:**
   - Multi-tab worker coordination (BroadcastChannel leader
     election).
   - HEIC/WebP photo re-encode in composer (`canvas.toBlob`).
   - Bundle-budget audit before the next meaningful feature.
   - OTS fixture restoration (4 skipped library tests).
   - `Tap-it-Attest-main.zip` cleanup at repo root.
3. **Phase 5 — Mycelium + Shamir recovery cascade.** Holds for
   MYCELIUM_NETWORK_SPEC.md.
4. **Phase 6 — Full-keypair family custody.** Optional now
   (Phase 2.6 covers the operator's grandchild scenario).
5. **Phase 7+ non-goals enumerated in PLAN.md.**

## WHAT-TO-FLAG

**The doctrine drove this commit.** Non-negotiable #5 directly
selected the next task — convert the repeating verbal pattern
into mechanism. The same selection pattern is available whenever
a Carpenter notices another rule-keeps-getting-missed shape. Frank
should be alert to: every time a verbal discipline catches a bug
across multiple sessions, that's a candidate for conversion to
mechanism.

**The doctrine-tests directory pattern is emerging.** Three
top-level test files now exist in `src/` outside any feature
folder: `persona-contract.test.ts`, `features-registry.test.ts`,
`library-seam.test.ts`. If a fourth doctrine-test lands, the
Carpenter should hoist them into a `src/doctrine-tests/` folder
or similar so the surface stays tidy.

**Semantic-collision bugs are still possible** despite the new
check. Eyes-on-diff remains necessary for that subset. The new
check handles the dominant subset (name collisions).

## RECOMMENDED-NEXT-MOVES

1. Operator finishes Netlify+Supabase wire-up.
2. Operator walks PLAN.md's verify checklist against the live
   deploy.
3. If clean: ship. If any stall: report the specific failure
   and the next session diagnoses + fixes.
4. The five remaining follow-ups are available for any quiet
   slot.
5. Phase 5 holds for MYCELIUM_NETWORK_SPEC.md.

## OPERATOR'S-CURRENT-VIBE

Decisive, parallel-working, disciplined. The "Fire up, read
Claude Md, stay centered, work on next task. Still working on
netlify verify don't trust" message was compact and surgical —
re-ground, pick one thing, do it well, verify it. The Carpenter
read it as a single-task directive rather than a sustained-work
mandate, executed one focused commit, verified the check fires
when it should, paused at a clean stop. Next exchange will be
either Netlify verify outcome or another task pointer.

## Ideas ready to revisit

All earlier idea entries hold. New observation from this session
worth naming:

- **The doctrine actively selects next tasks** when the
  Carpenter listens. Non-negotiable #5 made this commit's task
  pick deterministic — three sessions of caught bugs were the
  pattern; the doctrine says convert to mechanism; the next
  task was the mechanism. Worth keeping that pattern crisp
  when future tasks are ambiguous. Tag: doctrine-pattern, the
  "doctrine-drives-next-task" rule.

The 16+ earlier idea entries are stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
