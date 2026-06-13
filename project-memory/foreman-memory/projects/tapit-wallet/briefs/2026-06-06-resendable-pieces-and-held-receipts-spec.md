# Spec — re-sendable secret pieces + held/not-held receipts (2026-06-06)

*Operator: rethink the one-time generation; keep the PIECES (not the whole
secret) encrypted behind the passphrase so they can be re-sent, and when a
holder saves a piece their wallet tags it back over Nostr so the owner sees
it's held — and when they delete it, the flag drops so the owner knows it's
no longer safe. Feasibility + implementation. Two distinct parts.*

> Grounded reuse: this rides the recovery cohort's held-share + inbox-routing
> + transport patterns (createShares.holdRecoveryShare, routeFor →
> InboxRouteAction, useInboxAccepts, useInboxRouting) and the encrypted-store
> pattern (secretsLedgerStore). It is the natural upgrade from the shipped
> "lightest DM-as-chat" distribution to the heavier "held, acknowledged
> attestation" model.

---

## PART A — Re-sendable pieces (store the shares, not the secret)

**Today:** pieces are generated once, never stored (metadata-only ledger),
so you cannot re-send a piece to a replacement holder — you'd make a new
secret. **Change:** optionally store the share TOKENS (the
`tapit-secret.v1.…` strings) for a secret, encrypted at rest behind the
passphrase, so you can re-open a secret and re-send any piece.

- **Why store the original pieces (not re-split):** Shamir re-splitting uses
  fresh random coefficients, so a re-split piece will NOT combine with an
  already-distributed one. To re-send a CONSISTENT piece (same index, combines
  with what Mom already holds) you must keep the originals.
- **HONEST SECURITY CAVEAT (load-bearing):** storing all N pieces on your
  device means **your device + your passphrase can reconstruct the whole
  secret** — the exact thing the "nothing stored" v1 deliberately avoided. So
  this is an **opt-in toggle, default OFF**, and a teaching moment (ties to the
  teaching-system spec): *"Keep a copy of the pieces on this device so you can
  re-send them — encrypted with your passphrase. It means you can always
  rebuild this secret yourself. Leave it off for the strongest setup, where
  not even you can rebuild it alone."* Let the user choose and understand.
- **Feasibility: small.** Add an optional `tokens?: string[]` to the secret
  record, persisted by the existing encrypted ledger store (or a sibling
  store) only when the toggle is on. Re-open → re-send via the existing
  Copy/QR/chat paths.

---

## PART B — Held/not-held receipts (circle liveness for secrets)

Upgrade a piece from a plain chat DM into a **held, acknowledged object**:

1. **Owner sends the piece as a structured `secret-piece` envelope** (a
   recovery-share-style credential) over the transport, so the holder's wallet
   recognizes it (vs today's opaque chat text).
2. **Holder receives + holds.** New `InboxRouteAction` `'secret-piece-receive'`
   (add a `routeFor` branch + a `useInboxAccepts` helper + a `useInboxRouting`
   modal): "You're holding a piece of Tom's secret — keep it / decline." On
   keep, the holder HOLDS the piece (stored, encrypted on their side) and their
   wallet sends an **ACK envelope** back: signed, "holding piece X of secret Y,
   as of <date>."
3. **The heartbeat (operator refinement 2026-06-06) — cessation is the
   signal.** The holder's wallet re-signs a fresh "still holding piece X of
   secret Y, as of <date>" **opportunistically on unlock, throttled to ~once a
   month** (zero holder effort — just opening the app re-signs it). The wallet
   only signs it WHILE it actually still holds the piece. So **deletion, a lost
   or wiped phone, and going dark all collapse into one honest signal: the
   heartbeats stop.** This makes an explicit "released" message *optional* — you
   don't need the holder to announce a delete, because a deleted piece simply
   stops producing heartbeats. Trade-off (state it): it is not instant — you
   learn over the staleness window, not the second they delete — which is
   exactly the operator's framing (fire ~monthly, don't worry until a couple
   months).
4. **Owner ledger = "last heard" freshness per piece**, with a **configurable
   worry threshold (default ~2–3 months)**: recent = green; 1–2 months = soft
   "hasn't checked in lately"; past threshold = "may be at risk — nudge them"
   (one-tap nudge). Never a false "deleted ✗"; it's always "last confirmed
   <date>."
5. **Optional hardening — the hash chain ("new block proof").** Each heartbeat
   can reference the hash of the holder's previous heartbeat (`prev`), forming
   a tamper-evident, ordered chain — a little personal ledger of "still here"
   check-ins the holder can't backdate or fake gaps in. This is the STRONGER
   mode, not required for v1: among trusted family a fresh signed timestamp is
   enough; the chain matters when you want provable continuity against someone
   who might game it.
6. **Do NOT anchor heartbeats to Bitcoin.** Per SATOSHI.md anchor-don't-bloat:
   anchor only what needs a public clock, and a private family "still holding"
   ping does not — the signature + relay receipt is plenty, and anchoring every
   monthly ping from every holder would bloat the chain for nothing. If the
   chain ever needs timestamp-hardening, batch an occasional roll-up; never
   per-ping. (Note: Nostr relays prune, so treat relays as best-effort
   transport for the latest heartbeat; the holder keeps their own chain, the
   owner keeps the heartbeats they've received.)

This IS the circle-liveness / readiness feature (from the 2026-06-05
engagement correction) made concrete — and it directly serves the user's own
safety, the honest kind of engagement.

### 5c. The alarm is the OWNER's, keyed to threshold-margin (operator 2026-06-06)

The readiness signal is FOR THE OWNER — not a nag on the holders. The metric
that matters is the **MARGIN: (holders with a fresh heartbeat) − threshold.**
In a 5-of-10 you can lose up to 5 before recovery is impossible, so the alarm
escalates as the margin shrinks — comfortable while there's slack, amber when
you're one or two cold holders from the edge, **red when you're AT the
threshold (one more loss = unrecoverable).** The owner then acts:
- **Nudge** a cold holder person-to-person ("checked your wallet lately?") — a
  nudge that works refreshes their heartbeat and re-proves the path through them
  is live: a lightweight, continuous recovery drill.
- **Swap** a holder who's gone or opts out ("nah, forget it") for a fresh one —
  enabled by the opt-in kept copy (Part A): re-hand that slot's piece to a
  replacement, or re-split + redistribute for a clean roster.
- At minimum, **know the damage and reassess.**

**ETHICAL KEYSTONE (hard rule):** the SYSTEM never nags or shames the holders —
no "you're letting Tom down" notifications. The holders just live their lives
and their wallet quietly pings. The system's whole job is to inform the OWNER
about the OWNER's own resilience — a private safety dashboard, not surveillance
or obligation on the circle. (Honest note: the owner does see which holders went
cold; that metadata is theirs, about their own circle, by the holders' agreement
to hold — reasonable, but name it.) This is also the honest "engagement =
readiness" payoff: the owner opens the app and gets a true read on their safety
net, the nudges keep the circle warm, all serving the owner's actual safety, not
a vanity metric.

### HONEST LIMITS (must design around AND surface to the user)

1. **Silence is ambiguous.** A holder who deletes the app, loses/wipes the
   phone, or is simply offline **cannot send anything**, so you canNOT get a
   guaranteed instant "it was deleted." You get exactly three states:
   confirmed (fresh ack), released (a deliberate in-app delete sends a signal),
   and **stale/unknown** (silence — could be offline OR gone). Model and LABEL
   it as those three; never paint silence as a false "deleted ✗."
2. **Not adversarial proof.** The ack is a **coordination/trust signal among
   your trusted people**, not cryptographic proof of continued possession — a
   holder could ack then delete, or delete then keep acking. (True
   proof-of-possession needs periodic challenge-response and is still weak.)
   For "your people, best interest" this is fine; just never oversell "I know
   for certain Mom still has it."

**Feasibility: medium.** Reuses the recovery held-share + inbox-routing +
transport patterns wholesale; the net-new parts are the `secret-piece` +
`ack`/`released` envelope shapes and the owner-side live-status field on the
ledger — all standard signed credential envelopes.

---

## PART C — per-piece hash commitments + retrieval + the escalation ladder (operator 2026-06-06)

When you hand out a piece, ALSO store the **hash of that exact piece** in the
ledger. This is cheap, SAFE metadata — a hash of a share reveals nothing about
the share or the secret — so unlike the Part-A token copy it carries NO security
cost. It unlocks three things:

1. **Verify a returned piece without rebuilding anything.** Ask a wobbly or
   departing holder to send their piece BACK; hash it, compare to the stored
   hash. Match ⇒ it's the exact, untampered piece, and you KNOW it's right
   without reconstructing the secret (one piece is below threshold, so nothing
   is revealed by getting it back).
2. **A lightweight, graceful swap (the LIGHT tier).** With the verified piece in
   hand you re-hand that slot to a NEW holder. Elegant property: because the
   bytes come from the departing holder, this swap needs **NO kept copy on your
   device** — you can stay metadata-only (just hashes) and still re-arm a slot,
   which is MORE sovereign than the Part-A keep-a-copy path (no reconstruction
   point), at the cost of needing the holder's cooperation. That one last login
   is also their dignified exit: "I gave it back, I'm done" — which may be the
   very reason a laggard finally logs on.
3. **Better recovery diagnostics.** At real recovery time, verify each incoming
   piece against its stored hash, so a wrong/tampered piece is caught
   specifically ("Dad's piece 3 doesn't match — ask him to resend") instead of
   only the whole combine failing.

**The escalation ladder (operator's two tiers):**
- **Tier 1 — retrieve + re-hand** (this Part C): cheap, single-piece, verified,
  no full ceremony; re-arms the slot with a live holder.
- **Tier 2 — re-split the whole secret** and redistribute to a clean roster:
  heavy (everyone gets a new piece) but the ONLY thing that truly invalidates
  old pieces.

**HONEST LIMIT (load-bearing):** retrieval does NOT revoke the old copy — once
someone holds a piece you cannot force them to forget it, so handing it back
re-arms the slot but the old holder may still have those bytes (one
sub-threshold piece, low risk). Only the Tier-2 re-split actually revokes. Name
this so nobody believes "got it back" = "they can't have it anymore."

**Two swap paths, user's choice:** keep-a-copy (Part A — convenient, but device
can reconstruct) vs retrieval (Part C — sovereign, but needs holder
cooperation). Per-piece hashes are worth storing regardless (free + safe) since
they also harden recovery.

## PART D — the handshake-reserved holding slot (standing consent, operator 2026-06-06)

The unifying primitive under all of Part B/C: move the holder's consent from
PER-PIECE to HANDSHAKE-TIME. When two peers handshake, the agreement carries a
clause — "you may reserve one small, bounded corner of my wallet to stash a
piece and retrieve it later." A standing possibility, maybe never used.

- **Consent once, frictionless after.** The holder agrees at handshake that you
  MAY use a corner. After that, filling the slot needs no new approval (it's
  pre-authorized), so distributing a piece is just "fill my reserved slot,"
  automatic. This REPLACES Part B-1's per-piece receive/hold/decline prompt with
  a one-time agreement — better UX, consent moved to relationship-time.
- **Bounded — "one little corner."** A SINGLE small fixed-size slot per peer, so
  a pre-authorized write can't flood the holder's storage. The handshake grants
  a drawer, not the house.
- **Blind storage.** The stashed piece is encrypted TO THE OWNER, so the holder
  holds opaque ciphertext they can't read and never interact with — exactly "you
  don't even know what it is, it's just my corner." (Caveat: encrypt-to-owner
  fits the owner-retrieves-their-own-secret case; the inheritance / dead-man's
  variant needs the piece readable by the eventual recoverer — a different
  encryption target, decide per use case.)
- **Reciprocal.** A handshake is mutual, so both peers can grant each other a
  corner — the relationship graph becomes a consented, reciprocal, distributed
  storage fabric: every friendship comes with a tiny drawer you let each other
  borrow. (Mycelium shape: your people are your infrastructure, at the storage
  layer.)
- **Observable + retrievable.** Each holder login refreshes the slot's heartbeat
  (Part B); "give me my corner back" is the retrieval (Part C). Login frequency =
  how reliably you can get it back → swap rare-loggers out.

**HONEST LIMIT (unchanged, load-bearing):** the agreement is consent, NOT a
hardware guarantee — a holder can still wipe their slot or go dark; you cannot
physically force retention. That is precisely why the heartbeat / retrieval /
swap machinery still exists. The handshake removes the FRICTION and establishes
CONSENT; it does not remove liveness uncertainty.

This is the storage-layer primitive the whole secrets / recovery / inheritance
arc sits on: a bounded, blind, reciprocal, consented holding slot rooted in the
handshake. Grounding note: handshakes already exist (connections/createHandshake);
this extends that signed relationship with a holding-consent clause + a
pre-authorized per-peer slot the inbox accepts without re-prompting. Best built
WITH or BEFORE Part B-1, since it reframes how distribution gets consent.

## PART E — the social-sig network: scale + the security argument (operator 2026-06-06)

The whole arc culminates here: a large, growing, RECIPROCAL network of trusted
ACTIVE people, each renting you a blind slot (Part D), across which you split any
secret at scale (30 → 100 → 1000) with a tunable threshold. The operator's name:
**"social sig"** — a multisig whose quorum is your real web of trust, enforced
socially (Shamir custody) instead of on-chain script. Connects to the
peer-consensus-as-a-covenant-outside-Bitcoin thesis (ideas.md 2026-06-04).

**The security argument (precise + honest):**
- An attacker faces TWO stacked hard problems: (1) DISCOVER who holds the pieces,
  and (2) COMPROMISE a threshold of them. Both hard; stacked, very hard.
- Blind slots (Part D) hide WHAT each holder has — they don't even know
  themselves — so a compromised holder doesn't obviously out themselves as one.
- **DECOYS make discovery far harder, nearly for free** (worth building): because
  the slots are blind, fill COVER slots on peers you're NOT really using (and/or
  dummy pieces), so an attacker who maps your handshakes still can't tell the
  real M holders from cover. An anonymity-set defense that falls straight out of
  blind storage — directly the operator's "they wouldn't even know who has it."
- Robustness AND security both improve with N at a % threshold (50% of 30 = 15):
  you can lose many before recovery fails, and an attacker needs many.

**HONEST LIMITS (load-bearing, never oversell):**
- Security scales with INDEPENDENT, REAL people — not raw count. 1000 real
  attested humans is strong; 1000 sockpuppets is one attacker. The web of trust
  (handshakes/vouches) is what makes the count mean anything (Sybil resistance).
- Discovery-hardness is threat-model-dependent: hidden from the holders and
  casual attackers, but relay/traffic metadata can leak the WHO to a
  sophisticated network observer unless you add metadata hygiene (Tor / decoys /
  timing). "Hard," not "impossible" — nosy relative vs nation-state differ.
- Availability at scale cuts both ways: bigger N = more robust to loss, but more
  coordination to assemble M LIVE holders in an emergency. The heartbeat/
  readiness (Part B) is what keeps assembling-at-scale tractable.
- "Complex legs / different combinations" = a POLICY TREE (AND/OR/weighted/
  timelocked access structures — like a Bitcoin miniscript policy, but social).
  Beyond flat M-of-N Shamir; reachable via nested/weighted sharing — an advanced
  cut, not the v1 flat threshold.

The reciprocal slots are ALSO the honest engagement engine: because everyone is
both a holder and a depositor, keeping your connections live is a shared good —
people open the wallet to keep the network secure for their OWN secrets too.
Retention from real mutual stake, not a dopamine loop.

### E-Bitcoin — the social sig AS a timelocked tapscript recovery key (operator 2026-06-06)

The operator's answer to "Shamir-splitting a seed is bad custody": don't split
the PRIMARY key — make the social-reconstructed key the LAST-RESORT, TIMELOCKED
leaf of a Taproot vault. Owner key-path spends anytime (alive = preempts
everything); a script leaf lets the social quorum's key spend ONLY AFTER a long
timelock. This **defangs Shamir's main weakness**: an early leak of the
reconstructed key can't move coins until the timelock matures, and if the owner
ever moved the coins the social path never fires. It's the Liana/Nunchuk
inheritance-vault pattern (owner key-path + timelocked recovery path), with the
recovery key held across the SOCIAL NETWORK instead of one backup device.

Honest refinements:
- **SMARTEST crypto for the social leaf is FROST threshold-SIGNING** (never
  reconstruct the key — each holder signs a partial, combine into one Taproot
  sig), NOT Shamir-reconstruct. Shamir re-exposes the full key on ONE device at
  SPEND time (post-timelock, when they assemble to actually spend) — its
  weakness returns exactly when it's used. FROST closes that, and it's the use
  case that justifies revisiting the shelved-for-weight FROST work.
- **Auto-distribute to the people after reassembly needs COVENANTS (CTV)** to
  constrain where the spend goes; without them the assemblers control the output
  (trust again). CTV is still a soft-fork proposal — so "then it distributes to
  those people" is weaker than "they can spend it."
- **Dead-man's reset has a cost:** keeping the timelock from maturing while alive
  needs periodic owner action (move / re-anchor the coins) — a recurring on-chain
  chore + footprint.
- **BLOCKED on the unbuilt Bitcoin layer:** the wallet can hold the shares / be a
  FROST participant (buildable), but constructing / broadcasting / signing the
  Taproot vault does NOT exist (Satoshi's biggest unbuilt block).
- Does NOT escape the human-reliability + assemble-N-people-years-later
  coordination truth (Parts A–E); the readiness machinery helps, not eliminates.

Net: the RIGHT shape, and it correctly answers the "don't split a seed"
critique — the social sig is genuinely good for Bitcoin AS the timelocked
recovery quorum (ideally FROST), complementing a multisig vault, not replacing
the primary signing key. Ties to the conditional-release / fixed-key+mutable-
descriptor vault brief (2026-06-04) and the FROST-reconsideration idea.

## Cut order
- **Cut 1 (Part A):** opt-in encrypted piece storage + re-send. Default off,
  taught. Small, no transport change.
- **Cut 2 (Part B-1):** send pieces as held `secret-piece` envelopes +
  holder-side receive/hold/decline (reuse the recovery held-share + inbox
  routing).
- **Cut 3 (Part B-2):** the `ack`/`released` back-channel + owner ledger live
  status (confirmed / released / stale) + the periodic heartbeat. The
  readiness payoff.
- **Cut 4 (Part C):** per-piece hash commitments (free, safe — store regardless)
  + the retrieval-and-re-hand light swap + the two-tier escalation ladder.

## Non-goals / honest scope
No false "deleted" certainty (silence = stale/unknown, three honest states);
the ack is coordination, not adversarial proof; piece-storage is opt-in,
default off, with the device-can-reconstruct tradeoff taught, not hidden.

---

## PART D-SECURITY — the recall brake (anti-compromise, operator 2026-06-13)

THREAT the operator caught: frictionless, no-permission recall (Part D) RE-
COLLAPSES the threshold's protection. The whole point of splitting is that
compromising ONE party isn't enough — but if the owner can silently, instantly
recall every piece, then compromising the OWNER (stolen unlocked phone,
coercion, malware with the passphrase) lets the attacker vacuum all pieces and
rebuild the secret in seconds. The split stopped protecting against owner-
compromise. Operator: "that's too easy ... put a check and balance in there."

DESIGN PRINCIPLE: make recall EASY for the real owner and SLOW + NOISY for an
attacker — don't remove the owner's right, add a time-buffer with notification
and veto. This is the proven social-recovery / guardian-delay pattern (Argent-
style): the legitimate owner has time and visibility and is barely
inconvenienced; the attacker needs speed and silence and is denied both.

THE BRAKE (engages at THRESHOLD-CROSSING, not per piece):
- SINGLE-PIECE retrieval stays frictionless (one piece reveals nothing) — keep
  routine maintenance/swap cheap.
- Crossing enough pieces to RECONSTRUCT trips the brake: a configurable WAITING
  PERIOD (default ~1 week) from request to release.
- During the wait the request is BROADCAST: to the owner's OTHER devices AND to
  the holders ("someone is gathering your pieces — was this you?"). ANY of them
  can VETO/CANCEL, and the owner can rotate keys. A silent instant theft becomes
  a loud, slow, vetoable event.
- OPTIONAL FAST PATH: if enough holders actively LIVE-CONFIRM ("yes, it's really
  him, he's good") the release can go immediately — the operator's "liveliness
  check" instinct. So: instant IF the circle vouches in the moment; delayed-with-
  veto if not. Emergency-friendly without losing the brake.

WHY DELAY-WITH-VETO IS THE DEFAULT (not mandatory holder-approval):
- Availability: mandatory holder-approval reintroduces the offline-holder
  problem (can't recover if holders are dark) — the delay path needs NO holder
  action, preserving availability while adding safety. Holder live-confirm is the
  OPTIONAL accelerator, not a hard requirement.
- Distinguishing attacker from owner: a holder seeing "owner wants their piece"
  can't easily tell a real from a compromised owner — so holder-approval alone is
  weak for THIS threat; the time+broadcast+veto is what actually catches it.

HONEST LIMITS (must surface):
- The veto needs a notification channel the attacker does NOT fully control. If
  the attacker owns the owner's ONLY device and all channels, no client scheme
  fully saves them — but the broadcast to OTHER devices + the holders covers the
  common cases (stolen unlocked phone, coercion, partial compromise) and raises
  the bar enormously. The holders themselves are the second channel.
- Delay vs urgency: a real emergency wants the secret NOW; the holder-live-
  confirm fast path is the escape hatch, and the delay length is configurable
  per secret (a safe-word may want minutes; a recovery seed may want a week).
- This is the symmetric partner to the heartbeat's threshold-MARGIN alarm
  (Part B): margin watches the LOSS side, the recall brake guards the GATHER
  side. Same threshold, both edges protected.

STATUS: spec refinement to the not-yet-built Part D. Folds into the Part D /
Part C build whenever it lands; it changes the retrieval flow (add request ->
delay/broadcast/veto -> release state machine), not the storage primitive.
