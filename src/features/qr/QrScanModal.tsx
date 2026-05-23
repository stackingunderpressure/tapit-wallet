import { useEffect, useRef, useState } from 'react';
import { createQrDetector, isBarcodeDetectorSupported } from './barcodeDetector.ts';

interface Props {
  onScanned: (text: string) => void;
  onClose: () => void;
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

function initialState(): State {
  if (isIosPwaStandalone()) return { kind: 'paste' };
  if (!isBarcodeDetectorSupported()) return { kind: 'unsupported' };
  return { kind: 'starting' };
}

// Modal that opens the device camera and looks for QR codes via the
// native BarcodeDetector API. On a hit, calls onScanned with the
// decoded text and the parent closes the modal + populates its
// textarea. On unsupported browsers (Firefox), or on iPhone PWA
// standalone mode where camera + BarcodeDetector are unreliable,
// shows a paste field instead. The "Or paste text" toggle is
// available from every state so a stuck camera always has an
// escape hatch.
//
// The video stream is stopped on unmount; the detect-loop uses
// requestAnimationFrame and a cancelled flag so a slow detector
// can't keep running after the user closes.
export function QrScanModal({ onScanned, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>(initialState);
  const [pasted, setPasted] = useState('');

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
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={5}
              autoFocus
              placeholder="Paste the QR text here…"
              className="mt-3 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
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
