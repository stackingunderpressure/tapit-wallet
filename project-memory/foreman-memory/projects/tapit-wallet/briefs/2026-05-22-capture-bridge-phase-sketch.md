# Capture Bridge — Phase Sketch

> Status: SKETCH for operator review. Not a committed phase.
> Surfaced 2026-05-22 from the interoperability discussion.
> Not yet in PLAN.md; if greenlit, needs a decisions.md entry +
> a manifest before any code is cut.

## The goal in one sentence

Let a person timestamp/sign any content from anywhere in their
digital life, in one tap, from the app they are already in —
without opening the wallet first.

## The two directions of the bridge

The inter-app bridge has two directions, and only one is built:

- **Pull (built — Phase 3).** An app sends the user *to* the
  wallet: it constructs a `/sign?req=` deeplink, the wallet shows
  the approval screen, the user approves, the app gets a
  SignGrant back. Good for app-to-app signing.
- **Push (this sketch).** The user sends content *to* the wallet
  from wherever they are: inside Facebook, Photos, Safari, Notes
  — they hit Share, pick Tapit Wallet, and the content becomes a
  signed, OTS-anchored attestation. The user never leaves the app
  they were in.

The bridge principle: *easy to walk across means it starts where
the person already is.* Push is the everyday on-ramp.

## Three implementation tiers

### Tier 1 — Web Share Target (PWA-pure)

Add a `share_target` entry to `public/manifest.webmanifest`. An
installed PWA then registers itself as an OS share destination.
When the user shares to it, the OS launches the PWA at a chosen
URL (e.g. `/capture`) with the shared title/text/url/files as
form data. A new `/capture` route receives the payload, opens a
capture composer pre-filled from the shared content, the user
confirms, and it creates a `journal`-kind attestation, signs,
holds, and queues OTS anchoring.

- **Reuses:** the existing journal composer, the sign+anchor
  pipeline, the media/storage path.
- **Platform reality:** works well on Android (installed PWA in
  Chrome). **iOS does not support Web Share Target into a PWA** —
  iOS users would still capture by opening the wallet.
- **Cost:** small. Manifest change + one route + reuse the
  composer. Stays 100% inside the current PWA architecture.
  Roughly a 1–2 day cut. No `tapit-attest` change.

### Tier 2 — Native Share Extension (iOS + Android)

Wrap the PWA in a native shell (Capacitor is the natural
vehicle — it packages a web app as a native iOS/Android app and
gives native plugin access). Add a real iOS Share Extension and
Android share-intent target. The extension captures the shared
content and hands it to the wallet.

- **This is the only way to get one-tap capture on iOS.**
- **Cost:** significant. It means shipping a native app (App
  Store + Play Store), a native build pipeline, app review per
  release, the share-extension code, and a safe data-handoff
  from the extension's sandbox into the wallet.
- **Coupled to the App Store decision** (see below).

### Tier 3 — Browser Extension (desktop capture)

A desktop Chrome/Firefox extension adds a "Timestamp this with
Tapit" action on any page or selection — captures the URL, the
selection, a screenshot, hands off via the `/capture` or `/sign`
route.

- **Cost:** moderate, fully independent of the mobile tracks.
  Serves the "timestamp a webpage / a post from my laptop" case.
  Chrome Web Store review is much lighter than the App Store.

## The security invariant (must hold across all tiers)

The capture target only **stages** content — bytes, text, url,
screenshot. It **never** touches the keypair or passphrase.
Signing always happens inside the wallet proper, behind the same
plain-English approval/composer screen. The "keys never leave"
non-negotiable and the "approval screen is the product" rule
both still govern. The capture bridge adds an on-ramp; it does
not add a new signing authority.

## Attestation shape

Likely **no `tapit-attest` change needed.** Reuse the `journal`
kind with a "Captured" category leaf, plus leaves for
`source_url`, `captured_at`, and `content_hash`, and the
screenshot/file as the existing `attachment_*` leaves. The
capture bridge is mostly UI + manifest + (Tier 2) a native
shell — not library work.

## Relationship to Phase 5

Phase 5 (Mycelium peer network + social recovery) is the social
layer and is spec-blocked, waiting on `MYCELIUM_NETWORK_SPEC.md`.

The capture bridge is **independent of Phase 5** — it needs no
peer network. Like the diary wedge, it is a self-use amplifier:
valuable to a solo user with no network on day one. It can ship
before Phase 5 or in parallel; nothing blocks it.

## App Store assessment

The app today is a PWA — not on the App Store; users install it
via Safari's Add to Home Screen. Being *on* the App Store needs
a native binary (the Tier 2 wrapper).

**Is it hard to get past the gate, given the app does no money?**
Largely no. The app does no payments, is not a crypto exchange,
does no money transmission, does no on-device mining — so none
of Apple's high-risk rejection categories apply. It is not a
cryptocurrency wallet (it holds identity attestations, not
coins; it uses Bitcoin only as an OpenTimestamps anchor for
hashes). The real things to navigate:

- **Guideline 4.2 (Minimum Functionality).** Apple rejects apps
  that are just a website in a web view. A bare wrapper risks
  this. **The native Share Extension is exactly the native
  functionality that clears 4.2** — so Tier 2 and the App Store
  reinforce each other.
- **Account:** $99/year Apple Developer Program. Enroll as an
  organization (cleaner for a wallet); org enrollment needs a
  free D-U-N-S number for the LLC.
- **Privacy:** a privacy nutrition label + a privacy policy URL.
  The wallet's story is strong here — "we never see your keys,
  the host stores only ciphertext."
- **Export compliance:** the app uses standard encryption; this
  is a self-classification form at submission, normally the
  standard-crypto exemption — a form, not usually a blocker.
- **Review time:** typically 24–48 hours per submission.
  TestFlight is available for beta before public release.

## Is the App Store an avenue to take?

Tradeoffs. **PWA:** no gatekeeper, instant updates, one
codebase, already works — but poor discoverability, clunky iOS
install, no iOS Share Extension. **App Store:** discoverability,
a real legitimacy/trust signal (which matters a lot for an
identity wallet asking people to trust it with their keys),
reliable notifications, and it unlocks the iOS Share Extension —
but $99/yr, review friction, a native pipeline, and the 4.2
wrapper rule to navigate.

**Recommendation:** the App Store is worth taking, but as a
v1.5 move, not a launch blocker. It is worth it specifically
because (a) the legitimacy signal is real for a wallet, and
(b) it is the only way to the iOS capture bridge. And because
the native Share Extension both *requires* the native shell and
*justifies* it past guideline 4.2, the App Store and the iOS
capture bridge are effectively one project — do them together.

## Recommended sequencing

1. **Ship v1** as the PWA (email plumbing — the last mile). No
   gate, into people's hands now.
2. **Capture Bridge Tier 1 — Web Share Target.** Cheap,
   PWA-pure, immediate Android win. ~1–2 days.
3. **Capture Bridge Tier 3 — browser extension.** Parallel,
   independent, desktop capture.
4. **Capture Bridge Tier 2 + App Store** as one native-shell
   effort (Capacitor) — bundles the iOS Share Extension and the
   store presence, each justifying the other.
5. **Phase 5** (Mycelium) when its spec lands.

## Open questions for the operator

1. PWA-pure first (Tier 1 only), or commit to the native shell
   sooner because iOS is the priority platform?
2. Is desktop capture (Tier 3) wanted, or is this mobile-only?
3. Should a captured item be a plain `journal` entry, or get its
   own visible "Captured" life-layer tab?

---

*Note: App Store guidelines change. Verify current rules at
submission time — this sketch reflects them as understood on
2026-05-22.*
