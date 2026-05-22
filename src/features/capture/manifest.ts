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
  depends_on: ['wallet-core', 'journal', 'anchoring'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'A capture reuses the journal createJournalEntry pipeline; the only data-model addition is the optional source leaf on JournalInput. Captures are journal-kind attestations, not a new attestation kind — source=capture is what the home filters on to split the Captured tab from the diary. The /capture route is registered in src/App.tsx inside the WalletProvider-wrapped Routes so it has wallet context. pause_safe: hiding the route only removes the on-ramp; existing captured entries stay valid. removal_safe is false because App.tsx lazy-imports CaptureScreen.',
};
