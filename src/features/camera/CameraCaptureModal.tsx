import { useEffect, useRef, useState } from 'react';
import { isIosPwaStandalone } from '../../shared/lib/platform.ts';

// Reusable in-app camera. Opens a live getUserMedia preview with a front/back
// toggle and a shutter that captures the current frame to a JPEG File, handed
// back via onCapture. Built 2026-06-05 ("let's build a camera") so photos can
// be taken straight inside the wallet and flow into the existing sign ->
// anchor -> stamp pipeline, rather than only arriving through the OS picker.
//
// The load-bearing reality (grounded against QrScanModal): on an INSTALLED
// iOS PWA, live getUserMedia is unreliable — the prompt may never fire. So on
// that platform (and anywhere mediaDevices is missing) we default to the
// native capture input, which DOES open the system camera reliably from a
// home-screen PWA. A "choose from library" path is always available too, and
// the live preview degrades to the same native input on any camera error.
//
// Pure capture device: it knows nothing about journals, chats, or signing —
// it just returns a File. Every surface that needs a photo links to this one
// component (operator: "use it as well as any other place that needs it").

interface Props {
  /** Receives the captured/selected photo as a JPEG (or original) File. */
  onCapture: (file: File) => void;
  onClose: () => void;
  /** Header label; defaults to "Take a photo". */
  title?: string;
}

function hasLiveCamera(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

export function CameraCaptureModal({ onCapture, onClose, title }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  // Fixed at mount: installed iOS PWA / no-mediaDevices go straight to the
  // native capture input. A live-camera error also drops to the same fallback
  // UI (via liveActive below) without needing to flip this.
  const [useFallback] = useState<boolean>(
    () => !hasLiveCamera() || isIosPwaStandalone(),
  );
  const [status, setStatus] = useState<'starting' | 'live' | 'error'>(
    'starting',
  );
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    if (useFallback) return;
    let cancelled = false;
    setStatus('starting');
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        if (!cancelled) setStatus('live');
      } catch (err) {
        if (cancelled) return;
        setErrorDetail(
          err instanceof Error ? err.message : 'camera failed to start',
        );
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facing, useFallback]);

  function shoot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // The preview is CSS-mirrored for the front camera, but we save the true
    // (unmirrored) frame — the standard convention for a captured selfie.
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (b) => {
        if (b) {
          onCapture(
            new File([b], `tapit-photo-${Date.now()}.jpg`, {
              type: 'image/jpeg',
            }),
          );
        }
      },
      'image/jpeg',
      0.92,
    );
  }

  const liveActive = !useFallback && status !== 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-paper p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{title ?? 'Take a photo'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {/* Hidden inputs for the native-capture and library paths. */}
        <input
          ref={captureInputRef}
          type="file"
          accept="image/*"
          capture={facing}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCapture(f);
            e.target.value = '';
          }}
        />
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCapture(f);
            e.target.value = '';
          }}
        />

        {liveActive && (
          <>
            <div className="mt-3 overflow-hidden rounded-xl border border-ink/10 bg-black">
              <video
                ref={videoRef}
                className={`w-full ${facing === 'user' ? '-scale-x-100' : ''}`}
                playsInline
                muted
              />
            </div>
            {status === 'starting' && (
              <p className="mt-2 text-xs text-muted">Starting camera…</p>
            )}
            <div className="mt-3 flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() =>
                  setFacing((f) => (f === 'environment' ? 'user' : 'environment'))
                }
                className="rounded-full border border-ink/15 px-3 py-2 text-xs font-medium hover:bg-ink/5"
                aria-label="Flip camera"
              >
                🔄 Flip
              </button>
              <button
                type="button"
                onClick={shoot}
                disabled={status !== 'live'}
                aria-label="Take photo"
                className="h-16 w-16 rounded-full border-4 border-ink bg-white shadow-inner disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => libraryInputRef.current?.click()}
                className="rounded-full border border-ink/15 px-3 py-2 text-xs font-medium hover:bg-ink/5"
              >
                🖼 Library
              </button>
            </div>
          </>
        )}

        {!liveActive && (
          <div className="mt-4 space-y-3">
            {status === 'error' && !useFallback && (
              <p className="text-xs text-amber-700">
                Couldn't open the live camera ({errorDetail}). Use your device
                camera instead.
              </p>
            )}
            <button
              type="button"
              onClick={() => captureInputRef.current?.click()}
              className="w-full rounded-md bg-ink py-3 text-sm font-medium text-paper"
            >
              📷 Take a photo
            </button>
            <button
              type="button"
              onClick={() => libraryInputRef.current?.click()}
              className="w-full rounded-md border border-ink/15 py-2.5 text-sm font-medium hover:bg-ink/5"
            >
              🖼 Choose from library
            </button>
            <p className="text-[11px] text-muted">
              Your device camera opens in its own screen, then hands the photo
              back here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
