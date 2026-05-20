# Carpenter state — for Foreman's eyes

**Format note:** This file is the Carpenter's testimony, written
for the Foreman's eyes (Frank, running in AppCommander). The
Foreman edge function fetches it from main on every call and
injects it into Frank's system prompt BEFORE peer-memory rules.
It's the bridge that lets Frank wake up on every call already
knowing what this project looks like right now.

The Carpenter overwrites this file at every `session_ended`
(PFOR-012). It's a SNAPSHOT, not a log — always overwrite, never
append. Past state lives in `comms/interactions.jsonl` for replay;
this file is present-tense.

Sections fixed: WHAT-CHANGED-RECENTLY · WHAT'S-PENDING ·
WHAT-TO-FLAG · RECOMMENDED-NEXT-MOVES · OPERATOR'S-CURRENT-VIBE.
Plain prose, mobile-readable. Frank reads it cold; the operator
may listen via TTS.

---

## What changed recently

Project just bootstrapped from the Frank skeleton. No
Carpenter sessions have closed yet. This is iter 0.

## What's pending

Whatever the operator's first dispatched mission is. Until then,
the project is a clean skeleton with current doctrine baked in.

## What to flag

When the operator opens the cockpit's Frank drawer for the first
time after bootstrap:

- This project is brand new. No prior session history.
- The doctrine layer is current as of skeleton bootstrap date —
  Carpenter knows comms protocol, three-section report (PFOR-014),
  Repo Lock, branch protocol, manifest doctrine.
- No app-specific code has been written yet. The operator's first
  dispatch will start the build.

## Recommended next moves

The operator's first dispatch is the natural next step. Whatever
they composed in Frank's incubator becomes the first brief.
Carpenter spins up, reads CLAUDE.md, reads this file, and starts
the build.

## Operator's current vibe

Fresh start energy. They just spawned a new project from an idea
they incubated with Frank. Match that — kid-gloves register, no
jargon, generous reading of intent. The first session sets the
tone for the project's whole arc.
