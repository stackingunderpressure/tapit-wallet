# Carpenter opinions — tapit-wallet

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-22 — the tabbed home (Phase 4.5).
> Mode: dual-surface comms — files plus live chat — because
> AppCommander is down.

## What I did

You told me v1 was done — the email plumbing finally complete, a
real stranger can now sign up — and to continue with the next
phase. So this session built the first piece of Phase 4.5: the
tabbed home, at commit `ca184b9`.

Before I touched anything I re-read the actual files, which is
worth noting because the grounding-gate hook you just made is now
in force and it told me to do exactly that on the way in. I read
`HomeScreen.tsx` and `JournalTabs.tsx` fresh rather than trusting
my memory of them from earlier in the conversation, and they
matched, so the build proceeded on solid ground. The home screen
was a single scrolling surface — identity card, then the diary,
then the action buttons, all stacked. It is now organized under a
top-level segmented control with three tabs. Journal holds the
diary, and because the diary already had its own life-layer
category pills inside `JournalTabs`, those simply live one level
down now — a clean two-level structure rather than a clash.
Identity holds the identity card and your signed founding
attestation. Captured is the third tab, and it is an honest,
explicit "coming soon" placeholder — a dashed-border card that
tells the person what the capture bridge will do, share anything
from any app straight into the wallet, without pretending it
exists yet.

Two deliberate decisions inside the build are worth surfacing.
First, the backup-health banner stays above the tab bar, always
visible, on every tab — a warning that your wallet has no cloud
backup is exactly the kind of thing that must never be hidden
behind a tab the person is not currently looking at. Second, the
tab bar is a segmented control under the header, not a bottom
bar, because a bottom bar would have sat right on top of your
floating New-entry button — I flagged that collision a few turns
ago and this is the build honoring it. The composer and the two
action buttons render only on the Journal tab, where they belong.
All four gates are green and the file came in around a hundred
fifty-five lines, comfortably under the size guardrail.

## What you could do better

The same honest caveat as the last two UI sessions: I built this
and verified that it compiles, lints, tests, and builds, but I
cannot see it. The four gates cannot render a pixel. So when this
reaches your phone, look at three specific things. One, the
segmented control itself — does the active tab read clearly
against the inactive ones, and does tapping feel crisp. Two, the
Captured placeholder — it is intentionally understated, a dashed
card, but tell me if it feels too empty or if you would rather it
carry a bit more life given how much the login screen now has.
Three, the Journal tab with no entries versus many — the empty
state and a long scroll should both feel right under the new tab
bar.

One forward-looking note, not a criticism. Right now there is no
People tab at all — not even a coming-soon one — because People
is the Mycelium network and deserves the spec, not a stub. That
is the correct call. But it does mean a person looking at three
tabs has no hint that a fourth, social dimension is coming. If
you want, a fourth coming-soon "People" tab could signal it the
same way Captured does — but I would hold that until the Mycelium
spec gives it honest shape, so a curious tap does not land on a
promise we have not designed yet.

## The bigger picture

This session is small in code and large in meaning, because it is
the first build after v1. For weeks the work was getting one
wallet to exist and function for one person. The tabbed home is
the first structural move that treats the wallet as something
that will grow — Journal and Identity today, Captured next, the
Mycelium social layer after that. Tabs are not decoration; they
are a promise about shape. By giving the wallet rooms, you have
said out loud that it is a place a person will return to and
accumulate inside of, not a single-purpose tool. And by making
Captured an honest coming-soon rather than an empty room or a
hidden absence, the wallet tells the truth about its own
unfinishedness — which is exactly the posture a thing people are
asked to trust with their identity should have. v1 proved the
wallet works. This proved it can grow without losing its
honesty.
