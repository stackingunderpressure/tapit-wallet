# Connection trust model — friction-first, group-over-time, tiered in-person

Date: 2026-06-15
Author: carpenter, from the operator's 2026-06-15 direction on streamlining the
handshake. Governs the handshake flow AND the secrets/recovery gating.
Status: design model (operator was "not really sure" — this captures + sharpens
his thinking for a teach-back; build order at the end).

## THE THESIS (operator's own logic)
- FRICTION IS THE PRIMARY ENEMY. A handshake that's a 3-QR ping-pong loses more
  to abandonment than it gains in certainty. "Nostr does ~80% of it; in-person
  adds more certainty" — so the low-friction Nostr-completed connection is the
  DEFAULT, and in-person is an optional boost, not the toll gate.
- SECURITY IS THE GROUP OVER TIME, not any single handshake. "A group of peers
  that are safe as a group over a longer time horizon." The web of many trusted
  peers, accrued over months/years, is the security — no one connection has to be
  perfect.
- A SINGLE SILENT BREACH IS HARMLESS. "One person can't be breached silently and
  cause you security trouble." Threshold schemes mean one compromised peer can't
  move anything alone.
- SIMULTANEOUS MULTI-BREACH IS NOTICEABLE. "You'd notice if several people got
  hacked at the same time in life." Real-world out-of-band awareness is part of
  the model — coordinated compromise of many trusted people at once is loud.
- ATTACKER ECONOMICS. "Efforts to results cost an attacker a lot." The design
  goal is to make the cost of a successful attack vastly exceed the payoff, NOT
  to make any single step unbreakable.

## THE TIERS (honestly labeled — never overstate)
A connection carries a verification level, named plainly:
1. ONLINE-VERIFIED — completed over Nostr. The cosignature is real but arrived
   over the network; doesn't prove physical presence. (Default, lowest friction.)
2. SELF-ATTESTED IN PERSON — the operator ticked "I met them in person." A
   self-claim: cheap, honest, trust-yourself. Worth something (you vouch you were
   there) but NOT cryptographic proof. Labeled as YOUR claim, not a proof.
3. CRYPTOGRAPHICALLY IN PERSON — the strong face-to-face co-signed exchange (today's
   Tier P, or a 2-scan presence-proof version). Both signatures provably exchanged
   in the same room. Optional upgrade, for when it matters.

## TIERED ENFORCEMENT (the key move)
Don't demand strength everywhere — demand it only where stakes are high:
- EVERYDAY connections: online-verified is fine. Zero extra friction.
- STORING SECRETS / RECOVERY: require a MINIMUM count or fraction of the circle to
  be in-person verified (self-attested counts, crypto-in-person counts more), OR
  show a BIG, plain warning. "When storing secrets maybe a minority have to be
  in-person attested or a big warning pops up." So the friction is paid once, at
  the moment it's actually load-bearing, by the few peers who guard the secret —
  not by every casual hello.
This is the same philosophy as the rest of the wallet: meet people where they are,
charge the cost only at the high-stakes cut, and always tell the truth about what
level of proof you actually have.

## BUILD ORDER (smallest first)
- CUT A (friction win + honesty): make the in-person flow DEFAULT to scan-once-
  then-finish-over-Nostr (reuse the existing remote routing). Add a self-attested
  "We met in person" checkbox that writes a met_in_person leaf (the operator's
  claim), and label the connection's tier honestly (online-verified / you-said-in-
  person). Small, mostly reuses what exists.
- CUT B (optional strength): the cryptographically-in-person upgrade as a separate,
  opt-in path (today's 3-QR, or a leaner 2-scan presence-proof). Only shown when
  someone wants max certainty.
- CUT C (where it counts): when building a secret-sharing circle / recovery cohort,
  evaluate the circle's verification mix and require a minimum in-person fraction
  OR surface a clear warning before sealing. Reuses the recovery cohort surfaces.

## HONESTY GUARDRAILS
- Never label a network-completed connection as "in person."
- A self-attested checkbox is the OPERATOR'S claim, surfaced as such — useful, not
  a cryptographic proof; don't dress it up as one.
- The warning at the secrets cut must state plainly what's weak and why, never
  block silently or pretend a weak circle is strong.

## OPEN QUESTIONS (resurface)
- What minimum in-person fraction for a secret circle (a third? at least two?)?
- Does self-attested count toward that minimum, or only cryptographic-in-person?
- Is the 2-scan presence-proof worth building (CUT B') or is the self-attest
  checkbox + the existing 3-QR enough for the strong tier?
