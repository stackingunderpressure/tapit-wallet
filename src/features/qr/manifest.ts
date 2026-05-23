import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'qr',
  born: '2026-05-21',
  purpose:
    "Operator's punch list — QR encode for handing off envelopes and proofs across a room, QR decode via the device camera for receiving them. Encode uses the qrcode npm package (~10KB gzipped) and renders SVG so it scales clean on retina. Decode uses the native BarcodeDetector API which is available on iPhone Safari 17+, Chrome desktop and Android, and Edge — covers the operator's iPhone family. Firefox lacks BarcodeDetector; that path shows a friendly fallback message and the user uses Share or Copy from Cut 3.",
  touches: [
    'src/features/qr/QrShow.tsx',
    'src/features/qr/QrScanModal.tsx',
    'src/features/qr/encodeQr.ts',
    'src/features/qr/barcodeDetector.ts',
    'src/features/qr/ScanEnvelopeModal.tsx',
  ],
  depends_on: [],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "Single-frame QR with a size guard — if the payload exceeds what fits in one QR code (roughly 2KB binary or 4KB alphanumeric at low error correction), the encoder throws and the UI surfaces a friendly message pointing at Share or Copy. Multi-frame animated QR is later polish.",
};
