import { useEffect, useRef, useState } from 'react';
import { createQrDetector, isBarcodeDetectorSupported } from './barcodeDetector.ts';

interface Props {
  onScanned: (text: string) => void;
  onClose: () => void;
}

type State =
  | { kind: 'unsupported' }
  | { kind: 'starting' }
  | { kind: 'scanning' }
  | { kind: 'error'; detail: string };

// Modal that opens the device camera and looks for QR codes via the
// native BarcodeDetector API. On a hit, calls onScanned with the
// decoded text and the parent closes the modal + populates its
// textarea. On unsupported browsers (Firefox at the moment) shows a
// helpful "use Paste or Share" message.
//
// The video stream is stopped on unmount; the detect-loop uses
// requestAnimationFrame and a cancelled flag so a slow detector
// can't keep running after the user closes.
export function QrScanModal({ onScanned, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>(() =>
    isBarcodeDetectorSupported() ? { kind: 'starting' } : { kind: 'unsupported' },
  );

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

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
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
            QR scanning isn't supported on this browser. On iPhone Safari 17
            or newer, Chrome, or Edge it works directly. On Firefox, use{' '}
            <span className="font-medium">Paste</span> or have the other
            person <span className="font-medium">Share</span> the envelope
            to you instead.
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
              or use Paste / Share instead.
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
      </div>
    </div>
  );
}
