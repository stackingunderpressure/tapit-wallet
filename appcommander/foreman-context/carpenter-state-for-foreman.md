# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active.

---

## WHAT-CHANGED-RECENTLY

**v1 is shipped.** The operator confirmed the email plumbing is
complete — Resend custom SMTP wired, a real stranger can now
sign up. v1 is done.

**Tabbed home shipped** (`ca184b9`), branch
`claude/compare-library-wallet-OW5FF` — the first piece of
Phase 4.5. `HomeScreen.tsx` was restructured from a single
scrolling surface into a top-level segmented-control tab bar:

- **Journal** (live) — the diary; the existing `JournalTabs`
  with its life-layer category sub-tabs lives one level down.
- **Identity** (live) — `IdentityCard` + the signed identity
  attestation.
- **Captured** (coming-soon) — an honest dashed-card placeholder
  for the capture bridge, which is not yet built.
- **No People tab** — deliberately absent; it is the Mycelium
  peer network and waits on MYCELIUM_NETWORK_SPEC.md (D-04).

The backup banner stays above the tabs (a warning must not hide
behind a tab). Tabs are a segmented control under the header,
not a bottom bar (which would collide with the floating
New-entry button). Composer + action buttons render on the
Journal tab only. All four gates green; HomeScreen ~155 lines.
Build-verified, not Carpenter-pixel-verified.

## Gates at session end

typecheck / lint / test (19/19 across 5 test files) / build all
green. tapit-attest unchanged 82/78/0/4. HomeScreen.tsx
~155 lines, under the file-size 400 warn tier. WalletProvider.tsx
(~290 lines) remains the largest wallet file.

## WHAT'S-PENDING

1. **Operator verifies the tabbed home** on the live deploy —
   segmented control, the Captured placeholder, the Journal
   empty-state and long-scroll under the new tab bar.
2. **Capture Bridge Tier 1 — Web Share Target** is the next
   real build. It is the content for the Captured tab. Pure-PWA:
   a `share_target` entry in `public/manifest.webmanifest` plus
   a `/capture` route reusing the journal composer and the
   sign+anchor pipeline. Sketch of record:
   `briefs/2026-05-22-capture-bridge-phase-sketch.md`.
3. **MYCELIUM_NETWORK_SPEC.md** — needs writing; the operator's
   People-network vision (ideas.md, 2026-05-22) is its heart.
   Once it exists, the People tab can be designed and added.
4. **v1.5:** native shell + App Store + iOS share extension,
   bundled as one effort (D-07).
5. **Non-blocking follow-ups** unchanged: multi-tab worker
   coordination, OTS fixture restoration, Tap-it-Attest-main.zip
   cleanup, backfill remote media for pre-Cut-2 entries.

## WHAT-TO-FLAG

**v1 has shipped — the project crossed its launch line.** Real
users can now sign up and use the wallet. Everything from here
is growth: Phase 4.5 (tabs done, capture bridge next), then the
Mycelium spec, then v1.5.

**The grounding-gate hook is in force** (`.claude/settings.json`,
UserPromptSubmit) and worked this session — the code was re-read
fresh before editing rather than trusted from conversation
memory.

**A possible fourth tab.** People is correctly absent for now.
If the operator wants the social dimension signalled, a
coming-soon People tab could mirror Captured — but hold it until
the Mycelium spec gives it honest shape. Flagged, not actioned.

## RECOMMENDED-NEXT-MOVES

1. Operator verifies the tabbed home on the live deploy.
2. Build Capture Bridge Tier 1 (Web Share Target) — the
   Captured tab's content.
3. Write MYCELIUM_NETWORK_SPEC.md from the logged vision.
4. v1.5: native shell + App Store + iOS share extension.

## OPERATOR'S-CURRENT-VIBE

Celebratory and forward-driving — "v1 done", "let's continue
building the next phase". The operator crossed the launch line
and immediately reached for the next phase rather than pausing,
which is the established rhythm. Still fully committed to the
verify-don't-trust discipline, now mechanized as the
grounding-gate hook. Expect the next message to be either
tabbed-home verification feedback or a go on the capture bridge.

## Ideas ready to revisit

All earlier idea entries hold. The 2026-05-22 set — capture
bridge, web-proof authenticity, situations layer, records vault,
agent/Donna bridge, and the Mycelium People-network vision —
all stand. The Mycelium vision is the load-bearing one and
should mature into MYCELIUM_NETWORK_SPEC.md. The capture bridge
is now the immediate next build. Full entries are stage-tagged
in `project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
