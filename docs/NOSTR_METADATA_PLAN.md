# Hiding who-talks-to-whom on Nostr — plan

Status: PLAN (operator: "plan it, build later", 2026-11-23; "give me the rest
of the plan", same day). No code. Read from tapit-wallet at 1c5c1d5 and
DynastyTrust's apps/web/src/lib as checked out on 2026-11-23.

## 1. What relays see today, exchange by exchange

Every relay also sees the connecting IP address and which keys it is asked
to collect for. No Tapit or DynastyTrust server is involved.

| Exchange | Kind | Content | Sender relays see | Recipient | Time |
|---|---|---|---|---|---|
| Chat | 1059 (NIP-17) | encrypted | throwaway key | yes | blurred up to 2 days |
| Wallet-to-wallet envelopes (connections, family, attestations, witness, ratify) | 9573 | encrypted | **real wallet key** | yes | exact |
| Proof of life / duress | 9575 | encrypted | **real wallet key** | yes | exact |
| Move (Beat HODL) | 9584 | see moveChannel.ts | **real wallet key** | yes | exact |
| DynastyTrust → Tapit requests: spend 9576, circle phrase 9577, vault invite 9578, sign-in 9583 | 9576–9583 | encrypted | throwaway key (DT already does this) | yes | exact |
| Tapit → DynastyTrust answers: spend 9579, invite ack 9580, phrase ack 9581, sign-in 9582 | 9579–9582 | encrypted | **real wallet key** | DT's throwaway reply key | exact |
| Profile | 0 | public only if switched on (off by default since 1c5c1d5), else empty | real key | — | exact |
| Shared notes, Beat HODL posts | 1 | public by choice | real key | — | exact |

What that adds up to: relays can map who in a family talks to whom, and can
see that a particular wallet answered a spend request at a particular moment.

## 2. Two findings outside the original question

**2a. DynastyTrust reads Tapit profiles for member names.**
`apps/web/src/lib/tapit-profile-lookup.ts`, used by `pages/VaultDetail.tsx`,
shows each vault signer's Tapit display name by looking up their public
profile. Since 1c5c1d5 the profile is off by default, so DynastyTrust now
falls back to the label typed in DynastyTrust. Nothing breaks; names just
show the local label. Phase 3 gives DynastyTrust the name privately.

**2b. A vault key IS the wallet's Nostr identity.**
The same lookup file states it: a Tapit key in a vault is the wallet's x-only
Nostr key with `02` in front. When a vault is ever spent through a script
path, the leaf's keys appear on the Bitcoin chain, so anyone can link that
on-chain spend to the Nostr identity (and to its profile, if public). This is
the largest privacy leak in the system and the hardest to change, because it
touches key derivation, vault compilation and every existing vault. It is
listed as a decision (Phase 4), not part of this build.

## 3. The change

Wrap every exchange marked **real wallet key** above in the same gift wrap
chat already uses (`src/features/transport/nip17.ts`):

1. The inner event is signed by the real wallet key, so the recipient still
   checks who really sent it. Its content stays NIP-44 encrypted as today.
2. A seal encrypts that inner event to the recipient.
3. The outer wrap is signed by a fresh throwaway key, carries only the
   recipient tag, and gets a randomized timestamp.

Relays then see: a throwaway key sent something of this size to this
recipient, sometime in the last two days.

## 4. Blast radius (read from the code)

Tapit (send and receive both change):
- `src/features/transport/encryptedInbox.ts` (sendEnvelopeTo, sendEnvelopeToSelf, subscribeInbox)
- `src/features/transport/livenessChannel.ts`, `moveChannel.ts`
- `src/features/sign-request/psbtCosignResponseChannel.ts`, `signInResponseChannel.ts`, `vaultMembershipAckChannel.ts`
- `src/features/circle-phrase/circlePhraseAckChannel.ts`
- `src/features/transport/nip17.ts` — generalize the wrap to any inner kind
- Display of "received at": `IncomingPsbtCosignBanner.tsx`, `IncomingSignInBanner.tsx`,
  `InboxScreen.tsx` read `event.created_at`; after wrapping they must read the
  inner event's time, or every request would show a random time up to two days old.
- Dedup by event id (inbox, processedChannelEventsStore): must key on the
  inner event id, since each send now has a unique outer id.

DynastyTrust (receive side of the four answer kinds):
- `apps/web/src/lib/psbt-cosign-response-channel.ts` (uses `event.pubkey` as
  the signer — must become the inner signer, verified)
- `tapit-signin-response-channel.ts`, `circle-phrase-ack-channel.ts`, and the
  invite-ack subscription in `circle-membership-delivery.ts`
- `packages/nostr-transport` and `packages/nip44` — need unwrap support

Unaffected: request expiry already uses the request's own `expiresAt`, not
the event time; no subscription in either app sets a `since` cutoff (checked),
so back-dated outer timestamps are not filtered out; chat is already wrapped.

Promises to people: Known limitations and the Guide change from "relays can
see who sent to whom" to "relays see only who it is for".

## 5. Phases — each ships alone, each reversible

**Phase 1 — Tapit answers to DynastyTrust (four kinds).** Highest value: it
hides which family member answered a spend. Order matters:
1. DynastyTrust learns to accept BOTH the plain answer and the wrapped one.
   Ship and deploy.
2. Tapit sends wrapped answers. Ship.
Rollback: Tapit flips back to plain; DynastyTrust still accepts both.

**Phase 2 — wallet-to-wallet envelopes, liveness, moves.** Family members may
run an older cached Tapit for a while, so:
1. Every Tapit accepts both forms. Ship; wait for the accept window (decision 1).
2. Tapit sends wrapped. Ship.
Rollback the same way.

**Phase 3 — names without a public profile.** Tapit includes the display name
inside the encrypted invite acknowledgement (9580), which only DynastyTrust
can read; DynastyTrust stores it on the member and uses the profile lookup
only as a fallback for people who chose a public profile.

**Phase 4 — separate vault keys from the Nostr identity (decision only).**
Needs its own plan: derive a distinct vault key from the wallet, keep old
vaults working on their existing keys, and move to new keys only on a new
vault. Not started without an explicit go.

## 6. Tests that must exist before each phase is called done

- Wire test: a wrapped event's outer pubkey is never the wallet key; its
  timestamp is within the past two days; the recipient unwraps it and the
  inner signer verifies as the wallet.
- Tampering: a wrap whose inner event is signed by someone else is rejected.
- Both forms accepted during the window, in each receiving channel.
- Shown times come from the inner event.
- A shared fixture: a Tapit-built wrapped answer opens in DynastyTrust's
  channel code (cross-repo test file checked into both).
- Relay check: the four default relays accept and return kind 1059 from a
  throwaway key (chat already proves this; re-checked per phase).

## 7. Decisions for the operator

1. How long every Tapit keeps accepting the old plain form after the switch:
   recommended 90 days.
2. Phase 3: carry names inside the encrypted acknowledgement (recommended), or
   leave DynastyTrust showing local labels.
3. Phase 4: whether to plan separating vault keys from the Nostr identity.

## 8. Deliberately left out

- Hiding the IP address (Tor or a proxy).
- Running your own relay.
- Cover traffic or fixed message sizes.
- The public profile itself — already handled in 1c5c1d5.
