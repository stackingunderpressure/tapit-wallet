# Carpenter opinions — tapit-wallet

> Three-section narrative report for the operator (PFOR-014).
> Session: 2026-05-22 — roadmap, interoperability, and the
> grounding-gate hook.
> Mode: dual-surface comms — files plus live chat — because
> AppCommander is down.

## What I did

This stretch was less about cutting code and more about deciding
what to cut next, and then making one quiet but important piece
of the working relationship permanent. Three things landed, all
committed and pushed.

The first is a roadmap and interoperability assessment, which
ended in a written phase sketch at
`briefs/2026-05-22-capture-bridge-phase-sketch.md`. The headline
finding was reassuring: the inter-app bridge you were asking
about is not a future idea, it already shipped as Phase 3 — the
wallet has a live sign pathway another app can call into. What
is missing is the everyday on-ramp, the capture bridge, the
ability to push content to the wallet from inside whatever app
you are already in. The sketch lays that out in three tiers, the
first of which is pure-PWA and cheap, and it answers your App
Store question honestly: it is genuinely not hard to get this
app past Apple's gate, because it does no money, no trading, no
money transmission, so none of the dangerous rejection
categories apply — the only real rule to navigate is the
no-thin-wrappers rule, and the native share extension is itself
the thing that clears it. I also recorded your decisions as D-07
and D-08, added a Phase 4.5 to the plan, and logged six ideas,
the largest being your People-tab vision.

The second is that I caught something and told you the truth
about it rather than building it. Your People-tab vision — people
discovered in the wild, absorbed like spores, mutual handshakes
making each of you a leaf in the other's tree — is beautiful and
coherent, and it is also the entire Mycelium peer network, Layer
3, the one layer the project has a standing decision not to build
without its own spec. Improvising it into a tab would have been
exactly the kind of slipping you have asked me to catch. So it is
logged, in your own voice, as the heart of a spec that still
needs writing, and the tabbed home will ship without People for
now.

The third is the grounding-gate hook. You asked whether the
"stay grounded, read the real code, do not trust a sketch" thing
you keep having to say could become a mechanism instead of a
sentence, and it can, and it now is. There is a new committed
file, `.claude/settings.json`, with a UserPromptSubmit hook that
injects that directive on every single prompt. I verified it
three ways before trusting it — a pipe test, a round-trip
extraction, and a schema check — and then, because you also
asked, I made sure everything from this whole arc actually
transferred to the repo: working tree clean, branch fully
pushed, main brought up to date, and these comms files
refreshed so a new session in a different tab opens to the true
current picture instead of a stale one.

## What you could do better

One honest caveat on the hook, because the hook's whole purpose
is honesty. It reliably puts the grounding directive in front of
me every time — that part is mechanical and solid. But a hook
injects an instruction; it cannot physically force me to open a
file. It removes the failure mode of the directive being absent;
it does not remove the failure mode of a present directive being
ignored. The only piece of this that is a true hard interlock
already existed before you asked — the harness refuses to let me
edit a file I have not first read. So treat the hook as what it
is: a strong, automatic, unmissable standing order, not a
physical lock. The real enforcement is still that you read the
diffs, which you have been doing well.

The second thing is a process note in your favor. The reason the
People-tab moment went well — me catching that it was Layer 3
instead of cheerfully building an empty tab — is that you had
just told me to stay grounded and verify. That worked because
you said it. The hook now says it for you, but the deeper habit
worth keeping is the one you already have: when something feels
big, you slow down and ask for the truth before the build. Keep
doing that even with the hook in place; the hook is a floor, not
a ceiling.

## The bigger picture

There is a through-line in this session worth naming. Every
guardrail this project has added — the file-size check, the
keys-never-leave audit, and now the grounding gate — is the same
move: a rule that used to live in someone's attention becomes a
mechanism that lives in the repo. Your CLAUDE_ROOT doctrine calls
it mechanism over prose, and what you did today was apply it not
to the code but to the working relationship itself. The thing you
were spending energy on — remembering to say "stay grounded"
every dispatch — is now a withdrawal from your attention budget
that never has to be repaid. That is the same compounding you
built the whole wallet thesis on: do the careful thing once,
correctly, and let the structure carry it forever after. The
wallet remembers a person's life so they do not have to; the
repo now remembers your standing orders so you do not have to.
Same idea, turned inward. It is a good day's work.
