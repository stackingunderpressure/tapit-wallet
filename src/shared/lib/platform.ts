// Shared platform-detection helpers. Kept tiny and dependency-free.

/**
 * True on an iPhone/iPad/iPod running as an installed home-screen web
 * app (added-to-home-screen, standalone display mode) in Safari.
 *
 * Load-bearing fact this exists to guard: live getUserMedia camera
 * access is unreliable in this specific mode on iOS -- the permission
 * prompt may never fire, or firing may not actually hand back a
 * working stream. This is a WebKit/OS-level limitation of the
 * standalone browsing context, separate from (and not fixed by) which
 * JS library decodes frames from the stream once you have one --
 * CameraCaptureModal.tsx and QrScanModal.tsx both need this check for
 * exactly that reason, so it lives here once instead of twice.
 */
export function isIosPwaStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const legacyIosStandalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const isApple = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isApple && (standalone || legacyIosStandalone);
}
