// Native BarcodeDetector wrapper with feature detection. Available
// on Chrome (desktop + Android since 83), Edge, and Safari iOS 17+.
// Missing on Firefox; on that browser the scan modal shows a
// "scanning not supported on this browser" message and the user
// falls back to paste from clipboard.

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorClass {
  new (opts?: { formats?: string[] }): {
    detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
  };
  getSupportedFormats?: () => Promise<string[]>;
}

function getBarcodeDetector(): BarcodeDetectorClass | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorClass };
  return w.BarcodeDetector ?? null;
}

export function isBarcodeDetectorSupported(): boolean {
  return getBarcodeDetector() !== null;
}

/** Create a detector instance configured for QR codes only. Returns
 *  null when the API is unavailable. */
export function createQrDetector(): {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
} | null {
  const Ctor = getBarcodeDetector();
  if (!Ctor) return null;
  return new Ctor({ formats: ['qr_code'] });
}
