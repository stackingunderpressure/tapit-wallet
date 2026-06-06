import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'capture',
  born: '2026-05-22',
  purpose:
    'The capture bridge — the inbound on-ramp of Layer 2. When the operating system shares text or a link into the installed wallet (via the Web Share Target registered in manifest.webmanifest), the wallet opens /capture, composes the shared title/text/url into an editable body, and on confirm signs and OpenTimestamps-anchors a journal-kind attestation marked source=capture. The home Captured tab surfaces these apart from the diary. Tier 1 is text and links only (a GET share target, which the existing service worker handles unchanged); photo/file capture needs a POST the service worker must intercept and is the Tier 1b follow-on.',
  touches: [
    'src/features/capture/CaptureScreen.tsx',
    'public/manifest.webmanifest',
  ],
  depends_on: ['wallet-core', 'journal', 'anchoring', 'camera'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'A capture reuses the journal createJournalEntry pipeline; the only data-model addition is the optional source leaf on JournalInput. Captures are journal-kind attestations, not a new attestation kind — source=capture is what the home filters on to split the Captured tab from the diary. The /capture route is registered in src/App.tsx inside the WalletProvider-wrapped Routes so it has wallet context. pause_safe: hiding the route only removes the on-ramp; existing captured entries stay valid. removal_safe is false because App.tsx lazy-imports CaptureScreen. Camera makeover 2026-06-05 ("make capture bigger with the camera makeover"): CaptureScreen now lazy-mounts camera/CameraCaptureModal (the SAME reusable camera the diary composer uses — one camera, many mounts, not a duplicate) so a photo can be born straight into a capture; the photo rides through createJournalEntry as the optional attachment (stored encrypted in mediaStore, SHA-256 committed as a leaf) with source=capture. Submit now accepts a photo OR text (was text-only). The screen got a two-section makeover (Photo / Text-or-link). The GET text/link share path is preserved unchanged. Photos shared IN from other apps (a POST share target the service worker must intercept) remain the Tier 1b follow-on; see briefs/2026-06-05-capture-makeover-spec.',
};
