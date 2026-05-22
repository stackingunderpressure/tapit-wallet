# Carpenter opinions — tapit-wallet

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-22 — Capture Bridge Tier 1.
> Mode: dual-surface comms — files plus live chat — because
> AppCommander is down.

## What I did

This session built the Capture Bridge Tier 1 — the Web Share
Target — at commit `66e9beb`. It is the everyday on-ramp we
sketched: the way a person pushes content into the wallet from
whatever app they are already standing in, rather than coming to
the wallet first.

Before writing a line I re-read the real files, which the
grounding hook now insists on, and that re-read paid for itself
immediately. I read your service worker — the small hand-rolled
one from Phase 1 — and found it only intercepts GET requests; it
explicitly returns early on anything else. That single fact set
the honest scope: a GET share target, which carries shared text
and links, works with zero changes to the service worker and
zero risk to your offline behavior, and that is exactly the
"timestamp a Facebook post" case. Sharing a photo or a file
needs a POST, and a POST share has to be caught by the service
worker — real surgery on the offline-and-caching code — so that
is Tier 1b, deferred and agreed with you before I cut. The gate
told me to surface the truth before acting, and the truth was
worth surfacing.

The build itself: a new `capture` feature folder with its own
manifest, a `share_target` entry in the web manifest that
registers the installed wallet as an operating-system share
destination, and a `/capture` route with a `CaptureScreen` that
composes whatever was shared — title, text, url, deduplicated so
the body is not the same link three times — into an editable
field. When the person confirms, it runs the exact same
`createJournalEntry` pipeline your diary already uses, signs the
entry, OpenTimestamps-anchors it, and the only new thing in the
data model is one signed leaf, `source` set to `capture`. That
leaf is the whole trick: the home now reads it to split the
world, so the Captured tab shows captures and the Journal tab
filters them out, and the two are genuinely separate the way you
wanted different tabs for different things. The Captured tab,
which last session was an honest "coming soon" card, is now a
real surface — it shows your captures, or, when there are none
yet, an empty state that tells you how to make one. All four
gates are green.

One smaller thing worth noting because it is the kind of detail
that rots silently if ignored. When the capture screen started
sharing the journal pipeline with the composer, Vite hoisted
three modules into their own shared chunks. Your bundle-budget
guardrail noticed and nudged me to name them rather than let
them ride the anonymous catch-all, so I measured each one and
gave it an explicit named budget with headroom. The guardrail
did its job; I did what it asked.

## What you could do better

The honest caveat is sharper this session than usual, so read
this part. The Web Share Target genuinely cannot be verified
anywhere but a real phone. The four gates confirm the code
compiles, lints, tests, and builds, but no gate can open an
Android share sheet. So when you verify, the real test is: from
the live deploy, reinstall or fully refresh the installed PWA so
the new web manifest is picked up — the share target only
registers when the OS re-reads the manifest — then go into
another app, hit Share, and confirm Tapit Wallet appears in the
list. If it does, share a link and confirm the capture lands
signed in the Captured tab.

And the part you should know plainly: this works on Android.
iOS does not support sharing into a PWA at all — Apple simply
does not implement Web Share Target for installed web apps. So
on your iPhone, the `/capture` screen exists and works if you
navigate to it, but Tapit Wallet will not appear in the iOS
share sheet. That is not a bug and it is not something I can fix
in the PWA; it is exactly the gap the native share extension and
the App Store path — Tier 1b and v1.5 — were always meant to
close. I want that expectation set honestly now rather than
have you hunt for a share option on your iPhone that the
platform will never show.

## The bigger picture

Phase 3 built the bridge that lets other apps pull a user into
the wallet to get something signed. This session built the
other direction, and the other direction is the one that
matters for daily life, because it does not wait for a developer
somewhere to integrate anything. It meets the person where they
already are. The deep idea of this wallet has always been that
a life worth remembering is mostly made of small ordinary
moments, and the capture bridge is that idea applied to a
person's digital day — a link, a message, a thought, pushed into
a place that signs it and stamps it into Bitcoin so its
existence and its timing are permanently provable. The fact that
it reuses the diary pipeline almost entirely, that a capture is
just a journal entry wearing one extra leaf, is not a shortcut.
It is the architecture being honest: capturing the world and
keeping a diary were always the same act, and the code now says
so.
