import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'qr',
  born: '2026-05-21',
  purpose:
    "Operator's punch list — QR encode for handing off envelopes and proofs across a room, QR decode via the device camera for receiving them. Encode uses the qrcode npm package (~10KB gzipped) and renders SVG so it scales clean on retina. Decode uses jsQR (pure-JS, canvas-pixel based) so it works identically on every browser getUserMedia works on, including Safari/iPhone.",
  touches: [
    'src/features/qr/QrShow.tsx',
    'src/features/qr/QrScanModal.tsx',
    'src/features/qr/encodeQr.ts',
    'src/features/qr/qrDecode.ts',
    'src/features/qr/ScanEnvelopeModal.tsx',
  ],
  depends_on: [],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "Single-frame QR with a size guard — if the payload exceeds what fits in one QR code (roughly 2KB binary or 4KB alphanumeric at low error correction), the encoder throws and the UI surfaces a friendly message pointing at Share or Copy. Multi-frame animated QR is later polish. 2026-08-10 (operator: \"Dynasty trust camera works for qr scan flow. Tap it should too\"): decode switched from the native BarcodeDetector API to jsQR. The original claim that BarcodeDetector is 'available on iPhone Safari 17+' (this manifest's own words, born 2026-05-21) was never actually true -- WebKit has never shipped the Shape Detection API -- so QrScanModal's camera path silently fell into its unsupported-browser fallback on every iPhone, and the fallback's own 'pick a photo' escape hatch was ALSO gated on the same missing API, leaving only manual clipboard/text paste. DynastyTrust's own camera scanner (a separate repo) has always used jsQR and works reliably on the operator's iPhone; qrDecode.ts ports that same proven approach here. The isIosPwaStandalone() special case that defaulted QrScanModal to paste-only in installed-PWA mode is also removed -- it was compensating for the same root cause (framed as a PWA-standalone quirk when the actual cause was WebKit lacking BarcodeDetector everywhere, standalone or not), which jsQR does not have.",
};
