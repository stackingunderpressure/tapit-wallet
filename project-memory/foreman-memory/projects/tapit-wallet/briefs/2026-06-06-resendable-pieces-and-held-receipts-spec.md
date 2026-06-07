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

## Cut order
- **Cut 1 (Part A):** opt-in encrypted piece storage + re-send. Default off,
  taught. Small, no transport change.
- **Cut 2 (Part B-1):** send pieces as held `secret-piece` envelopes +
  holder-side receive/hold/decline (reuse the recovery held-share + inbox
  routing).
- **Cut 3 (Part B-2):** the `ack`/`released` back-channel + owner ledger live
  status (confirmed / released / stale) + the periodic heartbeat. The
  readiness payoff.

## Non-goals / honest scope
No false "deleted" certainty (silence = stale/unknown, three honest states);
the ack is coordination, not adversarial proof; piece-storage is opt-in,
default off, with the device-can-reconstruct tradeoff taught, not hidden.
