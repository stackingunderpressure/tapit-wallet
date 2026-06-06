# Spec — Capture makeover: a "stamp anything" hub with the camera mounted in (2026-06-05)

*Operator direction: "make capture this bigger style with camera makeover
job." Turn the bare text-only Capture screen into a polished "stamp
anything" surface that includes the in-app camera, matching the camera
makeover's style. Hand-off-ready for the cutting carpenter. Grounded against
the real Capture + camera + share-target code.*

---

## Grounded current state

- `capture/CaptureScreen.tsx` is a **bare text-only form**: a header
  ("Capture → Timestamp this"), one textarea pre-filled from the share-target
  params, and a "Sign & timestamp" button → `createJournalEntry({ category:
  'Captured', source: 'capture' })` → anchor → navigate to the entry. No
  photo, no styling beyond the basics.
- The **share target is GET-only** (`public/manifest.webmanifest`: action
  `/capture`, method GET, params title/text/url). The service worker has no
  share handling — GET needs none.
- The **in-app camera** (`camera/CameraCaptureModal`, a pure dependency-free
  device returning a JPEG `File` via `onCapture`) is mounted **only in the
  Diary composer** today, feeding `normalizeImage → sign → anchor → stamp`.
- `HomeScreen` has a **Captured tab** filtering journal entries with a
  `source=capture` leaf (`isCapture`).

So Capture is the inbound on-ramp, but it's plain and text-only, and the
camera it could obviously use is sitting one folder over.

## Goal

Make Capture a bigger, polished "stamp anything" hub — text/links AND a
photo you snap or pick right there — reusing the one camera (the prior
carpenter's "one camera, many mounts" principle: Capture is just another
mount, not a second camera).

---

## Cut 1 — the makeover (no service-worker change, ship first)

1. **Mount the existing `CameraCaptureModal` into CaptureScreen.** Add a
   📷 "Take a photo" path and a 🖼 library pick. The returned JPEG `File`
   flows through the SAME `normalizeImage → createJournalEntry({ source:
   'capture', category: 'Captured' }) → sign → anchor → stamp` pipeline the
   Diary composer already uses, so a photo stamped in Capture lands in the
   Captured tab exactly like text does. REUSE the camera — do not duplicate
   it. (Dependency direction is clean: camera is standalone, so capture →
   camera does not create the journal↔capture cycle the prior carpenter
   avoided.) The camera already handles the installed-iOS-PWA native-input
   fallback, so Capture inherits that for free.
2. **UI makeover.** Turn the bare textarea into a clean hub matching the
   camera's polish: clear modes — **Photo** (camera / library) and
   **Text or link** (the share-fed textarea) — and keep the "Timestamp
   this" identity. PRESERVE the share-target-fed text path exactly: the
   textarea still pre-fills from `?title=&text=&url=` and still signs, because
   that GET bridge is the whole inbound-from-other-apps story and must not
   regress.
3. Result: Capture becomes "stamp anything you bring in," where "bring in"
   now includes a photo born in the wallet, not just shared text.

Cut 1 needs zero service-worker or manifest change and reuses everything.

## Cut 2 — photos shared IN from other apps (the heavier infra, Tier 1b)

The CaptureScreen comment already flags this: sharing a **file/photo from
another app** into Tapit needs a **POST share target**, which the GET-only
service worker can't handle today. This cut:

- `manifest.webmanifest`: add a POST share_target with `enctype:
  "multipart/form-data"` and a `files` param (accept image/*), action
  `/capture`.
- `public/sw.js`: intercept the POST to `/capture`, stash the posted file
  (Cache or IDB), redirect to the capture screen, and hand the stashed file
  to CaptureScreen which runs it through the same pipeline.
- This is real infra (SW + manifest + a file-handoff mechanism) and is the
  Tier 1b the code already named. Scope it as the second cut precisely
  because it touches the service worker.

---

## Reuse + non-duplication (hold this)
- ONE camera (`CameraCaptureModal`), now mounted in BOTH Diary and Capture.
- ONE image pipeline (`normalizeImage → createJournalEntry → anchor →
  stamp`); Capture passes `source: 'capture'`, Diary doesn't. Don't fork.
- Capture keeps its identity as the inbound on-ramp; the camera makes that
  on-ramp able to originate a photo, not just receive shared text.

## Cut order
- **Cut 1:** camera + library mounted into a made-over CaptureScreen, text
  path preserved. No SW change. Ship first.
- **Cut 2:** POST share target + SW intercept so photos shared from other
  apps reach Capture (Tier 1b).

## Non-goals
Don't build a second camera. Don't regress the GET text/link share path.
Don't stuff raw photos into chat (separate messaging fork). Photos stamped
in Capture are held+anchored journal attestations like everything else.
