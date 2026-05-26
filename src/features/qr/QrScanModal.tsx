import { useEffect, useRef, useState } from 'react';
import { createQrDetector, isBarcodeDetectorSupported } from './barcodeDetector.ts';

interface Props {
  onScanned: (text: string) => void;
  onClose: () => void;
  /** Force a starting mode. 'paste' skips the camera spin-up so a
   *  caller who already knows the operator can't or won't use the
   *  camera (desktop, denied permission, fallback button) lands
   *  directly on the paste affordances. Default is platform-aware:
   *  iOS PWA standalone → paste; otherwise camera. */
  initialMode?: 'camera' | 'paste';
}

type State =
  | { kind: 'paste' }
  | { kind: 'unsupported' }
  | { kind: 'starting' }
  | { kind: 'scanning' }
  | { kind: 'error'; detail: string };

// iOS PWA in standalone (installed-to-home-screen) mode has known
// gaps in camera + BarcodeDetector access — the API may be present
// but getUserMedia fails or detect() returns nothing, with no clean
// way to feature-detect the difference. Best UX is to default to
// paste mode in that environment so the operator gets a working
// path immediately rather than chasing a camera prompt that won't
// fire. Detection is conservative: standalone display-mode plus an
// iPhone/iPad user-agent. Other PWA platforms (Android) work fine.
function isIosPwaStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  // iOS Safari also exposes the legacy navigator.standalone flag for
  // home-screen apps — catch both shapes.
  const legacyIosStandalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const isApple = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isApple && (standalone || legacyIosStandalone);
}

function initialState(initialMode?: 'camera' | 'paste'): State {
  // Caller-forced paste mode wins over platform detection — the
  // HandshakeModal exposes a "📋 Paste their identity instead"
  // entry that wants to skip the camera spin-up unconditionally.
  if (initialMode === 'paste') return { kind: 'paste' };
  if (isIosPwaStandalone()) return { kind: 'paste' };
  if (!isBarcodeDetectorSupported()) return { kind: 'unsupported' };
  return { kind: 'starting' };
}

// Modal that opens the device camera and looks for QR codes via the
// native BarcodeDetector API. On a hit, calls onScanned with the
// decoded text and the parent closes the modal + populates its
// textarea. On unsupported browsers (Firefox), or on iPhone PWA
// standalone mode where camera + BarcodeDetector are unreliable,
// shows a paste field PLUS a Pick-image-from-Photos button that
// decodes the QR out of a static image — the static-image
// BarcodeDetector path works in PWA standalone where the live
// video path does not, so the iPhone-installed operator's
// workflow becomes Camera app → take photo → return to wallet →
// Pick image → choose. No round-trip through the clipboard. The
// "Or paste text" escape hatch from every other state stays as
// the universal-last-resort.
//
// The video stream is stopped on unmount; the detect-loop uses
// requestAnimationFrame and a cancelled flag so a slow detector
// can't keep running after the user closes.
export function QrScanModal({ onScanned, onClose, initialMode }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>(() => initialState(initialMode));
  const [pasted, setPasted] = useState('');
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // Clipboard-paste affordance — primary friction-killer when the
  // camera is not in play. Operator: "Anything we can do to make it
  // feel like there's not a giant text blob that we're copying
  // back-and-forth each time would help if it didn't show the
  // blah." This path reads the clipboard via the user-gesture-gated
  // navigator.clipboard.readText() and fires onScanned with the
  // result so the host parses + previews via its normal handler;
  // the operator never sees the JSON in this modal.
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const [clipboardBusy, setClipboardBusy] = useState(false);

  async function pasteFromClipboard() {
    setClipboardError(null);
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      setClipboardError(
        "This browser doesn't allow reading the clipboard. Paste the text manually below.",
      );
      return;
    }
    setClipboardBusy(true);
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        setClipboardError(
          "Clipboard is empty. Copy the other person's QR text first, then try again.",
        );
        return;
      }
      onScanned(trimmed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'clipboard read failed';
      setClipboardError(
        `Couldn't read the clipboard (${msg}). Paste the text manually below.`,
      );
    } finally {
      setClipboardBusy(false);
    }
  }

  useEffect(() => {
    if (state.kind !== 'starting') return;
    const detector = createQrDetector();
    if (!detector) {
      setState({ kind: 'unsupported' });
      return;
    }
    // Capture in a non-null local so the closure typing is stable.
    const qr = detector;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setState({ kind: 'scanning' });

        const tick = async () => {
          if (cancelled) return;
          try {
            const codes = await qr.detect(video);
            if (codes.length > 0 && codes[0]) {
              const value = codes[0].rawValue;
              cancelled = true;
              onScanned(value);
              return;
            }
          } catch {
            // Skip a frame; some detectors throw intermittently.
          }
          rafId = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'camera failed to start';
        setState({ kind: 'error', detail: msg });
      }
    }
    void start();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [state.kind, onScanned]);

  function submitPaste() {
    const trimmed = pasted.trim();
    if (trimmed.length === 0) return;
    onScanned(trimmed);
  }

  async function pickImage(file: File) {
    setPickError(null);
    setPicking(true);
    const url = URL.createObjectURL(file);
    try {
      const detector = createQrDetector();
      if (!detector) {
        setPickError(
          'QR decoding is not supported on this browser. Use the paste field below instead.',
        );
        return;
      }
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not load the chosen image.'));
      });
      const codes = await detector.detect(img);
      if (codes.length === 0 || !codes[0]) {
        setPickError(
          'No QR code detected in this image. Try a clearer photo (good lighting, the QR fills most of the frame, no glare).',
        );
        return;
      }
      onScanned(codes[0].rawValue);
    } catch (err) {
      setPickError(err instanceof Error ? err.message : 'Could not decode the image.');
    } finally {
      setPicking(false);
      URL.revokeObjectURL(url);
    }
  }

  const cameraEverPossible =
    !isIosPwaStandalone() && isBarcodeDetectorSupported();

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Scan a QR code</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {state.kind === 'unsupported' && (
          <p className="mt-3 text-sm text-muted">
            QR scanning isn't supported on this browser. Paste the QR contents
            below instead — open your iPhone's Camera app on the other phone,
            point it at the QR, and tap the link or text it picks up to copy.
          </p>
        )}

        {state.kind === 'paste' && isIosPwaStandalone() && (
          <p className="mt-3 text-sm text-muted">
            On iPhone, the installed wallet can't open the camera directly.
            Easiest workaround: open the iPhone <span className="font-medium">Camera</span> app
            on the other phone, point it at the QR, tap the notification to
            copy the text, then paste it here.
          </p>
        )}

        {state.kind === 'paste' && !isIosPwaStandalone() && (
          <p className="mt-3 text-sm text-muted">
            Paste the QR contents below.
          </p>
        )}

        {state.kind === 'starting' && (
          <p className="mt-3 text-sm text-muted">Starting camera…</p>
        )}

        {state.kind === 'error' && (
          <div className="mt-3">
            <p className="text-sm text-red-600">Camera error: {state.detail}</p>
            <p className="mt-2 text-xs text-muted">
              Allow camera permission in your browser and reopen this screen,
              or use the paste option below.
            </p>
          </div>
        )}

        <video
          ref={videoRef}
          className={`mt-3 w-full rounded-md border border-ink/10 bg-black ${
            state.kind === 'scanning' ? '' : 'hidden'
          }`}
          playsInline
          muted
        />

        {state.kind === 'scanning' && (
          <p className="mt-2 text-xs text-muted">
            Point the camera at the QR code your family member is showing you.
            The wallet picks it up automatically.
          </p>
        )}

        {(state.kind === 'paste' ||
          state.kind === 'unsupported' ||
          state.kind === 'error') && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pickImage(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => void pasteFromClipboard()}
              disabled={clipboardBusy}
              className="mt-3 w-full rounded-md bg-ink py-2.5 text-paper text-sm font-medium hover:bg-ink/90 disabled:opacity-40"
            >
              {clipboardBusy ? 'Reading clipboard…' : '📋 Paste from clipboard'}
            </button>
            <p className="mt-1.5 text-xs text-muted">
              The fastest path — copy their QR text into your clipboard
              first, then tap this. The wallet handles the rest; you
              won't see the raw text.
            </p>
            {clipboardError && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {clipboardError}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={picking || !isBarcodeDetectorSupported()}
              className="mt-3 w-full rounded-md bg-accent py-2.5 text-paper text-sm font-medium hover:bg-accent/90 disabled:opacity-40"
            >
              {picking ? 'Decoding image…' : '📷 Pick a photo of the QR'}
            </button>
            <p className="mt-1.5 text-xs text-muted">
              Take a photo of the QR with your iPhone Camera app, then come
              back here and pick it from Photos. The wallet decodes the
              image directly — no need to copy text.
            </p>
            {pickError && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {pickError}
              </div>
            )}

            <div className="my-4 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent" />
            <div className="text-xs uppercase tracking-wide text-muted">
              Or paste the text
            </div>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={4}
              placeholder="Paste the QR text here…"
              className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={submitPaste}
                disabled={pasted.trim().length === 0}
                className="rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
              >
                Use this
              </button>
              {cameraEverPossible && (
                <button
                  type="button"
                  onClick={() => setState({ kind: 'starting' })}
                  className="rounded-md border border-ink/15 bg-white py-2 text-sm"
                >
                  Try camera
                </button>
              )}
            </div>
          </>
        )}

        {(state.kind === 'scanning' || state.kind === 'starting') && (
          <button
            type="button"
            onClick={() => setState({ kind: 'paste' })}
            className="mt-3 w-full text-xs text-muted hover:text-ink underline-offset-2 hover:underline"
          >
            Or paste the text instead
          </button>
        )}
      </div>
    </div>
  );
}
