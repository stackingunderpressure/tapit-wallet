import jsQR from 'jsqr';

// Cross-browser QR decoding via jsQR (pure-JS, canvas-pixel based) --
// replaces the previous native BarcodeDetector-API approach, which does
// not work on this operator's device. Operator, 2026-08-10: "Dynasty
// trust camera works for qr scan flow. Tap it should too." Ground truth:
// DynastyTrust's own camera scanner (apps/web/src/components/QrScanner.tsx)
// has always used jsQR, never BarcodeDetector, and works reliably on the
// operator's iPhone. Tapit's barcodeDetector.ts (removed by this change)
// depended on `window.BarcodeDetector`, a Chromium Shape-Detection-API
// interface WebKit has never shipped -- the file's own comment claimed
// "Safari iOS 17+" support, which does not reflect reality; every camera
// scan on an iPhone silently fell straight into the "not supported, paste
// instead" fallback state, and even the "pick a photo" static-image
// fallback was ALSO gated on the same missing API, leaving only manual
// paste. jsQR has no such gap -- it decodes raw pixel data itself, so it
// works identically on every browser that can hand it a canvas, Safari
// included. This also means the old isIosPwaStandalone() "default to
// paste, camera is unreliable here" special case in QrScanModal.tsx was
// solving the wrong problem (it blamed installed-PWA mode; the real
// cause was BarcodeDetector's absence in WebKit generally, standalone or
// not) and has been removed along with it.

/** Decode a QR code from already-extracted RGBA pixel data (a video
 *  frame or a static image drawn to a canvas). Returns null when no QR
 *  code is found in this frame -- not an error, just "keep scanning." */
export function decodeQrFromImageData(imageData: ImageData): string | null {
  const result = jsQR(imageData.data, imageData.width, imageData.height);
  return result?.data ?? null;
}

/** Draw a canvas-drawable source (a live <video> frame, or a loaded
 *  <img>) to an offscreen canvas and decode it. Returns null when the
 *  source has no readable dimensions yet, or no QR code is found. */
export function decodeQrFromSource(
  source: CanvasImageSource,
  width: number,
  height: number,
): string | null {
  if (!width || !height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return decodeQrFromImageData(imageData);
}
