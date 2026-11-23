# Hiding who-talks-to-whom on Nostr — plan

Status: PLAN (operator chose "plan it, build later", 2026-11-23). No code.

## What relays see today (read from the code at the commit that adds this file)

| Exchange | Content | Sender visible to relays | Recipient visible | Time |
|---|---|---|---|---|
| Chat (NIP-17, kind 1059) | encrypted (NIP-44) | no — outer event signed by a throwaway key | yes (`p` tag) | randomized within 2 days |
| Envelopes: family/connection records, attestations, vault invites, spend and sign-in requests (kind 9573) | encrypted (NIP-44) | YES — signed by the wallet key | yes | exact |
| Liveness (proof of life, duress) and move channel | encrypted | YES | yes | exact |
| Public notes (kind 1), when the person shares | public | yes | — | exact |
| Profile (kind 0) | public only if switched on (off by default since 2026-11-23); otherwise an empty profile | yes | — | exact |

Every relay also sees the connecting IP address and which keys it subscribes
for. Nothing here reaches a Tapit server.

## Proposed change

Carry envelope, liveness and move events inside the same NIP-17-style gift
wrap chat already uses: inner event signed by the wallet key (so the
recipient still verifies the real sender), sealed and wrapped under a
throwaway key, timestamp randomized. Relays then see only the recipient and
a size.

## Blast radius to read before building

- `src/features/transport/encryptedInbox.ts` (send + subscribe), `livenessChannel.ts`,
  `moveChannel.ts`, `nip17.ts`.
- DynastyTrust's side of spend and sign-in delivery
  (`apps/web/src/lib/tapit-nostr-cosign.ts`, `tapit-signin-request-delivery.ts`,
  `tapit-signin-response-channel.ts`, `tapit-circle-members.ts`) — both apps must
  accept the wrapped form, and during the switch both the old and new forms.
- Randomized timestamps vs. anything that orders or expires by `created_at`
  (sign-in request expiry, liveness freshness).
- Relays that drop kind 1059 from unknown senders.

## Left out

Own relay, Tor/IP hiding, and cover traffic.
