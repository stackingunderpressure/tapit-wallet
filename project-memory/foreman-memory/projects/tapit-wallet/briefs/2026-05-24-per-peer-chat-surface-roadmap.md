# BRIEF — Per-Peer Chat Surface + Promote-to-Envelope Roadmap

**For:** Tapit Wallet Carpenter (stackingunderpressure/tapit-wallet)
**From:** Operator + Carpenter session (Tom + Claude), 2026-05-24
**Companion to:** `CLAUDE.md`, `DESIGN.md` §7 (Family mode), `PLAN.md`
Phase 4.5 / Phase 5 / Phase 6, `MYCELIUM_NETWORK_SPEC.md` §9 / §12,
`tapit-attest/README.md`.
**Status:** Feature roadmap — suggestions, not job orders. Phased cuts
the wallet Carpenter can sequence and ship independently. Each cut is
small enough to dispatch on its own and green-gate before the next one
starts.

---

## 1 — The thesis

A user's family and close friends are almost certainly going to be
their eventual identity keyholders, the people they ask to witness
things, the people they want to share moments with. The wallet today
makes them dig through several screens to do those things, and offers
no encouragement to put the people in your life into the wallet in
the first place. The fix is not a new attestation kind — it is a
**per-peer messaging surface** that lives on top of the Nostr-encrypted
transport already shipping in `src/features/transport/`, and a
**promote-to-envelope** affordance that collapses the friction between
casual conversation and signed life-history down to one gesture.

The intuition the operator named in conversation: "we were here, bang
bang, sign this on mine too." A photo gets snapped, a moment gets
named, and inside the same chat thread the user is already typing in,
they can turn that moment into a journal entry, a presence mark, a
witness request, or a cosign ask — pre-populated with the peer they
were just talking to. The wallet becomes a place you talk to your
people, not a vault you occasionally remember to write in.

---

## 2 — What's already shipped (the substrate this builds on)

Re-grounded against the repo on 2026-05-24:

- **Transport (`src/features/transport/`)** — Phase 5c-i-β. Nostr
  WebSocket client behind a swappable `Transport` interface,
  `encryptedInbox.ts` with `sendEnvelopeTo` + `subscribeInbox`,
  NIP-44 v2 ciphertext addressed to recipient pubkey, custom event
  kind `TAPIT_ENVELOPE_KIND = 9573` (defined in `nostrEvent.ts`
  line 21). Relays only see ciphertext. Wallet's BIP340 key reused
  as the Nostr identity, same Schnorr signature.
- **Connections (`src/features/connections/`)** — Phases 5a, 5b,
  5c-ii. Tier P (in-person QR) and Tier R (remote-via-Nostr)
  handshakes. `ConnectionCard.tsx` renders the relationship.
- **Inbox routing (`src/features/transport/InboxPanel.tsx`)** —
  5c-i-ε. Auto-routes a one-signature handshake to
  `CosignAsWitnessModal`, two-signature to `AbsorbCosignModal`,
  recovery-share to the responder modal. So the "they sent me an
  envelope" path is already friction-collapsed; what's missing is
  the casual "they sent me a message" path.
- **People tab (`src/features/wallet-core/HomeScreen.tsx` line 87)** —
  Phase 4.5 IA shipped. Tabs are
  `journal | identity | captured | people | lattice`. The People
  tab is the natural home for chat threads; it does not need to be
  invented.
- **Storage (`src/features/storage/mediaStore.ts`)** — encrypted
  IndexedDB local + Supabase remote mirror via `remoteMediaStore`.
  The same `EncryptedBlob` pattern that already carries journal
  attachments can carry chat-attached media.
- **Sender helpers** — `sendEnvelopeTo` is already called from
  `WalletProvider.tsx` (line 236) and `RecoveryInitiatorModal.tsx`,
  so the directional "publish to one peer" pipe is wired and tested.

What is **not** present and would be new in this roadmap:

- A non-envelope event kind for plain chat (every event the wallet
  emits today is a wrapped envelope on kind 9573).
- A per-peer threaded conversation UI. Today there is only one flat
  list — `InboxPanel.tsx` — chronological across all senders.
- A way to promote a chat moment into a signed envelope from inside
  the chat surface.
- A "share an existing held envelope to a peer" affordance.
- A per-thread local persistence layer for chat history, with a
  Settings toggle for opt-in cloud backup.

---

## 3 — The operator's locked design decisions (2026-05-24 session)

These four decisions came out of the chip questions in the design
conversation. They are the design floor for everything below.

1. **Every chat message is signed, end-to-end encrypted, recipient-only
   readable. Not necessarily an attestation. Not necessarily anchored
   to Bitcoin.** Same Schnorr signature the wallet uses for everything
   else; same NIP-44 v2 encrypted-to-recipient wrap as envelopes
   travel under today. Anchoring is opt-in per message. Promoting to a
   full attestation is opt-in per message.
2. **Per-peer threads under the People tab.** Tapping a connection
   card opens that peer's thread in the iMessage-shaped layout —
   history above, composer below.
3. **Promote-to-envelope via BOTH plus-menu and long-press.** The
   plus-menu in the composer is the discoverable affordance for new
   users; long-press on any individual message is the power-user fast
   path. Both wire into the same set of envelope-template targets
   (journal entry, presence mark, witness request, cosign ask,
   disclosure proof).
4. **Local-only persistence by default. Opt-in cloud backup.** Chat
   threads sit in IndexedDB alongside the wallet snapshot. The
   encrypted blob pushed to Supabase does NOT include chat history
   unless the user explicitly turns "Include chat history in cloud
   backup" on in Settings. A one-time inline explainer the first time
   they open a thread makes the trade-off clear: messages stay on
   this device only by default, turn this on if you want them to
   survive losing the phone.

---

## 4 — The three-tier message taxonomy

These four decisions yield a clean ladder the user can understand
without any cryptography vocabulary:

- **Tier 1 — Chat.** Signed, end-to-end encrypted, recipient-only.
  Wire: new `TAPIT_CHAT_KIND` Nostr event. Lives in the per-peer
  thread. Not anchored. Default mode for "lol," "on my way," "look
  what we did today." The most-of-the-time message.
- **Tier 2 — Anchored chat.** A Tier 1 message that the user has
  chosen to Bitcoin-anchor for timestamp proof. Still not an
  attestation. Useful for "you said you'd pay me back by Friday"
  without invoking a full envelope ceremony. One toggle on the
  composer.
- **Tier 3 — Envelope.** A full signed envelope (journal,
  presence, relationship, cosign, recovery, disclosure, etc.)
  promoted into existence by the plus-menu or long-press from a
  chat moment. This is where the existing attestation system takes
  over.

The chat surface is the funnel: most messages stay Tier 1 forever;
some get promoted; the promoted ones become permanent life-history.

---

## 5 — Phased cuts (suggested sequencing)

Each cut should be small enough to dispatch and gate independently.
Recommended order is bottom-up (wire format first, UI second, magic
moments third, persistence story last) so each cut compiles and ships
something the operator can poke at, and so the surface layers fall
naturally into place once the data layer is honest.

### Cut 1 — `TAPIT_CHAT_KIND` wire format + helpers

**Touches:**

- `src/features/transport/nostrEvent.ts` — add
  `TAPIT_CHAT_KIND` constant. Pick a non-colliding kind number;
  Nostr's NIP-01 / NIP-44 reserve ranges should be checked. A kind
  in the 9574–9999 range adjacent to 9573 is a sensible choice;
  the operator picks the exact value.
- `src/features/transport/encryptedInbox.ts` — new functions
  `sendChatMessageTo(transport, plaintext, recipientPubkey, sender)`
  and `subscribeChatMessages(transport, recipient, handler)`. They
  mirror the existing `sendEnvelopeTo` / `subscribeInbox` shapes
  but use the new kind and pass plaintext through directly rather
  than serializing an envelope.
- `src/features/transport/transport.test.ts` — round-trip test:
  Alice sends "hello" to Bob, Bob's subscription decrypts to
  "hello," tampered ciphertext is silently dropped, mis-addressed
  events are filtered out.

**Doctrine notes for Cut 1:** Chat messages MUST carry the same
Schnorr signature and NIP-44 wrap as envelopes — there is no
ergonomic "lightweight" variant that skips authentication, because
that would create an unauthenticated-message attack surface the
relays could exploit. The "lightness" of a chat message is purely
that it carries plaintext content instead of a serialized
envelope; the wire crypto is identical.

### Cut 2 — Per-peer thread UI under People tab

**Touches:**

- A new component (working name `PeerThread.tsx`) under
  `src/features/transport/` or a new `src/features/messaging/`
  folder — Carpenter call. Module-first doctrine says new feature
  slug + `manifest.ts` if this becomes its own concern; if it
  stays a sub-surface of transport, it belongs alongside
  `InboxPanel.tsx`. Lean toward a new `messaging` feature slug —
  it's a distinct user-facing concept and removal-safe-ness is
  cleaner.
- `src/features/wallet-core/HomeScreen.tsx` — wire the People tab
  to render either the connections list (current) or a selected
  peer's thread. Selection state can sit in component state or be
  lifted to `WalletProvider` if other features want to deep-link
  to a thread.
- `src/features/wallet-core/WalletProvider.tsx` — extend the
  context to carry recent chat messages per peer (or expose a
  helper that pages from IDB on demand — see Cut 4 for the
  persistence question this raises).
- `src/features/connections/ConnectionCard.tsx` — `onClick` opens
  the thread for that peer.
- Composer at the bottom of the thread: plaintext textarea, send
  button, plus-button (which becomes meaningful in Cut 3).

**UI doctrine:** iMessage-shaped, not Discord-shaped. Messages
right-aligned for self, left-aligned for peer. Timestamps grouped.
No reactions, no read receipts, no typing indicators in v1 —
those are post-launch polish, not load-bearing.

### Cut 3 — Promote-to-envelope (plus-menu + long-press)

**Touches:**

- The composer plus-button from Cut 2 opens a menu with the
  template targets: "Save as journal entry," "Mark presence with
  this person," "Ask to witness an entry," "Send cosign request,"
  "Share a held envelope," "Share a disclosure proof of one
  field." Each target launches the existing modal pre-populated
  with the peer and (where applicable) a quoted reference to the
  chat moment.
- Long-press on any individual message in the thread opens the
  same menu, scoped to that specific message (so "Save as journal
  entry" gets the message's text and any attached media as the
  entry body, not a blank composer).
- The existing modals (`CosignRequestModal`, `MarkPresenceModal`,
  the journal composer, `DisclosureProof` flow) gain an optional
  `prefill` prop / hook so they accept seeded values without
  changing their default empty-launch behavior.
- A new "Share a held envelope" flow needs an envelope-picker UI
  (the user picks from their holdings) and then calls
  `sendEnvelopeTo` against the peer's pubkey. This is the inverse
  direction of the existing inbox-receive path.

**Doctrine note:** This is where the wallet's "everything that
matters is signed" thesis pays off in user-felt UX. The chat
surface is the soft, ephemeral, conversational layer; the
promote action is the moment of intent where the user says "this
matters, sign it and keep it forever." Make that gesture feel
weighty without being slow.

### Cut 4 — Local persistence + opt-in cloud backup

**Touches:**

- `src/features/storage/` — a new `messagesStore.ts` (sibling of
  `walletStore.ts`, `mediaStore.ts`). IDB schema keyed by
  `(ownerId, peerPubkey)` with messages indexed by `created_at`.
  Plaintext stored locally is fine — the device is the trust
  boundary — but the snapshot push to Supabase must respect the
  prefs toggle.
- `src/features/storage/walletStore.ts` and the encrypted-snapshot
  builder — extend the snapshot payload schema to include a
  `messages: PerPeerHistory` field when the
  `includeMessagesInBackup` pref is true; omit it entirely when
  false. The encrypted blob remains end-to-end encrypted under
  the user's passphrase; Supabase still only sees ciphertext.
- `src/features/settings/` — new toggle "Include chat history in
  cloud backup" with default OFF. Inline explainer copy that
  matches the wallet's plain-English doctrine: "Your messages
  stay on this device by default. Turn this on to include them
  in your encrypted cloud backup so they survive losing your
  phone — same encryption as everything else; Tapit never sees
  them in plaintext."
- First-time-open-a-thread modal that surfaces the same choice
  inline so the user makes the decision when it's relevant, not
  buried in Settings.
- File and video attachments in chat reuse `mediaStore` — same
  encrypted-bytes-once pattern as journal attachments; the chat
  message body carries the SHA-256 + mime + bytes + name leaves
  and a reference to the local blob. Cloud-backup of chat media
  follows the same `includeMessagesInBackup` toggle as text.

**Doctrine note:** The default-OFF choice is deliberate and
honest: some users want chat to feel ephemeral, some want it
backed up. Putting the choice in front of them at the moment they
need it is the honest UX. Do not silently include messages in the
cloud blob and then surface a "by the way" later — that's the
exact failure mode this design prevents.

---

## 6 — Files that will be touched (estimate)

Across all four cuts, the change surface is roughly:

- **New:** `src/features/messaging/manifest.ts`, `PeerThread.tsx`,
  `MessageBubble.tsx`, `MessageComposer.tsx`, `PromoteMenu.tsx`,
  `messagesStore.ts`, test files.
- **Modified:** `transport/nostrEvent.ts`,
  `transport/encryptedInbox.ts`, `transport/transport.test.ts`,
  `wallet-core/HomeScreen.tsx`, `wallet-core/WalletProvider.tsx`,
  `connections/ConnectionCard.tsx`, the existing prefill-target
  modals listed in Cut 3, `settings/SettingsScreen.tsx` (or
  whatever the current settings surface file is — Carpenter
  re-grounds), `storage/walletStore.ts` snapshot schema, the
  features registry.
- **Manifest doctrine:** new `messaging` feature gets its own
  `manifest.ts` per project doctrine and is added to
  `src/features-registry.ts`. The coverage test (`src/features-
  registry.test.ts`) will fail otherwise.

---

## 7 — Doctrine and open questions

A few decisions the Carpenter should escalate back to the operator
during the build if they aren't already obvious:

- **Kind number for `TAPIT_CHAT_KIND`.** Pick something
  non-colliding with NIPs in active use. Adjacent to 9573 is
  reasonable; document the choice in `nostrEvent.ts` comments.
- **Message format on the wire.** Plain UTF-8 string vs. a small
  JSON envelope carrying `{ text, attachments?, replyTo? }`.
  Recommend JSON from the start — replies and attachments will
  be wanted by v1 of the chat surface and retrofitting a string
  format later is painful.
- **Replies and threads inside threads.** Out of scope for v1.
  Don't build it; don't paint into a corner.
- **Group chats (more than two participants).** Out of scope for
  v1. The NIP-44 v2 encryption is point-to-point; group chat
  requires either re-encrypting per recipient (n-way fan-out) or
  a group-key scheme. Defer until after v1 chat lands and the
  operator has felt the gap.
- **Message deletion.** The "vanish from this device" semantics
  need a clear story — a deleted message is removed from local
  IDB and from the cloud blob if backup is on, but cannot be
  recalled from relays or from the recipient's device. UI copy
  must be honest about that.
- **Read state.** Out of scope for v1. Adding it later is
  additive — a "last read" leaf per peer, local-only.
- **Notifications.** Out of scope for v1. The wallet is a PWA;
  push notifications would need service-worker work that belongs
  in its own phase.
- **The "relationship label on the handshake" idea from earlier
  in the conversation** (mom / friend / coworker, etc.) is a
  separate small cut that pairs nicely with this work but is not
  blocking. It's worth its own one-paragraph brief; flagging here
  so it doesn't get lost.

---

## 8 — Why this is part of the families story (the closing frame)

The original conversation that produced this brief started with
"how do families work in this wallet and why isn't it showing up."
The honest answer was that family lived as cross-cutting plumbing
across journal categories, the subject picker, and custody handoff,
without a destination surface. The People tab is the destination,
already shipped. This brief is what makes the People tab feel like
a destination *worth visiting* — because once you can chat with the
people in there, share moments and files and existing attestations
with them encrypted end-to-end, and one-tap promote any of those
moments into permanent signed history, the People tab stops being
a list of pubkeys and starts being where your life actually happens
with the people who matter. That is the families feature, finally
made visible.

The wedge from `DESIGN.md` and `PLAN.md` stays intact: the wallet
is still a private signed diary first, social second. This roadmap
is the social layer that grows on top of the diary substrate
without compromising the solo-use-first principle. A user with zero
peers can still use the wallet productively; a user with people in
their People tab now has a reason to be in there every day, and
every day they're in there is another day the mycelium gets denser.

---

## 9 — Honest caveats

- **No cryptography invented here.** Everything is reuse of the
  existing Schnorr signing, NIP-44 v2 encryption, IDB storage, and
  encrypted-snapshot patterns. If the Carpenter finds themselves
  reaching for a new primitive, stop and escalate.
- **No `tapit-attest` change required.** This is wallet-side work
  end-to-end. The library load-bearing crypto core stays untouched.
- **Cut 1 ships nothing user-visible** — it's wire-format
  scaffolding with tests. That's fine. Sequencing benefits from
  the data layer being green before the UI lands on top of it.
- **Per-peer thread UI is the heaviest cut by code volume.** Expect
  Cut 2 to be the longest single dispatch. The promote-to-envelope
  affordance in Cut 3 is mostly wiring into existing modals, which
  is lighter despite being the most visible-magic piece.
- **Cloud-backup opt-in is genuinely opt-in.** Don't drift toward
  "off-by-default-but-nudgey" — that's the failure mode the design
  is deliberately avoiding. If we want it on, we'd just say so.

---

## 10 — One-line summary for the dispatch board

Build a per-peer chat surface under the People tab that rides the
existing Nostr encrypted transport, lets users casually message
each other with signatures but no anchoring by default, and gives
them a one-gesture path to promote any chat moment into a signed
journal entry, presence mark, witness request, cosign ask, or
shared envelope — making the families and friends in the wallet
feel like a place you talk to, not a list of pubkeys.
